/**
 * !planifier - Créer un événement Google Calendar
 *
 * Usage:
 *   !planifier aujourd'hui 16h Site web restaurant
 *   !planifier demain 10h Appel client
 *   !planifier 01/06 14h30 Réunion équipe
 */

const googleCalendar = require('../src/services/googleCalendar');

module.exports = {
    name: 'planifier',
    description: 'Créer événement Google Calendar',
    category: 'productivity',
    usage: '!planifier <date> <heure> <titre>',

    async run({ sock, msg, args }) {
        const remoteJid = msg.key.remoteJid;

        try {
            if (args.length < 2) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Usage: !planifier <date> <heure> <titre>\n\n' +
                        'Exemples:\n' +
                        '• !planifier aujourd\'hui 16h Site web restaurant\n' +
                        '• !planifier demain 10h Appel client\n' +
                        '• !planifier 01/06 14h30 Réunion équipe'
                }, { quoted: msg });
                return;
            }

            // Send "typing" indicator
            await sock.sendPresenceUpdate('composing', remoteJid);

            // Join all args to parse date/time
            const fullText = args.join(' ');

            // Parse date/time
            const startDateTime = googleCalendar.parseDateTime(fullText);

            if (!startDateTime) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Format de date/heure non reconnu.\n\n' +
                        'Formats acceptés:\n' +
                        '• aujourd\'hui 16h\n' +
                        '• demain 10h30\n' +
                        '• 01/06 14h'
                }, { quoted: msg });
                return;
            }

            // Extract subject
            const summary = googleCalendar.extractMeetingSubject(fullText);

            // Create event
            console.log(`[Planifier Command] Creating event: ${summary} at ${startDateTime.toISOString()}`);

            const event = await googleCalendar.createEvent({
                summary,
                description: `Créé via WhatsApp par ${msg.pushName || 'KolaBoT'}`,
                startDateTime: startDateTime.toISOString(),
                location: '',
                attendees: []
            });

            // Format confirmation message
            const dateStr = event.startTime.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

            const timeStr = event.startTime.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
            });

            const confirmMessage = `✅ *Événement créé avec succès*\n\n` +
                `📅 ${dateStr}\n` +
                `⏰ ${timeStr}\n` +
                `📝 ${event.summary}\n\n` +
                `🔔 Rappels configurés:\n` +
                `• 1 heure avant\n` +
                `• 15 minutes avant\n\n` +
                `🔗 [Voir dans Calendar](${event.htmlLink})`;

            await sock.sendMessage(remoteJid, {
                text: confirmMessage
            }, { quoted: msg });

            console.log(`[Planifier Command] ✅ Event created: ${event.id}`);

        } catch (error) {
            console.error('[Planifier Command] Error:', error.message);

            const errorMessage = '❌ Erreur lors de la création de l\'événement.\n\n' +
                `Détails: ${error.message}`;

            await sock.sendMessage(remoteJid, {
                text: errorMessage
            }, { quoted: msg });
        }
    }
};
