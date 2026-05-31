// Psychobot - Core V2 (Clean Slate Refactor + WS Support)
const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers, makeCacheableSignalKeyStore, delay } = require('@whiskeysockets/baileys');
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
const cron = require('node-cron');
const googleTTS = require('google-tts-api');
require('dotenv').config();
const { convertToOpus } = require('./src/lib/audioHelper');

// New conversation state management
const { setOwnerActive, isConversationActive, updateUserMessageType, shouldAutoReplyBasedOnActivity } = require('./src/db/conversationState');
const { detectMessageType } = require('./src/handlers/messageClassifier');
const { getAutoReplyTemplate, formatReplyForWhatsApp } = require('./src/handlers/autoReplyTemplates');

// Natural Language Command Router
const intentAnalyzer = require('./src/services/intentAnalyzer');
const contextManager = require('./src/services/contextManager');
const commandExecutor = require('./src/services/commandExecutor');

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY || "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";
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
const PREFIX = "!";
const BOT_NAME = "PSYCHO BOT";
const OWNER_PN = process.env.OWNER_NUMBER || "237696814391";
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
        if (sock?.user) {
            await sock.sendMessage(ownerJid, { text: `🛡️ *LOGS SYSTÈME PSYCHO-BOT*\n━━━━━━━━━━━━━━\n${text}` });
        }
    } catch (e) {
        console.error("Owner Notification Failed:", e.message);
    }
}

async function syncSessionToRender() {
    const apiKey = process.env.RENDER_API_KEY;
    const serviceId = process.env.RENDER_SERVICE_ID;
    if (!apiKey || !serviceId) return;

    try {
        const credsPath = path.join(AUTH_FOLDER, 'creds.json');
        if (!fs.existsSync(credsPath)) return;

        const creds = fs.readFileSync(credsPath, 'utf-8');
        const sessionBase64 = Buffer.from(creds).toString('base64');

        if (process.env.SESSION_DATA === sessionBase64) return;

        console.log(chalk.blue("📤 [Render API] Sauvegarde automatique de la session..."));
        await axios.patch(`https://api.render.com/v1/services/${serviceId}/env-vars`,
            [{ key: "SESSION_DATA", value: sessionBase64 }],
            { headers: { Authorization: `Bearer ${apiKey}`, "Accept": "application/json", "Content-Type": "application/json" } }
        );
        console.log(chalk.green("✅ [Render API] Session sauvegardée ! Le bot va redémarrer pour appliquer la persistance."));
    } catch (error) {
        console.error(chalk.red("❌ [Render API] Échec de la sauvegarde:"), error.response?.data || error.message);
    }
}

let reconnectAttempts = 0;
let isStarting = false;
let latestQR = null;
let lastConnectedAt = 0;
let sock = null;

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

// Pairing code endpoint — For now, redirect to QR method (more stable)
app.get('/code', (req, res) => {
    console.log(chalk.yellow('[Pair] Phone pairing requested - use /qr instead'));
    return res.status(400).json({
        error: 'Phone number pairing not yet implemented',
        solution: 'Please use QR code method',
        redirect: '/qr'
    });
});

// Force new QR code endpoint — disconnect and regenerate QR
app.get('/new-qr', (req, res) => {
    try {
        console.log(chalk.red('[NewQR] Forcing new QR code...'));

        // End socket connection
        if (sock) {
            sock.end();
        }

        // Clear session folder
        try {
            fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
            console.log(chalk.green('[NewQR] Session cleared'));
        } catch (e) {
            console.error('[NewQR] Failed to clear session:', e.message);
        }

        res.json({
            success: true,
            message: 'Session cleared. New QR will be generated in 3 seconds.',
            check_qr_at: '/qr'
        });

        // Restart bot after 3s without stabilisation delay
        setTimeout(() => {
            console.log(chalk.yellow('[NewQR] Restarting bot for new QR...'));
            isStarting = false;
            reconnectAttempts = 1; // Skip stabilisation delay
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

// ============================================================================

// Logout endpoint — disconnect and force new QR
app.get('/logout', (req, res) => {
    try {
        console.log(chalk.red('[Logout] Disconnecting bot...'));

        // End socket connection
        if (sock) {
            sock.end();
        }

        // Clear session folder
        try {
            fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
            console.log(chalk.green('[Logout] Session cleared'));
        } catch (e) {
            console.error('[Logout] Failed to clear session:', e.message);
        }

        // Set flag to skip SESSION_DATA on next boot
        fs.writeFileSync(path.join(__dirname, '.skip-session-data'), 'true');

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
        const { phone, message, file_url, file_name, mime_type } = req.body;

        // Validation
        if (!phone || !file_url) {
            return res.status(400).json({
                success: false,
                error: 'Missing phone or file_url in request body'
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

        // Télécharger le fichier depuis l'URL
        const axios = require('axios');
        const response = await axios.get(file_url, { responseType: 'arraybuffer' });
        const fileBuffer = Buffer.from(response.data);

        // Déterminer le type MIME
        const finalMimeType = mime_type || response.headers['content-type'] || 'application/octet-stream';
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
    // Send current status immediately
    if (latestQR) {
        QRCode.toDataURL(latestQR).then(url => {
            ws.send(JSON.stringify({ type: 'qr', qr: url }));
        });
    } else if (sock?.user) {
        ws.send(JSON.stringify({ type: 'connected', user: sock.user.id.split(':')[0] }));
    } else {
        ws.send(JSON.stringify({ type: 'status', message: 'Initializing...' }));
    }
});

// --- Baileys Core ---
async function startBot() {
    if (isStarting) return;
    isStarting = true;

    console.log(chalk.cyan('=== STARTBOT CALLED [v2] ==='));

    // Check if we should skip SESSION_DATA (flag set after 401 error)
    const skipSessionDataFlag = path.join(__dirname, '.skip-session-data');
    let skipSessionData = false;
    if (fs.existsSync(skipSessionDataFlag)) {
        skipSessionData = true;
        console.log(chalk.yellow('⚠️ SKIP_SESSION_DATA flag detected. Forcing fresh QR.'));
        fs.unlinkSync(skipSessionDataFlag);
    }

    // If flag was set, also clear AUTH_FOLDER to be safe
    if (skipSessionData && fs.existsSync(AUTH_FOLDER)) {
        try {
            fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
        } catch (e) {
            console.error('Failed to clear AUTH_FOLDER:', e.message);
        }
    }

    header();
    broadcast({ type: 'status', message: 'Starting Bot...' });

    // RENDER SETTLING DELAY (Crucial to avoid session conflicts during deployment handover)
    const isRender = process.env.RENDER || process.env.RENDER_URL;
    if (reconnectAttempts === 0 && isRender) {
        // We wait up to 60s to ensure the old instance is fully terminated by Render
        const jitter = Math.floor(Math.random() * 20000) + 30000; // 30-50s jitter
        console.log(chalk.yellow(`⏳ RENDER STABILISATION: Waiting ${Math.floor(jitter / 1000)}s to avoid conflicts...`));
        await sleep(jitter);
    }

    console.log(chalk.cyan("🚀 Connexion au socket WhatsApp..."));
    broadcast({ type: 'status', message: 'Connecting to WhatsApp...' });

    // Ensure session folder exists
    if (!fs.existsSync(AUTH_FOLDER)) fs.mkdirSync(AUTH_FOLDER, { recursive: true });

    // --- SESSION_DATA Support (for Permanent Render Connection) ---
    const credsPath = path.join(AUTH_FOLDER, 'creds.json');

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

    // Priorité 1 : SESSION_DATA env var (configuré manuellement sur Render)
    // BUT: Skip if SKIP_SESSION_DATA is set (happens after 401 error to force fresh QR)
    if (process.env.SESSION_DATA && !fs.existsSync(credsPath) && !process.env.SKIP_SESSION_DATA) {
        console.log(chalk.blue("🔹 SESSION_DATA détectée. Restauration de la session..."));
        try {
            const sessionBuffer = Buffer.from(process.env.SESSION_DATA, 'base64').toString('utf-8');
            JSON.parse(sessionBuffer);
            fs.writeFileSync(credsPath, sessionBuffer);
            console.log(chalk.green("✅ Session restaurée depuis SESSION_DATA."));
        } catch (e) {
            console.error(chalk.red("❌ SESSION_DATA invalide:"), e.message);
        }
    }

    // Priorité 2 : backup local session_backup.txt (si creds.json absent)
    if (!fs.existsSync(credsPath) && fs.existsSync(backupPath)) {
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
            fetchLatestBaileysVersion(),
            timeoutPromise
        ]);
        version = fetchResult.version;
    } catch (e) {
        console.log(chalk.yellow("⚠️ Timeout version, utilisation du fallback."));
        version = [2, 3000, 1015901307];
    }

    console.log(chalk.gray(`📦 Version Baileys: ${version}`));

    console.log(chalk.cyan('[LOG] Creating WASocket...'));
    sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        browser: Browsers.macOS('Desktop'),
        printQRInTerminal: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        retryRequestDelayMs: 2000,
        maxMsgRetryCount: 5,
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
        shouldIgnoreJid: (jid) => jid?.includes('@newsletter') || jid === 'status@broadcast'
    });
    console.log(chalk.cyan('[LOG] WASocket created'));

    sock.ev.on("creds.update", async () => {
        await saveCreds();
        // Sauvegarder session dans backup local (résiste aux redémarrages Render)
        try {
            const credsPath = path.join(AUTH_FOLDER, 'creds.json');
            if (fs.existsSync(credsPath)) {
                const sessionB64 = Buffer.from(fs.readFileSync(credsPath, 'utf-8')).toString('base64');
                // Backup fichier local
                fs.writeFileSync(path.join(__dirname, 'session_backup.txt'), sessionB64);
                // Sync Render si API key disponible
                if (sock?.user) await syncSessionToRender();
            }
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
            console.log(chalk.yellow(`[QR] New code generated.`));
            try {
                const url = await QRCode.toDataURL(qr);
                broadcast({ type: 'qr', qr: url });
                broadcast({ type: 'status', message: 'Please scan the new QR Code' });
            } catch (e) {
                console.error('QR Encode Error', e);
            }
        }

        if (connection === "close") {
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

            if (reason === DisconnectReason.loggedOut || reason === 401) {
                console.log(chalk.red("🛑 Logged Out (401 Unauthorized). Clearing session."));
                try {
                    fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
                    // Write a flag file to skip SESSION_DATA reload on next startup
                    fs.writeFileSync(path.join(__dirname, '.skip-session-data'), 'true');
                    console.log(chalk.green("✅ Session cleared. Skipping SESSION_DATA on next boot."));
                } catch (e) {
                    console.error(chalk.red("❌ Failed to clear session:"), e.message);
                }
                // Don't exit, let reconnect handler try again
                isStarting = false;
                // DON'T reset reconnectAttempts - this prevents re-triggering RENDER_STABILISATION
                reconnectAttempts++; // Mark as attempted retry
                setTimeout(() => startBot(), 5000);
            } else if (reason === DisconnectReason.connectionReplaced || reason === 440 || reason === 405) {
                console.log(chalk.red("⚠️ Session Conflict. Restarting..."));
                sock.end();
                process.exit(1);
            } else {
                reconnectAttempts++;
                lastConnectedAt = 0;
                const delay = Math.min(3000 * reconnectAttempts, 30000);
                console.log(chalk.yellow(`🔄 Reconnecting (Attempt ${reconnectAttempts}) in ${delay}ms...`));
                setTimeout(() => startBot(), delay);
            }
        } else if (connection === "open") {
            latestQR = null;
            reconnectAttempts = 0;
            criticalErrorCount = 0; // Reset error counter on success
            isStarting = false;
            lastConnectedAt = Date.now();
            console.log(chalk.green.bold("\n✅ PSYCHOBOT ONLINE AND CONNECTED !"));

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
            await sock.sendMessage(sock.user.id, { text: msgText });

            // Critical: Force an immediate sync on first successful connection to ensure SESSION_DATA is populated on Render
            await syncSessionToRender();
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
        }

        // Text extraction
        const text = msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.videoMessage?.caption || "";

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

            // Handle specific message types - AUDIO PROCESSING
            if (messageType === 'voice_note' || messageType === 'audio_document' || messageType === 'audio') {
                try {
                    console.log(`[AudioHandler] Processing voice note from ${remoteJid}...`);

                    // Show "composing" status
                    await sock.sendPresenceUpdate('composing', remoteJid);

                    // Extract audio message
                    const audioMessage = msg.message.audioMessage || msg.message.viewOnceMessage?.message?.audioMessage;
                    if (!audioMessage) {
                        console.warn('[AudioHandler] No audioMessage found in msg');
                        const fallback = getAutoReplyTemplate('audio_ack', messageType, '');
                        const reply = formatReplyForWhatsApp(fallback, true);
                        await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
                        return;
                    }

                    // Process audio: transcribe → AI → text-to-speech
                    const audioProcessor = require('./src/services/audioProcessor');
                    const callerName = msg.pushName && msg.pushName.trim().length > 0
                        ? msg.pushName.trim()
                        : '+' + msgSenderClean;

                    const { audioPath, transcript, response } = await audioProcessor.processAudioMessage(
                        audioMessage,
                        downloadContentFromMessage,
                        remoteJid,
                        callerName,
                        null // getAIResponseFunc handled inside
                    );

                    console.log(`[AudioHandler] ✓ Got audio response: ${audioPath}`);
                    console.log(`[AudioHandler] Transcript: "${transcript}"`);
                    console.log(`[AudioHandler] Response: "${response}"`);

                    // Send audio response
                    await sock.sendMessage(
                        remoteJid,
                        {
                            audio: fs.readFileSync(audioPath),
                            mimetype: 'audio/ogg; codecs=opus',
                            ptt: true,
                            quoted: msg
                        }
                    );

                    // Also send text transcription + response as optional follow-up for clarity
                    const textSummary = `🎙️ *Transcript*:\n_"${transcript}"_\n\n🤖 *Response*:\n${response}`;
                    await sock.sendMessage(remoteJid, { text: textSummary }, { quoted: msg });

                    // Cleanup temp files
                    audioProcessor.cleanup([audioPath]);

                    // Mark as read
                    if (readReceiptsEnabled) await sock.readMessages([msg.key]);

                    console.log(`[AudioHandler] ✓ Audio response sent successfully`);
                    return;

                } catch (err) {
                    console.error('[AudioHandler] Error:', err.message);
                    // Send error message
                    const errorReply = `❌ Erreur lors du traitement de l'audio:\n${err.message.substring(0, 100)}`;
                    await sock.sendMessage(remoteJid, { text: errorReply }, { quoted: msg });
                }
            }

            if (messageType === 'image' || messageType === 'video') {
                try {
                    const template = getAutoReplyTemplate('image_ack', messageType, '');
                    const reply = formatReplyForWhatsApp(template, true);
                    if (reply) {
                        await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
                        if (readReceiptsEnabled) await sock.readMessages([msg.key]);
                    }
                    console.log(`[AutoReply] Media ack sent`);
                    return;
                } catch (err) {
                    console.error('[AutoReply Media] Error:', err.message);
                }
            }

            // Skip auto-reply if conversation not active AND decision is 'skip'
            if (autoReplyDecision === 'skip') {
                console.log(`[AutoReply] QUEUED: Owner absent < 60min, multiple messages pending`);
                return;
            }

            // Send text-based auto-reply
            console.log(`[AI] Processing private msg from ${msgSenderClean}: ${text.substring(0, 50)}`);
            try {
                await sock.sendPresenceUpdate('composing', remoteJid);

                // Utiliser le module ai.js pour la cohérence (nom + historique par JID)
                const aiModule = require('./src/services/ai');
                const callerName = msg.pushName && msg.pushName.trim().length > 0
                    ? msg.pushName.trim()
                    : '+' + msgSenderClean;
                const history = aiModule.getConversationHistory(remoteJid);
                const reply = await aiModule.getAIResponse(text, callerName, history, remoteJid);
                const formattedReply = `🤖 *Assistant de Sidoine*\n\n${reply}`;
                await sock.sendMessage(remoteJid, { text: formattedReply }, { quoted: msg });

                if (readReceiptsEnabled) {
                    await sock.readMessages([msg.key]);
                }
            } catch (err) {
                console.error("[AI] Error:", err.message);

                // Use template-based fallback
                const template = getAutoReplyTemplate(autoReplyDecision, messageType, text);
                const reply = formatReplyForWhatsApp(template, true);
                if (reply) {
                    await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
                    if (readReceiptsEnabled) await sock.readMessages([msg.key]);
                }
            }
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
    sock.ev.on('call', async (callEvents) => {
        for (const call of callEvents) {
            // Check for missed, rejected or timeout statuses
            if (call.status === 'timeout' || call.status === 'reject' || (call.status === 'terminate' && !call.isGroup)) {
                const callerId = call.from;
                const callerName = '+' + callerId.split('@')[0];
                console.log(chalk.yellow(`[Call] Missed/Rejected call from ${callerId}`));

                try {
                    // 1. Générer une excuse professionnelle via NVIDIA NIM
                    let aiText = "Désolé, je ne peux pas répondre pour le moment. Je vous rappelle dès que possible.";
                    try {
                        aiText = await getAIResponse(
                            `Génère UNE SEULE phrase très courte (max 15 mots) et professionnelle pour informer l'appelant que Sidoine est occupé et ne peut pas répondre à l'appel. Sois direct et poli.`,
                            "Tu es l'assistant vocal de Sidoine. Réponds uniquement avec la phrase demandée, sans guillemets ni explication."
                        );
                        // Nettoyer les guillemets éventuels
                        aiText = aiText.replace(/^["«»]|["«»]$/g, '').trim();
                    } catch (aiErr) {
                        console.error('[Call AI Error]:', aiErr.message);
                    }

                    // 2. Convert to Voice Note (Google TTS)
                    const audioUrl = googleTTS.getAudioUrl(aiText, {
                        lang: 'fr',
                        slow: false,
                        host: 'https://translate.google.com',
                    });

                    // 3. Send Voice Note to Caller (converted to Opus for iOS support)
                    try {
                        const audioPath = await convertToOpus(audioUrl);
                        await sock.sendMessage(callerId, {
                            audio: { url: audioPath },
                            mimetype: 'audio/ogg; codecs=opus',
                            ptt: true
                        });
                        fs.unlinkSync(audioPath);
                    } catch (e) {
                        console.error('[Call Voice Error]', e.message);
                    }

                    // 4. Notifier le propriétaire avec heure locale
                    const ownerJid = (sock.user?.id || OWNER_PN + "@s.whatsapp.net").split(':')[0] + "@s.whatsapp.net";
                    const callTime = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Porto-Novo' });
                    await sock.sendMessage(ownerJid, {
                        text: `📞 *Appel Manqué (Auto-Reply)*\n━━━━━━━━━━━━━━\n👤 *De :* @${callerId.split('@')[0]}\n🕐 *Heure :* ${callTime}\n📝 *Message envoyé :* "${aiText.trim()}"`,
                        mentions: [callerId]
                    });

                    console.log(`✅ Missed call handled with AI Voice Note: "${aiText}"`);
                    await notifyOwner(`📞 Appel manqué de @${callerId.split('@')[0]} géré par l'IA.`);

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
    if (sock) {
        sock.end();
        console.log(chalk.gray("Socket closed."));
    }
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
