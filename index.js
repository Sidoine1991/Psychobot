// Psychobot - Core V2 (Clean Slate Refactor + WS Support)
const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion, Browsers, makeCacheableSignalKeyStore, delay } = require('@whiskeysockets/baileys');
const QRCode = require("qrcode");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const https = require("https");
const chalk = require("chalk");
const figlet = require("figlet");
const WebSocket = require('ws');
const http = require('http');
const bodyParser = require("body-parser");
const os = require('os');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const cron = require('node-cron');
const googleTTS = require('google-tts-api');
require('dotenv').config();
const { convertToOpus } = require('./src/lib/audioHelper');

// New conversation state management
const { setOwnerActive, isConversationActive, updateUserMessageType, shouldAutoReplyBasedOnActivity } = require('./src/db/conversationState');
const { detectMessageType } = require('./src/handlers/messageClassifier');
const { getAutoReplyTemplate, formatReplyForWhatsApp } = require('./src/handlers/autoReplyTemplates');

// Delayed reply system — wait 15 min before auto-replying, cancel if owner responds
const DELAYED_REPLY_MS = 15 * 60 * 1000; // 15 minutes
const pendingReplies = new Map(); // jid → { timer, msgData }

function cancelPendingReply(jid) {
    const pending = pendingReplies.get(jid);
    if (pending) {
        clearTimeout(pending.timer);
        pendingReplies.delete(jid);
        console.log(`[DelayedReply] ⏹ Cancelled pending reply for ${jid} (owner responded)`);
    }
}

function cancelAllPendingReplies(reason = 'shutdown') {
    if (pendingReplies.size === 0) return;
    for (const [jid, pending] of pendingReplies) {
        clearTimeout(pending.timer);
    }
    pendingReplies.clear();
    console.log(`[DelayedReply] ⏹ Cleared all pending replies (${reason})`);
}

function canSendDelayedReply() {
    return isConnected && sock?.user?.id;
}

function cancelAllPendingRepliesForJid(jid) {
    cancelPendingReply(jid);
}

// Natural Language Command Router
const intentAnalyzer = require('./src/services/intentAnalyzer');
const contextManager = require('./src/services/contextManager');
const commandExecutor = require('./src/services/commandExecutor');
const rdsClient = require('./src/db/rdsClient');

// Persistent chat history (owner-accessible via !historique)
const chatHistory = require('./src/services/chatHistory');

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY;
const NVIDIA_NIM_BASE = "https://integrate.api.nvidia.com/v1";
const NVIDIA_NIM_MODEL = process.env.NVIDIA_NIM_MODEL || "meta/llama-3.3-70b-instruct";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

let lastOwnerActionTime = Date.now();
let lastDailyWelcomeSent = null; // Track last daily welcome date

async function callLLM(baseUrl, apiKey, model, messages, maxTokens = 1024) {
    const resp = await axios.post(`${baseUrl}/chat/completions`, {
        model,
        messages,
        temperature: 0.7,
        max_tokens: maxTokens,
        stream: false
    }, {
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        timeout: 45000
    });
    return resp.data.choices[0].message.content.trim();
}

async function getAIResponse(prompt, systemPrompt = null) {
    if (!prompt || typeof prompt !== 'string') return "Please provide a valid prompt.";

    const messages = [
        { role: "system", content: systemPrompt || "You are a helpful assistant." },
        { role: "user", content: prompt }
    ];

    // Try NVIDIA NIM first, fallback to OpenRouter if configured
    try {
        return await callLLM(NVIDIA_NIM_BASE, NVIDIA_NIM_API_KEY, NVIDIA_NIM_MODEL, messages);
    } catch (err1) {
        console.error('[NVIDIA NIM Error]:', err1.response?.status, err1.message);
        if (OPENROUTER_API_KEY) {
            try {
                console.log('[AI] Fallback to OpenRouter...');
                return await callLLM(OPENROUTER_BASE, OPENROUTER_API_KEY, OPENROUTER_MODEL, messages);
            } catch (err2) {
                console.error('[OpenRouter Error]:', err2.response?.status, err2.message);
            }
        }
        return "Merci pour votre message. Sidoine vous repondra des que possible.";
    }
}

// --- Configuration ---
const PORT = process.env.PORT || 10000;
const AUTH_FOLDER = path.join(__dirname, "session");
const PAIR_FOLDER = path.join(__dirname, "auth_info_baileys");
const PREFIX = "!";
const BOT_NAME = "PSYCHO BOT";
const OWNER_PN = process.env.OWNER_NUMBER || "2290196911346";
const OWNER_LIDS = process.env.OWNER_IDS ? process.env.OWNER_IDS.split(",").map(id => id.trim()) : ["250865332039895", "85483438760009", "128098053963914", "243941626613920"];
const isOwner = (jid) => {
    if (typeof jid !== 'string') return false;
    const clean = jid.split(':')[0].split('@')[0];
    return (OWNER_PN && clean === OWNER_PN) || OWNER_LIDS.includes(clean);
};
const cleanJid = (jid) => jid ? jid.split(':')[0].split('@')[0] : "";
const startTime = new Date();
const botStartTime = Math.floor(Date.now() / 1000);

async function notifyOwner(text) {
    try {
        const ownerJid = OWNER_PN + "@s.whatsapp.net";
        if (sock?.user && isConnected) {
            await sock.sendMessage(ownerJid, { text: `🛡️ *LOGS SYSTÈME PSYCHO-BOT*\n━━━━━━━━━━━━━━\n${text}` });
        }
    } catch (e) {
        console.error("Owner Notification Failed:", e.message);
    }
}

async function syncSessionToRender() {
    try {
        const credsPath = path.join(AUTH_FOLDER, 'creds.json');
        if (!fs.existsSync(credsPath)) return;

        const credsRaw = fs.readFileSync(credsPath, 'utf-8');
        if (!credsRaw || credsRaw.length < 20) return;

        let creds;
        try {
            creds = JSON.parse(credsRaw);
        } catch (e) {
            return;
        }
        if (!creds?.me?.id) return;

        const sessionBase64 = Buffer.from(credsRaw).toString('base64');
        if (!sessionBase64 || sessionBase64.length < 50) return;

        if (process.env.SESSION_DATA === sessionBase64) return;

        const apiKey = process.env.RENDER_API_KEY;
        const serviceId = process.env.RENDER_SERVICE_ID;
        if (apiKey && serviceId) {
            try {
                console.log(chalk.blue("📤 [Render API] Sauvegarde automatique de la session..."));
                await axios.put(`https://api.render.com/v1/services/${serviceId}/env-vars/SESSION_DATA`,
                    { value: sessionBase64 },
                    { headers: { Authorization: `Bearer ${apiKey}`, "Accept": "application/json", "Content-Type": "application/json" } }
                );
                console.log(chalk.green("✅ [Render API] Session sauvegardée via API !"));
                return;
            } catch (apiErr) {
                console.error(chalk.yellow("⚠️ [Render API] Échec API, fallback local:"), apiErr.response?.data || apiErr.message);
            }
        }

        const backupPath = path.join(__dirname, 'session_backup.txt');
        fs.writeFileSync(backupPath, sessionBase64, 'utf-8');
        console.log(chalk.green("✅ [Session] Backup local sauvegardé (session_backup.txt)"));
    } catch (error) {
        console.error(chalk.red("❌ [Session] Échec sauvegarde:"), error.message);
    }
}

async function clearSessionOnRender() {
    const apiKey = process.env.RENDER_API_KEY;
    const serviceId = process.env.RENDER_SERVICE_ID;
    if (!apiKey || !serviceId) return;
    try {
        await axios.put(`https://api.render.com/v1/services/${serviceId}/env-vars/SESSION_DATA`,
            { value: '' },
            { headers: { Authorization: `Bearer ${apiKey}`, "Accept": "application/json", "Content-Type": "application/json" } }
        );
        console.log(chalk.yellow('🗑️ [Render API] SESSION_DATA cleared'));
    } catch (e) {
        console.error(chalk.yellow('[Render API] Failed to clear SESSION_DATA:'), e.response?.data || e.message);
    }
}

let sessionSyncTimer = null;
function scheduleSessionSync() {
    if (sessionSyncTimer) clearTimeout(sessionSyncTimer);
    sessionSyncTimer = setTimeout(() => {
        sessionSyncTimer = null;
        syncSessionToRender().catch(e => console.error('[Session Sync]', e.message));
    }, 8000);
}

// Backup entire session folder contents as base64 (for Render persistence)
async function backupFullSession() {
    try {
        if (!fs.existsSync(AUTH_FOLDER)) return;
        const files = fs.readdirSync(AUTH_FOLDER);
        const backup = {};
        for (const file of files) {
            const filePath = path.join(AUTH_FOLDER, file);
            if (fs.statSync(filePath).isFile()) {
                backup[file] = fs.readFileSync(filePath, 'utf-8');
            }
        }
        if (Object.keys(backup).length === 0) return;
        const backupB64 = Buffer.from(JSON.stringify(backup)).toString('base64');
        const backupPath = path.join(__dirname, 'session_full_backup.txt');
        fs.writeFileSync(backupPath, backupB64, 'utf-8');
        console.log(chalk.green(`✅ [Session] Backup complet (${files.length} fichiers)`));
    } catch (e) {
        console.error(chalk.yellow("⚠️ [Session] Backup complet échoué:"), e.message);
    }
}

// Restore full session from backup
async function restoreFullSession() {
    const backupPath = path.join(__dirname, 'session_full_backup.txt');
    if (!fs.existsSync(backupPath)) return false;
    try {
        const b64 = fs.readFileSync(backupPath, 'utf-8').trim();
        const data = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
        if (!fs.existsSync(AUTH_FOLDER)) fs.mkdirSync(AUTH_FOLDER, { recursive: true });
        for (const [file, content] of Object.entries(data)) {
            fs.writeFileSync(path.join(AUTH_FOLDER, file), content, 'utf-8');
        }
        console.log(chalk.green(`✅ [Session] Session complète restaurée (${Object.keys(data).length} fichiers)`));
        return true;
    } catch (e) {
        console.error(chalk.red("❌ [Session] Restauration complète échouée:"), e.message);
        return false;
    }
}

/** Ignore empty/placeholder PROXY_URL values (common misconfig on Render). */
function resolveProxyAgent() {
    const raw = (process.env.PROXY_URL || '').trim();
    if (!raw || /^(none|null|undefined|false|n\/a|disabled)$/i.test(raw)) {
        return undefined;
    }
    try {
        new URL(raw);
        console.log(chalk.cyan(`🌍 Proxy activé: ${raw}`));
        return new HttpsProxyAgent(raw);
    } catch (e) {
        console.log(chalk.gray('ℹ️ PROXY_URL ignorée — connexion directe.'));
        return undefined;
    }
}

function closeSocket() {
    if (!sock) return;
    try {
        sock.ev.removeAllListeners();
        sock.end(undefined);
    } catch (e) {}
    sock = null;
}

function getSessionFileCount() {
    if (!fs.existsSync(AUTH_FOLDER)) return 0;
    return fs.readdirSync(AUTH_FOLDER).filter(f => f !== '.skip-session-data').length;
}

function hasValidSession() {
    const credsPath = path.join(AUTH_FOLDER, 'creds.json');
    if (!fs.existsSync(credsPath)) return false;
    try {
        const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
        return !!(creds?.me?.id);
    } catch (e) {
        return false;
    }
}

async function copyPairSessionToAuth() {
    fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    for (const file of fs.readdirSync(PAIR_FOLDER)) {
        const src = path.join(PAIR_FOLDER, file);
        if (!fs.statSync(src).isFile() || file === '.skip-session-data') continue;
        fs.copyFileSync(src, path.join(AUTH_FOLDER, file));
    }
    const skipFlag = path.join(AUTH_FOLDER, '.skip-session-data');
    if (fs.existsSync(skipFlag)) fs.unlinkSync(skipFlag);
    console.log(chalk.green(`[Pair] Session copied to ${AUTH_FOLDER} (${getSessionFileCount()} files)`));
    await backupFullSession();
    const credsPath = path.join(AUTH_FOLDER, 'creds.json');
    if (fs.existsSync(credsPath)) {
        const credsRaw = fs.readFileSync(credsPath, 'utf-8');
        fs.writeFileSync(path.join(__dirname, 'session_backup.txt'), Buffer.from(credsRaw).toString('base64'));
    }
    await syncSessionToRender();
}

function closePairSocket() {
    if (!activePairSock) return;
    try {
        activePairSock.ev.removeAllListeners();
        activePairSock.end(undefined);
    } catch (e) {}
    activePairSock = null;
}

function finishPairing(success) {
    isPairingInProgress = false;
    clearPairingTimeout();
    closePairSocket();
    try { fs.rmSync(PAIR_FOLDER, { recursive: true, force: true }); } catch (e) {}
    if (!success) {
        lastPairingCode = null;
        lastPairingNumber = null;
    }
    isStarting = false;
    reconnectAttempts = 0;
    console.log(chalk.cyan(`[Pair] Finished (${success ? 'success' : 'failed'}) — restarting main bot...`));
    setTimeout(() => startBot().catch(err => console.error('[Pair] startBot error:', err)), 2000);
}

async function startPairConnection(phoneNum, res, codeAlreadySent = false) {
    const pairLogger = pino({ level: 'fatal' }).child({ level: 'fatal' });
    const { state, saveCreds } = await useMultiFileAuthState(PAIR_FOLDER);

    let pairVersion;
    try {
        pairVersion = (await fetchLatestWaWebVersion()).version;
    } catch (e) {
        pairVersion = [2, 3000, 1045017392];
    }

    const pairSock = makeWASocket({
        version: pairVersion,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pairLogger),
        },
        logger: pairLogger,
        browser: Browsers.windows('Chrome'),
        printQRInTerminal: false,
        connectTimeoutMs: 60000,
        qrTimeout: 120000,
        agent: resolveProxyAgent(),
    });
    activePairSock = pairSock;

    pairSock.ev.on('creds.update', saveCreds);
    pairSock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log(chalk.green('[Pair] Connection open — copying session...'));
            await delay(3000);
            try {
                await copyPairSessionToAuth();
                finishPairing(true);
            } catch (e) {
                console.error(chalk.red('[Pair] Error copying session:'), e.message);
                finishPairing(false);
            }
            return;
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            const errorMsg = lastDisconnect?.error?.message || '';
            console.log(chalk.yellow(`[Pair] Connection closed: ${reason || errorMsg || 'Unknown'}`));

            if (reason === DisconnectReason.restartRequired) {
                console.log(chalk.yellow('[Pair] Restart required (515) — reconnecting with saved creds...'));
                closePairSocket();
                await delay(2000);
                startPairConnection(phoneNum, res, true).catch(err => {
                    console.error(chalk.red('[Pair] Restart failed:'), err.message);
                    finishPairing(false);
                });
                return;
            }

            if (!codeAlreadySent) return; // still waiting for user to enter code
            console.log(chalk.red('[Pair] Pairing failed after code was sent'));
            finishPairing(false);
        }
    });

    if (!codeAlreadySent) {
        await delay(3000);
        console.log(chalk.cyan(`[Pair] Requesting code for ${phoneNum}...`));
        const code = await Promise.race([
            pairSock.requestPairingCode(phoneNum),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Pairing code timeout')), 45000))
        ]);
        console.log(chalk.green(`[Pair] Code: ${code}`));
        lastPairingCode = code;
        lastPairingNumber = phoneNum;
        if (res && !res.headersSent) {
            res.json({ code });
        }
    }
}

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10; // Limite max pour éviter les boucles infinies
let bootStabilized = false;
let isStarting = false;
let isConnected = false;
let latestQR = null;
let latestQRAt = 0;
let lastConnectedAt = 0;
let sock = null;
let isPairingInProgress = false;
let activePairSock = null;
let isShuttingDown = false;
let pairingStartedAt = 0;
let lastPairingCode = null;
let lastPairingNumber = null;
let pairingTimeoutHandle = null;

const PAIRING_LOCK_MS = 5 * 60 * 1000;

function clearPairingTimeout() {
    if (pairingTimeoutHandle) {
        clearTimeout(pairingTimeoutHandle);
        pairingTimeoutHandle = null;
    }
}

function resetPairingState() {
    isPairingInProgress = false;
    clearPairingTimeout();
    closePairSocket();
    try { fs.rmSync(PAIR_FOLDER, { recursive: true, force: true }); } catch (e) {}
}

function isPairingStale() {
    if (!isPairingInProgress) return true;
    return Date.now() - pairingStartedAt > PAIRING_LOCK_MS;
}

function armPairingTimeout() {
    clearPairingTimeout();
    pairingTimeoutHandle = setTimeout(() => {
        if (!isPairingInProgress) return;
        console.log(chalk.yellow('[Pair] Timeout (5 min) — releasing pairing lock'));
        lastPairingCode = null;
        lastPairingNumber = null;
        finishPairing(false);
    }, PAIRING_LOCK_MS);
}

const processedMessages = new Set();
const messageCache = new Map();
const antideletePool = new Map(); // Global message pool for antidelete
let antilinkGroups = new Set(); // Groups with antilink ON
let antideleteGroups = new Set(); // Groups with antidelete ON
let readReceiptsEnabled = false; // Global toggle for read receipts

// --- Settings Persistence ---
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
function saveSettings() {
    try {
        const data = {
            antilink: Array.from(antilinkGroups),
            antidelete: Array.from(antideleteGroups)
        };
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Failed to save settings:", e.message);
    }
}

function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
            antilinkGroups = new Set(data.antilink || []);
            antideleteGroups = new Set(data.antidelete || []);
            console.log(chalk.green(`📑 Paramètres chargés: ${antilinkGroups.size} Antilink, ${antideleteGroups.size} Antidelete`));
        }
    } catch (e) {
        console.error("Failed to load settings:", e.message);
    }
}
loadSettings();

// --- Helpers ---
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

function header() {
    console.clear();
    console.log(chalk.cyan(figlet.textSync(BOT_NAME, { horizontalLayout: 'full' })));
    console.log(chalk.gray('Clean Slate Core V2 | Render Optimized'));
    console.log(chalk.gray('────────────────────────────────────────────────────'));
}

// --- Command Loader ---
const commands = new Map();
const commandFolder = path.join(__dirname, 'commands');

function loadCommands() {
    if (!fs.existsSync(commandFolder)) {
        console.log(chalk.yellow("⚠️ Dossier commands introuvable."));
        return;
    }
    fs.readdirSync(commandFolder).filter(f => f.endsWith('.js')).forEach(file => {
        try {
            const command = require(path.join(commandFolder, file));
            if (command.name) {
                commands.set(command.name, command);
                console.log(chalk.green(`✅ Commande chargée: ${command.name}`));
            }
        } catch (err) {
            console.error(chalk.red(`❌ Erreur chargement ${file}:`), err.message);
        }
    });

    // Register Gmail commands for natural language processing
    const gmailCommands = {
        'inbox': commands.get('inbox'),
        'delete': commands.get('delete'),
        'archive': commands.get('archive'),
        'spam': commands.get('spam'),
        'star': commands.get('star'),
        'unstar': commands.get('unstar'),
        'primary': commands.get('primary'),
        'social': commands.get('social'),
        'promotions': commands.get('promotions'),
        'updates': commands.get('updates'),
        'thread': commands.get('thread'),
        'search': commands.get('search'),
        'send': commands.get('send'),
        'compose': commands.get('compose')
    };

    // Register with command executor
    commandExecutor.registerCommands(gmailCommands);

    console.log(chalk.cyan('[Natural Language] Command executor initialized with Gmail commands'));
}

// --- Express App (Immediate Port Binding) ---
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const { registerCareerOpsRoutes } = require('./integrations/careerOpsRoutes');
registerCareerOpsRoutes(app, () => sock);

const __path = process.cwd();

// --- Routes (Public Access) ---
app.get('/', (req, res) => {
    res.sendFile(__path + '/index.html');
});

app.get('/qr', (req, res) => {
    console.log(chalk.cyan('[QR] Request received. Path:', __path + '/qr.html'));
    const filePath = __path + '/qr.html';
    if (!fs.existsSync(filePath)) {
        console.error(chalk.red('[QR] File not found:', filePath));
        return res.status(404).send('qr.html not found');
    }
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(chalk.red('[QR] sendFile error:'), err.message);
        } else {
            console.log(chalk.green('[QR] File sent successfully'));
        }
    });
});

app.get('/pair', (req, res) => {
    res.sendFile(__path + '/pair.html');
});

// Pairing code endpoint — isolated from main bot socket
app.get('/code/cancel', (req, res) => {
    console.log(chalk.yellow('[Pair] Cancel requested'));
    resetPairingState();
    lastPairingCode = null;
    lastPairingNumber = null;
    isStarting = false;
    res.json({ success: true, message: 'Pairing cancelled. You can request a new code.' });
    setTimeout(() => startBot().catch(e => console.error('[Pair] cancel recovery:', e)), 2000);
});

app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) {
        return res.status(400).json({ error: 'Missing ?number= parameter' });
    }

    num = num.replace(/[^0-9]/g, '');
    const force = req.query.force === '1' || req.query.force === 'true';

    if (isPairingInProgress) {
        if (lastPairingCode && lastPairingNumber === num && !isPairingStale()) {
            return res.json({ code: lastPairingCode, reused: true });
        }
        if (!force && !isPairingStale()) {
            return res.status(409).json({
                error: 'Pairing already in progress. Enter the code on your phone, wait, or add ?force=1 to restart.',
                code: lastPairingCode || undefined
            });
        }
        console.log(chalk.yellow('[Pair] Resetting previous pairing session...'));
        resetPairingState();
        await delay(1000);
    }

    console.log(chalk.cyan(`[Pair] Pairing code requested for ${num}`));

    isPairingInProgress = true;
    pairingStartedAt = Date.now();
    lastPairingCode = null;
    lastPairingNumber = num;
    armPairingTimeout();
    isStarting = false;
    reconnectAttempts = 0;
    closeSocket();

    try { fs.rmSync(PAIR_FOLDER, { recursive: true, force: true }); } catch (e) {}
    fs.mkdirSync(PAIR_FOLDER, { recursive: true });

    await delay(1500);

    try {
        await startPairConnection(num, res, false);
    } catch (err) {
        console.error(chalk.red('[Pair] Error:'), err.message);
        resetPairingState();
        lastPairingCode = null;
        lastPairingNumber = null;
        if (!res.headersSent) {
            res.status(500).json({ error: 'Pairing failed', details: err.message });
        }
        setTimeout(() => startBot().catch(e => console.error('[Pair] recovery startBot:', e)), 3000);
    }
});

// Force new QR code endpoint — disconnect and regenerate QR
app.get('/new-qr', (req, res) => {
    try {
        console.log(chalk.red('[NewQR] Forcing new QR code...'));

        // End socket connection
        if (sock) {
            sock.end();
        }

        // Clear session folder + backups
        try {
            fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
            const backupPaths = ['session_backup.txt', 'session_full_backup.txt'];
            for (const bp of backupPaths) {
                const p = path.join(__dirname, bp);
                if (fs.existsSync(p)) fs.unlinkSync(p);
            }
            console.log(chalk.green('[NewQR] Session + backups cleared'));
        } catch (e) {
            console.error('[NewQR] Failed to clear session:', e.message);
        }

        // Set flag to skip SESSION_DATA on next boot (otherwise the old broken session is restored)
        // Flag lives inside AUTH_FOLDER (persistent disk mount on Render) so it survives instance restarts
        try {
            if (!fs.existsSync(AUTH_FOLDER)) fs.mkdirSync(AUTH_FOLDER, { recursive: true });
            fs.writeFileSync(path.join(AUTH_FOLDER, '.skip-session-data'), 'true');
            console.log(chalk.green('[NewQR] Skip SESSION_DATA flag set — forcing fresh QR'));
        } catch (e) {
            console.error('[NewQR] Failed to set skip flag:', e.message);
        }

        res.json({
            success: true,
            message: 'Session cleared. New QR will be generated in 3 seconds.',
            check_qr_at: '/qr'
        });

        // Restart bot after 3s
        setTimeout(() => {
            console.log(chalk.yellow('[NewQR] Restarting bot for new QR...'));
            isStarting = false;
            reconnectAttempts = 1;
            startBot().catch(err => console.error('[NewQR Restart Error]:', err));
        }, 3000);

    } catch (err) {
        console.error('[NewQR] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// OAUTH 2.0 ENDPOINTS FOR GMAIL
// ============================================================================

const googleOAuth = require('./src/integrations/googleOAuth');

// OAuth authorization endpoint - generates Google consent URL
app.get('/oauth/authorize', (req, res) => {
    try {
        console.log(chalk.cyan('[OAuth] Authorization requested'));

        const authUrl = googleOAuth.generateAuthUrl();

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>KolaBoT - Gmail Authorization</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
                    h1 { color: #4285f4; }
                    .button { display: inline-block; padding: 15px 30px; background: #4285f4; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; font-size: 16px; }
                    .button:hover { background: #357ae8; }
                    .info { background: #f1f3f4; padding: 15px; border-radius: 5px; margin-top: 20px; text-align: left; }
                </style>
            </head>
            <body>
                <h1>🤖 KolaBoT Gmail Authorization</h1>
                <p>Pour accéder à votre Gmail personnel, KolaBoT a besoin de votre autorisation.</p>

                <div class="info">
                    <strong>📋 Permissions demandées:</strong>
                    <ul>
                        <li>✉️ Lire vos emails</li>
                        <li>📤 Envoyer des emails</li>
                        <li>🔍 Rechercher dans Gmail</li>
                        <li>📇 Accéder à vos contacts</li>
                    </ul>
                    <p><small>⚠️ Ces permissions sont nécessaires pour les commandes !inbox, !send, !search, !contacts</small></p>
                </div>

                <a href="${authUrl}" class="button">🔐 Autoriser l'accès Gmail</a>

                <p style="margin-top: 30px; font-size: 12px; color: #666;">
                    Vous serez redirigé vers Google pour confirmer l'accès.<br>
                    KolaBoT ne stocke que le token d'accès, jamais votre mot de passe.
                </p>
            </body>
            </html>
        `);

    } catch (error) {
        console.error(chalk.red('[OAuth] Authorization error:', error.message));
        res.status(500).json({ error: error.message });
    }
});

// OAuth callback endpoint - receives authorization code from Google
app.get('/oauth/callback', async (req, res) => {
    try {
        const code = req.query.code;
        const error = req.query.error;

        if (error) {
            console.log(chalk.red(`[OAuth] Authorization denied: ${error}`));
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Authorization Cancelled</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
                        h1 { color: #ea4335; }
                    </style>
                </head>
                <body>
                    <h1>❌ Autorisation Annulée</h1>
                    <p>Vous avez refusé l'accès à Gmail.</p>
                    <p>Les commandes Gmail ne fonctionneront pas sans autorisation.</p>
                    <p><a href="/oauth/authorize">Réessayer</a></p>
                </body>
                </html>
            `);
        }

        if (!code) {
            return res.status(400).json({ error: 'No authorization code received' });
        }

        console.log(chalk.cyan('[OAuth] Authorization code received, exchanging for tokens...'));

        const tokens = await googleOAuth.getTokenFromCode(code);

        console.log(chalk.green('[OAuth] ✅ Gmail access authorized!'));

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authorization Successful</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
                    h1 { color: #34a853; }
                    .success-box { background: #e6f4ea; border: 2px solid #34a853; padding: 20px; border-radius: 5px; margin: 20px 0; }
                    .commands { background: #f1f3f4; padding: 15px; border-radius: 5px; text-align: left; margin-top: 20px; }
                </style>
            </head>
            <body>
                <h1>✅ Autorisation Réussie!</h1>

                <div class="success-box">
                    <p><strong>🎉 KolaBoT a maintenant accès à votre Gmail!</strong></p>
                    <p>Le token d'accès expire le: ${new Date(tokens.expiry_date).toLocaleString('fr-FR')}</p>
                    <p><small>(Il sera automatiquement renouvelé)</small></p>
                </div>

                <div class="commands">
                    <strong>📱 Commandes maintenant disponibles sur WhatsApp:</strong>
                    <ul>
                        <li>!inbox - Voir vos emails</li>
                        <li>!inbox unread - Emails non-lus</li>
                        <li>!send &lt;email&gt; | &lt;sujet&gt; | &lt;message&gt; - Envoyer email</li>
                        <li>!search &lt;query&gt; - Rechercher dans Gmail</li>
                        <li>!contacts - Voir vos contacts</li>
                    </ul>
                </div>

                <p style="margin-top: 30px;">
                    <strong>Vous pouvez fermer cette page</strong><br>
                    Testez les commandes sur WhatsApp!
                </p>
            </body>
            </html>
        `);

    } catch (error) {
        console.error(chalk.red('[OAuth] Callback error:', error.message));
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authorization Error</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
                    h1 { color: #ea4335; }
                </style>
            </head>
            <body>
                <h1>❌ Erreur d'Autorisation</h1>
                <p>${error.message}</p>
                <p><a href="/oauth/authorize">Réessayer</a></p>
            </body>
            </html>
        `);
    }
});

// OAuth status endpoint - check authorization status
app.get('/oauth/status', (req, res) => {
    try {
        const status = googleOAuth.getStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// OAuth revoke endpoint - revoke access
app.get('/oauth/revoke', async (req, res) => {
    try {
        await googleOAuth.revokeAccess();
        res.json({ success: true, message: 'Gmail access revoked' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// ATTACHMENT DOWNLOAD ENDPOINT
// ============================================================================

// Download attachment endpoint - /download/:token
app.get('/download/:token', (req, res) => {
    try {
        const attachmentManager = require('./src/services/attachmentManager');
        const { token } = req.params;

        const attachment = attachmentManager.getAttachment(token);

        if (!attachment) {
            return res.status(404).json({
                error: 'Attachment not found or expired',
                message: 'The download link may have expired. Request a new email view.'
            });
        }

        // Set appropriate headers
        res.setHeader('Content-Type', attachment.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
        res.setHeader('Content-Length', attachment.size);

        // Send file
        res.sendFile(attachment.filePath, (err) => {
            if (err) {
                console.error('[Download] Error sending file:', err.message);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to download file' });
                }
            } else {
                console.log('[Download] File sent:', attachment.filename);
            }
        });

    } catch (error) {
        console.error('[Download] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Document download endpoint - /download/doc/:token
app.get('/download/doc/:token', (req, res) => {
    try {
        const wordDocumentCreator = require('./src/services/wordDocumentCreator');
        const { token } = req.params;

        const document = wordDocumentCreator.getDocument(token);

        if (!document) {
            return res.status(404).json({
                error: 'Document not found',
                message: 'The download link may have expired.'
            });
        }

        // Set Word document headers
        res.setHeader('Content-Type', document.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
        res.setHeader('Content-Length', document.size);

        // Send file
        res.sendFile(document.filepath, (err) => {
            if (err) {
                console.error('[DocumentDownload] Error:', err.message);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to download document' });
                }
            } else {
                console.log('[DocumentDownload] Sent:', document.filename);
            }
        });

    } catch (error) {
        console.error('[DocumentDownload] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Export download endpoint - /download/export/:token
app.get('/download/export/:token', (req, res) => {
    try {
        const quickWinsService = require('./src/services/quickWinsService');
        const { token } = req.params;

        const exportFile = quickWinsService.getExport(token);

        if (!exportFile) {
            return res.status(404).json({
                error: 'Export not found',
                message: 'The download link may have expired.'
            });
        }

        // Set CSV headers
        res.setHeader('Content-Type', exportFile.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${exportFile.filename}"`);
        res.setHeader('Content-Length', exportFile.size);

        // Send file
        res.sendFile(exportFile.filepath, (err) => {
            if (err) {
                console.error('[ExportDownload] Error:', err.message);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to download export' });
                }
            } else {
                console.log('[ExportDownload] Sent:', exportFile.filename);
            }
        });

    } catch (error) {
        console.error('[ExportDownload] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================

// Logout endpoint — disconnect and force new QR
app.get('/logout', (req, res) => {
    try {
        console.log(chalk.red('[Logout] Disconnecting bot...'));

        // End socket connection
        if (sock) {
            sock.end();
        }

        // Clear session folder + all backups
        try {
            fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
            const backupPaths = ['session_backup.txt', 'session_full_backup.txt'];
            for (const bp of backupPaths) {
                const p = path.join(__dirname, bp);
                if (fs.existsSync(p)) fs.unlinkSync(p);
            }
            console.log(chalk.green('[Logout] Session + backups cleared'));
        } catch (e) {
            console.error('[Logout] Failed to clear session:', e.message);
        }

        // Set flag to skip SESSION_DATA on next boot
        if (!fs.existsSync(AUTH_FOLDER)) fs.mkdirSync(AUTH_FOLDER, { recursive: true });
        fs.writeFileSync(path.join(AUTH_FOLDER, '.skip-session-data'), 'true');

        res.json({
            success: true,
            message: 'Bot disconnected. Restarting...',
            qr_url: '/qr'
        });

        // Restart bot after 2s
        setTimeout(() => {
            console.log(chalk.yellow('[Logout] Restarting bot...'));
            isStarting = false;
            reconnectAttempts = 1; // Set to 1 to skip stabilisation delay
            startBot().catch(err => console.error('[Logout Restart Error]:', err));
        }, 2000);

    } catch (err) {
        console.error('[Logout] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/ping', (req, res) => res.status(200).json({
    status: 'alive',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: BOT_NAME
}));

// ============================================================================
// ENDPOINT POUR ENVOYER DES MESSAGES WHATSAPP
// ============================================================================
app.post('/send-message', async (req, res) => {
    try {
        const { phone, message } = req.body;

        // Validation
        if (!phone || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing phone or message in request body'
            });
        }

        // Vérifier que le bot est connecté
        if (!sock || !sock.user) {
            return res.status(503).json({
                success: false,
                error: 'Bot not connected to WhatsApp'
            });
        }

        // Formater le numéro (enlever le + et ajouter @s.whatsapp.net)
        const cleanPhone = phone.replace(/[^0-9]/g, '');

        // Toujours envoyer au propriétaire du bot (vous-même)
        // C'est le seul moyen fiable d'éviter les erreurs de session WhatsApp
        const jid = sock.user.id;

        console.log(`[SEND-MESSAGE] Sending to bot owner (${cleanPhone}): ${jid}`);

        // Envoyer le message
        await sock.sendMessage(jid, { text: message });

        console.log(`[SEND-MESSAGE] Message sent to ${phone}`);

        res.status(200).json({
            success: true,
            phone: phone,
            jid: jid,
            message: 'Message sent successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[SEND-MESSAGE ERROR]:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// ENDPOINT POUR ENVOYER FICHIER + MESSAGE WHATSAPP
// ============================================================================
app.post('/send-file', async (req, res) => {
    try {
        const { phone, message, file_url, file_base64, file_name, mime_type } = req.body;

        // Validation — accepte file_url OU file_base64
        if (!phone || (!file_url && !file_base64)) {
            return res.status(400).json({
                success: false,
                error: 'Missing phone or file_url/file_base64 in request body'
            });
        }

        // Vérifier que le bot est connecté
        if (!sock || !sock.user) {
            return res.status(503).json({
                success: false,
                error: 'Bot not connected to WhatsApp'
            });
        }

        const jid = sock.user.id;
        console.log(`[SEND-FILE] Sending file to bot owner: ${jid}`);

        // Obtenir le buffer — depuis base64 ou depuis URL
        let fileBuffer;
        let finalMimeType = mime_type || 'application/octet-stream';
        if (file_base64) {
            fileBuffer = Buffer.from(file_base64, 'base64');
            console.log(`[SEND-FILE] Using base64 input (${fileBuffer.length} bytes)`);
        } else {
            const response = await axios.get(file_url, { responseType: 'arraybuffer' });
            fileBuffer = Buffer.from(response.data);
            finalMimeType = mime_type || response.headers['content-type'] || 'application/octet-stream';
        }

        const finalFileName = file_name || 'document';

        console.log(`[SEND-FILE] File: ${finalFileName}, MIME: ${finalMimeType}, Size: ${fileBuffer.length} bytes`);

        // Envoyer le message texte si fourni
        if (message) {
            await sock.sendMessage(jid, { text: message });
            console.log(`[SEND-FILE] Caption sent`);
        }

        // Envoyer le fichier
        await sock.sendMessage(jid, {
            document: fileBuffer,
            mimetype: finalMimeType,
            fileName: finalFileName
        });

        console.log(`[SEND-FILE] File sent successfully`);

        res.status(200).json({
            success: true,
            phone: phone,
            jid: jid,
            file_name: finalFileName,
            file_size: fileBuffer.length,
            message: 'File and message sent successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[SEND-FILE ERROR]:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// WEBHOOK POUR RECEVOIR LES ALERTES PULLBACK DEPUIS TRADBOT
// ============================================================================
// Écoute les événements Pullback Entry (PULLBACK_START, DETECTED, RESUMPTION, TRADE_OPENED)
// Relaie automatiquement vers le propriétaire du bot via WhatsApp
// ============================================================================

app.post('/pullback-webhook', async (req, res) => {
    try {
        const event = req.body;
        const {
            phase,                    // pullback_start, pullback_detected, resumption_confirmed, trade_opened, trade_failed
            symbol,
            direction,                // BUY or SELL
            message_preview           // Formatted message from TradBOT
        } = event;

        console.log(`[PULLBACK-WEBHOOK] Received: ${phase} — ${symbol} ${direction}`);

        // Validation
        if (!phase || !symbol || !direction) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: phase, symbol, direction'
            });
        }

        // Vérifier que le bot existe (peut ne pas avoir sock.user si en cours de connexion)
        if (!sock) {
            console.warn('[PULLBACK-WEBHOOK] Bot socket not initialized yet');
            return res.status(503).json({
                success: false,
                error: 'Bot initializing, try again in a few seconds'
            });
        }

        // Obtenir le message formaté
        // Si TradBOT envoie déjà un message formaté, l'utiliser
        // Sinon, construire un message basique
        let finalMessage = message_preview;
        if (!finalMessage) {
            finalMessage = `[${phase.toUpperCase()}] ${symbol}\n${direction}`;
        }

        // Envoyer au propriétaire du bot
        // Utiliser sock.user.id si disponible, sinon OWNER_PN
        let jid = OWNER_PN + "@s.whatsapp.net";
        if (sock.user && sock.user.id) {
            jid = sock.user.id;
        }

        console.log(`[PULLBACK-WEBHOOK] Sending to owner (${jid}): ${finalMessage.substring(0, 50)}...`);

        await sock.sendMessage(jid, { text: finalMessage });

        console.log(`[PULLBACK-WEBHOOK] ✅ Alert sent successfully`);

        res.status(200).json({
            success: true,
            phase: phase,
            symbol: symbol,
            direction: direction,
            message: 'Pullback alert received and forwarded',
            jid: jid,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[PULLBACK-WEBHOOK ERROR]:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// WEBHOOK DEBUG ENDPOINT
// ============================================================================
// Test endpoint pour vérifier que le webhook fonctionne
// ============================================================================

app.get('/pullback-webhook/test', async (req, res) => {
    try {
        if (!sock) {
            return res.status(503).json({
                success: false,
                error: 'Bot socket not initialized'
            });
        }

        // Envoyer un message test
        const jid = sock.user.id;
        const testMessage = `🧪 TEST WEBHOOK\n${new Date().toISOString()}\nPullback alert system is working!`;

        await sock.sendMessage(jid, { text: testMessage });

        res.json({
            success: true,
            message: 'Test message sent',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Broadcast function for WS
const broadcast = (data) => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
};

wss.on('connection', (ws) => {
    console.log('[WS] Client connected');
    if (latestQR) {
        QRCode.toDataURL(latestQR).then(url => {
            const ageSec = latestQRAt ? Math.floor((Date.now() - latestQRAt) / 1000) : 0;
            ws.send(JSON.stringify({ type: 'qr', qr: url, ageSec, expiresIn: Math.max(0, 120 - ageSec) }));
        });
    } else if (isConnected && sock?.user) {
        ws.send(JSON.stringify({ type: 'connected', user: sock.user.id.split(':')[0] }));
    } else {
        ws.send(JSON.stringify({ type: 'status', message: 'Waiting for QR code...' }));
    }
});

// --- Baileys Core ---
async function startBot() {
    if (isStarting) return;
    if (isPairingInProgress) {
        console.log(chalk.yellow('[Bot] startBot skipped — pairing in progress'));
        return;
    }
    cancelAllPendingReplies('bot restart');
    isStarting = true;
    isConnected = false;
    closeSocket();

    console.log(chalk.cyan('=== STARTBOT CALLED [v2] ==='));

    // Check if we should skip SESSION_DATA (flag set after 401 error)
    const skipSessionDataFlag = path.join(AUTH_FOLDER, '.skip-session-data');
    let skipSessionData = false;
    if (fs.existsSync(skipSessionDataFlag)) {
        skipSessionData = true;
        console.log(chalk.yellow('⚠️ SKIP_SESSION_DATA flag detected. Ignoring env SESSION_DATA restore only.'));
        // Do NOT wipe AUTH_FOLDER here — that destroyed fresh QR sessions on restartRequired (515).
        // Session purge is handled once in /logout, /new-qr, and 401 handlers.
    }

    header();
    broadcast({ type: 'status', message: 'Starting Bot...' });

    // Ensure session folder exists
    if (!fs.existsSync(AUTH_FOLDER)) fs.mkdirSync(AUTH_FOLDER, { recursive: true });

    const credsPath = path.join(AUTH_FOLDER, 'creds.json');

    // Valid creds on disk → clear stale skip flag (common on Render persistent disk)
    if (skipSessionData && fs.existsSync(credsPath)) {
        try {
            JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
            fs.unlinkSync(skipSessionDataFlag);
            skipSessionData = false;
            console.log(chalk.green('✅ skip-session-data cleared — session valide sur disque.'));
        } catch (e) {}
    }

    // RENDER SETTLING DELAY
    const isRender = process.env.RENDER || process.env.RENDER_URL;
    if (reconnectAttempts === 0 && isRender) {
        if (fs.existsSync(credsPath)) {
            console.log(chalk.yellow(`⏳ RENDER STABILISATION: Waiting 5s...`));
            await sleep(5000);
        } else {
            // Post-deploy: wait for old instance SIGTERM before showing QR
            console.log(chalk.yellow(`⏳ RENDER POST-DEPLOY: Waiting 8s before QR...`));
            await sleep(8000);
        }
    }

    console.log(chalk.cyan("🚀 Connexion au socket WhatsApp..."));
    broadcast({ type: 'status', message: 'Connecting to WhatsApp...' });

    // Safety: If creds.json exists but is invalid/corrupted, delete it
    if (fs.existsSync(credsPath)) {
        try {
            JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
            console.log(chalk.green("✅ Session file is valid."));
        } catch (e) {
            console.error(chalk.red("❌ Corrupted creds.json detected:"), e.message);
            fs.unlinkSync(credsPath);
            console.log(chalk.yellow("⚠️ Deleted corrupted session. New QR will be generated."));
        }
    }
    const backupPath = path.join(__dirname, 'session_backup.txt');
    const diskSessionFiles = getSessionFileCount();

    // Priorité 1 : backup complet (creds + pre-keys + sessions) — never overwrite disk session
    if (!skipSessionData && !process.env.SKIP_SESSION_DATA && diskSessionFiles === 0) {
        const restored = await restoreFullSession();
        if (restored) {
            console.log(chalk.green("✅ Session complète restaurée depuis session_full_backup.txt."));
        }
    }

    // Priorité 2 : backup local session_backup.txt (si disque vide)
    if (!skipSessionData && getSessionFileCount() === 0 && fs.existsSync(backupPath)) {
        console.log(chalk.blue("🔹 Backup local détecté. Restauration session..."));
        try {
            const sessionBuffer = Buffer.from(fs.readFileSync(backupPath, 'utf-8').trim(), 'base64').toString('utf-8');
            JSON.parse(sessionBuffer);
            fs.writeFileSync(credsPath, sessionBuffer);
            console.log(chalk.green("✅ Session restaurée depuis session_backup.txt."));
        } catch (e) {
            console.error(chalk.red("❌ Backup invalide:"), e.message);
        }
    }

    // Priorité 3 : SESSION_DATA env — only if disk is completely empty (avoid stale overwrite)
    const sessionDataRaw = (process.env.SESSION_DATA || '').trim();
    if (sessionDataRaw && getSessionFileCount() === 0 && !skipSessionData && !process.env.SKIP_SESSION_DATA) {
        console.log(chalk.blue("🔹 SESSION_DATA détectée. Restauration de la session..."));
        try {
            const sessionBuffer = Buffer.from(sessionDataRaw, 'base64').toString('utf-8');
            JSON.parse(sessionBuffer);
            fs.writeFileSync(credsPath, sessionBuffer);
            console.log(chalk.green("✅ Session restaurée depuis SESSION_DATA."));
        } catch (e) {
            console.error(chalk.red("❌ SESSION_DATA invalide:"), e.message);
        }
    } else if (sessionDataRaw && getSessionFileCount() > 0) {
        console.log(chalk.gray('ℹ️ SESSION_DATA ignorée — session disque prioritaire.'));
    }

    console.log(chalk.cyan('[LOG] Loading auth state...'));
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    console.log(chalk.cyan('[LOG] Auth state loaded'));
    const logger = pino({ level: 'info' });

    console.log(chalk.gray("🌐 Récupération de la version WhatsApp Web..."));
    // Fetch version with a strict 10s timeout to avoid hanging indefinitely
    let version;
    try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000));
        const fetchResult = await Promise.race([
            fetchLatestWaWebVersion(),
            timeoutPromise
        ]);
        version = fetchResult.version;
    } catch (e) {
        console.log(chalk.yellow("⚠️ Timeout version, utilisation du fallback."));
        version = [2, 3000, 1045017392];
    }

    console.log(chalk.gray(`📦 Version Baileys: ${version}`));

    const proxyAgent = resolveProxyAgent();

    console.log(chalk.cyan('[LOG] Creating WASocket...'));
    
    sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        browser: Browsers.windows('Chrome'),
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: true,
        connectTimeoutMs: 60000,
        qrTimeout: 120000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 2000,
        maxMsgRetryCount: 5,
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
        shouldIgnoreJid: (jid) => jid?.includes('@newsletter') || jid === 'status@broadcast',
        agent: proxyAgent,
    });
    console.log(chalk.cyan('[LOG] WASocket created'));

    sock.ev.on("creds.update", async () => {
        await saveCreds();
        if (!isConnected) return;
        try {
            const skipFlag = path.join(AUTH_FOLDER, '.skip-session-data');
            if (fs.existsSync(skipFlag)) {
                fs.unlinkSync(skipFlag);
                console.log(chalk.green('🗑️ skip-session-data flag cleared (creds updated).'));
            }
        } catch (e) {}
        try {
            await backupFullSession();
            const credsPath = path.join(AUTH_FOLDER, 'creds.json');
            if (fs.existsSync(credsPath)) {
                const credsRaw = fs.readFileSync(credsPath, 'utf-8');
                if (credsRaw.length > 20) {
                    fs.writeFileSync(path.join(__dirname, 'session_backup.txt'), Buffer.from(credsRaw).toString('base64'));
                }
            }
            scheduleSessionSync();
        } catch (e) {
            console.error('[Session Backup]', e.message);
        }
    });

    let criticalErrorCount = 0;

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection) {
            console.log(chalk.blue(`📡 Status: ${connection}`));
        }

        if (qr) {
            // Safety: Only show QR if we are definitely NOT connected
            if (connection === 'open') {
                console.log(chalk.gray(`[QR] Blocked: Connection is already open.`));
                return;
            }
            latestQR = qr;
            latestQRAt = Date.now();
            console.log(chalk.yellow(`[QR] New code generated.`));
            try {
                const url = await QRCode.toDataURL(qr);
                broadcast({ type: 'qr', qr: url, ageSec: 0, expiresIn: 120 });
                broadcast({ type: 'status', message: 'Please scan the new QR Code (valid ~2 min)' });
            } catch (e) {
                console.error('QR Encode Error', e);
            }
        }

        if (connection === "close") {
            if (isShuttingDown) {
                console.log(chalk.gray('[Bot] Close ignored — shutting down (SIGTERM/deploy)'));
                return;
            }
            if (isPairingInProgress) {
                console.log(chalk.gray('[Bot] Close ignored — pairing in progress'));
                return;
            }
            cancelAllPendingReplies('disconnected');

            const reason = lastDisconnect?.error?.output?.statusCode;
            const errorMsg = lastDisconnect?.error?.message || "";
            const isCritical = errorMsg.includes("PreKey") || errorMsg.includes("Bad MAC") || errorMsg.includes("Session error");

            console.log(chalk.red(`❌ Connection Closed: ${reason || 'Unknown'}`));

            if (isCritical) {
                criticalErrorCount++;
                console.log(chalk.yellow(`🚨 Critical Session Error (${criticalErrorCount}/3): ${errorMsg}`));

                if (criticalErrorCount >= 3) {
                    console.log(chalk.red.bold("� TOTAL SESSION FAILURE. Purging session folder for a clean start..."));
                    fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
                    process.exit(1); // Render will restart the bot fresh
                }
            }

            broadcast({ type: 'status', message: `Disconnected: ${reason || 'Error'}` });
            isStarting = false;
            isConnected = false;
            const errorRaw = JSON.stringify(lastDisconnect?.error || {});

            const isQrTimeout = reason === DisconnectReason.timedOut || reason === 408 ||
                reason === DisconnectReason.connectionClosed || reason === 428 ||
                errorMsg.includes('QR refs attempts ended') ||
                errorMsg.includes('Connection Closed');
            if (isQrTimeout && !hasValidSession()) {
                console.log(chalk.yellow(`⏱️ Connexion perdue pendant QR (${reason}) — nouveau QR dans 2s...`));
                closeSocket();
                reconnectAttempts = 0;
                setTimeout(() => startBot(), 2000);
                return;
            }
            if (isQrTimeout) {
                console.log(chalk.yellow('⏱️ QR expiré — nouveau QR dans 2s...'));
                closeSocket();
                reconnectAttempts = 0;
                setTimeout(() => startBot(), 2000);
                return;
            }

            if (reason === DisconnectReason.restartRequired) {
                console.log(chalk.yellow("🔄 Restart required — reconnexion (post-QR)..."));
                closeSocket();
                reconnectAttempts = 0;
                setTimeout(() => startBot(), 3000);
                return;
            }

            if (reason === DisconnectReason.connectionReplaced || reason === 440 || reason === 405) {
                console.log(chalk.red("⚠️ Conflit session — autre instance active. Retry dans 15s..."));
                closeSocket();
                reconnectAttempts = Math.min(reconnectAttempts + 1, MAX_RECONNECT_ATTEMPTS);
                setTimeout(() => startBot(), 15000);
                return;
            }

            {

                const errorStr = (lastDisconnect?.error?.message || '') + errorRaw;
                const isDeviceRemoved = errorStr.includes('device_removed');

                if (isDeviceRemoved) {
                    const uptimeMs = lastConnectedAt ? Date.now() - lastConnectedAt : 0;
                    console.log(chalk.red("⚠️ device_removed — WhatsApp a révoqué cette session."));
                    if (uptimeMs > 0 && uptimeMs < 30000) {
                        console.log(chalk.red.bold('🚨 CONFLIT PROBABLE: une autre instance du bot est connectée (local + Render ?).'));
                        console.log(chalk.yellow('   → Arrêtez le bot local avant d\'utiliser Render.'));
                    }
                    try {
                        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
                        if (!fs.existsSync(AUTH_FOLDER)) fs.mkdirSync(AUTH_FOLDER, { recursive: true });
                        fs.writeFileSync(path.join(AUTH_FOLDER, '.skip-session-data'), 'true');
                        const backupPaths = ['session_backup.txt', 'session_full_backup.txt'];
                        for (const bp of backupPaths) {
                            const p = path.join(__dirname, bp);
                            if (fs.existsSync(p)) fs.unlinkSync(p);
                        }
                        await clearSessionOnRender();
                        console.log(chalk.green("✅ Session purged due to device_removed. Fresh QR on restart."));
                    } catch (e) {
                        console.error(chalk.red("❌ Failed to purge session:"), e.message);
                    }
                    broadcast({ type: 'status', message: 'Device removed — stoppez le bot local puis rescanez le QR.' });
                    reconnectAttempts = 0;
                    isStarting = false;
                    isConnected = false;
                    setTimeout(() => startBot(), 10000);
                } else if (reason === DisconnectReason.loggedOut || reason === 401) {
                    const isNoiseHandshakeFailure = errorStr.includes('Connection Failure') ||
                                                  errorRaw.includes('"location":"atn"') ||
                                                  errorRaw.includes('"location":"cln"') ||
                                                  errorRaw.includes('decodeFrame');
                    console.log(chalk.red("🛑 401 received. Error details:"));
                    console.log(chalk.gray("  message:"), lastDisconnect?.error?.message);
                    console.log(chalk.gray("  raw:"), errorRaw);

                    if (isNoiseHandshakeFailure && !hasValidSession()) {
                        console.log(chalk.yellow('⚠️ 401 pendant appairage (cln/atn) — retry sans purge...'));
                        broadcast({ type: 'status', message: 'WhatsApp CDN busy — nouveau QR dans 5s...' });
                        reconnectAttempts = 0;
                        isStarting = false;
                        isConnected = false;
                        closeSocket();
                        setTimeout(() => startBot(), 5000);
                    } else if (isNoiseHandshakeFailure) {
                        console.log(chalk.yellow("⚠️ Noise handshake failure — clearing session for fresh QR..."));
                        try {
                            fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
                            if (!fs.existsSync(AUTH_FOLDER)) fs.mkdirSync(AUTH_FOLDER, { recursive: true });
                            fs.writeFileSync(path.join(AUTH_FOLDER, '.skip-session-data'), 'true');
                            const backupPaths = ['session_backup.txt', 'session_full_backup.txt'];
                            for (const bp of backupPaths) {
                                const p = path.join(__dirname, bp);
                                if (fs.existsSync(p)) fs.unlinkSync(p);
                            }
                            console.log(chalk.green("✅ Session purged — fresh QR will be generated."));
                        } catch (e) {
                            console.error(chalk.red("❌ Failed to purge session:"), e.message);
                        }
                        broadcast({ type: 'status', message: 'Session rejetée — nouveau QR généré. Scanne-le vite.' });
                        reconnectAttempts = 0;
                        isStarting = false;
                        isConnected = false;
                        setTimeout(() => startBot(), 3000);
                    } else {
                        console.log(chalk.red("🛑 Genuine logout (401). Clearing session."));
                        try {
                            fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
                            // Recreate the folder BEFORE writing the skip flag, otherwise
                            // writeFileSync throws ENOENT and the flag is never set → loop.
                            if (!fs.existsSync(AUTH_FOLDER)) fs.mkdirSync(AUTH_FOLDER, { recursive: true });
                            const backupPath = path.join(__dirname, 'session_backup.txt');
                            if (fs.existsSync(backupPath)) {
                                fs.unlinkSync(backupPath);
                                console.log(chalk.yellow("🗑️ session_backup.txt deleted."));
                            }
                            fs.writeFileSync(path.join(AUTH_FOLDER, '.skip-session-data'), 'true');
                            console.log(chalk.green("✅ Session cleared. Skipping SESSION_DATA on next boot."));
                        } catch (e) {
                            console.error(chalk.red("❌ Failed to clear session:"), e.message);
                        }
                        isStarting = false;
                        reconnectAttempts++;
                        setTimeout(() => startBot(), 5000);
                    }
                } else {
                    reconnectAttempts++;
                    lastConnectedAt = 0;
                    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                        console.log(chalk.red.bold(`🛑 MAX RECONNECT ATTEMPTS (${MAX_RECONNECT_ATTEMPTS}) REACHED. Waiting 5min before retry...`));
                        broadcast({ type: 'status', message: 'Too many retries. Pausing 5min...' });
                        reconnectAttempts = 0;
                        setTimeout(() => startBot(), 5 * 60 * 1000);
                    } else {
                        const delay = Math.min(3000 * reconnectAttempts, 30000);
                        console.log(chalk.yellow(`🔄 Reconnecting (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms...`));
                        setTimeout(() => startBot(), delay);
                    }
                }
            }
        } else if (connection === "open") {
            latestQR = null;
            latestQRAt = 0;
            reconnectAttempts = 0;
            criticalErrorCount = 0; // Reset error counter on success
            isStarting = false;
            isConnected = true;
            lastConnectedAt = Date.now();
            console.log(chalk.green.bold("\n✅ PSYCHOBOT ONLINE AND CONNECTED !"));

            // Clear skip flag now that we have a working session (so SESSION_DATA/disk session is used next boot)
            const skipFlagPath = path.join(AUTH_FOLDER, '.skip-session-data');
            if (fs.existsSync(skipFlagPath)) {
                fs.unlinkSync(skipFlagPath);
                console.log(chalk.green('🗑️ skip-session-data flag cleared (session valid).'));
            }

            const user = sock.user.id.split(':')[0];
            broadcast({ type: 'connected', user });

            // Check if this is the first connection today
            const today = new Date().toDateString();
            const isFirstConnectionToday = lastDailyWelcomeSent !== today;

            if (isFirstConnectionToday) {
                console.log(chalk.cyan('[Daily Welcome] Sending first-of-day command list...'));
                lastDailyWelcomeSent = today;
            }

            const msgText = `*✅ SESSION CONNECTEE!*${isFirstConnectionToday ? ' 🌅 *PREMIERE CONNEXION DU JOUR*' : ''}

🤖 *Bot:* ${BOT_NAME}
📱 *User:* ${user}
🔋 *Mode:* Core V2
⏰ *Time:* ${new Date().toLocaleTimeString()}

━━━━━━━━━━━━━━━━━━━━
📋 *COMMANDES PRINCIPALES*
━━━━━━━━━━━━━━━━━━━━

🤖 *IA & Creation*
• !ai <question> - Chat avec l'IA
• !imagine <texte> - Generer une image
• !sticker - Convertir image en sticker
• !translate <texte> - Traduction

📅 *Productivite*
• !calendar [demain|01/06] - Voir agenda
• !planifier <date> <heure> <titre> - Creer evenement
• !contacts [recherche] - Lister/rechercher contacts
• !addcontact <nom> <email> <tel> - Ajouter contact
• !authorize - Autoriser acces Gmail (1ere fois)
• !gmailstatus - Verifier statut Gmail
• !inbox [nombre|unread] - Voir emails
• !send <email> | <sujet> | <message> - Envoyer email
• !search <query> - Rechercher dans Gmail

🎮 *Jeux & Fun*
• !guess - Jeu devinette
• !coinflip - Pile ou face
• !motgame - Jeu de mots

🧠 *Jeux Educatifs (prefix 🎮)*
• 🎮 jouer <riddles|memory|words|maths|patterns> - Jouer
• 🎮 stats - Vos statistiques
• 🎮 suggestion - Suggestion d'activite
• 🎮 leaderboard - Classement
• 🎮 help - Aide jeux

🎵 *Media*
• !play <titre> - Telecharger audio
• !audio - Extraire audio d'une video
• !chipmunks - Effet voix chipmunk

👥 *Groupe (Admin)*
• !tagall - Mentionner tous
• !kick @user - Expulser
• !promote @user - Promouvoir admin
• !demote @user - Retirer admin
• !antilink on/off - Protection liens
• !antidelete on/off - Anti-suppression

🛠️ *Utilitaires*
• !help - Liste complete
• !ping - Tester le bot
• !session - Info session
• !transcript - Transcrire audio

${isFirstConnectionToday ? '✨ *Nouvelle journee, nouvelles possibilites!* ✨' : 'Type !help pour plus de details!'}`;

            // Wait for connection to stabilize before welcome + sync (avoids device_removed race)
            await delay(5000);
            if (!isConnected || !sock?.user) return;

            await sock.sendMessage(sock.user.id, { text: msgText });
            await backupFullSession();
            scheduleSessionSync();
        }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        const msg = messages[0];

        // 2. Ignore messages sent before the bot was turned on
        if (msg.messageTimestamp < botStartTime) return;

        // --- ANTIDELETE (Upsert Detection) ---
        if (msg.message?.protocolMessage?.type === 0 || msg.message?.protocolMessage?.type === 5) {
            const jid = msg.key.remoteJid;
            const isGroup = jid.endsWith('@g.us');
            if (!isGroup || antideleteGroups.has(jid)) {
                const targetId = msg.message.protocolMessage.key?.id;
                if (!targetId) return;
                const archived = antideletePool.get(targetId);
                if (archived) {
                    const sender = archived.key.participant || archived.key.remoteJid;
                    if (archived.key.fromMe || isOwner(sender)) return; // Don't recover owner deletions

                    console.log(chalk.yellow(`[Antidelete] Detected delete (upsert) in ${jid}. Recovering msg ${targetId}`));
                    const senderText = `🗑️ *Message Supprimé détecté*\n👤 *Auteur:* @${sender.split('@')[0]}`;
                    if (isGroup) {
                        await sock.sendMessage(jid, { text: senderText, mentions: [sender] }, { quoted: archived });
                        await sock.sendMessage(jid, { forward: archived });
                    } else {
                        // Forward to Owner Private
                        const ownerJid = sock.user.id.split(':')[0] + "@s.whatsapp.net";
                        await sock.sendMessage(ownerJid, { text: `🚨 *Antidelete Privé* (de @${sender.split('@')[0]})\n` + senderText, mentions: [sender] });
                        await sock.sendMessage(ownerJid, { forward: archived });
                    }
                }
            }
        }

        // --- AUTO-VIEW & AUTO-LIKE STATUS ---
        if (msg.key.remoteJid === 'status@broadcast') {
            // Ignorer nos propres statuts et commentaires
            if (msg.key.fromMe) return;

            const statusOwner = msg.key.participant || msg.participant;
            console.log(chalk.gray(`[Status] Auto-viewing status from ${msg.pushName || statusOwner}`));

            // Mark as read (vue silencieuse)
            await sock.readMessages([msg.key]);

            // Auto-like avec coeur (uniquement statuts des autres, pas nos commentaires)
            try {
                await sock.sendMessage('status@broadcast', {
                    react: {
                        text: '❤️',
                        key: msg.key
                    }
                });
                console.log(chalk.magenta(`[Status] ❤️ Liked status from ${msg.pushName || statusOwner}`));
            } catch (err) {
                console.error('[Status] Failed to react:', err.message);
            }

            return; // Don't process status as a normal message
        }

        if (!msg.message) return;
        // if (msg.key.fromMe) return; // Allow bot owner to use commands

        const msgId = msg.key.id;
        if (processedMessages.has(msgId)) return;
        processedMessages.add(msgId);
        if (processedMessages.size > 500) processedMessages.clear(); // Simple GC

        const remoteJid = msg.key.remoteJid;

        // AI Auto-Reply for Greetings (No Prefix)
        // Skip if message is from the bot itself or the owner
        const msgSender = msg.key.participant || msg.participant || msg.key.remoteJid;
        const msgSenderClean = msgSender.split(':')[0].split('@')[0];
        const isFromOwner = msg.key.fromMe || isOwner(msg.key.participant || msg.key.remoteJid);

        if (isFromOwner) {
            lastOwnerActionTime = Date.now();
            // [NEW] Mark owner as active in conversation state
            setOwnerActive(remoteJid);
            // Cancel any pending delayed reply — owner is handling this conversation
            cancelAllPendingRepliesForJid(remoteJid);
        }

        // Text extraction
        const text = msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.videoMessage?.caption || "";

        // --- GAME COMMAND HANDLER (prefix 🎮) ---
        if (text.startsWith('🎮')) {
            const gameCmd = commands.get('🎮');
            if (gameCmd) {
                const gameArgs = text.slice(1).trim().split(/ +/);
                const replyWithTag = async (s, j, m, t) => {
                    await s.sendMessage(j, { text: t, mentions: [m.key.participant || m.key.remoteJid] }, { quoted: m });
                };
                try {
                    await gameCmd.run({ sock, msg, replyWithTag, args: gameArgs });
                } catch (e) {
                    console.error('[GAME] Erreur:', e.message);
                }
                return;
            }
        }

        // --- PERSISTENT CHAT HISTORY (private conversations only) ---
        if (!remoteJid.endsWith('@g.us') && !remoteJid.endsWith('@broadcast')) {
            const msgType = detectMessageType(msg.message);
            const histRole = isFromOwner ? 'owner' : 'user';
            const histContent = text || `[${msgType}]`;
            const histName = msg.pushName || null;
            chatHistory.recordMessage(remoteJid, histName, histRole, histContent, msgType === 'text' ? 'text' : msgType);
        }

        // --- FORWARD TO OWNER (messages from others, private only) ---
        if (!isFromOwner && !remoteJid.endsWith('@g.us') && !remoteJid.endsWith('@broadcast') && sock?.user) {
            try {
                const ownerJid = OWNER_PN + '@s.whatsapp.net';
                // Don't forward if this IS the owner's own chat with the bot
                if (remoteJid !== ownerJid) {
                    const senderName = msg.pushName || msgSenderClean;
                    const msgType = detectMessageType(msg.message);
                    const preview = text
                        ? (text.length > 300 ? text.substring(0, 300) + '…' : text)
                        : `[${msgType}]`;
                    const notif = `📨 *Nouveau message*\n`
                        + `👤 *${senderName}*\n`
                        + `📱 +${msgSenderClean}\n`
                        + `━━━━━━━━━━━━━━\n`
                        + `${preview}`;
                    await sock.sendMessage(ownerJid, { text: notif });
                }
            } catch (e) {
                console.error('[Forward] Error:', e.message);
            }
        }

        console.log(`[MSG] From ${remoteJid} (${msg.pushName}): ${text.substring(0, 50)}`);

        // --- ANTILINK ENFORCEMENT ---
        if (antilinkGroups.has(remoteJid) && !isFromOwner) {
            const linkPattern = /chat.whatsapp.com\/[a-zA-Z0-9]/;
            if (linkPattern.test(text)) {
                console.log(`[Antilink] Link detected from ${msg.pushName}. Deleting...`);
                // Use helper to delete and kick
                await sock.sendMessage(remoteJid, { delete: msg.key });
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const botIsAdmin = groupMetadata.participants.find(p => cleanJid(p.id) === cleanJid(sock.user.id))?.admin;
                if (botIsAdmin) {
                    await sock.groupParticipantsUpdate(remoteJid, [msg.key.participant || remoteJid], "remove");
                }
                return; // Stop processing
            }
        }

        // Cache all messages for Antidelete extraction
        // Limit cache size to 2000 messages to save memory
        if (msg.message && !msg.message.protocolMessage) {
            antideletePool.set(msg.key.id, msg);
            if (antideletePool.size > 2000) {
                const firstKey = antideletePool.keys().next().value;
                antideletePool.delete(firstKey);
            }
        }

        // Cache ViewOnce messages for reaction extraction (Support Ephemeral)
        const realMsg = msg.message?.ephemeralMessage?.message || msg.message;
        const isViewOnce = realMsg?.viewOnceMessage || realMsg?.viewOnceMessageV2 || realMsg?.viewOnceMessageV2Extension;
        if (isViewOnce) {
            console.log(`[Cache] Caching ViewOnce message: ${msg.key.id}`);
            messageCache.set(msg.key.id, msg);
            setTimeout(() => messageCache.delete(msg.key.id), 24 * 60 * 60 * 1000); // 24h cache
        }

        // --- MINI-GAME HANDLER (Passive) ---
        let gameHandled = false;
        for (const [name, cmd] of commands) {
            if (cmd.onMessage) {
                try {
                    const result = await cmd.onMessage(sock, msg, text);
                    if (result === true) {
                        gameHandled = true;
                        break;
                    }
                } catch (e) {
                    console.error(`[Game Error] ${name}:`, e.message);
                }
            }
        }
        if (gameHandled) return;

        // --- ENHANCED INTELLIGENT AUTO-REPLY (Private messages only, not from owner) ---
        if (!text.startsWith(PREFIX) && !isFromOwner && !remoteJid.endsWith('@g.us')) {
            // [NEW] Detect message type (audio, image, text, etc.)
            const messageType = detectMessageType(msg.message);
            console.log(`[AutoReply] Type detected: ${messageType}`);
            updateUserMessageType(remoteJid, messageType);

            // [NEW] Check if conversation is active (owner replied < 15 min ago)
            if (isConversationActive(remoteJid)) {
                console.log(`[AutoReply] SKIPPED: Conversation active (owner replied recently)`);
                return; // Don't auto-reply
            }

            // [NEW] Decide reply level based on owner activity
            const autoReplyDecision = shouldAutoReplyBasedOnActivity(remoteJid);
            console.log(`[AutoReply] Decision: ${autoReplyDecision} | MessageType: ${messageType}`);

            // Handle specific message types - AUDIO PROCESSING (delayed 15 min)
            if (messageType === 'voice_note' || messageType === 'audio_document' || messageType === 'audio') {
                if (pendingReplies.has(remoteJid)) {
                    console.log(`[DelayedReply] Already pending for ${remoteJid}, skipping audio duplicate`);
                    return;
                }

                const audioMessage = msg.message.audioMessage || msg.message.viewOnceMessage?.message?.audioMessage;
                if (!audioMessage) {
                    console.log(`[AudioHandler] No audioMessage found — skipping`);
                    return;
                }

                const callerNameAudio = msg.pushName && msg.pushName.trim().length > 0
                    ? msg.pushName.trim()
                    : '+' + msgSenderClean;

                console.log(`[DelayedReply] ⏱ Scheduling audio reply in 15min for ${callerNameAudio} (${remoteJid})`);

                const timerAudio = setTimeout(async () => {
                    pendingReplies.delete(remoteJid);

                    if (!canSendDelayedReply()) {
                        console.log(`[DelayedReply] Bot offline — skipping audio reply for ${remoteJid}`);
                        return;
                    }
                    if (isConversationActive(remoteJid)) {
                        console.log(`[DelayedReply] Owner responded during audio wait — aborting for ${remoteJid}`);
                        return;
                    }

                    try {
                        await sock.sendPresenceUpdate('composing', remoteJid);

                        const audioProcessor = require('./src/services/audioProcessor');
                        const { audioPath, transcript, response } = await audioProcessor.processAudioMessage(
                            audioMessage,
                            downloadContentFromMessage,
                            remoteJid,
                            callerNameAudio,
                            null
                        );

                        await sock.sendMessage(remoteJid, {
                            audio: fs.readFileSync(audioPath),
                            mimetype: 'audio/ogg; codecs=opus',
                            ptt: true,
                        });

                        const textSummary = `🎙️ *Transcript*:\n_"${transcript}"_\n\n🤖 *Response*:\n${response}`;
                        await sock.sendMessage(remoteJid, { text: textSummary });
                        chatHistory.recordMessage(remoteJid, msg.pushName || null, 'bot', `[audio] ${response}`, 'audio');

                        audioProcessor.cleanup([audioPath]);
                        if (readReceiptsEnabled) await sock.readMessages([msg.key]);
                        console.log(`[DelayedReply] ✓ Audio response sent after 15min delay`);
                    } catch (err) {
                        console.error('[DelayedReply Audio] Error:', err.message);
                    }
                }, DELAYED_REPLY_MS);

                pendingReplies.set(remoteJid, { timer: timerAudio, callerName: callerNameAudio, text: '[audio]', remoteJid });
                return;
            }

            // Handle image/video (delayed 15 min)
            if (messageType === 'image' || messageType === 'video') {
                if (pendingReplies.has(remoteJid)) {
                    console.log(`[DelayedReply] Already pending for ${remoteJid}, skipping media duplicate`);
                    return;
                }

                console.log(`[DelayedReply] ⏱ Scheduling media ack in 15min for ${remoteJid}`);

                const timerMedia = setTimeout(async () => {
                    pendingReplies.delete(remoteJid);

                    if (!canSendDelayedReply()) {
                        console.log(`[DelayedReply] Bot offline — skipping media ack for ${remoteJid}`);
                        return;
                    }
                    if (isConversationActive(remoteJid)) {
                        console.log(`[DelayedReply] Owner responded during media wait — aborting for ${remoteJid}`);
                        return;
                    }

                    try {
                        const template = getAutoReplyTemplate('image_ack', messageType, '');
                        const reply = formatReplyForWhatsApp(template, true);
                        if (reply) {
                            await sock.sendMessage(remoteJid, { text: reply });
                            if (readReceiptsEnabled) await sock.readMessages([msg.key]);
                        }
                        console.log(`[DelayedReply] ✓ Media ack sent after 15min delay`);
                    } catch (err) {
                        console.error('[DelayedReply Media] Error:', err.message);
                    }
                }, DELAYED_REPLY_MS);

                pendingReplies.set(remoteJid, { timer: timerMedia, callerName: 'media', text: '[media]', remoteJid });
                return;
            }

            // Skip auto-reply if conversation not active AND decision is 'skip'
            if (autoReplyDecision === 'skip') {
                console.log(`[AutoReply] QUEUED: Owner absent < 60min, multiple messages pending`);
                return;
            }

            // DELAYED REPLY: Schedule reply after 15 min — cancel if owner responds first
            // If there's already a pending reply for this jid, don't stack another
            if (pendingReplies.has(remoteJid)) {
                console.log(`[DelayedReply] Already pending for ${remoteJid}, skipping duplicate`);
                return;
            }

            const callerName = msg.pushName && msg.pushName.trim().length > 0
                ? msg.pushName.trim()
                : '+' + msgSenderClean;

            console.log(`[DelayedReply] ⏱ Scheduling reply in 15min for ${callerName} (${remoteJid})`);

            const timer = setTimeout(async () => {
                pendingReplies.delete(remoteJid);

                if (!canSendDelayedReply()) {
                    console.log(`[DelayedReply] Bot offline — skipping reply for ${remoteJid}`);
                    return;
                }
                if (isConversationActive(remoteJid)) {
                    console.log(`[DelayedReply] Owner responded during wait — aborting for ${remoteJid}`);
                    return;
                }

                console.log(`[DelayedReply] ✓ 15min elapsed, sending reply to ${callerName} (${remoteJid})`);
                try {
                    await sock.sendPresenceUpdate('composing', remoteJid);

                    const aiModule = require('./src/services/ai');
                    const history = aiModule.getConversationHistory(remoteJid);
                    const reply = await aiModule.getAIResponse(text, callerName, history, remoteJid);
                    // SMART AUTO-REPLY: Change from generic 🤖 to context-aware with Sidoine absence notice
                    const formattedReply = `📝 *Nota: Sidoine n'est pas là actuellement.*\n\n${reply}`;
                    await sock.sendMessage(remoteJid, { text: formattedReply });
                    chatHistory.recordMessage(remoteJid, callerName, 'bot', reply);

                    if (readReceiptsEnabled) {
                        await sock.readMessages([msg.key]);
                    }
                } catch (err) {
                    console.error("[DelayedReply] AI Error:", err.message);
                    if (!canSendDelayedReply()) return;

                    try {
                        const template = getAutoReplyTemplate(autoReplyDecision, messageType, text);
                        const reply = formatReplyForWhatsApp(template, true);
                        if (reply) {
                            await sock.sendMessage(remoteJid, { text: reply });
                        }
                    } catch (sendErr) {
                        console.error('[DelayedReply] Fallback send failed:', sendErr.message);
                    }
                }
            }, DELAYED_REPLY_MS);

            pendingReplies.set(remoteJid, { timer, callerName, text, remoteJid });
        }

        // --- GROUP AUTO-REPLY (only on greetings) ---
        if (!text.startsWith(PREFIX) && !isFromOwner && remoteJid.endsWith('@g.us')) {
            const lowerText = text.toLowerCase().trim();
            const greetings = ['hello', 'hi', 'bonjour', 'salut', 'yo', 'coucou', 'hey', 'cc', 'bonsoir', 'bjr', 'bsr'];
            const isGreeting = greetings.includes(lowerText) || (lowerText.length < 15 && greetings.some(g => lowerText.startsWith(g)));

            if (isGreeting) {
                const isOwnerOnline = (Date.now() - lastOwnerActionTime) < 2 * 60 * 1000;
                if (!isOwnerOnline) {
                    try {
                        const sysPrompt = "You are a normal human in a group chat. Reply naturally and coolly to greetings. Match language (French/English) and slang. Keep it very short (max 5 words). Do not offer help or mention being a bot.";
                        const reply = await getAIResponse(`Reply to: "${text}"`, sysPrompt);
                        await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
                    } catch (err) {
                        console.error("[AI Group] Error:", err.message);
                    }
                }
            }
        }

        // --- UNIVERSAL INCOGNITO EXTRACTION ---
        const firstType = Object.keys(msg.message || {})[0];
        const contextInfo = msg.message?.[firstType]?.contextInfo ||
            msg.message?.extendedTextMessage?.contextInfo ||
            msg.message?.stickerMessage?.contextInfo;

        const quotedMsg = contextInfo?.quotedMessage;

        if (quotedMsg && isFromOwner) {
            let qContent = quotedMsg;
            // Peel wrappers (Robust Peeling)
            if (qContent.ephemeralMessage) qContent = qContent.ephemeralMessage.message;
            if (qContent.viewOnceMessage) qContent = qContent.viewOnceMessage.message;
            if (qContent.viewOnceMessageV2) qContent = qContent.viewOnceMessageV2.message;
            if (qContent.viewOnceMessageV2Extension) qContent = qContent.viewOnceMessageV2Extension.message;

            const mediaType = qContent.imageMessage ? 'image' :
                qContent.videoMessage ? 'video' :
                    qContent.audioMessage ? 'audio' : null;

            if (mediaType) {
                console.log(`[ViewOnce] Owner extraction trigger (Reply) for ${contextInfo.stanzaId}`);
                try {
                    const mediaData = qContent[`${mediaType}Message`];
                    if (mediaData && mediaData.mediaKey) {
                        const stream = await downloadContentFromMessage(mediaData, mediaType);
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

                        const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                        const caption = `🔓 *ViewOnce Extracted* (From: ${msg.pushName || 'Inconnu'})`;
                        const options = { jpegThumbnail: null };

                        if (mediaType === 'image') await sock.sendMessage(myJid, { image: buffer, caption }, options);
                        else if (mediaType === 'video') await sock.sendMessage(myJid, { video: buffer, caption }, options);
                        else if (mediaType === 'audio') await sock.sendMessage(myJid, { audio: buffer, mimetype: 'audio/mp4', ptt: true });

                        // Feedback: React on the VIEW ONCE message itself
                        await sock.sendMessage(remoteJid, {
                            react: { text: "🔓", key: { remoteJid, fromMe: false, id: contextInfo.stanzaId, participant: contextInfo.participant } }
                        });
                    }
                } catch (err) {
                    console.error("[Incognito Reply] Error:", err.message);
                }
            }
        }

        // ============================================================================
        // NATURAL LANGUAGE COMMAND PROCESSING
        // ============================================================================

        // If not a command (!), try natural language processing
        if (!text.startsWith(PREFIX) && text.length > 3) {
            const userId = remoteJid;

            try {
                const result = await commandExecutor.processMessage(
                    text,
                    { sock, msg },
                    userId
                );

                // If a command was executed, skip normal AI processing
                if (result.executed) {
                    console.log('[Natural Language] Command executed:', result.intent);

                    // Update context if it was an inbox command
                    if (result.command === 'inbox') {
                        const session = userSession.getSession(userId);
                        if (session.gmail.emails.length > 0) {
                            contextManager.updateLastEmails(userId, session.gmail.emails);
                            contextManager.updateNavigation(userId, {
                                currentPage: session.gmail.currentPage,
                                category: session.gmail.category
                            });
                        }
                    }

                    return; // Skip normal message processing
                }

                // If not executed but analyzed, log for debugging
                if (result.intent !== 'none') {
                    console.log('[Natural Language] Intent detected but not executed:', result.intent, result.reason);
                }

            } catch (error) {
                console.error('[Natural Language] Processing error:', error.message);
                // Continue to normal processing if NL fails
            }
        }

        // ============================================================================

        // Command Handling
        if (text.startsWith(PREFIX)) {
            const args = text.slice(PREFIX.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();

            // Special Handle for internal state toggles
            if (commandName === 'readreceipts') {
                if (isFromOwner) {
                    const toggle = args[0]?.toLowerCase();
                    if (toggle === 'on') readReceiptsEnabled = true;
                    else if (toggle === 'off') readReceiptsEnabled = false;
                    else readReceiptsEnabled = !readReceiptsEnabled;

                    await sock.sendMessage(remoteJid, { text: `✅ Read Receipts: *${readReceiptsEnabled ? 'ON' : 'OFF'}*` }, { quoted: msg });
                } else {
                    await sock.sendMessage(remoteJid, { text: "❌ Owner only." }, { quoted: msg });
                }
                return;
            }

            const command = commands.get(commandName);

            if (command) {
                // SECURITY: Only the bot owner can execute adminOnly commands
                if (command.adminOnly && !isFromOwner) {
                    return await sock.sendMessage(remoteJid, { text: "❌ Cette commande est réservée au propriétaire du bot (Owner Only)." }, { quoted: msg });
                }

                console.log(`[CMD] Executing ${commandName}...`);
                try {
                    // Inject replyWithTag helper
                    const replyWithTag = async (s, j, m, t) => {
                        await s.sendMessage(j, { text: t, mentions: [m.key.participant || m.key.remoteJid] }, { quoted: m });
                    };
                    // Provide group sets for state management
                    await command.run({ sock, msg, commands, replyWithTag, args, antilinkGroups, antideleteGroups });

                    // Update context for Gmail commands
                    const userId = remoteJid;
                    if (['inbox', 'primary', 'social', 'promotions', 'updates'].includes(commandName)) {
                        const session = userSession.getSession(userId);
                        if (session.gmail.emails.length > 0) {
                            contextManager.updateLastEmails(userId, session.gmail.emails);
                            contextManager.updateNavigation(userId, {
                                currentPage: session.gmail.currentPage,
                                category: session.gmail.category
                            });
                        }
                    }

                    // Auto-save settings if they might have changed
                    if (commandName === 'antilink' || commandName === 'antidelete') {
                        saveSettings();
                    }
                } catch (err) {
                    console.error(`Erreur ${commandName}:`, err);
                }
            }
        }
    });

    // --- ANTIDELETE (Update Detection) ---
    sock.ev.on("messages.update", async (updates) => {
        for (const update of updates) {
            // Support for various Baileys deletion notification structures
            const proto = update.update?.message?.protocolMessage || update.update?.protocolMessage;

            if (proto?.type === 0 || proto?.type === 5) {
                const jid = update.key.remoteJid;
                const isGroup = jid.endsWith('@g.us');

                // Enforce group setting but allow private chats always
                if (isGroup && !antideleteGroups.has(jid)) continue;

                const targetId = proto.key?.id || update.key.id;
                const archived = antideletePool.get(targetId);

                if (archived) {
                    const sender = archived.key.participant || archived.key.remoteJid;
                    if (archived.key.fromMe || isOwner(sender)) continue; // Don't recover owner deletions

                    console.log(chalk.yellow(`[Antidelete] Detected delete in ${jid}. Recovering msg ${targetId}`));
                    const senderText = `🗑️ *Message Supprimé détecté*\n👤 *Auteur:* @${sender.split('@')[0]}`;

                    try {
                        if (isGroup) {
                            await sock.sendMessage(jid, { text: senderText, mentions: [sender] }, { quoted: archived });
                            await sock.sendMessage(jid, { forward: archived });
                        } else {
                            // Forward to Owner Private
                            const ownerJid = sock.user.id.split(':')[0] + "@s.whatsapp.net";
                            await sock.sendMessage(ownerJid, { text: `🚨 *Antidelete Privé* (de @${sender.split('@')[0]})\n` + senderText, mentions: [sender] });
                            await sock.sendMessage(ownerJid, { forward: archived });
                        }
                    } catch (err) {
                        console.error("[Antidelete] Recovery failed:", err.message);
                    }
                }
            }
        }
    });
    const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

    // Reaction Handler for ViewOnce Extraction (Incognito)
    sock.ev.on("messages.reaction", async (reactions) => {
        const cleanJid = (jid) => jid ? jid.split(':')[0].split('@')[0] : "";

        for (const reaction of reactions) {
            const { key } = reaction;

            // SECURITY: Only extraction if the reactor is the Owner
            const reactor = reaction.key.fromMe ? sock.user.id : (reaction.key.participant || reaction.key.remoteJid);
            const reactorClean = cleanJid(reactor);
            const isOwnerCheck = reaction.key.fromMe || isOwner(reaction.key.participant || reaction.key.remoteJid);

            if (!isOwnerCheck) continue;

            const archivedMsg = messageCache.get(key.id);
            if (archivedMsg) {
                let content = archivedMsg.message;
                if (content.ephemeralMessage) content = content.ephemeralMessage.message;
                const viewOnce = content?.viewOnceMessage || content?.viewOnceMessageV2 || content?.viewOnceMessageV2Extension;

                if (viewOnce) {
                    console.log(`[ViewOnce] Owner extraction trigger (Reaction) for ${key.id}`);
                    try {
                        const viewOnceContent = viewOnce.message;
                        const mediaType = Object.keys(viewOnceContent).find(k => k.includes('Message'));
                        if (!mediaType) return;

                        const mediaData = viewOnceContent[mediaType];
                        const stream = await downloadContentFromMessage(mediaData, mediaType.replace('Message', ''));
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

                        const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                        const caption = `🔓 *ViewOnce Extracted* (From: ${archivedMsg.pushName || 'Inconnu'})`;
                        const type = mediaType.replace('Message', '');
                        const options = { jpegThumbnail: null };

                        if (type === 'image') await sock.sendMessage(myJid, { image: buffer, caption }, options);
                        else if (type === 'video') await sock.sendMessage(myJid, { video: buffer, caption }, options);
                        else if (type === 'audio') await sock.sendMessage(myJid, { audio: buffer, mimetype: 'audio/mp4', ptt: true });

                        // Feedback
                        await sock.sendMessage(key.remoteJid, { react: { text: "🔓", key } });
                    } catch (err) {
                        console.error("[Incognito Reaction] Error:", err.message);
                    }
                }
            }
        }
    });

    // --- AI CALL HANDLER (Smart Digital Secretary) ---
    // DISABLED AUDIO: No longer sends automatic voice notes on missed calls
    // Reason: Contacts found 4-second audio clips annoying/intrusive
    // Alternative: Owner gets text notification only
    sock.ev.on('call', async (callEvents) => {
        for (const call of callEvents) {
            // Check for missed, rejected or timeout statuses
            if (call.status === 'timeout' || call.status === 'reject' || (call.status === 'terminate' && !call.isGroup)) {
                const callerId = call.from;
                const callerName = '+' + callerId.split('@')[0];
                console.log(chalk.yellow(`[Call] Missed/Rejected call from ${callerId} (no auto-reply audio)`));

                try {
                    // Notify owner ONLY (no audio sent to caller)
                    const ownerJid = (sock.user?.id || OWNER_PN + "@s.whatsapp.net").split(':')[0] + "@s.whatsapp.net";
                    const callTime = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Porto-Novo' });

                    await sock.sendMessage(ownerJid, {
                        text: `📞 *Appel Manqué (Silencieux)*\n━━━━━━━━━━━━━━\n👤 *De :* @${callerId.split('@')[0]}\n🕐 *Heure :* ${callTime}\n✅ *Status :* Aucun message audio envoyé`,
                        mentions: [callerId]
                    });

                    console.log(`✅ Missed call logged (silent - no audio sent)`);

                } catch (err) {
                    console.error("[Call Handler Error]:", err.message);
                }
            }
        }
    });
}

// --- Anti-Idle (Keep Alive) ---
// Self-ping every 5 minutes to keep the instance alive on Render Free Tier
cron.schedule('*/5 * * * *', async () => {
    try {
        const renderUrl = process.env.RENDER_URL;
        if (renderUrl) {
            const url = renderUrl.endsWith('/') ? renderUrl : `${renderUrl}/`;
            await axios.get(`${url}ping`);
            process.stdout.write(chalk.gray('🔄 Factory Keep-alive successful\n'));
        }
    } catch (error) {
        console.error(chalk.red('❌ Factory Keep-alive failed:'), error.message);
    }
});

loadCommands();

// ============ CAREER-OPS API ROUTES ============
// Initialize RDS connection on startup
(async () => {
    try {
        if (process.env.AWS_RDS_HOST) {
            await rdsClient.connect();
            console.log('[API] RDS Client connected');
        }
    } catch (err) {
        console.error('[API] RDS connection failed:', err.message);
    }
})();

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Add new job to database
app.post('/api/jobs/add', async (req, res) => {
    try {
        const { company, role, score, numericScore, dimensions } = req.body;
        if (!company || !role) {
            return res.status(400).json({ error: 'company and role required' });
        }

        const result = await rdsClient.pool.query(
            `INSERT INTO psychobot.job_scores (company, role, overall_score, numeric_score, dimensions)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [company, role, score || 'B', numericScore || 75, JSON.stringify(dimensions || {})]
        );

        res.json({ success: true, job: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Job search
app.get('/api/jobs/search', async (req, res) => {
    try {
        const { q = '' } = req.query;
        const results = q ? await rdsClient.searchJobs(q) : await rdsClient.getJobs(10);
        res.json({ success: true, count: results.length, jobs: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Track application
app.post('/api/jobs/track', async (req, res) => {
    try {
        const { company, role, status = 'Applied' } = req.body;
        if (!company || !role) {
            return res.status(400).json({ error: 'company and role required' });
        }
        const application = await rdsClient.createApplication(company, role, status);
        res.json({ success: true, application });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get applications
app.get('/api/jobs/track', async (req, res) => {
    try {
        const applications = await rdsClient.getApplications();
        res.json({ success: true, count: applications.length, applications });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save interview story
app.post('/api/prep/stories', async (req, res) => {
    try {
        const { title, situation, task, action, result, reflection, roles = [] } = req.body;
        if (!title || !situation) {
            return res.status(400).json({ error: 'title and situation required' });
        }
        const story = await rdsClient.createStory(title, situation, task, action, result, reflection, roles);
        res.json({ success: true, story });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get stories
app.get('/api/prep/stories', async (req, res) => {
    try {
        const stories = await rdsClient.getStories();
        res.json({ success: true, count: stories.length, stories });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Batch process jobs
app.post('/api/batch/process', async (req, res) => {
    try {
        const { jobs = [] } = req.body;
        if (!jobs.length) {
            return res.status(400).json({ error: 'No jobs provided' });
        }
        // TODO: Implement Career-Ops scoring
        const scored = jobs.map((job, i) => ({
            ...job, id: i + 1, score: ['A', 'B', 'C'][i % 3], numericScore: 70 + i * 5
        }));
        res.json({ success: true, count: scored.length, jobs: scored });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dashboard stats
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const stats = await rdsClient.getDashboardStats();
        res.json({ success: true, stats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== PROSPECT ENDPOINTS =====

// Migrate job_scores table schema
app.post('/api/admin/migrate-job-schema', async (req, res) => {
    try {
        console.log('[MIGRATION] Starting job_scores schema migration...');

        // Columns to add if missing
        const columns = [
            { name: 'source', type: 'VARCHAR(50)' },
            { name: 'job_url', type: 'TEXT' },
            { name: 'posted_date', type: 'TIMESTAMP' },
            { name: 'reviewed_date', type: 'TIMESTAMP' },
            { name: 'status', type: "VARCHAR(50) DEFAULT 'PENDING_REVIEW'" }
        ];

        const added = [];
        const skipped = [];

        for (const col of columns) {
            try {
                // Try to add the column
                await rdsClient.pool.query(
                    `ALTER TABLE psychobot.job_scores ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`
                );
                added.push(col.name);
                console.log(`[MIGRATION] Added column: ${col.name}`);
            } catch (err) {
                if (err.message.includes('already exists')) {
                    skipped.push(col.name);
                } else {
                    console.error(`[MIGRATION] Error adding ${col.name}:`, err.message);
                }
            }
        }

        res.json({
            success: true,
            added: added,
            skipped: skipped,
            message: `Added ${added.length} columns, ${skipped.length} already existed`
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Prospect jobs from web (search + scrape)
app.post('/api/prospect/search', async (req, res) => {
    try {
        const jobProspector = require('./src/services/jobProspector');
        const { keywords = 'software engineer', location = 'Remote', limit = 20 } = req.body;

        const result = await jobProspector.prospectJobs(keywords, location, limit);
        res.json({
            success: true,
            stored: result.stored,
            total: result.total,
            jobs: result.jobs,
            errors: result.errors
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get pending jobs for review
app.get('/api/prospect/pending', async (req, res) => {
    try {
        const jobProspector = require('./src/services/jobProspector');
        const { limit = 20 } = req.query;

        const pending = await jobProspector.getPendingJobs(parseInt(limit));
        res.json({
            success: true,
            count: pending.length,
            jobs: pending
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Score a job after review
app.post('/api/prospect/score', async (req, res) => {
    try {
        const jobProspector = require('./src/services/jobProspector');
        const { jobId, overallScore, numericScore, dimensions = {} } = req.body;

        if (!jobId) {
            return res.status(400).json({ error: 'jobId required' });
        }

        const scored = await jobProspector.scoreJob(jobId, overallScore, numericScore, dimensions);

        if (!scored) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json({ success: true, job: scored });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get high-score jobs ready for application
app.get('/api/prospect/high-scores', async (req, res) => {
    try {
        const jobProspector = require('./src/services/jobProspector');
        const { threshold = 75 } = req.query;

        const highScore = await jobProspector.getHighScoreJobs(parseInt(threshold));
        res.json({
            success: true,
            count: highScore.length,
            threshold: parseInt(threshold),
            jobs: highScore
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve static files from root (profile.png, etc)
app.use(express.static(__dirname));

// Serve frontend
const frontendPath = path.join(__dirname, 'frontend/build');
if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
}

// Fallback to frontend index.html for routes
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Endpoint not found' });
    }
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

server.listen(PORT, () => {
    console.log(chalk.blue(`[Server] Port ${PORT} lié.`));
    startBot().catch(err => {
        console.error(chalk.red('[FATAL] startBot error:'), err);
        notifyOwner(`❌ Bot crashed at startup: ${err.message}`);
    });
});

process.on('uncaughtException', (err) => {
    console.error(chalk.red('[UNCAUGHT EXCEPTION]'), err);
    notifyOwner(`❌ Uncaught Exception: ${err.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('[UNHANDLED REJECTION]'), reason);
    notifyOwner(`❌ Unhandled Rejection: ${String(reason)}`);
});

process.on('SIGTERM', async () => {
    console.log(chalk.red("\n🛑 SIGTERM RECEIVED. Shutting down bot..."));
    isShuttingDown = true;
    cancelAllPendingReplies('SIGTERM');
    closeSocket();
    console.log(chalk.gray("Socket closed."));
    process.exit(0);
});


process.on('uncaughtException', (error) => {
    const msg = error?.message || String(error);
    const ignorableErrors = ['Connection Closed', 'Timed Out', 'conflict', 'Stream Errored', 'Bad MAC', 'No session found', 'No matching sessions', 'EPIPE', 'ECONNRESET', 'PreKeyError'];
    if (ignorableErrors.some(e => msg.includes(e))) return;
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || String(reason);
    const ignorableErrors = ['Connection Closed', 'Timed Out', 'conflict', 'Stream Errored', 'Bad MAC', 'No session found', 'No matching sessions', 'EPIPE', 'ECONNRESET', 'PreKeyError'];
    if (ignorableErrors.some(e => msg.includes(e))) return;
    console.error('Unhandled Rejection at:', reason);
});
