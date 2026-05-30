/**
 * Audio Processor Service for Psychobot
 * Handles: Download → Transcribe → Generate AI Response → Convert to Audio → Send
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const googleTTS = require('google-tts-api');
const { convertToOpus } = require('../lib/audioHelper');

ffmpeg.setFfmpegPath(ffmpegPath);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY || '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';
const NVIDIA_NIM_BASE = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_NIM_MODEL = process.env.NVIDIA_NIM_MODEL || 'meta/llama-3.3-70b-instruct';

/**
 * Download audio from WhatsApp and save locally
 * @param {Object} audioMessage - audioMessage object from Baileys
 * @param {Function} downloadContentFromMessage - Baileys function
 * @returns {Promise<string>} - Path to downloaded audio file
 */
async function downloadAudio(audioMessage, downloadContentFromMessage) {
    try {
        console.log('[AudioProcessor] Downloading audio...');
        const stream = await downloadContentFromMessage(audioMessage, 'audio');
        let buffer = Buffer.from([]);

        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const tempDir = os.tmpdir();
        const audioPath = path.join(tempDir, `audio_${Date.now()}.ogg`);
        fs.writeFileSync(audioPath, buffer);
        console.log(`[AudioProcessor] Audio downloaded: ${audioPath} (${buffer.length} bytes)`);

        return audioPath;
    } catch (error) {
        console.error('[AudioProcessor] Download error:', error.message);
        throw error;
    }
}

/**
 * Convert OGG Opus audio to WAV for transcription APIs
 * @param {string} inputPath - Path to OGG file
 * @returns {Promise<string>} - Path to WAV file
 */
async function convertToWav(inputPath) {
    return new Promise((resolve, reject) => {
        const outputPath = inputPath.replace('.ogg', '.wav');

        ffmpeg(inputPath)
            .toFormat('wav')
            .audioCodec('pcm_s16le')
            .audioFrequency(16000)
            .on('end', () => {
                console.log(`[AudioProcessor] Converted to WAV: ${outputPath}`);
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error('[AudioProcessor] FFmpeg conversion error:', err.message);
                reject(err);
            })
            .save(outputPath);
    });
}

/**
 * Transcribe audio using OpenAI Whisper API
 * @param {string} audioPath - Path to audio file (WAV format)
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudioOpenAI(audioPath) {
    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not configured');
    }

    try {
        console.log('[AudioProcessor] Transcribing with OpenAI Whisper...');
        const FormData = require('form-data');
        const audioBuffer = fs.readFileSync(audioPath);

        const formData = new FormData();
        formData.append('file', audioBuffer, { filename: 'audio.wav' });
        formData.append('model', 'whisper-1');
        formData.append('language', 'fr'); // French by default

        const response = await axios.post(
            'https://api.openai.com/v1/audio/transcriptions',
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                timeout: 60000
            }
        );

        const text = response.data.text.trim();
        console.log(`[AudioProcessor] Transcribed: "${text}"`);
        return text;
    } catch (error) {
        console.error('[AudioProcessor] Whisper error:', error.response?.status, error.message);
        throw error;
    }
}

/**
 * Fallback transcription using local speech-to-text (if available)
 * For now, returns placeholder - can be extended with SpeechRecognition API
 */
async function transcribeAudioLocal(audioPath) {
    console.warn('[AudioProcessor] Local transcription not yet implemented, using placeholder');
    return '[Audio transcription - local fallback not available]';
}

/**
 * Get AI response for transcribed text
 * @param {string} text - Transcribed audio text
 * @param {string} callerName - Name of caller
 * @param {Array} history - Conversation history
 * @param {string} remoteJid - JID for context lookup
 * @param {Function} getAIResponse - AI service function
 * @returns {Promise<string>} - AI response text
 */
async function getAIResponseForAudio(text, callerName, history, remoteJid, getAIResponse) {
    try {
        console.log('[AudioProcessor] Getting AI response...');
        const aiModule = require('./ai');
        const reply = await aiModule.getAIResponse(text, callerName, history, remoteJid);
        return reply;
    } catch (error) {
        console.error('[AudioProcessor] AI response error:', error.message);
        throw error;
    }
}

/**
 * Convert text to speech using Google TTS
 * @param {string} text - Text to convert
 * @param {string} language - Language code (e.g., 'fr', 'en')
 * @returns {Promise<string>} - Path to audio file in OGG Opus format
 */
async function textToSpeechGoogle(text, language = 'fr') {
    try {
        console.log(`[AudioProcessor] Converting text to speech (${language})...`);

        // Get audio URL from Google TTS
        const audioUrl = googleTTS.getAudioUrl(text, {
            lang: language,
            slow: false,
            host: 'https://translate.google.com'
        });

        console.log(`[AudioProcessor] Google TTS URL: ${audioUrl.substring(0, 50)}...`);

        // Convert MP3 → OGG Opus
        const audioPath = await convertToOpus(audioUrl);
        return audioPath;
    } catch (error) {
        console.error('[AudioProcessor] Google TTS error:', error.message);
        throw error;
    }
}

/**
 * Main processor: Audio → Text → AI → Audio
 * @param {Object} audioMessage - Audio message from Baileys
 * @param {Function} downloadContentFromMessage - Baileys download function
 * @param {string} remoteJid - Sender's JID
 * @param {string} callerName - Sender's name
 * @param {Function} getAIResponseFunc - AI response function
 * @returns {Promise<{audioPath: string, transcript: string, response: string}>}
 */
async function processAudioMessage(audioMessage, downloadContentFromMessage, remoteJid, callerName, getAIResponseFunc) {
    let downloadedPath = null;
    let wavPath = null;
    let audioResponsePath = null;

    try {
        // Step 1: Download audio
        downloadedPath = await downloadAudio(audioMessage, downloadContentFromMessage);

        // Step 2: Convert OGG → WAV
        wavPath = await convertToWav(downloadedPath);

        // Step 3: Transcribe
        let transcript = '';
        try {
            transcript = await transcribeAudioOpenAI(wavPath);
        } catch (err) {
            console.warn('[AudioProcessor] OpenAI Whisper failed, trying local...');
            transcript = await transcribeAudioLocal(wavPath);
        }

        if (!transcript || transcript.includes('placeholder')) {
            throw new Error('Transcription failed');
        }

        // Step 4: Get AI response
        const aiModule = require('./ai');
        const history = aiModule.getConversationHistory(remoteJid);
        const aiResponse = await aiModule.getAIResponse(transcript, callerName, history, remoteJid);

        // Step 5: Convert response to audio
        // Detect language from transcript (simple heuristic: French if contains French words)
        const frenchWords = ['le', 'la', 'de', 'et', 'un', 'une', 'est', 'je', 'tu', 'il', 'elle'];
        const words = transcript.toLowerCase().split(/\s+/);
        const hasFrench = words.some(w => frenchWords.includes(w));
        const language = hasFrench ? 'fr' : 'en';

        audioResponsePath = await textToSpeechGoogle(aiResponse, language);

        console.log('[AudioProcessor] ✓ Complete pipeline successful');
        return {
            audioPath: audioResponsePath,
            transcript,
            response: aiResponse
        };

    } catch (error) {
        console.error('[AudioProcessor] Pipeline error:', error.message);

        // Cleanup on error
        [downloadedPath, wavPath, audioResponsePath].forEach(p => {
            if (p && fs.existsSync(p)) {
                try { fs.unlinkSync(p); } catch (e) { }
            }
        });

        throw error;
    }
}

/**
 * Cleanup temporary audio files
 * @param {Array<string>} paths - Paths to clean
 */
function cleanup(paths = []) {
    paths.forEach(p => {
        if (p && fs.existsSync(p)) {
            try {
                fs.unlinkSync(p);
                console.log(`[AudioProcessor] Cleaned: ${p}`);
            } catch (err) {
                console.warn(`[AudioProcessor] Cleanup failed: ${p}`, err.message);
            }
        }
    });
}

module.exports = {
    downloadAudio,
    convertToWav,
    transcribeAudioOpenAI,
    transcribeAudioLocal,
    getAIResponseForAudio,
    textToSpeechGoogle,
    processAudioMessage,
    cleanup
};
