module.exports = {
    name: 'contact',
    description: 'Affiche le profil et contact de Sidoine.',
    run: async ({ sock, msg }) => {
        const vcard = 'BEGIN:VCARD\nVERSION:3.0\n' +
            'FN:Sidoine Kolaole YEBADOKPO\n' +
            'ORG:CCR-Benin / Freelance Data & Dev\n' +
            'TITLE:Data Analyst | Fullstack Dev | Expert MEAL\n' +
            'TEL;type=CELL;type=VOICE:+22901969113 46\n' +
            'EMAIL:syebadokpo@gmail.com\n' +
            'URL:https://huggingface.co/spaces/Sidoineko/portfolio\n' +
            'END:VCARD';

        await sock.sendMessage(msg.key.remoteJid, {
            contacts: {
                displayName: 'Sidoine K. YEBADOKPO',
                contacts: [{ vcard }]
            }
        }, { quoted: msg });

        const profile = `👨‍💻 *Sidoine Kolaole YEBADOKPO*\n━━━━━━━━━━━━━━\n` +
            `📊 Data Analyst & Fullstack Developer\n` +
            `🌾 Expert MEAL (Suivi-Evaluation)\n` +
            `📍 Cotonou, Benin\n\n` +
            `*Competences:*\n` +
            `• Python, R, SQL, Power BI, Tableau\n` +
            `• Django, React, Node.js\n` +
            `• IA/ML, RAG, LangChain\n` +
            `• Agroecologie, Filiere riz\n\n` +
            `*Liens:*\n` +
            `🔗 Portfolio: huggingface.co/spaces/Sidoineko/portfolio\n` +
            `💻 GitHub: github.com/Sidoineko\n` +
            `📧 syebadokpo@gmail.com\n` +
            `📱 +229 01 96 91 13 46`;

        await sock.sendMessage(msg.key.remoteJid, { text: profile }, { quoted: msg });
    }
};
