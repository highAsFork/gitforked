import blessed from 'blessed';
import { EventEmitter } from 'events';
import { Theme } from '../styles/theme.js';

export class ModelSelector extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      width: '50%',
      height: '50%',
      left: 'center',
      top: 'center',
      ...options
    };

    this.models = [
      'grok-4-latest',
      'grok-4-1-fast-reasoning',
      'grok-4-1-fast-non-reasoning',
      'grok-4-1-fast',
      'grok-4',
      'grok-beta'
    ];

    this.selectedIndex = 0;
    this.createElement();
    this.setupEventHandlers();
    this.updateDisplay();
  }

  createElement() {
    this.element = blessed.list({
      ...Theme.modelSelector,
      width: this.options.width,
      height: this.options.height,
      left: this.options.left,
      top: this.options.top,
      interactive: true,
      invertSelected: false,
      mouse: true,
      keys: true,
      vi: true,
      label: ' Select Model ',
      border: Theme.border,
      hidden: this.options.hidden
    });
  }

  setupEventHandlers() {
    // Handle selection
    this.element.on('select', (item, index) => {
      const model = this.models[index];
      if (model) {
        this.emit('model-selected', model);
      }
    });

    // Handle enter key
    this.element.key('enter', () => {
      const model = this.models[this.selectedIndex];
      if (model) {
        this.emit('model-selected', model);
      }
    });

    // Handle escape to close
    this.element.key('escape', () => {
      this.hide();
      this.emit('cancelled');
    });
  }

  updateDisplay() {
    const items = this.models.map(model => {
      // Add descriptions for models
      const descriptions = {
        'grok-4-latest': 'Latest Grok 4 model',
        'grok-4-1-fast-reasoning': 'Fast reasoning with 2M context',
        'grok-4-1-fast-non-reasoning': 'Fast responses, no reasoning',
        'grok-4-1-fast': 'General fast model',
        'grok-4': 'Full Grok 4 capabilities',
        'grok-beta': 'Beta features and improvements'
      };

      const desc = descriptions[model] || '';
      return `${model} - ${desc}`;
    });

    this.element.setItems(items);

    if (this.element.screen) {
      this.element.screen.render();
    }
  }

  show() {
    this.element.show();
    this.element.focus();
    if (this.element.screen) {
      this.element.screen.render();
    }
  }

  hide() {
    this.element.hide();
    if (this.element.screen) {
      this.element.screen.render();
    }
  }

  get hidden() {
    return this.element.hidden;
  }

  set hidden(value) {
    if (value) {
      this.hide();
    } else {
      this.show();
    }
  }

  focus() {
    this.element.focus();
  }

  // Get available models
  getModels() {
    return [...this.models];
  }

  // Add a custom model
  addModel(model) {
    if (!this.models.includes(model)) {
      this.models.push(model);
      this.updateDisplay();
    }
  }

  // Remove a model
  removeModel(model) {
    const index = this.models.indexOf(model);
    if (index > -1) {
      this.models.splice(index, 1);
      this.updateDisplay();
    }
  }

  // Set selected model
  setSelectedModel(model) {
    const index = this.models.indexOf(model);
    if (index > -1) {
      this.selectedIndex = index;
      this.element.select(index);
    }
  }
}