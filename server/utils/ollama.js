const axios = require('axios');

const OLLAMA_URL = process.env.OLLAMA_HOST || process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'deepseek-r1:1.5b';

const getActiveModel = async () => {
  try {
    const { data } = await axios.get(`${OLLAMA_URL}/api/tags`);
    if (data.models?.length) return data.models[0].name;
  } catch {}
  return OLLAMA_MODEL;
};

const ollamaGenerate = async (prompt, opts = {}) => {
  const model = opts.model || (await getActiveModel());
  const { data } = await axios.post(
    `${OLLAMA_URL}/api/generate`,
    {
      model,
      prompt,
      stream: false,
      format: opts.format || undefined,
      options: { temperature: opts.temperature ?? 0.7, ...opts.options }
    },
    { timeout: 120000 }
  );
  return data.response?.trim();
};

module.exports = { getActiveModel, ollamaGenerate };
