const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys");
const fs = require('fs-extra');
const pino = require("pino");
const path = require('path');
const { Boom } = require("@hapi/boom");
const { HttpsProxyAgent } = require('https-proxy-agent');

const axios = require('axios');

// Handlers
const onceViewHandler = require('./src/handlers/onceView');
const autoReactionHandler = require('./src/handlers/autoReaction');
const autoResponseHandler = require('./src/handlers/autoResponse');
const { setOwnerActive } = require('./src/db/conversationState');

// TradBOT approval — forward OUI/NON au pipeline
const AI_SERVER = process.env.AI_SERVER_URL || 'http://127.0.0.1:8000';
const OWNER_NUMBER = process.env.OWNER_PHONE || '2290196911346';

const _YES = new Set(['oui', 'yes', 'o', 'y', '1', 'ok', 'valider', 'valide', 'go', '✅', '👍']);
const _NO  = new Set(['non', 'no', 'n', '0', 'skip', 'annuler', 'annule', '❌', '👎']);

// Patterns: "OUI BTCUSD", "NON Boom 1000 Index", "OUI", "BTCUSD BUY OUI", ...
function parseTradingApproval(text) {
    const t = text.trim();
    const words = t.split(/\s+/);

    // Premier ou dernier mot = réponse
    const first = words[0].toLowerCase().replace(/[^a-z0-9✅❌👍👎]/g, '');
    const last  = words[words.length - 1].toLowerCase().replace(/[^a-z0-9✅❌👍👎]/g, '');

    let answer = null;
    let symbolWords = [];

    if (_YES.has(first) || _NO.has(first)) {
        answer = _YES.has(first) ? 'yes' : 'no';
        symbolWords = words.slice(1);
    } else if (_YES.has(last) || _NO.has(last)) {
        answer = _YES.has(last) ? 'yes' : 'no';
        symbolWords = words.slice(0, -1);
    } else {
        return null;
    }

    // Extraire le symbole du reste (ex: "BTCUSD", "Boom 1000 Index", "DERIV:BOOM_300_INDEX")
    // Filtrer les mots parasites (BUY, SELL, direction…)
    const noise = new Set(['buy', 'sell', 'achat', 'vente', 'signal', '#1', '#2', '#3']);
    const symWords = symbolWords.filter(w => !noise.has(w.toLowerCase()));
    const symbol = symWords.join(' ').trim() || null;

    return { answer, symbol };
}

async function handleTradingApproval(sock, remoteJid, text) {
    const parsed = parseTradingApproval(text);
    if (!parsed) return false;

    const { answer, symbol } = parsed;

    // Si pas de symbole explicite, chercher un ordre en attente
    let finalSymbol = symbol;
    if (!finalSymbol) {
        try {
            const r = await axios.get(`${AI_SERVER}/pending-order`, { timeout: 5000 });
            const orders = r.data?.orders || [];
            // Prendre le premier ordre "ready" en attente d'approbation
            const pending = orders.find(o => o.status === 'ready' || o.status === 'pending');
            if (pending) finalSymbol = pending.symbol;
        } catch (e) { /* ignore */ }
    }

    if (!finalSymbol) {
        await sock.sendMessage(remoteJid, {
            text: `⚠️ *TradBOT* : Réponse "${answer === 'yes' ? 'OUI' : 'NON'}" reçue mais aucun symbole trouvé.\nRépondez avec le symbole: ex. *OUI BTCUSD*`
        });
        return true;
    }

    try {
        await axios.post(`${AI_SERVER}/approval`, { symbol: finalSymbol, answer }, { timeout: 5000 });
        const emoji = answer === 'yes' ? '✅' : '❌';
        await sock.sendMessage(remoteJid, {
            text: `${emoji} *TradBOT* : ${answer === 'yes' ? 'Validation' : 'Refus'} enregistré pour *${finalSymbol}*`
        });
        console.log(`[TradBOT] Approbation ${answer} → ${finalSymbol}`);
        return true;
    } catch (e) {
        await sock.sendMessage(remoteJid, {
            text: `❌ *TradBOT* : Erreur envoi approbation (AI server inaccessible?)\n${e.message}`
        });
        return true;
    }
}

// Session directory
const SESSION_DIR = './session';
const CREDS_PATH = './creds.json';

// Minimal Store Setup
const store = {
    messages: {},
    loadMessage: async (jid, id) => {
        const list = store.messages[jid] || [];
        return list.find(m => m.key.id === id);
    },
    bind: (ev) => {
        ev.on('messages.upsert', ({ messages }) => {
            for (const msg of messages) {
                const jid = msg.key.remoteJid;
                if (!store.messages[jid]) store.messages[jid] = [];
                store.messages[jid].push(msg);
                // Keep last 100 messages per chat to save RAM
                if (store.messages[jid].length > 100) store.messages[jid].shift();
            }
        });
    }
};

async function startBot() {
    console.log('Starting Bot...');

    // Ensure session directory exists and has creds
    if (!fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR);
    }

    // If creds.json exists in root but not in session, copy it
    if (fs.existsSync(CREDS_PATH) && !fs.existsSync(path.join(SESSION_DIR, 'creds.json'))) {
        console.log('Found creds.json in root, copying to session folder...');
        fs.copySync(CREDS_PATH, path.join(SESSION_DIR, 'creds.json'));
    }

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    let version;
    try {
        const { version: v } = await fetchLatestBaileysVersion();
        version = v;
    } catch (e) {
        console.log('[Bot] Version fetch timeout, using fallback');
        version = [2, 3000, 1045017392];
    }

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true, // Should not happen if creds exist
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        browser: ["Psycho bot", "Chrome", "1.0.0"],
        generateHighQualityLinkPreview: true,
        agent: process.env.PROXY_URL ? new HttpsProxyAgent(process.env.PROXY_URL) : undefined,
    });

    sock.ev.on('creds.update', saveCreds);

    // Bind store to socket
    store.bind(sock.ev);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            } else {
                console.log('Logged out. Please re-pair.');
            }
        } else if (connection === 'open') {
            console.log('Bot Connected Successfully!');
        }
    });

    // Event Listeners for Features
    const commands = new Map();
    const PREFIX = '!';

    // Load Commands
    const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        try {
            const command = require(`./commands/${file}`);
            if (command.name) {
                commands.set(command.name, command);
            }
        } catch (error) {
            console.error(`Failed to load command ${file}:`, error);
        }
    }

    async function replyWithTag(sock, remoteJid, msg, text) {
        const participant = msg.key.participant || msg.key.remoteJid;
        await sock.sendMessage(remoteJid, { text: text, mentions: [participant] }, { quoted: msg });
    }

    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message) return;

            // Messages envoyés par Sidoine depuis son propre téléphone
            if (msg.key.fromMe) {
                const jid = msg.key.remoteJid;
                if (jid && jid.endsWith('@s.whatsapp.net')) {
                    setOwnerActive(jid);
                    console.log(`[Bot] Sidoine actif sur ${jid} — auto-reply suspendu 15 min`);
                }
                // Vérifier si c'est une approbation TradBOT (OUI/NON signal)
                // Sidoine répond à lui-même (conversation avec le bot = même JID que lui)
                const selfJid = sock.user?.id;
                const selfBase = selfJid?.split(':')[0] + '@s.whatsapp.net';
                const isSelfChat = jid === selfBase;
                if (isSelfChat) {
                    let ownerText = '';
                    if (msg.message?.conversation) ownerText = msg.message.conversation;
                    else if (msg.message?.extendedTextMessage) ownerText = msg.message.extendedTextMessage.text;
                    if (ownerText) await handleTradingApproval(sock, jid, ownerText);
                }
                return;
            }

            // Approbation TradBOT : détecter OUI/NON uniquement si c'est Sidoine (owner) qui répond
            const remoteJid = msg.key.remoteJid;
            const senderNumber = (msg.key.participant || remoteJid).split('@')[0].split(':')[0];
            const isOwner = senderNumber.includes(OWNER_NUMBER) || OWNER_NUMBER.includes(senderNumber);
            if (isOwner && remoteJid.endsWith('@s.whatsapp.net')) {
                let approvalText = '';
                if (msg.message?.conversation) approvalText = msg.message.conversation;
                else if (msg.message?.extendedTextMessage) approvalText = msg.message.extendedTextMessage.text;
                if (approvalText) {
                    const handled = await handleTradingApproval(sock, remoteJid, approvalText);
                    if (handled) return; // Ne pas traiter comme message normal
                }
            }

            let text = "";
            if (msg.message.conversation) {
                text = msg.message.conversation;
            } else if (msg.message.extendedTextMessage) {
                text = msg.message.extendedTextMessage.text;
            }

            // Command Handling
            if (text.startsWith(PREFIX)) {
                const args = text.slice(PREFIX.length).trim().split(/ +/);
                const commandName = args.shift().toLowerCase();

                if (commands.has(commandName)) {
                    const command = commands.get(commandName);
                    console.log(`Executing command: ${commandName}`);
                    await command.run({ sock, msg, commands, replyWithTag, args });
                }
            }

            // Auto Reaction
            await autoReactionHandler(msg, sock);

            // Auto Response
            await autoResponseHandler(msg, sock);

        } catch (err) {
            console.error('Error in messages.upsert', err);
        }
    });

    sock.ev.on('messages.reaction', async (reactions) => {
        // Once View Extraction (Triggered by reaction)
        // reactions is an array
        for (const reaction of reactions) {
            await onceViewHandler(reaction, sock, store);
        }
    });

    // Quand Sidoine lit les messages d'un chat → marquer activité propriétaire
    // Cela évite que le bot réponde dans une conversation que Sidoine est en train de lire
    sock.ev.on('message-receipt.update', (updates) => {
        const aiService = require('./src/services/ai');
        for (const update of updates) {
            if (update.key?.fromMe) {
                // Sidoine a lu un message dans ce chat
                const remoteJid = update.key.remoteJid;
                if (remoteJid) {
                    aiService.markOwnerActivity(remoteJid);
                    console.log(`[Bot] Lecture propriétaire détectée dans ${remoteJid} — bot en pause`);
                }
            }
        }
    });
}

// Check if we can start
if (fs.existsSync(CREDS_PATH) || fs.existsSync(path.join(SESSION_DIR, 'creds.json'))) {
    startBot();
} else {
    console.log('No credentials found. Please pair first.');
}

module.exports = startBot;
