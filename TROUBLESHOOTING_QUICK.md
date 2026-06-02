# 🔧 Troubleshooting Rapide — PsychoBot No Response

**Problème**: DM envoyé au bot, pas de réponse 🤖

**Causees Probables** (ordre de probabilité):

1. **Render n'a pas fini le déploiement** (encore en cours)
2. **Clé NVIDIA API expirée** 
3. **Bot pas redémarré avec le nouveau code**
4. **Bot déconnecté de WhatsApp**

---

## 🎯 Tests Rapides

### Test 1: Render Status
```
1. Ouvrir: https://dashboard.render.com/
2. Chercher service "Psychobot"
3. Vérifier color du status:
   🟢 Green  = OK, service live
   🟡 Yellow = En cours de deploy
   🔴 Red    = Failed, click Restart
```

### Test 2: Vérifier Logs Render
```
1. Service "Psychobot" → Tab "Logs"
2. Chercher les messages:
   ✅ "Bot Connected Successfully!" = Bot online
   ❌ "Error in auto-response:" = Bug dans le code
   ❌ "NVIDIA API error: 401" = Clé API invalide
   ❌ "NVIDIA API error: 429" = Rate limit
   ⚠️ Rien du tout = Render pas encore déployé
```

### Test 3: Forcer Redémarrage
```
1. Render Dashboard
2. Service "Psychobot"
3. Click "..." (three dots)
4. Click "Restart Service"
5. Wait 2 minutes
6. Send test message again
```

---

## 🛠️ Solutions Par Symptôme

### Symptôme: Render dit "Deploying"
**Solution**: Attendre 5-10 minutes de plus, c'est normal

### Symptôme: Render dit "Live" mais pas de réponse
**Solution 1**: Restart le service (Test 3)
**Solution 2**: Check logs pour erreurs

### Symptôme: Logs montrent "NVIDIA API error: 401"
**Raison**: Clé API expirée  
**Solution**:
```
1. Générer nouvelle clé: https://build.nvidia.com/
2. Render Dashboard
3. Service "Psychobot" → Settings
4. Environment variables
5. Modifier: NVIDIA_NIM_API_KEY
6. Paste nouvelle clé
7. Save & Restart
```

### Symptôme: Logs montrent "Error in auto-response:"
**Raison**: Bug dans le code  
**Solution**:
```
1. Read le reste du message d'erreur
2. Si c'est sur "sock.sendMessage":
   → WhatsApp session expirée
   → Re-pair le bot sur WhatsApp
3. Sinon → Contact Claude pour debug
```

### Symptôme: Logs vides ou pas de "Bot Connected"
**Raison**: Bot jamais connecté ou déployé  
**Solution**:
```
1. Check bot.js existe et est correct
2. Vérifier WhatsApp credentials dans ./session/
3. Si session expirée: delete et re-pair
4. Redeploy: click Restart Service
```

---

## 💡 La Bonne Nouvelle

J'ai push un **correctif** (`581a5cb`) qui ajoute:

✅ **Fallback responses** si NVIDIA API fail  
✅ **Logging amélioré** pour débugger  
✅ **Timeout** sur les requêtes API  
✅ **Meilleurs messages d'erreur**

→ Maintenant, même si NVIDIA API fail, bot répond!

---

## 📞 Pour Déboguer Plus

**Si encore pas de réponse après Restart**:

1. Check Render logs exactement
2. Copy-paste les erreurs
3. Vérifier que commit `581a5cb` est déployé

---

## ✅ Expected Behavior (Quand ça marche)

```
You: Bonjour!
Bot: 🤖 *Assistant Personnel*
     
     Bonjour! Comment je peux t'aider?

(ou fallback si API down:)
Bot: 🤖 *Assistant Personnel*
     
     Coucou! Je suis le bot de Sidoine. Comment je peux t'aider? 👋
```

---

**Next Step**: Restart service et test dans 2-3 minutes

