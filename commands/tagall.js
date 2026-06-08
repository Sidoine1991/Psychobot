module.exports = {
    name: "tagall",
    description: "Mentionne tous les membres du groupe",
    adminOnly: true, // Limite aux admins pour éviter les abus
    run: async ({ sock, msg }) => {
        const from = msg.key.remoteJid;

        // Vérifie que c’est bien un groupe
        if (!from.endsWith("@g.us")) {
            return sock.sendMessage(from, { text: "❌ Cette commande ne fonctionne que dans un groupe." });
        }

        try {
            const groupMetadata = await sock.groupMetadata(from);

            const cleanJid = (jid) => jid ? jid.split(':')[0].split('@')[0] : "";
            const sender = msg.key.participant || msg.participant || msg.key.remoteJid;
            const senderClean = cleanJid(sender);
            const OWNER_PN = "2290196911346";
            const OWNER_LID = "250865332039895";

            const senderIsAdmin = groupMetadata.participants.some(p => {
                const pClean = cleanJid(p.id);
                return pClean === senderClean && (p.admin === "admin" || p.admin === "superadmin");
            });

            const isOwner = senderClean === OWNER_PN || senderClean === OWNER_LID;
            const canExecute = isOwner || senderIsAdmin;

            if (!canExecute) {
                return sock.sendMessage(from, { text: "❌ Tu dois être admin pour utiliser cette commande." });
            }

            const participants = groupMetadata.participants.map(p => p.id);

            if (participants.length === 0) {
                return sock.sendMessage(from, { text: "❌ Aucun membre trouvé à mentionner." });
            }

            await sock.sendMessage(from, {
                text: "📢 Mention spéciale à tous !",
                mentions: participants
            });

            console.log(`[TAGALL] Tous les membres ont été mentionnés dans le groupe ${from}`);
        } catch (err) {
            console.error("[TAGALL] Erreur :", err);
            await sock.sendMessage(from, { text: "❌ Impossible de mentionner tous les membres." });
        }
    }
};