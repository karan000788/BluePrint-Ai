const express = require('express');
const axios = require('axios');

const router = express.Router();

const getOllamaUrl = () => process.env.OLLAMA_HOST || process.env.OLLAMA_URL || 'http://localhost:11434';

const getActiveModel = async () => {
  try {
    const { data } = await axios.get(`${getOllamaUrl()}/api/tags`);
    if (data.models?.length) return data.models[0].name;
  } catch {}
  return process.env.OLLAMA_MODEL || 'llama3';
};

const callOllama = async (prompt, { format } = {}) => {
  const model = await getActiveModel();
  const OLLAMA_URL = getOllamaUrl();
  const { data } = await axios.post(
    `${OLLAMA_URL}/api/generate`,
    { model, prompt, stream: false, format },
    { timeout: 120000 }
  );
  return { model, response: data.response?.trim() };
};

const tryParseJSON = (str) => {
  try {
    const cleaned = str.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
};

router.post('/clarify', async (req, res) => {
  const { idea, message } = req.body;
  const rawIdea = (idea || message || '').trim();
  if (!rawIdea) return res.status(400).json({ success: false, message: 'idea/message is required' });

  const prompt = `You are Blueprint AI, a friendly prompt-engineering assistant.

Task: Decide if the user input is a prompt-creation request or a general conversational question.

User input: """${rawIdea}"""

Rules:
- If it is a greeting, small-talk, or a general knowledge / non-prompt question (e.g. "hello", "what is AI?", "tell me a joke"), respond conversationally as a helpful AI assistant. Return JSON: {"type":"chat","answer":"your natural friendly answer"}
- If it is a prompt-creation request (user wants to build/create/generate a prompt, e.g. "create a prompt for...", "I want an AI to...", "help me write..."), return 2-3 human-friendly clarification questions to refine the prompt. Each question must have 3-4 clickable option pills.
  Return JSON exactly in this shape (no markdown, no extra keys):
  {"type":"clarify","questions":[{"question":"...","options":["...","...","..."]}]}

Return ONLY valid JSON.`;

  try {
    const { model, response } = await callOllama(prompt, { format: 'json' });
    const parsed = tryParseJSON(response);
    if (!parsed) return res.json({ success: true, model, type: 'chat', answer: response });
    if (parsed.type === 'chat') return res.json({ success: true, model, ...parsed });
    if (parsed.type === 'clarify' && Array.isArray(parsed.questions)) {
      return res.json({ success: true, model, ...parsed });
    }
    return res.json({ success: true, model, type: 'chat', answer: response });
  } catch (err) {
    const OLLAMA_URL = getOllamaUrl();
    const msg = err.response?.data?.error || err.message;
    if (msg.includes('ECONNREFUSED'))
      return res.status(502).json({ success: false, message: 'Ollama not reachable at ' + OLLAMA_URL });
    res.status(500).json({ success: false, message: msg });
  }
});

router.post('/generate', async (req, res) => {
  const { idea, answers, context } = req.body;
  const rawIdea = (idea || '').trim();
  if (!rawIdea) return res.status(400).json({ success: false, message: 'idea is required' });

  const answersBlock = answers
    ? Array.isArray(answers)
      ? answers.map((a, i) => `Q${i + 1}: ${a.question || ''} | Answer: ${a.answer || a}`).join('\n')
      : JSON.stringify(answers)
    : context || 'No additional answers provided.';

  const prompt = `You are Blueprint AI, an expert prompt engineer.

User's original idea: """${rawIdea}"""

Clarification answers:
"""${answersBlock}"""

Instructions:
1. If the request is NOT about creating a prompt and is instead a general chat question, respond conversationally and helpfully. Return JSON: {"type":"chat","answer":"..."}
2. Otherwise, compile everything into the CREATE framework and return a final structured prompt.

CREATE Framework:
- C - Context: Background, domain, and situational context
- R - Role: Persona the AI should adopt
- E - Execution: Step-by-step task instructions
- A - Audience (Constraints): Rules, tone, limits, what to avoid
- T - Target Format: Output structure
- E - Example (optional, include if helpful)

Return ONLY valid JSON in this exact shape:
{
  "type": "prompt",
  "create": {
    "context": "...",
    "role": "...",
    "execution": "...",
    "constraints": "...",
    "targetFormat": "..."
  },
  "finalPrompt": "The fully compiled, copy-ready prompt combining all CREATE sections into one polished block",
  "title": "Short 3-6 word title for this prompt"
}

No markdown fences, no extra commentary.`;

  try {
    const { model, response } = await callOllama(prompt, { format: 'json' });
    const parsed = tryParseJSON(response);
    if (!parsed) return res.json({ success: true, model, type: 'prompt', finalPrompt: response });
    return res.json({ success: true, model, ...parsed });
  } catch (err) {
    const OLLAMA_URL = getOllamaUrl();
    const msg = err.response?.data?.error || err.message;
    if (msg.includes('ECONNREFUSED'))
      return res.status(502).json({ success: false, message: 'Ollama not reachable at ' + OLLAMA_URL });
    res.status(500).json({ success: false, message: msg });
  }
});

router.get('/models', async (req, res) => {
  try {
    const { data } = await axios.get(`${getOllamaUrl()}/api/tags`);
    res.json({ success: true, models: data.models || [] });
  } catch (err) {
    res.status(502).json({ success: false, message: err.message });
  }
});

module.exports = router;
