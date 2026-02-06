import blessed from 'blessed';
import { EventEmitter } from 'events';
import { ChatPanel } from './components/chat-panel.js';
import { StatusBar } from './components/status-bar.js';
import { FileBrowser } from './components/file-browser.js';
import { ModelSelector } from './components/model-selector.js';
import { Theme } from './styles/theme.js';
import { KeyBindings } from './utils/key-bindings.js';

export class OpenGrokTUI extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      title: 'OpenGrok',
      ...options
    };

    this.mode = 'Plan'; // Plan or Build
    this.currentModel = 'grok-4-1-fast-reasoning';
    this.workingDirectory = process.cwd();

    this.initializeUI();
    this.setupKeyBindings();
    this.setupEventHandlers();
  }

  initializeUI() {
    // Create main screen FIRST before creating any child elements
    this.screen = blessed.screen({
      smartCSR: true,
      tags: true,
      title: this.options.title,
      ...Theme.screen,
      // Essential for proper terminal control
      input: process.stdin,
      output: process.stdout,
      terminal: process.env.TERM || 'xterm-256color',
      fullUnicode: true,
      // Mouse support
      mouse: true,
      // Input handling - CRITICAL: grab input BEFORE creating elements
      grabKeys: true,
      grabInput: true,
      ignoreLocked: ['C-c'],
      // Rendering
      forceUnicode: true,
      sendFocus: true
    });

    // Initialize screen control immediately
    this.screen.program.setMouse({ allMotion: true, utfMouse: true });
    this.screen.program.alternateBuffer();
    this.screen.program.hideCursor();

    // Create main layout container
    this.mainContainer = blessed.box({
      ...Theme.mainContainer
    });

    // Create status bar
    this.statusBar = new StatusBar({
      parent: this.mainContainer,
      mode: this.mode,
      model: this.currentModel,
      directory: this.workingDirectory
    });

    // Create main content area (split between chat and file browser)
    this.contentBox = blessed.box({
      ...Theme.contentBox
    });

    // Create chat panel
    this.chatPanel = new ChatPanel({
      parent: this.contentBox,
      width: '70%'
    });

    // Create file browser
    this.fileBrowser = new FileBrowser({
      parent: this.contentBox,
      left: '70%',
      width: '30%'
    });

    // Create model selector (hidden by default)
    this.modelSelector = new ModelSelector({
      parent: this.mainContainer,
      hidden: true
    });

    // Append elements to screen
    this.screen.append(this.mainContainer);
    this.mainContainer.append(this.statusBar.element);
    this.mainContainer.append(this.contentBox);
    this.contentBox.append(this.chatPanel.element);
    this.contentBox.append(this.fileBrowser.element);
    this.mainContainer.append(this.modelSelector.element);

    // Set focus to chat panel initially
    this.chatPanel.focus();

    // Debug: Test if screen is receiving input
    this.screen.on('keypress', (ch, key) => {
      if (key && key.name === 'q') {
        this.exit();
      }
    });
  }

  setupKeyBindings() {
    this.keyBindings = new KeyBindings(this.screen);

    // Tab: Toggle mode
    this.keyBindings.add('tab', () => {
      this.toggleMode();
    });

    // Ctrl+P: Open model selector
    this.keyBindings.add('C-p', () => {
      this.showModelSelector();
    });

    // Ctrl+C: Exit
    this.keyBindings.add('C-c', () => {
      this.exit();
    });

    // Ctrl+L: Clear chat
    this.keyBindings.add('C-l', () => {
      this.chatPanel.clear();
    });

    // Ctrl+F: Focus file browser
    this.keyBindings.add('C-f', () => {
      this.fileBrowser.focus();
    });

    // Escape: Close model selector or refocus chat
    this.keyBindings.add('escape', () => {
      if (!this.modelSelector.hidden) {
        this.modelSelector.hide();
        this.chatPanel.focus();
      }
    });
  }

  setupEventHandlers() {
    // Handle model selection
    this.modelSelector.on('model-selected', (model) => {
      this.setModel(model);
      this.modelSelector.hide();
      this.chatPanel.focus();
    });

    // Handle file browser events
    this.fileBrowser.on('directory-changed', (directory) => {
      this.workingDirectory = directory;
      this.statusBar.updateDirectory(directory);
      // Update chat panel directory
      this.chatPanel.options.directory = directory;
      this.emit('directory-changed', directory);
    });

    this.fileBrowser.on('file-selected', (file) => {
      this.emit('file-selected', file);
    });

    // Handle chat panel events
    this.chatPanel.on('directory-changed', (directory) => {
      this.workingDirectory = directory;
      this.statusBar.updateDirectory(directory);
      this.fileBrowser.navigateTo(directory);
      this.emit('directory-changed', directory);
    });

    // Handle screen resize
    this.screen.on('resize', () => {
      this.render();
    });
  }

  toggleMode() {
    this.mode = this.mode === 'Plan' ? 'Build' : 'Plan';
    this.statusBar.updateMode(this.mode);
    this.emit('mode-changed', this.mode);
  }

  setModel(model) {
    this.currentModel = model;
    this.statusBar.updateModel(model);
    this.emit('model-changed', model);
  }

  showModelSelector() {
    this.modelSelector.show();
    this.modelSelector.focus();
  }

  render() {
    this.screen.render();
  }

  focus() {
    this.chatPanel.focus();
  }

  exit() {
    // Properly restore terminal state
    if (this.screen && this.screen.program) {
      this.screen.program.showCursor();
      this.screen.program.normalBuffer();
    }
    this.screen.destroy();
    process.exit(0);
  }

  // Public API for external interaction
  async sendMessage(message) {
    return this.chatPanel.sendMessage(message, {
      model: this.currentModel,
      mode: this.mode,
      directory: this.workingDirectory
    });
  }

  getCurrentMode() {
    return this.mode;
  }

  getCurrentModel() {
    return this.currentModel;
  }
}