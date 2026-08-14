/**
 * KolaBoT AWS Transcribe Integration
 * Uses AWS Bedrock credentials for audio transcription (free alternative to OpenAI)
 *
 * Installation:
 * npm install @aws-sdk/client-transcribe-streaming
 * npm install @aws-sdk/client-bedrock-runtime
 */

const {
    TranscribeStreamingClient,
    StartStreamTranscriptionCommand
} = require('@aws-sdk/client-transcribe-streaming');
const fs = require('fs');
const path = require('path');

/**
 * AWS Transcribe Audio Processor
 * Free tier: 60 minutes/month for first 12 months, then $0.024/min
 */
class AWSTranscribeProcessor {
    constructor() {
        // Use existing AWS credentials from environment or Claude Code profile
        this.client = new TranscribeStreamingClient({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
    }

    /**
     * Transcribe audio file using AWS Transcribe
     * @param {string} audioFilePath - Path to audio file (OGG, WAV, MP3)
     * @param {string} language - Language code (fr-FR, en-US) ou 'auto' pour identification automatique
     * @returns {Promise<string>} Transcribed text
     */
    async transcribeAudio(audioFilePath, language = 'auto') {
        console.log(`[AWS Transcribe] Processing: ${audioFilePath}`);
        console.log(`[AWS Transcribe] Language: ${language}`);

        try {
            // Read audio file
            const audioBuffer = fs.readFileSync(audioFilePath);

            // Convert OGG to PCM if needed (AWS Transcribe requires PCM)
            const pcmBuffer = await this.convertToPCM(audioBuffer, audioFilePath);

            // Create audio stream generator
            const audioStream = async function* () {
                const chunkSize = 1024 * 8; // 8KB chunks (AWS Transcribe limit)
                for (let i = 0; i < pcmBuffer.length; i += chunkSize) {
                    yield {
                        AudioEvent: {
                            AudioChunk: pcmBuffer.slice(i, i + chunkSize)
                        }
                    };
                }
            };

            // Configure transcription — identification automatique de la langue par défaut
            // (les notes en fon/anglais/yoruba ne sont plus déformées par un 'fr-FR' forcé)
            const commandParams = {
                MediaSampleRateHertz: 16000,
                MediaEncoding: 'pcm',
                AudioStream: audioStream()
            };
            if (language && language !== 'auto') {
                commandParams.LanguageCode = language;
            } else {
                commandParams.IdentifyLanguage = true;
            }
            const command = new StartStreamTranscriptionCommand(commandParams);

            // Start streaming transcription
            const response = await this.client.send(command);

            // Collect transcript from stream
            let transcript = '';
            for await (const event of response.TranscriptResultStream) {
                if (event.TranscriptEvent) {
                    const results = event.TranscriptEvent.Transcript.Results;
                    if (results && results.length > 0) {
                        const result = results[0];
                        if (!result.IsPartial && result.Alternatives) {
                            transcript += result.Alternatives[0].Transcript + ' ';
                        }
                    }
                }
            }

            const finalTranscript = transcript.trim();
            console.log(`[AWS Transcribe] Success: "${finalTranscript}"`);
            return finalTranscript;

        } catch (error) {
            console.error(`[AWS Transcribe] Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Convert audio to PCM format required by AWS Transcribe
     * Uses ffmpeg (already installed in KolaBoT)
     */
    async convertToPCM(audioBuffer, originalPath) {
        const ffmpeg = require('fluent-ffmpeg');
        const ffmpegPath = require('ffmpeg-static');
        ffmpeg.setFfmpegPath(ffmpegPath);

        const tempPCM = originalPath.replace(/\.\w+$/, '_pcm.wav');

        return new Promise((resolve, reject) => {
            // Write buffer to temp file first
            const tempInput = originalPath + '.tmp';
            fs.writeFileSync(tempInput, audioBuffer);

            ffmpeg(tempInput)
                .audioFrequency(16000)
                .audioChannels(1)
                .audioCodec('pcm_s16le')
                .format('wav')
                .on('end', () => {
                    const pcmBuffer = fs.readFileSync(tempPCM);

                    // Cleanup
                    try {
                        fs.unlinkSync(tempInput);
                        fs.unlinkSync(tempPCM);
                    } catch (e) {}

                    resolve(pcmBuffer);
                })
                .on('error', reject)
                .save(tempPCM);
        });
    }

    /**
     * Alternative: Use AWS Bedrock for transcription via Claude API
     * (If Transcribe streaming is complex)
     */
    async transcribeViaBedrockClaude(audioFilePath) {
        const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

        const client = new BedrockRuntimeClient({
            region: 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });

        // Note: Claude 3.5 doesn't support audio input directly
        // This would require using AWS Transcribe or OpenAI Whisper
        // Keeping OpenAI as fallback might be best

        console.log('[Bedrock] Audio transcription not directly supported by Claude models');
        console.log('[Bedrock] Use AWS Transcribe instead');

        return null;
    }
}

/**
 * Integration function for KolaBoT audioProcessor.js
 * Drop-in replacement for OpenAI Whisper transcription
 */
async function transcribeAudioAWS(audioFilePath, language = 'auto') {
    const processor = new AWSTranscribeProcessor();

    try {
        const transcript = await processor.transcribeAudio(audioFilePath, language);
        return {
            success: true,
            text: transcript,
            provider: 'aws-transcribe'
        };
    } catch (error) {
        console.error('[AWS Transcribe] Failed:', error);
        return {
            success: false,
            error: error.message,
            provider: 'aws-transcribe'
        };
    }
}

module.exports = {
    AWSTranscribeProcessor,
    transcribeAudioAWS
};

/**
 * USAGE IN KOLABOT audioProcessor.js:
 *
 * Replace OpenAI Whisper call with:
 *
 * const { transcribeAudioAWS } = require('./aws-transcribe');
 *
 * // Instead of:
 * // const transcript = await transcribeAudioOpenAI(wavPath);
 *
 * // Use:
 * const result = await transcribeAudioAWS(wavPath, 'fr-FR');
 * if (result.success) {
 *     const transcript = result.text;
 *     // Continue with AI response...
 * }
 */
