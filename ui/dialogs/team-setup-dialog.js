import blessed from 'blessed';
import { EventEmitter } from 'events';

class TeamSetupDialog extends EventEmitter {
  constructor(screen, teamManager) {
    super();
    this.screen = screen;
    this.teamManager = teamManager;
    this.mode = 'menu'; // 'menu' | 'input' | 'load' | 'delete'
    this._inputActive = false;

    this.overlay = blessed.box({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: 16,
      border: { type: 'line', fg: 'cyan' },
      style: { bg: 'black', fg: 'white', border: { fg: 'cyan' } },
      label: ' Team Management ',
      hidden: true,
      tags: true
    });

    // Header text
    this.header = blessed.box({
      parent: this.overlay,
      top: 0,
      left: 1,
      width: '100%-4',
      height: 2,
      style: { bg: 'black', fg: 'white' },
      tags: true,
      content: '{bold}{cyan-fg}Choose an option:{/}'
    });

    // Shared list for menus
    this.menuList = blessed.list({
      parent: this.overlay,
      top: 2,
      left: 1,
      width: '100%-4',
      height: 9,
      style: {
        bg: 'black',
        fg: 'white',
        selected: { bg: 'cyan', fg: 'black', bold: true }
      },
      mouse: true,
      keys: true,
      vi: true,
      tags: true
    });

    // Shared textbox for name input — NO inputOnFocus
    this.textInput = blessed.textbox({
      parent: this.overlay,
      top: 2,
      left: 1,
      width: '100%-4',
      height: 3,
      border: { type: 'line', fg: 'cyan' },
      style: { bg: '#1a1a1a', fg: 'white', border: { fg: 'cyan' } },
      hidden: true
      // NOT inputOnFocus — we call readInput() explicitly
    });

    // Footer
    this.footer = blessed.box({
      parent: this.overlay,
      bottom: 0,
      left: 1,
      width: '100%-4',
      height: 1,
      style: { bg: 'black', fg: 'gray' },
      tags: true,
      content: '{gray-fg}Enter: select | Escape: back/close{/}'
    });

    this.setupHandlers();
  }

  // --- Called after textbox readInput completes ---
  _onTextDone(err, value) {
    this._inputActive = false;
    if (err) {
      // Escape pressed — go back to main menu
      this.textInput.clearValue();
      this.showMainMenu();
      return;
    }
    const name = value ? value.trim() : '';
    if (name) {
      this.textInput.clearValue();
      this.textInput.hide();
      this.emit('create-team', name);
      this.hide();
    } else {
      // Empty name — re-prompt
      this._startTextInput();
    }
  }

  // --- Start textbox input mode on next tick (avoids re-entrant issues) ---
  _startTextInput() {
    this.textInput.show();
    this.screen.render();
    process.nextTick(() => {
      if (!this.overlay.visible) return; // dialog was closed
      this._inputActive = true;
      this.textInput.readInput((err, value) => this._onTextDone(err, value));
    });
  }

  setupHandlers() {
    this.menuList.on('select', (item, index) => {
      this.handleMenuSelect(index);
    });

    this.menuList.key(['escape'], () => {
      if (this.mode === 'menu') {
        this.hide();
      } else {
        this.showMainMenu();
      }
    });
  }

  handleMenuSelect(index) {
    if (this.mode === 'menu') {
      switch (index) {
        case 0: this.handleQuickStart(); break;
        case 1: this.showCreateInput(); break;
        case 2: this.showLoadList(); break;
        case 3: this.handleSave(); break;
        case 4: this.showDeleteList(); break;
        case 5: this.hide(); break;
      }
    } else if (this.mode === 'load') {
      const teams = this.teamManager.listTeams();
      if (index < teams.length) {
        this.emit('load-team', teams[index].name);
        this.hide();
      } else {
        this.showMainMenu();
      }
    } else if (this.mode === 'delete') {
      const teams = this.teamManager.listTeams();
      if (index < teams.length) {
        this.emit('delete-team', teams[index].name);
        this.showMainMenu();
      } else {
        this.showMainMenu();
      }
    }
  }

  showMainMenu() {
    this.mode = 'menu';
    this.textInput.hide();
    this.menuList.show();
    this.header.setContent('{bold}{cyan-fg}Choose an option:{/}');
    this.menuList.setItems([
      '{cyan-fg}Quick start (default team){/}',
      'Create new team',
      'Load existing team',
      'Save current team',
      '{red-fg}Delete team{/}',
      '{gray-fg}Cancel{/}'
    ]);
    this.menuList.select(0);
    this.menuList.focus();
    this.screen.render();
  }

  showCreateInput() {
    this.mode = 'input';
    this.menuList.hide();
    this.header.setContent('{bold}{cyan-fg}Enter team name:{/}');
    this.textInput.clearValue();
    this._startTextInput();
  }

  showLoadList() {
    const teams = this.teamManager.listTeams();
    if (teams.length === 0) {
      this.header.setContent('{yellow-fg}No saved teams found. Press Escape to go back.{/}');
      this.screen.render();
      return;
    }

    this.mode = 'load';
    this.header.setContent('{bold}{cyan-fg}Select a team to load:{/}');
    const items = teams.map(t => `${t.name} (${t.agentCount} agents)`);
    items.push('{gray-fg}Back{/}');
    this.menuList.setItems(items);
    this.menuList.select(0);
    this.menuList.focus();
    this.screen.render();
  }

  showDeleteList() {
    const teams = this.teamManager.listTeams();
    if (teams.length === 0) {
      this.header.setContent('{yellow-fg}No saved teams to delete. Press Escape to go back.{/}');
      this.screen.render();
      return;
    }

    this.mode = 'delete';
    this.header.setContent('{bold}{red-fg}Select a team to DELETE:{/}');
    const items = teams.map(t => `{red-fg}${t.name}{/} (${t.agentCount} agents)`);
    items.push('{gray-fg}Back{/}');
    this.menuList.setItems(items);
    this.menuList.select(0);
    this.menuList.focus();
    this.screen.render();
  }

  handleQuickStart() {
    this.emit('quick-start');
    this.hide();
  }

  handleSave() {
    if (!this.teamManager.hasTeam()) {
      this.header.setContent('{yellow-fg}No team to save. Create one first.{/}');
      this.screen.render();
      return;
    }
    this.emit('save-team');
    this.hide();
  }

  show() {
    this.overlay.show();
    this.showMainMenu();
  }

  hide() {
    this._inputActive = false;
    this.textInput.hide();
    this.overlay.hide();
    this.emit('closed');
    this.screen.render();
  }

  isVisible() {
    return this.overlay.visible;
  }
}

export { TeamSetupDialog };
