const axios = require('axios');

module.exports = {
    name: 'meteo',
    description: 'Meteo actuelle d\'une ville. Usage: !meteo Cotonou',
    run: async ({ sock, msg, args, replyWithTag }) => {
        const city = args.join(" ");
        if (!city) return replyWithTag(sock, msg.key.remoteJid, msg, "❌ Usage: !meteo <ville>\nEx: !meteo Cotonou");

        try {
            const resp = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { timeout: 10000 });
            const data = resp.data;
            const current = data.current_condition[0];
            const area = data.nearest_area[0];

            const cityName = area.areaName[0].value;
            const country = area.country[0].value;
            const temp = current.temp_C;
            const feels = current.FeelsLikeC;
            const humidity = current.humidity;
            const wind = current.windspeedKmph;
            const desc = current.weatherDesc[0].value;

            const text = `🌤️ *Meteo ${cityName}, ${country}*\n━━━━━━━━━━━━━━\n` +
                `🌡️ Temperature: *${temp}°C* (ressenti ${feels}°C)\n` +
                `💧 Humidite: ${humidity}%\n` +
                `💨 Vent: ${wind} km/h\n` +
                `☁️ Conditions: ${desc}\n` +
                `━━━━━━━━━━━━━━\n` +
                `_Source: wttr.in_`;

            await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
        } catch (err) {
            console.error('[Meteo]', err.message);
            await replyWithTag(sock, msg.key.remoteJid, msg, "❌ Ville introuvable ou service indisponible.");
        }
    }
};
