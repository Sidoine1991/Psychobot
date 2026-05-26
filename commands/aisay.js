const axios = require('axios');
const { convertToOpus } = require('../src/lib/audioHelper');
const fs = require('fs');
require('dotenv').config();

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY || "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";
const NVIDIA_NIM_BASE = "https://integrate.api.nvidia.com/v1";
const NVIDIA_NIM_MODEL = process.env.NVIDIA_NIM_MODEL || "meta/llama-3.3-70b-instruct";

async function getAIResponse(prompt) {
    if (!prompt || typeof prompt !== 'string') return "Invalid.";

    try {
        const resp = await axios.post(`${NVIDIA_NIM_BASE}/chat/completions`, {
            model: NVIDIA_NIM_MODEL,
            messages: [
                { role: "system", content: "You are a helpful assistant. Keep your answer concise (max 500 chars)." },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 512,
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
        return "I'm sorry, I can't generate a voice response right now.";
    }
}

module.exports = {
    name: "aisay",
    description: "L'IA vous repond par message vocal.",
    run: async ({ sock, msg, args, replyWithTag }) => {
        const question = args.join(" ");
        if (!question) return replyWithTag(sock, msg.key.remoteJid, msg, "❌ Veuillez poser une question.");

        try {
            const reply = await getAIResponse(question);

            const encoded = encodeURIComponent(reply.substring(0, 500));
            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=fr&client=tw-ob`;

            try {
                const audioPath = await convertToOpus(ttsUrl);

                await sock.sendMessage(msg.key.remoteJid, {
                    audio: { url: audioPath },
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt: true
                }, { quoted: msg });

                fs.unlinkSync(audioPath);
            } catch (e) {
                console.error("Audio Convert Error:", e);
                await replyWithTag(sock, msg.key.remoteJid, msg, "❌ Erreur conversion audio.");
            }

        } catch (error) {
            console.error(error);
            await replyWithTag(sock, msg.key.remoteJid, msg, "❌ Impossible de generer la voix.");
        }
    },
    onMessage: async (sock, msg, text) => {
        const lowerText = text.toLowerCase().trim();
        const triggers = ["ai", "psychobot", "psycho bot"];

        const hasTrigger = triggers.some(t => lowerText === t || lowerText.startsWith(t + " "));

        const isFromOwner = msg.key.fromMe || (process.env.OWNER_NUMBER && process.env.OWNER_NUMBER.includes(msg.key.participant?.split('@')[0]));

        if (isFromOwner) return false;

        if (hasTrigger) {
            console.log(`[AiSay] Triggered by keyword: ${lowerText}`);

            const prompt = text;

            try {
                const generateAndSend = async () => {
                    const { convertToOpus } = require('../src/lib/audioHelper');
                    const fs = require('fs');

                    const reply = await getAIResponse(prompt);
                    if (!reply || reply === "Invalid." || reply.includes("can't generate")) return;

                    const encoded = encodeURIComponent(reply.substring(0, 500));
                    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=fr&client=tw-ob`;

                    const audioPath = await convertToOpus(ttsUrl);

                    await sock.sendMessage(msg.key.remoteJid, {
                        audio: { url: audioPath },
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt: true
                    }, { quoted: msg });

                    fs.unlinkSync(audioPath);
                };

                await generateAndSend();
                return true;
            } catch (e) {
                console.error("[AiSay Passive] Error:", e);
            }
        }
        return false;
    }
};
