const axios = require('axios');
require('dotenv').config();

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY || "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";
const NVIDIA_NIM_BASE = "https://integrate.api.nvidia.com/v1";
const NVIDIA_NIM_MODEL = process.env.NVIDIA_NIM_MODEL || "meta/llama-3.3-70b-instruct";

async function getAIResponse(prompt) {
    if (!prompt || typeof prompt !== 'string') return "Invalid prompt.";

    try {
        const resp = await axios.post(`${NVIDIA_NIM_BASE}/chat/completions`, {
            model: NVIDIA_NIM_MODEL,
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 1024,
            top_p: 1,
            stream: false
        }, {
            headers: {
                "Authorization": `Bearer ${NVIDIA_NIM_API_KEY}`,
                "Content-Type": "application/json"
            },
            timeout: 30000
        });

        return resp.data.choices[0].message.content.trim();
    } catch (error) {
        console.error('[NVIDIA NIM Error]:', error.response?.status, error.message);
        if (error.response?.status === 429) return "⏳ Too many requests. Please try again later.";
        return "Sorry, I encountered an error connecting to the AI.";
    }
}

module.exports = {
    name: 'ai',
    description: 'Posez une question à l\'IA.',
    run: async ({ sock, msg, args, replyWithTag }) => {
        const question = args.join(" ");
        if (!question) return replyWithTag(sock, msg.key.remoteJid, msg, "❌ Posez une question. Ex: !ai Bonjour");

        try {
            const reply = await getAIResponse(question);
            await replyWithTag(sock, msg.key.remoteJid, msg, reply);
        } catch (error) {
            console.error(error);
            await replyWithTag(sock, msg.key.remoteJid, msg, `❌ Erreur API IA.`);
        }
    }
};
