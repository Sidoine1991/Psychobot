// commands/jobclip.js — formate une offre depuis une URL (owner-only)

module.exports = {
    name: 'jobclip',
    description: 'Colle ou cite une URL d’offre → modèle pour Career-Ops / Claude',
    adminOnly: true,
    run: async ({ sock, msg, args }) => {
        const jid = msg.key.remoteJid;
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        const quoted = ctx?.quotedMessage?.conversation
            || ctx?.quotedMessage?.extendedTextMessage?.text
            || '';

        let urlCandidate = '';
        const argUrl = args.find((a) => /^https?:\/\//i.test(a.trim()));
        if (argUrl) urlCandidate = argUrl.trim();

        const fromQuoted = quoted.match(/https?:\/\/[^\s]+/)?.[0];
        const fromBody = `${msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''}`.match(/https?:\/\/[^\s]+/)?.[0];

        const url = urlCandidate || fromQuoted || fromBody;
        if (!url) {
            await sock.sendMessage(jid, {
                text: '📎 *jobclip*\nUsage (owner):\n• `!jobclip https://...`\n• ou cite un message qui contient l’URL',
            }, { quoted: msg });
            return;
        }

        const block = [
            '🎯 *Bloc à coller (Career-Ops / assistant IA)*',
            '',
            `_Lors K_JobAgent : évaluation bilingue (EN + FR), rapports Markdown + PDF, pas de submit auto._`,
            '',
            `Offre :\n${url}`,
            '',
            'Actions demandées:',
            '1) Liveness URL',
            '2) Rapports `*-en.md` / `*-fr.md` + `npm run report:bundle`',
            '3) Recommandation APPLY_NOW | APPLY_WITH_EDITS | SKIP',
            '4) Brouillon candidature (`apply`) — validation humaine avant envoi',
        ].join('\n');

        await sock.sendMessage(jid, { text: block }, { quoted: msg });
    },
};
