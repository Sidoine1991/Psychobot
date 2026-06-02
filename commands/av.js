const axios = require('axios');
require('dotenv').config();

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY || "";
const NVIDIA_NIM_BASE = "https://integrate.api.nvidia.com/v1";
const NVIDIA_NIM_MODEL = process.env.NVIDIA_NIM_MODEL || "meta/llama-3.3-70b-instruct";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

async function callLLM(baseUrl, apiKey, model, messages) {
    const resp = await axios.post(`${baseUrl}/chat/completions`, {
        model, messages, temperature: 0.9, max_tokens: 512, stream: false
    }, {
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        timeout: 45000
    });
    return resp.data.choices[0].message.content.trim();
}

async function getAIResponse(prompt) {
    if (!prompt || typeof prompt !== 'string') return null;
    const messages = [
        { role: "system", content: "You are a fun game host for Action or Verite (Truth or Dare). Public is adult. Be provocative and engaging. Always answer in French." },
        { role: "user", content: prompt }
    ];
    try {
        return await callLLM(NVIDIA_NIM_BASE, NVIDIA_NIM_API_KEY, NVIDIA_NIM_MODEL, messages);
    } catch (e) {
        try { return await callLLM(OPENROUTER_BASE, OPENROUTER_API_KEY, OPENROUTER_MODEL, messages); }
        catch (e2) { return null; }
    }
}

module.exports = {
    name: "av",
    description: "Jeu Action ou Verite (Automatique).",
    run: async ({ sock, msg, args, replyWithTag }) => {
        const remoteJid = msg.key.remoteJid;
        const type = args[0] ? args[0].toLowerCase() : null;
        if (type !== 'action' && type !== 'verite' && type !== 'vérité') {
            return await replyWithTag(sock, remoteJid, msg,
                `*🔞 JEU ACTION OU VERITE 🔞*\n\n👉 *!av action* : Pour un defi.\n👉 *!av verite* : Pour une question.\n\n⚠️ *Amusant, Culturel ou Ose !*`);
        }
        try {
            await sock.sendPresenceUpdate('composing', remoteJid);
            const challenge = await getAIResponse(`Genere une seule proposition "${type}" pour un jeu Action ou Verite. Varie: drole, culture generale, provocateur adulte, social. Donne UNIQUEMENT le texte.`);
            if (!challenge) return await replyWithTag(sock, remoteJid, msg, "❌ L'IA est indisponible.");
            await sock.sendMessage(remoteJid, { text: `*🔞 ACTION OU VERITE 🔞*\n\n*Type:* ${type.toUpperCase()}\n*Challenge:* ${challenge}\n\nAlors, cap ou pas cap ? 😏` }, { quoted: msg });
        } catch (err) {
            await replyWithTag(sock, remoteJid, msg, "❌ Une erreur est survenue.");
        }
    }
};
