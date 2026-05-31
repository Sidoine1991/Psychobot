/**
 * !addcontact - Ajouter un nouveau contact Google
 *
 * Usage:
 *   !addcontact John Doe john@example.com +33612345678
 *   !addcontact John Doe john@example.com +33612345678 Acme Corp
 */

const googleContacts = require('../src/services/googleContacts');

module.exports = {
    name: 'addcontact',
    description: 'Ajouter un nouveau contact Google',
    category: 'productivity',
    usage: '!addcontact <prénom> <nom> <email> <téléphone> [entreprise]',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;

        try {
            if (args.length < 4) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Usage: !addcontact <prénom> <nom> <email> <téléphone> [entreprise]\n\n' +
                        'Exemples:\n' +
                        '• !addcontact John Doe john@example.com +33612345678\n' +
                        '• !addcontact Marie Martin marie@test.fr +33698765432 Acme Corp'
                }, { quoted: msg });
                return;
            }

            // Send "typing" indicator
            await sock.sendPresenceUpdate('composing', remoteJid);

            // Parse arguments
            const firstName = args[0];
            const lastName = args[1];
            const email = args[2];
            const phone = args[3];
            const company = args.slice(4).join(' ') || null;

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                await sock.sendMessage(remoteJid, {
                    text: `❌ Format d'email invalide: ${email}\n\n` +
                        'Veuillez fournir un email valide.'
                }, { quoted: msg });
                return;
            }

            console.log(`[AddContact Command] Creating contact: ${firstName} ${lastName}`);

            const contact = await googleContacts.createContact({
                firstName,
                lastName,
                email,
                phone,
                company
            });

            let message = '✅ *Contact créé avec succès*\n\n';
            message += `👤 ${contact.displayName}\n`;
            message += `📧 ${contact.email}\n`;
            message += `📱 ${contact.phone}\n`;

            if (contact.company) {
                message += `🏢 ${contact.company}\n`;
            }

            message += `\n🆔 ID: ${contact.resourceName}`;

            await sock.sendMessage(remoteJid, {
                text: message
            }, { quoted: msg });

            console.log(`[AddContact Command] ✅ Contact created: ${contact.resourceName}`);

        } catch (error) {
            console.error('[AddContact Command] Error:', error.message);

            const errorMessage = '❌ Erreur lors de la création du contact.\n\n' +
                `Détails: ${error.message}`;

            await sock.sendMessage(remoteJid, {
                text: errorMessage
            }, { quoted: msg });
        }
    }
};
