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
            await replyWithTag(sock, from, msg, `🔎 Recherche de "${query}"...`);

            const searchResult = await ytSearch(query);
            const video = searchResult.videos.length > 0 ? searchResult.videos[0] : null;
            if (!video) return replyWithTag(sock, from, msg, "❌ Aucun resultat trouve.");

            const { title, timestamp, url } = video;

            await sock.sendMessage(from, {
                text: `🎵 *${title}*\n⏱️ ${timestamp}\n🔗 ${url}`
            }, { quoted: msg });

            await sock.sendPresenceUpdate('composing', from);

            // Method 1: Cobalt API (reliable, no bot-check)
            let audioBuffer = null;
            try {
                audioBuffer = await downloadViaCobalt(url);
            } catch (e) {
                console.log('[Play] Cobalt failed:', e.message);
            }

            // Method 2: yt-dlp local fallback
            if (!audioBuffer) {
                try {
                    audioBuffer = await downloadViaYtDlp(url, tempDir);
                } catch (e) {
                    console.log('[Play] yt-dlp failed:', e.message);
                }
            }

            if (!audioBuffer) {
                return replyWithTag(sock, from, msg, "❌ Impossible de telecharger. YouTube bloque les serveurs cloud. Reessayez plus tard.");
            }

            // Send audio
            await sock.sendMessage(from, {
                audio: audioBuffer,
                mimetype: 'audio/mp4',
                fileName: title + '.m4a',
                ptt: false
            }, { quoted: msg });

        } catch (err) {
            console.error('[Play Error]:', err.message);
            await replyWithTag(sock, from, msg, `❌ Erreur: ${err.message}`);
        }
    }
};

async function downloadViaCobalt(videoUrl) {
    const resp = await axios.post('https://api.cobalt.tools/api/json', {
        url: videoUrl,
        aFormat: "mp3",
        filenamePattern: "basic",
        isAudioOnly: true
    }, {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });

    if (resp.data.status === 'stream' || resp.data.status === 'redirect') {
        const dlUrl = resp.data.url;
        const audioResp = await axios.get(dlUrl, { responseType: 'arraybuffer', timeout: 120000 });
        return Buffer.from(audioResp.data);
    }

    if (resp.data.status === 'picker' && resp.data.audio) {
        const dlUrl = resp.data.audio;
        const audioResp = await axios.get(dlUrl, { responseType: 'arraybuffer', timeout: 120000 });
        return Buffer.from(audioResp.data);
    }

    throw new Error('Cobalt: format non supporte - ' + resp.data.status);
}

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
            await execAsync(cmd, { timeout: 120000 });

            const files = fs.readdirSync(tempDir).filter(f => f.startsWith(fileName) && (f.endsWith('.m4a') || f.endsWith('.mp3') || f.endsWith('.opus')));
            if (files.length > 0) {
                const filePath = path.join(tempDir, files[0]);
                const buffer = fs.readFileSync(filePath);
                fs.unlinkSync(filePath);
                return buffer;
            }
        } catch (e) {
            // try next client
        }
    }

    throw new Error('yt-dlp: tous les clients bloques');
}
