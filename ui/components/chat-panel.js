import blessed from 'blessed';
import { EventEmitter } from 'events';
import path from 'path';
import { Theme } from '../styles/theme.js';
import { grokAPI } from '../../lib/grok-api.js';

export class ChatPanel extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      width: '100%',
      height: '100%',
      ...options
    };

    this.messages = [];
    this.createElements();
    this.setupEventHandlers();
  }

  createElements() {
    // Main container
    this.element = blessed.box({
      ...Theme.chatPanel,
      width: this.options.width,
      height: this.options.height
    });

    // Messages display area
    this.messagesBox = blessed.box({
      parent: this.element,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%-3', // Leave space for input
      scrollable: true,
      alwaysScroll: true,
      scrollbar: Theme.chatPanel.scrollbar,
      mouse: true,
      // Enable text selection and copy
      interactive: true,
      keys: true,
      vi: true,
      tags: true // Ensure text formatting works
    });

    // Input area
    this.inputBox = blessed.textbox({
      parent: this.element,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      ...Theme.chatInput,
      inputOnFocus: true,
      secret: false,
      censor: false
    });

    // Set initial content
    this.updateMessagesDisplay();
  }

  setupEventHandlers() {
    // Handle input submission
    this.inputBox.on('submit', (text) => {
      if (text && text.trim()) {
        this.handleUserInput(text.trim());
      }
      this.inputBox.clearValue();
      this.inputBox.focus();
    });

    // Handle focus/blur
    this.inputBox.on('focus', () => {
      this.inputBox.style.border.fg = Theme.focus.border.fg;
      this.element.screen.render();
    });

    this.inputBox.on('blur', () => {
      this.inputBox.style.border.fg = Theme.chatInput.border.fg;
      this.element.screen.render();
    });

    // Enable mouse selection and copy functionality
    this.element.on('mouse', (mouse) => {
      if (mouse.action === 'mousedown') {
        this.selectionStart = { x: mouse.x, y: mouse.y };
      } else if (mouse.action === 'mouseup' && this.selectionStart) {
        const selectionEnd = { x: mouse.x, y: mouse.y };
        this.handleTextSelection(this.selectionStart, selectionEnd);
        this.selectionStart = null;
      }
    });

    // Handle keyboard copy (Ctrl+C when text is selected)
    this.element.key('C-c', () => {
      if (this.selectedText) {
        // Copy to clipboard (terminal clipboard)
        process.stdout.write(`\x1b]52;c;${Buffer.from(this.selectedText).toString('base64')}\x07`);
        this.addMessage('system', `📋 Copied to clipboard: "${this.selectedText}"`);
        this.selectedText = null;
        this.element.screen.render();
      }
    });
  }

  async handleUserInput(text) {
    // Add user message
    this.addMessage('user', text);

    // Special commands
    if (text.toLowerCase() === 'exit') {
      this.emit('exit');
      return;
    }

    if (text.toLowerCase() === 'help') {
      this.showHelp();
      return;
    }

    if (text.toLowerCase() === 'clear') {
      this.clear();
      return;
    }

    // Handle tool commands
    const toolResult = await this.handleToolCommand(text);
    if (toolResult) {
      this.addMessage('system', toolResult);
      return;
    }

    // Send to Grok API
    try {
      this.emit('message-sent', text);
      const response = await this.sendMessage(text, this.options);
      this.addMessage('assistant', response);
      this.emit('message-received', response);
    } catch (error) {
      this.addMessage('system', `Error: ${error.message}`, 'error');
      this.emit('error', error);
    }
  }

  async sendMessage(message, options = {}) {
    const { model = 'grok-4-1-fast-reasoning', mode = 'Plan', directory = process.cwd() } = options;

    const response = await grokAPI.chat(message, {
      model,
      directory,
      mode
    });

    return response;
  }

  addMessage(type, content, style = 'normal') {
    this.messages.push({
      type,
      content,
      style,
      timestamp: new Date()
    });

    this.updateMessagesDisplay();

    // Auto-scroll to bottom
    this.messagesBox.setScrollPerc(100);
  }

  updateMessagesDisplay() {
    let displayText = '';

    for (const message of this.messages) {
      const prefix = this.getMessagePrefix(message.type);
      const styledContent = this.applyMessageStyling(message);
      displayText += `${prefix}${styledContent}\n\n`;
    }

    this.messagesBox.setContent(displayText);
    if (this.element.screen) {
      this.element.screen.render();
    }
  }

  getMessagePrefix(type) {
    switch (type) {
      case 'user':
        return '{bold}{white-fg}You:{/} ';
      case 'assistant':
        return '{bold}{#00CED1-fg}Grok:{/} ';
      case 'system':
        return '{bold}{yellow-fg}System:{/} ';
      default:
        return '';
    }
  }

  applyMessageStyling(message) {
    let content = message.content;

    // Apply syntax highlighting for code blocks
    content = this.applySyntaxHighlighting(content);

    // Apply error styling
    if (message.style === 'error') {
      content = `{red-fg}${content}{/}`;
    }

    return content;
  }

  applySyntaxHighlighting(text) {
    // Basic syntax highlighting for code blocks
    // This is a simple implementation - could be enhanced with prismjs
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

    return text.replace(codeBlockRegex, (match, lang, code) => {
      // For now, just wrap in cyan for code
      return `{cyan-fg}${code}{/}`;
    });
  }

  async handleToolCommand(text) {
    const parts = text.trim().split(/\s+/);
    const command = parts[0].toLowerCase();

    try {
      switch (command) {
        case 'ls':
        case 'list':
          return await this.listDirectory(parts[1]);

        case 'cd':
          return this.changeDirectory(parts[1]);

        case 'read':
        case 'cat':
          return await this.readFile(parts[1]);

        case 'pwd':
          return `Current directory: ${this.options.directory || process.cwd()}`;

        default:
          return null; // Not a tool command
      }
    } catch (error) {
      return `Error executing ${command}: ${error.message}`;
    }
  }

  async listDirectory(path = '.') {
    const { fileTools } = await import('../../tools/file-tools.js');
    const fullPath = this.resolvePath(path);
    const items = await fileTools.listDirectory(fullPath);
    return `Contents of ${fullPath}:\n${items.join('\n')}`;
  }

  changeDirectory(path) {
    if (!path) return 'Usage: cd <directory>';

    const fullPath = this.resolvePath(path);
    // Update the working directory in options
    this.options.directory = fullPath;
    this.emit('directory-changed', fullPath);
    return `Changed directory to: ${fullPath}`;
  }

  async readFile(path) {
    if (!path) return 'Usage: read <file>';

    const { fileTools } = await import('../../tools/file-tools.js');
    const fullPath = this.resolvePath(path);
    const content = await fileTools.readFile(fullPath);
    return `Contents of ${fullPath}:\n${content}`;
  }

  resolvePath(inputPath) {
    const baseDir = this.options.directory || process.cwd();
    return path.resolve(baseDir, inputPath);
  }

  handleTextSelection(start, end) {
    // Simple text selection - get text at cursor position
    // This is a basic implementation - could be enhanced
    try {
      const lines = this.messagesBox.getContent().split('\n');
      const startLine = Math.max(0, start.y - this.messagesBox.top);
      const endLine = Math.max(0, end.y - this.messagesBox.top);

      if (startLine < lines.length && endLine < lines.length) {
        const selectedLines = lines.slice(startLine, endLine + 1);
        this.selectedText = selectedLines.join('\n').trim();

        if (this.selectedText) {
          // Auto-copy on selection (like OpenCode)
          process.stdout.write(`\x1b]52;c;${Buffer.from(this.selectedText).toString('base64')}\x07`);
          this.addMessage('system', `📋 Auto-copied to clipboard: "${this.selectedText.substring(0, 50)}${this.selectedText.length > 50 ? '...' : ''}"`);
        }
      }
    } catch (error) {
      // Ignore selection errors
    }
  }

  showHelp() {
    const helpText = `
Available commands:
• exit - Quit the application
• help - Show this help
• clear - Clear chat history

File operations:
• ls [path] - List directory contents
• cd <directory> - Change directory
• read <file> - Read file contents
• pwd - Show current directory

TUI shortcuts:
• Tab - Toggle Plan/Build mode
• Ctrl+P - Change model
• Ctrl+F - Focus file browser
• Ctrl+L - Clear chat
• Ctrl+C - Exit

Type any message to chat with Grok AI.
    `.trim();

    this.addMessage('system', helpText);
  }

  clear() {
    this.messages = [];
    this.updateMessagesDisplay();
  }

  focus() {
    this.inputBox.focus();
  }

  getMessages() {
    return [...this.messages];
  }

  getLastMessage() {
    return this.messages[this.messages.length - 1];
  }
}