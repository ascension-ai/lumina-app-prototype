const fs = require('fs');
const path = require('path');

class MeetingsSearch {
  constructor(dataDir) {
    this._dataDir = dataDir;
    this._meetings = []; // deduplicated, parsed meetings
    this._load();
  }

  get messageCount() {
    return this._meetings.length;
  }

  // ── Loading & Parsing ──────────────────────────────────────────────

  _load() {
    const files = fs.readdirSync(this._dataDir).filter(f => f.endsWith('.json') && f.startsWith('olivbot-'));

    const allMessages = [];
    for (const file of files) {
      const raw = JSON.parse(fs.readFileSync(path.join(this._dataDir, file), 'utf-8'));
      const channelName = raw.channel_name || file.replace('.json', '');
      for (const msg of raw.messages || []) {
        allMessages.push({ ...msg, channel: channelName });
      }
    }

    // Group by meeting URL to deduplicate (each meeting produces 2 messages)
    const byUrl = new Map();
    for (const msg of allMessages) {
      const url = this._extractMeetingUrl(msg.text);
      const key = url || msg.ts; // fallback to ts if no URL found
      if (!byUrl.has(key)) {
        byUrl.set(key, []);
      }
      byUrl.get(key).push(msg);
    }

    // Merge duplicates: prefer the detailed version, extract structured fields
    for (const [url, msgs] of byUrl) {
      // Pick the longest message as the "detailed" one
      msgs.sort((a, b) => b.text.length - a.text.length);
      const detailed = msgs[0];
      // Find the short summary (has *Account*: and *Duration*:) — may not be msgs[1]
      const short = msgs.find(m => m !== detailed && /\*Account\*:/.test(m.text)) || (msgs.length > 1 ? msgs[1] : null);

      const parsed = this._parseMessage(detailed, short);
      parsed.channel = detailed.channel;
      parsed.ts = detailed.ts;
      parsed.meetingUrl = url.startsWith('http') ? url : null;

      // Build searchable text (stripped of markup, lowercased)
      const cleanText = this._stripMarkup(detailed.text + (short ? '\n' + short.text : ''));
      parsed._searchText = cleanText.toLowerCase();

      // Extract header text (title + account + participants) for boosted scoring
      const headerLines = cleanText.split('\n').slice(0, 8).join(' ').toLowerCase();
      parsed._headerText = headerLines;

      this._meetings.push(parsed);
    }

    // Sort by date descending (newest first)
    this._meetings.sort((a, b) => parseFloat(b.ts) - parseFloat(a.ts));

    console.log(`[MeetingsSearch] Loaded ${this._meetings.length} meetings from ${files.length} channels`);
  }

  _extractMeetingUrl(text) {
    const match = text.match(/<(https:\/\/my\.oliv\.ai\/meetings\/[^|>]+)/);
    return match ? match[1] : null;
  }

  _stripMarkup(text) {
    return text
      .replace(/<([^|>]+)\|([^>]+)>/g, '$2')   // <url|text> → text
      .replace(/<([^>]+)>/g, '$1')               // <url> → url
      .replace(/:[a-z0-9_]+:/g, '')              // :emoji: → remove
      .replace(/&gt;/g, '>')                     // HTML entities
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&')
      .replace(/\*/g, '')                        // bold markers
      .replace(/\s+/g, ' ')
      .trim();
  }

  _parseMessage(detailed, short) {
    const text = detailed.text;
    const shortText = short ? short.text : '';

    // Title: between | and *> — may have emoji prefix like :spiral_calendar_pad:
    const titleMatch = text.match(/\|(?::[a-z_]+:\s*)?[*]([^*]+?)[*]>/);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled Meeting';

    // Account appears in short summary as "*Account*: Name" or in detailed as Account info block
    const account = this._extractField(shortText, /\*Account\*:\s*(.+)/)
      || this._extractField(text, /\*Account\*:\s*(.+)/);
    const date = this._extractField(text, /\*Date\*:\s*(.+)/);
    const participants = this._extractField(text, /\*Participants\*:\s*(.+)/);
    const duration = this._extractField(shortText, /\*Duration\*:\s*(.+)/)
      || this._extractField(text, /\*Duration\*:\s*(.+)/);

    // Extract sections from detailed message
    const accountUpdates = this._extractBullets(text, 'Account updates');
    const goingWell = this._extractBullets(text, "What's going well");
    const notGoingWell = this._extractBullets(text, "What's not going well");
    const nextSteps = this._extractNextSteps(text);

    // Extract key takeaways (often in the short message)
    let keyTakeaways = this._extractKeyTakeaways(text);
    if (keyTakeaways.length === 0 && short) {
      keyTakeaways = this._extractKeyTakeaways(short.text);
    }

    return {
      title: this._cleanField(title),
      account: this._cleanField(account),
      date: this._cleanField(date),
      participants: participants ? participants.split(',').map(p => this._cleanField(p).replace(/<[^>]+>/g, '').trim()).filter(Boolean) : [],
      duration: this._cleanField(duration),
      keyTakeaways,
      accountUpdates,
      goingWell,
      notGoingWell,
      nextSteps,
    };
  }

  _cleanField(text) {
    if (!text) return '';
    return text
      .replace(/<([^|>]+)\|([^>]+)>/g, '$2')
      .replace(/<([^>]+)>/g, '')
      .replace(/:[a-z0-9_]+:/g, '')
      .replace(/\*/g, '')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&')
      .trim();
  }

  _extractField(text, regex) {
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  }

  _extractBullets(text, sectionHeader) {
    // Look for the section header then collect bullet points
    const sectionMatch = text.match(new RegExp(
      sectionHeader.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([\\s\\S]*?)(?=\\*(?:What|Next|Account)|$)',
      'i'
    ));
    if (!sectionMatch) return [];

    const bullets = sectionMatch[1].match(/•\s*([^•]+)/g);
    if (!bullets) return [];

    return bullets.slice(0, 5).map(b =>
      this._cleanField(b.replace(/^•\s*/, '').trim()).replace(/\s*>\s*$/, '')
    ).filter(b => b.length > 10);
  }

  _extractKeyTakeaways(text) {
    // Key takeaways appear after "Key takeaways" as bullet points with •
    const match = text.match(/Key takeaways[\s\S]*?((?:•[^•]+)+)/i);
    if (!match) return [];

    const bullets = match[1].match(/•\s*([^•]+)/g);
    if (!bullets) return [];

    return bullets.slice(0, 6).map(b =>
      this._cleanField(b.replace(/^•\s*/, '').trim())
    ).filter(b => b.length > 5);
  }

  _extractNextSteps(text) {
    const match = text.match(/Next step[s]?:?\s*([\s\S]*?)(?::video_camera:|$)/i);
    if (!match) return [];
    const step = this._cleanField(match[1]).replace(/^\d+\s*[-–]\s*/, '');
    return step.length > 10 ? [step] : [];
  }

  // ── Search ─────────────────────────────────────────────────────────

  search(query, { limit = 10, date_after, date_before, channel, channels, list_all = false } = {}) {
    let candidates = this._meetings;

    // Channel filter — prefer `channels` array, fall back to singular `channel`
    const channelList = Array.isArray(channels) && channels.length > 0
      ? channels
      : (channel ? [channel] : null);
    if (channelList) {
      const lowered = channelList.map(c => String(c).toLowerCase()).filter(Boolean);
      if (lowered.length > 0) {
        candidates = candidates.filter(m => {
          const ch = m.channel.toLowerCase();
          return lowered.some(c => ch.includes(c));
        });
      }
    }

    if (date_after) {
      const afterTs = new Date(date_after).getTime() / 1000;
      if (!isNaN(afterTs)) {
        candidates = candidates.filter(m => parseFloat(m.ts) >= afterTs);
      }
    }
    if (date_before) {
      const beforeTs = new Date(date_before).getTime() / 1000;
      if (!isNaN(beforeTs)) {
        candidates = candidates.filter(m => parseFloat(m.ts) <= beforeTs);
      }
    }

    const cap = Math.min(limit, 200);

    // list_all: bypass scoring, return the full population (newest first, capped)
    if (list_all) {
      return candidates
        .slice()
        .sort((a, b) => parseFloat(b.ts) - parseFloat(a.ts))
        .slice(0, cap);
    }

    if (!query || !query.trim()) return [];

    const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    if (queryTokens.length === 0) return [];

    const queryLower = query.toLowerCase();

    // Score each meeting
    const scored = candidates.map(meeting => {
      let score = 0;

      // Full query match bonus
      if (meeting._searchText.includes(queryLower)) {
        score += 10;
      }

      // Token matching with header boost
      for (const token of queryTokens) {
        if (meeting._headerText.includes(token)) {
          score += 3; // 3x for title/account/participants
        } else if (meeting._searchText.includes(token)) {
          score += 1;
        }
      }

      return { meeting, score };
    });

    // Filter to matches only, sort by score then recency
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score || parseFloat(b.meeting.ts) - parseFloat(a.meeting.ts))
      .slice(0, cap)
      .map(s => s.meeting);
  }

  // ── Tool Interface ─────────────────────────────────────────────────

  getToolDefinition() {
    return {
      name: 'meetings_search',
      description: [
        'Search pre-downloaded meeting recordings from olivbot Slack channels.',
        'Two modes: (1) scored search when `query` is provided, (2) full-population list when `list_all: true`.',
        '',
        'Use scored search for targeted lookups (account name, topic, person). Use `list_all: true` when you need the full population rather than the top matches — for example when aggregating or comparing across every meeting in one or more channels.',
        '',
        'Channels (match by substring, case-insensitive): `kam-india`, `ent-sales-india`, `csm`, `support`, `product`. Pass one via `channel` or several via `channels: ["csm", "kam-india"]`.',
        '',
        'Returns per meeting: title, account, date, participants, duration, keyTakeaways, accountUpdates, goingWell, notGoingWell, nextSteps, recording URL. Data is olivbot-generated summaries — NOT full transcripts.',
      ].join('\n'),
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query — account name, person name, topic, or keyword. Optional when list_all is true.',
          },
          list_all: {
            type: 'boolean',
            description: 'When true, return every meeting matching the channel/date filters (newest first, up to `limit`). Use for framework scoring and aggregation; do NOT combine with a narrow `query`.',
          },
          limit: {
            type: 'number',
            description: 'Max results to return (default 10, cap 200). For list_all framework analysis, use 100–200.',
          },
          date_after: {
            type: 'string',
            description: 'Only return meetings after this date (YYYY-MM-DD)',
          },
          date_before: {
            type: 'string',
            description: 'Only return meetings before this date (YYYY-MM-DD)',
          },
          channel: {
            type: 'string',
            description: 'Single-channel substring filter. Prefer `channels` for multi-channel queries.',
          },
          channels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Multi-channel filter. Match if any entry is a substring of the channel name. Example: ["csm", "kam-india"].',
          },
        },
      },
    };
  }

  handleToolCall(args) {
    const { query, limit, date_after, date_before, channel, channels, list_all } = args || {};
    const effectiveLimit = limit || (list_all ? 100 : 10);
    const results = this.search(query, {
      limit: effectiveLimit,
      date_after,
      date_before,
      channel,
      channels,
      list_all: !!list_all,
    });

    if (results.length === 0) {
      const descriptor = list_all
        ? `matching the requested filters`
        : `matching "${query || ''}"`;
      return `No meetings found ${descriptor}.`;
    }

    const headerDescriptor = list_all
      ? (query ? `matching "${query}" (list_all mode)` : `(list_all mode)`)
      : `matching "${query}"`;
    const lines = [`Found ${results.length} meeting(s) ${headerDescriptor}:\n`];

    for (let i = 0; i < results.length; i++) {
      const m = results[i];
      lines.push(`## Meeting ${i + 1}: ${m.title}`);
      lines.push(`Account: ${m.account || 'N/A'} | Date: ${m.date || 'N/A'} | Channel: ${m.channel}`);
      if (m.participants.length > 0) {
        lines.push(`Participants: ${m.participants.join(', ')}`);
      }
      if (m.duration) {
        lines.push(`Duration: ${m.duration}`);
      }

      if (m.keyTakeaways.length > 0) {
        lines.push(`\nKey Takeaways:`);
        for (const t of m.keyTakeaways) lines.push(`- ${t}`);
      }
      if (m.accountUpdates.length > 0) {
        lines.push(`\nAccount Updates:`);
        for (const u of m.accountUpdates) lines.push(`- ${u}`);
      }
      if (m.goingWell.length > 0) {
        lines.push(`\nGoing Well:`);
        for (const g of m.goingWell) lines.push(`- ${g}`);
      }
      if (m.notGoingWell.length > 0) {
        lines.push(`\nNot Going Well:`);
        for (const n of m.notGoingWell) lines.push(`- ${n}`);
      }
      if (m.nextSteps.length > 0) {
        lines.push(`\nNext Steps:`);
        for (const s of m.nextSteps) lines.push(`- ${s}`);
      }
      if (m.meetingUrl) {
        lines.push(`\nRecording: ${m.meetingUrl}`);
      }
      lines.push('\n---\n');
    }

    return lines.join('\n');
  }
}

module.exports = { MeetingsSearch };
