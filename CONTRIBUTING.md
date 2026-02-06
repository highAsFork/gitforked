# Contributing to gitforked

We welcome contributions to gitforked! Here's how you can help improve this comprehensive CLI tool.

## Development Setup

1. **Fork the repository**
   ```bash
   git clone https://github.com/your-username/gitforked.git
   cd gitforked
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   export GROK_API_KEY=your_api_key_here
   ```

4. **Run in development mode**
   ```bash
   npm run dev
   ```

## Code Style

- Use ES6+ features
- Follow existing code patterns
- Use meaningful variable and function names
- Add comments for complex logic
- Use async/await for asynchronous operations

## Testing

All new features should include tests:

1. **Unit Tests**
   ```bash
   npm run test:unit
   ```

2. **Integration Tests**
   ```bash
   npm run test:integration
   ```

3. **Run all tests**
   ```bash
   npm test
   ```

## Architecture Overview

### Core Components

- **`src/index.js`**: Main CLI interface and command routing
- **`lib/grok-api.js`**: Grok API client and tool calling
- **`tools/`**: Utility modules for file, code, git, and MCP operations
- **`config/`**: Configuration management system
- **`test/`**: Test suites and test data

### Adding New Features

1. **Create new tool module** in `tools/` directory
2. **Add command** to `src/index.js`
3. **Update help text** and documentation
4. **Add tests** in appropriate test directory
5. **Update README** with new feature documentation

## Git Workflow

1. Create feature branch: `git checkout -b feature/new-feature`
2. Make changes and commit: `git commit -m "Add new feature"`
3. Push to remote: `git push origin feature/new-feature`
4. Create pull request

## Code Review Process

1. Ensure all tests pass
2. Check code style and formatting
3. Verify documentation is updated
4. Test the feature manually
5. Request review from maintainers

## Common Issues

### API Key Problems
- Ensure `GROK_API_KEY` is set in environment
- Check that the key has proper permissions
- Verify the key is not expired

### File Permissions
- Ensure the tool has read/write access to necessary directories
- Check file system permissions
- Verify that temp directories are accessible

### Node.js Version
- Use Node.js 18.0.0 or higher
- Check that all dependencies are compatible
- Update npm if needed

## Performance Considerations

- Use streaming for large file operations
- Implement proper error handling
- Cache configuration when possible
- Limit concurrent API calls

## Security Best Practices

- Never commit API keys to repository
- Validate all user inputs
- Sanitize file paths
- Use HTTPS for all API calls
- Implement rate limiting for API requests

## Documentation

- Update README.md for new features
- Add inline code comments for complex logic
- Create examples in the documentation
- Maintain consistent formatting

## Release Process

1. Update version in package.json
2. Update changelog
3. Run all tests
4. Build the project
5. Create git tag
6. Publish to npm (if applicable)

## Community Guidelines

- Be respectful and constructive
- Help other contributors
- Follow the code of conduct
- Report issues properly
- Provide detailed feedback

## Getting Help

If you need assistance:

1. Check existing issues on GitHub
2. Review the documentation
3. Search the codebase for similar implementations
4. Ask questions in the community channels

## License

This project is licensed under the MIT License. Contributions are subject to the same license.

---

**Thank you for contributing to gitforked!** Your contributions help make this tool better for everyone.