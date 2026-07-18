// commands/game.js
// Système de jeux éducatifs (prefix 🎮)
// Commandes : 🎮 jouer <game>, 🎮 stats, 🎮 suggestion, 🎮 leaderboard, 🎮 help, 🎮 end
const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, '..', 'data', 'game-stats.json');
const GAME_PREFIX = '🎮';

const GAMES = {
    riddles: {
        name: 'Énigmes',
        emoji: '🧩',
        benefit: 'Améliore la pensée latérale et la logique.',
        questions: [
            { q: "Je suis toujours devant toi, mais tu ne peux jamais me voir. Qui suis-je ?", a: "lavenir" },
            { q: "Plus on en prend, plus on en laisse. Qu'est-ce ?", a: "lespas" },
            { q: "J'ai des villes mais pas de maisons, des montagnes mais pas d'arbres, de l'eau mais pas de poisson. Qu'est-ce ?", a: "lacarte" },
            { q: "Qu'est-ce qui monte mais ne descend jamais ?", a: "lage" },
            { q: "Je n'ai pas de vie, mais je grandis ; je n'ai pas de poumons, mais j'ai besoin d'air ; je n'ai pas de bouche, mais l'eau me tue. Qu'est-ce ?", a: "lefeu" },
            { q: "Quel mot est mal écrit dans tous les dictionnaires ?", a: "malecrit" },
            { q: "Qu'est-ce qui a une tête et une queue, mais pas de corps ?", a: "unepiece" },
            { q: "Je suis léger comme une plume, mais même le plus fort des hommes ne peut me tenir plus de 5 minutes. Qui suis-je ?", a: "sonhaleine" }
        ]
    },
    memory: {
        name: 'Mémoire',
        emoji: '🧠',
        benefit: 'Renforce la mémoire de travail et la concentration.',
        questions: [
            { q: "Mémorise cette suite, puis réécris-la : 7 3 9 1 5", a: "73915" },
            { q: "Mémorise cette suite, puis réécris-la : 4 8 2 6 0 1", a: "482601" },
            { q: "Mémorise cette suite, puis réécris-la : 1 5 9 3 7 2 8", a: "1593728" },
            { q: "Mémorise ces mots, puis réécris-les : CHAT ROSE LUNE", a: "chat rose lune" },
            { q: "Mémorise ces mots, puis réécris-les : MER LIVRE RÊVE OR", a: "mer livre rêve or" }
        ]
    },
    words: {
        name: 'Mots',
        emoji: '📝',
        benefit: 'Enrichit le vocabulaire et la fluidité verbale.',
        questions: [
            { q: "Donne un mot de 6 lettres qui commence par 'PL' (ex: PLAGE).", a: null, validate: (t) => t.length === 6 && t.toUpperCase().startsWith('PL') },
            { q: "Donne un synonyme de 'RAPIDE'.", a: null, validate: (t) => ['veloce','rapide','swift','vite','prompt','precipite','galopant'].includes(t) },
            { q: "Écris le contraire de 'OBSCURITÉ'.", a: null, validate: (t) => ['lumiere','clair','clarté'].includes(t) },
            { q: "Donne un mot contenant la lettre 'Z' (ex: ZÉBULE).", a: null, validate: (t) => t.toUpperCase().includes('Z') },
            { q: "Combien de syllabes dans le mot 'PSYCHOLOGIE' ? (écris le chiffre)", a: null, validate: (t) => t === '5' || t === '4' }
        ]
    },
    maths: {
        name: 'Maths',
        emoji: '🔢',
        benefit: 'Entretient le calcul mental et la rapidité.',
        questions: [
            { q: "Combien fait 15 × 7 ?", a: "105" },
            { q: "Combien fait 144 ÷ 12 ?", a: "12" },
            { q: "Combien fait 23 + 48 ?", a: "71" },
            { q: "Combien fait 9 × 9 - 10 ?", a: "71" },
            { q: "Combien fait 200 ÷ 8 ?", a: "25" },
            { q: "Quelle est la racine carrée de 81 ?", a: "9" }
        ]
    },
    patterns: {
        name: 'Logique',
        emoji: '🔍',
        benefit: 'Développe la reconnaissance de motifs et la prédictio.',
        questions: [
            { q: "Série : 2, 4, 6, 8, ? (écris le nombre suivant)", a: "10" },
            { q: "Série : 1, 1, 2, 3, 5, ? (nombre suivant)", a: "8" },
            { q: "Série : 3, 6, 12, 24, ? (nombre suivant)", a: "48" },
            { q: "Série : 100, 90, 81, 73, ? (nombre suivant)", a: "66" },
            { q: "Série : A, C, E, G, ? (lettre suivante)", a: "i" }
        ]
    }
};

const activeSessions = new Map();

function loadStats() {
    try {
        if (fs.existsSync(STATS_FILE)) {
            return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
        }
    } catch (e) {}
    return {};
}

function saveStats(stats) {
    try {
        const dir = path.dirname(STATS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
    } catch (e) {}
}

function normalize(t) {
    return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim();
}

function scoreAnswer(gameId, q, text) {
    const t = normalize(text);
    if (q.validate) return q.validate(t);
    if (q.a === null) return false;
    return t === normalize(q.a);
}

module.exports = {
    name: GAME_PREFIX,
    description: 'Système de jeux éducatifs (🎮).',
    run: async ({ sock, msg, replyWithTag, args }) => {
        const from = msg.key.remoteJid;
        const sub = (args[0] || '').toLowerCase();
        const sender = msg.pushName || 'Joueur';

        if (sub === 'help' || sub === '') {
            let txt = `🧠 *JEUX ÉDUCATIFS PSYCHO-BOT* 🧠\n\n`;
            txt += `Améliore tes capacités cognitives en t'amusant !\n\n`;
            txt += `📋 *Commandes :*\n`;
            txt += `• 🎮 jouer <jeu> - Lancer une partie\n`;
            txt += `• 🎮 stats - Tes statistiques\n`;
            txt += `• 🎮 suggestion - Une activité suggérée\n`;
            txt += `• 🎮 leaderboard - Classement\n`;
            txt += `• 🎮 end - Arrêter la partie\n\n`;
            txt += `🎮 *Jeux disponibles :*\n`;
            for (const [id, g] of Object.entries(GAMES)) {
                txt += `${g.emoji} *${id}* - ${g.name} (${g.benefit})\n`;
            }
            return replyWithTag(sock, from, msg, txt);
        }

        if (sub === 'jouer') {
            const gameId = (args[1] || '').toLowerCase();
            const game = GAMES[gameId];
            if (!game) {
                let txt = `❌ Jeu inconnu. Jeux dispo : ${Object.keys(GAMES).join(', ')}`;
                return replyWithTag(sock, from, msg, txt);
            }
            const pool = [...game.questions];
            activeSessions.set(from, {
                gameId,
                game,
                pool,
                index: 0,
                score: 0,
                total: 0,
                startedAt: Date.now(),
                sender
            });
            const q = pool[0];
            return replyWithTag(sock, from, msg,
                `${game.emoji} *${game.name}* — Partie lancée !\n🎯 ${q.q}\n\n_(Réponds directement. 🎮 end pour quitter)_`);
        }

        if (sub === 'stats') {
            const stats = loadStats();
            const id = from;
            const s = stats[id] || { played: 0, correct: 0, bestGame: '-' };
            let txt = `📊 *TES STATISTIQUES* 📊\n\n`;
            txt += `👤 ${sender}\n`;
            txt += `🎮 Parties jouées : *${s.played}*\n`;
            txt += `✅ Réponses correctes : *${s.correct}*\n`;
            txt += `🏆 Meilleur jeu : *${s.bestGame}*\n`;
            return replyWithTag(sock, from, msg, txt);
        }

        if (sub === 'leaderboard') {
            const stats = loadStats();
            const arr = Object.entries(stats)
                .map(([jid, s]) => ({ jid, score: (s.correct || 0) }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 10);
            let txt = `🏆 *CLASSEMENT* 🏆\n\n`;
            if (arr.length === 0) txt += `_Aucune partie jouée pour l'instant._`;
            arr.forEach((e, i) => {
                const name = (e.jid.split('@')[0]);
                txt += `${i + 1}. ${name} — ${e.score} pts\n`;
            });
            return replyWithTag(sock, from, msg, txt);
        }

        if (sub === 'suggestion') {
            const ids = Object.keys(GAMES);
            const g = GAMES[ids[Math.floor(Math.random() * ids.length)]];
            return replyWithTag(sock, from, msg,
                `💡 *SUGGESTION* ${g.emoji}\nEssaie le jeu *${g.name}* !\n${g.benefit}\n👉 Tape : 🎮 jouer ${g.emoji ? Object.keys(GAMES).find(k => GAMES[k] === g) : ''}`);
        }

        if (sub === 'end') {
            if (activeSessions.has(from)) {
                const sess = activeSessions.get(from);
                activeSessions.delete(from);
                return replyWithTag(sock, from, msg,
                    `🛑 Partie de *${sess.game.name}* terminée.\nScore : *${sess.score}/${sess.total}*`);
            }
            return replyWithTag(sock, from, msg, `ℹ️ Aucune partie en cours.`);
        }

        // Default
        return replyWithTag(sock, from, msg, `❓ Tape 🎮 help pour la liste des jeux éducatifs.`);
    },

    onMessage: async (sock, msg, text) => {
        const from = msg.key.remoteJid;
        if (!activeSessions.has(from)) return false;
        const sess = activeSessions.get(from);

        // Ignore the command message itself
        if (text.startsWith(GAME_PREFIX)) return false;

        const q = sess.pool[sess.index];
        sess.total += 1;

        const correct = scoreAnswer(sess.gameId, q, text);
        if (correct) {
            sess.score += 1;
            await sock.sendMessage(from, { text: `✅ *Bravo !* (+1)` }, { quoted: msg });
        } else {
            const expected = q.a ? ` (Réponse : ${q.a})` : '';
            await sock.sendMessage(from, { text: `❌ Pas tout à fait${expected}` }, { quoted: msg });
        }

        sess.index += 1;
        if (sess.index >= sess.pool.length) {
            // Partie finie
            activeSessions.delete(from);
            const stats = loadStats();
            const id = from;
            if (!stats[id]) stats[id] = { played: 0, correct: 0, bestGame: '-' };
            stats[id].played += 1;
            stats[id].correct += sess.score;
            stats[id].bestGame = sess.game.name;
            saveStats(stats);
            await sock.sendMessage(from, {
                text: `🎉 *Partie terminée !*\nScore final : *${sess.score}/${sess.total}* pour *${sess.game.name}*.\n📊 Tape 🎮 stats pour voir tes progrès.`
            });
            return true;
        }

        const next = sess.pool[sess.index];
        await sock.sendMessage(from, {
            text: `${sess.game.emoji} *Question ${sess.index + 1}* :\n${next.q}`
        });
        return true;
    }
};
