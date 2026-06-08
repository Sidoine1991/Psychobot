// commands/admin.js
const log = require('../logger')(module);

module.exports = {
    name: 'admin',
    description: 'Affiche le menu des commandes d\'administration.',
    adminOnly: true,
    run: async ({ sock, msg, commands, replyWithTag }) => {
        if (!sock.user) return;

        const BOT_NAME = "PSYCHO BOT";
        const PREFIX = "!";
        const remoteJid = msg.key.remoteJid;
        const sender = msg.pushName || "Administrateur";

        // JID Normalizer for Owner Check
        const cleanJid = (jid) => jid ? jid.split(':')[0].split('@')[0] : "";
        const msgSender = msg.key.participant || msg.participant || msg.key.remoteJid;
        const msgSenderClean = cleanJid(msgSender);
        const OWNER_PN = "2290196911346";
        const OWNER_LID = "250865332039895";

        const groupMetadata = remoteJid.endsWith("@g.us") ? await sock.groupMetadata(remoteJid) : null;
        const senderIsAdmin = groupMetadata?.participants.some(p => {
            const pClean = cleanJid(p.id);
            return pClean === msgSenderClean && (p.admin === "admin" || p.admin === "superadmin");
        });

        const isOwner = msgSenderClean === OWNER_PN || msgSenderClean === OWNER_LID;

        // Restriction: Only show if sender is admin or owner
        if (!isOwner && !senderIsAdmin) {
            return replyWithTag(sock, remoteJid, msg, "❌ Désolé, ce menu est réservé aux administrateurs.");
        }

        log(`Menu ADMIN demandé par ${remoteJid}`);

        let helpText = `╭───≼ 👑 *${BOT_NAME} ADMIN* ≽───╮\n`;
        helpText += `│\n`;
        helpText += `│  Salut *${sender}* 👋\n`;
        helpText += `│  Outils de gestion disponibles :\n`;
        helpText += `│\n`;

        const availableCommands = Array.from(commands.values())
            .filter(cmd => cmd.adminOnly)
            .sort((a, b) => a.name.localeCompare(b.name));

        if (availableCommands.length > 0) {
            availableCommands.forEach(command => {
                helpText += `│  ◈ *${PREFIX}${command.name}*\n│     ↳ _${command.description || 'Action admin'}_\n│\n`;
            });
        } else {
            helpText += `│  ⚠️ Aucun outil de gestion configuré.\n`;
        }

        helpText += `╰───≼ 🔥 PSYCHO SETTINGS 🔥 ≽───╯`;

        try {
            await replyWithTag(sock, remoteJid, msg, helpText);
        } catch (e) {
            log(`[ADMIN] Erreur menu : ${e.message}`);
        }
    }
};
