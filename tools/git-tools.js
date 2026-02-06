import { exec } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

class GitTools {
  async status() {
    const spinner = ora('Checking git status...').start();
    return new Promise((resolve, reject) => {
      exec('git status --porcelain', (error, stdout, stderr) => {
        spinner.stop();
        if (error) {
          reject(new Error(`Git error: ${error.message}`));
          return;
        }
        
        if (stdout.trim() === '') {
          resolve('Working directory is clean');
        } else {
          resolve(`Git status:\n\n${stdout}`);
        }
      });
    });
  }

  async commit(message, files = []) {
    const spinner = ora('Creating git commit...').start();
    return new Promise((resolve, reject) => {
      let command = 'git commit -m ';
      command += files.length > 0 ? 'git add ' + files.join(' ') + ' && git commit -m ' : 'git commit -m ';
      command += `'${message}'`;
      
      exec(command, (error, stdout, stderr) => {
        spinner.stop();
        if (error) {
          reject(new Error(`Git commit error: ${error.message}`));
          return;
        }
        
        resolve(`Commit created successfully:\n\n${stdout}`);
      });
    });
  }

  async push(remote = 'origin', branch = 'main') {
    const spinner = ora('Pushing to remote...').start();
    return new Promise((resolve, reject) => {
      exec(`git push ${remote} ${branch}`, (error, stdout, stderr) => {
        spinner.stop();
        if (error) {
          reject(new Error(`Git push error: ${error.message}`));
          return;
        }
        
        resolve(`Pushed successfully to ${remote}/${branch}\n\n${stdout}`);
      });
    });
  }

  async pull(remote = 'origin', branch = 'main') {
    const spinner = ora('Pulling from remote...').start();
    return new Promise((resolve, reject) => {
      exec(`git pull ${remote} ${branch}`, (error, stdout, stderr) => {
        spinner.stop();
        if (error) {
          reject(new Error(`Git pull error: ${error.message}`));
          return;
        }
        
        resolve(`Pulled successfully from ${remote}/${branch}\n\n${stdout}`);
      });
    });
  }

  async add(files) {
    const spinner = ora('Adding files to git...').start();
    return new Promise((resolve, reject) => {
      const command = 'git add ' + files.join(' ');
      exec(command, (error, stdout, stderr) => {
        spinner.stop();
        if (error) {
          reject(new Error(`Git add error: ${error.message}`));
          return;
        }
        
        resolve(`Files added successfully:\n\n${stdout}`);
      });
    });
  }

  async checkout(branch) {
    const spinner = ora('Switching branch...').start();
    return new Promise((resolve, reject) => {
      exec(`git checkout ${branch}`, (error, stdout, stderr) => {
        spinner.stop();
        if (error) {
          reject(new Error(`Git checkout error: ${error.message}`));
          return;
        }
        
        resolve(`Switched to branch ${branch}\n\n${stdout}`);
      });
    });
  }

  async createBranch(branch) {
    const spinner = ora('Creating new branch...').start();
    return new Promise((resolve, reject) => {
      exec(`git checkout -b ${branch}`, (error, stdout, stderr) => {
        spinner.stop();
        if (error) {
          reject(new Error(`Git branch error: ${error.message}`));
          return;
        }
        
        resolve(`Created and switched to new branch ${branch}\n\n${stdout}`);
      });
    });
  }

  async merge(branch) {
    const spinner = ora('Merging branch...').start();
    return new Promise((resolve, reject) => {
      exec(`git merge ${branch}`, (error, stdout, stderr) => {
        spinner.stop();
        if (error) {
          reject(new Error(`Git merge error: ${error.message}`));
          return;
        }
        
        resolve(`Merged ${branch} into current branch\n\n${stdout}`);
      });
    });
  }

  async handleGitCommand(command, args) {
    switch (command) {
      case 'status':
        return await this.status();
      case 'commit':
        const message = args[0];
        const files = args.slice(1);
        if (!message) throw new Error('Commit message is required');
        return await this.commit(message, files);
      case 'push':
        const remote = args[0] || 'origin';
        const branch = args[1] || 'main';
        return await this.push(remote, branch);
      case 'pull':
        const pullRemote = args[0] || 'origin';
        const pullBranch = args[1] || 'main';
        return await this.pull(pullRemote, pullBranch);
      case 'add':
        if (args.length === 0) throw new Error('Files to add are required');
        return await this.add(args);
      case 'checkout':
        if (args.length === 0) throw new Error('Branch name is required');
        return await this.checkout(args[0]);
      case 'branch':
        if (args.length === 0) throw new Error('Branch name is required');
        return await this.createBranch(args[0]);
      case 'merge':
        if (args.length === 0) throw new Error('Branch name is required');
        return await this.merge(args[0]);
      default:
        throw new Error(`Unknown git command: ${command}`);
    }
  }
}

// Export singleton instance
const gitTools = new GitTools();
export { gitTools };