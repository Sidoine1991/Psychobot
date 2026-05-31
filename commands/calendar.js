/**
 * !calendar - Afficher l'agenda Google Calendar du jour ou d'une date
 *
 * Usage:
 *   !calendar                  - Agenda d'aujourd'hui
 *   !calendar demain          - Agenda de demain
 *   !calendar 01/06           - Agenda du 01/06
 */

const googleCalendar = require('../src/services/googleCalendar');

module.exports = {
    name: 'calendar',
    description: 'Afficher agenda Google Calendar',
    category: 'productivity',
    usage: '!calendar [demain|DD/MM]',

    async execute(sock, msg, args) {
        const remoteJid = msg.key.remoteJid;

        try {
            // Send "typing" indicator
            await sock.sendPresenceUpdate('composing', remoteJid);

            let targetDate = new Date();
            let dateLabel = "aujourd'hui";

            // Parse arguments
            if (args.length > 0) {
                const arg = args[0].toLowerCase();

                if (arg === 'demain' || arg === 'tomorrow') {
                    targetDate.setDate(targetDate.getDate() + 1);
                    dateLabel = 'demain';
                } else {
                    // Try to parse DD/MM format
                    const dateMatch = arg.match(/(\d{1,2})\/(\d{1,2})/);
                    if (dateMatch) {
                        const day = parseInt(dateMatch[1]);
                        const month = parseInt(dateMatch[2]) - 1;
                        targetDate = new Date(targetDate.getFullYear(), month, day);
                        dateLabel = targetDate.toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long'
                        });
                    }
                }
            }

            // Fetch events
            console.log(`[Calendar Command] Fetching events for ${dateLabel}`);
            const events = await googleCalendar.getEventsForDate(targetDate);

            // Format and send response
            const message = googleCalendar.formatEventsForWhatsApp(events, targetDate);

            await sock.sendMessage(remoteJid, {
                text: message
            }, { quoted: msg });

            console.log(`[Calendar Command] ✅ Sent ${events.length} events for ${dateLabel}`);

        } catch (error) {
            console.error('[Calendar Command] Error:', error.message);

            const errorMessage = '❌ Erreur lors de la récupération de l\'agenda.\n\n' +
                'Vérifiez la configuration Google Calendar:\n' +
                '• GOOGLE_CLIENT_EMAIL\n' +
                '• GOOGLE_PRIVATE_KEY\n' +
                '• GOOGLE_CALENDAR_ID\n\n' +
                `Détails: ${error.message}`;

            await sock.sendMessage(remoteJid, {
                text: errorMessage
            }, { quoted: msg });
        }
    }
};
