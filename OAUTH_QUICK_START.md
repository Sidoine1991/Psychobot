# 🚀 OAuth 2.0 Quick Start - Configuration Rapide

## ✅ VOUS AVEZ DÉJÀ :

- ✅ **OAuth 2.0 Client ID** créé dans Google Cloud Console
- ✅ **Client Secret** disponible
- ✅ **Fichier JSON** téléchargé

📄 **Les credentials complets sont dans le fichier local** `.env.oauth`  
⚠️ **Ne commitez JAMAIS ce fichier** (déjà dans `.gitignore`)

---

## 📋 ÉTAPE 1 : Quelle est votre URL Render ?

**Trouvez votre URL Render** :
1. Allez sur https://dashboard.render.com
2. Cliquez sur votre service `psychobot-v2` (ou nom similaire)
3. En haut, vous verrez l'URL : `https://XXXXX.onrender.com`

**Exemple** :
```
https://psychobot-v2-abc123.onrender.com
```

📝 **Notez cette URL complète** (on en a besoin pour les étapes suivantes)

---

## 📋 ÉTAPE 2 : Mettre à Jour Google Cloud Console

### 2.1 Ouvrir les Credentials

https://console.cloud.google.com/apis/credentials

### 2.2 Modifier OAuth Client

1. **Trouvez** : `KolaBoT Gmail OAuth` dans la liste
2. **Cliquez** sur le nom
3. **Authorized redirect URIs** → **ADD URI**
4. **Collez** :
   ```
   https://VOTRE-URL-RENDER.onrender.com/oauth/callback
   ```
   ⚠️ **Remplacez** `VOTRE-URL-RENDER` par votre vraie URL !

**Exemple concret** :
```
https://psychobot-v2-abc123.onrender.com/oauth/callback
```

5. **Cliquez** : **SAVE**

---

## 📋 ÉTAPE 3 : Configurer Test Users (Très Important !)

### 3.1 OAuth Consent Screen

https://console.cloud.google.com/apis/credentials/consent

### 3.2 Test Users Section

1. **Scrollez** jusqu'à "Test users"
2. **Cliquez** : **+ ADD USERS**
3. **Entrez votre email Gmail** : `syebadokpo@gmail.com`
4. **Cliquez** : **SAVE**

⚠️ **Sans cette étape, vous ne pourrez pas autoriser l'app !**

---

## 📋 ÉTAPE 4 : Copier Variables dans Render

### 4.1 Ouvrir Render Environment

https://dashboard.render.com → Votre Service → **Environment**

### 4.2 Ajouter 4 Variables

Cliquez **Add Environment Variable** pour chaque :

#### **Variable 1 : GOOGLE_OAUTH_CLIENT_ID**

Copiez depuis votre fichier `.env.oauth` local  
Format: `XXXXX-XXXXX.apps.googleusercontent.com`

#### **Variable 2 : GOOGLE_OAUTH_CLIENT_SECRET**

Copiez depuis votre fichier `.env.oauth` local  
Format: `GOCSPX-XXXXX`

#### **Variable 3 : GOOGLE_OAUTH_REDIRECT_URI**
```
https://VOTRE-URL-RENDER.onrender.com/oauth/callback
```
⚠️ **Remplacez** `VOTRE-URL-RENDER` par votre vraie URL Render !

#### **Variable 4 : RENDER_EXTERNAL_URL**
```
https://VOTRE-URL-RENDER.onrender.com
```
⚠️ **Remplacez** `VOTRE-URL-RENDER` par votre vraie URL Render !

### 4.3 Save Changes

**Cliquez** : **Save Changes**

→ Render va **redéployer automatiquement** (1-2 minutes)

---

## 📋 ÉTAPE 5 : Autoriser Gmail (Sur WhatsApp)

### 5.1 Attendez le Redéploiement

Vérifiez que Render affiche : **"Live"** (vert)

### 5.2 Envoyez sur WhatsApp

```
!authorize
```

### 5.3 Cliquez le Lien

KolaBoT vous envoie un lien comme :
```
https://votre-app.onrender.com/oauth/authorize
```

**Cliquez dessus** dans votre navigateur

### 5.4 Page KolaBoT

Vous verrez une page avec :
- 🤖 KolaBoT Gmail Authorization
- Liste des permissions
- Bouton **🔐 Autoriser l'accès Gmail**

**Cliquez** sur le bouton

### 5.5 Page Google

1. **Sélectionnez** votre compte Gmail (`syebadokpo@gmail.com`)
2. **Lisez** les permissions demandées :
   - ✉️ Lire emails
   - 📤 Envoyer emails
   - 🔍 Rechercher
   - 📇 Contacts
3. **Cliquez** : **Continuer** (ou **Allow**)

### 5.6 Confirmation

Si succès, vous verrez :
```
✅ Autorisation Réussie!
🎉 KolaBoT a maintenant accès à votre Gmail!
```

**Fermez la page**, c'est fini !

---

## 🧪 ÉTAPE 6 : Tester

### Test 1 : Statut
```
!gmailstatus
```

**Résultat attendu** :
```
✅ Autorisé
🔑 Access Token: Présent
⏰ Expire le: ...
```

### Test 2 : Inbox
```
!inbox
```

**Résultat attendu** : Liste de vos 5 derniers emails

### Test 3 : Recherche
```
!search subject:test
```

### Test 4 : Envoyer Email
```
!send syebadokpo@gmail.com | Test KolaBoT | Ceci est un test depuis WhatsApp via OAuth 2.0
```

**Vérifiez** : Email reçu dans votre boîte !

---

## 🎯 RÉSUMÉ - CHECKLIST

- [ ] **1.** Trouvé URL Render (https://xxxxx.onrender.com)
- [ ] **2.** Ajouté redirect URI dans Google Cloud Console
- [ ] **3.** Ajouté email dans Test Users
- [ ] **4.** Copié 4 variables dans Render Environment
- [ ] **5.** Render a redéployé (statut "Live")
- [ ] **6.** Envoyé `!authorize` sur WhatsApp
- [ ] **7.** Cliqué lien → Autorisé sur Google
- [ ] **8.** Vu "✅ Autorisation Réussie!"
- [ ] **9.** Testé `!gmailstatus` → ✅ Autorisé
- [ ] **10.** Testé `!inbox` → Emails affichés

---

## 🆘 Problèmes Courants

### ❌ "redirect_uri_mismatch"

**Cause** : L'URI ne correspond pas

**Solution** :
1. Vérifiez l'URI dans Google Cloud Console (doit finir par `/oauth/callback`)
2. Vérifiez `GOOGLE_OAUTH_REDIRECT_URI` dans Render
3. Les deux doivent être **IDENTIQUES**

### ❌ "Access blocked: KolaBoT has not completed verification"

**Cause** : Votre email n'est pas dans Test Users

**Solution** :
1. Google Cloud Console → OAuth consent screen
2. Test users → **ADD USERS**
3. Ajoutez `syebadokpo@gmail.com`

### ❌ Page blanche après autorisation

**Cause** : Render n'a pas fini de déployer

**Solution** :
1. Attendez 1-2 minutes
2. Vérifiez Render Dashboard → Statut "Live" ?
3. Réessayez `!authorize`

---

## ✅ TOUT FONCTIONNE ?

**Si oui** → Gmail est maintenant connecté ! 🎉

**Prochaine étape** : Phase 3 - Prospection Autonome

**Si problème** → Vérifiez la checklist ci-dessus et les logs Render
