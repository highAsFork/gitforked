import axios from 'axios';
import os from 'os';
import path from 'path';
import { fileTools } from '../tools/file-tools.js';
import { codeTools } from '../tools/code-tools.js';
import { gitTools } from '../tools/git-tools.js';
import { mcpTools } from '../tools/mcp-tools.js';
import fs from 'fs';

import { config } from '../config/config.js';

class GrokAPI {
  constructor() {
    this.provider = config.getProvider();
    this.setupClient();
  }

  setupClient() {
    const provider = this.provider;
    if (provider === 'grok') {
      this.baseURL = process.env.GROK_BASE_URL || 'https://api.x.ai/v1';
      this.apiKey = config.getApiKey('grok');
      this.client = axios.create({
        baseURL: this.baseURL,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
    } else if (provider === 'groq') {
      this.baseURL = 'https://api.groq.com/openai/v1';
      this.apiKey = config.getApiKey('groq');
      this.client = axios.create({
        baseURL: this.baseURL,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
    } else if (provider === 'gemini') {
      this.baseURL = 'https://generativelanguage.googleapis.com/v1beta';
      this.apiKey = config.getApiKey('gemini');
      this.client = axios.create({
        baseURL: this.baseURL,
        params: { key: this.apiKey }
      });
    } else if (provider === 'claude') {
      this.baseURL = 'https://api.anthropic.com/v1';
      this.apiKey = config.getApiKey('claude');
      this.client = axios.create({
        baseURL: this.baseURL,
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
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
        console.error('404 Error details:', { status: error.response.status, statusText: error.response.statusText, url: error.response.config?.url });
        throw new Error('Endpoint not found: The requested model or API version may not be available.');
      }
      if (error.response?.status === 400) {
        console.error('400 Bad Request details:', { status: error.response.status, data: error.response.data, url: error.response.config?.url });
        if (error.response.data?.error?.includes('API key')) {
          throw new Error('Unauthorized: Please check your API key');
        }
        throw new Error('Bad request: Check model name, parameters, or API key validity.');
      }
      throw new Error(`API Error: ${error.message}`);
    }
  }

  async processPrompt(prompt, options = {}) {
    const { model = config.getModel(), directory, maxToolRounds = 400, messages = [] } = options;

    // Build conversation history
    // Note: The current prompt should already be in the messages array from the TUI
    // Only add it if messages is empty (direct API usage without conversation history)
    const conversationHistory = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    // Only add current prompt if not already in messages (prevents double echo)
    if (messages.length === 0 || messages[messages.length - 1]?.content !== prompt) {
      conversationHistory.push({ role: 'user', content: prompt });
    }

    try {
      let requestData;
      let endpoint;
      let responseHandler;

      if (this.provider === 'grok') {
        requestData = {
          model,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt(directory, options.mode)
            },
            ...conversationHistory
          ],
          temperature: 0,
          stream: false,
          tools: this.getAllTools(),
          tool_choice: 'auto'
        };
        endpoint = '/chat/completions';
        responseHandler = (response) => {
          let finalContent = response.data.choices[0].message.content || '';
          if (response.data.choices[0].message.tool_calls && response.data.choices[0].message.tool_calls.length > 0) {
            finalContent = this.handleToolCalls(response.data.choices[0].message.tool_calls, finalContent, options);
          }
          return finalContent;
        };
      } else if (this.provider === 'groq') {
        requestData = {
          model,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt(directory, options.mode)
            },
            ...conversationHistory
          ],
          temperature: 0,
          stream: false
        };
        endpoint = '/chat/completions';
        responseHandler = (response) => {
          return response.data.choices[0].message.content || '';
        };
      } else if (this.provider === 'gemini') {
        // Gemini uses a different format - concatenate history
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
        responseHandler = (response) => {
          return response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
        };
      } else if (this.provider === 'claude') {
        requestData = {
          model,
          max_tokens: 4096,
          system: this.getSystemPrompt(directory, options.mode),
          messages: conversationHistory,
          temperature: 0
        };
        endpoint = '/messages';
        responseHandler = (response) => {
          return response.data.content?.[0]?.text || 'No response';
        };
      }

      const response = await this.client.post(endpoint, requestData);

      let finalContent = await responseHandler(response);

      // Display token usage and cost (simplified, as APIs differ)
      if (response.data.usage) {
        const usage = response.data.usage;
        const inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
        const outputTokens = usage.output_tokens || usage.completion_tokens || 0;
        const totalTokens = inputTokens + outputTokens;

        // Approximate pricing (adjust per provider)
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
        }
        const totalCost = inputCost + outputCost;

        finalContent += `\n\n---\nTokens: ${totalTokens} (${inputTokens} in, ${outputTokens} out)\nCost: $${totalCost.toFixed(6)}`;
      }

      return finalContent;
    } catch (error) {
      throw new Error(`API Error: ${error.message}`);
    }
  }

  getSystemPrompt(directory, mode = 'plan', role = 'general') {
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

  getAllTools() {
    return [
      {
        "type": "function",
        "function": {
          "name": "question",
          "description": "Use this tool when you need to ask the user questions during execution. This allows you:\n1. Gather user preferences or requirements\n2. Clarify ambiguous instructions\n3. Get decisions on implementation choices as you work\n4. Offer choices to the user about what direction to take.\n\nUsage notes:\n- When `custom` is enabled (default), a \"Type your own answer\" option is added automatically; don't include \"Other\" or catch-all options\n- Answers are returned as arrays of labels; set `multiple: true` to allow selecting more than one\n- If you recommend a specific option, make that the first option in the list and add \"(Recommended)\" at the end of the label",
          "parameters": {
            "type": "object",
            "properties": {
              "questions": {
                "description": "Questions to ask",
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "question": {
                      "description": "Complete question",
                      "type": "string"
                    },
                    "header": {
                      "description": "Very short label (max 30 chars)",
                      "type": "string"
                    },
                    "options": {
                      "description": "Available choices",
                      "type": "array",
                      "items": {
                        "ref": "QuestionOption",
                        "type": "object",
                        "properties": {
                          "label": {
                            "description": "Display text (1-5 words, concise)",
                            "type": "string"
                          },
                          "description": {
                            "description": "Explanation of choice",
                            "type": "string"
                          }
                        },
                        "required": ["label", "description"],
                        "additionalProperties": false
                      }
                    },
                    "multiple": {
                      "description": "Allow selecting multiple choices",
                      "type": "boolean"
                    }
                  },
                  "required": ["question", "header", "options"],
                  "additionalProperties": false
                }
              }
            },
            "required": ["questions"],
            "additionalProperties": false
          }
        }
      },
      {
        "type": "function",
        "function": {
          "name": "bash",
          "description": "Executes a given bash command in a persistent shell session with optional timeout, ensuring proper handling and security measures.\n\nAll commands run in the current directory by default. Use the `workdir` parameter if you need to run a command in a different directory. AVOID using `cd <directory> && <command>` patterns - use `workdir` instead.\n\nIMPORTANT: This tool is for terminal operations like git, npm, docker, etc. DO NOT use it for file operations (reading, writing, editing, finding files) - use the specialized tools for this instead.\n\nBefore executing the command, please follow these steps:\n\n1. Directory Verification:\n   - If the command will create new directories or files, first use `ls` to verify the parent directory exists and is the correct location\n   - For example, before running \"mkdir foo/bar\", first use `ls foo` to check that \"foo\" exists and is the intended parent directory\n\n2. Command Execution:\n   - Always quote file paths that contain spaces with double quotes (e.g., rm \"path with spaces/file.txt\")\n   - Examples of proper quoting:\n     - mkdir \"/Users/name/My Documents\" (correct)\n     - mkdir /Users/name/My Documents (incorrect - will fail)\n     - python \"/path/with spaces/script.py\" (correct)\n     - python /path/with spaces/script.py (incorrect - will fail)\n   - After ensuring proper quoting, execute the command.\n   - Capture the output of the command.\n\nUsage notes:\n  - The command argument is required.\n  - You can specify an optional timeout in milliseconds. If not specified, commands will time out after 120000ms (2 minutes).\n  - It is very helpful if you write a clear, concise description of what this command does in 5-10 words.\n  - If the output exceeds 2000 lines or 51200 bytes, it will be truncated and the full output will be written to a file. You can use Read with offset/limit to read specific sections or Grep to search the full content. Because of this, you do NOT need to use `head`, `tail`, or other truncation commands to limit output - just run the command directly.\n\n  - Avoid using Bash with the `find`, `grep`, `cat`, `head`, `tail`, `sed`, `awk`, or `echo` commands, unless explicitly instructed or when these commands are truly necessary for the task. Instead, always prefer using the dedicated tools for these commands:\n    - File search: Use Glob (NOT find or ls)\n    - Content search: Use Grep (NOT grep or rg)\n    - Read files: Use Read (NOT cat/head/tail)\n    - Edit files: Use Edit (NOT sed/awk)\n    - Write files: Use Write (NOT echo >/cat <<EOF)\n    - Communication: Output text directly (NOT echo/printf)\n  - When issuing multiple commands:\n    - If the commands are independent and can run in parallel, make multiple Bash tool calls in a single message. For example, if you need to run \"git status\" and \"git diff\", send a single message with two tool calls in parallel.\n    - If the commands depend on each other and must run sequentially, use a single Bash call with '&&' to chain them together (e.g., `git add . && git commit -m \"message\" && git push`). For instance, if one operation must complete before another starts (like mkdir before cp, Write before Bash for git operations, or git add before git commit), run these operations sequentially instead.\n    - Use ';' only when you need to run commands sequentially but don't care if earlier commands fail\n    - DO NOT use newlines to separate commands (newlines are ok in quoted strings)\n  - AVOID using `cd <directory> && <command>`. Use the `workdir` parameter to change directories instead.\n    <good-example>\n    Use workdir=\"/foo/bar\" with command: pytest tests\n    </good-example>\n    <bad-example>\n    cd /foo/bar && pytest tests\n    </bad-example>\n\n# Committing changes with git\n\nOnly create commits when requested by the user. If unclear, ask first. When the user asks you to create a new git commit, follow these steps carefully:\n\nGit Safety Protocol:\n- NEVER update the git config\n- NEVER run destructive/irreversible git commands (like push --force, hard reset, etc) unless the user explicitly requests them\n- NEVER skip hooks (--no-verify, --no-gpg-sign, etc) unless the user explicitly requests it\n- NEVER force push to main/master, warn the user if they request it\n- Avoid git commit --amend. ONLY use --amend when ALL conditions are met:\n  (1) User explicitly requested amend, OR commit SUCCEEDED but pre-commit hook auto-modified files that need including\n  (2) HEAD commit was created by you in this conversation (verify: git log -1 --format='%an %ae')\n  (3) Commit has NOT been pushed to remote (verify: git status shows \"Your branch is ahead\")\n- CRITICAL: If commit FAILED or was REJECTED by hook, NEVER amend - fix the issue and create a NEW commit\n- CRITICAL: If you already pushed to remote, NEVER amend unless user explicitly requests it (requires force push)\n- NEVER commit changes unless the user explicitly asks you to. It is VERY IMPORTANT to only commit when explicitly asked, otherwise the user will feel that you are being too proactive.\n\n1. You can call multiple tools in a single response. When multiple independent pieces of information are requested and all commands are likely to succeed, run multiple tool calls in parallel for optimal performance. run the following bash commands in parallel, each using the Bash tool:\n  - Run a git status command to see all untracked files.\n  - Run a git diff command to see both staged and unstaged changes that will be committed.\n  - Run a git log command to see recent commit messages, so that you can follow this repository's commit message style.\n2. Analyze all staged changes (both previously staged and newly added) and draft a commit message:\n  - Summarize the nature of the changes (eg. new feature, enhancement to an existing feature, bug fix, refactoring, test, docs, etc.). Ensure the message accurately reflects the changes and their purpose (i.e. \"add\" means a wholly new feature, \"update\" means an enhancement to an existing feature, \"fix\" means a bug fix, etc.).\n  - Do not commit files that likely contain secrets (.env, credentials.json, etc.). Warn the user if they specifically request to commit those files\n  - Draft a concise (1-2 sentences) commit message that focuses on the \"why\" rather than the \"what\"\n  - Ensure it accurately reflects the changes and their purpose\n3. You can call multiple tools in a single response. When multiple independent pieces of information are requested and all commands are likely to succeed, run multiple tool calls in parallel for optimal performance. run the following commands:\n   - Add relevant untracked files to the staging area.\n   - Create the commit with a message\n   - Run git status after the commit completes to verify success.\n   Note: git status depends on the commit completing, so run it sequentially after the commit.\n4. If the commit fails due to pre-commit hook, fix the issue and create a NEW commit (see amend rules above)\n\nImportant notes:\n- NEVER run additional commands to read or explore code, besides git bash commands\n- NEVER use the TodoWrite or Task tools\n- DO NOT push to the remote repository unless the user explicitly asks you to do so\n- IMPORTANT: Never use git commands with the -i flag (like git rebase -i or git add -i) since they require interactive input which is not supported.\n- If there are no changes to commit (i.e., no untracked files and no modifications), do not create an empty commit\n\n# Creating pull requests\nUse the gh command via the Bash tool for ALL GitHub-related tasks including working with issues, pull requests, checks, and releases. If given a Github URL use the gh command to get the information needed.\n\nIMPORTANT: When the user asks you to create a pull request, follow these steps carefully:\n\n1. You can call multiple tools in a single response. When multiple independent pieces of information are requested and all commands are likely to succeed, run multiple tool calls in parallel for optimal performance. run the following bash commands in parallel using the Bash tool, in order to understand the current state of the branch since it diverged from the main branch:\n   - Run a git status command to see all untracked files\n   - Run a git diff command to see both staged and unstaged changes that will be committed\n   - Check if the current branch tracks a remote branch and is up to date with the remote, so you know if you need to push to the remote\n   - Run a git log command and `git diff [base-branch]...HEAD` to understand the full commit history for the current branch (from the time it diverged from the base branch)\n2. Analyze all changes that will be included in the pull request, making sure to look at all relevant commits (NOT just the latest commit, but ALL commits that will be included in the pull request!!!), and draft a pull request summary\n3. You can call multiple tools in a single response. When multiple independent pieces of information are requested and all commands are likely to succeed, run multiple tool calls in parallel for optimal performance. run the following commands in parallel:\n   - Create new branch if needed\n   - Push to remote with -u flag if needed\n   - Create PR using gh pr create with the format below. Use a HEREDOC to pass the body to ensure correct formatting.\n<example>\ngh pr create --title \"the pr title\" --body \"$(cat <<'EOF'\n## Summary\n<1-3 bullet points>\n</example>\n\nImportant:\n- DO NOT use the TodoWrite or Task tools\n- Return the PR URL when you're done, so the user can see it\n\n# Other common operations\n- View comments on a Github PR: gh api repos/foo/bar/pulls/123/comments\n",
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
                "description": "The working directory to run the command in. Defaults to the current directory. Use this instead of 'cd' commands.",
                "type": "string"
              },
              "description": {
                "description": "Clear, concise description of what this command does in 5-10 words. Examples:\nInput: ls\nOutput: Lists files in current directory\n\nInput: git status\nOutput: Shows working tree status\n\nInput: npm install\nOutput: Installs package dependencies\n\nInput: mkdir foo\nOutput: Creates directory 'foo'",
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
          "description": "Reads a file from the local filesystem. You can access any file directly by using this tool.\nAssume this tool is able to read all files on the machine. If the User provides a path to a file assume that path is valid. It is okay to read a file that does not exist; an error will be returned.\n\nUsage:\n- The filePath parameter must be an absolute path, not a relative path\n- By default, it reads up to 2000 lines starting from the beginning of the file\n- You can optionally specify a line offset and limit (especially handy for long files), but it's recommended to read the whole file by not providing these parameters\n- Any lines longer than 2000 characters will be truncated\n- Results are returned using cat -n format, with line numbers starting at 1\n- You have the capability to call multiple tools in a single response. It is always better to speculatively read multiple files as a batch that are potentially useful.\n- If you read a file that exists but has empty contents you will receive a system reminder warning in place of file contents.\n- You can read image files using this tool.\n",
          "parameters": {
            "type": "object",
            "properties": {
              "filePath": {
                "description": "The path to the file to read",
                "type": "string"
              },
              "offset": {
                "description": "The line number to start reading from (0-based)",
                "type": "number"
              },
              "limit": {
                "description": "The number of lines to read (defaults to 2000)",
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
          "description": "- Fast file pattern matching tool that works with any codebase size\n- Supports glob patterns like \"**/*.js\" or \"src/**/*.ts\"\n- Returns matching file paths sorted by modification time\n- Use this tool when you need to find files by name patterns\n- When you are doing an open-ended search that may require multiple rounds of globbing and grepping, use the Task tool instead\n- You have the capability to call multiple tools in a single response. It is always better to speculatively perform multiple searches as a batch that are potentially useful.\n",
          "parameters": {
            "type": "object",
            "properties": {
              "pattern": {
                "description": "The glob pattern to match files against",
                "type": "string"
              },
              "path": {
                "description": "The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory. DO NOT enter \"undefined\" or \"null\" - simply omit it for the default behavior. Must be a valid directory path if provided.",
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
          "description": "- Fast content search tool that works with any codebase size\n- Searches file contents using regular expressions\n- Supports full regex syntax (eg. \"log.*Error\", \"function\\s+\\w+\", etc.)\n- Filter files by pattern with the include parameter (eg. \"*.js\", \"*.{ts,tsx}\")\n- Returns file paths and line numbers with at least one match sorted by modification time\n- Use this tool when you need to find files containing specific patterns\n- If you need to identify/count the number of matches within files, use the Bash tool with `rg` (ripgrep) directly. Do NOT use `grep`.\n- When you are doing an open-ended search that may require multiple rounds of globbing and grepping, use the Task tool instead\n",
          "parameters": {
            "type": "object",
            "properties": {
              "pattern": {
                "description": "The regex pattern to search for in file contents",
                "type": "string"
              },
              "path": {
                "description": "The directory to search in. Defaults to the current working directory.",
                "type": "string"
              },
              "include": {
                "description": "File pattern to include in the search (e.g. \"*.js\", \"*.{ts,tsx}\")",
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
          "description": "Performs exact string replacements in files. \n\nUsage:\n- You must use your `Read` tool at least once in the conversation before editing. This tool will error if you attempt an edit without reading the file. \n- When editing text from Read tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: spaces + line number + tab. Everything after that tab is the actual file content to match. Never include any part of the line number prefix in the oldString or newString.\n- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.\n- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.\n- The edit will FAIL if `oldString` is not found in the file with an error \"oldString not found in content\".\n- The edit will FAIL if `oldString` is found multiple times in the file with an error \"oldString found multiple times and requires more code context to uniquely identify the intended match\". Either provide a larger string with more surrounding context to make it unique or use `replaceAll` to change every instance of `oldString`. \n- Use `replaceAll` for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.\n",
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
                "description": "The text to replace it with (must be different from oldString)",
                "type": "string"
              },
              "replaceAll": {
                "description": "Replace all occurrences of oldString (default false)",
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
          "description": "Writes a file to the local filesystem.\n\nUsage:\n- This tool will overwrite the existing file if there is one at the provided path.\n- If this is an existing file, you MUST use the Read tool first to read the file's contents. This tool will fail if you did not read the file first.\n- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.\n- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.\n- Only use emojis if the user explicitly requests it. Avoid writing emojis to files unless asked.\n",
          "parameters": {
            "type": "object",
            "properties": {
              "content": {
                "description": "The content to write to the file",
                "type": "string"
              },
              "filePath": {
                "description": "The absolute path to the file to write (must be absolute, not relative)",
                "type": "string"
              }
            },
            "required": ["content", "filePath"],
            "additionalProperties": false
          }
        }
      },
      {
        "type": "function",
        "function": {
          "name": "task",
          "description": "Launch a new agent to handle complex, multistep tasks autonomously.\n\nAvailable agent types and the tools they have access to:\n- general: General-purpose agent for researching complex questions and executing multi-step tasks. Use this agent to execute multiple units of work in parallel.\n- explore: Fast agent specialized for exploring codebases. Use this when you need to quickly find files by patterns (eg. \"src/components/**/*.tsx\"), search code for keywords (eg. \"API endpoints\"), or answer questions about the codebase (eg. \"how do API endpoints work?\"). When calling this agent, specify the desired thoroughness level: \"quick\" for basic searches, \"medium\" for moderate exploration, or \"very thorough\" for comprehensive analysis across multiple locations and naming conventions.\n\nWhen using the Task tool, you must specify a subagent_type parameter to select which agent type to use.\n\nWhen to use the Task tool:\n- When you are instructed to execute custom slash commands. Use the Task tool with the slash command invocation as the entire prompt. For example: Task(description=\"Check the file\", prompt=\"/check-file path/to/file.py\")\n\nWhen NOT to use the Task tool:\n- If you want to read a specific file path, use the Read or Glob tool instead of the Task tool, to find the match more quickly\n- If you are searching for a specific class definition like \"class Foo\", use the Glob tool instead of the Task tool, to find the match more quickly\n- If you are searching for code within a specific file or set of 2-3 files, use the Read tool instead of the Task tool, to find the match more quickly\n- Other tasks that are not related to the agent descriptions above\n\n\nUsage notes:\n1. Launch multiple agents concurrently whenever possible, to maximize performance; to do that, use a single message with multiple tool uses\n2. When the agent is done, it will return a single message back to you. The result returned by the agent is not visible to the user. To show the user the result, you should send a text message back to the user with a concise summary of the result. The output includes a task_id you can reuse later to continue the same subagent session.\n3. Each agent invocation starts with a fresh context unless you provide task_id to resume the same subagent session (which continues with its previous messages and tool outputs). When starting fresh, your prompt should contain a highly detailed task description for the agent to perform autonomously and you should specify exactly what information the agent should return back to you in its final and only message to you.\n4. The agent's outputs should generally be trusted\n5. Clearly tell the agent whether you expect it to write code or just to do research (search, file reads, web fetches, etc.), since it is not aware of the user's intent. Tell it how to verify its work if possible (e.g., relevant test commands).\n6. If the agent description mentions that it should be used proactively, then you should try your best to use it without the user having to ask for it first. Use your judgement.\n\nExample usage (NOTE: The agents below are fictional examples for illustration only - use the actual agents listed above):\n\n<example_agent_descriptions>\n\"code-reviewer\": use this agent after you are done writing a significant piece of code\n\"greeting-responder\": use this agent when to respond to user greetings with a friendly joke\n</example_agent_description>\n\n<example>\nuser: \"Please write a function that checks if a number is prime\"\nassistant: Sure let me write a function that checks if a number is prime\nassistant: First let me use the Write tool to write a function that checks if a number is prime\nassistant: I'm going to use the Write tool to write the following code:\n<code>\nfunction isPrime(n) {\n  if (n <= 1) return false\n  for (let i = 2; i * i <= n; i++) {\n    if (n % i === 0) return false\n  }\n  return true\n}\n</code>\n<commentary>\nSince a significant piece of code was written and the task was completed, now use the code-reviewer agent to review the code\n</commentary>\nassistant: Now let me use the code-reviewer agent to review the code\nassistant: Uses the Task tool to launch the code-reviewer agent\n</example>\n\n<example>\nuser: \"Hello\"\n<commentary>\nSince the user is greeting, use the greeting-responder agent to respond with a friendly joke\n</commentary>\nassistant: \"I'm going to use the Task tool to launch the with the greeting-responder agent\"\nassistant: Uses the Task tool to launch the greeting-responder agent with prompt \"Respond to the user's greeting with a friendly joke\"\n</example>\n",
          "parameters": {
            "type": "object",
            "properties": {
              "description": {
                "description": "A short (3-5 words) description of the task",
                "type": "string"
              },
              "prompt": {
                "description": "The task for the agent to perform",
                "type": "string"
              },
              "subagent_type": {
                "description": "The type of specialized agent to use for this task",
                "type": "string"
              },
              "task_id": {
                "description": "This should only be set if you mean to resume a previous task (you can pass a prior task_id and the same subagent session as before instead of creating a fresh one)",
                "type": "string"
              },
              "command": {
                "description": "The command that triggered this task",
                "type": "string"
              }
            },
            "required": ["description", "prompt", "subagent_type"],
            "additionalProperties": false
          }
        }
      },
      {
        "type": "function",
        "function": {
          "name": "webfetch",
          "description": "- Fetches content from a specified URL\n- Takes a URL and optional format as input\n- Fetches the URL content, converts to requested format (markdown by default)\n- Returns the content in the specified format\n- Use this tool when you need to retrieve and analyze web content\n\nUsage notes:\n  - IMPORTANT: if another tool is present that offers better web fetching capabilities, is more targeted to the task, or has fewer restrictions, prefer using that tool instead of this one.\n  - The URL must be a fully-formed valid URL\n  - HTTP URLs will be automatically upgraded to HTTPS\n  - Format options: \"markdown\" (default), \"text\", or \"html\"\n  - This tool is read-only and does not modify any files\n  - Results may be summarized if the content is very large\n",
          "parameters": {
            "type": "object",
            "properties": {
              "url": {
                "description": "The URL to fetch content from",
                "type": "string"
              },
              "format": {
                "description": "The format to return the content in (text, markdown, or html). Defaults to markdown.",
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
      },
      {
        "type": "function",
        "function": {
          "name": "todowrite",
          "description": "Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.\nIt also helps the user understand the progress of the task and overall progress of their requests.\n\n## When to Use This Tool\nUse this tool proactively in these scenarios:\n\n1. Complex multistep tasks - When a task requires 3 or more distinct steps or actions\n2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations\n3. User explicitly requests todo list - When the user directly asks you to use the todo list\n4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)\n5. After receiving new instructions - Immediately capture user requirements as todos. Feel free to edit the todo list based on new information.\n6. After completing a task - Mark it complete and add any new follow-up tasks\n7. When you start working on a new task, mark the todo as in_progress. Ideally you should only have one todo as in_progress at a time. Complete existing tasks before starting new ones.\n\n## When NOT to Use This Tool\n\nSkip using this tool when:\n1. There is only a single, straightforward task\n2. The task is trivial and tracking it provides no organizational benefit\n3. The task can be completed in less than 3 trivial steps\n4. The task is purely conversational or informational\n\nNOTE that you should not use this tool if there is only one trivial task to do. In this case you are better off just doing the task directly.\n\n## Examples of When to Use the Todo List\n\n<example>\nUser: I want to add a dark mode toggle to the application settings. Make sure you run the tests and build when you're done!\nAssistant: I'll help add a dark mode toggle to your application settings. Let me create a todo list to track this implementation.\n*Creates todo list with the following items:*\n1. Create dark mode toggle component in Settings page\n2. Add dark mode state management (context/store)\n3. Implement CSS-in-JS styles for dark theme\n4. Update existing components to support theme switching\n5. Run tests and build process, addressing any failures or errors that occur\n*Begins working on the first task*\n\n<rereasoning>\nThe assistant used the todo list because:\n1. Adding dark mode is a multi-step feature requiring UI, state management, and styling changes\n2. The user explicitly requested tests and build be run afterward\n3. The assistant inferred that tests and build need to pass by adding \"Ensure tests and build succeed\" as the final task\n</reasoning>\n</example>\n\n<example>\nUser: Help me rename the function getCwd to getCurrentWorkingDirectory across my project\nAssistant: Let me first search through your codebase to find all occurrences of 'getCwd'.\n*Uses grep or search tools to locate all instances of getCwd in the codebase*\nAssistant: I've found 15 instances of 'getCwd' across 8 different files. Let me create a todo list to track these changes.\n*Creates todo list with specific items for each file that needs updating*\n\n<rereasoning>\nThe assistant used the todo list because:\n1. First, the assistant searched to understand the scope of the task\n2. Upon finding multiple occurrences across different files, it determined this was a complex task with multiple steps\n3. The todo list helps ensure every instance is tracked and updated systematically\n4. This approach prevents missing any occurrences and maintains code consistency\n</reasoning>\n</example>\n\n<example>\nUser: I need to implement these features for my e-commerce site: user registration, product catalog, shopping cart, and checkout flow.\nAssistant: I'll help implement these features. First, let's add all the features to the todo list.\n*Creates todo list breaking down each feature into specific tasks based on the project architecture*\nAssistant: Let's start with user registration. This will involve creating database models, API endpoints, and frontend forms that integrate with your existing authentication system.\n\n<rereasoning>\nThe assistant used the todo list because:\n1. The user provided multiple complex features to implement in a comma separated list\n2. The todo list helps organize these large features into manageable tasks\n3. This approach allows for tracking progress across the entire implementation\n</reasoning>\n</example>\n\n<example>\nUser: Can you help optimize my React application? It's rendering slowly and has performance issues.</user>\nAssistant: I'll help optimize your React application. First, let me examine your codebase to identify potential performance bottlenecks.\n*Reviews component structure, render patterns, state management, and data fetching*\nAssistant: After analyzing your codebase, I've identified several performance issues. Let me create a todo list to track our optimization efforts.\n*Creates todo list with items like: 1) Implement memoization for expensive calculations in ProductList, 2) Add virtualization for long lists in Dashboard, 3) Optimize image loading in Gallery component, 4) Fix state update loops in ShoppingCart, 5) Review bundle size and implement code splitting*\nLet's start by implementing memoization for the expensive calculations in your ProductList component.</assistant>\n\n<rereasoning>\nThe assistant used the todo list because:\n1. First, the assistant examined the codebase to identify specific performance issues\n2. Based on this analysis, it identified multiple optimization opportunities\n3. Performance optimization is a non-trivial task requiring multiple steps\n4. The todo list helps methodically track improvements across different components\n5. This systematic approach ensures all performance bottlenecks are addressed\n</reasoning>\n</example>\n\n## Examples of When NOT to Use the Todo List\n\n<example>\nUser: How do I print 'Hello World' in Python?\nAssistant: In Python, you can print \"Hello World\" with this simple code:\n\npython\nprint(\"Hello World\")\n\nThis will output the text \"Hello World\" to the console when executed.</assistant>\n\n<rereasoning>\nThe assistant did not use the todo list because this is a single, trivial task that can be completed in one step. There's no need to track multiple tasks or steps for such a straightforward request.\n</reasoning>\n</example>\n\n<example>\nUser: What does the git status command do?\nAssistant: The git status command shows the current state of your working directory and staging area. It displays which changes have been staged, which haven't, and which files aren't being tracked by Git. This is a fundamental command for understanding the current state of your repository before making commits.\n\n<rereasoning>\nThe assistant did not use the todo list because this is an informational request with no actual coding task to complete. The user is simply asking for an explanation, not for the assistant to perform multiple steps or tasks.\n</reasoning>\n</example>\n\n<example>\nUser: Can you help add a comment to the calculateTotal function to explain what it does?\nAssistant: Sure, let me add a comment to the calculateTotal function to explain what it does.\n* Uses the Edit tool to add a comment to the calculateTotal function *\n\n<rereasoning>\nThe assistant did not use the todo list because this is a single, straightforward task confined to one location in the code. Adding a comment doesn't require tracking multiple steps or systematic organization.\n</reasoning>\n</example>\n\n<example>\nUser: Run npm install for me and tell me what happens.\nAssistant: I'll run the npm install command for you.\n\n*Executes: npm install*\n\nThe command completed successfully. Here's the output:\n[Output of npm install command]\n\nAll dependencies have been installed according to your package.json file.\n\n<brreasoning>\nThe assistant did not use the todo list because this is a single command execution with immediate results. There are no multiple steps to track or organize, making the todo list unnecessary for this straightforward task.\n</reasoning>\n</example>\n\n## Task States and Management\n\n1. **Task States**: Use these states to track progress:\n   - pending: Task not yet started\n   - in_progress: Currently working on (limit to ONE task at any time)\n   - completed: Task finished successfully\n   - cancelled: Task no longer needed\n\n2. **Task Management**:\n   - Update task status in real-time as you work\n   - Mark tasks complete IMMEDIATELY after finishing (don't batch completions)\n   - Only have ONE task in_progress at any time\n   - Complete current tasks before starting new ones\n   - Cancel tasks that become irrelevant\n\n3. **Task Breakdown**:\n   - Create specific, actionable items\n   - Use clear, descriptive task names\n\nWhen in doubt, use this tool. Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully.\n\n",
          "parameters": {
            "type": "object",
            "properties": {
              "todos": {
                "description": "The updated todo list",
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "content": {
                      "description": "Brief description of the task",
                      "type": "string"
                    },
                    "status": {
                      "description": "Current status of the task: pending, in_progress, completed, cancelled",
                      "type": "string"
                    },
                    "priority": {
                      "description": "Priority level of the task: high, medium, low",
                      "type": "string"
                    },
                    "id": {
                      "description": "Unique identifier for the todo item",
                      "type": "string"
                    }
                  },
                  "required": ["content", "status", "priority", "id"],
                  "additionalProperties": false
                }
              }
            },
            "required": ["todos"],
            "additionalProperties": false
          }
        }
      },
      {
        "type": "function",
        "function": {
          "name": "skill",
          "description": "Load a specialized skill that provides domain-specific instructions and workflows. No skills are currently available.",
          "parameters": {
            "type": "object",
            "properties": {
              "name": {
                "description": "The name of the skill from available_skills",
                "type": "string"
              }
            },
            "required": ["name"],
            "additionalProperties": false
          }
        }
      }
    ];
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
  dangerousTools = ['bash', 'write', 'edit'];

  async handleToolCalls(toolCalls, initialResponse, options) {
    let finalResponse = initialResponse || '';
    const directory = options.directory || process.cwd();

    // Callbacks for UI integration
    const onToolCall = options.onToolCall || (() => {});
    const onToolResult = options.onToolResult || (() => {});
    const onPermissionRequired = options.onPermissionRequired || (async () => true);

    for (const toolCall of toolCalls) {
      if (toolCall.type === 'function') {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments || '{}');

        // Notify UI that tool is being called
        onToolCall(functionName, args);

        try {
          let result;

          // Check if permission is required for dangerous operations
          if (this.dangerousTools.includes(functionName)) {
            const permissionDetails = this.getPermissionDetails(functionName, args, directory);
            const allowed = await onPermissionRequired(functionName, permissionDetails);

            if (!allowed) {
              result = `Permission denied by user for ${functionName}`;
              onToolResult(functionName, false);
              finalResponse += `\n\n${functionName}: Permission denied`;
              continue;
            }
          }

          switch (functionName) {
            case 'bash':
              result = await this.executeBash(args.command, args.workdir || directory, args.timeout);
              break;
            case 'read':
              result = await this.executeRead(args.filePath, args.offset, args.limit);
              break;
            case 'glob':
              result = await this.executeGlob(args.pattern, args.path || directory);
              break;
            case 'grep':
              result = await this.executeGrep(args.pattern, args.path || directory, args.include);
              break;
            case 'edit':
              result = await this.executeEdit(args.filePath, args.oldString, args.newString, args.replaceAll);
              break;
            case 'write':
              result = await this.executeWrite(args.filePath, args.content);
              break;
            case 'task':
              result = await this.executeTask(args.description, args.prompt, args.subagent_type, args.task_id, args.command);
              break;
            case 'webfetch':
              result = await this.executeWebFetch(args.url, args.format, args.timeout);
              break;
            case 'todowrite':
              result = await this.executeTodoWrite(args.todos);
              break;
            case 'question':
              result = await this.executeQuestion(args.questions);
              break;
            case 'skill':
              result = await this.executeSkill(args.name);
              break;
            default:
              result = `Unknown tool: ${functionName}`;
          }

          onToolResult(functionName, true);
          finalResponse += `\n\n${functionName} result: ${JSON.stringify(result)}`;
        } catch (error) {
          onToolResult(functionName, false);
          finalResponse += `\n\nError in ${functionName}: ${error.message}`;
        }
      }
    }

    return finalResponse;
  }

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

  async executeBash(command, workdir, timeout) {
    const { exec } = await import('child_process');
    return new Promise((resolve, reject) => {
      exec(command, { cwd: workdir, timeout: timeout || 120000 }, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve(stdout || stderr);
      });
    });
  }

  async executeRead(filePath, offset, limit) {
    const fs = await import('fs');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const start = offset || 0;
    const end = limit ? start + limit : lines.length;
    return lines.slice(start, end).map((line, i) => `${start + i + 1}\t${line}`).join('\n');
  }

  async executeGlob(pattern, path) {
    const { glob } = await import('glob');
    return glob.sync(pattern, { cwd: path });
  }

  async executeGrep(pattern, path, include) {
    // Simple implementation
    const fs = await import('fs');
    const { glob } = await import('glob');
    const files = glob.sync(include || '**/*', { cwd: path });
    const results = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (new RegExp(pattern).test(line)) {
            results.push(`${file}:${i + 1}:${line}`);
          }
        });
      } catch (e) {}
    }
    return results;
  }

  async executeEdit(filePath, oldString, newString, replaceAll) {
    const fs = await import('fs');
    let content = fs.readFileSync(filePath, 'utf8');
    if (replaceAll) {
      content = content.replace(new RegExp(oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newString);
    } else {
      content = content.replace(oldString, newString);
    }
    fs.writeFileSync(filePath, content);
    return 'File edited successfully';
  }

  async executeWrite(filePath, content) {
    const fs = await import('fs');
    fs.writeFileSync(filePath, content);
    return 'File written successfully';
  }

  async executeTask(description, prompt, subagent_type, task_id, command) {
    // Simulate subagent with different role
    const role = subagent_type || 'general';
    const response = await this.processPrompt(prompt, { mode: 'build', role });
    return response;
  }

  async executeWebFetch(url, format, timeout) {
    const axios = (await import('axios')).default;
    const response = await axios.get(url, { timeout: (timeout || 30) * 1000 });
    return response.data;
  }

  async executeTodoWrite(todos) {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const todoFile = path.join(os.homedir(), '.gitforked', 'todos.json');
    fs.mkdirSync(path.dirname(todoFile), { recursive: true });
    fs.writeFileSync(todoFile, JSON.stringify(todos, null, 2));
    return 'Todos updated successfully';
  }

  async executeQuestion(questions) {
    // For now, return placeholder
    return 'Question asked';
  }

  async executeSkill(name) {
    return `Skill ${name} loaded`;
  }

  async healthCheck() {
    try {
      console.log('[DEBUG] Testing API connection...');
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
      console.log('[DEBUG] API connection successful, status:', response.status);
      return response.status === 200;
    } catch (error) {
      console.log('[DEBUG] API connection failed:', error.message);
      return false;
    }
  }
}

// Export singleton instance
const grokAPI = new GrokAPI();
export { grokAPI };