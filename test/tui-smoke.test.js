import { expect } from 'chai';
import blessed from 'blessed';

// Test the TUI components headlessly by creating a blessed screen with a fake terminal
function createTestScreen() {
  const screen = blessed.screen({
    smartCSR: true,
    input: process.stdin,
    output: process.stdout,
    terminal: 'xterm-256color',
    fullUnicode: true,
    forceUnicode: true,
    // Run headless
    buffer: true
  });
  // Override columns/rows
  screen.program.cols = 120;
  screen.program.rows = 40;
  return screen;
}

describe('TUI Smoke Tests', function() {
  this.timeout(10000);
  let screen;

  afterEach(function() {
    if (screen) {
      try { screen.destroy(); } catch (e) {}
      screen = null;
    }
  });

  describe('AgentSidebar', function() {
    it('should create without crashing', async function() {
      screen = createTestScreen();
      const { AgentSidebar } = await import('../ui/components/agent-sidebar.js');
      const sidebar = new AgentSidebar(screen, {
        top: 3, left: 0, width: '20%', height: '100%-7'
      });
      expect(sidebar).to.exist;
      expect(sidebar.box).to.exist;
    });

    it('should update agent list', async function() {
      screen = createTestScreen();
      const { AgentSidebar } = await import('../ui/components/agent-sidebar.js');
      const sidebar = new AgentSidebar(screen, {
        top: 3, left: 0, width: '20%', height: '100%-7'
      });
      sidebar.updateAgentList([
        { id: '1', name: 'Bot1', role: 'Tester', status: 'idle' },
        { id: '2', name: 'Bot2', role: 'Reviewer', status: 'thinking' },
        { id: '3', name: 'Bot3', role: 'Security', status: 'error' }
      ]);
      // Should have: team channel + 3 agents (2 lines each) + add button = 8 items
      expect(sidebar.agents.length).to.equal(3);
    });
  });

  describe('TeamSetupDialog', function() {
    it('should create without crashing', async function() {
      screen = createTestScreen();
      const { TeamManager } = await import('../lib/team-manager.js');
      const { TeamSetupDialog } = await import('../ui/dialogs/team-setup-dialog.js');
      const tm = new TeamManager();
      const dialog = new TeamSetupDialog(screen, tm);
      expect(dialog).to.exist;
      expect(dialog.overlay).to.exist;
    });

    it('should show and hide without crashing', async function() {
      screen = createTestScreen();
      const { TeamManager } = await import('../lib/team-manager.js');
      const { TeamSetupDialog } = await import('../ui/dialogs/team-setup-dialog.js');
      const tm = new TeamManager();
      const dialog = new TeamSetupDialog(screen, tm);

      dialog.show();
      expect(dialog.isVisible()).to.be.true;
      screen.render();

      dialog.hide();
      expect(dialog.isVisible()).to.be.false;
    });
  });

  describe('AgentConfigDialog', function() {
    it('should create without crashing', async function() {
      screen = createTestScreen();
      const { AgentConfigDialog } = await import('../ui/dialogs/agent-config-dialog.js');
      const dialog = new AgentConfigDialog(screen);
      expect(dialog).to.exist;
      expect(dialog.overlay).to.exist;
    });

    it('should show and render step 0 without crashing', async function() {
      screen = createTestScreen();
      const { AgentConfigDialog } = await import('../ui/dialogs/agent-config-dialog.js');
      const dialog = new AgentConfigDialog(screen);

      dialog.show();
      expect(dialog.isVisible()).to.be.true;
      expect(dialog.step).to.equal(0);
      screen.render();
    });

    it('should advance through all steps without crashing', async function() {
      screen = createTestScreen();
      const { AgentConfigDialog } = await import('../ui/dialogs/agent-config-dialog.js');
      const dialog = new AgentConfigDialog(screen);

      dialog.show();
      screen.render();

      // Step 0 -> 1: submit name
      dialog.handleTextSubmit('TestBot');
      expect(dialog.step).to.equal(1);
      expect(dialog.fields.name).to.equal('TestBot');
      screen.render();

      // Step 1 -> 2: submit role
      dialog.handleTextSubmit('Tester');
      expect(dialog.step).to.equal(2);
      expect(dialog.fields.role).to.equal('Tester');
      screen.render();

      // Step 2 -> 3: select provider
      dialog.handleListSelect(0); // grok
      expect(dialog.step).to.equal(3);
      expect(dialog.fields.provider).to.equal('grok');
      screen.render();

      // Step 3 -> 4: select model
      dialog.handleListSelect(0); // first model
      expect(dialog.step).to.equal(4);
      expect(dialog.fields.model).to.equal('grok-4-1-fast-reasoning');
      screen.render();

      // Step 4 -> 5: submit prompt (empty = default)
      dialog.handleTextSubmit('');
      expect(dialog.step).to.equal(5);
      screen.render();
    });

    it('should emit add-agent on save', async function() {
      screen = createTestScreen();
      const { AgentConfigDialog } = await import('../ui/dialogs/agent-config-dialog.js');
      const dialog = new AgentConfigDialog(screen);

      let emittedConfig = null;
      dialog.on('add-agent', (cfg) => { emittedConfig = cfg; });

      dialog.show();
      dialog.handleTextSubmit('TestBot');
      dialog.handleTextSubmit('Tester');
      dialog.handleListSelect(0); // grok
      dialog.handleListSelect(0); // first model
      dialog.handleTextSubmit(''); // default prompt
      dialog.handleListSelect(0); // confirm: Save

      expect(emittedConfig).to.not.be.null;
      expect(emittedConfig.name).to.equal('TestBot');
      expect(emittedConfig.role).to.equal('Tester');
      expect(emittedConfig.provider).to.equal('grok');
    });

    it('should handle back navigation', async function() {
      screen = createTestScreen();
      const { AgentConfigDialog } = await import('../ui/dialogs/agent-config-dialog.js');
      const dialog = new AgentConfigDialog(screen);

      dialog.show();
      dialog.handleTextSubmit('TestBot');
      expect(dialog.step).to.equal(1);

      dialog.handleBack();
      expect(dialog.step).to.equal(0);
      screen.render();

      // Back from step 0 should hide
      let closed = false;
      dialog.on('closed', () => { closed = true; });
      dialog.handleBack();
      expect(closed).to.be.true;
    });

    it('should handle editing existing agent', async function() {
      screen = createTestScreen();
      const { AgentConfigDialog } = await import('../ui/dialogs/agent-config-dialog.js');
      const dialog = new AgentConfigDialog(screen);

      let emittedConfig = null;
      dialog.on('edit-agent', (cfg) => { emittedConfig = cfg; });

      dialog.show({
        id: 'test-id',
        name: 'ExistingBot',
        role: 'OldRole',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        systemPrompt: 'Old prompt'
      });

      expect(dialog.fields.name).to.equal('ExistingBot');
      expect(dialog.editingAgent).to.not.be.null;
      screen.render();
    });
  });

  describe('Full AgentTeamsTUI creation', function() {
    it('should import without crashing', async function() {
      const mod = await import('../ui/agent-teams-tui.js');
      expect(mod.runAgentTeamsTUI).to.be.a('function');
    });
  });
});
