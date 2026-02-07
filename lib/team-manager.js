import fs from 'fs';
import path from 'path';
import os from 'os';
import { Agent } from './agent.js';

class TeamManager {
  constructor() {
    this.teamsDir = path.join(os.homedir(), '.opengrok', 'teams');
    this.ensureTeamsDir();
    this.currentTeam = null;
  }

  ensureTeamsDir() {
    if (!fs.existsSync(this.teamsDir)) {
      fs.mkdirSync(this.teamsDir, { recursive: true });
    }
  }

  createTeam(name) {
    this.currentTeam = {
      name,
      agents: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return this.currentTeam;
  }

  addAgent(agentConfig) {
    if (!this.currentTeam) {
      throw new Error('No team loaded. Create or load a team first.');
    }

    const agent = new Agent(agentConfig);
    agent.init();
    this.currentTeam.agents.push(agent);
    this.currentTeam.updatedAt = new Date().toISOString();
    return agent;
  }

  removeAgent(agentId) {
    if (!this.currentTeam) {
      throw new Error('No team loaded.');
    }

    const index = this.currentTeam.agents.findIndex(a => a.id === agentId);
    if (index === -1) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    const removed = this.currentTeam.agents.splice(index, 1)[0];
    this.currentTeam.updatedAt = new Date().toISOString();
    return removed;
  }

  saveTeam(name) {
    if (!this.currentTeam) {
      throw new Error('No team loaded.');
    }

    const teamName = name || this.currentTeam.name;
    const safeName = teamName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(this.teamsDir, `${safeName}.json`);

    const serialized = {
      name: teamName,
      createdAt: this.currentTeam.createdAt,
      updatedAt: new Date().toISOString(),
      agents: this.currentTeam.agents.map(agent => agent.toJSON())
    };

    fs.writeFileSync(filePath, JSON.stringify(serialized, null, 2));
    return filePath;
  }

  loadTeam(name) {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(this.teamsDir, `${safeName}.json`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Team "${name}" not found.`);
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    this.currentTeam = {
      name: data.name,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      agents: data.agents.map(agentData => {
        const agent = Agent.fromJSON(agentData);
        agent.init();
        return agent;
      })
    };

    return this.currentTeam;
  }

  listTeams() {
    this.ensureTeamsDir();
    const files = fs.readdirSync(this.teamsDir)
      .filter(f => f.endsWith('.json'));

    return files.map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(this.teamsDir, f), 'utf8'));
        return {
          name: data.name,
          fileName: f,
          agentCount: data.agents?.length || 0,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        };
      } catch (e) {
        return {
          name: f.replace('.json', ''),
          fileName: f,
          agentCount: 0,
          error: e.message
        };
      }
    });
  }

  deleteTeam(name) {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(this.teamsDir, `${safeName}.json`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Team "${name}" not found.`);
    }

    fs.unlinkSync(filePath);

    if (this.currentTeam && this.currentTeam.name === name) {
      this.currentTeam = null;
    }
  }

  getAgent(id) {
    if (!this.currentTeam) return null;
    return this.currentTeam.agents.find(a => a.id === id) || null;
  }

  getAgents() {
    if (!this.currentTeam) return [];
    return this.currentTeam.agents;
  }

  getTeamName() {
    return this.currentTeam?.name || '';
  }

  hasTeam() {
    return this.currentTeam !== null;
  }
}

export { TeamManager };
