// commands/careerops.js — K_JobAgent / Career-Ops aide rapide

const SHEETS_URL = process.env.CAREER_OPS_SHEETS_URL
    || 'https://docs.google.com/spreadsheets/d/1Hjy8UDug0VfY0VCGV8Mbrmez1q2SwH0c6oe1_9ST7JE/edit';

const BOT_PUBLIC = process.env.PSYCHOBOT_PUBLIC_URL
    || 'https://psychobot-1si7.onrender.com/';

module.exports = {
    name: 'careerops',
    description: 'K_JobAgent / Career-Ops — liens, feuille de suivi et raccourcis',
    adminOnly: false,
    run: async ({ sock, msg }) => {
        const jid = msg.key.remoteJid;
        const text = [
            '💼 *K_JobAgent / Career-Ops*',
            '',
            '📊 *Suivi jobs (Google Sheet)*',
            SHEETS_URL,
            '',
            '🤖 *Bot (Render)*',
            BOT_PUBLIC,
            '',
            '🧾 *Rappels CLI (sur ton PC)*',
            '• `npm run pipeline:snapshot` — voir les URLs en attente',
            '• `npm run report:bundle -- <id-rapport>` — PDF EN + FR',
            '',
            '📲 *Psychobot webhook*',
            '`POST /career-ops/notify` (+ body JSON `{ "message":"..." }`)',
            '',
            '📌 *WA commandes projet*',
            '• `!jobclip URL` ou répond à un message avec l’URL (owner)',
            '• `/career-ops-k-jobagent …` depuis Claude/Code/Gemini (repo career-ops)',
            '',
            '🔗 Portfolio',
            'https://huggingface.co/spaces/Sidoineko/portfolio',
        ].join('\n');

        await sock.sendMessage(jid, { text }, { quoted: msg });
    },
};
