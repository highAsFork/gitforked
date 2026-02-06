import blessed from 'blessed';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { Theme } from '../styles/theme.js';

export class FileBrowser extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      directory: process.cwd(),
      ...options
    };

    this.currentDirectory = this.options.directory;
    this.selectedIndex = 0;
    this.files = [];

    this.createElement();
    this.loadDirectory();
    this.setupEventHandlers();
  }

  createElement() {
    this.element = blessed.list({
      ...Theme.fileBrowser,
      width: this.options.width,
      height: this.options.height,
      left: this.options.left || 0,
      top: this.options.top || 0,
      interactive: true,
      invertSelected: false,
      mouse: true,
      keys: true,
      vi: true,
      label: ' Files ',
      border: Theme.border
    });
  }

  setupEventHandlers() {
    // Handle selection
    this.element.on('select', (item, index) => {
      const file = this.files[index];
      if (file) {
        this.emit('file-selected', file);
        if (file.isDirectory) {
          this.navigateTo(file.path);
        } else {
          this.emit('file-opened', file);
        }
      }
    });

    // Handle enter key
    this.element.key('enter', () => {
      const file = this.files[this.selectedIndex];
      if (file && file.isDirectory) {
        this.navigateTo(file.path);
      }
    });

    // Handle backspace for parent directory
    this.element.key('backspace', () => {
      this.navigateUp();
    });
  }

  async loadDirectory(directory = this.currentDirectory) {
    try {
      const items = await fs.promises.readdir(directory, { withFileTypes: true });

      this.files = [
        // Add parent directory option
        {
          name: '..',
          path: path.dirname(directory),
          isDirectory: true,
          isParent: true
        },
        // Add current directory contents
        ...items.map(item => ({
          name: item.name,
          path: path.join(directory, item.name),
          isDirectory: item.isDirectory(),
          stats: null // Could load stats for size/modification time
        }))
      ];

      this.updateDisplay();
    } catch (error) {
      this.emit('error', error);
    }
  }

  updateDisplay() {
    const items = this.files.map((file, index) => {
      let style = '';

      if (file.isDirectory) {
        style = `{${Theme.fileBrowser.directory.fg}-fg}`;
        if (file.isParent) {
          style += '{bold}';
        }
      } else {
        style = `{${Theme.fileBrowser.file.fg}-fg}`;
      }

      return `${style}${file.name}${file.isDirectory ? '/' : ''}{/}`;
    });

    this.element.setItems(items);

    // Update label with current directory
    const dirName = path.basename(this.currentDirectory) || '/';
    this.element.setLabel(` Files: ${dirName} `);

    if (this.element.screen) {
      this.element.screen.render();
    }
  }

  navigateTo(directory) {
    if (fs.existsSync(directory) && fs.statSync(directory).isDirectory()) {
      this.currentDirectory = directory;
      this.selectedIndex = 0;
      this.loadDirectory(directory);
      this.emit('directory-changed', directory);
    }
  }

  navigateUp() {
    const parentDir = path.dirname(this.currentDirectory);
    if (parentDir !== this.currentDirectory) {
      this.navigateTo(parentDir);
    }
  }

  refresh() {
    this.loadDirectory(this.currentDirectory);
  }

  focus() {
    this.element.focus();
  }

  getCurrentDirectory() {
    return this.currentDirectory;
  }

  getSelectedFile() {
    return this.files[this.selectedIndex];
  }

  // File operations
  async createFile(name) {
    const filePath = path.join(this.currentDirectory, name);
    try {
      await fs.promises.writeFile(filePath, '');
      this.refresh();
      this.emit('file-created', filePath);
    } catch (error) {
      this.emit('error', error);
    }
  }

  async createDirectory(name) {
    const dirPath = path.join(this.currentDirectory, name);
    try {
      await fs.promises.mkdir(dirPath);
      this.refresh();
      this.emit('directory-created', dirPath);
    } catch (error) {
      this.emit('error', error);
    }
  }

  async deleteFile(filePath) {
    try {
      const stats = await fs.promises.stat(filePath);
      if (stats.isDirectory()) {
        await fs.promises.rmdir(filePath);
      } else {
        await fs.promises.unlink(filePath);
      }
      this.refresh();
      this.emit('file-deleted', filePath);
    } catch (error) {
      this.emit('error', error);
    }
  }
}