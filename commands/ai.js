const axios = require('axios');
require('dotenv').config();

// Providers disponibles — utilisés dans l'ordre, le premier avec une clé valide répond
const PROVIDERS = [
    {
        name: 'Groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    },
    {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    {
        name: 'NVIDIA NIM',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        apiKey: process.env.NVIDIA_NIM_API_KEY,
        model: process.env.NVIDIA_NIM_MODEL || 'meta/llama-3.3-70b-instruct',
    },
    {
        name: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        model: 'meta-llama/llama-3.3-70b-instruct:free',
    },
].filter(p => p.apiKey);

async function callLLM(provider, messages) {
    const resp = await axios.post(`${provider.baseUrl}/chat/completions`, {
        model: provider.model, messages, temperature: 0.7, max_tokens: 1024, stream: false
    }, {
        headers: { "Authorization": `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
        timeout: 45000
    });
    return resp.data.choices[0].message.content.trim();
}

async function getAIResponse(prompt) {
    if (!prompt || typeof prompt !== 'string') return "Invalid prompt.";
    const messages = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt }
    ];
    if (PROVIDERS.length === 0) {
        console.error('[AI] Aucune clé API configurée (GROQ_API_KEY, OPENAI_API_KEY, NVIDIA_NIM_API_KEY ou OPENROUTER_API_KEY).');
        return "Desole, l'IA est temporairement indisponible.";
    }
    for (const provider of PROVIDERS) {
        try {
            const reply = await callLLM(provider, messages);
            console.log(`[AI] ✅ Réponse via ${provider.name} (${provider.model})`);
            return reply;
        } catch (e) {
            console.error(`[AI ${provider.name}] Erreur: ${e.response?.status || e.code || ''} ${e.message}`);
        }
    }
    return "Desole, l'IA est temporairement indisponible.";
}

module.exports = {
    name: 'ai',
    description: 'Posez une question a l\'IA.',
    run: async ({ sock, msg, args, replyWithTag }) => {
        const question = args.join(" ");
        if (!question) return replyWithTag(sock, msg.key.remoteJid, msg, "❌ Posez une question. Ex: !ai Bonjour");
        try {
            await sock.sendPresenceUpdate('composing', msg.key.remoteJid);
            const reply = await getAIResponse(question);
            await replyWithTag(sock, msg.key.remoteJid, msg, reply);
        } catch (error) {
            console.error(error);
            await replyWithTag(sock, msg.key.remoteJid, msg, "❌ Erreur API IA.");
        }
    }
};
