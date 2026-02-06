import fs from 'fs';
import path from 'path';
import os from 'os';

class Config {
  constructor() {
    this.configPath = path.join(os.homedir(), '.gitforked', 'config.json');
    this.ensureConfigDir();
    this.loadConfig();
  }

  ensureConfigDir() {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  loadConfig() {
    if (fs.existsSync(this.configPath)) {
      this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    } else {
      this.config = {
        provider: 'grok',
        apiKeys: {
          grok: process.env.GROK_API_KEY || '',
          groq: process.env.GROQ_API_KEY || '',
          gemini: process.env.GEMINI_API_KEY || '',
          claude: process.env.CLAUDE_API_KEY || ''
        },
        model: 'grok-4-1-fast-reasoning'
      };
      this.saveConfig();
    }
  }

  saveConfig() {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  get(key) {
    return this.config[key];
  }

  set(key, value) {
    this.config[key] = value;
    this.saveConfig();
  }

  getProvider() {
    return this.config.provider;
  }

  setProvider(provider) {
    this.config.provider = provider;
    this.saveConfig();
  }

  getApiKey(provider) {
    return this.config.apiKeys[provider];
  }

  setApiKey(provider, key) {
    this.config.apiKeys[provider] = key;
    this.saveConfig();
  }

  getModel() {
    return this.config.model;
  }

  setModel(model) {
    this.config.model = model;
    this.saveConfig();
  }

  list() {
    return { ...this.config };
  }
}

const config = new Config();
export { config };