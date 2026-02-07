import blessed from 'blessed';
import { EventEmitter } from 'events';
import { OllamaProvider } from '../../lib/ollama-provider.js';
import { config } from '../../config/config.js';

const PROVIDER_MODELS = {
  grok: [
    'grok-4-1-fast-reasoning',
    'grok-4-1-fast-non-reasoning',
    'grok-4-latest',
    'grok-4',
    'grok-3-latest',
    'grok-3-fast',
    'grok-3-mini',
    'grok-3-mini-fast'
  ],
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma2-9b-it'
  ],
  gemini: [
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ],
  claude: [
    'claude-opus-4-6',
    'claude-opus-4-5-20251101',
    'claude-sonnet-4-5-20250929',
    'claude-haiku-4-5-20251001'
  ],
  ollama: []
};

const PROVIDERS = ['grok', 'groq', 'gemini', 'claude', 'ollama'];

// Step-by-step wizard using explicit readInput() calls.
// NO inputOnFocus — we control when the textbox enters input mode.
class AgentConfigDialog extends EventEmitter {
  constructor(screen) {
    super();
    this.screen = screen;
    this.ollamaProvider = new OllamaProvider(config.getOllamaBaseUrl());
    this.editingAgent = null;
    this._inputActive = false;

    this.fields = { name: '', role: '', provider: 'grok', model: '', systemPrompt: '' };
    this.step = 0;

    // --- Overlay ---
    this.overlay = blessed.box({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: 16,
      border: { type: 'line', fg: 'cyan' },
      style: { bg: 'black', fg: 'white', border: { fg: 'cyan' } },
      label: ' Add Agent ',
      hidden: true,
      tags: true
    });

    // --- Status: shows all field values ---
    this.statusBox = blessed.box({
      parent: this.overlay,
      top: 0,
      left: 1,
      width: '100%-4',
      height: 6,
      style: { bg: 'black', fg: 'white' },
      tags: true
    });

    // --- Prompt label ---
    this.promptLabel = blessed.box({
      parent: this.overlay,
      top: 7,
      left: 1,
      width: '100%-4',
      height: 1,
      style: { bg: 'black', fg: 'white' },
      tags: true
    });

    // --- Textbox (NO inputOnFocus) ---
    this.textInput = blessed.textbox({
      parent: this.overlay,
      top: 8,
      left: 1,
      width: '100%-4',
      height: 3,
      border: { type: 'line', fg: 'cyan' },
      style: { bg: '#1a1a1a', fg: 'white', border: { fg: 'cyan' } },
      hidden: true
      // NOT inputOnFocus — we call readInput() explicitly
    });

    // --- List ---
    this.selectList = blessed.list({
      parent: this.overlay,
      top: 8,
      left: 1,
      width: '100%-4',
      height: 6,
      border: { type: 'line', fg: 'cyan' },
      style: {
        bg: '#1a1a1a',
        fg: 'white',
        border: { fg: 'cyan' },
        selected: { bg: 'cyan', fg: 'black', bold: true }
      },
      hidden: true,
      mouse: true,
      keys: true,
      vi: true,
      tags: true
    });

    // --- Footer ---
    this.footer = blessed.box({
      parent: this.overlay,
      bottom: 0,
      left: 1,
      width: '100%-4',
      height: 1,
      style: { bg: 'black', fg: 'gray' },
      tags: true,
      content: '{gray-fg}Enter: confirm | Escape: cancel/back{/}'
    });

    // --- List event handlers (persistent) ---
    this.selectList.on('select', (item, index) => {
      this.handleListSelect(index);
    });
    this.selectList.key(['escape'], () => {
      this.handleBack();
    });
  }

  // --- Called after textbox readInput completes ---
  _onTextDone(err, value) {
    this._inputActive = false;
    if (err) {
      // Escape pressed
      this.handleBack();
      return;
    }
    this.handleTextSubmit(value ? value.trim() : '');
  }

  // --- Start textbox input mode on next tick (avoids re-entrant issues) ---
  _startTextInput() {
    this.textInput.show();
    this.screen.render();
    // Defer readInput to next tick so blessed finishes current render cycle
    process.nextTick(() => {
      if (!this.overlay.visible) return; // dialog was closed
      this._inputActive = true;
      this.textInput.readInput((err, value) => this._onTextDone(err, value));
    });
  }

  handleTextSubmit(value) {
    switch (this.step) {
      case 0: // name
        if (!value && !this.fields.name) {
          // Name required — re-prompt
          this.renderStep();
          return;
        }
        if (value) this.fields.name = value;
        this.step = 1;
        break;
      case 1: // role
        if (value) this.fields.role = value;
        this.step = 2;
        break;
      case 4: // system prompt
        if (value) this.fields.systemPrompt = value;
        this.step = 5;
        break;
    }
    this.renderStep();
  }

  handleListSelect(index) {
    switch (this.step) {
      case 2: // provider
        this.fields.provider = PROVIDERS[index] || 'grok';
        this.step = 3;
        break;
      case 3: { // model
        const models = this.getModelsForProvider(this.fields.provider);
        this.fields.model = models[index] || models[0] || '';
        this.step = 4;
        break;
      }
      case 5: // confirm
        if (index === 0) {
          this.save();
        } else {
          this.hide();
        }
        return;
    }
    this.renderStep();
  }

  handleBack() {
    if (this.step > 0) {
      this.step--;
      this.renderStep();
    } else {
      this.hide();
    }
  }

  renderStep() {
    // Update status summary
    const n = this.fields.name || '{gray-fg}(not set){/}';
    const r = this.fields.role || '{gray-fg}(not set){/}';
    const p = this.fields.provider || '{gray-fg}(not set){/}';
    const m = this.fields.model || '{gray-fg}(not set){/}';
    const s = this.fields.systemPrompt
      ? this.fields.systemPrompt.slice(0, 40) + (this.fields.systemPrompt.length > 40 ? '...' : '')
      : '{gray-fg}(default){/}';

    const arrow = '{yellow-fg}>{/} ';
    this.statusBox.setContent([
      `${this.step === 0 ? arrow : '  '}{cyan-fg}Name:{/}     ${n}`,
      `${this.step === 1 ? arrow : '  '}{cyan-fg}Role:{/}     ${r}`,
      `${this.step === 2 ? arrow : '  '}{cyan-fg}Provider:{/} ${p}`,
      `${this.step === 3 ? arrow : '  '}{cyan-fg}Model:{/}    ${m}`,
      `${this.step === 4 ? arrow : '  '}{cyan-fg}Prompt:{/}   ${s}`,
    ].join('\n'));

    // Hide both inputs
    this.textInput.hide();
    this.selectList.hide();

    switch (this.step) {
      case 0:
        this.promptLabel.setContent('{bold}Enter agent name:{/}');
        this.textInput.clearValue();
        if (this.fields.name) this.textInput.setValue(this.fields.name);
        this._startTextInput();
        return; // _startTextInput handles render

      case 1:
        this.promptLabel.setContent('{bold}Enter agent role (e.g. Code Reviewer, Security):{/}');
        this.textInput.clearValue();
        if (this.fields.role) this.textInput.setValue(this.fields.role);
        this._startTextInput();
        return;

      case 2:
        this.promptLabel.setContent('{bold}Select provider:{/}');
        this.selectList.setItems(PROVIDERS.map(pr =>
          pr === this.fields.provider ? `${pr} (current)` : pr
        ));
        this.selectList.show();
        this.selectList.focus();
        this.selectList.select(Math.max(0, PROVIDERS.indexOf(this.fields.provider)));
        break;

      case 3: {
        this.promptLabel.setContent(`{bold}Select model for ${this.fields.provider}:{/}`);
        const models = this.getModelsForProvider(this.fields.provider);
        this.selectList.setItems(models.length > 0 ? models : ['(no models available)']);
        this.selectList.show();
        this.selectList.focus();
        this.selectList.select(0);
        break;
      }

      case 4:
        this.promptLabel.setContent('{bold}Enter system prompt (or blank for default):{/}');
        this.textInput.clearValue();
        if (this.fields.systemPrompt) this.textInput.setValue(this.fields.systemPrompt);
        this._startTextInput();
        return;

      case 5:
        this.promptLabel.setContent('{bold}{green-fg}Ready to save?{/}');
        this.selectList.setItems(['{green-fg}Save agent{/}', '{red-fg}Cancel{/}']);
        this.selectList.show();
        this.selectList.focus();
        this.selectList.select(0);
        break;
    }

    this.screen.render();
  }

  getModelsForProvider(provider) {
    return PROVIDER_MODELS[provider] || [];
  }

  show(existingAgent) {
    if (existingAgent) {
      this.editingAgent = existingAgent;
      this.overlay.setLabel(' Edit Agent ');
      this.fields = {
        name: existingAgent.name,
        role: existingAgent.role,
        provider: existingAgent.provider,
        model: existingAgent.model,
        systemPrompt: existingAgent.systemPrompt
      };
    } else {
      this.editingAgent = null;
      this.overlay.setLabel(' Add Agent ');
      this.fields = { name: '', role: '', provider: 'grok', model: '', systemPrompt: '' };
    }

    this.step = 0;
    this.discoverOllamaModels();
    this.overlay.show();
    this.renderStep();
  }

  async discoverOllamaModels() {
    try {
      const models = await this.ollamaProvider.getModelNames();
      if (models.length > 0) PROVIDER_MODELS.ollama = models;
    } catch (e) { /* ollama may not be running */ }
  }

  hide() {
    this._inputActive = false;
    this.textInput.hide();
    this.selectList.hide();
    this.overlay.hide();
    this.emit('closed');
    this.screen.render();
  }

  save() {
    if (!this.fields.name) return;

    if (!this.fields.model || this.fields.model.startsWith('(')) {
      const defaults = PROVIDER_MODELS[this.fields.provider];
      this.fields.model = defaults?.[0] || 'grok-4-1-fast-reasoning';
    }

    const agentConfig = {
      name: this.fields.name,
      role: this.fields.role,
      provider: this.fields.provider,
      model: this.fields.model,
      systemPrompt: this.fields.systemPrompt,
      ollamaBaseUrl: this.fields.provider === 'ollama' ? config.getOllamaBaseUrl() : undefined
    };

    if (this.editingAgent) {
      agentConfig.id = this.editingAgent.id;
      this.emit('edit-agent', agentConfig);
    } else {
      this.emit('add-agent', agentConfig);
    }

    this.hide();
  }

  isVisible() {
    return this.overlay.visible;
  }
}

export { AgentConfigDialog };
