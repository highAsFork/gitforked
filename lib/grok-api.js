import axios from 'axios';
import os from 'os';
import path from 'path';
import { fileTools } from '../tools/file-tools.js';
import { codeTools } from '../tools/code-tools.js';
import { gitTools } from '../tools/git-tools.js';
import { mcpTools } from '../tools/mcp-tools.js';
import fs from 'fs';
import { execFile } from 'child_process';

import { config } from '../config/config.js';
import { ToolSandbox } from './tool-sandbox.js';

class GrokAPI {
  constructor(options = {}) {
    this._options = options;
    this.provider = options.provider || config.getProvider();
    this.sandbox = new ToolSandbox({
      projectRoot: options.directory || process.cwd(),
      safeMode: options.safeMode ?? true,
      maxRounds: options.maxRounds || 10,
      bashTimeout: options.bashTimeout || 10000
    });
    this.setupClient();
  }

  setupClient() {
    const provider = this.provider;
    if (provider === 'grok') {
      this.baseURL = process.env.GROK_BASE_URL || 'https://api.x.ai/v1';
      this.apiKey = this._options.apiKey || config.getApiKey('grok');
      this.client = axios.create({
        baseURL: this.baseURL,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
    } else if (provider === 'groq') {
      this.baseURL = 'https://api.groq.com/openai/v1';
      this.apiKey = this._options.apiKey || config.getApiKey('groq');
      this.client = axios.create({
        baseURL: this.baseURL,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
    } else if (provider === 'gemini') {
      this.baseURL = 'https://generativelanguage.googleapis.com/v1beta';
      this.apiKey = this._options.apiKey || config.getApiKey('gemini');
      this.client = axios.create({
        baseURL: this.baseURL,
        params: { key: this.apiKey }
      });
    } else if (provider === 'claude') {
      this.baseURL = 'https://api.anthropic.com/v1';
      this.apiKey = this._options.apiKey || config.getApiKey('claude');
      this.client = axios.create({
        baseURL: this.baseURL,
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      });
    } else if (provider === 'ollama') {
      this.baseURL = this._options.ollamaBaseUrl || config.getOllamaBaseUrl?.() || 'http://localhost:11434';
      this.apiKey = null;
      this.client = axios.create({
        baseURL: `${this.baseURL}/v1`,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }

  async chat(message, options = {}) {
    const { model = 'grok-4-1-fast-reasoning', directory, mode = 'plan' } = options;

    try {
       const response = await this.client.post('/chat/completions', {
        model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(directory, options.mode)
          },
          {
            role: 'user',
            content: message
          }
        ],
        stream: false,
        temperature: 0
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Endpoint not found: The requested model or API version may not be available.');
      }
      if (error.response?.status === 400) {
        if (error.response.data?.error?.includes('API key')) {
          throw new Error('Unauthorized: Please check your API key');
        }
        throw new Error('Bad request: Check model name, parameters, or API key validity.');
      }
      throw new Error(`API Error: ${error.message}`);
    }
  }

  async processPrompt(prompt, options = {}) {
    const { model = config.getModel(), directory, messages = [] } = options;

    // Update sandbox project root if directory changed
    if (directory) {
      this.sandbox.projectRoot = directory;
      this.sandbox.allowedPaths = [path.resolve(directory)];
    }

    // Build conversation history
    const conversationHistory = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    // Only add current prompt if not already in messages (prevents double echo)
    if (messages.length === 0 || messages[messages.length - 1]?.content !== prompt) {
      conversationHistory.push({ role: 'user', content: prompt });
    }

    try {
      // Route to appropriate handler based on provider
      if (this.provider === 'grok') {
        return await this._processWithToolLoop_Grok(conversationHistory, options);
      } else if (this.provider === 'claude') {
        return await this._processWithToolLoop_Claude(conversationHistory, options);
      } else {
        // Groq, Gemini, Ollama — no tool support
        return await this._processSinglePass(conversationHistory, options);
      }
    } catch (error) {
      throw new Error(`API Error: ${error.message}`);
    }
  }

  // Multi-round tool loop for Grok/OpenAI-compatible APIs
  async _processWithToolLoop_Grok(conversationHistory, options = {}) {
    const { model = config.getModel(), directory } = options;
    const onToolCall = options.onToolCall || (() => {});
    const onToolResult = options.onToolResult || (() => {});
    const onPermissionRequired = options.onPermissionRequired || (async () => true);

    const loopMessages = [
      { role: 'system', content: this.getSystemPrompt(directory, options.mode) },
      ...conversationHistory
    ];

    let totalRounds = 0;
    let totalToolCalls = 0;
    let accumulatedText = '';
    let lastUsage = null;
    const maxTotalToolCalls = this.sandbox.maxRounds * this.sandbox.maxToolCallsPerRound;

    while (totalRounds < this.sandbox.maxRounds) {
      const requestData = {
        model,
        messages: loopMessages,
        temperature: 0,
        stream: false,
        tools: this.getAgentTools(),
        tool_choice: 'auto'
      };

      const response = await this.client.post('/chat/completions', requestData);
      if (response.data.usage) lastUsage = response.data.usage;

      const assistantMessage = response.data.choices[0].message;
      loopMessages.push(assistantMessage);

      // Accumulate any text content
      if (assistantMessage.content) {
        accumulatedText += (accumulatedText ? '\n\n' : '') + assistantMessage.content;
      }

      // If no tool calls, we're done
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        break;
      }

      // Execute tool calls
      const toolResults = await this.executeToolCalls(
        assistantMessage.tool_calls, options, { onToolCall, onToolResult, onPermissionRequired }
      );

      for (const tr of toolResults) {
        if (totalToolCalls >= maxTotalToolCalls) {
          loopMessages.push({
            role: 'tool',
            tool_call_id: tr.toolCallId,
            content: '[Tool limit reached: max tool calls exceeded]'
          });
        } else {
          loopMessages.push({
            role: 'tool',
            tool_call_id: tr.toolCallId,
            content: typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result)
          });
        }
        totalToolCalls++;
      }

      totalRounds++;

      if (totalToolCalls >= maxTotalToolCalls) {
        accumulatedText += '\n\n[Tool limit: max tool calls reached]';
        break;
      }
    }

    if (totalRounds >= this.sandbox.maxRounds) {
      accumulatedText += '\n\n[Tool limit: max rounds reached]';
    }

    // Append usage footer
    accumulatedText += this._formatUsageFooter(lastUsage);
    return accumulatedText;
  }

  // Multi-round tool loop for Claude/Anthropic API
  async _processWithToolLoop_Claude(conversationHistory, options = {}) {
    const { model = config.getModel(), directory } = options;
    const onToolCall = options.onToolCall || (() => {});
    const onToolResult = options.onToolResult || (() => {});
    const onPermissionRequired = options.onPermissionRequired || (async () => true);

    const loopMessages = [...conversationHistory];
    let totalRounds = 0;
    let totalToolCalls = 0;
    let accumulatedText = '';
    let lastUsage = null;
    const maxTotalToolCalls = this.sandbox.maxRounds * this.sandbox.maxToolCallsPerRound;

    while (totalRounds < this.sandbox.maxRounds) {
      const requestData = {
        model,
        max_tokens: 4096,
        system: this.getSystemPrompt(directory, options.mode),
        messages: loopMessages,
        temperature: 0,
        tools: this.getClaudeTools()
      };

      const response = await this.client.post('/messages', requestData);
      if (response.data.usage) lastUsage = response.data.usage;

      const content = response.data.content || [];
      const stopReason = response.data.stop_reason;

      // Build assistant message for history
      loopMessages.push({ role: 'assistant', content });

      // Extract text blocks
      for (const block of content) {
        if (block.type === 'text' && block.text) {
          accumulatedText += (accumulatedText ? '\n\n' : '') + block.text;
        }
      }

      // If stop reason is not tool_use, we're done
      if (stopReason !== 'tool_use') break;

      // Process tool_use blocks
      const toolUseBlocks = content.filter(b => b.type === 'tool_use');
      const toolResultContent = [];

      for (const toolUse of toolUseBlocks) {
        if (totalToolCalls >= maxTotalToolCalls) {
          toolResultContent.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: '[Tool limit reached: max tool calls exceeded]'
          });
          totalToolCalls++;
          continue;
        }

        const toolName = toolUse.name;
        const args = toolUse.input || {};

        onToolCall(toolName, args);

        try {
          const result = await this._dispatchTool(toolName, args, options);
          const truncated = this.sandbox.truncateResult(result);
          this.sandbox.logToolCall(options.agentId || null, toolName, args, truncated, true);
          onToolResult(toolName, true);

          toolResultContent.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: truncated
          });
        } catch (error) {
          this.sandbox.logToolCall(options.agentId || null, toolName, args, error.message, false);
          onToolResult(toolName, false);

          toolResultContent.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Error: ${error.message}`,
            is_error: true
          });
        }
        totalToolCalls++;
      }

      loopMessages.push({ role: 'user', content: toolResultContent });
      totalRounds++;

      if (totalToolCalls >= maxTotalToolCalls) {
        accumulatedText += '\n\n[Tool limit: max tool calls reached]';
        break;
      }
    }

    if (totalRounds >= this.sandbox.maxRounds) {
      accumulatedText += '\n\n[Tool limit: max rounds reached]';
    }

    accumulatedText += this._formatUsageFooter(lastUsage);
    return accumulatedText;
  }

  // Single-pass (no tools) for Groq, Gemini, Ollama
  async _processSinglePass(conversationHistory, options = {}) {
    const { model = config.getModel(), directory } = options;
    let requestData, endpoint, responseHandler;

    if (this.provider === 'groq') {
      requestData = {
        model,
        messages: [
          { role: 'system', content: this.getSystemPrompt(directory, options.mode) },
          ...conversationHistory
        ],
        temperature: 0,
        stream: false
      };
      endpoint = '/chat/completions';
      responseHandler = (response) => response.data.choices[0].message.content || '';
    } else if (this.provider === 'gemini') {
      const historyText = conversationHistory.map(m =>
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
      ).join('\n\n');

      requestData = {
        contents: [{
          parts: [{ text: `${this.getSystemPrompt(directory, options.mode)}\n\n${historyText}` }]
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 4096
        }
      };
      endpoint = `/models/${model}:generateContent`;
      responseHandler = (response) => response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
    } else if (this.provider === 'ollama') {
      requestData = {
        model,
        messages: [
          { role: 'system', content: this.getSystemPrompt(directory, options.mode) },
          ...conversationHistory
        ],
        temperature: 0,
        stream: false
      };
      endpoint = '/chat/completions';
      responseHandler = (response) => response.data.choices[0].message.content || '';
    }

    const response = await this.client.post(endpoint, requestData);
    let finalContent = await responseHandler(response);
    finalContent += this._formatUsageFooter(response.data.usage);
    return finalContent;
  }

  // Format usage/cost footer from API response
  _formatUsageFooter(usage) {
    if (!usage) return '';

    const inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
    const outputTokens = usage.output_tokens || usage.completion_tokens || 0;
    const totalTokens = inputTokens + outputTokens;

    let inputCost = 0, outputCost = 0;
    if (this.provider === 'grok') {
      inputCost = (inputTokens / 1000000) * 0.10;
      outputCost = (outputTokens / 1000000) * 0.30;
    } else if (this.provider === 'groq') {
      inputCost = (inputTokens / 1000000) * 0.05;
      outputCost = (outputTokens / 1000000) * 0.08;
    } else if (this.provider === 'claude') {
      inputCost = (inputTokens / 1000000) * 3.00;
      outputCost = (outputTokens / 1000000) * 15.00;
    } else if (this.provider === 'gemini') {
      inputCost = (inputTokens / 1000000) * 0.50;
      outputCost = (outputTokens / 1000000) * 1.50;
    } else if (this.provider === 'ollama') {
      inputCost = 0;
      outputCost = 0;
    }
    const totalCost = inputCost + outputCost;

    return `\n\n---\nTokens: ${totalTokens} (${inputTokens} in, ${outputTokens} out)\nCost: $${totalCost.toFixed(6)}`;
  }

  // Execute tool calls from Grok/OpenAI format, returns structured results
  async executeToolCalls(toolCalls, options = {}, callbacks = {}) {
    const { onToolCall = () => {}, onToolResult = () => {}, onPermissionRequired = async () => true } = callbacks;
    const results = [];

    for (const toolCall of toolCalls) {
      if (toolCall.type !== 'function') continue;

      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || '{}');

      onToolCall(functionName, args);

      try {
        const result = await this._dispatchTool(functionName, args, options);
        const truncated = this.sandbox.truncateResult(result);
        this.sandbox.logToolCall(options.agentId || null, functionName, args, truncated, true);
        onToolResult(functionName, true);

        results.push({
          toolCallId: toolCall.id,
          toolName: functionName,
          result: truncated,
          success: true
        });
      } catch (error) {
        this.sandbox.logToolCall(options.agentId || null, functionName, args, error.message, false);
        onToolResult(functionName, false);

        results.push({
          toolCallId: toolCall.id,
          toolName: functionName,
          result: `Error: ${error.message}`,
          success: false
        });
      }
    }

    return results;
  }

  // Central tool dispatcher — all validation goes through sandbox
  async _dispatchTool(toolName, args, options = {}) {
    const directory = options.directory || process.cwd();

    switch (toolName) {
      case 'bash':
        return await this.executeBash(args.command, args.workdir || directory, args.timeout);
      case 'read':
        return await this.executeRead(args.filePath, args.offset, args.limit);
      case 'glob':
        return await this.executeGlob(args.pattern, args.path || directory);
      case 'grep':
        return await this.executeGrep(args.pattern, args.path || directory, args.include);
      case 'edit':
        return await this.executeEdit(args.filePath, args.oldString, args.newString, args.replaceAll);
      case 'write':
        return await this.executeWrite(args.filePath, args.content);
      case 'webfetch':
        return await this.executeWebFetch(args.url, args.format, args.timeout);
      default:
        return `Unknown tool: ${toolName}`;
    }
  }

  getSystemPrompt(directory, mode = 'plan', role = 'general') {
    if (this._options.systemPromptOverride) {
      return this._options.systemPromptOverride;
    }
    const modeDisplay = mode === 'plan' ? 'PLAN' : 'BUILD';

    return `You are gitforked, an AI coding assistant running in a terminal with expert-level skills, a Grok-inspired humor twist, and a knack for light-hearted roasting that keeps devs on their toes.

Current directory: ${directory}

You are currently in ${modeDisplay} mode.

MODE INSTRUCTIONS:

PLAN MODE:
You are in PLAN mode.
Before taking any action, analyze the user's request like a senior engineer who's seen too many 2 a.m. fire drills.
Break the problem down step-by-step.
Identify edge cases, performance implications, security concerns, maintainability issues, and how the solution fits the existing codebase.
Outline the clearest, most professional approach using the available tools.
Explain your reasoning concisely but thoroughly — show your expertise.
Do NOT execute anything yet.

Sprinkle in light, playful roasting to keep the energy up:
- Poke at questionable code choices ("Nested ternaries? Living dangerously, huh?")
- Tease questionable life decisions ("Another 3 a.m. refactor session? Your sleep schedule sends its regards.")
- Drop subtle gamer/pop-culture references ("This bug hunt feels like speedrunning Dark Souls with no Estus.")
Always stay helpful, encouraging, and focused on solving the problem.

BUILD MODE:
You are in BUILD mode.
Execute the user's request directly and efficiently — get it done like a pro.
Use tools to read, write, edit, run bash, grep, glob, or fetch web content as needed.
Follow existing code conventions religiously (indentation, naming, style).
Optimize where it makes sense, handle errors gracefully, write clean and robust code.
When running bash commands, give a one-line explanation (e.g., "Running npm install — because dependencies are the real boss fight").
Confirm before doing anything destructive or irreversible.

Weave in the same light roasting style:
- Call out lazy/vague requests (""Just make it work" — classic. I'll assume you meant "make it work well".")
- Tease gently ("Adding yet another dependency? Your package.json is starting to look like my Steam library.")
- Throw in quick game/movie nods ("Patching this like Tony Stark fixing the suit mid-flight.")
Stay snappy, helpful, and focused on delivering high-quality output.

GENERAL GUIDELINES (apply in both modes):

- This is a CLI — keep responses concise and direct. Short answers, big impact.
- But when explaining (especially in PLAN mode), go deep enough to demonstrate real expertise.
- Use available tools expertly:
  • bash → shell commands (always brief explanation)
  • read → read file content
  • write → create/overwrite files
  • edit → make targeted changes (preferred when preserving surrounding code)
  • glob → list files matching patterns
  • grep → search inside files efficiently
  • webfetch → grab online resources when genuinely useful (cite source if relevant)
- Never commit changes unless explicitly asked.
- Do not add comments to code unless the user specifically requests them.
- Match the project's existing style perfectly — do not introduce random formatting changes.
- If the request is vague, ambiguous, or dangerous — ask clarifying questions with a dash of sass.
- Personality: expert advice wrapped in wit. Roast lightly to engage — never mean-spirited, always code/dev-focused.
  Examples:
  • "Global variables? Bold strategy, Cotton. Let's fix that before it bites us."
  • "This logic is more twisted than a Rubik's cube in zero gravity."
  • "Another one-liner? Respect the art form… but maybe let's make it readable too."
- Acknowledge mode switches with personality (e.g., "Switching to BUILD? Finally done planning world domination?")

Available tools: bash, read, write, edit, glob, grep, webfetch

Respond helpfully to the user's request with expertise, clarity, and a bit of fun.`;
  }

  // Agent tools — reduced set: bash, read, write, edit, glob, grep only
  // Agents don't need meta-tools (task, todowrite, question, skill)
  getAgentTools() {
    return [
      {
        "type": "function",
        "function": {
          "name": "bash",
          "description": "Executes a bash command with optional timeout. Use for terminal operations like git, npm, docker, etc.",
          "parameters": {
            "type": "object",
            "properties": {
              "command": {
                "description": "The command to execute",
                "type": "string"
              },
              "timeout": {
                "description": "Optional timeout in milliseconds",
                "type": "number"
              },
              "workdir": {
                "description": "Working directory for the command",
                "type": "string"
              },
              "description": {
                "description": "Brief description of what this command does",
                "type": "string"
              }
            },
            "required": ["command", "description"],
            "additionalProperties": false
          }
        }
      },
      {
        "type": "function",
        "function": {
          "name": "read",
          "description": "Reads a file from the local filesystem. The filePath must be an absolute path.",
          "parameters": {
            "type": "object",
            "properties": {
              "filePath": {
                "description": "The absolute path to the file to read",
                "type": "string"
              },
              "offset": {
                "description": "Line number to start reading from (0-based)",
                "type": "number"
              },
              "limit": {
                "description": "Number of lines to read (defaults to 2000)",
                "type": "number"
              }
            },
            "required": ["filePath"],
            "additionalProperties": false
          }
        }
      },
      {
        "type": "function",
        "function": {
          "name": "glob",
          "description": "Fast file pattern matching. Supports glob patterns like '**/*.js'.",
          "parameters": {
            "type": "object",
            "properties": {
              "pattern": {
                "description": "The glob pattern to match files against",
                "type": "string"
              },
              "path": {
                "description": "The directory to search in",
                "type": "string"
              }
            },
            "required": ["pattern"],
            "additionalProperties": false
          }
        }
      },
      {
        "type": "function",
        "function": {
          "name": "grep",
          "description": "Search file contents using regular expressions.",
          "parameters": {
            "type": "object",
            "properties": {
              "pattern": {
                "description": "The regex pattern to search for",
                "type": "string"
              },
              "path": {
                "description": "The directory to search in",
                "type": "string"
              },
              "include": {
                "description": "File pattern to include (e.g. '*.js')",
                "type": "string"
              }
            },
            "required": ["pattern"],
            "additionalProperties": false
          }
        }
      },
      {
        "type": "function",
        "function": {
          "name": "edit",
          "description": "Performs exact string replacements in files.",
          "parameters": {
            "type": "object",
            "properties": {
              "filePath": {
                "description": "The absolute path to the file to modify",
                "type": "string"
              },
              "oldString": {
                "description": "The text to replace",
                "type": "string"
              },
              "newString": {
                "description": "The replacement text",
                "type": "string"
              },
              "replaceAll": {
                "description": "Replace all occurrences (default false)",
                "type": "boolean"
              }
            },
            "required": ["filePath", "oldString", "newString"],
            "additionalProperties": false
          }
        }
      },
      {
        "type": "function",
        "function": {
          "name": "write",
          "description": "Writes content to a file, creating or overwriting.",
          "parameters": {
            "type": "object",
            "properties": {
              "content": {
                "description": "The content to write",
                "type": "string"
              },
              "filePath": {
                "description": "The absolute path to the file",
                "type": "string"
              }
            },
            "required": ["content", "filePath"],
            "additionalProperties": false
          }
        }
      }
    ];
  }

  // Full tool set for main TUI (includes meta-tools)
  getAllTools() {
    return [
      ...this.getAgentTools(),
      {
        "type": "function",
        "function": {
          "name": "webfetch",
          "description": "Fetches content from a URL. Returns content in markdown, text, or html format.",
          "parameters": {
            "type": "object",
            "properties": {
              "url": {
                "description": "The URL to fetch content from",
                "type": "string"
              },
              "format": {
                "description": "Output format: text, markdown, or html",
                "default": "markdown",
                "type": "string",
                "enum": ["text", "markdown", "html"]
              },
              "timeout": {
                "description": "Optional timeout in seconds (max 120)",
                "type": "number"
              }
            },
            "required": ["url", "format"],
            "additionalProperties": false
          }
        }
      }
    ];
  }

  // Convert OpenAI tool format to Claude tool format
  getClaudeTools() {
    return this.getAgentTools().map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters
    }));
  }

  getToolsFor(toolType) {
    const tools = {
      file: [
        {
          type: 'function',
          function: {
            name: 'read_file',
            description: 'Read a file from the filesystem',
            parameters: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path to read' }
              },
              required: ['path']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'write_file',
            description: 'Write content to a file',
            parameters: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path to write' },
                content: { type: 'string', description: 'Content to write' }
              },
              required: ['path', 'content']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'edit_file',
            description: 'Edit a file using natural language',
            parameters: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path to edit' },
                changes: { type: 'string', description: 'Description of changes to make' }
              },
              required: ['path', 'changes']
            }
          }
        }
      ],
      git: [
        {
          type: 'function',
          function: {
            name: 'git_status',
            description: 'Get git repository status',
            parameters: {}
          }
        },
        {
          type: 'function',
          function: {
            name: 'git_commit',
            description: 'Create a git commit',
            parameters: {
              type: 'object',
              properties: {
                message: { type: 'string', description: 'Commit message' },
                files: { type: 'array', items: { type: 'string' }, description: 'Files to commit' }
              },
              required: ['message']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'git_push',
            description: 'Push commits to remote',
            parameters: {}
          }
        }
      ],
      code: [
        {
          type: 'function',
          function: {
            name: 'run_code',
            description: 'Execute code',
            parameters: {
              type: 'object',
              properties: {
                language: { type: 'string', description: 'Programming language' },
                code: { type: 'string', description: 'Code to execute' },
                input: { type: 'string', description: 'Input for the code' }
              },
              required: ['code']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'test_code',
            description: 'Run tests',
            parameters: {
              type: 'object',
              properties: {
                framework: { type: 'string', description: 'Testing framework' },
                files: { type: 'array', items: { type: 'string' }, description: 'Test files' }
              },
              required: ['files']
            }
          }
        }
      ]
    };

    return tools[toolType] || [];
  }

  // Tools that require permission before execution
  dangerousTools = ['bash', 'write', 'edit', 'read', 'glob', 'grep', 'webfetch'];

  getPermissionDetails(toolName, args, directory) {
    switch (toolName) {
      case 'bash':
        return {
          command: args.command,
          workdir: args.workdir || directory,
          timeout: args.timeout
        };
      case 'write':
        return {
          filePath: args.filePath,
          contentPreview: args.content ? args.content.slice(0, 200) + (args.content.length > 200 ? '...' : '') : ''
        };
      case 'edit':
        return {
          filePath: args.filePath,
          oldString: args.oldString ? args.oldString.slice(0, 100) : '',
          newString: args.newString ? args.newString.slice(0, 100) : ''
        };
      default:
        return args;
    }
  }

  // Hardened: validates through sandbox, uses execFile with timeout
  async executeBash(command, workdir, timeout) {
    const validation = this.sandbox.validateBash(command);
    if (!validation.allowed) {
      return `Blocked: ${validation.reason}`;
    }

    return new Promise((resolve, reject) => {
      execFile('bash', ['-c', command], {
        cwd: workdir,
        timeout: Math.min(timeout || this.sandbox.bashTimeout, 120000),
        maxBuffer: this.sandbox.maxResultSize
      }, (error, stdout, stderr) => {
        if (error) {
          if (error.killed) {
            resolve(`Command timed out after ${timeout || this.sandbox.bashTimeout}ms`);
          } else {
            reject(error);
          }
        } else {
          resolve(this.sandbox.truncateResult(stdout || stderr));
        }
      });
    });
  }

  // Hardened: validates path through sandbox
  async executeRead(filePath, offset, limit) {
    const validation = this.sandbox.validatePath(filePath);
    if (!validation.allowed) {
      return `Blocked: ${validation.reason}`;
    }

    const content = fs.readFileSync(validation.resolvedPath, 'utf8');
    const lines = content.split('\n');
    const start = offset || 0;
    const end = limit ? start + limit : lines.length;
    const result = lines.slice(start, end).map((line, i) => `${start + i + 1}\t${line}`).join('\n');
    return this.sandbox.truncateResult(result);
  }

  // Hardened: validates path, limits results to 100
  async executeGlob(pattern, globPath) {
    const validation = this.sandbox.validatePath(globPath);
    if (!validation.allowed) {
      return `Blocked: ${validation.reason}`;
    }

    const { glob } = await import('glob');
    const results = glob.sync(pattern, { cwd: validation.resolvedPath });
    return results.slice(0, 100);
  }

  // Hardened: validates path, wraps regex in try/catch, limits results to 50
  async executeGrep(pattern, grepPath, include) {
    const validation = this.sandbox.validatePath(grepPath);
    if (!validation.allowed) {
      return `Blocked: ${validation.reason}`;
    }

    // Safe regex compilation
    let regex;
    try {
      regex = new RegExp(pattern);
    } catch (e) {
      return `Invalid regex pattern: ${e.message}`;
    }

    const { glob } = await import('glob');
    const files = glob.sync(include || '**/*', { cwd: validation.resolvedPath, nodir: true });
    const results = [];
    const maxResults = 50;

    for (const file of files) {
      if (results.length >= maxResults) break;
      try {
        const fullPath = path.join(validation.resolvedPath, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length && results.length < maxResults; i++) {
          if (regex.test(lines[i])) {
            results.push(`${file}:${i + 1}:${lines[i]}`);
          }
        }
      } catch (e) {
        // Skip unreadable files
      }
    }
    return results;
  }

  // Hardened: validates path through sandbox
  async executeEdit(filePath, oldString, newString, replaceAll) {
    const validation = this.sandbox.validatePath(filePath);
    if (!validation.allowed) {
      return `Blocked: ${validation.reason}`;
    }

    let content = fs.readFileSync(validation.resolvedPath, 'utf8');
    if (replaceAll) {
      content = content.replace(new RegExp(oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newString);
    } else {
      content = content.replace(oldString, newString);
    }
    fs.writeFileSync(validation.resolvedPath, content);
    return 'File edited successfully';
  }

  // Hardened: validates path through sandbox, creates directories safely
  async executeWrite(filePath, content) {
    const validation = this.sandbox.validatePath(filePath);
    if (!validation.allowed) {
      return `Blocked: ${validation.reason}`;
    }

    const dir = path.dirname(validation.resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(validation.resolvedPath, content);
    return 'File written successfully';
  }

  // Hardened: validates URL through sandbox
  async executeWebFetch(url, format, timeout) {
    const validation = this.sandbox.validateUrl(url);
    if (!validation.allowed) {
      return `Blocked: ${validation.reason}`;
    }

    const response = await axios.get(url, { timeout: Math.min((timeout || 30) * 1000, 120000) });
    return this.sandbox.truncateResult(typeof response.data === 'string' ? response.data : JSON.stringify(response.data));
  }

  async healthCheck() {
    try {
      const response = await this.client.post('/v1/chat/completions', {
        model: 'grok-4-1-fast-reasoning',
        messages: [{
          role: 'system',
          content: 'You are a helpful assistant'
        }, {
          role: 'user',
          content: 'Hello'
        }],
        stream: false,
        temperature: 0
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance and class
const grokAPI = new GrokAPI();
export { grokAPI, GrokAPI };
