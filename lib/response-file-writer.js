import fs from 'fs';
import path from 'path';

/**
 * Parses agent responses for markdown code blocks with file paths
 * and writes them to disk. Supports patterns like:
 *
 *   ```html:index.html          (lang:filepath)
 *   ```index.html                (direct filepath)
 *   **index.html:**\n```html     (filename before block)
 *   File: `index.html`\n```html  (File: mention before block)
 *   <!-- index.html -->\n inside block first line
 */
class ResponseFileWriter {
  constructor(baseDir) {
    this.baseDir = baseDir || process.cwd();
  }

  /**
   * Parse a response and extract file blocks.
   * Returns array of { filePath, content, language }
   */
  extractFiles(response) {
    const files = [];
    const lines = response.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Match opening code fence
      const fenceMatch = line.match(/^```(\S*)?$/);
      if (!fenceMatch) {
        i++;
        continue;
      }

      const fenceInfo = fenceMatch[1] || '';
      let filePath = null;
      let language = null;

      // Pattern 1: ```lang:filepath  or ```filepath
      if (fenceInfo.includes(':')) {
        const colonIdx = fenceInfo.indexOf(':');
        language = fenceInfo.slice(0, colonIdx);
        filePath = fenceInfo.slice(colonIdx + 1).trim();
      } else if (fenceInfo.includes('.') || fenceInfo.includes('/')) {
        // Direct filepath like ```index.html or ```src/app.js
        filePath = fenceInfo.trim();
      } else {
        language = fenceInfo || null;
      }

      // Pattern 2: Look at previous lines for filename hints
      if (!filePath) {
        for (let back = 1; back <= 3 && (i - back) >= 0; back++) {
          const prev = lines[i - back].trim();
          if (!prev) continue;

          // **filename.ext:** or **filename.ext** or **filename.ext:**(colon inside)
          const boldMatch = prev.match(/\*\*([^\s*]+\.\w+):?\*\*:?/);
          if (boldMatch) { filePath = boldMatch[1]; break; }

          // File: `filename.ext` or File: filename.ext
          const fileMatch = prev.match(/(?:file|create|save|write)[:\s]+`?([^\s`]+\.\w+)`?/i);
          if (fileMatch) { filePath = fileMatch[1]; break; }

          // filename.ext:  (bare filename ending with colon)
          const bareMatch = prev.match(/^([^\s]+\.\w+)\s*:?\s*$/);
          if (bareMatch) { filePath = bareMatch[1]; break; }

          // ### filename.ext or ## filename.ext
          const headerMatch = prev.match(/^#{1,4}\s+`?([^\s`]+\.\w+)`?/);
          if (headerMatch) { filePath = headerMatch[1]; break; }
        }
      }

      // Collect content until closing fence
      i++;
      const contentLines = [];
      while (i < lines.length && !lines[i].match(/^```\s*$/)) {
        contentLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence

      // Pattern 3: Check first line of content for <!-- filename --> or // filename
      if (!filePath && contentLines.length > 0) {
        const first = contentLines[0].trim();
        const commentMatch = first.match(/(?:<!--|\/\/|#)\s*([^\s]+\.\w+)\s*(?:-->)?/);
        if (commentMatch) {
          filePath = commentMatch[1];
          contentLines.shift(); // remove the comment line
        }
      }

      if (filePath) {
        // Clean up filepath
        filePath = filePath.replace(/^[`'"]+|[`'"]+$/g, '');
        files.push({
          filePath,
          content: contentLines.join('\n'),
          language: language || this.guessLanguage(filePath)
        });
      }
    }

    return files;
  }

  /**
   * Write extracted files to disk. Returns array of written paths.
   */
  writeFiles(files, baseDir) {
    const dir = baseDir || this.baseDir;
    const written = [];

    for (const file of files) {
      try {
        const fullPath = path.resolve(dir, file.filePath);

        // Safety: don't write outside base directory
        if (!fullPath.startsWith(path.resolve(dir))) {
          continue;
        }

        // Create directories
        const fileDir = path.dirname(fullPath);
        if (!fs.existsSync(fileDir)) {
          fs.mkdirSync(fileDir, { recursive: true });
        }

        fs.writeFileSync(fullPath, file.content, 'utf-8');
        written.push(file.filePath);
      } catch (err) {
        // Skip files that fail to write
      }
    }

    return written;
  }

  /**
   * Parse response and write any found files. Returns list of written paths.
   */
  processResponse(response, baseDir) {
    const files = this.extractFiles(response);
    if (files.length === 0) return [];
    return this.writeFiles(files, baseDir);
  }

  guessLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
      '.html': 'html', '.htm': 'html',
      '.css': 'css',
      '.js': 'javascript', '.mjs': 'javascript',
      '.ts': 'typescript', '.tsx': 'typescript',
      '.json': 'json',
      '.py': 'python',
      '.rb': 'ruby',
      '.sh': 'bash', '.bash': 'bash',
      '.md': 'markdown',
      '.yaml': 'yaml', '.yml': 'yaml',
      '.xml': 'xml',
      '.sql': 'sql',
    };
    return map[ext] || null;
  }
}

export { ResponseFileWriter };
