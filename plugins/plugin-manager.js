import fs from 'fs';
import path from 'path';

class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.pluginDir = path.join(process.cwd(), 'plugins');
  }

  async initialize() {
    await this.loadPlugins();
  }

  async loadPlugins() {
    if (!fs.existsSync(this.pluginDir)) {
      return;
    }

    const pluginFiles = fs.readdirSync(this.pluginDir).filter(file =>
      file.endsWith('.js') || file.endsWith('.mjs')
    );

    for (const file of pluginFiles) {
      try {
        const pluginPath = path.join(this.pluginDir, file);
        const pluginModule = await import(pluginPath);

        if (pluginModule && pluginModule.name && pluginModule.execute) {
          this.plugins.set(pluginModule.name, pluginModule);
          console.log(`Loaded plugin: ${pluginModule.name}`);
        }
      } catch (error) {
        console.error(`Failed to load plugin ${file}:`, error.message);
      }
    }
  }

  executePlugin(name, args, context) {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`);
    }

    return plugin.execute(args, context);
  }

  listPlugins() {
    return Array.from(this.plugins.keys());
  }

  getPlugin(name) {
    return this.plugins.get(name);
  }
}

// Export class - create instance and initialize in the TUI
export { PluginManager };