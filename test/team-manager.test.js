import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { TeamManager } from '../lib/team-manager.js';

describe('TeamManager', function() {
  this.timeout(5000);
  let tm;
  const testTeamName = `__test_team_${Date.now()}`;

  beforeEach(function() {
    tm = new TeamManager();
  });

  afterEach(function() {
    // Clean up test team files
    try {
      const filePath = path.join(os.homedir(), '.opengrok', 'teams', `${testTeamName}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Constructor', function() {
    it('should create teams directory if not exists', function() {
      const teamsDir = path.join(os.homedir(), '.opengrok', 'teams');
      expect(fs.existsSync(teamsDir)).to.be.true;
    });

    it('should start with no current team', function() {
      expect(tm.hasTeam()).to.be.false;
      expect(tm.currentTeam).to.be.null;
    });
  });

  describe('createTeam', function() {
    it('should create a new team', function() {
      const team = tm.createTeam(testTeamName);
      expect(team.name).to.equal(testTeamName);
      expect(team.agents).to.be.an('array').that.is.empty;
      expect(team.createdAt).to.be.a('string');
      expect(tm.hasTeam()).to.be.true;
    });

    it('should set the new team as current', function() {
      tm.createTeam(testTeamName);
      expect(tm.getTeamName()).to.equal(testTeamName);
    });
  });

  describe('addAgent', function() {
    it('should throw if no team loaded', function() {
      expect(() => tm.addAgent({ name: 'Bot' })).to.throw('No team loaded');
    });

    it('should add an agent to the current team', function() {
      tm.createTeam(testTeamName);
      const agent = tm.addAgent({
        name: 'ReviewBot',
        role: 'Code Reviewer',
        provider: 'grok',
        model: 'grok-3-mini-fast'
      });

      expect(agent.name).to.equal('ReviewBot');
      expect(tm.getAgents().length).to.equal(1);
    });

    it('should add multiple agents', function() {
      tm.createTeam(testTeamName);
      tm.addAgent({ name: 'Bot1', provider: 'grok', model: 'grok-3-mini-fast' });
      tm.addAgent({ name: 'Bot2', provider: 'groq', model: 'llama-3.1-8b-instant' });
      expect(tm.getAgents().length).to.equal(2);
    });
  });

  describe('removeAgent', function() {
    it('should throw if no team loaded', function() {
      expect(() => tm.removeAgent('some-id')).to.throw('No team loaded');
    });

    it('should remove an agent by ID', function() {
      tm.createTeam(testTeamName);
      const agent = tm.addAgent({ name: 'Bot', provider: 'grok', model: 'grok-3-mini-fast' });
      expect(tm.getAgents().length).to.equal(1);

      tm.removeAgent(agent.id);
      expect(tm.getAgents().length).to.equal(0);
    });

    it('should throw for unknown agent ID', function() {
      tm.createTeam(testTeamName);
      expect(() => tm.removeAgent('nonexistent')).to.throw('not found');
    });
  });

  describe('saveTeam / loadTeam', function() {
    it('should throw if no team to save', function() {
      expect(() => tm.saveTeam()).to.throw('No team loaded');
    });

    it('should save team to disk', function() {
      tm.createTeam(testTeamName);
      tm.addAgent({ name: 'Bot1', role: 'Tester', provider: 'grok', model: 'grok-3-mini-fast' });
      const filePath = tm.saveTeam();

      expect(fs.existsSync(filePath)).to.be.true;
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(data.name).to.equal(testTeamName);
      expect(data.agents).to.have.length(1);
      expect(data.agents[0].name).to.equal('Bot1');
    });

    it('should load team from disk', function() {
      tm.createTeam(testTeamName);
      tm.addAgent({ name: 'Bot1', role: 'Tester', provider: 'grok', model: 'grok-3-mini-fast' });
      tm.addAgent({ name: 'Bot2', role: 'Reviewer', provider: 'groq', model: 'llama-3.1-8b-instant' });
      tm.saveTeam();

      // Load in a new TeamManager
      const tm2 = new TeamManager();
      const team = tm2.loadTeam(testTeamName);

      expect(team.name).to.equal(testTeamName);
      expect(tm2.getAgents().length).to.equal(2);
      expect(tm2.getAgents()[0].name).to.equal('Bot1');
      expect(tm2.getAgents()[1].name).to.equal('Bot2');
    });

    it('should throw for nonexistent team', function() {
      expect(() => tm.loadTeam('nonexistent_team_xyz')).to.throw('not found');
    });

    it('should use __config__ sentinel for API keys by default', function() {
      tm.createTeam(testTeamName);
      tm.addAgent({ name: 'Bot', provider: 'grok', model: 'grok-3-mini-fast' });
      const filePath = tm.saveTeam();

      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(data.agents[0].apiKey).to.equal('__config__');
    });
  });

  describe('listTeams', function() {
    it('should list saved teams', function() {
      tm.createTeam(testTeamName);
      tm.addAgent({ name: 'Bot', provider: 'grok', model: 'grok-3-mini-fast' });
      tm.saveTeam();

      const teams = tm.listTeams();
      const found = teams.find(t => t.name === testTeamName);
      expect(found).to.not.be.undefined;
      expect(found.agentCount).to.equal(1);
    });
  });

  describe('deleteTeam', function() {
    it('should delete a saved team', function() {
      tm.createTeam(testTeamName);
      tm.saveTeam();

      tm.deleteTeam(testTeamName);
      const filePath = path.join(os.homedir(), '.opengrok', 'teams', `${testTeamName}.json`);
      expect(fs.existsSync(filePath)).to.be.false;
    });

    it('should throw for nonexistent team', function() {
      expect(() => tm.deleteTeam('nonexistent_team_xyz')).to.throw('not found');
    });

    it('should clear current team if it was the deleted one', function() {
      tm.createTeam(testTeamName);
      tm.saveTeam();
      expect(tm.hasTeam()).to.be.true;

      tm.deleteTeam(testTeamName);
      expect(tm.hasTeam()).to.be.false;
    });
  });

  describe('getAgent', function() {
    it('should find agent by ID', function() {
      tm.createTeam(testTeamName);
      const agent = tm.addAgent({ name: 'FindMe', provider: 'grok', model: 'grok-3-mini-fast' });
      const found = tm.getAgent(agent.id);
      expect(found).to.not.be.null;
      expect(found.name).to.equal('FindMe');
    });

    it('should return null for unknown ID', function() {
      tm.createTeam(testTeamName);
      expect(tm.getAgent('nonexistent')).to.be.null;
    });

    it('should return null when no team loaded', function() {
      expect(tm.getAgent('some-id')).to.be.null;
    });
  });
});
