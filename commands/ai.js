const axios = require('axios');
require('dotenv').config();

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY || "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";
const NVIDIA_NIM_BASE = "https://integrate.api.nvidia.com/v1";
const NVIDIA_NIM_MODEL = process.env.NVIDIA_NIM_MODEL || "meta/llama-3.3-70b-instruct";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

async function callLLM(baseUrl, apiKey, model, messages) {
    const resp = await axios.post(`${baseUrl}/chat/completions`, {
        model, messages, temperature: 0.7, max_tokens: 1024, stream: false
    }, {
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
    try {
        return await callLLM(NVIDIA_NIM_BASE, NVIDIA_NIM_API_KEY, NVIDIA_NIM_MODEL, messages);
    } catch (e) {
        try { return await callLLM(OPENROUTER_BASE, OPENROUTER_API_KEY, OPENROUTER_MODEL, messages); }
        catch (e2) { return "Desole, l'IA est temporairement indisponible."; }
    }
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
