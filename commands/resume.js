const axios = require('axios');
require('dotenv').config();

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY || "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";
const NVIDIA_NIM_BASE = "https://integrate.api.nvidia.com/v1";
const NVIDIA_NIM_MODEL = process.env.NVIDIA_NIM_MODEL || "meta/llama-3.3-70b-instruct";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

module.exports = {
    name: 'resume',
    description: 'Resume un long texte via IA. Usage: !resume <texte> ou repondre a un message',
    run: async ({ sock, msg, args, replyWithTag }) => {
        let textToSummarize = args.join(" ");

        if (!textToSummarize) {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted) {
                textToSummarize = quoted.conversation || quoted.extendedTextMessage?.text || "";
            }
        }

        if (!textToSummarize || textToSummarize.length < 50) {
            return replyWithTag(sock, msg.key.remoteJid, msg, "❌ Texte trop court. Usage: !resume <long texte>\nOu repondez a un message avec !resume");
        }

        try {
            await sock.sendPresenceUpdate('composing', msg.key.remoteJid);

            const messages = [
                { role: "system", content: "Tu es un assistant qui resume des textes de maniere claire et concise en francais. Donne les points cles en bullet points. Maximum 5 bullet points." },
                { role: "user", content: `Resume ce texte:\n\n${textToSummarize.substring(0, 3000)}` }
            ];

            let summary;
            try {
                const resp = await axios.post(`${NVIDIA_NIM_BASE}/chat/completions`, {
                    model: NVIDIA_NIM_MODEL, messages, temperature: 0.3, max_tokens: 512, stream: false
                }, { headers: { "Authorization": `Bearer ${NVIDIA_NIM_API_KEY}`, "Content-Type": "application/json" }, timeout: 45000 });
                summary = resp.data.choices[0].message.content.trim();
            } catch (e) {
                const resp = await axios.post(`${OPENROUTER_BASE}/chat/completions`, {
                    model: OPENROUTER_MODEL, messages, temperature: 0.3, max_tokens: 512, stream: false
                }, { headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" }, timeout: 45000 });
                summary = resp.data.choices[0].message.content.trim();
            }
            await sock.sendMessage(msg.key.remoteJid, {
                text: `📋 *Resume*\n━━━━━━━━━━━━━━\n${summary}`
            }, { quoted: msg });
        } catch (err) {
            console.error('[Resume]', err.message);
            await replyWithTag(sock, msg.key.remoteJid, msg, "❌ Erreur lors du resume.");
        }
    }
};
