# 📅 Phase 1 : Google Calendar Integration - Guide Complet

**Durée :** 2-3 jours  
**Objectif :** Bot peut créer/lire événements Calendar automatiquement

---

## 🎯 Résultat Final

```
Client WhatsApp: "Je veux un RDV aujourd'hui à 16h pour discuter site web"
Bot WhatsApp: "✅ RDV planifié : Site web - 31/05/2026 16h00"
→ Événement RÉEL créé dans Google Calendar de Sidoine
→ Notification Calendar envoyée
→ Rappel automatique 1h avant
```

---

## 📋 Étape 1 : Configuration Google Cloud (30 min)

### 1.1 Créer Projet Google Cloud

1. **Aller sur :** https://console.cloud.google.com
2. **Connexion :** Compte Google de Sidoine
3. **Nouveau projet :**
   - Cliquer "Select a project" (en haut)
   - "NEW PROJECT"
   - Nom : `KolaBoT-Agent`
   - Organization : (laisser par défaut)
   - Cliquer "CREATE"

### 1.2 Activer Google Calendar API

1. **Dashboard projet :** KolaBoT-Agent
2. **Menu gauche :** APIs & Services → Library
3. **Chercher :** "Google Calendar API"
4. **Cliquer :** Sur le résultat
5. **Cliquer :** "ENABLE"
6. **Attendre :** ~30 secondes activation

### 1.3 Créer Service Account

**Pourquoi Service Account ?**  
→ Permet au bot d'accéder au Calendar sans intervention manuelle  
→ Pas de OAuth popup à chaque fois  
→ Fonctionne 24/7 sur Render

**Étapes :**

1. **Menu gauche :** IAM & Admin → Service Accounts
2. **Cliquer :** "+ CREATE SERVICE ACCOUNT"
3. **Remplir :**
   - Service account name : `kolabot-calendar`
   - Service account ID : (auto-généré)
   - Description : "KolaBoT autonomous calendar access"
4. **Cliquer :** "CREATE AND CONTINUE"
5. **Role :** (Skip, on donnera permissions directement dans Calendar)
6. **Cliquer :** "CONTINUE" puis "DONE"

### 1.4 Générer Credentials JSON

1. **Liste Service Accounts :** Cliquer sur `kolabot-calendar@...`
2. **Onglet :** "KEYS"
3. **Add Key :** "Create new key"
4. **Type :** JSON
5. **Cliquer :** "CREATE"
6. **Téléchargement automatique :** `kolabot-agent-xxxxx.json`
7. **⚠️ IMPORTANT :** Conserver ce fichier en sécurité !

---

## 📋 Étape 2 : Déléguer Accès Calendar (15 min)

### 2.1 Obtenir Email Service Account

**Ouvrir le fichier JSON téléchargé :**
```json
{
  "client_email": "kolabot-calendar@kolabot-agent-xxxxx.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  ...
}
```

**Copier la valeur de `client_email`**

### 2.2 Partager Calendar avec Service Account

1. **Google Calendar :** https://calendar.google.com
2. **Connexion :** Compte Sidoine
3. **Votre calendrier principal :**
   - Passer souris sur "Mes agendas"
   - Cliquer sur ⋮ (3 points verticaux)
   - "Paramètres et partage"
4. **Partager avec des personnes :**
   - Cliquer "+ Ajouter des contacts ou des groupes"
   - Coller email : `kolabot-calendar@kolabot-agent-xxxxx.iam.gserviceaccount.com`
   - Permissions : **"Apporter des modifications aux événements"**
   - Cliquer "Envoyer"

### 2.3 Obtenir Calendar ID

**Toujours dans Paramètres Calendar :**
1. **Section :** "Intégrer l'agenda"
2. **Copier :** "ID de l'agenda"
   - Format : `sidoine.yebadokpo@gmail.com` (ou similaire)
3. **Sauvegarder** cette valeur

---

## 📋 Étape 3 : Configuration Render Variables (10 min)

### 3.1 Préparer Variables depuis JSON

**Ouvrir `kolabot-agent-xxxxx.json` :**

```json
{
  "type": "service_account",
  "project_id": "kolabot-agent-xxxxx",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n",
  "client_email": "kolabot-calendar@...",
  "client_id": "123456789",
  ...
}
```

**Variables à créer sur Render :**

| Variable | Valeur | Exemple |
|----------|--------|---------|
| `GOOGLE_CLIENT_EMAIL` | `client_email` du JSON | `kolabot-calendar@...` |
| `GOOGLE_PRIVATE_KEY` | `private_key` du JSON | `-----BEGIN PRIVATE KEY-----\n...` |
| `GOOGLE_CALENDAR_ID` | ID Calendar copié étape 2.3 | `sidoine.yebadokpo@gmail.com` |

⚠️ **IMPORTANT : `GOOGLE_PRIVATE_KEY`**
- Copier TOUTE la clé avec `-----BEGIN...` et `-----END...`
- Inclure les `\n` (newlines)
- Ne PAS supprimer les backslashes

### 3.2 Ajouter sur Render

1. **Render Dashboard :** https://dashboard.render.com
2. **Service :** psychobot-1si7
3. **Onglet :** Environment
4. **Add Environment Variable :**

**Variable 1 :**
```
Key: GOOGLE_CLIENT_EMAIL
Value: kolabot-calendar@kolabot-agent-xxxxx.iam.gserviceaccount.com
```

**Variable 2 :**
```
Key: GOOGLE_PRIVATE_KEY
Value: -----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
(très longue chaîne avec \n)
...
-----END PRIVATE KEY-----
```

**Variable 3 :**
```
Key: GOOGLE_CALENDAR_ID
Value: sidoine.yebadokpo@gmail.com
```

5. **Cliquer :** "Save Changes"
6. **Attendre :** Redéploiement automatique (~3 min)

---

## 📋 Étape 4 : Installation Package npm (5 min)

**Ajouter Google Calendar client :**

```bash
cd "D:/Dev/Depot Github/Psychobot"
npm install googleapis
```

**Résultat attendu :**
```
+ googleapis@128.0.0
added 1 package
```

---

## 📋 Étape 5 : Code Integration (À CRÉER ENSEMBLE)

Maintenant nous allons créer les fichiers suivants :

### Fichiers à créer :
1. ✅ `src/integrations/googleAuth.js` - Authentification
2. ✅ `src/services/googleCalendar.js` - API Calendar
3. ✅ `src/commands/agenda.js` - Commande !agenda
4. ✅ `src/commands/planifier.js` - Commande !planifier
5. ✅ Modifier `index.js` - Intégrer auto-création événements

---

## 🧪 Tests Phase 1

### Test 1 : Authentification Google
```bash
node test-google-auth.js
```
**Résultat attendu :**
```
✅ Google Auth Success
✅ Calendar API accessible
✅ Calendar ID: sidoine.yebadokpo@gmail.com
```

### Test 2 : Lire Calendar
```
WhatsApp: !agenda
Bot: 📅 Agenda du 31/05/2026:
     16h00 - RDV Site web (Kolaole)
     (Aucun autre événement)
```

### Test 3 : Créer Événement
```
WhatsApp: !planifier demain 10h Appel client test
Bot: ✅ Événement créé : 01/06/2026 10h - Appel client test
→ Vérifier dans Google Calendar
```

### Test 4 : Auto-création depuis Conversation
```
Client: Je veux un RDV aujourd'hui à 16h pour site web
Bot: ✅ RDV planifié : Site web - 31/05/2026 16h00
     📅 Ajouté à votre Calendar
     📧 Confirmation envoyée
→ Vérifier dans Google Calendar
```

---

## ⚠️ Troubleshooting

### Erreur "Invalid credentials"
**Cause :** `GOOGLE_PRIVATE_KEY` mal formatée

**Solution :**
1. Vérifier que la clé contient bien `-----BEGIN...` et `-----END...`
2. Vérifier les `\n` (newlines) sont présents
3. Render Environment → Supprimer variable → Recréer

### Erreur "Calendar not found"
**Cause :** `GOOGLE_CALENDAR_ID` incorrect

**Solution :**
1. Google Calendar → Paramètres → Copier "ID de l'agenda"
2. Vérifier format : `email@gmail.com` ou `xxxxx@group.calendar.google.com`

### Erreur "Insufficient permissions"
**Cause :** Service Account pas partagé dans Calendar

**Solution :**
1. Google Calendar → Paramètres Calendar principal
2. Partager avec : `kolabot-calendar@...`
3. Permissions : "Apporter des modifications aux événements"

---

## ✅ Checklist Phase 1

**Configuration Google Cloud :**
- [ ] Projet Google Cloud créé
- [ ] Calendar API activée
- [ ] Service Account créé
- [ ] Credentials JSON téléchargé

**Configuration Calendar :**
- [ ] Service Account email copié
- [ ] Calendar partagé avec Service Account
- [ ] Calendar ID copié

**Configuration Render :**
- [ ] GOOGLE_CLIENT_EMAIL ajouté
- [ ] GOOGLE_PRIVATE_KEY ajouté
- [ ] GOOGLE_CALENDAR_ID ajouté
- [ ] Service redéployé

**Code :**
- [ ] Package googleapis installé
- [ ] googleAuth.js créé
- [ ] googleCalendar.js créé
- [ ] Commande !agenda créée
- [ ] Commande !planifier créée
- [ ] Auto-création intégrée

**Tests :**
- [ ] Test auth Google ✅
- [ ] Test lecture Calendar ✅
- [ ] Test création événement ✅
- [ ] Test auto-création conversation ✅

---

**Prochaine étape :** Créer les fichiers de code !

Dites-moi quand vous êtes prêt et on code ensemble ! 🚀
