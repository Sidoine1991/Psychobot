// commands/help.js
const log = require('../logger')(module);

module.exports = {
    name: 'help',
    description: "Affiche le menu d'aide du bot.",
    run: async ({ sock, msg, commands, replyWithTag }) => {
        if (!sock.user) return;

        const BOT_NAME = "PSYCHO BOT";
        const PREFIX = "!";
        const remoteJid = msg.key.remoteJid;
        const sender = msg.pushName || "Utilisateur";

        log(`Commande HELP reçue de ${remoteJid}`);

        const availableCommands = Array.from(commands.values())
            .sort((a, b) => a.name.localeCompare(b.name));

        const categories = {
            "📈 TRADBOT": ["tradbot"],
            "🤖 AI & DATA": ["ai", "aisay", "llama", "transcript", "translate", "imagine"],
            "💼 K_JOBAGENT": ["careerops", "jobclip"],
            "🛠️ UTILS": ["about", "ping", "sticker", "say", "extract", "audio", "av", "chipmunks", "pp"],
            "🎮 JEUX": ["coinflip", "guess", "motgame", "listgame"],
            "👥 GROUPE": ["tagall", "add", "kick", "promote", "demote", "group", "delete"],
            "👑 ADMIN": ["admin", "antilink", "antidelete", "logout", "session", "statusall", "statusdown"]
        };

        let helpText = `╭───≼ 🤖 *${BOT_NAME}* ≽───╮\n`;
        helpText += `│\n`;
        helpText += `│  Salut *${sender}* 👋\n`;
        helpText += `│  Voici mes commandes :\n`;

        for (const [catName, cmdList] of Object.entries(categories)) {
            const catCmds = availableCommands.filter(c => cmdList.includes(c.name));
            if (catCmds.length > 0) {
                helpText += `│\n│  *${catName}*\n`;
                catCmds.forEach(cmd => {
                    helpText += `│  ◈ *${PREFIX}${cmd.name}*\n`;
                });
            }
        }

        helpText += `│\n│  💡 Tapez *${PREFIX}command* pour l'utiliser.\n`;
        helpText += `│  🌐 *Portfolio:* https://huggingface.co/spaces/Sidoineko/portfolio\n╰───≼ 🔥 XYBERCLAN 🔥 ≽───╯`;

        try {
            await replyWithTag(sock, remoteJid, msg, helpText);
        } catch (e) {
            log(`[HELP] Erreur : ${e.message}`);
        }
    }
};