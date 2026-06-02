// database.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./bot.db');
const log = require('./logger')(module); // Utilise le logger pour la cohérence

db.serialize(() => {
    log("Connexion à SQLite réussie.");
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT,
            firstSeen TEXT,
            commandCount INTEGER DEFAULT 0
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS agenda (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_jid TEXT NOT NULL,
            from_name TEXT,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL,
            read INTEGER DEFAULT 0
        )
    `);
});

function getOrRegisterUser(userId, name) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE id = ?", [userId], (err, row) => {
            if (err) return reject(err);
            if (row) {
                resolve(row);
            } else {
                const firstSeen = new Date().toISOString();
                db.run("INSERT INTO users (id, name, firstSeen) VALUES (?, ?, ?)", [userId, name, firstSeen], (err) => {
                    if (err) return reject(err);
                    log(`Nouvel utilisateur enregistré : ${name} (${userId})`);
                    resolve({ id: userId, name, firstSeen, commandCount: 0 });
                });
            }
        });
    });
}

function incrementCommandCount(userId) {
    return new Promise((resolve, reject) => {
        db.run("UPDATE users SET commandCount = commandCount + 1 WHERE id = ?", [userId], (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

// --- LES FONCTIONS MANQUANTES SONT ICI ---

function getTotalUsers() {
    return new Promise((resolve, reject) => {
        db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
            if (err) return reject(err);
            resolve(row.count || 0);
        });
    });
}

function getTotalCommands() {
    return new Promise((resolve, reject) => {
        db.get("SELECT COALESCE(SUM(commandCount), 0) as total FROM users", (err, row) => {
            if (err) return reject(err);
            resolve(row.total || 0);
        });
    });
}


// --- AGENDA ---

function saveAgendaMessage(fromJid, fromName, message) {
    return new Promise((resolve, reject) => {
        const createdAt = new Date().toISOString();
        db.run(
            "INSERT INTO agenda (from_jid, from_name, message, created_at) VALUES (?, ?, ?, ?)",
            [fromJid, fromName || fromJid.split('@')[0], message, createdAt],
            function (err) {
                if (err) return reject(err);
                resolve(this.lastID);
            }
        );
    });
}

function getUnreadAgendaMessages() {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM agenda WHERE read = 0 ORDER BY created_at ASC", (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

function markAgendaRead(id) {
    return new Promise((resolve, reject) => {
        db.run("UPDATE agenda SET read = 1 WHERE id = ?", [id], (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function markAllAgendaRead() {
    return new Promise((resolve, reject) => {
        db.run("UPDATE agenda SET read = 1 WHERE read = 0", (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

// --- ON S'ASSURE QU'ELLES SONT BIEN EXPORTÉES ---
module.exports = {
    getOrRegisterUser,
    incrementCommandCount,
    getTotalUsers,
    getTotalCommands,
    saveAgendaMessage,
    getUnreadAgendaMessages,
    markAgendaRead,
    markAllAgendaRead,
};