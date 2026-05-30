# PsychoBot Audio Processing System

## Overview

PsychoBot now supports **full voice conversation** - it receives audio messages, transcribes them, generates AI responses, and sends back voice replies automatically.

### Complete Pipeline

```
🎙️ Voice Message (from user)
         ↓
    📥 Download audio from WhatsApp
         ↓
    🔄 Convert OGG Opus → WAV
         ↓
    📝 Transcribe (OpenAI Whisper)
         ↓
    🤖 Generate AI Response (NVIDIA NIM/Llama)
         ↓
    🎤 Convert text → Speech (Google TTS)
         ↓
    🔄 Convert MP3 → OGG Opus
         ↓
    📤 Send audio reply (to WhatsApp)
         ↓
    📋 Send transcript + response as text summary
```

## Setup Requirements

### 1. Install Dependencies

```bash
cd "D:/Dev/Depot Github/Psychobot"
npm install
npm install openai@^4.28.0  # Added for Whisper transcription
```

### 2. Environment Variables

Add to `.env` file (copy from `.env.example`):

```env
# OpenAI Whisper API (transcription)
OPENAI_API_KEY=sk_your_openai_key_here

# NVIDIA NIM (AI responses) - Already configured
NVIDIA_NIM_API_KEY=nvapi-your_key_here
NVIDIA_NIM_MODEL=meta/llama-3.3-70b-instruct

# Owner configuration
OWNER_NUMBER=237696814391
```

### 3. System Dependencies

Audio processing requires **FFmpeg**:

```bash
# Windows (via npm - already installed)
npm list ffmpeg-static

# Linux
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg
```

## How It Works

### When User Sends Audio Message

1. **Audio Received**: Message detected as `voice_note`, `audio_document`, or `audio` type
2. **Check Conversation State**: Skip if owner is active (replied < 15 min ago)
3. **Process Audio**:
   - Download audio from WhatsApp (OGG Opus format)
   - Convert OGG → WAV (16kHz mono) for transcription API
   - Call OpenAI Whisper: audio → text
4. **Generate Response**:
   - Pass transcript to NVIDIA NIM (Llama 3.3 70B)
   - Get conversational AI response
5. **Text-to-Speech**:
   - Google TTS: response text → MP3 audio
   - Convert MP3 → OGG Opus (WhatsApp format)
6. **Send Response**:
   - Voice reply (OGG audio message)
   - Optional: Text summary (transcript + response)
7. **Cleanup**: Remove temporary files

### File Structure

```
src/services/
├── audioProcessor.js     # Main audio pipeline
├── ai.js                 # AI response generation
└── ...

src/lib/
├── audioHelper.js        # Audio conversion helpers
└── ...

index.js                  # Main bot logic (audio handler)
```

## Code Example

### In index.js (Auto-Reply Handler)

```javascript
// When voice message received:
if (messageType === 'voice_note' || messageType === 'audio' || messageType === 'audio_document') {
    const audioProcessor = require('./src/services/audioProcessor');
    
    const { audioPath, transcript, response } = await audioProcessor.processAudioMessage(
        audioMessage,
        downloadContentFromMessage,
        remoteJid,
        callerName,
        null
    );
    
    // Send audio reply
    await sock.sendMessage(remoteJid, {
        audio: fs.readFileSync(audioPath),
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
        quoted: msg
    });
    
    // Send text summary
    const summary = `🎙️ *Transcript*:\n_"${transcript}"_\n\n🤖 *Response*:\n${response}`;
    await sock.sendMessage(remoteJid, { text: summary }, { quoted: msg });
}
```

## Features

### ✅ Smart Auto-Reply

- **Conversation Detection**: Skips audio processing if owner replied < 15 min ago
- **Language Detection**: Auto-detects French/English for TTS
- **Graceful Fallback**: Text error message if audio processing fails
- **Read Receipts**: Marks message as read after processing

### ✅ Error Handling

```javascript
try {
    const result = await audioProcessor.processAudioMessage(...);
} catch (err) {
    // Fallback: Send error message to user
    await sock.sendMessage(remoteJid, { 
        text: `❌ Erreur: ${err.message.substring(0, 100)}` 
    });
}
```

### ✅ Performance

- **Temp File Cleanup**: Removes all temp audio files after processing
- **Timeout Protection**: 60s timeout on Whisper API calls
- **Stream Processing**: Uses streams for large audio downloads

## Troubleshooting

### "OPENAI_API_KEY not configured"

**Fix**: Add to `.env`:
```env
OPENAI_API_KEY=sk_your_key_here
```

Get key: https://platform.openai.com/account/api-keys

### "Whisper API Error: 401"

**Fix**: Check API key is valid:
```bash
# Test in Node.js
const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// Make a test call
```

### "FFmpeg not found"

**Fix**: Reinstall ffmpeg dependencies:
```bash
npm install ffmpeg-static@^5.1.0 fluent-ffmpeg@^2.1.3
```

### Audio doesn't convert to OGG format

**Fix**: Verify FFmpeg path:
```javascript
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath); // Already done in audioHelper.js
```

## API Costs

| Service | Cost | Limit |
|---------|------|-------|
| OpenAI Whisper | $0.006/min | Per-minute pricing |
| Google TTS | Free | ~500 requests/day |
| NVIDIA NIM (Llama) | Free | Rate-limited |

**Estimated cost per voice message**: ~$0.01 (only transcription paid)

## Testing

### Local Test

```bash
# 1. Send voice message to bot on WhatsApp
# 2. Check logs
tail -f logs/psychobot.log | grep "AudioProcessor\|AudioHandler"

# 3. Expected output:
# [AudioHandler] Processing voice note from ...
# [AudioProcessor] Downloading audio...
# [AudioProcessor] Transcribed: "Your audio text"
# [AudioProcessor] Converting text to speech...
# [AudioHandler] ✓ Audio response sent successfully
```

### Debugging

Enable verbose logging in `index.js`:

```javascript
console.log('[AudioHandler] messageType:', messageType);
console.log('[AudioHandler] audioMessage:', audioMessage);
console.log('[AudioProcessor] audioPath:', audioPath);
```

## Deployment

### Render.com

1. Add `OPENAI_API_KEY` to **Environment Variables** in Render dashboard
2. Restart service
3. Monitor logs: `npm start`

### Local/VPS

```bash
pm2 start index.js --name psychobot-v2
pm2 logs psychobot-v2
```

## Command-Line Tools

```bash
# Test Whisper transcription
curl -X POST https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F "model=whisper-1" \
  -F "file=@audio.wav"

# Test Google TTS
node -e "const googleTTS = require('google-tts-api'); console.log(googleTTS.getAudioUrl('Hello world', {lang: 'en'}))"
```

## Future Enhancements

- [ ] Voice commands (e.g., "!status" as voice)
- [ ] Multi-language auto-detection (not just FR/EN)
- [ ] Real-time transcription (stream, not batch)
- [ ] Voice cloning for custom persona responses
- [ ] Audio message filtering (silence removal)
- [ ] Transcript storage/history

## Support

For issues or questions:
1. Check logs: `pm2 logs psychobot-v2 | grep "AudioProcessor\|AudioHandler"`
2. Verify `.env` variables
3. Test API keys independently
4. File issue on GitHub with logs attached
