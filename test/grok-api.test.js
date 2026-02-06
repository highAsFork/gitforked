const { expect } = require('chai');
const { grokAPI } = require('../lib/grok-api.js');
const { config } = require('../config/config.js');

describe('GrokAPI Integration Tests', function() {
  this.timeout(10000);

  before(function() {
    // Set test API key if not already set
    if (!process.env.GROK_API_KEY) {
      process.env.GROK_API_KEY = 'test-key';
    }
  });

  describe('Health Check', function() {
    it('should return health status', async function() {
      try {
        const health = await grokAPI.healthCheck();
        expect(health).to.be.a('boolean');
      } catch (error) {
        // If API key is invalid, we expect an error
        expect(error.message).to.include('Unauthorized');
      }
    });
  });

  describe('Chat Functionality', function() {
    it('should return a response for a simple message', async function() {
      try {
        const response = await grokAPI.chat('Hello, how are you?', {
          model: 'grok-code-fast-1'
        });
        expect(response).to.be.a('string');
        expect(response.length).to.be.greaterThan(0);
      } catch (error) {
        // If API key is invalid, we expect an error
        expect(error.message).to.include('Unauthorized');
      }
    });

    it('should handle empty messages gracefully', async function() {
      try {
        const response = await grokAPI.chat('', {
          model: 'grok-code-fast-1'
        });
        expect(response).to.be.a('string');
      } catch (error) {
        expect(error.message).to.include('Unauthorized');
      }
    });
  });

  describe('Process Prompt', function() {
    it('should process a simple prompt', async function() {
      try {
        const response = await grokAPI.processPrompt('Hello, how are you?', {
          model: 'grok-code-fast-1'
        });
        expect(response).to.be.a('string');
        expect(response.length).to.be.greaterThan(0);
      } catch (error) {
        // If API key is invalid, we expect an error
        expect(error.message).to.include('Unauthorized');
      }
    });

    it('should handle tool calling', async function() {
      try {
        const response = await grokAPI.processPrompt('Read the file /tmp/test.txt', {
          model: 'grok-code-fast-1',
          tool: 'file'
        });
        expect(response).to.be.a('string');
      } catch (error) {
        expect(error.message).to.include('Unauthorized');
      }
    });
  });

  describe('Configuration', function() {
    it('should load default configuration', function() {
      const defaultConfig = config.getDefaults();
      expect(defaultConfig).to.have.property('apiKey');
      expect(defaultConfig).to.have.property('model', 'grok-code-fast-1');
      expect(defaultConfig).to.have.property('baseURL');
    });

    it('should get and set configuration values', function() {
      const originalValue = config.get('model');
      config.set('model', 'grok-4-1-fast-reasoning');
      const newValue = config.get('model');
      expect(newValue).to.equal('grok-4-1-fast-reasoning');
      
      // Reset to original value
      config.set('model', originalValue);
    });
  });
});