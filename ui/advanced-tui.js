import blessed from 'blessed';
import { grokAPI } from '../lib/grok-api.js';
import { config } from '../config/config.js';
import { gitTools } from '../tools/git-tools.js';
import { PluginManager } from '../plugins/plugin-manager.js';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { Theme } from './styles/theme.js';

// Clipboard helper - copies text to system clipboard
function copyToClipboard(text) {
  // Try xclip first (Linux), then xsel, then pbcopy (macOS)
  const commands = [
    'xclip -selection clipboard',
    'xsel --clipboard --input',
    'pbcopy'
  ];

  for (const cmd of commands) {
    try {
      const proc = exec(cmd);
      proc.stdin.write(text);
      proc.stdin.end();
      return true;
    } catch (e) {
      continue;
    }
  }
  return false;
}

// Permission types for dangerous operations
const PERMISSION_TYPES = {
  BASH: 'bash',
  WRITE: 'write',
  EDIT: 'edit',
  GIT: 'git',
  DELETE: 'delete'
};

// Available models by provider (opencode-inspired)
const AVAILABLE_MODELS = {
  xai: [
    'grok-4-1-fast-reasoning',
    'grok-4-1-fast-non-reasoning',
    'grok-4-latest',
    'grok-4',
    'grok-3-latest',
    'grok-3-fast',
    'grok-3-mini',
    'grok-3-mini-fast',
    'grok-beta',
    'grok-vision-beta'
  ],
  anthropic: [
    'claude-opus-4-6',
    'claude-opus-4-5-20251101',
    'claude-sonnet-4-5-20250929',
    'claude-haiku-4-5-20251001'
  ],
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma2-9b-it'
  ],
  google: [
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ],
  ollama: [] // Populated dynamically via OllamaProvider
};

// Map provider aliases to config keys
const PROVIDER_MAP = {
  xai: 'grok',
  anthropic: 'claude',
  groq: 'groq',
  google: 'gemini',
  ollama: 'ollama'
};

// Easter egg spinner messages
const SPINNER_MESSAGES = [
  // Idiocracy refs
  "Go Away! I'm 'Batin!",
  "Brawndo has electrolytes...",
  "Welcome to Costco, I love you...",
  "I like money...",

  // Office Space refs
  "PC Load Letter?! WTF?!",
  "Yeah, I'm gonna need you to come in on Saturday...",
  "I believe you have my stapler...",
  "Sounds like someone has a case of the Mondays...",
  "What would you say... you do here?",
  "We fixed the glitch...",
  "I did absolutely nothing and it was everything...",
  "I deal with the customers!",
  "Corporate accounts payable, Nina speaking...",
  "Excuse me, I believe you have my stapler...",

  // More movie/TV refs
  "This is fine. 🔥",
  "I'm not even supposed to be here today...",
  "Hello, IT. Have you tried turning it off and on?",
  "Did you see that ludicrous display last night?",
  "The files are IN the computer...",
  "It's not a bug, it's a feature...",

  // Classic dev humor
  "Boogying...",
  "Hold my mass decoupled chai...",
  "sudo make me a sandwich...",
  "Googling Stack Overflow...",
  "Copying from Stack Overflow...",
  "It works on my machine...",
  "Blaming the intern...",
  "Reading the docs (rare achievement)...",
  "Deploying to prod on Friday...",
  "rm -rf / (just kidding)...",
  "Have you tried turning it off and on?",
  "Yelling at the compiler...",
  "Works in dev, good enough...",
  "TODO: fix this later...",
  "// I have no idea why this works...",
  "Commenting out the tests...",

  // Tech nonsense
  "Downloading more RAM...",
  "Reticulating splines...",
  "Reversing the polarity...",
  "Hacking the mainframe...",
  "Enhancing... enhance... enhance...",
  "Warming up the GPUs...",
  "Teaching hamsters to code...",
  "Consulting the blockchain...",
  "Asking ChatGPT to ask me...",
  "Replacing AI with if statements...",
  "Converting caffeine to code...",

  // Corny / Wholesome
  "Thinking really hard...",
  "Big brain time...",
  "Neurons firing...",
  "Crunching numbers aggressively...",
  "Loading loading screen...",
  "Patience, young padawan...",
  "One sec, vibing...",
  "AI goes brrrrr...",
  "Flexing neural networks...",
  "Doing computer stuff...",
  "Beep boop beep...",
  "*elevator music*",
  "Almost there... probably...",
  "Trust the process...",
  "Working harder, not smarter...",
  "Pretending to be productive...",
  "Hold on, gotta think...",
  "BRB, consulting my rubber duck...",
  "Spinning up the hamster wheel...",
  "Making the magic happen...",
  "Abracadabra... wait...",

  // Old school gamer refs
  "Loading... please wait...",
  "Inserting coin...",
  "Press START to continue...",
  "Buffing stats...",
  "Rolling for initiative...",
  "Respawning...",
  "Grinding XP...",
  "Farming resources...",
  "Speedrun strats loading...",
  "Checking for fall damage...",
  "Quick saving...",
  "Entering the Konami code...",
  "!",
  "Zug zug...",
  "WASTED",
  "Leeeroy...",
  "GG no re...",
  "360 no scope incoming...",
  "Camping in spawn...",
  "Need a dispenser here!",
  "The enrichment center reminds you...",
  "Praise the sun!",
  "You died.",
  "Git gud...",
];

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// The gitforked mascot - teal dude with fedora and cigar
const MASCOT = `
          {#1a1a80-fg}▄█▄{/}
         {#2a2a90-fg}█████{/}
       {#1a1a70-fg}▀▀▀▀▀▀▀▀▀{/}
      {#20B2AA-fg}▄█████████▄{/}
     {#20B2AA-fg}███{/}{black-fg}●{/}{#20B2AA-fg}█████{/}{black-fg}●{/}{#20B2AA-fg}███{/}
      {#20B2AA-fg}██████████{/}{#8B4513-fg}▄▄{/}{#FF6600-fg}▶{/}
      {#20B2AA-fg}██████████{/}
       {#20B2AA-fg}██    ██{/}
`;

const MASCOT_SIMPLE = `
         ▄█▄
        █████
      ▀▀▀▀▀▀▀▀▀
     ▄█████████▄
    ███●█████●███
     ██████████▄▄▶
     ██████████
      ██    ██
`;

// Startup messages - old school gamer style
const STARTUP_MESSAGES = [
  "I came to kick ass and chew bubble gum... and I'm all out of gum.",
  "Hail to the king, baby!",
  "It's dangerous to go alone! Take this. 🗡️",
  "All your base are belong to us.",
  "Stay awhile and listen...",
  "Wake up, Neo...",
  "LEEROOOOY JENKIIINS!",
  "Do a barrel roll!",
  "The cake is a lie.",
  "War. War never changes.",
  "Hey! Listen!",
  "Would you kindly... start coding?",
  "A winner is you!",
  "Get over here!",
  "FINISH HIM!",
  "It's super effective!",
  "You must construct additional pylons.",
  "Snake? SNAKE?! SNAAAAKE!",
  "Praise the sun! \\[T]/",
  "FUS RO DAH!",
  "I used to be an adventurer like you...",
  "Press F to pay respects.",
  "GG EZ.",
  "Ready Player One.",
  "Game on.",
];

// Fallback simple TUI for incompatible terminals
class SimpleTUI {
  constructor() {
    this.provider = 'grok';
    this.model = 'grok-4-1-fast-reasoning';
    this.currentDir = process.cwd();
    this.totalCost = 0;
    this.mode = 'plan';
    this.pluginManager = new PluginManager();

    const startupMsg = STARTUP_MESSAGES[Math.floor(Math.random() * STARTUP_MESSAGES.length)];

    console.log('');
    console.log('\x1b[34m         ▄█▄\x1b[0m');
    console.log('\x1b[34m        █████\x1b[0m');
    console.log('\x1b[34m      ▀▀▀▀▀▀▀▀▀\x1b[0m');
    console.log('\x1b[96m     ▄█████████▄\x1b[0m');
    console.log('\x1b[96m    ███\x1b[30m●\x1b[96m█████\x1b[30m●\x1b[96m███\x1b[0m');
    console.log('\x1b[96m     ██████████\x1b[33m▄▄\x1b[91m▶\x1b[0m');
    console.log('\x1b[96m     ██████████\x1b[0m');
    console.log('\x1b[96m      ██    ██\x1b[0m');
    console.log('');
    console.log('\x1b[1m\x1b[36m  gitforked\x1b[0m \x1b[90m- Grok CLI\x1b[0m');
    console.log('');
    console.log(`\x1b[33m  "${startupMsg}"\x1b[0m`);
    console.log('');
    console.log(`  Mode: \x1b[33m${this.mode.toUpperCase()}\x1b[0m | Model: \x1b[32m${this.model}\x1b[0m`);
    console.log('\x1b[90m  Commands: /help, /mode, /git, /run, Ctrl+C to exit\x1b[0m');
    console.log('');

    this.setupInput();
  }

  async initializePlugins() {
    await this.pluginManager.initialize();
  }

  setupInput() {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let inputBuffer = '';

    process.stdin.on('data', async (key) => {
      const char = key.toString();

      if (char === '\r' || char === '\n') {
        const input = inputBuffer.trim();
        inputBuffer = '';

        if (input) {
          await this.handleInput(input);
        }
        this.showPrompt();
      } else if (char === '\u0003') {
        console.log('\n\x1b[36m👋 Goodbye!\x1b[0m');
        process.exit(0);
      } else if (char === '\u007f' || char === '\b') {
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        inputBuffer += char;
        process.stdout.write(char);
      }
    });

    this.showPrompt();
  }

  showPrompt() {
    const modeColor = this.mode === 'plan' ? '\x1b[33m' : '\x1b[32m';
    process.stdout.write(`\n${modeColor}[${this.mode.toUpperCase()}]\x1b[0m \x1b[36m>\x1b[0m `);
  }

  async handleInput(input) {
    console.log('');

    if (input.startsWith('/')) {
      await this.handleCommand(input);
    } else {
      this.showThinking();
      try {
        const response = await grokAPI.processPrompt(input, {
          model: this.model,
          directory: this.currentDir,
          mode: this.mode
        });
        this.hideThinking();
        console.log('\x1b[36m┌─ Response ─────────────────────────────────────────\x1b[0m');
        console.log(response);
        console.log('\x1b[36m└────────────────────────────────────────────────────\x1b[0m');
      } catch (error) {
        this.hideThinking();
        console.log(`\x1b[31m❌ Error: ${error.message}\x1b[0m`);
      }
    }
  }

  showThinking() {
    process.stdout.write('\x1b[90m⠋ Thinking...\x1b[0m');
  }

  hideThinking() {
    process.stdout.write('\r\x1b[K');
  }

  async handleCommand(cmd) {
    const [command, ...args] = cmd.slice(1).split(' ');

    switch (command) {
      case 'help':
        console.log('\x1b[36m┌─ Commands ─────────────────────────────────────────\x1b[0m');
        console.log('  /help          Show this help');
        console.log('  /mode          Toggle Plan/Build mode');
        console.log('  /git <cmd>     Git operations');
        console.log('  /run <cmd>     Execute shell command');
        console.log('  /plugin list   List plugins');
        console.log('\x1b[36m└────────────────────────────────────────────────────\x1b[0m');
        break;
      case 'mode':
        this.mode = this.mode === 'plan' ? 'build' : 'plan';
        const modeColor = this.mode === 'plan' ? '\x1b[33m' : '\x1b[32m';
        console.log(`${modeColor}Mode switched to: ${this.mode.toUpperCase()}\x1b[0m`);
        break;
      case 'git':
        try {
          const result = await gitTools.handleGitCommand(args[0], args.slice(1));
          console.log(`\x1b[32m${result}\x1b[0m`);
        } catch (error) {
          console.log(`\x1b[31mGit error: ${error.message}\x1b[0m`);
        }
        break;
      case 'run':
        await this.runWithPermission(args.join(' '));
        break;
      case 'plugin':
        if (args[0] === 'list') {
          const plugins = this.pluginManager.listPlugins();
          console.log(`\x1b[36mPlugins: ${plugins.join(', ') || 'none'}\x1b[0m`);
        }
        break;
      default:
        console.log(`\x1b[31mUnknown command: ${command}\x1b[0m`);
    }
  }

  async runWithPermission(cmd) {
    console.log('\x1b[33m⚠ Permission required to execute:\x1b[0m');
    console.log(`  \x1b[90m$ ${cmd}\x1b[0m`);
    console.log('\x1b[33mPress Y to allow, N to deny:\x1b[0m ');

    return new Promise((resolve) => {
      const onData = async (key) => {
        const char = key.toString().toLowerCase();
        if (char === 'y') {
          process.stdin.removeListener('data', onData);
          console.log('\x1b[32m✓ Allowed\x1b[0m');
          try {
            const result = await grokAPI.executeBash(cmd, this.currentDir);
            console.log(result);
          } catch (error) {
            console.log(`\x1b[31mError: ${error.message}\x1b[0m`);
          }
          resolve(true);
        } else if (char === 'n') {
          process.stdin.removeListener('data', onData);
          console.log('\x1b[31m✗ Denied\x1b[0m');
          resolve(false);
        }
      };
      process.stdin.on('data', onData);
    });
  }
}

export class AdvancedTUI {
  constructor() {
    try {
      this.screen = blessed.screen({
        smartCSR: true,
        title: 'gitforked',
        autoPadding: true,
        fullUnicode: true,
        mouse: true,
        sendFocus: true,
        forceUnicode: true
      });
    } catch (error) {
      throw new Error(`Terminal UI not supported: ${error.message}`);
    }

    this.provider = config.getProvider() || 'grok';
    this.model = config.getModel() || 'grok-4-1-fast-reasoning';
    this.currentDir = process.cwd();
    this.totalCost = 0;
    this.todos = [];
    this.mode = 'plan';
    this.messages = [];
    this.pendingToolCalls = [];
    this.commandHistory = [];
    this.historyIndex = -1;
    this.pluginManager = new PluginManager();
    this.permissionPending = null;
    this.showFileBrowser = false;
    this.fileItems = [];
    this.spinnerInterval = null;
    this.spinnerFrame = 0;
    this.spinnerStartTime = null;
    this.currentSpinnerMessage = '';

    this.initComponents();
    this.setupEventHandlers();
    this.loadConfig();
    this.updateTodoList(); // Initialize tasks panel with placeholder
    this.render();
  }

  async initializePlugins() {
    await this.pluginManager.initialize();
  }

  initComponents() {
    // Main container
    this.mainBox = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      style: { bg: 'black' }
    });

    // Header bar with mode indicator
    this.headerBar = blessed.box({
      parent: this.mainBox,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      style: {
        bg: 'black',
        fg: 'white'
      },
      border: {
        type: 'line',
        fg: 'cyan'
      },
      tags: true
    });
    this.updateHeader();

    // Main content area
    this.contentBox = blessed.box({
      parent: this.mainBox,
      top: 3,
      left: 0,
      width: '100%',
      height: '100%-7',
      style: { bg: 'black' }
    });

    // Chat panel (left 70%)
    this.chatPanel = blessed.log({
      parent: this.contentBox,
      top: 0,
      left: 0,
      width: '70%',
      height: '100%',
      label: ' Chat (j/k or arrows to scroll) ',
      border: {
        type: 'line',
        fg: 'cyan'
      },
      style: {
        bg: 'black',
        fg: 'white',
        border: { fg: 'cyan' },
        label: { fg: 'cyan', bold: true }
      },
      scrollbar: {
        ch: '█',
        track: {
          bg: 'gray'
        },
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
    this.chatPanel.key(['j', 'down'], () => {
      this.chatPanel.scroll(1);
      this.render();
    });
    this.chatPanel.key(['k', 'up'], () => {
      this.chatPanel.scroll(-1);
      this.render();
    });
    this.chatPanel.key(['pagedown', 'C-d'], () => {
      this.chatPanel.scroll(this.chatPanel.height - 2);
      this.render();
    });
    this.chatPanel.key(['pageup', 'C-u'], () => {
      this.chatPanel.scroll(-(this.chatPanel.height - 2));
      this.render();
    });
    this.chatPanel.key(['g'], () => {
      this.chatPanel.scrollTo(0);
      this.render();
    });
    this.chatPanel.key(['S-g'], () => {
      this.chatPanel.scrollTo(this.chatPanel.getScrollHeight());
      this.render();
    });

    // Mouse wheel scrolling for chat panel
    this.chatPanel.on('wheeldown', () => {
      this.chatPanel.scroll(3);
      this.render();
    });
    this.chatPanel.on('wheelup', () => {
      this.chatPanel.scroll(-3);
      this.render();
    });

    // Agent activity panel (right 30%)
    this.activityPanel = blessed.log({
      parent: this.contentBox,
      top: 0,
      left: '70%',
      width: '30%',
      height: '60%',
      label: ' Agent Activity ',
      border: {
        type: 'line',
        fg: 'cyan'
      },
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
      tags: true
    });

    // Mouse wheel scrolling for activity panel
    this.activityPanel.on('wheeldown', () => {
      this.activityPanel.scroll(2);
      this.render();
    });
    this.activityPanel.on('wheelup', () => {
      this.activityPanel.scroll(-2);
      this.render();
    });

    // Todo panel (right bottom 40%)
    this.todoPanel = blessed.list({
      parent: this.contentBox,
      top: '60%',
      left: '70%',
      width: '30%',
      height: '40%',
      label: ' Tasks ',
      border: {
        type: 'line',
        fg: 'cyan'
      },
      style: {
        bg: 'black',
        fg: 'white',
        border: { fg: 'cyan' },
        label: { fg: 'cyan', bold: true },
        selected: { bg: 'cyan', fg: 'black' }
      },
      scrollbar: {
        ch: '█',
        track: { bg: 'gray' },
        style: { bg: 'cyan', fg: 'cyan' }
      },
      mouse: true,
      keys: true,
      tags: true,
      scrollable: true
    });

    // File browser panel (hidden initially, toggleable with Ctrl+F)
    this.fileBrowserPanel = blessed.list({
      parent: this.contentBox,
      top: 0,
      left: '70%',
      width: '30%',
      height: '100%',
      label: ' Files ',
      border: {
        type: 'line',
        fg: 'cyan'
      },
      style: {
        bg: 'black',
        fg: 'white',
        border: { fg: 'cyan' },
        label: { fg: 'cyan', bold: true },
        selected: { bg: 'cyan', fg: 'black' }
      },
      scrollbar: {
        ch: '│',
        style: { bg: 'cyan' }
      },
      mouse: true,
      keys: true,
      vi: true,
      hidden: true
    });

    this.fileBrowserPanel.on('select', async (item, index) => {
      const selected = this.fileItems[index];
      if (selected) {
        if (selected.isDirectory) {
          this.currentDir = selected.path;
          this.updateHeader();
          await this.loadFileBrowser();
        } else {
          this.addSystemMessage(`Selected: ${selected.name}`);
        }
      }
    });

    // Input area
    this.inputBox = blessed.textbox({
      parent: this.mainBox,
      bottom: 1,
      left: 0,
      width: '100%',
      height: 3,
      label: ` ${this.mode === 'plan' ? 'Plan' : 'Build'} `,
      border: {
        type: 'line',
        fg: this.mode === 'plan' ? 'yellow' : 'green'
      },
      style: {
        bg: '#1a1a1a',
        fg: 'white',
        border: { fg: this.mode === 'plan' ? 'yellow' : 'green' },
        label: { fg: this.mode === 'plan' ? 'yellow' : 'green', bold: true }
      },
      inputOnFocus: true,
      mouse: true
    });

    // Keybindings bar
    this.keysBar = blessed.box({
      parent: this.mainBox,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      style: {
        bg: '#1a1a1a',
        fg: 'white'
      },
      tags: true,
      content: '{cyan-fg}^P{/} Mode  {cyan-fg}^F{/} Files  {cyan-fg}^C{/} Exit  {cyan-fg}Tab{/} Focus  {cyan-fg}j/k{/} Scroll  {cyan-fg}y{/} Copy  {cyan-fg}?{/} Help'
    });

    // Permission dialog (hidden initially)
    this.permissionDialog = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: 12,
      border: {
        type: 'line',
        fg: 'yellow'
      },
      style: {
        bg: 'black',
        fg: 'white',
        border: { fg: 'yellow' }
      },
      label: ' ⚠ Permission Required ',
      hidden: true,
      tags: true,
      keys: true,
      focusable: true
    });

    this.permissionContent = blessed.box({
      parent: this.permissionDialog,
      top: 0,
      left: 1,
      width: '100%-4',
      height: 6,
      style: { bg: 'black', fg: 'white' },
      tags: true
    });

    this.permissionButtons = blessed.box({
      parent: this.permissionDialog,
      bottom: 0,
      left: 'center',
      width: 40,
      height: 3,
      style: { bg: 'black' },
      tags: true,
      content: '    {green-fg}{bold}[Y] Allow{/}      {red-fg}{bold}[N] Deny{/}'
    });

    // Permission dialog key handlers - directly on the dialog
    this.permissionDialog.key(['y', 'Y'], () => {
      this.grantPermission();
    });

    this.permissionDialog.key(['n', 'N', 'escape'], () => {
      this.denyPermission();
    });

    this.inputBox.focus();
  }

  updateHeader() {
    const modeColor = this.mode === 'plan' ? '{yellow-fg}' : '{green-fg}';
    const modeText = this.mode.toUpperCase();
    const dirName = path.basename(this.currentDir) || '/';

    this.headerBar.setContent(
      ` {bold}{cyan-fg}gitforked{/} │ ` +
      `Mode: ${modeColor}${modeText}{/} │ ` +
      `Model: {white-fg}${this.model}{/} │ ` +
      `Dir: {white-fg}${dirName}{/} │ ` +
      `Cost: {green-fg}$${this.totalCost.toFixed(4)}{/}`
    );
  }

  updateInputLabel() {
    const borderColor = this.mode === 'plan' ? 'yellow' : 'green';
    this.inputBox.style.border.fg = borderColor;
    this.inputBox.style.label.fg = borderColor;
    this.inputBox.setLabel(` ${this.mode === 'plan' ? 'Plan' : 'Build'} `);
  }

  setupEventHandlers() {
    // Exit
    this.screen.key(['C-c'], () => {
      this.destroy();
      process.exit(0);
    });

    // Mode toggle
    this.screen.key(['C-p'], () => {
      this.mode = this.mode === 'plan' ? 'build' : 'plan';
      this.updateHeader();
      this.updateInputLabel();
      this.addSystemMessage(`Mode switched to: ${this.mode.toUpperCase()}`);
      this.render();
    });

    // File browser toggle
    this.screen.key(['C-f'], async () => {
      this.showFileBrowser = !this.showFileBrowser;
      if (this.showFileBrowser) {
        this.activityPanel.hide();
        this.todoPanel.hide();
        this.fileBrowserPanel.show();
        await this.loadFileBrowser();
      } else {
        this.fileBrowserPanel.hide();
        this.activityPanel.show();
        this.todoPanel.show();
      }
      this.render();
    });

    // Tab to switch focus
    this.screen.key(['tab'], () => {
      if (this.screen.focused === this.inputBox) {
        this.chatPanel.focus();
      } else if (this.screen.focused === this.chatPanel) {
        this.todoPanel.focus();
      } else {
        this.inputBox.focus();
      }
      this.render();
    });

    // Enter to submit
    this.inputBox.key(['enter'], async () => {
      const input = this.inputBox.getValue().trim();
      if (input) {
        // Save to command history
        this.commandHistory.push(input);
        this.historyIndex = this.commandHistory.length; // Reset to end
        this.inputBox.clearValue();
        this.render();
        await this.handleInput(input);
      }
    });

    // Up arrow - previous command in history
    this.inputBox.key(['up'], () => {
      if (this.commandHistory.length > 0 && this.historyIndex > 0) {
        this.historyIndex--;
        this.inputBox.setValue(this.commandHistory[this.historyIndex]);
        this.render();
      }
    });

    // Down arrow - next command in history
    this.inputBox.key(['down'], () => {
      if (this.historyIndex < this.commandHistory.length - 1) {
        this.historyIndex++;
        this.inputBox.setValue(this.commandHistory[this.historyIndex]);
      } else {
        this.historyIndex = this.commandHistory.length;
        this.inputBox.clearValue();
      }
      this.render();
    });

    // Escape to clear/cancel
    this.inputBox.key(['escape'], () => {
      if (this.permissionPending) {
        this.denyPermission();
      } else {
        this.inputBox.clearValue();
        this.render();
      }
    });


    // Quick help with ?
    this.screen.key(['?'], () => {
      if (!this.permissionPending && this.screen.focused !== this.inputBox) {
        this.showHelp();
      }
    });

    // Scroll keys when chat panel is focused
    this.screen.key(['j'], () => {
      if (this.screen.focused === this.chatPanel) {
        this.chatPanel.scroll(1);
        this.render();
      }
    });
    this.screen.key(['k'], () => {
      if (this.screen.focused === this.chatPanel) {
        this.chatPanel.scroll(-1);
        this.render();
      }
    });

    // Copy selection to clipboard on 'y' when in chat panel
    this.screen.key(['y'], () => {
      if (this.screen.focused === this.chatPanel) {
        // Get visible content for now (blessed doesn't have great selection support)
        const content = this.chatPanel.getContent();
        if (content && copyToClipboard(content)) {
          this.addSystemMessage('Chat content copied to clipboard');
        }
      }
    });
  }

  async handleInput(input) {
    if (input.startsWith('/')) {
      await this.handleCommand(input);
    } else {
      this.addUserMessage(input);
      await this.processAIRequest(input);
    }
  }

  async handleCommand(cmd) {
    const parts = cmd.slice(1).split(' ');
    const command = parts[0];
    const args = parts.slice(1);

    switch (command) {
      case 'help':
        this.showHelp();
        break;
      case 'mode':
        this.mode = this.mode === 'plan' ? 'build' : 'plan';
        this.updateHeader();
        this.updateInputLabel();
        this.addSystemMessage(`Mode: ${this.mode.toUpperCase()}`);
        break;
      case 'clear':
        this.chatPanel.setContent('');
        this.messages = [];
        break;
      case 'git':
        await this.handleGitCommand(args);
        break;
      case 'run':
        await this.runWithPermission(args.join(' '), 'bash');
        break;
      case 'todo':
        this.manageTodos(args);
        break;
      case 'models':
        this.listModels(args[0]);
        break;
      case 'switch':
        await this.switchModel(args[0]);
        break;
      case 'provider':
        if (args[0]) {
          await this.switchProvider(args[0]);
        } else {
          this.addSystemMessage(`Current provider: ${this.provider}`);
        }
        break;
      default:
        this.addSystemMessage(`Unknown command: ${command}`);
    }
    this.render();
  }

  listModels(filterProvider) {
    this.chatPanel.log('{bold}{cyan-fg}═══ Available Models ═══{/}');
    this.chatPanel.log('');

    const providers = filterProvider ? [filterProvider] : Object.keys(AVAILABLE_MODELS);

    for (const provider of providers) {
      if (!AVAILABLE_MODELS[provider]) {
        this.addSystemMessage(`Unknown provider: ${provider}`);
        continue;
      }

      const configKey = PROVIDER_MAP[provider];
      const hasKey = config.getApiKey(configKey) ? '{green-fg}✓{/}' : '{red-fg}✗{/}';
      const isCurrent = this.provider === configKey ? '{yellow-fg}(active){/}' : '';

      this.chatPanel.log(`{bold}{cyan-fg}${provider}{/} ${hasKey} ${isCurrent}`);

      for (const model of AVAILABLE_MODELS[provider]) {
        const isActive = this.model === model ? '{yellow-fg}► {/}' : '  ';
        this.chatPanel.log(`${isActive}{white-fg}${provider}/${model}{/}`);
      }
      this.chatPanel.log('');
    }

    this.chatPanel.log('{gray-fg}Usage: /switch provider/model{/}');
    this.chatPanel.log('{gray-fg}Example: /switch xai/grok-4-1-fast-reasoning{/}');
    this.chatPanel.log('');
  }

  async switchModel(input) {
    if (!input || !input.includes('/')) {
      this.addSystemMessage('Usage: /switch provider/model');
      this.addSystemMessage('Example: /switch xai/grok-4-1-fast-reasoning');
      this.addSystemMessage('Run /models to see available options');
      return;
    }

    const [providerAlias, ...modelParts] = input.split('/');
    const model = modelParts.join('/');

    if (!AVAILABLE_MODELS[providerAlias]) {
      this.addSystemMessage(`Unknown provider: ${providerAlias}`);
      this.addSystemMessage(`Available: ${Object.keys(AVAILABLE_MODELS).join(', ')}`);
      return;
    }

    if (!AVAILABLE_MODELS[providerAlias].includes(model)) {
      this.addSystemMessage(`Unknown model: ${model}`);
      this.addSystemMessage(`Run /models ${providerAlias} to see available models`);
      return;
    }

    const configKey = PROVIDER_MAP[providerAlias];

    // Check if API key is set
    if (!config.getApiKey(configKey)) {
      this.addSystemMessage(`{red-fg}No API key set for ${providerAlias}{/}`);
      this.addSystemMessage(`Set it in ~/.gitforked/config.json`);
      return;
    }

    // Update provider and model
    this.provider = configKey;
    this.model = model;
    config.setProvider(configKey);
    config.setModel(model);

    // Reinitialize API client with new provider
    grokAPI.provider = configKey;
    grokAPI.setupClient();

    this.updateHeader();
    this.addSystemMessage(`{green-fg}Switched to ${providerAlias}/${model}{/}`);
  }

  async switchProvider(providerAlias) {
    const configKey = PROVIDER_MAP[providerAlias] || providerAlias;

    if (!config.getApiKey(configKey)) {
      this.addSystemMessage(`{red-fg}No API key set for ${providerAlias}{/}`);
      return;
    }

    this.provider = configKey;
    config.setProvider(configKey);
    grokAPI.provider = configKey;
    grokAPI.setupClient();

    this.updateHeader();
    this.addSystemMessage(`{green-fg}Switched to provider: ${configKey}{/}`);
  }

  async handleGitCommand(args) {
    const subcommand = args[0];
    const subArgs = args.slice(1);

    this.addActivity('git', `git ${args.join(' ')}`, 'running');

    try {
      const result = await gitTools.handleGitCommand(subcommand, subArgs);
      this.updateActivity('git', 'completed');
      this.addSystemMessage(`Git: ${result}`);
    } catch (error) {
      this.updateActivity('git', 'failed');
      this.addSystemMessage(`Git error: ${error.message}`);
    }
  }

  async processAIRequest(input) {
    this.startSpinner();

    try {
      const response = await this.processPromptWithCallbacks(input);
      this.stopSpinner(true);
      this.addAssistantMessage(response);
      this.extractCost(response);
    } catch (error) {
      this.stopSpinner(false);
      this.addSystemMessage(`Error: ${error.message}`);
    }
    this.render();
  }

  startSpinner() {
    this.spinnerStartTime = Date.now();
    this.spinnerFrame = 0;
    this.currentSpinnerMessage = SPINNER_MESSAGES[Math.floor(Math.random() * SPINNER_MESSAGES.length)];

    // Update the activity panel with animated spinner
    this.spinnerInterval = setInterval(() => {
      this.spinnerFrame = (this.spinnerFrame + 1) % SPINNER_FRAMES.length;
      const elapsed = ((Date.now() - this.spinnerStartTime) / 1000).toFixed(1);
      const frame = SPINNER_FRAMES[this.spinnerFrame];

      // Change message every 5 seconds for variety
      if (Math.floor((Date.now() - this.spinnerStartTime) / 5000) > 0 &&
          (Date.now() - this.spinnerStartTime) % 5000 < 100) {
        this.currentSpinnerMessage = SPINNER_MESSAGES[Math.floor(Math.random() * SPINNER_MESSAGES.length)];
      }

      // Update the input label with spinner
      const modeColor = this.mode === 'plan' ? 'yellow' : 'green';
      this.inputBox.setLabel(` ${frame} ${this.currentSpinnerMessage} [${elapsed}s] `);
      this.inputBox.style.label.fg = modeColor;
      this.render();
    }, 80);

    this.addActivity('thinking', this.currentSpinnerMessage, 'running');
  }

  stopSpinner(success) {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }

    const elapsed = this.spinnerStartTime ? ((Date.now() - this.spinnerStartTime) / 1000).toFixed(1) : '0.0';

    // Restore input label
    this.updateInputLabel();

    // Update activity
    this.updateActivity('thinking', success ? 'completed' : 'failed');

    // Log completion time
    const icon = success ? '{green-fg}✓{/}' : '{red-fg}✗{/}';
    this.activityPanel.log(`${icon} Completed in ${elapsed}s`);
  }

  async processPromptWithCallbacks(prompt) {
    return await grokAPI.processPrompt(prompt, {
      model: this.model,
      directory: this.currentDir,
      mode: this.mode,
      messages: this.messages, // Pass conversation history
      onToolCall: (toolName, args) => {
        this.addActivity(toolName, this.formatToolArgs(toolName, args), 'running');
        this.render();
      },
      onToolResult: (toolName, success) => {
        this.updateActivity(toolName, success ? 'completed' : 'failed');
        this.render();
      },
      onPermissionRequired: async (type, details) => {
        return await this.requestPermission(type, details);
      }
    });
  }

  formatToolArgs(toolName, args) {
    switch (toolName) {
      case 'bash':
        return `$ ${args.command || ''}`;
      case 'read':
        return path.basename(args.filePath || '');
      case 'write':
        return path.basename(args.filePath || '');
      case 'edit':
        return path.basename(args.filePath || '');
      case 'glob':
        return args.pattern || '';
      case 'grep':
        return `/${args.pattern || ''}/`;
      default:
        return JSON.stringify(args).slice(0, 40);
    }
  }

  async requestPermission(type, details) {
    return new Promise((resolve) => {
      this.permissionPending = { resolve, type, details };

      let content = `{yellow-fg}The agent wants to execute:{/}\n\n`;

      switch (type) {
        case 'bash':
          content += `{white-fg}Command:{/} {cyan-fg}${details.command}{/}`;
          if (details.workdir) {
            content += `\n{white-fg}Directory:{/} ${details.workdir}`;
          }
          break;
        case 'write':
          content += `{white-fg}Write file:{/} {cyan-fg}${details.filePath}{/}`;
          break;
        case 'edit':
          content += `{white-fg}Edit file:{/} {cyan-fg}${details.filePath}{/}`;
          break;
        default:
          content += `{white-fg}${type}:{/} ${JSON.stringify(details)}`;
      }

      this.permissionContent.setContent(content);
      this.permissionDialog.show();
      this.permissionDialog.focus();
      this.render();
    });
  }

  grantPermission() {
    if (this.permissionPending) {
      this.addActivity('permission', `Allowed: ${this.permissionPending.type}`, 'completed');
      this.permissionDialog.hide();
      this.permissionPending.resolve(true);
      this.permissionPending = null;
      this.inputBox.focus();
      this.render();
    }
  }

  denyPermission() {
    if (this.permissionPending) {
      this.addActivity('permission', `Denied: ${this.permissionPending.type}`, 'failed');
      this.permissionDialog.hide();
      this.permissionPending.resolve(false);
      this.permissionPending = null;
      this.inputBox.focus();
      this.render();
    }
  }

  async runWithPermission(cmd, type = 'bash') {
    const allowed = await this.requestPermission(type, { command: cmd, workdir: this.currentDir });

    if (allowed) {
      this.addActivity('bash', `$ ${cmd}`, 'running');
      try {
        const result = await grokAPI.executeBash(cmd, this.currentDir);
        this.updateActivity('bash', 'completed');
        this.addSystemMessage(result || 'Command completed');
      } catch (error) {
        this.updateActivity('bash', 'failed');
        this.addSystemMessage(`Error: ${error.message}`);
      }
    } else {
      this.addSystemMessage('Command denied by user');
    }
    this.render();
  }

  addActivity(name, details, status) {
    const statusIcons = {
      running: '{yellow-fg}⠋{/}',
      completed: '{green-fg}✓{/}',
      failed: '{red-fg}✗{/}'
    };

    const icon = statusIcons[status] || '{white-fg}○{/}';
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    this.activityPanel.log(`${icon} {cyan-fg}${name}{/}`);
    if (details) {
      this.activityPanel.log(`  {gray-fg}${details.slice(0, 50)}{/}`);
    }

    // Store for updating later
    this.pendingToolCalls.push({ name, details, status, time });
    this.render();
  }

  updateActivity(name, status) {
    // Find and update the last matching activity
    for (let i = this.pendingToolCalls.length - 1; i >= 0; i--) {
      if (this.pendingToolCalls[i].name === name && this.pendingToolCalls[i].status === 'running') {
        this.pendingToolCalls[i].status = status;
        break;
      }
    }
  }

  addUserMessage(content) {
    this.messages.push({ role: 'user', content });
    this.chatPanel.log(`{bold}{cyan-fg}You:{/} ${this.escapeContent(content)}`);
    this.render();
  }

  addAssistantMessage(content) {
    this.messages.push({ role: 'assistant', content });
    const lines = content.split('\n');
    this.chatPanel.log(`{bold}{green-fg}AI:{/}`);
    lines.forEach(line => {
      this.chatPanel.log(`  ${this.escapeContent(line)}`);
    });
    this.chatPanel.log('');
    this.render();
  }

  addSystemMessage(content) {
    this.chatPanel.log(`{yellow-fg}[System]{/} ${this.escapeContent(content)}`);
    this.render();
  }

  escapeContent(content) {
    // Escape blessed tags in user content
    return content.replace(/\{/g, '{{').replace(/\}/g, '}}');
  }

  showHelp() {
    this.chatPanel.log('{bold}{cyan-fg}═══ gitforked Help ═══{/}');
    this.chatPanel.log('');
    this.chatPanel.log('{bold}Keyboard Shortcuts:{/}');
    this.chatPanel.log('  {cyan-fg}Ctrl+P{/}     Toggle Plan/Build mode');
    this.chatPanel.log('  {cyan-fg}Ctrl+F{/}     Toggle file browser');
    this.chatPanel.log('  {cyan-fg}Ctrl+C{/}     Exit');
    this.chatPanel.log('  {cyan-fg}Tab{/}        Switch focus between panels');
    this.chatPanel.log('  {cyan-fg}Enter{/}      Send message');
    this.chatPanel.log('  {cyan-fg}Esc{/}        Clear input / Cancel permission');
    this.chatPanel.log('  {cyan-fg}Y/N{/}        Allow/Deny permission prompts');
    this.chatPanel.log('');
    this.chatPanel.log('{bold}Scroll (when Chat focused):{/}');
    this.chatPanel.log('  {cyan-fg}j / ↓{/}      Scroll down');
    this.chatPanel.log('  {cyan-fg}k / ↑{/}      Scroll up');
    this.chatPanel.log('  {cyan-fg}PgDn/^D{/}    Page down');
    this.chatPanel.log('  {cyan-fg}PgUp/^U{/}    Page up');
    this.chatPanel.log('  {cyan-fg}g{/}          Go to top');
    this.chatPanel.log('  {cyan-fg}G{/}          Go to bottom');
    this.chatPanel.log('  {cyan-fg}y{/}          Copy chat to clipboard');
    this.chatPanel.log('');
    this.chatPanel.log('{bold}Commands:{/}');
    this.chatPanel.log('  {cyan-fg}/help{/}              Show this help');
    this.chatPanel.log('  {cyan-fg}/mode{/}              Toggle Plan/Build mode');
    this.chatPanel.log('  {cyan-fg}/clear{/}             Clear chat history');
    this.chatPanel.log('  {cyan-fg}/run <cmd>{/}         Execute shell command (requires permission)');
    this.chatPanel.log('  {cyan-fg}/git <cmd>{/}         Git operations');
    this.chatPanel.log('  {cyan-fg}/todo add <text>{/}   Add a task');
    this.chatPanel.log('  {cyan-fg}/todo list{/}         List all tasks');
    this.chatPanel.log('  {cyan-fg}/todo done <n>{/}     Mark task n as complete');
    this.chatPanel.log('');
    this.chatPanel.log('{bold}Model Switching:{/}');
    this.chatPanel.log('  {cyan-fg}/models{/}            List all available models');
    this.chatPanel.log('  {cyan-fg}/models <provider>{/} List models for a provider');
    this.chatPanel.log('  {cyan-fg}/switch <p/m>{/}      Switch to provider/model');
    this.chatPanel.log('  {cyan-fg}/provider{/}          Show current provider');
    this.chatPanel.log('');
    this.chatPanel.log('{bold}Examples:{/}');
    this.chatPanel.log('  {gray-fg}/switch xai/grok-4-1-fast-reasoning{/}');
    this.chatPanel.log('  {gray-fg}/switch anthropic/claude-opus-4-6{/}');
    this.chatPanel.log('');
    this.chatPanel.log('{bold}Modes:{/}');
    this.chatPanel.log('  {yellow-fg}PLAN{/}   Agent analyzes and plans before acting');
    this.chatPanel.log('  {green-fg}BUILD{/}  Agent executes and implements directly');
    this.chatPanel.log('');
    this.render();
  }

  manageTodos(args) {
    if (args[0] === 'add') {
      const content = args.slice(1).join(' ');
      this.todos.push({ content, status: 'pending', id: Date.now() });
      this.updateTodoList();
      this.addSystemMessage(`Todo added: ${content}`);
    } else if (args[0] === 'list') {
      if (this.todos.length === 0) {
        this.addSystemMessage('No todos');
      } else {
        this.todos.forEach((todo, i) => {
          this.addSystemMessage(`${i + 1}. [${todo.status}] ${todo.content}`);
        });
      }
    } else if (args[0] === 'done') {
      const index = parseInt(args[1]) - 1;
      if (this.todos[index]) {
        this.todos[index].status = 'completed';
        this.updateTodoList();
        this.addSystemMessage(`Todo completed: ${this.todos[index].content}`);
      }
    }
  }

  updateTodoList() {
    if (this.todos.length === 0) {
      this.todoPanel.setItems([
        '{gray-fg}No tasks yet{/}',
        '{gray-fg}/todo add <task>{/}'
      ]);
    } else {
      const items = this.todos.map((todo) => {
        const icon = todo.status === 'completed' ? '{green-fg}✓{/}' : '{yellow-fg}○{/}';
        return `${icon} ${todo.content}`;
      });
      this.todoPanel.setItems(items);
    }
    this.render();
  }

  loadConfig() {
    try {
      this.provider = config.getProvider() || 'grok';
      this.model = config.getModel() || 'grok-4-1-fast-reasoning';
      this.updateHeader();
    } catch (error) {
      this.addSystemMessage(`Config error: ${error.message}`);
    }
  }

  async loadFileBrowser() {
    try {
      const items = fs.readdirSync(this.currentDir, { withFileTypes: true });
      this.fileItems = [
        { name: '..', path: path.dirname(this.currentDir), isDirectory: true },
        ...items
          .filter(item => !item.name.startsWith('.'))
          .sort((a, b) => {
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return a.name.localeCompare(b.name);
          })
          .map(item => ({
            name: item.name,
            path: path.join(this.currentDir, item.name),
            isDirectory: item.isDirectory()
          }))
      ];

      const displayItems = this.fileItems.map(item => {
        const icon = item.isDirectory ? '{cyan-fg}📁{/}' : '{white-fg}📄{/}';
        return `${icon} ${item.name}`;
      });

      this.fileBrowserPanel.setItems(displayItems);
      this.fileBrowserPanel.setLabel(` ${path.basename(this.currentDir) || '/'} `);
      this.render();
    } catch (error) {
      this.addSystemMessage(`Error loading files: ${error.message}`);
    }
  }

  extractCost(response) {
    const costMatch = response.match(/Cost: \$([\d.]+)/);
    if (costMatch) {
      const cost = parseFloat(costMatch[1]);
      this.totalCost += cost;
      this.updateHeader();
    }
  }

  render() {
    this.screen.render();
  }

  destroy() {
    this.screen.destroy();
  }
}

export async function runAdvancedTUI(options = {}) {
  // Random startup message
  const startupMsg = STARTUP_MESSAGES[Math.floor(Math.random() * STARTUP_MESSAGES.length)];
  console.log(`\x1b[36m🎮 ${startupMsg}\x1b[0m`);
  console.log('\x1b[90m───────────────────────────────────────────────\x1b[0m');

  try {
    const tui = new AdvancedTUI();
    await tui.initializePlugins();

    // Welcome message with mascot - teal dude with fedora and cigar
    tui.chatPanel.log('');
    tui.chatPanel.log('{#1a1a80-fg}           ▄█▄{/}');
    tui.chatPanel.log('{#2a2a90-fg}          █████{/}');
    tui.chatPanel.log('{#1a1a70-fg}        ▀▀▀▀▀▀▀▀▀{/}');
    tui.chatPanel.log('{#20B2AA-fg}       ▄█████████▄{/}');
    tui.chatPanel.log('{#20B2AA-fg}      ███{/}{#000000-fg}●{/}{#20B2AA-fg}█████{/}{#000000-fg}●{/}{#20B2AA-fg}███{/}');
    tui.chatPanel.log('{#20B2AA-fg}       ██████████{/}{#8B4513-fg}▄▄{/}{#FF6600-fg}▶{/}');
    tui.chatPanel.log('{#20B2AA-fg}       ██████████{/}');
    tui.chatPanel.log('{#20B2AA-fg}        ██    ██{/}');
    tui.chatPanel.log('');
    tui.chatPanel.log('{bold}{cyan-fg}       gitforked{/}');
    tui.chatPanel.log('{gray-fg}        Grok CLI{/}');
    tui.chatPanel.log('');
    tui.chatPanel.log(`{yellow-fg}  "${startupMsg}"{/}`);
    tui.chatPanel.log('');
    tui.chatPanel.log(`{gray-fg}  Mode: {/}{${tui.mode === 'plan' ? 'yellow' : 'green'}-fg}${tui.mode.toUpperCase()}{/} {gray-fg}| Model: {/}{white-fg}${tui.model}{/}`);
    tui.chatPanel.log('{gray-fg}  Type a message or /help for commands{/}');
    tui.chatPanel.log('');

    process.on('SIGINT', () => {
      tui.destroy();
      process.exit(0);
    });

    return new Promise(() => {});
  } catch (error) {
    console.log(`\x1b[33m⚠ Advanced TUI failed: ${error.message}\x1b[0m`);
    console.log('\x1b[36m🔄 Falling back to simple mode...\x1b[0m');

    try {
      const simpleTui = new SimpleTUI();
      await simpleTui.initializePlugins();
      return new Promise(() => {});
    } catch (fallbackError) {
      throw new Error(`TUI failed: ${fallbackError.message}`);
    }
  }
}
