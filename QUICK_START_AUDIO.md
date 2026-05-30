# PsychoBot Audio Processing — Quick Start

## 3-Minute Setup

### 1. Install (30 seconds)
```bash
cd "D:/Dev/Depot Github/Psychobot"
npm install openai@^4.28.0
```

### 2. Configure (1 minute)
Copy `.env.example` → `.env` and add:
```env
OPENAI_API_KEY=sk_your_key_here
```

Get key: https://platform.openai.com/account/api-keys

### 3. Validate (30 seconds)
```bash
node test-audio-pipeline.js
```

**Expected output:**
```
[1/5] Testing OpenAI API Key... ✓
[2/5] Testing NVIDIA NIM API Key... ✓
[3/5] Testing Google TTS... ✓
[4/5] Testing FFmpeg... ✓
[5/5] Testing Audio Processor Module... ✓

Summary: 5/5 tests passed

✓ All systems ready for audio processing!
```

### 4. Deploy
```bash
pm2 restart psychobot-v2
# or: npm run dev
```

## Test It

Send a **voice message** to PsychoBot on WhatsApp. You should receive:

1. **Voice reply** (auto-response from Sidoine)
2. **Text summary** showing:
   - What you said (transcript)
   - AI response

## What's Happening Behind the Scenes

```
User sends: 🎙️ "Bonjour, comment allez-vous?"
              ↓
       [Download from WhatsApp]
              ↓
       [Convert OGG → WAV]
              ↓
       [Transcribe via OpenAI Whisper]
              → Text: "Bonjour, comment allez-vous?"
              ↓
       [Generate response via NVIDIA NIM Llama]
              → Response: "Bonjour! Je vais bien, merci..."
              ↓
       [Convert to speech via Google TTS]
              → MP3 audio
              ↓
       [Convert MP3 → OGG Opus]
              → Ready for WhatsApp
              ↓
     [Send voice reply + text summary]
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "OPENAI_API_KEY not configured" | Add `OPENAI_API_KEY=sk_...` to `.env` |
| "Audio response is silent" | Restart bot: `pm2 restart psychobot-v2` |
| "Transcription takes too long" | Normal: Whisper ~3-5 seconds |
| "FFmpeg not found" | Run: `npm install ffmpeg-static@^5.1.0` |
| Test script fails on step 1-2 | Check API keys are valid |

## Files Reference

| File | Purpose |
|------|---------|
| `AUDIO_PROCESSING_GUIDE.md` | Complete setup guide |
| `AUDIO_PROCESSING_IMPLEMENTATION.md` | Technical deep-dive |
| `test-audio-pipeline.js` | Validation script |
| `src/services/audioProcessor.js` | Core service |
| `index.js` | Handler integration |

## Logs

Monitor audio processing:
```bash
pm2 logs psychobot-v2 | grep "AudioHandler\|AudioProcessor"
```

## Performance

- Response time: ~10-15 seconds per voice message
- Cost: ~$0.01 per message (Whisper only)
- Storage: Temp files auto-deleted

## Next Steps

1. ✓ Setup complete
2. ✓ Test validation passing
3. ✓ Voice messages now working
4. Send voice message and verify response
5. Monitor logs for 24 hours
6. Done! 🎉

---

**Questions?** See `AUDIO_PROCESSING_GUIDE.md` for full documentation.
