/**
 * Conversational agent behind the floating bar and the chat panel.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  SIMPLIFIED REFERENCE IMPLEMENTATION
 *
 *  This public repository ships a reduced version. The interface, the tool
 *  loop and the scope plumbing are real; the parts that took the longest to
 *  get right are not included:
 *
 *    · the tuned system prompts — retrieval discipline, answer shaping, and
 *      the domain rules that decide how evidence maps onto a conclusion
 *    · the classifier that routes a question to the right model and depth
 *    · the citation/scope contract that forces every structured answer to
 *      declare the exact window and population it was computed over
 *    · the aggregation rules that keep analytical answers honest about what
 *      the underlying data can and cannot support
 *
 *  What remains is a working, generic assistant. It answers questions using
 *  whatever tools are connected. It does not behave like the real one.
 * ─────────────────────────────────────────────────────────────────────────
 */

const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const CONTEXT_GRAPH_URL = process.env.CONTEXT_GRAPH_MCP_URL || 'http://127.0.0.1:9516/mcp';

const MODEL_QUICK = process.env.LUMINA_MODEL_QUICK || 'claude-haiku-4-5-20251001';
const MODEL_ANALYTICAL = process.env.LUMINA_MODEL_ANALYTICAL || 'claude-haiku-4-5-20251001';

// Scope selects which tool family a message may call:
//   'workspace'     — the connected MCP workspace tools (default)
//   'context_graph' — the graph tools only (cg_*)
//   'all'           — both
const VALID_SCOPES = new Set(['all', 'workspace', 'context_graph']);

// NOTE: the real build classifies intent far more precisely than a keyword test.
const RE_ANALYTICAL = /\b(how\s+many|across|compare|analyz\w*|aggregate|score|evaluate|framework)\b/i;

class ChatAgent {
  constructor() {
    this._mcpClient = null;              // workspace MCP client
    this._contextGraphClient = null;     // context-graph MCP client
    this._anthropic = null;
    this._workspaceTools = [];
    this._contextGraphTools = [];
    this._meetingsSearch = null;
    this._ready = false;
    // The context-graph connection is attempted once at startup. If that server
    // comes up later, restart the app — there is no reconnect-on-demand yet.
  }

  connect(mcpClient, allTools, meetingsSearch) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('[ChatAgent] ANTHROPIC_API_KEY not set');
      return;
    }

    this._anthropic = new Anthropic({ apiKey });
    this._mcpClient = mcpClient;
    this._meetingsSearch = meetingsSearch || null;

    this._workspaceTools = (allTools || [])
      .filter((t) => t.name.startsWith('slack_') || t.name.startsWith('notion_'))
      .map((t) => ({
        name: t.name,
        description: t.description || '',
        input_schema: t.inputSchema || { type: 'object', properties: {} },
      }));

    if (this._meetingsSearch) {
      const def = this._meetingsSearch.getToolDefinition();
      this._workspaceTools.push({ name: def.name, description: def.description, input_schema: def.inputSchema });
    }

    this._ready = true;
    console.log(`[ChatAgent] Ready with ${this._workspaceTools.length} workspace tools`);

    this._connectContextGraph().catch((err) => {
      console.warn('[ChatAgent] Context-Graph MCP unavailable:', err.message, '— that scope will be disabled');
    });
  }

  async _connectContextGraph() {
    const SDK = path.resolve(__dirname, '../node_modules/@modelcontextprotocol/sdk/dist/cjs');
    const { Client } = require(path.join(SDK, 'client', 'index.js'));
    const { StreamableHTTPClientTransport } = require(path.join(SDK, 'client', 'streamableHttp.js'));

    const client = new Client({ name: 'lumina-context-graph', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(CONTEXT_GRAPH_URL)));
    const { tools } = await client.listTools();

    this._contextGraphClient = client;
    this._contextGraphTools = tools.map((t) => ({
      name: t.name,
      description: t.description || '',
      input_schema: t.inputSchema || { type: 'object', properties: {} },
    }));
    console.log(`[ChatAgent] Context-Graph connected — ${this._contextGraphTools.length} tools`);
  }

  isReady() {
    return this._ready;
  }

  _selectScope(scope) {
    const resolved = VALID_SCOPES.has(scope) ? scope : 'workspace';
    let tools = [];
    if (resolved === 'workspace' || resolved === 'all') tools = tools.concat(this._workspaceTools);
    if (resolved === 'context_graph' || resolved === 'all') tools = tools.concat(this._contextGraphTools);
    return { scope: resolved, tools };
  }

  // NOTE: placeholder prompt. The real one is considerably longer and is what
  // actually determines answer quality.
  _buildSystemPrompt(mode, scope) {
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    return [
      'You are a workspace assistant. Answer questions using the tools available to you.',
      `Today is ${today}.`,
      '',
      'Guidelines:',
      '- Search before answering. Do not guess.',
      '- Read the full context of a result before relying on it; snippets mislead.',
      '- Be specific: name people, channels, dates and numbers rather than summarising vaguely.',
      '- Say plainly when the data does not support an answer.',
      mode === 'analytical'
        ? '- This question needs analysis. Explain your method and state any assumptions.'
        : '- Keep it short. A few bullets, each with its source.',
      scope === 'context_graph'
        ? '- Only the cg_* tools are in scope. Do not assume anything beyond what they return.'
        : '',
    ].filter(Boolean).join('\n');
  }

  async sendMessage(text, onToolCall, scope) {
    if (!this._ready) throw new Error('ChatAgent not connected');

    const { scope: resolvedScope, tools } = this._selectScope(scope);
    if (resolvedScope === 'context_graph' && this._contextGraphTools.length === 0) {
      throw new Error('Context-Graph MCP is not connected. Start it and restart Lumina.');
    }

    const analytical = RE_ANALYTICAL.test(text);
    const mode = analytical ? 'analytical' : 'quick';
    const model = analytical ? MODEL_ANALYTICAL : MODEL_QUICK;
    const maxTokens = analytical ? 8192 : 2048;
    const maxIterations = analytical ? 25 : 15;
    const system = this._buildSystemPrompt(mode, resolvedScope);

    console.log(`[ChatAgent] scope=${resolvedScope} mode=${mode} model=${model} tools=${tools.length}`);

    const messages = [{ role: 'user', content: text }];
    const toolCalls = [];
    const toolScopes = [];   // { name, query_summary, scope } for tools that declare it

    let response = await this._anthropic.messages.create({ model, max_tokens: maxTokens, system, messages, tools });

    for (let i = 0; i < maxIterations; i++) {
      const toolUses = response.content.filter((b) => b.type === 'tool_use');
      if (toolUses.length === 0) break;

      messages.push({ role: 'assistant', content: response.content });

      const toolResults = [];
      for (const tu of toolUses) {
        toolCalls.push(tu.name);
        onToolCall?.(tu.name);

        let resultText;
        try {
          if (tu.name === 'meetings_search' && this._meetingsSearch) {
            resultText = this._meetingsSearch.handleToolCall(tu.input);
          } else if (tu.name.startsWith('cg_')) {
            if (!this._contextGraphClient) throw new Error('Context-Graph MCP is not connected');
            const r = await this._contextGraphClient.callTool({ name: tu.name, arguments: tu.input });
            resultText = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
            try {
              const parsed = JSON.parse(resultText);
              if (parsed?.query_summary) {
                toolScopes.push({ name: tu.name, query_summary: parsed.query_summary, scope: parsed.scope || null });
              }
            } catch {}
          } else {
            const r = await this._mcpClient.callTool({ name: tu.name, arguments: tu.input });
            resultText = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
          }
        } catch (err) {
          resultText = `Error: ${err.message}`;
          console.error(`[ChatAgent] Tool error: ${err.message}`);
        }

        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: resultText });
      }

      messages.push({ role: 'user', content: toolResults });
      response = await this._anthropic.messages.create({ model, max_tokens: maxTokens, system, messages, tools });
    }

    const answer = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    return { answer, toolCalls, toolScopes, model, mode, scope: resolvedScope };
  }

  getScopesAvailable() {
    const scopes = ['workspace'];
    if (this._contextGraphTools.length > 0) scopes.push('context_graph', 'all');
    return scopes;
  }
}

module.exports = { ChatAgent };
