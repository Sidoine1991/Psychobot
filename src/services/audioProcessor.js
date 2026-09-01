/**
 * Audio Processor Service for KolaBoT
 * Handles: Download → Transcribe (Groq/OpenAI direct, no FFmpeg) → AI Response → TTS → Send
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const FormData = require('form-data');
const googleTTS = require('google-tts-api');
const { convertToOpus } = require('../lib/audioHelper');

// AWS Transcribe integration (uses existing AWS Bedrock credentials)
const { transcribeAudioAWS } = require('./aws-transcribe');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_TRANSCRIBE_MODEL = process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3-turbo';
const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY;

// Validate OpenAI API key format (reject placeholder values)
function isValidOpenAIKey(key) {
    if (!key) return false;
    // Reject known placeholder values
    const placeholders = ['fallback_minimal', 'sk-your', 'sk-xxx', 'sk-placeholder', 'your-key-here'];
    if (placeholders.some(p => key.toLowerCase().includes(p))) return false;
    // Valid OpenAI keys start with 'sk-' and are at least 20 chars
    return key.startsWith('sk-') && key.length >= 20;
}

// Validate Groq API key format (gsk_...)
function isValidTranscriptionKey(key) {
    if (!key) return false;
    const placeholders = ['placeholder', 'your-key-here', 'xxx'];
    if (placeholders.some(p => key.toLowerCase().includes(p))) return false;
    return key.startsWith('gsk_') && key.length >= 20;
}
const NVIDIA_NIM_BASE = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_NIM_MODEL = process.env.NVIDIA_NIM_MODEL || 'meta/llama-3.3-70b-instruct';

// Check if AWS credentials are available
const AWS_AVAILABLE = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

/**
 * Transcribe audio using Groq/OpenAI Whisper API (accepts OGG/Opus directly)
 * @param {string} audioPath - Path to audio file (OGG format)
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeWithProvider(audioPath, provider) {
    const audioBuffer = fs.readFileSync(audioPath);
    const formData = new FormData();

    if (provider === 'openai') {
        formData.append('file', audioBuffer, { filename: 'audio.ogg' });
        formData.append('model', 'whisper-1');
        const whisperLang = process.env.WHISPER_LANGUAGE;
        if (whisperLang) formData.append('language', whisperLang);
        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
            headers: { ...formData.getHeaders(), 'Authorization': `Bearer ${OPENAI_API_KEY}` },
            timeout: 60000
        });
        return response.data.text.trim();
    }

    if (provider === 'groq') {
        formData.append('file', audioBuffer, { filename: 'audio.ogg' });
        formData.append('model', GROQ_TRANSCRIBE_MODEL);
        formData.append('response_format', 'json');
        const whisperLang = process.env.WHISPER_LANGUAGE;
        if (whisperLang) formData.append('language', whisperLang);
        const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formData, {
            headers: { ...formData.getHeaders(), 'Authorization': `Bearer ${GROQ_API_KEY}` },
            timeout: 60000
        });
        return response.data.text.trim();
    }

    if (provider === 'nvidia') {
        formData.append('file', audioBuffer, { filename: 'audio.ogg' });
        formData.append('model', 'nvidia/canary-1b');
        const whisperLang = process.env.WHISPER_LANGUAGE;
        if (whisperLang) formData.append('language', whisperLang);
        const response = await axios.post(`${NVIDIA_NIM_BASE}/audio/transcriptions`, formData, {
            headers: { ...formData.getHeaders(), 'Authorization': `Bearer ${NVIDIA_NIM_API_KEY}` },
            timeout: 60000
        });
        return response.data.text.trim();
    }

    throw new Error(`Unknown provider: ${provider}`);
}

/**
 * Main transcription function with AWS Transcribe priority
 * Tries AWS first (free tier), then Groq, then OpenAI as fallback
 */
async function transcribeAudioOpenAI(audioPath) {
    const failures = [];

    // Try AWS Transcribe first (free tier available)
    if (AWS_AVAILABLE) {
        try {
            console.log('[AudioProcessor] Trying AWS Transcribe (free tier)...');
            // 'auto' → AWS identifie lui-même la langue (fr/en/fon/yoruba…)
            const awsResult = await transcribeAudioAWS(audioPath, 'auto');
            if (awsResult.success && awsResult.text && awsResult.text.trim()) {
                console.log(`[AudioProcessor] AWS Transcribed: "${awsResult.text}"`);
                return awsResult.text.trim();
            }
            const reason = awsResult.success ? 'transcript vide' : awsResult.error;
            console.warn(`[AudioProcessor] AWS failed: ${reason}`);
            failures.push(`aws: ${reason}`);
        } catch (error) {
            console.warn(`[AudioProcessor] AWS Transcribe error: ${error.message} — trying fallback...`);
            failures.push(`aws: ${error.message}`);
        }
    }

    // Fallback API providers (Groq d'abord : clé active et moins chère, puis OpenAI)
    const providers = [];
    if (isValidTranscriptionKey(GROQ_API_KEY)) providers.push('groq');
    if (isValidOpenAIKey(OPENAI_API_KEY)) providers.push('openai');

    if (providers.length === 0) {
        const hasValidKey = isValidOpenAIKey(OPENAI_API_KEY);
        const hasAWS = !!AWS_AVAILABLE;
        throw new Error(
            `No transcription service available (AWS: ${hasAWS}, Groq key valid: ${!!GROQ_API_KEY}, OpenAI key valid: ${hasValidKey})`
        );
    }

    for (const provider of providers) {
        try {
            console.log(`[AudioProcessor] Transcribing with ${provider}...`);
            const text = await transcribeWithProvider(audioPath, provider);
            if (!text || !text.trim()) {
                console.warn(`[AudioProcessor] ${provider} returned empty transcript — trying next...`);
                failures.push(`${provider}: transcript vide`);
                continue;
            }
            console.log(`[AudioProcessor] Transcribed (${provider}): "${text}"`);
            return text;
        } catch (error) {
            const detail = error.response
                ? `${error.response.status} ${(typeof error.response.data === 'object' ? JSON.stringify(error.response.data).substring(0, 200) : String(error.response.data).substring(0, 200))}`
                : error.message;
            console.warn(`[AudioProcessor] ${provider} failed: ${detail} — trying next...`);
            failures.push(`${provider}: ${detail}`);
        }
    }

    throw new Error(`All transcription providers failed — ${failures.join(' | ')}`);
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

        // Google TTS limit: 200 characters max
        // If text is too long, truncate to first 190 chars + "..."
        let ttsText = text;
        if (text.length > 200) {
            ttsText = text.substring(0, 190) + '...';
            console.log(`[AudioProcessor] Text truncated: ${text.length} → 193 chars for TTS`);
        }

        // Get audio URL from Google TTS
        const audioUrl = googleTTS.getAudioUrl(ttsText, {
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
 * Download audio from WhatsApp and save locally
 * @param {Object} audioMessage - audioMessage object from Baileys
 * @param {Function} downloadContentFromMessage - Baileys download function
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

        if (buffer.length === 0) {
            throw new Error('Audio buffer vide — déchiffrement WhatsApp échoué (Bad MAC)');
        }

        if (buffer.length < 100) {
            console.warn(`[AudioProcessor] Audio anormalement petit (${buffer.length} bytes) — possible corruption`);
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
    let audioResponsePath = null;

    try {
        // Step 1: Download audio (avec retry si déchiffrement échoue)
        const MAX_RETRIES = 3;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                downloadedPath = await downloadAudio(audioMessage, downloadContentFromMessage);
                break; // success
            } catch (dlErr) {
                console.warn(`[AudioProcessor] Download attempt ${attempt}/${MAX_RETRIES} failed: ${dlErr.message}`);
                if (attempt < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, 3000 * attempt)); // backoff: 3s, 6s, 9s
                } else {
                    throw dlErr;
                }
            }
        }

        // Step 2: Transcribe directly from OGG (Groq/OpenAI accept OGG/Opus natively)
        let transcript = '';
        try {
            transcript = await transcribeAudioOpenAI(downloadedPath);
        } catch (err) {
            console.warn('[AudioProcessor] Transcription failed, trying local...');
            transcript = await transcribeAudioLocal(downloadedPath);
        }

        if (!transcript || transcript.includes('placeholder') || transcript.includes('local fallback not available') || transcript.includes('local transcription not yet')) {
            console.error(`[AudioProcessor] Transcription invalide: "${transcript}"`);
            throw new Error('Transcription failed');
        }

        // Step 3: Get AI response
        const aiModule = require('./ai');
        const history = aiModule.getConversationHistory(remoteJid);
        const aiResponse = await aiModule.getAIResponse(transcript, callerName, history, remoteJid);

        // Step 4: Convert response to audio (optionnel — la réponse texte reste envoyée même si la TTS échoue)
        // Détection de langue fiable (fr/en/fon) via subscriberMemory pour choisir la TTS
        const subscriberMemory = require('./subscriberMemory');
        const detectedLang = subscriberMemory.detectLanguage(transcript);
        // Google TTS ne gère que certaines langues : fr/en OK, fon/yoruba → texte seul
        const ttsLang = { fr: 'fr', en: 'en' }[detectedLang];
        if (ttsLang) {
            try {
                audioResponsePath = await textToSpeechGoogle(aiResponse, ttsLang);
            } catch (ttsErr) {
                console.warn(`[AudioProcessor] TTS échouée (${ttsErr.message}) — réponse texte uniquement`);
                audioResponsePath = null;
            }
        } else {
            console.warn(`[AudioProcessor] Langue "${detectedLang}" non supportée par Google TTS — réponse texte uniquement`);
        }

        console.log('[AudioProcessor] ✓ Complete pipeline successful');
        return {
            audioPath: audioResponsePath,
            transcript,
            response: aiResponse
        };

    } catch (error) {
        console.error('[AudioProcessor] Pipeline error:', error.message);

        // Cleanup on error
        [downloadedPath, audioResponsePath].forEach(p => {
            if (p && fs.existsSync(p)) {
                try { fs.unlinkSync(p); } catch (e) { }
            }
        });

        // Return a user-friendly error
        throw new Error(`Transcription impossible: ${error.message}. Vérifiez les clés de transcription (GROQ_API_KEY / OPENAI_API_KEY / AWS) dans Render.`);
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
    transcribeAudioOpenAI,
    transcribeAudioLocal,
    getAIResponseForAudio,
    textToSpeechGoogle,
    processAudioMessage,
    cleanup
};
