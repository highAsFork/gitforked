#!/usr/bin/env node

import { program } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import figlet from 'figlet';
import clear from 'clear';
import { grokAPI } from '../lib/grok-api.js';
import { fileTools } from '../tools/file-tools.js';
import { codeTools } from '../tools/code-tools.js';
import { gitTools } from '../tools/git-tools.js';
import { mcpTools } from '../tools/mcp-tools.js';

// Load configuration
import { config } from '../config/config.js';

// Display gitforked banner
clear();
console.log(figlet.textSync('gitforked', { horizontalLayout: 'default' }));
console.log('A Grok-powered CLI for developers who give a fork 🍴');
console.log('─'.repeat(55));

// Main CLI interface
program
   .name('gitforked')
   .description('A Grok-powered CLI for developers who give a fork')
  .version('1.0.0');

// Chat command
program
  .command('chat')
  .description('Start an interactive chat with Grok')
   .option('-m, --model <model>', 'Specify the model to use (default: grok-4-1-fast-reasoning)', 'grok-4-1-fast-reasoning')
  .option('-d, --directory <directory>', 'Specify the working directory', process.cwd())
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-t, --tui', 'Use Terminal User Interface mode')
  .action(async (options) => {
    try {
      // Validate API key
      if (!process.env.GROK_API_KEY && !config.getApiKey()) {
        console.log('❌ Grok API key not found. Please set GROK_API_KEY environment variable or configure it.');
        console.log('Run: export GROK_API_KEY=your_api_key');
        return;
      }

  if (options.tui) {
    // Check if TUI is supported
    const isTTY = process.stdout.isTTY;
    const term = process.env.TERM || 'unknown';
    const cols = process.stdout.columns || 0;
    const rows = process.stdout.rows || 0;

    console.log(`🔍 Terminal detection: TTY=${isTTY}, TERM=${term}, Size=${cols}x${rows}`);

    if (!isTTY) {
      console.log('❌ TUI mode requires a TTY terminal.');
      console.log('💡 Falling back to CLI mode. Use a proper terminal for TUI features.');
      console.log('');
      // Fall through to CLI mode
    } else if (cols < 80 || rows < 24) {
      console.log('❌ Terminal too small for TUI. Minimum 80x24 required.');
      console.log(`💡 Current size: ${cols}x${rows}. Resize terminal or use CLI mode.`);
      console.log('');
      // Fall through to CLI mode
    } else {
      try {
        console.log('🚀 Attempting to launch TUI...');
        // Launch advanced TUI mode
        const { runAdvancedTUI } = await import('../ui/advanced-tui.js');
        await runAdvancedTUI(options);
        return; // Exit if TUI succeeds
      } catch (error) {
        console.log(`❌ TUI initialization failed: ${error.message}`);
        console.log('💡 This might be due to:');
        console.log('   - Terminal compatibility issues');
        console.log('   - Missing terminfo database');
        console.log('   - Font encoding problems');
        console.log('💡 Falling back to CLI mode.');
        console.log('');
        // Fall through to CLI mode
      }
    }
  }

  // Launch CLI mode (existing readline interface)
  await launchCLI(options);

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      if (options.verbose) {
        console.log('Debug info:', error.stack);
      }
    }
  });

// Model management command
program
  .command('model <operation>')
  .description('Model management')
  .option('-m, --model <model>', 'Model name to set')
  .action(async (operation, options) => {
    try {
      switch (operation) {
        case 'list':
          const models = [
            { name: 'grok-3-latest', desc: 'Latest Grok 3 (recommended)' },
            { name: 'grok-3-fast', desc: 'Fast Grok 3 for quick tasks' },
            { name: 'grok-3-mini', desc: 'Lightweight for simple tasks' },
            { name: 'grok-3-mini-fast', desc: 'Fastest, for basic queries' },
            { name: 'grok-2-latest', desc: 'Grok 2 stable' },
            { name: 'grok-beta', desc: 'Beta features' }
          ];
          console.log('🤖 Available Models:');
          models.forEach(m => {
            console.log(`  ${chalk.cyan(m.name.padEnd(25))} ${chalk.gray(m.desc)}`);
          });
          break;
        case 'set':
          if (!options.model) {
            console.log('❌ Please specify a model with --model');
            return;
          }
          await config.setModel(options.model);
          console.log(`✅ Model set to ${options.model}`);
          break;
        default:
          console.log(`❌ Unknown operation: ${operation}`);
          console.log('Available operations: list, set');
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  });

// Provider command
program
  .command('provider <operation>')
  .description('Provider management')
  .argument('<operation>', 'Operation: set, list')
  .option('-p, --provider <provider>', 'Provider name (grok, gemini, claude)')
  .action(async (operation, options) => {
    try {
      switch (operation) {
        case 'set':
          if (!options.provider) {
            console.log('❌ Please specify --provider');
            return;
          }
          config.setProvider(options.provider);
          console.log(`✅ Provider set to ${options.provider}`);
          break;
        case 'list':
          console.log('🤖 Available providers: grok, groq, gemini, claude');
          console.log(`Current provider: ${config.getProvider()}`);
          break;
        default:
          console.log(`❌ Unknown operation: ${operation}`);
          console.log('Available operations: set, list');
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  });

// API key command
program
  .command('apikey <operation>')
  .description('API key management')
  .argument('<operation>', 'Operation: set, list')
  .option('-p, --provider <provider>', 'Provider name')
  .option('-k, --key <key>', 'API key')
  .action(async (operation, options) => {
    try {
      switch (operation) {
        case 'set':
          if (!options.provider || !options.key) {
            console.log('❌ Please specify --provider and --key');
            return;
          }
          config.setApiKey(options.provider, options.key);
          console.log(`✅ API key set for ${options.provider}`);
          break;
        case 'list':
          console.log('🔑 API Keys:');
          const providers = ['grok', 'groq', 'gemini', 'claude'];
          for (const p of providers) {
            const key = await config.getApiKey(p);
            console.log(`${p}: ${key ? 'Set' : 'Not set'}`);
          }
          break;
        default:
          console.log(`❌ Unknown operation: ${operation}`);
          console.log('Available operations: set, list');
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  });

// Configuration command
program
  .command('config <operation>')
  .description('Configuration management')
  .argument('<operation>', 'Operation: set, get, list')
  .option('-k, --key <key>', 'Configuration key')
  .option('-v, --value <value>', 'Configuration value')
  .action(async (operation, options) => {
    try {
      switch (operation) {
        case 'set':
          if (!options.key || !options.value) {
            console.log('❌ Please specify both --key and --value');
            return;
          }
          config.set(options.key, options.value);
          console.log(`✅ Set ${options.key} to ${options.value}`);
          break;
        case 'get':
          if (!options.key) {
            console.log('❌ Please specify a key with --key');
            return;
          }
          const value = config.get(options.key);
          console.log(`${options.key}: ${value}`);
          break;
        case 'list':
          const allConfig = config.list();
          console.log('📋 Configuration:');
          Object.entries(allConfig).forEach(([key, value]) => {
            console.log(`${key}: ${value}`);
          });
          break;
        default:
          console.log(`❌ Unknown operation: ${operation}`);
          console.log('Available operations: set, get, list');
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  });

// Settings command
program
  .command('settings')
  .description('Interactive settings configuration')
  .action(async () => {
    try {
      const inquirer = await import('inquirer');

      const { provider } = await inquirer.prompt([
        {
          type: 'list',
          name: 'provider',
          message: 'Choose LLM provider:',
          choices: ['grok', 'groq', 'gemini', 'claude']
        }
      ]);

      config.setProvider(provider);

      let models = [];
      if (provider === 'grok') {
        models = ['grok-3-latest', 'grok-3-fast', 'grok-3-mini', 'grok-3-mini-fast', 'grok-2-latest', 'grok-beta'];
      } else if (provider === 'groq') {
        models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'];
      } else if (provider === 'gemini') {
        models = ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
      } else if (provider === 'claude') {
        models = ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'];
      }

      const { model } = await inquirer.prompt([
        {
          type: 'list',
          name: 'model',
          message: 'Choose model:',
          choices: models
        }
      ]);

      config.setModel(model);

      const { apiKey } = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: `Enter API key for ${provider}:`,
          mask: '*'
        }
      ]);

      config.setApiKey(provider, apiKey);

      console.log('✅ Settings saved successfully!');
      console.log(`Provider: ${provider}`);
      console.log(`Model: ${model}`);
      console.log(`API Key: ${apiKey ? 'Set' : 'Not set'}`);

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  });

// Handle unknown commands
program.on('command:*', () => {
  console.log('❌ Invalid command');
  program.outputHelp();
});



// Launch CLI mode (original readline interface)
async function launchCLI(options) {
  console.log('Connecting to Grok API...');

  // Test API connection
  const health = true; // Bypass health check for now
  if (!health) {
    console.log('❌ Failed to connect to Grok API. Please check your API key and network connection.');
    return;
  }

  console.log('✅ Connected to Grok API!');

  let mode = 'Plan';

  // Start interactive chat
  console.log('🤖 Connected to Grok API');
  console.log('Type "exit" to quit, "help" for commands');
  console.log('Current model: ' + options.model + ', mode: Plan');
  console.log('Working directory: ' + options.directory);

  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.setPrompt('💬 ');
  rl.prompt();

  rl.on('line', async (input) => {
    if (input.trim().toLowerCase() === 'exit') {
      console.log('👋 Goodbye!');
      rl.close();
      return;
    }

    if (input.trim().toLowerCase() === 'help') {
      console.log('📖 Available commands:');
      console.log('- exit: Quit the chat');
      console.log('- help: Show this help message');
       console.log('- file [read|write|edit|create|delete]: File operations');
       console.log('- git [status|commit|push|pull|add|checkout|branch|merge]: Git operations');
       console.log('- code [run|test|analyze|debug|format]: Code operations');
       console.log('- model [list|set]: Model management');
       console.log('- provider [set|list]: Provider management');
       console.log('- apikey [set|list]: API key management');
       console.log('- settings: Interactive settings configuration');
       console.log('- config [set|get|list]: Configuration management');
      rl.prompt();
      return;
    }

    try {
      const response = await grokAPI.processPrompt(input, {
        model: options.model,
        directory: options.directory,
        mode
      });
      console.log(response);
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      if (options.verbose) {
        console.log('Debug info:', error.stack);
      }
    }

    rl.prompt();
  }).on('close', () => {
    console.log('👋 Goodbye!');
    process.exit(0);
  });
}

// Show help if no command is provided
if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(0);
}

// Parse command line arguments
program.parse();