import path from 'path';
import fs from 'fs';
import { URL } from 'url';

class ToolSandbox {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.safeMode = options.safeMode ?? true;
    this.maxRounds = options.maxRounds || 10;
    this.maxToolCallsPerRound = options.maxToolCallsPerRound || 5;
    this.bashTimeout = options.bashTimeout || 10000;
    this.maxResultSize = options.maxResultSize || 10240;
    this.toolLog = [];

    // Blocked bash patterns (deny-list)
    this.blockedCommands = [
      /\brm\s+(-rf?|--recursive)\s+[\/~]/,
      /\bmkfs\b/,
      /\bdd\b.*of=\/dev/,
      />\s*\/dev\/sd/,
      /\bshutdown\b/,
      /\breboot\b/,
      /\bcurl\b.*\|\s*(ba)?sh/,
      /\bwget\b.*\|\s*(ba)?sh/,
      /\bnc\s+-[le]/,
      /\bchmod\s+[0-7]*[67][0-7]{2}\s+\//,
      /\bchown\b.*\//,
      /\b(sudo|su)\s/,
      /[;&|]\s*(curl|wget|nc|ncat)\b/
    ];

    // Allowed path prefixes for read/write/edit/glob/grep
    this.allowedPaths = [
      path.resolve(this.projectRoot)
    ];

    // Blocked URL patterns for webfetch (SSRF protection)
    this.blockedHosts = [
      /^localhost$/i,
      /^127\./,
      /^0\.0\.0\.0$/,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^::1$/,
      /^fd[0-9a-f]{2}:/i,
      /metadata\.google\.internal/
    ];
  }

  validatePath(filePath) {
    try {
      const resolved = path.resolve(this.projectRoot, filePath);

      // Resolve symlinks — use parent dir if file doesn't exist yet
      let realPath;
      try {
        realPath = fs.realpathSync(resolved);
      } catch {
        // File doesn't exist yet — resolve parent directory
        const parentDir = path.dirname(resolved);
        try {
          const realParent = fs.realpathSync(parentDir);
          realPath = path.join(realParent, path.basename(resolved));
        } catch {
          realPath = resolved;
        }
      }

      // Check against allowed paths
      const allowed = this.allowedPaths.some(ap => realPath.startsWith(ap));
      if (!allowed) {
        return { allowed: false, reason: `Path outside project root: ${realPath}` };
      }

      return { allowed: true, resolvedPath: realPath };
    } catch (error) {
      return { allowed: false, reason: `Path validation error: ${error.message}` };
    }
  }

  validateBash(command) {
    // Check against blocked command patterns
    for (const pattern of this.blockedCommands) {
      if (pattern.test(command)) {
        return { allowed: false, reason: `Blocked command pattern: ${pattern}` };
      }
    }

    // In safe mode, block network and install commands
    if (this.safeMode) {
      const networkPatterns = [
        /\bcurl\b/,
        /\bwget\b/,
        /\bnc\b/,
        /\bncat\b/,
        /\bssh\b/,
        /\bscp\b/,
        /\bsftp\b/
      ];
      for (const pattern of networkPatterns) {
        if (pattern.test(command)) {
          return { allowed: false, reason: `Network command blocked in safe mode: ${command.match(pattern)[0]}` };
        }
      }

      const installPatterns = [
        /\bnpm\s+install\b/,
        /\bpip\s+install\b/,
        /\bapt\s+(install|get)\b/,
        /\byum\s+install\b/,
        /\bbrew\s+install\b/
      ];
      for (const pattern of installPatterns) {
        if (pattern.test(command)) {
          return { allowed: false, reason: `Install command blocked in safe mode: ${command.match(pattern)[0]}` };
        }
      }
    }

    return { allowed: true, sanitizedCommand: command };
  }

  validateUrl(url) {
    try {
      const parsed = new URL(url);

      // Reject non-http(s) schemes
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { allowed: false, reason: `Blocked protocol: ${parsed.protocol}` };
      }

      // Check hostname against blocked hosts
      const hostname = parsed.hostname;
      for (const pattern of this.blockedHosts) {
        if (pattern.test(hostname)) {
          return { allowed: false, reason: `Blocked host: ${hostname}` };
        }
      }

      // In safe mode, reject non-standard ports
      if (this.safeMode) {
        const port = parsed.port;
        if (port && port !== '80' && port !== '443') {
          return { allowed: false, reason: `Non-standard port blocked in safe mode: ${port}` };
        }
      }

      return { allowed: true };
    } catch (error) {
      return { allowed: false, reason: `Invalid URL: ${error.message}` };
    }
  }

  truncateResult(result) {
    if (typeof result !== 'string') {
      result = JSON.stringify(result);
    }
    if (result.length <= this.maxResultSize) {
      return result;
    }
    const headSize = 5120;
    const tailSize = 2048;
    return result.slice(0, headSize) + '\n...[TRUNCATED]...\n' + result.slice(-tailSize);
  }

  logToolCall(agentId, toolName, args, result, success) {
    this.toolLog.push({
      timestamp: new Date().toISOString(),
      agentId,
      toolName,
      args: this._sanitizeArgs(args),
      resultPreview: typeof result === 'string' ? result.slice(0, 200) : JSON.stringify(result).slice(0, 200),
      success
    });
  }

  _sanitizeArgs(args) {
    if (!args) return {};
    const sanitized = { ...args };
    // Truncate large content fields
    if (sanitized.content && sanitized.content.length > 200) {
      sanitized.content = sanitized.content.slice(0, 200) + '...[truncated]';
    }
    return sanitized;
  }

  getStats() {
    const callsByTool = {};
    const callsByAgent = {};
    let errors = 0;

    for (const entry of this.toolLog) {
      callsByTool[entry.toolName] = (callsByTool[entry.toolName] || 0) + 1;
      if (entry.agentId) {
        callsByAgent[entry.agentId] = (callsByAgent[entry.agentId] || 0) + 1;
      }
      if (!entry.success) errors++;
    }

    return {
      totalCalls: this.toolLog.length,
      callsByTool,
      callsByAgent,
      errors
    };
  }
}

export { ToolSandbox };
