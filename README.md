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

- **Multi-Provider AI** - Grok (xAI), Groq, Gemini, Claude
- **Plan/Build Modes** - Think first or just send it
- **Permission System** - Asks before running dangerous stuff
- **Real-time Agent Activity** - See what the AI is doing
- **Fun Spinner Messages** - "Go Away! I'm 'Batin!" and 50+ more
- **TUI & CLI modes** - Fancy panels or simple terminal

## Quick Start

```bash
# Install
npm install -g gitforked

# Set your API key
export GROK_API_KEY=your_key_here

# Run it
gitforked chat --tui
```

## TUI Layout

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

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+P` | Toggle Plan/Build mode |
| `Ctrl+F` | Toggle file browser |
| `Ctrl+C` | Exit |
| `Tab` | Switch focus |
| `Y/N` | Allow/Deny permissions |
| `?` | Show help |

## Commands

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
gitforked provider set grok
gitforked apikey set --provider grok --key your_key
gitforked model set grok-3-latest
```

### Environment Variables

- `GROK_API_KEY` - xAI Grok
- `GROQ_API_KEY` - Groq
- `GEMINI_API_KEY` - Google Gemini
- `CLAUDE_API_KEY` - Anthropic Claude

## Supported Models

**Grok (xAI)**
- `grok-3-latest` - Latest and greatest
- `grok-3-fast` - Speed demon
- `grok-3-mini` - Smol but capable

**Groq**
- `llama-3.3-70b-versatile`
- `llama-3.1-8b-instant`

**Gemini**
- `gemini-2.0-flash`
- `gemini-1.5-pro`

**Claude**
- `claude-sonnet-4-20250514`
- `claude-3-5-sonnet-20241022`

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
