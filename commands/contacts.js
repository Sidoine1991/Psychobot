/**
 * !contacts - Rechercher ou lister contacts Google
 *
 * Usage:
 *   !contacts - Lister tous les contacts
 *   !contacts John - Rechercher "John"
 *   !contacts example@gmail.com - Rechercher par email
 */

const googleContacts = require('../src/services/googleContacts');

module.exports = {
    name: 'contacts',
    description: 'Rechercher ou lister contacts Google',
    category: 'productivity',
    usage: '!contacts [recherche]',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;

        try {
            // Send "typing" indicator
            await sock.sendPresenceUpdate('composing', remoteJid);

            let contacts;
            let headerText;

            if (args.length > 0) {
                // Search mode
                const query = args.join(' ');
                console.log(`[Contacts Command] Searching for: ${query}`);

                contacts = await googleContacts.searchContacts(query, 10);
                headerText = `🔍 Résultats pour "${query}"`;

            } else {
                // List all mode
                console.log('[Contacts Command] Listing all contacts');

                contacts = await googleContacts.listContacts(20);
                headerText = '📇 Vos contacts';
            }

            if (contacts.length === 0) {
                await sock.sendMessage(remoteJid, {
                    text: `${headerText}\n\n❌ Aucun contact trouvé.`
                }, { quoted: msg });
                return;
            }

            // Format contacts list
            let message = `${headerText}\n━━━━━━━━━━━━━━━━━━━━\n\n`;

            contacts.forEach((contact, index) => {
                message += `${index + 1}. *${contact.displayName}*\n`;

                if (contact.email) {
                    message += `   📧 ${contact.email}\n`;
                }

                if (contact.phone) {
                    message += `   📱 ${contact.phone}\n`;
                }

                if (contact.company) {
                    message += `   🏢 ${contact.company}`;
                    if (contact.jobTitle) {
                        message += ` - ${contact.jobTitle}`;
                    }
                    message += '\n';
                }

                message += '\n';
            });

            message += `━━━━━━━━━━━━━━━━━━━━\n`;
            message += `📊 Total: ${contacts.length} contact${contacts.length > 1 ? 's' : ''}`;

            await sock.sendMessage(remoteJid, {
                text: message
            }, { quoted: msg });

            console.log(`[Contacts Command] ✅ Returned ${contacts.length} contacts`);

        } catch (error) {
            console.error('[Contacts Command] Error:', error.message);

            const errorMessage = '❌ Erreur lors de la recherche des contacts.\n\n' +
                `Détails: ${error.message}\n\n` +
                'Vérifiez que:\n' +
                '• People API est activée sur Google Cloud\n' +
                '• Le Service Account a accès aux contacts\n' +
                '• Les scopes contacts sont configurés';

            await sock.sendMessage(remoteJid, {
                text: errorMessage
            }, { quoted: msg });
        }
    }
};
