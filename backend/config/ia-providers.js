const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

const getIAClient = () => {
  const provider = process.env.IA_PROVIDER || 'claude';
  const apiKey = process.env.IA_API_KEY;

  switch (provider.toLowerCase()) {
    case 'claude':
    case 'anthropic':
      return {
        type: 'claude',
        client: new Anthropic({ apiKey }),
        model: process.env.IA_MODEL || 'claude-sonnet-4-6'
      };
    case 'openai':
      return {
        type: 'openai',
        client: new OpenAI({ apiKey }),
        model: process.env.IA_MODEL || 'gpt-4o'
      };
    default:
      return {
        type: 'claude',
        client: new Anthropic({ apiKey }),
        model: 'claude-sonnet-4-6'
      };
  }
};

const callIA = async (prompt, systemPrompt = '') => {
  const { type, client, model } = getIAClient();

  try {
    if (type === 'claude') {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt || 'Eres un experto analista de apuestas deportivas con 20 años de experiencia.',
        messages: [{ role: 'user', content: prompt }]
      });
      return response.content[0].text;
    } else if (type === 'openai') {
      const response = await client.chat.completions.create({
        model,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: systemPrompt || 'Eres un experto analista de apuestas deportivas con 20 años de experiencia.' },
          { role: 'user', content: prompt }
        ]
      });
      return response.choices[0].message.content;
    }
  } catch (err) {
    throw new Error(`IA API error (${type}): ${err.message}`);
  }
};

module.exports = { getIAClient, callIA };
