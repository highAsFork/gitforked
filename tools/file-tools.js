import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const fileTools = {
  async readFile(filePath) {
    try {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      const content = fs.readFileSync(absolutePath, 'utf8');
      return content;
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  },

  async writeFile(filePath, content) {
    try {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
      const dir = path.dirname(absolutePath);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(absolutePath, content, 'utf8');
      return `File written successfully: ${filePath}`;
    } catch (error) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  },

  async editFile(filePath, changes) {
    try {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      // Read current content
      const currentContent = fs.readFileSync(absolutePath, 'utf8');
      
      // Apply changes (simple string replacement for now)
      const newContent = currentContent.replace(changes, '');
      
      fs.writeFileSync(absolutePath, newContent, 'utf8');
      return `File edited successfully: ${filePath}`;
    } catch (error) {
      throw new Error(`Failed to edit file: ${error.message}`);
    }
  },

  async createFile(filePath) {
    try {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
      const dir = path.dirname(absolutePath);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Create empty file
      fs.writeFileSync(absolutePath, '', 'utf8');
      return `File created successfully: ${filePath}`;
    } catch (error) {
      throw new Error(`Failed to create file: ${error.message}`);
    }
  },

  async deleteFile(filePath) {
    try {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      fs.unlinkSync(absolutePath);
      return `File deleted successfully: ${filePath}`;
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  },

  async listFiles(directoryPath) {
    try {
      const absolutePath = path.isAbsolute(directoryPath) ? directoryPath : path.join(process.cwd(), directoryPath);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Directory not found: ${directoryPath}`);
      }
      
      const files = fs.readdirSync(absolutePath, { withFileTypes: true });
      const result = files.map(file => {
        const fullPath = path.join(absolutePath, file.name);
        const stats = fs.statSync(fullPath);
        return {
          name: file.name,
          path: fullPath,
          isDirectory: file.isDirectory(),
          size: stats.size,
          modified: stats.mtime
        };
      });
      
      return result;
    } catch (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }
  },

  async searchFiles(directoryPath, pattern) {
    try {
      const absolutePath = path.isAbsolute(directoryPath) ? directoryPath : path.join(process.cwd(), directoryPath);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Directory not found: ${directoryPath}`);
      }
      
      const files = [];
      
      function traverseDirectory(dir) {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          
          if (item.isDirectory()) {
            traverseDirectory(fullPath);
          } else {
            if (pattern.test(item.name)) {
              files.push(fullPath);
            }
          }
        }
      }
      
      traverseDirectory(absolutePath);
      return files;
    } catch (error) {
      throw new Error(`Failed to search files: ${error.message}`);
    }
  }
};