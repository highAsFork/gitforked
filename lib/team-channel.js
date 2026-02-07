import { EventEmitter } from 'events';

class TeamChannel extends EventEmitter {
  constructor(teamManager) {
    super();
    this.teamManager = teamManager;
    this.sharedMessages = [];
    this.maxContextMessages = 50;
  }

  async broadcastToAll(userMessage, options = {}) {
    const agents = this.teamManager.getAgents();
    if (agents.length === 0) {
      throw new Error('No agents in team. Add agents first.');
    }

    // Append user message to shared history
    this.sharedMessages.push({
      agentId: null,
      agentName: null,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    });

    const responses = [];

    // Sequential dispatch - each agent sees prior agent responses
    for (const agent of agents) {
      try {
        this.emit('agent-thinking', agent);
        agent.status = 'thinking';

        // Build context prompt with all shared messages so far
        const contextPrompt = this.buildContextPrompt(userMessage, agent);

        const response = await agent.sendMessage(contextPrompt, {
          directory: options.directory || process.cwd(),
          mode: options.mode || 'build',
          includeHistory: false
        });

        // Append agent response to shared history
        this.sharedMessages.push({
          agentId: agent.id,
          agentName: agent.name,
          role: agent.role,
          content: response,
          timestamp: new Date().toISOString()
        });

        agent.status = 'idle';
        this.emit('agent-responded', agent, response);
        responses.push({ agent, response });

      } catch (error) {
        agent.status = 'error';
        const errorMsg = `Error: ${error.message}`;

        this.sharedMessages.push({
          agentId: agent.id,
          agentName: agent.name,
          role: agent.role,
          content: errorMsg,
          timestamp: new Date().toISOString()
        });

        this.emit('agent-error', agent, error);
        responses.push({ agent, response: errorMsg, error });
      }
    }

    return responses;
  }

  buildContextPrompt(userMessage, agent) {
    // Get recent shared messages for context (up to maxContextMessages)
    const recentMessages = this.sharedMessages.slice(-this.maxContextMessages);

    let contextStr = '== Team Collaboration Context ==\n';

    for (const msg of recentMessages) {
      if (msg.agentId === null) {
        contextStr += `[You]: ${msg.content}\n`;
      } else {
        contextStr += `[${msg.agentName} (${msg.role})]: ${msg.content}\n`;
      }
    }

    contextStr += `== Your Task ==\n`;
    contextStr += `As ${agent.name} (${agent.role}), provide your perspective on: ${userMessage}\n`;

    return contextStr;
  }

  getSharedMessages() {
    return [...this.sharedMessages];
  }

  clearHistory() {
    this.sharedMessages = [];
  }
}

export { TeamChannel };
