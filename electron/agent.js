/**
 * Workflow execution agent — runs a compiled skill against the connected tools.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  SIMPLIFIED REFERENCE IMPLEMENTATION
 *
 *  This public repository ships a reduced version. The tool loop and the MCP
 *  wiring are real; the parts that shape output quality are not included:
 *
 *    · the runtime prompt assembly that injects dates, dedup state and
 *      per-workflow memory into a compiled skill
 *    · the feed-card formatting pass and its template library
 *    · retry, partial-result recovery and truncation handling
 *
 *  It will execute a workflow and return something sensible. It will not
 *  produce the structured cards the real build does.
 * ─────────────────────────────────────────────────────────────────────────
 */

const Anthropic = require('@anthropic-ai/sdk');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { getMemory, setMemory } = require('./database');

// Point these at whichever MCP server exposes your workspace tools.
const MCP_URL = process.env.LUMINA_MCP_URL || 'http://127.0.0.1:9515/mcp';
const MCP_TOKEN = process.env.LUMINA_MCP_TOKEN || '';

const MODEL = process.env.LUMINA_MODEL_QUICK || 'claude-haiku-4-5-20251001';
const MAX_ITERATIONS = 15;
const DEFAULT_LOOKBACK_DAYS = 2;

class LuminaAgent {
  constructor() {
    this._mcpClient = null;
    this._anthropic = null;
    this._tools = [];
    this._anthropicTools = [];
    this._meetingsSearch = null;
    this._ready = false;
  }

  isReady() {
    return this._ready;
  }

  async connect() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('[Agent] ANTHROPIC_API_KEY not set — agent unavailable');
      return;
    }

    this._anthropic = new Anthropic({ apiKey });
    this._mcpClient = new Client({ name: 'lumina-agent', version: '1.0.0' });

    const transport = new StreamableHTTPClientTransport(
      new URL(MCP_URL),
      MCP_TOKEN ? { requestInit: { headers: { Authorization: `Bearer ${MCP_TOKEN}` } } } : undefined
    );
    await this._mcpClient.connect(transport);

    const { tools } = await this._mcpClient.listTools();
    this._tools = tools;

    const prefixes = ['slack_', 'notion_', 'todoist_'];
    this._anthropicTools = tools
      .filter((t) => prefixes.some((p) => t.name.startsWith(p)))
      .map((t) => ({
        name: t.name,
        description: t.description || '',
        input_schema: t.inputSchema || { type: 'object', properties: {} },
      }));

    this._registerMeetingsTool();
    this._ready = true;
    console.log(`[Agent] Connected — ${this._anthropicTools.length} tools available`);
  }

  setMeetingsSearch(meetingsSearch) {
    this._meetingsSearch = meetingsSearch;
    if (this._ready) this._registerMeetingsTool();
  }

  _registerMeetingsTool() {
    if (!this._meetingsSearch) return;
    this._anthropicTools = this._anthropicTools.filter((t) => t.name !== 'meetings_search');
    const def = this._meetingsSearch.getToolDefinition();
    this._anthropicTools.push({ name: def.name, description: def.description, input_schema: def.inputSchema });
  }

  disconnect() {
    this._mcpClient?.close?.();
  }

  async executeWorkflow(workflow, onToolCall) {
    if (!this._ready) throw new Error('Agent not connected — check ANTHROPIC_API_KEY');

    const lastRun = getMemory(workflow.id, 'last_run')?.value || null;
    const systemPrompt = this._buildSystemPrompt(workflow, lastRun);

    console.log(`[Agent] Executing: ${workflow.name} (last run: ${lastRun || 'never'})`);

    const { rawAnswer, toolCalls } = await this._runAgentLoop(
      systemPrompt,
      `Execute the "${workflow.name}" workflow now.`,
      onToolCall
    );

    setMemory(workflow.id, 'last_run', new Date().toISOString());
    console.log(`[Agent] Done: "${workflow.name}" — ${toolCalls.length} tool calls`);

    return this._formatForFeed(rawAnswer);
  }

  // NOTE: the real build injects dedup state, per-source hints and a richer
  // runtime context block here.
  _buildSystemPrompt(workflow, lastRun) {
    const now = new Date();
    const lookback = new Date(now.getTime() - DEFAULT_LOOKBACK_DAYS * 86400000)
      .toISOString().split('T')[0];

    const skill = (workflow.skillContent || '')
      .replace(/\{\{LOOKBACK_DATE\}\}/g, lookback)
      .replace(/\{\{TODAY\}\}/g, now.toISOString().split('T')[0]);

    const base = skill.trim() || [
      `# ${workflow.name}`,
      '',
      '## Core Task',
      workflow.instructions || 'Process data from the configured sources and route the results.',
    ].join('\n');

    return `${base}

## Runtime Context
- Today: ${now.toISOString().split('T')[0]}
- Lookback date: ${lookback}
- Last execution: ${lastRun || 'never (first run)'}
- Only report what the tools actually returned.`;
  }

  async _runAgentLoop(systemPrompt, userMessage, onToolCall) {
    const toolCalls = [];
    const messages = [{ role: 'user', content: userMessage }];
    const tools = this._anthropicTools.length ? this._anthropicTools : undefined;
    let rawAnswer = '';

    let response = await this._anthropic.messages.create({
      model: MODEL, max_tokens: 4096, system: systemPrompt, messages, tools,
    });

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const toolUses = response.content.filter((b) => b.type === 'tool_use');

      if (toolUses.length === 0) {
        rawAnswer = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
        break;
      }

      messages.push({ role: 'assistant', content: response.content });

      const toolResults = [];
      for (const tu of toolUses) {
        toolCalls.push(tu.name);
        onToolCall?.(tu.name);

        let resultText;
        try {
          if (tu.name === 'meetings_search' && this._meetingsSearch) {
            resultText = this._meetingsSearch.handleToolCall(tu.input);
          } else {
            const r = await this._mcpClient.callTool({ name: tu.name, arguments: tu.input });
            resultText = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
          }
        } catch (err) {
          resultText = `Error: ${err.message}`;
          console.error(`[Agent]   Error: ${err.message}`);
        }

        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: resultText });
      }

      messages.push({ role: 'user', content: toolResults });
      response = await this._anthropic.messages.create({
        model: MODEL, max_tokens: 4096, system: systemPrompt, messages, tools,
      });
    }

    return { rawAnswer, toolCalls };
  }

  // NOTE: the real build runs a second, template-guided formatting pass so the
  // feed renders typed cards. This only unwraps JSON the model already produced.
  _formatForFeed(rawAnswer) {
    if (!rawAnswer) {
      return { type: 'text', data: { content: 'Workflow executed but produced no output.' } };
    }

    try {
      const cleaned = rawAnswer
        .replace(/^```(?:json)?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.type && parsed.data) return parsed;
    } catch {}

    return { type: 'text', data: { content: rawAnswer } };
  }
}

module.exports = { LuminaAgent };
