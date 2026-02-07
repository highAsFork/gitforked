# gitforked Usage Examples

## Basic Chat Usage

### Start Interactive Chat
```bash
# Start interactive mode
gitforked chat

# Or with custom model
gitforked chat --model grok-4-1-fast-reasoning

# With verbose logging
gitforked chat --verbose
```

### Chat Commands
```bash
# Exit chat
exit

# Show help
help

# Switch working directory
cd /path/to/project
```

## File Operations

### Reading Files
```bash
# Read a single file
gitforked file read --path src/index.js

# Read multiple files
gitforked file read --path src/index.js,src/grok-api.js

# Read with line numbers
gitforked file read --path src/index.js --show-lines
```

### Writing Files
```bash
# Write simple content
gitforked file write --path hello.js --content "console.log('Hello World')"

# Write from file
gitforked file write --path hello.js --content-file ./template.js

# Append to existing file
gitforked file write --path app.js --content "// Added by gitforked" --append
```

### Editing Files
```bash
# Edit using natural language
gitforked file edit --path src/index.js --changes "Add error handling to the chat function"

# Replace specific text
gitforked file edit --path config.js --changes "Replace localhost with 127.0.0.1"

# Add new function
gitforked file edit --path utils.js --changes "Add new utility function for data validation"
```

### File Management
```bash
# Create new file
gitforked file create --path new-file.txt

# Delete file
gitforked file delete --path old-file.txt

# Copy file
gitforked file copy --source src/index.js --destination backup/index.js

# Move file
gitforked file move --source src/old-name.js --destination src/new-name.js
```

## Git Operations

### Basic Git Commands
```bash
# Check git status
gitforked git status

# Commit changes
gitforked git commit --message "Fix bug in API integration" --files "src/grok-api.js"

# Push to remote
gitforked git push

# Pull changes
gitforked git pull

# Checkout branch
gitforked git checkout --branch feature/new-feature
```

### Advanced Git Operations
```bash
# Commit specific files
gitforked git commit --message "Update documentation" --files "README.md,CONTRIBUTING.md"

# Push with tags
gitforked git push --tags

# Checkout new branch
gitforked git checkout --branch feature/new-feature --create

# Merge branch
gitforked git merge --branch feature/new-feature
```

## Code Execution

### Running Code
```bash
# Run JavaScript code
gitforked code run --code "console.log('Hello World')" --language javascript

# Run Python code
gitforked code run --code "print('Hello World')" --language python

# Run with input
gitforked code run --code "const input = require('fs').readFileSync(0, 'utf8'); console.log(input)" --language javascript --input "Hello from stdin"
```

### Testing Code
```bash
# Run Jest tests
gitforked code test --files "test/**/*.test.js" --framework jest

# Run Python tests
gitforked code test --files "tests/test_*.py" --framework pytest

# Auto-detect framework
gitforked code test --files "test/**/*.test.js" --framework auto
```

### Code Analysis
```bash
# Analyze JavaScript code
gitforked code analyze --code "var x = 10; console.log(x)" --language javascript

# Analyze Python code
gitforked code analyze --code "print 'Hello World'" --language python

# Analyze with suggestions
gitforked code analyze --code "function add(a, b) { return a + b }" --language javascript --suggestions
```

### Debugging Code
```bash
# Debug JavaScript code
gitforked code debug --code "console.log(add(2, 3);" --language javascript

# Debug Python code
gitforked code debug --code "if x > 5: print('x is greater than 5')" --language python

# Debug with context
gitforked code debug --code "function calculate(a, b) { return a + b } console.log(calculate(2, 3)" --language javascript --context
```

### Code Formatting
```bash
# Format JavaScript code
gitforked code format --code "const x=10; const y=20; console.log( x + y )" --language javascript

# Format Python code
gitforked code format --code "def add(a,b): return a+b" --language python
```

## Agent Teams

### Launch Agent Teams TUI
```bash
# Start Agent Teams mode
gitforked chat --teams
```

### Team Management (CLI)
```bash
# List saved teams
gitforked team list

# Create a new team
gitforked team create --name "Code Review Squad"

# Show team details
gitforked team show --name "Code Review Squad"

# Delete a team
gitforked team delete --name "Code Review Squad"
```

### Team Management (TUI Commands)
```bash
# Inside the Agent Teams TUI:
/team create My Security Team
/team save
/team list
/team load My Security Team
/team delete Old Team
```

### Agent Management (TUI Commands)
```bash
# Inside the Agent Teams TUI:
/agent add          # Opens add agent dialog
/agent list         # Show all agents with status
/agent edit <id>    # Edit an agent
/agent remove <id>  # Remove an agent
```

### Ollama Integration
```bash
# Inside the Agent Teams TUI:
/ollama status      # Check if Ollama is running
/ollama models      # List available local models
```

### Example: Multi-Agent Code Review Team

1. Launch: `gitforked chat --teams`
2. Press `Ctrl+T` → Create new team "Review Squad"
3. Press `Ctrl+A` → Add agent:
   - Name: ReviewBot, Role: Code Reviewer, Provider: grok, Model: grok-4-1-fast-reasoning
4. Press `Ctrl+A` → Add agent:
   - Name: SecBot, Role: Security Analyst, Provider: claude, Model: claude-sonnet-4-5-20250929
5. Press `Ctrl+A` → Add agent:
   - Name: DocBot, Role: Documentation Writer, Provider: groq, Model: llama-3.3-70b-versatile
6. Type a message in Team Channel — all agents respond sequentially with shared context
7. Press `1` to DM ReviewBot directly, `2` for SecBot, `0` for Team Channel

### Example: Local-Only Team with Ollama
```bash
# Make sure Ollama is running with models pulled
ollama pull llama3.2
ollama pull codellama

# Launch Agent Teams
gitforked chat --teams

# Add agents using the Ollama provider — models auto-discovered
```

## Model Management

### Model Operations
```bash
# List available models
gitforked model list

# Set default model
gitforked model set --model grok-4-1-fast-reasoning

# Get current model
gitforked model get
```

## Configuration Management

### Configuration Operations
```bash
# List all configuration
gitforked config list

# Get specific configuration
gitforked config get --key model

# Set configuration
gitforked config set --key baseURL --value "https://api.custom-grok.com/v1"

# Reset to defaults
gitforked config reset
```

## Advanced Usage

### Batch Operations
```bash
# Process multiple files
gitforked file read --path "src/**/*.js"

# Run tests in parallel
gitforked code test --files "test/unit/*.test.js,test/integration/*.test.js" --parallel
```

### Custom Scripts
```bash
# Create custom workflow script
#!/bin/bash
# my-workflow.sh
gitforked git status
gitforked code test --files "test/**/*.test.js"
gitforked git commit -m "Automated test commit"
gitforked git push

# Make executable
chmod +x my-workflow.sh
```

### Integration with Other Tools
```bash
# Use with VS Code
code --new-window --goto $(gitforked file find --pattern "*.js" --name "main")

# Use with git hooks
#!/bin/bash
# .git/hooks/pre-commit
gitforked code test --files "$(git diff --cached --name-only)"
```

## Troubleshooting

### Common Issues
```bash
# Check API connection
gitforked config get --key baseURL

# Verify API key
gitforked config get --key apiKey

# Test file operations
gitforked file read --path /tmp/test.txt

# Debug code execution
gitforked code debug --code "console.log('Test')" --language javascript --verbose
```

### Performance Tips
```bash
# Use streaming for large files
gitforked file read --path large-file.txt --stream

# Limit API calls
gitforked config set --key maxToolRounds --value 100

# Enable caching
gitforked config set --key cacheEnabled --value true
```

## Examples Directory

Check the `examples/` directory for:
- Complete workflow scripts
- Configuration templates
- Integration examples
- Advanced usage patterns