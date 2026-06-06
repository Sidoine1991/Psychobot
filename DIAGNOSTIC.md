# 🔍 Diagnostic — PsychoBot Auto-Response v2 Non-Responsive

**Issue**: Bot reçoit DM mais ne répond pas  
**Date**: 2026-05-27  
**Commit**: `3f2863f`

---

## 🚨 Problèmes Possibles

### 1. **Render n'a pas redémarré le service** ⚠️
- Le code `3f2863f` est poussé ✅
- Mais Render peut ne pas l'avoir redéployé
- **Solution**: 
  - Aller sur https://dashboard.render.com/
  - Chercher service "Psychobot"
  - Cliquer "Restart Service"

### 2. **NVIDIA API Key invalide ou expirée** ⚠️
- La clé doit être configurée dans les variables d'environnement Render
- **Solution**: 
  - Vérifier que `NVIDIA_NIM_API_KEY` est configurée dans Render Dashboard → Environment
  - Si expirée, générer nouvelle clé depuis [NVIDIA NIM Console](https://build.nvidia.com/explore/discover)
  - Mettre à jour dans Render env vars puis redémarrer le service

### 3. **Bot n'a pas accès au nouvel handler** ⚠️
- Le code de `autoResponse.js` peut ne pas être actif
- **Solution**: 
  - Vérifier logs Render
  - Chercher: `Auto Response Triggered for:`
  - Si absent: code n'est pas exécuté

### 4. **Erreur dans le code déployé** ⚠️
- Une erreur silencieuse bloque la réponse
- **Solution**: 
  - Vérifier logs Render pour exceptions
  - Chercher: `Error in auto-response:`

### 5. **Bot offline ou déconnecté** ⚠️
- WhatsApp session expirée
- **Solution**: 
  - Vérifier logs: `Bot Connected Successfully!`
  - Si absent: bot not logged in

---

## ✅ Checklist de Diagnostic

### A. Vérifier Render Deployment

```bash
1. Aller sur: https://dashboard.render.com/
2. Chercher "Psychobot" service
3. Vérifier le status:
   - 🟢 Green = Service is live
   - 🟡 Yellow = Deploying
   - 🔴 Red = Failed

4. Cliquer "Events" et chercher:
   ✅ "Building Docker image"
   ✅ "Running npm install"
   ✅ "Service is live"
   ❌ Erreurs (deploy failed, etc.)

5. Si status = 🔴 RED:
   → Click "Restart Service"
```

### B. Vérifier Logs Render

```
Dans Render Dashboard:
1. Service "Psychobot"
2. Tab "Logs"
3. Chercher patterns:
   - "Bot Connected Successfully!" (OK)
   - "Error:" ou "Failed" (PROBLÈME)
   - "Auto Response Triggered for:" (CODE RUNS)
   - "NVIDIA API error:" (API KEY ISSUE)
```

### C. Vérifier WhatsApp Connexion

```
Logs à chercher:
✅ "Bot Connected Successfully!" = Bot is online
❌ "Connection closed" = Bot disconnected
❌ "No credentials found" = Session lost
```

### D. Vérifier API Call

```
Logs à chercher:
✅ "[AI Service] Received prompt:" = AI call initiated
❌ "NVIDIA API error: 401" = API Key invalid/expired
❌ "NVIDIA API error: 429" = Rate limited
❌ "NVIDIA API error: 500" = API server down
```

---

## 🔧 Solutions Rapides

### Solution 1: Restart Render Service

```
1. https://dashboard.render.com/
2. Find "Psychobot"
3. Click "..." (more options)
4. Click "Restart Service"
5. Wait 1-2 minutes
6. Send test message
```

### Solution 2: Update API Key (if expired)

```
1. Get new NVIDIA API key from:
   https://build.nvidia.com/

2. In Render Dashboard:
   - Service "Psychobot"
   - Tab "Settings"
   - Environment
   - Edit: NVIDIA_NIM_API_KEY
   - Paste new key
   - Save & Restart

3. Test again
```

### Solution 3: Deploy Latest Code

```bash
cd D:\Dev\Depot Github\Psychobot

# Make sure we're on latest
git pull origin main

# If needed, force redeploy:
git commit --allow-empty -m "chore: force redeploy"
git push origin main

# Or manually trigger in Render:
# Dashboard → Service → Manual Deploy
```

### Solution 4: Check Handler is Loaded

Check that `src/handlers/autoResponse.js` is being called:

In `bot.js`, line ~145, it should be:
```javascript
// Auto Response
await autoResponseHandler(msg, sock);
```

If missing or commented: uncomment it!

---

## 📋 Debug Checklist

Before messaging support:

- [ ] Render service shows 🟢 Green status
- [ ] Logs show "Bot Connected Successfully!"
- [ ] Logs show "Auto Response Triggered for:" (when you send message)
- [ ] No "Error:" in logs
- [ ] NVIDIA API key in Render env vars
- [ ] Code commit `3f2863f` is deployed
- [ ] bot.js has `await autoResponseHandler(msg, sock);`

---

## 🆘 If Still Not Working

**Most Likely**: Render hasn't deployed the code yet

**Solution**:
1. Check Render Events tab
2. If "Deploying": wait 2-5 more minutes
3. If "Failed": click "Restart Service"
4. If "Live" but no response: check logs

**Then test**:
```
Send: "Bonjour"
Expected: 🤖 *Assistant Personnel* + response
Actual: [Nothing]
```

Check Render logs for:
- `Error in auto-response:`
- `NVIDIA API error:`
- `Auto Response Triggered for:` (if missing, code not running)

---

## 🎯 Most Common Causes (in order)

1. **Render still deploying** (ETA: 2-5 min) → Wait
2. **Service not restarted** → Restart manually
3. **NVIDIA key expired** → Update key
4. **autoResponseHandler not called** → Check bot.js
5. **Bot disconnected** → Check WhatsApp credentials

---

**Next Step**: Check Render dashboard status  
**After**: Send another test message and monitor logs

