const db = require('../database');

module.exports = {
    name: 'agenda',
    description: 'Consulter les messages laissés par les contacts (Owner uniquement)',
    adminOnly: true,

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;
        const sub = (args[0] || '').toLowerCase();

        try {
            if (sub === 'clear' || sub === 'lu') {
                await db.markAllAgendaRead();
                await sock.sendMessage(remoteJid, {
                    text: '✅ Tous les messages agenda marqués comme lus.'
                }, { quoted: msg });
                return;
            }

            const messages = await db.getUnreadAgendaMessages();

            if (messages.length === 0) {
                await sock.sendMessage(remoteJid, {
                    text: '📋 *Agenda* — Aucun nouveau message en attente.'
                }, { quoted: msg });
                return;
            }

            let response = `📋 *Agenda — ${messages.length} message(s) non lu(s)*\n${'━'.repeat(22)}\n\n`;

            for (const m of messages) {
                const date = new Date(m.created_at).toLocaleString('fr-FR', {
                    timeZone: 'Africa/Porto-Novo',
                    day: '2-digit', month: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                });
                const number = m.from_jid.split('@')[0];
                response += `👤 *${m.from_name}* (+${number})\n`;
                response += `🕐 ${date}\n`;
                response += `💬 ${m.message}\n`;
                response += `${'─'.repeat(18)}\n`;

                await db.markAgendaRead(m.id);
            }

            response += `\n_Tapez !agenda clear pour effacer l'historique_`;

            await sock.sendMessage(remoteJid, { text: response }, { quoted: msg });

        } catch (err) {
            console.error('[Agenda] Erreur:', err.message);
            await sock.sendMessage(remoteJid, {
                text: '❌ Erreur lors de la lecture de l\'agenda: ' + err.message
            }, { quoted: msg });
        }
    }
};
