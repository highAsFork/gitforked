import { exec } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import ora from 'ora';

class CodeTools {
  async run(code, language = 'javascript', input = '') {
    const spinner = ora('Running code...').start();
    
    try {
      const tempFile = this.createTempFile(code, language);
      let command;
      
      switch (language.toLowerCase()) {
        case 'javascript':
        case 'js':
          command = `node ${tempFile}`;
          break;
        case 'python':
        case 'py':
          command = `python ${tempFile}`;
          break;
        case 'python3':
        case 'py3':
          command = `python3 ${tempFile}`;
          break;
        case 'typescript':
        case 'ts':
          command = `npx ts-node ${tempFile}`;
          break;
        case 'bash':
        case 'sh':
          command = `bash ${tempFile}`;
          break;
        case 'go':
          command = `go run ${tempFile}`;
          break;
        case 'rust':
          command = `rustc ${tempFile} && ./${path.basename(tempFile, '.rs')}`;
          break;
        case 'java':
          const className = path.basename(tempFile, '.java');
          command = `javac ${tempFile} && java ${className}`;
          break;
        default:
          throw new Error(`Unsupported language: ${language}`);
      }

      // Add input if provided
      if (input) {
        command = `${command} < <EOF\n${input}\nEOF`;
      }

      return new Promise((resolve, reject) => {
        exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
          spinner.stop();
          
          if (error) {
            reject(new Error(`Execution error: ${error.message}\n${stderr}`));
            return;
          }
          
          resolve(`Execution result:\n\n${stdout}\n\n${stderr ? 'Error output:\n' + stderr : ''}`);
        });
      });
    } catch (error) {
      spinner.stop();
      throw new Error(`Code execution failed: ${error.message}`);
    }
  }

  async test(files, framework = 'auto') {
    const spinner = ora('Running tests...').start();
    
    try {
      let command = '';
      
      // Auto-detect framework if needed
      if (framework === 'auto') {
        framework = this.detectFramework(files);
      }
      
      switch (framework.toLowerCase()) {
        case 'jest':
        case 'javascript':
        case 'js':
          command = `npx jest ${files.join(' ')}`;
          break;
        case 'pytest':
        case 'python':
          command = `python -m pytest ${files.join(' ')}`;
          break;
        case 'unittest':
          command = `python -m unittest ${files.join(' ')}`;
          break;
        case 'mocha':
          command = `npx mocha ${files.join(' ')}`;
          break;
        case 'vitest':
          command = `npx vitest run ${files.join(' ')}`;
          break;
        case 'rust':
          command = `cargo test ${files.join(' ')}`;
          break;
        case 'go':
          command = `go test ${files.join(' ')}`;
          break;
        case 'java':
          command = `mvn test`;
          break;
        default:
          throw new Error(`Unsupported testing framework: ${framework}`);
      }

      return new Promise((resolve, reject) => {
        exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
          spinner.stop();
          
          if (error) {
            reject(new Error(`Test execution error: ${error.message}\n${stderr}`));
            return;
          }
          
          resolve(`Test results:\n\n${stdout}\n\n${stderr ? 'Error output:\n' + stderr : ''}`);
        });
      });
    } catch (error) {
      spinner.stop();
      throw new Error(`Test execution failed: ${error.message}`);
    }
  }

  async analyze(code, language = 'javascript') {
    if (!code || code.trim() === '') {
      throw new Error('Code to analyze is required');
    }

    const spinner = ora('Analyzing code...').start();

    try {
      // Simple static analysis
      const issues = [];
      
      switch (language.toLowerCase()) {
        case 'javascript':
        case 'js':
          // Check for common issues
          if (code.includes('var ')) {
            issues.push(`Use 'let' or 'const' instead of 'var'`);
          }
          if (!code.includes('use strict') && !code.includes('"use strict"')) {
            issues.push(`Consider adding 'use strict' for better error handling`);
          }
          break;
        case 'python':
          if (code.includes('print ')) {
            issues.push('Use print() function instead of print statement');
          }
          break;
      }
      
      spinner.stop();
      
      if (issues.length === 0) {
        return 'Code looks good! No issues found.';
      }
      
      return `Code analysis issues found:\n\n- ${issues.join('\n- ')}`;
    } catch (error) {
      spinner.stop();
      throw new Error(`Code analysis failed: ${error.message}`);
    }
  }

  async debug(code, language = 'javascript') {
    if (!code || code.trim() === '') {
      throw new Error('Code to debug is required');
    }

    const spinner = ora('Debugging code...').start();

    try {
      // Simple debugging - check for common errors
      const errors = [];
      
      switch (language.toLowerCase()) {
        case 'javascript':
        case 'js':
          // Check for syntax errors
          if (code.includes(';') && !code.includes('function')) {
            errors.push('Missing function declaration');
          }
          if (code.includes('{') && !code.includes('}')) {
            errors.push('Missing closing brace');
          }
          const openParens = (code.match(/\(/g) || []).length;
          const closeParens = (code.match(/\)/g) || []).length;
          if (openParens > closeParens) {
            errors.push('Missing closing parenthesis');
          }
          break;
        case 'python':
          if (code.includes(':') && !code.includes('def ')) {
            errors.push('Colon used outside function definition');
          }
          break;
      }
      
      spinner.stop();
      
      if (errors.length === 0) {
        return 'No obvious syntax errors found. Code looks syntactically correct.';
      }
      
      return `Potential issues found:\n\n- ${errors.join('\n- ')}`;
    } catch (error) {
      spinner.stop();
      throw new Error(`Debugging failed: ${error.message}`);
    }
  }

  async format(code, language = 'javascript') {
    const spinner = ora('Formatting code...').start();
    
    try {
      let formattedCode = code;
      
      switch (language.toLowerCase()) {
        case 'javascript':
        case 'js':
          // Simple formatting - add semicolons and proper indentation
          formattedCode = formattedCode
            .split('\n')
            .map(line => line.trim())
            .join('\n')
            .replace(/\n{2,}/g, '\n\n');
          break;
        case 'python':
          // Simple formatting - ensure proper indentation
          formattedCode = formattedCode
            .split('\n')
            .map(line => line.trimEnd())
            .join('\n');
          break;
      }
      
      spinner.stop();
      return `Formatted code:\n\n${formattedCode}`;
    } catch (error) {
      spinner.stop();
      throw new Error(`Formatting failed: ${error.message}`);
    }
  }

  createTempFile(code, language) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitforked-'));
    const extension = this.getFileExtension(language);
    const tempFile = path.join(tempDir, `temp.${extension}`);
    
    fs.writeFileSync(tempFile, code);
    return tempFile;
  }

  getFileExtension(language) {
    const extensions = {
      javascript: 'js',
      js: 'js',
      python: 'py',
      py: 'py',
      typescript: 'ts',
      ts: 'ts',
      bash: 'sh',
      sh: 'sh',
      go: 'go',
      rust: 'rs',
      java: 'java'
    };
    
    return extensions[language.toLowerCase()] || 'js';
  }

  detectFramework(files) {
    for (const file of files) {
      if (file.includes('test') || file.includes('spec')) {
        if (file.endsWith('.test.js') || file.endsWith('.spec.js')) {
          return 'jest';
        }
        if (file.endsWith('.test.py') || file.endsWith('.spec.py')) {
          return 'pytest';
        }
      }
    }
    return 'jest'; // Default to Jest
  }

  async handleCodeCommand(command, args) {
    switch (command) {
      case 'run':
        const codeToRun = args[0];
        const language = args[1] || 'javascript';
        const input = args[2] || '';
        if (!codeToRun) throw new Error('Code to run is required');
        return await this.run(codeToRun, language, input);
      case 'test':
        const testFiles = args[0] ? args[0].split(',') : [];
        const testFramework = args[1] || 'auto';
        if (testFiles.length === 0) throw new Error('Test files are required');
        return await this.test(testFiles, testFramework);
      case 'analyze':
        const codeToAnalyze = args[0];
        const analyzeLanguage = args[1] || 'javascript';
        if (!codeToAnalyze) throw new Error('Code to analyze is required');
        return await this.analyze(codeToAnalyze, analyzeLanguage);
      case 'debug':
        const codeToDebug = args[0];
        const debugLanguage = args[1] || 'javascript';
        if (!codeToDebug) throw new Error('Code to debug is required');
        return await this.debug(codeToDebug, debugLanguage);
      case 'format':
        const codeToFormat = args[0];
        const formatLanguage = args[1] || 'javascript';
        if (!codeToFormat) throw new Error('Code to format is required');
        return await this.format(codeToFormat, formatLanguage);
      default:
        throw new Error(`Unknown code command: ${command}`);
    }
  }
}

// Export singleton instance
const codeTools = new CodeTools();
export { codeTools };