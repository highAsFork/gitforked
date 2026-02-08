import { expect } from 'chai';
import { TeamChannel } from '../lib/team-channel.js';
import { TeamManager } from '../lib/team-manager.js';

describe('TeamChannel', function() {
  this.timeout(5000);
  let tm;
  let channel;

  beforeEach(function() {
    tm = new TeamManager();
    tm.createTeam('test-channel-team');
    channel = new TeamChannel(tm);
  });

  describe('Constructor', function() {
    it('should initialize with empty shared messages', function() {
      expect(channel.sharedMessages).to.be.an('array').that.is.empty;
    });

    it('should reference the team manager', function() {
      expect(channel.teamManager).to.equal(tm);
    });

    it('should have a max context messages limit', function() {
      expect(channel.maxContextMessages).to.be.a('number');
      expect(channel.maxContextMessages).to.be.greaterThan(0);
    });
  });

  describe('broadcastToAll', function() {
    it('should throw when no agents are in the team', async function() {
      try {
        await channel.broadcastToAll('Hello');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).to.include('No agents');
      }
    });
  });

  describe('buildContextPrompt', function() {
    it('should build a context prompt with shared messages', function() {
      // Manually add messages to shared history
      channel.sharedMessages.push({
        agentId: null,
        agentName: null,
        role: 'user',
        content: 'Review this code',
        timestamp: new Date().toISOString()
      });
      channel.sharedMessages.push({
        agentId: 'agent-1',
        agentName: 'ReviewBot',
        role: 'Code Reviewer',
        content: 'The code looks good.',
        timestamp: new Date().toISOString()
      });

      const mockAgent = { id: 'agent-2', name: 'SecBot', role: 'Security' };
      const prompt = channel.buildContextPrompt('Review this code', mockAgent);

      expect(prompt).to.include('== USER REQUEST ==');
      expect(prompt).to.include('Review this code');
      expect(prompt).to.include('== TEAMMATE RESPONSES');
      expect(prompt).to.include('ReviewBot (Code Reviewer)');
      expect(prompt).to.include('The code looks good.');
      expect(prompt).to.include('== YOUR ASSIGNMENT ==');
      expect(prompt).to.include('You are SecBot (Security)');
    });

    it('should handle empty shared messages', function() {
      const mockAgent = { name: 'Bot', role: 'Helper' };
      const prompt = channel.buildContextPrompt('Hello', mockAgent);

      expect(prompt).to.include('== USER REQUEST ==');
      expect(prompt).to.include('Hello');
      expect(prompt).to.include('== YOUR ASSIGNMENT ==');
      expect(prompt).to.include('You are Bot (Helper)');
      expect(prompt).to.include('You go FIRST');
    });
  });

  describe('getSharedMessages', function() {
    it('should return a copy of shared messages', function() {
      channel.sharedMessages.push({
        agentId: null,
        agentName: null,
        role: 'user',
        content: 'test',
        timestamp: new Date().toISOString()
      });

      const messages = channel.getSharedMessages();
      expect(messages).to.have.length(1);
      expect(messages).to.not.equal(channel.sharedMessages); // Should be a copy
    });
  });

  describe('clearHistory', function() {
    it('should clear shared messages', function() {
      channel.sharedMessages.push({
        agentId: null,
        agentName: null,
        role: 'user',
        content: 'test',
        timestamp: new Date().toISOString()
      });

      expect(channel.sharedMessages.length).to.equal(1);
      channel.clearHistory();
      expect(channel.sharedMessages.length).to.equal(0);
    });
  });

  describe('Events', function() {
    it('should be an EventEmitter', function() {
      expect(channel.on).to.be.a('function');
      expect(channel.emit).to.be.a('function');
      expect(channel.removeAllListeners).to.be.a('function');
    });

    it('should emit events when registered', function(done) {
      channel.on('test-event', (data) => {
        expect(data).to.equal('hello');
        done();
      });
      channel.emit('test-event', 'hello');
    });
  });
});
