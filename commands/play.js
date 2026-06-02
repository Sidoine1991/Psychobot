const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const ytSearch = require('yt-search');
const ffmpegPath = require('ffmpeg-static');
const os = require('os');
const axios = require('axios');

module.exports = {
    name: 'play',
    description: "Recherche et envoie une musique YouTube.",
    run: async ({ sock, msg, args, replyWithTag }) => {
        const query = args.join(" ");
        const from = msg.key.remoteJid;

        if (!query) return replyWithTag(sock, from, msg, "❌ Entrez le nom d'une musique. Ex: !play Fally Ipupa Lost");

        const tempDir = os.tmpdir();

        try {
            const searchResult = await ytSearch(query);
            // Filtrer: exclure les videos "Topic" (souvent geo-restreintes) et trop courtes
            const candidates = searchResult.videos.filter(v => {
                const authorLower = (v.author?.name || '').toLowerCase();
                const isTopicChannel = authorLower.includes('- topic') || authorLower.endsWith('topic');
                const tooShort = v.seconds < 30;
                return !isTopicChannel && !tooShort;
            });
            const video = candidates.length > 0 ? candidates[0] : (searchResult.videos[0] || null);
            if (!video) return replyWithTag(sock, from, msg, "❌ Aucun resultat trouve.");

            const { title, timestamp, url, videoId } = video;

            await sock.sendPresenceUpdate('composing', from);

            // Try download via yt-dlp
            let audioBuffer = null;
            try {
                audioBuffer = await downloadViaYtDlp(url, tempDir);
            } catch (e) {
                console.log('[Play] yt-dlp failed:', e.message);
            }

            if (audioBuffer) {
                await sock.sendMessage(from, {
                    audio: audioBuffer,
                    mimetype: 'audio/mp4',
                    fileName: title + '.m4a',
                    ptt: false
                }, { quoted: msg });
            } else {
                // Fallback: send link with thumbnail
                const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                let imgBuffer = null;
                try {
                    const imgResp = await axios.get(thumb, { responseType: 'arraybuffer', timeout: 10000 });
                    imgBuffer = Buffer.from(imgResp.data);
                } catch (e) {}

                const text = `🎵 *${title}*\n⏱️ Duree: ${timestamp}\n\n▶️ ${url}\n\n_Telechargement direct indisponible (YouTube bloque les serveurs cloud). Cliquez le lien pour ecouter._`;

                if (imgBuffer) {
                    await sock.sendMessage(from, { image: imgBuffer, caption: text }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text }, { quoted: msg });
                }
            }

        } catch (err) {
            console.error('[Play Error]:', err.message);
            await replyWithTag(sock, from, msg, `❌ Erreur: ${err.message}`);
        }
    }
};

async function downloadViaYtDlp(videoUrl, tempDir) {
    const binDir = path.join(tempDir, 'bin');
    if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });

    const ytDlpPath = path.join(binDir, 'yt-dlp');
    if (!fs.existsSync(ytDlpPath)) {
        const dlResp = await axios({
            url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp",
            method: 'GET',
            responseType: 'stream'
        });
        const writer = fs.createWriteStream(ytDlpPath);
        dlResp.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        await execAsync(`chmod +x "${ytDlpPath}"`);
    }

    const fileName = `audio_${Date.now()}`;
    const outputTemplate = path.join(tempDir, fileName) + ".%(ext)s";

    const cookiesPath = path.join(__dirname, '../cookies.txt');
    const cookieArg = fs.existsSync(cookiesPath) ? `--cookies "${cookiesPath}"` : "";

    const clients = ['ios', 'android', 'tv_embedded', 'mweb'];
    for (const client of clients) {
        try {
            const cmd = `"${ytDlpPath}" -f "bestaudio[ext=m4a]/bestaudio/best" -x --audio-format m4a --ffmpeg-location "${ffmpegPath}" --extractor-args "youtube:player_client=${client}" ${cookieArg} -o "${outputTemplate}" "${videoUrl}" --no-playlist --no-warnings --no-check-certificate --socket-timeout 30`;
            await execAsync(cmd, { timeout: 60000 });

            const files = fs.readdirSync(tempDir).filter(f => f.startsWith(fileName) && (f.endsWith('.m4a') || f.endsWith('.mp3') || f.endsWith('.opus')));
            if (files.length > 0) {
                const filePath = path.join(tempDir, files[0]);
                const buffer = fs.readFileSync(filePath);
                fs.unlinkSync(filePath);
                return buffer;
            }
        } catch (e) {
            // next client
        }
    }
    throw new Error('tous les clients bloques');
}
