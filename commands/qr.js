const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = {
    name: 'qr',
    description: 'Genere un QR code depuis un texte ou lien. Usage: !qr https://example.com',
    run: async ({ sock, msg, args, replyWithTag }) => {
        const content = args.join(" ");
        if (!content) return replyWithTag(sock, msg.key.remoteJid, msg, "❌ Usage: !qr <texte ou lien>\nEx: !qr https://github.com/Sidoineko");

        try {
            const tmpFile = path.join(os.tmpdir(), `qr_${Date.now()}.png`);
            await QRCode.toFile(tmpFile, content, { width: 400, margin: 2 });

            await sock.sendMessage(msg.key.remoteJid, {
                image: { url: tmpFile },
                caption: `📱 *QR Code*\n${content.substring(0, 100)}`
            }, { quoted: msg });

            fs.unlinkSync(tmpFile);
        } catch (err) {
            console.error('[QR]', err.message);
            await replyWithTag(sock, msg.key.remoteJid, msg, "❌ Erreur generation QR code.");
        }
    }
};
