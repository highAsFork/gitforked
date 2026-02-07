import { GrokAPI } from './grok-api.js';
import { config } from '../config/config.js';
import crypto from 'crypto';

class Agent {
  constructor({ id, name, role, systemPrompt, provider, model, apiKey, ollamaBaseUrl }) {
    this.id = id || crypto.randomUUID().slice(0, 8);
    this.name = name;
    this.role = role || '';
    this.systemPrompt = systemPrompt || '';
    this.provider = provider || config.getProvider();
    this.model = model || config.getModel();
    this.apiKey = apiKey || null;
    this.ollamaBaseUrl = ollamaBaseUrl || null;
    this.messages = [];
    this.status = 'idle'; // 'idle' | 'thinking' | 'error'
    this.grokAPI = null;
  }

  init() {
    const opts = {
      provider: this.provider,
      model: this.model
    };

    if (this.apiKey) {
      opts.apiKey = this.apiKey;
    }

    if (this.ollamaBaseUrl) {
      opts.ollamaBaseUrl = this.ollamaBaseUrl;
    }

    if (this.systemPrompt) {
      opts.systemPromptOverride = this.systemPrompt;
    }

    this.grokAPI = new GrokAPI(opts);
    return this;
  }

  async sendMessage(msg, opts = {}) {
    this.status = 'thinking';
    try {
      const response = await this.grokAPI.processPrompt(msg, {
        model: this.model,
        directory: opts.directory || process.cwd(),
        mode: opts.mode || 'build',
        messages: opts.includeHistory ? this.messages : []
      });

      this.messages.push({ role: 'user', content: msg });
      this.messages.push({ role: 'assistant', content: response });
      this.status = 'idle';
      return response;
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }

  injectContext(contextMessages) {
    // Build a context string from shared messages for team channel use
    let contextStr = '== Team Collaboration Context ==\n';
    for (const msg of contextMessages) {
      const sender = msg.agentName
        ? `[${msg.agentName}${msg.role ? ` (${msg.role})` : ''}]`
        : '[You]';
      contextStr += `${sender}: ${msg.content}\n`;
    }
    return contextStr;
  }

  clearHistory() {
    this.messages = [];
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      systemPrompt: this.systemPrompt,
      provider: this.provider,
      model: this.model,
      apiKey: this.apiKey ? this.apiKey : '__config__',
      ollamaBaseUrl: this.ollamaBaseUrl
    };
  }

  static fromJSON(data) {
    const resolvedApiKey = data.apiKey === '__config__' ? null : data.apiKey;
    const agent = new Agent({
      id: data.id,
      name: data.name,
      role: data.role,
      systemPrompt: data.systemPrompt,
      provider: data.provider,
      model: data.model,
      apiKey: resolvedApiKey,
      ollamaBaseUrl: data.ollamaBaseUrl
    });
    return agent;
  }
}

export { Agent };
