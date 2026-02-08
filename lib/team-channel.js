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
          includeHistory: false,
          safeMode: options.safeMode ?? true,
          onToolCall: (toolName, args) => {
            agent.status = 'tool';
            this.emit('agent-tool-call', agent, toolName, args);
          },
          onToolResult: (toolName, success) => {
            this.emit('agent-tool-result', agent, toolName, success);
          },
          onPermissionRequired: async (toolName, details) => {
            return true;
          }
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

    // Separate prior teammate responses from user messages
    const priorAgentResponses = recentMessages.filter(m => m.agentId !== null);
    const isFirstAgent = priorAgentResponses.length === 0;

    let contextStr = '== USER REQUEST ==\n';
    contextStr += `${userMessage}\n\n`;

    if (!isFirstAgent) {
      contextStr += '== TEAMMATE RESPONSES (read carefully — build on their work, don\'t repeat it) ==\n';
      for (const msg of recentMessages) {
        if (msg.agentId !== null) {
          contextStr += `--- ${msg.agentName} (${msg.role}) ---\n${msg.content}\n\n`;
        }
      }
    }

    contextStr += '== YOUR ASSIGNMENT ==\n';
    contextStr += `You are ${agent.name} (${agent.role}). `;

    if (isFirstAgent) {
      contextStr += `You go FIRST. The rest of the team will build on your plan. Read the codebase with your tools, then produce a detailed, actionable plan.\n`;
    } else {
      contextStr += `Your teammates above have already responded. Read what they produced, then execute YOUR part. Use your tools (read, write, edit, glob, grep, bash) to actually build/modify files. Do not repeat what teammates already did — build on it.\n`;
    }

    contextStr += `\nIMPORTANT: Use your tools to read existing files before writing. Produce complete, production-quality work. No stubs. No placeholders. No TODOs.\n`;

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
