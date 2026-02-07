import { expect } from 'chai';
import { Agent } from '../lib/agent.js';

describe('Agent', function() {
  this.timeout(5000);

  describe('Constructor', function() {
    it('should create an agent with required fields', function() {
      const agent = new Agent({
        name: 'TestBot',
        role: 'Tester',
        provider: 'grok',
        model: 'grok-3-mini-fast'
      });

      expect(agent.name).to.equal('TestBot');
      expect(agent.role).to.equal('Tester');
      expect(agent.provider).to.equal('grok');
      expect(agent.model).to.equal('grok-3-mini-fast');
      expect(agent.id).to.be.a('string');
      expect(agent.id.length).to.be.greaterThan(0);
      expect(agent.messages).to.be.an('array').that.is.empty;
      expect(agent.status).to.equal('idle');
    });

    it('should generate a unique ID when not provided', function() {
      const agent1 = new Agent({ name: 'Bot1' });
      const agent2 = new Agent({ name: 'Bot2' });
      expect(agent1.id).to.not.equal(agent2.id);
    });

    it('should use provided ID when given', function() {
      const agent = new Agent({ id: 'custom-id', name: 'Bot' });
      expect(agent.id).to.equal('custom-id');
    });

    it('should default to idle status', function() {
      const agent = new Agent({ name: 'Bot' });
      expect(agent.status).to.equal('idle');
    });
  });

  describe('toJSON / fromJSON', function() {
    it('should serialize agent config to JSON', function() {
      const agent = new Agent({
        id: 'test-123',
        name: 'ReviewBot',
        role: 'Code Reviewer',
        systemPrompt: 'You review code.',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile'
      });

      const json = agent.toJSON();
      expect(json).to.deep.equal({
        id: 'test-123',
        name: 'ReviewBot',
        role: 'Code Reviewer',
        systemPrompt: 'You review code.',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        apiKey: '__config__',
        ollamaBaseUrl: null
      });
    });

    it('should not include messages or GrokAPI instance in JSON', function() {
      const agent = new Agent({ name: 'Bot' });
      agent.messages.push({ role: 'user', content: 'test' });
      const json = agent.toJSON();
      expect(json).to.not.have.property('messages');
      expect(json).to.not.have.property('grokAPI');
      expect(json).to.not.have.property('status');
    });

    it('should reconstruct agent from JSON', function() {
      const original = new Agent({
        id: 'test-456',
        name: 'SecBot',
        role: 'Security',
        systemPrompt: 'You find vulnerabilities.',
        provider: 'claude',
        model: 'claude-opus-4-6'
      });

      const json = original.toJSON();
      const restored = Agent.fromJSON(json);

      expect(restored.id).to.equal('test-456');
      expect(restored.name).to.equal('SecBot');
      expect(restored.role).to.equal('Security');
      expect(restored.systemPrompt).to.equal('You find vulnerabilities.');
      expect(restored.provider).to.equal('claude');
      expect(restored.model).to.equal('claude-opus-4-6');
      expect(restored.apiKey).to.be.null; // __config__ resolves to null
      expect(restored.messages).to.be.an('array').that.is.empty;
    });

    it('should preserve explicit API key through serialization', function() {
      const agent = new Agent({
        name: 'Bot',
        apiKey: 'sk-explicit-key'
      });

      const json = agent.toJSON();
      expect(json.apiKey).to.equal('sk-explicit-key');

      const restored = Agent.fromJSON(json);
      expect(restored.apiKey).to.equal('sk-explicit-key');
    });
  });

  describe('init', function() {
    it('should create a GrokAPI instance after init', function() {
      const agent = new Agent({
        name: 'Bot',
        provider: 'grok',
        model: 'grok-3-mini-fast'
      });

      expect(agent.grokAPI).to.be.null;
      agent.init();
      expect(agent.grokAPI).to.not.be.null;
    });

    it('should return self for chaining', function() {
      const agent = new Agent({ name: 'Bot', provider: 'grok' });
      const result = agent.init();
      expect(result).to.equal(agent);
    });
  });

  describe('clearHistory', function() {
    it('should clear the message history', function() {
      const agent = new Agent({ name: 'Bot' });
      agent.messages.push({ role: 'user', content: 'hello' });
      agent.messages.push({ role: 'assistant', content: 'hi' });
      expect(agent.messages.length).to.equal(2);

      agent.clearHistory();
      expect(agent.messages).to.be.an('array').that.is.empty;
    });
  });

  describe('injectContext', function() {
    it('should format shared messages into context string', function() {
      const agent = new Agent({ name: 'Bot' });
      const sharedMessages = [
        { agentName: null, role: 'user', content: 'Review this code' },
        { agentName: 'ReviewBot', role: 'Code Reviewer', content: 'Looks good.' },
        { agentName: 'SecBot', role: 'Security', content: 'Found an issue.' }
      ];

      const context = agent.injectContext(sharedMessages);
      expect(context).to.include('== Team Collaboration Context ==');
      expect(context).to.include('[You]: Review this code');
      expect(context).to.include('[ReviewBot (Code Reviewer)]: Looks good.');
      expect(context).to.include('[SecBot (Security)]: Found an issue.');
    });
  });
});
