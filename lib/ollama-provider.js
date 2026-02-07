import axios from 'axios';

class OllamaProvider {
  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 5000
    });
  }

  async listModels() {
    try {
      const response = await this.client.get('/api/tags');
      const models = response.data.models || [];
      return models.map(m => ({
        name: m.name,
        size: m.size,
        modifiedAt: m.modified_at,
        digest: m.digest,
        details: m.details || {}
      }));
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        return [];
      }
      throw new Error(`Ollama API error: ${error.message}`);
    }
  }

  async isAvailable() {
    try {
      const response = await this.client.get('/api/tags');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getModelNames() {
    const models = await this.listModels();
    return models.map(m => m.name);
  }

  formatModelSize(bytes) {
    if (!bytes) return 'unknown';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)}GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)}MB`;
  }

  async getModelInfo() {
    const models = await this.listModels();
    return models.map(m => ({
      name: m.name,
      displaySize: this.formatModelSize(m.size),
      family: m.details?.family || 'unknown',
      parameterSize: m.details?.parameter_size || 'unknown',
      quantization: m.details?.quantization_level || 'unknown'
    }));
  }
}

export { OllamaProvider };
