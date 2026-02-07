# gitforked 🍴

A Grok-powered CLI for developers who give a fork.

```
        _ _    __            _              _
   __ _(_) |_ / _| ___  _ __| | _____  __| |
  / _` | | __| |_ / _ \| '__| |/ / _ \/ _` |
 | (_| | | |_|  _| (_) | |  |   <  __/ (_| |
  \__, |_|\__|_|  \___/|_|  |_|\_\___|\__,_|
  |___/
```

## What is this?

An AI-powered terminal coding assistant with a sense of humor. Think Claude Code meets opencode, but with more personality and Grok's... unique perspective.

## Features

- **Multi-Provider AI** - Grok (xAI), Groq, Gemini, Claude, Ollama (local)
- **Agent Teams** - Multi-agent collaboration with shared context
- **Plan/Build Modes** - Think first or just send it
- **Permission System** - Asks before running dangerous stuff
- **Real-time Agent Activity** - See what the AI is doing
- **Fun Spinner Messages** - "Forming Voltron..." and 50+ more
- **TUI & CLI modes** - Fancy panels or simple terminal

## Quick Start

```bash
# Install
npm install -g gitforked

# Set your API key(s)
export GROK_API_KEY=your_key_here

# Run single-agent TUI
gitforked chat --tui

# Run Agent Teams TUI
gitforked chat --teams
```

## Agent Teams

Launch a multi-agent collaboration environment where multiple AI agents (each with their own provider, model, and role) work together on your problems.

```bash
gitforked chat --teams
```

### Agent Teams TUI Layout

```
┌─────────────────────────────────────────────────────────────┐
│ gitforked Agent Teams │ Team: MyTeam │ 3 agents │ $0.0042   │
├───────────────┬─────────────────────────────────────────────┤
│ # Team Channel│  [Chat area - team or agent DM]             │
│               │                                             │
│ o ReviewBot   │  You: review this code                      │
│   Code Review │                                             │
│ * SecBot      │  ReviewBot (Code Review)                    │
│   Security    │    Looks good, but consider...              │
│ o DocBot      │                                             │
│   Docs        │  SecBot (Security)                          │
│               │    Found a potential XSS vector...          │
│ [+ Add Agent] │                                             │
├───────────────┴─────────────────────────────────────────────┤
│ > Type a message...                                         │
├─────────────────────────────────────────────────────────────┤
│ ^T Team  ^A Add  ^E Edit  Tab Focus  ^C Exit  0-9 Switch   │
└─────────────────────────────────────────────────────────────┘
```

### Agent Teams Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+T` | Open team management (create/load/save/delete) |
| `Ctrl+A` | Add new agent to team |
| `Ctrl+E` | Edit selected agent |
| `Tab` | Cycle focus: sidebar > chat > input |
| `0` | Switch to Team Channel |
| `1-9` | Quick-switch to agent DM by number |
| `Ctrl+C` | Exit |
| `j/k` | Scroll chat |

### Agent Teams Commands

| Command | Description |
|---------|-------------|
| `/team create <name>` | Create a new team |
| `/team load <name>` | Load a saved team |
| `/team save` | Save current team |
| `/team list` | List saved teams |
| `/team delete <name>` | Delete a saved team |
| `/agent add` | Open add agent dialog |
| `/agent edit [id]` | Edit an agent |
| `/agent remove <id>` | Remove an agent |
| `/agent list` | List all agents with status |
| `/ollama models` | List local Ollama models |
| `/ollama status` | Check if Ollama is running |
| `/help` | Show all commands |
| `/clear` | Clear chat |

### Team Channel vs Agent DM

- **Team Channel** - Messages are sent to all agents sequentially. Each agent sees prior agents' responses for collaborative context.
- **Agent DM** - Private conversation with a single agent. Isolated history.

### Team CLI Commands

```bash
# List saved teams
gitforked team list

# Create a team from CLI
gitforked team create --name "My Team"

# Show team details
gitforked team show --name "My Team"

# Delete a team
gitforked team delete --name "My Team"
```

## Single-Agent TUI Layout

```
┌─────────────────────────────────────────────────────────┐
│ gitforked │ Mode: PLAN │ Model: grok-3 │ Cost: $0.0012  │
├────────────────────────────────┬────────────────────────┤
│                                │  Agent Activity        │
│       Chat Panel               │  ⠋ thinking...         │
│                                │  ✓ read file           │
│  You: fix this bug             ├────────────────────────┤
│  AI: I'll take a look...       │  Tasks                 │
│                                │  ○ Fix the thing       │
├────────────────────────────────┴────────────────────────┤
│ [Plan] > _                                              │
├─────────────────────────────────────────────────────────┤
│ ^P Mode  ^F Files  ^C Exit  Tab Focus  Enter Send       │
└─────────────────────────────────────────────────────────┘
```

## Keyboard Shortcuts (Single-Agent TUI)

| Key | Action |
|-----|--------|
| `Ctrl+P` | Toggle Plan/Build mode |
| `Ctrl+F` | Toggle file browser |
| `Ctrl+C` | Exit |
| `Tab` | Switch focus |
| `Y/N` | Allow/Deny permissions |
| `?` | Show help |

## Commands (Single-Agent TUI)

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/mode` | Toggle Plan/Build |
| `/clear` | Clear chat |
| `/run <cmd>` | Run shell command |
| `/git <cmd>` | Git operations |
| `/todo add <text>` | Add task |

## Configuration

```bash
# Interactive setup
gitforked settings

# Or manual
gitforked provider set --provider grok
gitforked apikey set --provider grok --key your_key
gitforked model set --model grok-4-1-fast-reasoning
```

### Environment Variables

- `GROK_API_KEY` - xAI Grok
- `GROQ_API_KEY` - Groq
- `GEMINI_API_KEY` - Google Gemini
- `CLAUDE_API_KEY` - Anthropic Claude
- Ollama - No API key needed (local)

## Supported Models

**Grok (xAI)**
- `grok-4-1-fast-reasoning` - Fast reasoning (recommended)
- `grok-4-1-fast-non-reasoning` - Fast non-reasoning
- `grok-4-latest` - Latest Grok 4
- `grok-4` - Grok 4
- `grok-3-latest` - Latest Grok 3
- `grok-3-fast` - Speed demon
- `grok-3-mini` / `grok-3-mini-fast` - Lightweight

**Groq**
- `llama-3.3-70b-versatile`
- `llama-3.1-8b-instant`
- `mixtral-8x7b-32768`
- `gemma2-9b-it`

**Gemini**
- `gemini-2.0-flash`
- `gemini-1.5-pro`
- `gemini-1.5-flash`

**Claude**
- `claude-opus-4-6`
- `claude-opus-4-5-20251101`
- `claude-sonnet-4-5-20250929`
- `claude-haiku-4-5-20251001`

**Ollama (Local)**
- Auto-discovered from your local Ollama instance
- Any model you've pulled (llama3, codellama, mistral, etc.)

## Why "gitforked"?

Because sometimes your code is forked, and you need an AI that gets it.

Also: [highAsFork](https://github.com/highAsFork) thought it was funny.

## Contributing

PRs welcome! This is a fun project, keep it that way.

1. Fork it (ironic, I know)
2. Make it better
3. Submit a PR
4. ???
5. Profit

## License

MIT - Do whatever you want, just don't blame me.

## Links

- [GitHub](https://github.com/highAsFork/gitforked)
- [npm](https://www.npmjs.com/package/gitforked)
- [Issues](https://github.com/highAsFork/gitforked/issues)

---

*"I came to kick ass and chew bubble gum... and I'm all out of gum."* 🎮
