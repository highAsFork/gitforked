import blessed from 'blessed';
import path from 'path';
import { config } from '../config/config.js';
import { TeamManager } from '../lib/team-manager.js';
import { TeamChannel } from '../lib/team-channel.js';
import { OllamaProvider } from '../lib/ollama-provider.js';
import { AgentSidebar } from './components/agent-sidebar.js';
import { TeamSetupDialog } from './dialogs/team-setup-dialog.js';
import { AgentConfigDialog } from './dialogs/agent-config-dialog.js';
import { Theme } from './styles/theme.js';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const SPINNER_MESSAGES = [
  "Agents are conspiring...",
  "Team huddle in progress...",
  "Passing the mic...",
  "Syncing brain waves...",
  "Roundtable discussion...",
  "Agents are debating...",
  "Collaborative thinking...",
  "Multi-agent fusion...",
  "Hive mind activated...",
  "Team brainstorm...",
  "Agents assemble!",
  "Council of AIs convened...",
  "Power Rangers, unite!",
  "Forming Voltron...",
  "Avengers, assemble!",
];

const AGENT_COLORS = [
  'cyan', 'green', 'yellow', 'red', 'magenta', 'blue', 'white'
];

class AgentTeamsTUI {
  constructor() {
    try {
      this.screen = blessed.screen({
        smartCSR: true,
        title: 'gitforked Agent Teams',
        autoPadding: true,
        fullUnicode: true,
        mouse: true,
        sendFocus: true,
        forceUnicode: true
      });
    } catch (error) {
      throw new Error(`Terminal UI not supported: ${error.message}`);
    }

    this.teamManager = new TeamManager();
    this.teamChannel = new TeamChannel(this.teamManager);
    this.ollamaProvider = new OllamaProvider(config.getOllamaBaseUrl());

    this.currentDir = process.cwd();
    this.activeView = 'team-channel'; // 'team-channel' or agent ID
    this.totalCost = 0;
    this.commandHistory = [];
    this.historyIndex = -1;
    this.spinnerInterval = null;
    this.spinnerFrame = 0;
    this.spinnerStartTime = null;
    this.currentSpinnerMessage = '';

    this.initComponents();
    this.setupEventHandlers();
    this.setupTeamChannelEvents();
    this.render();
  }

  initComponents() {
    // Header bar
    this.headerBar = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      style: { bg: 'black', fg: 'white' },
      border: { type: 'line', fg: 'cyan' },
      tags: true
    });
    this.updateHeader();

    // Agent sidebar (left 20%)
    this.sidebar = new AgentSidebar(this.screen, {
      top: 3,
      left: 0,
      width: '20%',
      height: '100%-7'
    });

    // Chat panel (right 80%)
    this.chatPanel = blessed.log({
      parent: this.screen,
      top: 3,
      left: '20%',
      width: '80%',
      height: '100%-7',
      label: ' Team Channel ',
      border: { type: 'line', fg: 'cyan' },
      style: {
        bg: 'black',
        fg: 'white',
        border: { fg: 'cyan' },
        label: { fg: 'cyan', bold: true }
      },
      scrollbar: {
        ch: '█',
        track: { bg: 'gray' },
        style: { bg: 'cyan', fg: 'cyan' }
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      vi: true,
      tags: true,
      focusable: true
    });

    // Chat panel scroll keys
    this.chatPanel.key(['j', 'down'], () => { this.chatPanel.scroll(1); this.render(); });
    this.chatPanel.key(['k', 'up'], () => { this.chatPanel.scroll(-1); this.render(); });
    this.chatPanel.key(['pagedown', 'C-d'], () => { this.chatPanel.scroll(this.chatPanel.height - 2); this.render(); });
    this.chatPanel.key(['pageup', 'C-u'], () => { this.chatPanel.scroll(-(this.chatPanel.height - 2)); this.render(); });
    this.chatPanel.key(['g'], () => { this.chatPanel.scrollTo(0); this.render(); });
    this.chatPanel.key(['S-g'], () => { this.chatPanel.scrollTo(this.chatPanel.getScrollHeight()); this.render(); });
    this.chatPanel.on('wheeldown', () => { this.chatPanel.scroll(3); this.render(); });
    this.chatPanel.on('wheelup', () => { this.chatPanel.scroll(-3); this.render(); });

    // Input box — NO inputOnFocus, we control readInput explicitly
    this.inputBox = blessed.textbox({
      parent: this.screen,
      bottom: 1,
      left: 0,
      width: '100%',
      height: 3,
      label: ' Team Channel ',
      border: { type: 'line', fg: 'cyan' },
      style: {
        bg: '#1a1a1a',
        fg: 'white',
        border: { fg: 'cyan' },
        label: { fg: 'cyan', bold: true }
      },
      mouse: true
    });
    this._inputActive = false;

    // Keys bar
    this.keysBar = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      style: { bg: '#1a1a1a', fg: 'white' },
      tags: true,
      content: '{cyan-fg}^T{/} Team  {cyan-fg}^A{/} Add  {cyan-fg}^E{/} Edit  {cyan-fg}Tab{/} Focus  {cyan-fg}^C{/} Exit  {cyan-fg}0-9{/} Switch'
    });

    // Create dialogs
    this.teamSetupDialog = new TeamSetupDialog(this.screen, this.teamManager);
    this.agentConfigDialog = new AgentConfigDialog(this.screen);

    this._focusInput();
  }

  isDialogOpen() {
    return this.teamSetupDialog.isVisible() || this.agentConfigDialog.isVisible();
  }

  // Start explicit readInput on the main input box
  _focusInput() {
    this.inputBox.focus();
    this.screen.render();
    process.nextTick(() => {
      if (this.isDialogOpen()) return;
      this._inputActive = true;
      this.inputBox.readInput((err, value) => this._onInputDone(err, value));
    });
  }

  // Called when readInput completes (Enter or Escape)
  _onInputDone(err, value) {
    this._inputActive = false;
    if (err) {
      // Escape pressed — clear input, re-enter input mode
      this.inputBox.clearValue();
      this.render();
      this._focusInput();
      return;
    }
    const input = value ? value.trim() : '';
    if (input) {
      this.commandHistory.push(input);
      this.historyIndex = this.commandHistory.length;
      this.inputBox.clearValue();
      this.render();
      // Process the message then re-enter input mode
      this.handleInput(input).then(() => {
        this._focusInput();
      });
    } else {
      // Empty input — just re-enter input mode
      this._focusInput();
    }
  }

  setupEventHandlers() {
    // Exit
    this.screen.key(['C-c'], () => {
      this.destroy();
      process.exit(0);
    });

    // Team management dialog
    this.screen.key(['C-t'], () => {
      if (this.isDialogOpen() || this._inputActive) return;
      this.teamSetupDialog.show();
    });

    // Add agent dialog
    this.screen.key(['C-a'], () => {
      if (this.isDialogOpen() || this._inputActive) return;
      this.agentConfigDialog.show();
    });

    // Edit selected agent
    this.screen.key(['C-e'], () => {
      if (this.isDialogOpen() || this._inputActive) return;
      const agent = this.sidebar.getSelectedAgent();
      if (agent) {
        this.agentConfigDialog.show(agent);
      }
    });

    // Tab focus cycling: allowed even when inputActive (to leave input)
    this.screen.key(['tab'], () => {
      if (this.isDialogOpen()) return;

      if (this._inputActive) {
        // Cancel readInput, move focus to sidebar
        this._inputActive = false;
        this.sidebar.focus();
      } else if (this.screen.focused === this.sidebar.box) {
        this.chatPanel.focus();
      } else {
        // From chatPanel or anywhere else, go to inputBox
        this._focusInput();
      }
      this.render();
    });

    // Number keys for quick switching — only when not in input mode
    this.screen.key(['0'], () => {
      if (this.isDialogOpen() || this._inputActive) return;
      this.switchToTeamChannel();
    });
    for (let i = 1; i <= 9; i++) {
      this.screen.key([String(i)], () => {
        if (this.isDialogOpen() || this._inputActive) return;
        this.switchToAgentByIndex(i - 1);
      });
    }

    // Note: Enter/Escape are handled by readInput in _onInputDone.
    // History navigation is not available with explicit readInput
    // (blessed textbox readInput captures all keys).
    // TODO: implement history via screen-level up/down with inputActive guard

    // Sidebar events
    this.sidebar.on('select-team-channel', () => {
      this.switchToTeamChannel();
    });

    this.sidebar.on('select-agent', (agent) => {
      this.switchToAgentDM(agent);
    });

    this.sidebar.on('add-agent', () => {
      this.agentConfigDialog.show();
    });

    // Team setup dialog events
    this.teamSetupDialog.on('create-team', (name) => {
      this.teamManager.createTeam(name);
      this.teamChannel = new TeamChannel(this.teamManager);
      this.setupTeamChannelEvents();
      this.updateHeader();
      this.sidebar.updateAgentList([]);
      this.addSystemMessage(`Team "${name}" created.`);
      this._focusInput();
    });

    this.teamSetupDialog.on('load-team', (name) => {
      try {
        this.teamManager.loadTeam(name);
        this.teamChannel = new TeamChannel(this.teamManager);
        this.setupTeamChannelEvents();
        this.updateHeader();
        this.sidebar.updateAgentList(this.teamManager.getAgents());
        this.addSystemMessage(`Team "${name}" loaded with ${this.teamManager.getAgents().length} agents.`);
      } catch (err) {
        this.addSystemMessage(`Error loading team: ${err.message}`);
      }
      this._focusInput();
    });

    this.teamSetupDialog.on('save-team', () => {
      try {
        const filePath = this.teamManager.saveTeam();
        this.addSystemMessage(`Team saved to ${filePath}`);
      } catch (err) {
        this.addSystemMessage(`Error saving team: ${err.message}`);
      }
      this._focusInput();
    });

    this.teamSetupDialog.on('delete-team', (name) => {
      try {
        this.teamManager.deleteTeam(name);
        this.addSystemMessage(`Team "${name}" deleted.`);
      } catch (err) {
        this.addSystemMessage(`Error deleting team: ${err.message}`);
      }
    });

    this.teamSetupDialog.on('closed', () => {
      this._focusInput();
    });

    // Agent config dialog events
    this.agentConfigDialog.on('add-agent', (agentConfig) => {
      try {
        if (!this.teamManager.hasTeam()) {
          this.teamManager.createTeam('Untitled');
          this.teamChannel = new TeamChannel(this.teamManager);
          this.setupTeamChannelEvents();
        }
        const agent = this.teamManager.addAgent(agentConfig);
        this.sidebar.updateAgentList(this.teamManager.getAgents());
        this.updateHeader();
        this.addSystemMessage(`Agent "${agent.name}" added (${agent.provider}/${agent.model}).`);
      } catch (err) {
        this.addSystemMessage(`Error adding agent: ${err.message}`);
      }
      this._focusInput();
    });

    this.agentConfigDialog.on('edit-agent', (agentConfig) => {
      try {
        const existing = this.teamManager.getAgent(agentConfig.id);
        if (existing) {
          existing.name = agentConfig.name;
          existing.role = agentConfig.role;
          existing.provider = agentConfig.provider;
          existing.model = agentConfig.model;
          existing.systemPrompt = agentConfig.systemPrompt;
          existing.apiKey = agentConfig.apiKey;
          existing.ollamaBaseUrl = agentConfig.ollamaBaseUrl;
          existing.init();
          this.sidebar.updateAgentList(this.teamManager.getAgents());
          this.addSystemMessage(`Agent "${existing.name}" updated.`);
        }
      } catch (err) {
        this.addSystemMessage(`Error editing agent: ${err.message}`);
      }
      this._focusInput();
    });

    this.agentConfigDialog.on('closed', () => {
      this._focusInput();
    });
  }

  setupTeamChannelEvents() {
    this.teamChannel.removeAllListeners();

    this.teamChannel.on('agent-thinking', (agent) => {
      this.sidebar.updateAgentList(this.teamManager.getAgents());
      if (this.activeView === 'team-channel') {
        this.chatPanel.log(`{yellow-fg}*{/} {bold}${agent.name}{/} {gray-fg}is thinking...{/}`);
      }
      this.render();
    });

    this.teamChannel.on('agent-responded', (agent, response) => {
      this.sidebar.updateAgentList(this.teamManager.getAgents());
      if (this.activeView === 'team-channel') {
        const colorIndex = this.getAgentColorIndex(agent);
        const color = AGENT_COLORS[colorIndex];
        this.chatPanel.log(`{${color}-fg}{bold}${agent.name}{/} {gray-fg}(${agent.role || agent.provider}){/}`);
        const lines = response.split('\n');
        for (const line of lines) {
          this.chatPanel.log(`  ${this.escapeContent(line)}`);
        }
        this.chatPanel.log('');
      }
      this.render();
    });

    this.teamChannel.on('agent-error', (agent, error) => {
      this.sidebar.updateAgentList(this.teamManager.getAgents());
      if (this.activeView === 'team-channel') {
        this.chatPanel.log(`{red-fg}{bold}${agent.name}{/} {red-fg}Error: ${this.escapeContent(error.message)}{/}`);
        this.chatPanel.log('');
      }
      this.render();
    });
  }

  getAgentColorIndex(agent) {
    const agents = this.teamManager.getAgents();
    const idx = agents.findIndex(a => a.id === agent.id);
    return idx >= 0 ? idx % AGENT_COLORS.length : 0;
  }

  updateHeader() {
    const teamName = this.teamManager.getTeamName() || '(none)';
    const agentCount = this.teamManager.getAgents().length;

    this.headerBar.setContent(
      ` {bold}{cyan-fg}gitforked Agent Teams{/} | ` +
      `Team: {white-fg}${teamName}{/} | ` +
      `{white-fg}${agentCount}{/} agents | ` +
      `Cost: {green-fg}$${this.totalCost.toFixed(4)}{/}`
    );
  }

  updateInputLabel() {
    if (this.activeView === 'team-channel') {
      this.inputBox.setLabel(' Team Channel ');
      this.inputBox.style.border.fg = 'cyan';
      this.inputBox.style.label.fg = 'cyan';
    } else {
      const agent = this.teamManager.getAgent(this.activeView);
      const name = agent ? agent.name : 'Agent';
      this.inputBox.setLabel(` DM: ${name} `);
      this.inputBox.style.border.fg = 'green';
      this.inputBox.style.label.fg = 'green';
    }
  }

  switchToTeamChannel() {
    this.activeView = 'team-channel';
    this.chatPanel.setLabel(' Team Channel ');
    this.chatPanel.setContent('');
    this.updateInputLabel();

    // Redisplay shared messages
    const messages = this.teamChannel.getSharedMessages();
    for (const msg of messages) {
      if (msg.agentId === null) {
        this.chatPanel.log(`{bold}{cyan-fg}You:{/} ${this.escapeContent(msg.content)}`);
      } else {
        const agent = this.teamManager.getAgent(msg.agentId);
        const colorIndex = agent ? this.getAgentColorIndex(agent) : 0;
        const color = AGENT_COLORS[colorIndex];
        this.chatPanel.log(`{${color}-fg}{bold}${msg.agentName}{/} {gray-fg}(${msg.role || ''}){/}`);
        const lines = msg.content.split('\n');
        for (const line of lines) {
          this.chatPanel.log(`  ${this.escapeContent(line)}`);
        }
      }
      this.chatPanel.log('');
    }

    this.addSystemMessage('Viewing Team Channel');
    this.render();
  }

  switchToAgentDM(agent) {
    this.activeView = agent.id;
    this.chatPanel.setLabel(` DM: ${agent.name} (${agent.role || agent.provider}) `);
    this.chatPanel.setContent('');
    this.updateInputLabel();

    // Redisplay agent DM history
    for (const msg of agent.messages) {
      if (msg.role === 'user') {
        this.chatPanel.log(`{bold}{cyan-fg}You:{/} ${this.escapeContent(msg.content)}`);
      } else {
        this.chatPanel.log(`{bold}{green-fg}${agent.name}:{/}`);
        const lines = msg.content.split('\n');
        for (const line of lines) {
          this.chatPanel.log(`  ${this.escapeContent(line)}`);
        }
      }
      this.chatPanel.log('');
    }

    this.addSystemMessage(`DM with ${agent.name}`);
    this.render();
  }

  switchToAgentByIndex(index) {
    const agents = this.teamManager.getAgents();
    if (index < agents.length) {
      this.switchToAgentDM(agents[index]);
    }
  }

  async handleInput(input) {
    if (input.startsWith('/')) {
      await this.handleCommand(input);
    } else if (this.activeView === 'team-channel') {
      await this.handleTeamChannelMessage(input);
    } else {
      await this.handleAgentDM(input);
    }
  }

  async handleTeamChannelMessage(input) {
    if (this.teamManager.getAgents().length === 0) {
      this.addSystemMessage('No agents in team. Use Ctrl+A to add agents.');
      return;
    }

    this.chatPanel.log(`{bold}{cyan-fg}You:{/} ${this.escapeContent(input)}`);
    this.chatPanel.log('');
    this.startSpinner();

    try {
      const responses = await this.teamChannel.broadcastToAll(input, {
        directory: this.currentDir
      });

      this.stopSpinner(true);
      this.extractCosts(responses);
    } catch (error) {
      this.stopSpinner(false);
      this.addSystemMessage(`Error: ${error.message}`);
    }
    this.render();
  }

  async handleAgentDM(input) {
    const agent = this.teamManager.getAgent(this.activeView);
    if (!agent) {
      this.addSystemMessage('Agent not found.');
      return;
    }

    this.chatPanel.log(`{bold}{cyan-fg}You:{/} ${this.escapeContent(input)}`);
    this.chatPanel.log('');
    this.startSpinner();

    try {
      agent.status = 'thinking';
      this.sidebar.updateAgentList(this.teamManager.getAgents());
      this.render();

      const response = await agent.sendMessage(input, {
        directory: this.currentDir,
        includeHistory: true
      });

      agent.status = 'idle';
      this.sidebar.updateAgentList(this.teamManager.getAgents());
      this.stopSpinner(true);

      this.chatPanel.log(`{bold}{green-fg}${agent.name}:{/}`);
      const lines = response.split('\n');
      for (const line of lines) {
        this.chatPanel.log(`  ${this.escapeContent(line)}`);
      }
      this.chatPanel.log('');

      this.extractCostFromResponse(response);
    } catch (error) {
      agent.status = 'error';
      this.sidebar.updateAgentList(this.teamManager.getAgents());
      this.stopSpinner(false);
      this.addSystemMessage(`Error: ${error.message}`);
    }
    this.render();
  }

  async handleCommand(cmd) {
    const parts = cmd.slice(1).split(' ');
    const command = parts[0];
    const args = parts.slice(1);

    switch (command) {
      case 'help':
        this.showHelp();
        break;

      case 'clear':
        this.chatPanel.setContent('');
        break;

      case 'team':
        await this.handleTeamCommand(args);
        break;

      case 'agent':
        await this.handleAgentCommand(args);
        break;

      case 'ollama':
        await this.handleOllamaCommand(args);
        break;

      default:
        this.addSystemMessage(`Unknown command: ${command}. Type /help for commands.`);
    }
    this.render();
  }

  async handleTeamCommand(args) {
    const sub = args[0];
    switch (sub) {
      case 'create': {
        const name = args.slice(1).join(' ') || 'Untitled';
        this.teamManager.createTeam(name);
        this.teamChannel = new TeamChannel(this.teamManager);
        this.setupTeamChannelEvents();
        this.sidebar.updateAgentList([]);
        this.updateHeader();
        this.addSystemMessage(`Team "${name}" created.`);
        break;
      }
      case 'load': {
        const name = args.slice(1).join(' ');
        if (!name) { this.addSystemMessage('Usage: /team load <name>'); return; }
        try {
          this.teamManager.loadTeam(name);
          this.teamChannel = new TeamChannel(this.teamManager);
          this.setupTeamChannelEvents();
          this.sidebar.updateAgentList(this.teamManager.getAgents());
          this.updateHeader();
          this.addSystemMessage(`Team "${name}" loaded.`);
        } catch (err) {
          this.addSystemMessage(`Error: ${err.message}`);
        }
        break;
      }
      case 'save': {
        try {
          const filePath = this.teamManager.saveTeam(args.slice(1).join(' ') || undefined);
          this.addSystemMessage(`Team saved to ${filePath}`);
        } catch (err) {
          this.addSystemMessage(`Error: ${err.message}`);
        }
        break;
      }
      case 'list': {
        const teams = this.teamManager.listTeams();
        if (teams.length === 0) {
          this.addSystemMessage('No saved teams.');
        } else {
          this.chatPanel.log('{bold}{cyan-fg}=== Saved Teams ==={/}');
          for (const t of teams) {
            this.chatPanel.log(`  {cyan-fg}${t.name}{/} - ${t.agentCount} agents`);
          }
          this.chatPanel.log('');
        }
        break;
      }
      case 'delete': {
        const name = args.slice(1).join(' ');
        if (!name) { this.addSystemMessage('Usage: /team delete <name>'); return; }
        try {
          this.teamManager.deleteTeam(name);
          this.addSystemMessage(`Team "${name}" deleted.`);
        } catch (err) {
          this.addSystemMessage(`Error: ${err.message}`);
        }
        break;
      }
      default:
        this.addSystemMessage('Usage: /team create|load|save|list|delete <name>');
    }
  }

  async handleAgentCommand(args) {
    const sub = args[0];
    switch (sub) {
      case 'add':
        this.agentConfigDialog.show();
        break;
      case 'remove': {
        const id = args[1];
        if (!id) { this.addSystemMessage('Usage: /agent remove <id>'); return; }
        try {
          const removed = this.teamManager.removeAgent(id);
          this.sidebar.updateAgentList(this.teamManager.getAgents());
          this.updateHeader();
          this.addSystemMessage(`Agent "${removed.name}" removed.`);
        } catch (err) {
          this.addSystemMessage(`Error: ${err.message}`);
        }
        break;
      }
      case 'edit': {
        const id = args[1];
        const agent = id ? this.teamManager.getAgent(id) : this.sidebar.getSelectedAgent();
        if (agent) {
          this.agentConfigDialog.show(agent);
        } else {
          this.addSystemMessage('No agent selected. Use /agent edit <id>');
        }
        break;
      }
      case 'list': {
        const agents = this.teamManager.getAgents();
        if (agents.length === 0) {
          this.addSystemMessage('No agents in team.');
        } else {
          this.chatPanel.log('{bold}{cyan-fg}=== Team Agents ==={/}');
          agents.forEach((a, i) => {
            const status = a.status === 'idle' ? '{green-fg}idle{/}' :
                          a.status === 'thinking' ? '{yellow-fg}thinking{/}' : '{red-fg}error{/}';
            this.chatPanel.log(`  {cyan-fg}${i + 1}.{/} {white-fg}${a.name}{/} (${a.role || 'no role'}) - ${a.provider}/${a.model} [${status}]`);
            this.chatPanel.log(`     {gray-fg}ID: ${a.id}{/}`);
          });
          this.chatPanel.log('');
        }
        break;
      }
      default:
        this.addSystemMessage('Usage: /agent add|remove|edit|list');
    }
  }

  async handleOllamaCommand(args) {
    const sub = args[0];
    switch (sub) {
      case 'models': {
        this.addSystemMessage('Checking Ollama...');
        try {
          const models = await this.ollamaProvider.getModelInfo();
          if (models.length === 0) {
            this.addSystemMessage('No Ollama models found. Is Ollama running?');
          } else {
            this.chatPanel.log('{bold}{cyan-fg}=== Ollama Models ==={/}');
            for (const m of models) {
              this.chatPanel.log(`  {cyan-fg}${m.name}{/} - ${m.displaySize} (${m.family})`);
            }
            this.chatPanel.log('');
          }
        } catch (err) {
          this.addSystemMessage(`Ollama error: ${err.message}`);
        }
        break;
      }
      case 'status': {
        const available = await this.ollamaProvider.isAvailable();
        this.addSystemMessage(`Ollama: ${available ? '{green-fg}Available{/}' : '{red-fg}Not available{/}'}`);
        break;
      }
      default:
        this.addSystemMessage('Usage: /ollama models|status');
    }
  }

  showHelp() {
    this.chatPanel.log('{bold}{cyan-fg}=== Agent Teams Help ==={/}');
    this.chatPanel.log('');
    this.chatPanel.log('{bold}Keyboard Shortcuts:{/}');
    this.chatPanel.log('  {cyan-fg}Ctrl+T{/}     Open team management');
    this.chatPanel.log('  {cyan-fg}Ctrl+A{/}     Add new agent');
    this.chatPanel.log('  {cyan-fg}Ctrl+E{/}     Edit selected agent');
    this.chatPanel.log('  {cyan-fg}Tab{/}        Cycle focus: sidebar > chat > input');
    this.chatPanel.log('  {cyan-fg}0{/}          Switch to Team Channel');
    this.chatPanel.log('  {cyan-fg}1-9{/}        Switch to agent by number');
    this.chatPanel.log('  {cyan-fg}Ctrl+C{/}     Exit');
    this.chatPanel.log('  {cyan-fg}j/k{/}        Scroll chat');
    this.chatPanel.log('  {cyan-fg}Enter{/}      Send message');
    this.chatPanel.log('  {cyan-fg}Esc{/}        Clear input / close dialog');
    this.chatPanel.log('');
    this.chatPanel.log('{bold}Commands:{/}');
    this.chatPanel.log('  {cyan-fg}/team create|load|save|list|delete <name>{/}');
    this.chatPanel.log('  {cyan-fg}/agent add|remove|edit|list{/}');
    this.chatPanel.log('  {cyan-fg}/ollama models|status{/}');
    this.chatPanel.log('  {cyan-fg}/help{/}     Show this help');
    this.chatPanel.log('  {cyan-fg}/clear{/}    Clear chat');
    this.chatPanel.log('');
    this.chatPanel.log('{bold}Views:{/}');
    this.chatPanel.log('  {cyan-fg}Team Channel{/} - Messages sent to all agents sequentially');
    this.chatPanel.log('  {cyan-fg}Agent DM{/}     - Private conversation with one agent');
    this.chatPanel.log('');
  }

  startSpinner() {
    this.spinnerStartTime = Date.now();
    this.spinnerFrame = 0;
    this.currentSpinnerMessage = SPINNER_MESSAGES[Math.floor(Math.random() * SPINNER_MESSAGES.length)];

    this.spinnerInterval = setInterval(() => {
      this.spinnerFrame = (this.spinnerFrame + 1) % SPINNER_FRAMES.length;
      const elapsed = ((Date.now() - this.spinnerStartTime) / 1000).toFixed(1);
      const frame = SPINNER_FRAMES[this.spinnerFrame];

      if (Math.floor((Date.now() - this.spinnerStartTime) / 5000) > 0 &&
          (Date.now() - this.spinnerStartTime) % 5000 < 100) {
        this.currentSpinnerMessage = SPINNER_MESSAGES[Math.floor(Math.random() * SPINNER_MESSAGES.length)];
      }

      this.inputBox.setLabel(` ${frame} ${this.currentSpinnerMessage} [${elapsed}s] `);
      this.inputBox.style.label.fg = 'yellow';
      this.render();
    }, 80);
  }

  stopSpinner(success) {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }
    this.updateInputLabel();
  }

  extractCosts(responses) {
    for (const { response } of responses) {
      this.extractCostFromResponse(response);
    }
  }

  extractCostFromResponse(response) {
    const costMatch = response.match(/Cost: \$([\d.]+)/);
    if (costMatch) {
      this.totalCost += parseFloat(costMatch[1]);
      this.updateHeader();
    }
  }

  addSystemMessage(content) {
    this.chatPanel.log(`{yellow-fg}[System]{/} ${content}`);
    this.render();
  }

  escapeContent(content) {
    return content.replace(/\{/g, '{{').replace(/\}/g, '}}');
  }

  render() {
    this.screen.render();
  }

  destroy() {
    if (this.spinnerInterval) clearInterval(this.spinnerInterval);
    this.screen.destroy();
  }
}

export async function runAgentTeamsTUI(options = {}) {
  console.log('\x1b[36m🤖 Launching Agent Teams TUI...\x1b[0m');

  try {
    const tui = new AgentTeamsTUI();

    // Welcome message
    tui.chatPanel.log('');
    tui.chatPanel.log('{bold}{cyan-fg}  gitforked Agent Teams{/}');
    tui.chatPanel.log('{gray-fg}  Multi-agent collaboration TUI{/}');
    tui.chatPanel.log('');
    tui.chatPanel.log('{gray-fg}  Press {cyan-fg}Ctrl+T{/}{gray-fg} to manage teams{/}');
    tui.chatPanel.log('{gray-fg}  Press {cyan-fg}Ctrl+A{/}{gray-fg} to add agents{/}');
    tui.chatPanel.log('{gray-fg}  Type {cyan-fg}/help{/}{gray-fg} for all commands{/}');
    tui.chatPanel.log('');

    // Show team setup dialog on startup
    tui.teamSetupDialog.show();

    process.on('SIGINT', () => {
      tui.destroy();
      process.exit(0);
    });

    return new Promise(() => {});
  } catch (error) {
    console.log(`\x1b[31m❌ Agent Teams TUI failed: ${error.message}\x1b[0m`);
    throw error;
  }
}
