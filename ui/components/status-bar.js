import blessed from 'blessed';
import { EventEmitter } from 'events';
import { Theme } from '../styles/theme.js';

export class StatusBar extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      mode: 'Plan',
      model: 'grok-4-1-fast-reasoning',
      directory: process.cwd(),
      ...options
    };

    this.createElement();
    this.updateDisplay();
  }

  createElement() {
    this.element = blessed.box({
      ...Theme.statusBar,
      content: this.formatStatusText(),
      border: {
        type: 'line',
        fg: '#00CED1'
      },
      padding: {
        left: 1,
        right: 1
      }
    });
  }

  formatStatusText() {
    const mode = `{bold}{#00CED1-fg}${this.options.mode}{/}`;
    const model = `{bold}${this.options.model}{/}`;
    const dir = this.options.directory.split('/').pop() || '/';

    return ` 🔄 Mode: ${mode} | 🤖 Model: ${model} | 📁 Dir: ${dir} | 🎨 OpenGrok TUI `;
  }

  updateDisplay() {
    if (this.element) {
      this.element.setContent(this.formatStatusText());
      if (this.element.screen) {
        this.element.screen.render();
      }
    }
  }

  updateMode(mode) {
    this.options.mode = mode;
    this.updateDisplay();
    this.emit('mode-changed', mode);
  }

  updateModel(model) {
    this.options.model = model;
    this.updateDisplay();
    this.emit('model-changed', model);
  }

  updateDirectory(directory) {
    this.options.directory = directory;
    this.updateDisplay();
    this.emit('directory-changed', directory);
  }

  // Get current values
  getMode() {
    return this.options.mode;
  }

  getModel() {
    return this.options.model;
  }

  getDirectory() {
    return this.options.directory;
  }
}