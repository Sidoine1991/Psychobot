#!/usr/bin/env node

/**
 * Audio Pipeline Test Script
 * Validates: Download → Transcribe → AI → TTS → Convert
 *
 * Usage: node test-audio-pipeline.js [test-audio-file.wav or .ogg]
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY;
const NVIDIA_NIM_BASE = 'https://integrate.api.nvidia.com/v1';

if (!NVIDIA_NIM_API_KEY) {
    console.error('❌ NVIDIA_NIM_API_KEY manquante. Configurez-la dans .env');
    process.exit(1);
}

// Color output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[36m'
};

function log(msg, color = 'reset') {
    console.log(`${colors[color]}${msg}${colors.reset}`);
}

async function testOpenAIKey() {
    log('\n[1/5] Testing OpenAI API Key...', 'blue');
    if (!OPENAI_API_KEY) {
        log('❌ OPENAI_API_KEY not set in .env', 'red');
        return false;
    }
    try {
        const response = await axios.get('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
        });
        log(`✓ OpenAI API OK (${response.data.data.length} models available)`, 'green');
        return true;
    } catch (err) {
        log(`❌ OpenAI API Error: ${err.response?.status} ${err.message}`, 'red');
        return false;
    }
}

async function testNvidiaKey() {
    log('\n[2/5] Testing NVIDIA NIM API Key...', 'blue');
    try {
        const response = await axios.post(`${NVIDIA_NIM_BASE}/chat/completions`, {
            model: 'meta/llama-3.3-70b-instruct',
            messages: [{ role: 'user', content: 'Say "OK" and nothing else' }],
            temperature: 0.7,
            max_tokens: 10
        }, {
            headers: { 'Authorization': `Bearer ${NVIDIA_NIM_API_KEY}` },
            timeout: 30000
        });
        const text = response.data.choices[0].message.content;
        log(`✓ NVIDIA NIM OK (Response: "${text}")`, 'green');
        return true;
    } catch (err) {
        log(`❌ NVIDIA NIM Error: ${err.response?.status} ${err.message}`, 'red');
        return false;
    }
}

async function testGoogleTTS() {
    log('\n[3/5] Testing Google TTS...', 'blue');
    try {
        const googleTTS = require('google-tts-api');
        const url = googleTTS.getAudioUrl('Bonjour test', {
            lang: 'fr',
            slow: false,
            host: 'https://translate.google.com'
        });
        log(`✓ Google TTS URL generated: ${url.substring(0, 80)}...`, 'green');
        return true;
    } catch (err) {
        log(`❌ Google TTS Error: ${err.message}`, 'red');
        return false;
    }
}

async function testFFmpeg() {
    log('\n[4/5] Testing FFmpeg...', 'blue');
    try {
        const ffmpeg = require('fluent-ffmpeg');
        const ffmpegPath = require('ffmpeg-static');
        ffmpeg.setFfmpegPath(ffmpegPath);
        log(`✓ FFmpeg path: ${ffmpegPath}`, 'green');
        log(`✓ FFmpeg available at: ${require('ffmpeg-static')}`, 'green');
        return true;
    } catch (err) {
        log(`❌ FFmpeg Error: ${err.message}`, 'red');
        return false;
    }
}

async function testAudioProcessor() {
    log('\n[5/5] Testing Audio Processor Module...', 'blue');
    try {
        const audioProcessor = require('./src/services/audioProcessor');
        const hasRequiredMethods = [
            'downloadAudio',
            'convertToWav',
            'transcribeAudioOpenAI',
            'textToSpeechGoogle',
            'processAudioMessage',
            'cleanup'
        ].every(m => typeof audioProcessor[m] === 'function');

        if (!hasRequiredMethods) {
            log('❌ Some methods missing from audioProcessor', 'red');
            return false;
        }
        log('✓ Audio Processor has all required methods', 'green');
        return true;
    } catch (err) {
        log(`❌ Audio Processor Error: ${err.message}`, 'red');
        return false;
    }
}

async function testTranscription(audioFile) {
    log('\n[BONUS] Testing Audio Transcription...', 'blue');
    if (!audioFile || !fs.existsSync(audioFile)) {
        log(`⚠ Skipping transcription test (no file provided)`, 'yellow');
        return null;
    }

    try {
        const audioProcessor = require('./src/services/audioProcessor');
        const FormData = require('form-data');
        const audioBuffer = fs.readFileSync(audioFile);

        const formData = new FormData();
        formData.append('file', audioBuffer, { filename: path.basename(audioFile) });
        formData.append('model', 'whisper-1');
        formData.append('language', 'fr');

        log(`Testing transcription of ${path.basename(audioFile)}...`, 'blue');
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
        log(`✓ Transcription successful: "${text}"`, 'green');
        return text;
    } catch (err) {
        log(`❌ Transcription Error: ${err.response?.status} ${err.message}`, 'red');
        return null;
    }
}

async function runTests() {
    log('╔════════════════════════════════════════════╗', 'blue');
    log('║      PsychoBot Audio Pipeline Tests       ║', 'blue');
    log('╚════════════════════════════════════════════╝', 'blue');

    const results = [];

    results.push(await testOpenAIKey());
    results.push(await testNvidiaKey());
    results.push(await testGoogleTTS());
    results.push(await testFFmpeg());
    results.push(await testAudioProcessor());

    // Bonus: Test transcription if file provided
    const audioFile = process.argv[2];
    await testTranscription(audioFile);

    // Summary
    log('\n╔════════════════════════════════════════════╗', 'blue');
    const passed = results.filter(r => r).length;
    const total = results.length;
    const allPassed = passed === total;

    log(`║ Summary: ${passed}/${total} tests passed`, 'blue');
    log('╚════════════════════════════════════════════╝', 'blue');

    if (allPassed) {
        log('\n✓ All systems ready for audio processing!', 'green');
        log('\nNext steps:', 'blue');
        log('1. Send a voice message to PsychoBot on WhatsApp', 'yellow');
        log('2. Check logs: pm2 logs psychobot-v2 | grep "AudioHandler"', 'yellow');
        log('3. Verify audio response received', 'yellow');
        return 0;
    } else {
        log('\n❌ Some tests failed. Fix issues above and retry.', 'red');
        return 1;
    }
}

runTests().then(code => process.exit(code));
