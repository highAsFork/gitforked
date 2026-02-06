import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

class MCPTools {
  constructor() {
    this.configPath = path.join(os.homedir(), '.gitforked/mcp-servers.json');
    this.servers = this.loadServers();
  }

  loadServers() {
    try {
      if (fs.existsSync(this.configPath)) {
        return fs.readJsonSync(this.configPath);
      }
    } catch (error) {
      console.log(chalk.yellow + 'Warning: Could not load MCP servers config');
    }
    return {};
  }

  saveServers() {
    try {
      fs.ensureDirSync(path.dirname(this.configPath));
      fs.writeJsonSync(this.configPath, this.servers, { spaces: 2 });
    } catch (error) {
      console.log(chalk.red + 'Error: Could not save MCP servers config');
    }
  }

  async addServer(name, options) {
    const spinner = ora('Adding MCP server...').start();
    
    try {
      this.servers[name] = options;
      this.saveServers();
      spinner.stop();
      return `MCP server ${name} added successfully`;
    } catch (error) {
      spinner.stop();
      throw new Error(`Failed to add MCP server: ${error.message}`);
    }
  }

  async removeServer(name) {
    const spinner = ora('Removing MCP server...').start();
    
    try {
      if (this.servers[name]) {
        delete this.servers[name];
        this.saveServers();
        spinner.stop();
        return `MCP server ${name} removed successfully`;
      } else {
        spinner.stop();
        throw new Error(`MCP server ${name} not found`);
      }
    } catch (error) {
      spinner.stop();
      throw new Error(`Failed to remove MCP server: ${error.message}`);
    }
  }

  async listServers() {
    const spinner = ora('Listing MCP servers...').start();
    
    try {
      const serverList = Object.entries(this.servers).map(([name, config]) => {
        return `${name}: ${config.transport || 'stdio'} ${config.command || ''}`;
      });
      
      spinner.stop();
      return `MCP Servers:\n\n${serverList.join('\n')}`;
    } catch (error) {
      spinner.stop();
      throw new Error(`Failed to list MCP servers: ${error.message}`);
    }
  }

  async testServer(name) {
    const spinner = ora('Testing MCP server...').start();
    
    try {
      const server = this.servers[name];
      if (!server) {
        spinner.stop();
        throw new Error(`MCP server ${name} not found`);
      }
      
      // Simple test - try to start the server
      const command = `${server.command} ${server.args?.join(' ') || ''}`;
      exec(command, (error, stdout, stderr) => {
        spinner.stop();
        if (error) {
          throw new Error(`Server failed to start: ${error.message}`);
        }
        return `MCP server ${name} started successfully\n\n${stdout}`;
      });
    } catch (error) {
      spinner.stop();
      throw new Error(`Failed to test MCP server: ${error.message}`);
    }
  }

  async addLinearServer(apiKey) {
    const spinner = ora('Adding Linear MCP server...').start();
    
    try {
      const linearServer = {
        name: 'linear',
        transport: 'sse',
        url: 'https://mcp.linear.app/sse',
        env: {
          LINEAR_API_KEY: apiKey
        }
      };
      
      this.servers[linearServer.name] = linearServer;
      this.saveServers();
      spinner.stop();
      return `Linear MCP server added successfully`;
    } catch (error) {
      spinner.stop();
      throw new Error(`Failed to add Linear MCP server: ${error.message}`);
    }
  }

  async addGitHubServer(githubToken) {
    const spinner = ora('Adding GitHub MCP server...').start();
    
    try {
      const githubServer = {
        name: 'github',
        transport: 'stdio',
        command: 'npx',
        args: ['@github-copilot/mcp-server'],
        env: {
          GITHUB_TOKEN: githubToken
        }
      };
      
      this.servers[githubServer.name] = githubServer;
      this.saveServers();
      spinner.stop();
      return `GitHub MCP server added successfully`;
    } catch (error) {
      spinner.stop();
      throw new Error(`Failed to add GitHub MCP server: ${error.message}`);
    }
  }

  async addCustomServer(name, transport, command, args = [], env = {}) {
    const spinner = ora('Adding custom MCP server...').start();
    
    try {
      const customServer = {
        name,
        transport,
        command,
        args,
        env
      };
      
      this.servers[name] = customServer;
      this.saveServers();
      spinner.stop();
      return `Custom MCP server ${name} added successfully`;
    } catch (error) {
      spinner.stop();
      throw new Error(`Failed to add custom MCP server: ${error.message}`);
    }
  }

  async handleMCPCommand(command, args) {
    switch (command) {
      case 'add':
        const serverName = args[0];
        const transport = args[1];
        const cmd = args[2];
        const serverArgs = args.slice(3);
        
        if (!serverName || !transport || !cmd) {
          throw new Error('Usage: gitforked mcp add <name> <transport> <command> [args...]');
        }
        
        return await this.addCustomServer(serverName, transport, cmd, serverArgs);
      case 'remove':
        const removeName = args[0];
        if (!removeName) throw new Error('Server name is required');
        return await this.removeServer(removeName);
      case 'list':
        return await this.listServers();
      case 'test':
        const testName = args[0];
        if (!testName) throw new Error('Server name is required');
        return await this.testServer(testName);
      case 'linear':
        const linearKey = args[0];
        if (!linearKey) throw new Error('Linear API key is required');
        return await this.addLinearServer(linearKey);
      case 'github':
        const githubKey = args[0];
        if (!githubKey) throw new Error('GitHub token is required');
        return await this.addGitHubServer(githubKey);
      default:
        throw new Error(`Unknown MCP command: ${command}`);
    }
  }
}

// Export singleton instance
const mcpTools = new MCPTools();
export { mcpTools };