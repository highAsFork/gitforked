import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ResponseFileWriter } from '../lib/response-file-writer.js';

describe('ResponseFileWriter', function() {
  let writer;
  let tmpDir;

  beforeEach(function() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfw-test-'));
    writer = new ResponseFileWriter(tmpDir);
  });

  afterEach(function() {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('extractFiles', function() {
    it('should extract files with lang:filepath pattern', function() {
      const response = 'Here is the file:\n```html:index.html\n<h1>Hello</h1>\n```\nDone.';
      const files = writer.extractFiles(response);
      expect(files).to.have.length(1);
      expect(files[0].filePath).to.equal('index.html');
      expect(files[0].content).to.equal('<h1>Hello</h1>');
      expect(files[0].language).to.equal('html');
    });

    it('should extract files with direct filepath pattern', function() {
      const response = 'Check this:\n```style.css\nbody { color: red; }\n```';
      const files = writer.extractFiles(response);
      expect(files).to.have.length(1);
      expect(files[0].filePath).to.equal('style.css');
    });

    it('should extract files with bold filename before block', function() {
      const response = '**index.html:**\n```html\n<h1>Test</h1>\n```';
      const files = writer.extractFiles(response);
      expect(files).to.have.length(1);
      expect(files[0].filePath).to.equal('index.html');
      expect(files[0].content).to.equal('<h1>Test</h1>');
    });

    it('should extract files with File: mention before block', function() {
      const response = 'File: `app.js`\n```javascript\nconsole.log("hi");\n```';
      const files = writer.extractFiles(response);
      expect(files).to.have.length(1);
      expect(files[0].filePath).to.equal('app.js');
    });

    it('should extract files with header before block', function() {
      const response = '### style.css\n```css\nbody{}\n```';
      const files = writer.extractFiles(response);
      expect(files).to.have.length(1);
      expect(files[0].filePath).to.equal('style.css');
    });

    it('should extract multiple files from one response', function() {
      const response = [
        '**index.html:**',
        '```html',
        '<h1>Hello</h1>',
        '```',
        '',
        '**style.css:**',
        '```css',
        'body { margin: 0; }',
        '```',
        '',
        '**script.js:**',
        '```javascript',
        'console.log("ready");',
        '```'
      ].join('\n');
      const files = writer.extractFiles(response);
      expect(files).to.have.length(3);
      expect(files[0].filePath).to.equal('index.html');
      expect(files[1].filePath).to.equal('style.css');
      expect(files[2].filePath).to.equal('script.js');
    });

    it('should handle subdirectory paths', function() {
      const response = '```javascript:src/utils/helper.js\nexport function help() {}\n```';
      const files = writer.extractFiles(response);
      expect(files).to.have.length(1);
      expect(files[0].filePath).to.equal('src/utils/helper.js');
    });

    it('should extract files with bare filename before block', function() {
      const response = 'index.html:\n```html\n<div>test</div>\n```';
      const files = writer.extractFiles(response);
      expect(files).to.have.length(1);
      expect(files[0].filePath).to.equal('index.html');
    });

    it('should return empty array for responses with no file patterns', function() {
      const response = 'Here is some code:\n```javascript\nlet x = 1;\n```';
      const files = writer.extractFiles(response);
      expect(files).to.have.length(0);
    });

    it('should handle comment-style filename in first line', function() {
      const response = '```html\n<!-- index.html -->\n<h1>Hi</h1>\n```';
      const files = writer.extractFiles(response);
      expect(files).to.have.length(1);
      expect(files[0].filePath).to.equal('index.html');
      expect(files[0].content).to.equal('<h1>Hi</h1>');
    });
  });

  describe('writeFiles', function() {
    it('should write files to disk', function() {
      const files = [{ filePath: 'test.html', content: '<h1>Hi</h1>', language: 'html' }];
      const written = writer.writeFiles(files);
      expect(written).to.have.length(1);
      const content = fs.readFileSync(path.join(tmpDir, 'test.html'), 'utf-8');
      expect(content).to.equal('<h1>Hi</h1>');
    });

    it('should create subdirectories', function() {
      const files = [{ filePath: 'src/css/style.css', content: 'body{}', language: 'css' }];
      const written = writer.writeFiles(files);
      expect(written).to.have.length(1);
      expect(fs.existsSync(path.join(tmpDir, 'src/css/style.css'))).to.be.true;
    });

    it('should not write outside base directory', function() {
      const files = [{ filePath: '../../../etc/evil', content: 'bad', language: null }];
      const written = writer.writeFiles(files);
      expect(written).to.have.length(0);
    });
  });

  describe('processResponse', function() {
    it('should parse and write files in one call', function() {
      const response = '**app.js:**\n```javascript\nconsole.log("hello");\n```';
      const written = writer.processResponse(response);
      expect(written).to.have.length(1);
      expect(written[0]).to.equal('app.js');
      const content = fs.readFileSync(path.join(tmpDir, 'app.js'), 'utf-8');
      expect(content).to.equal('console.log("hello");');
    });
  });
});
