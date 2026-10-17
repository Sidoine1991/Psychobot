let cached = null;
let pending = null;

async function initBaileys() {
    if (cached) return cached;
    if (!pending) {
        pending = import('@whiskeysockets/baileys').then((mod) => {
            cached = mod;
            pending = null;
            return mod;
        });
    }
    return pending;
}

function getBaileys() {
    if (!cached) {
        throw new Error('Baileys not initialized — call await initBaileys() first');
    }
    return cached;
}

function makeWASocket(config) {
    const mod = getBaileys();
    const fn = mod.default || mod.makeWASocket;
    return fn(config);
}

module.exports = { initBaileys, getBaileys, makeWASocket };
