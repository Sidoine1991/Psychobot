# Smart Auto-Reply Configuration Update

## Problem Analysis

### Current Issues:
1. **Generic Auto-Replies** — Send the same "Je ne suis pas sûr..." repeatedly
2. **Annoying Audio** — 4-second voice notes on every missed call

### Feedback:
- Rose_styliste: "ne m'écris plus jamais s'il n'a pas le temps"
- Reine Beaty: "Je suis fatigué d'elle" (about the audio)

---

## Solution: Smart Auto-Reply (Option C) + No Audio (Option D)

### 1. Smart Auto-Reply (TEXT ONLY)

**Current Code** (line 1574):
```javascript
const formattedReply = `🤖 *Assistant de Sidoine*\n\n${reply}`;
```

**Proposed Change:**
```javascript
const formattedReply = `📝 *Nota: Sidoine n'est pas là actuellement.*\n\n${reply}`;
```

**Why:**
- Signals clearly: "Sidoine isn't here"
- Not repetitive emoji (🤖 gets boring)
- AI still generates smart, contextual response
- Feels more personal

### 2. Auto-Reply Templates (autoReplyTemplates.js)

Update to remove generic responses:

**Current:**
```javascript
"Je ne suis pas sûr, {name}. Pouvez-vous me rappeler..."
```

**Proposed:**
```javascript
// Remove generic templates
// ONLY use AI-generated smart responses
// Fallback only if AI fails:
"Merci pour ton message. Sidoine te répondra dès que possible."
```

---

## 3. Disable Audio for Missed Calls

**Current Code** (line 1868-1905):
```javascript
if (call.status === 'timeout' || call.status === 'reject' || ...) {
    // ... generates and sends audio voice note
}
```

**Proposed Change - Option A: COMPLETE DISABLE**
```javascript
if (call.status === 'timeout' || call.status === 'reject' || ...) {
    // DISABLED: No audio response
    // Just notify owner via text
    const ownerJid = ...
    await sock.sendMessage(ownerJid, {
        text: `📞 *Appel Manqué*\n👤 De: @${callerId.split('@')[0]}\n🕐 Heure: ${callTime}\n(Pas de réponse vocale - silencieux activé)`
    })
}
```

**Proposed Change - Option B: TEXT REPLY ONLY**
```javascript
// Instead of audio, send a simple text message
const aiText = "Désolé, pas disponible. Sidoine vous rappelle bientôt.";
await sock.sendMessage(callerId, { text: aiText });
// Still notify owner
```

---

## Implementation

### Files to Modify:

1. **index.js** (line 1574)
   - Change: `🤖 *Assistant de Sidoine*` → `📝 *Nota: Sidoine n'est pas là actuellement.*`

2. **index.js** (line 1868-1905)
   - Remove audio generation and sending
   - Keep text notification to owner only

3. **src/handlers/autoReplyTemplates.js**
   - Remove generic templates
   - Keep fallback only

---

## Testing Checklist

After implementation:

- [ ] Receive text message from contact while absent
  - Expect: Smart reply with "Nota: Sidoine n'est pas là"
  - NOT: Generic "Je ne suis pas sûr..."

- [ ] Receive missed call
  - Expect: NO audio voice note sent
  - Owner still notified via text

- [ ] Owner comes back online
  - Expect: Pending replies cancelled (existing behavior)

---

## Benefits

✅ **Contacts happy:**
- No more repetitive generic responses
- No more annoying 4-second audio clips
- Feels more personal with "Nota" prefix

✅ **Owner happy:**
- Still gets text notifications
- No audio clutter
- Can respond with custom message when back

✅ **System clean:**
- Simpler code (no audio conversion)
- Lower bandwidth usage
- Faster response times

---

## Rollback

If contacts don't like this version, we can:
1. Re-enable audio (but make it optional by contact)
2. Add more creative templates
3. Add detection for "aggressive" tone to respond with different template

