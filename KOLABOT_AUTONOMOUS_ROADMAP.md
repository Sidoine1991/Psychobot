# 🤖 KolaBoT Autonomous Agent - Roadmap Complet

**Date début :** 2026-05-31  
**Objectif :** Transformer KolaBoT en assistant personnel autonome avec accès Google Workspace

---

## 🎯 Vision Finale

KolaBoT pourra :
- ✅ Répondre aux messages WhatsApp (FAIT)
- 📅 Créer/gérer événements Google Calendar
- 👥 Chercher/ajouter contacts Google
- 📧 Envoyer emails Gmail
- 🎯 Prospecter de manière autonome
- 📊 Générer rapports automatiques
- ⏰ Follow-ups et rappels automatiques

---

## 📦 Architecture Technique

```
psychobot/
├── src/
│   ├── services/
│   │   ├── audioProcessor.js          (✅ FAIT)
│   │   ├── ai.js                      (✅ FAIT)
│   │   ├── googleCalendar.js          (🔄 PHASE 1)
│   │   ├── googleContacts.js          (🔄 PHASE 2)
│   │   ├── gmail.js                   (🔄 PHASE 2)
│   │   ├── prospection.js             (🔄 PHASE 3)
│   │   ├── reporting.js               (🔄 PHASE 4)
│   │   └── autonomousEngine.js        (🔄 PHASE 4)
│   ├── commands/
│   │   ├── agenda.js                  (🔄 PHASE 1)
│   │   ├── planifier.js               (🔄 PHASE 1)
│   │   ├── contact.js                 (🔄 PHASE 2)
│   │   ├── email.js                   (🔄 PHASE 2)
│   │   ├── prospecter.js              (🔄 PHASE 3)
│   │   └── rapport.js                 (🔄 PHASE 4)
│   └── integrations/
│       └── googleAuth.js              (🔄 PHASE 1)
├── data/
│   ├── prospects/                     (🔄 PHASE 3)
│   ├── logs/                          (🔄 PHASE 4)
│   └── reports/                       (🔄 PHASE 4)
└── config/
    └── google-credentials.json        (🔄 PHASE 1)
```

---

## 🔧 Phase 1 : Google Calendar Integration (2-3 jours)

### Objectifs
- ✅ Authentification Google OAuth 2.0
- ✅ Lire calendrier du jour
- ✅ Créer événements automatiquement
- ✅ Proposer créneaux disponibles
- ✅ Envoyer confirmations WhatsApp

### Fichiers à Créer
1. `src/integrations/googleAuth.js` - Authentification Google
2. `src/services/googleCalendar.js` - API Calendar
3. `src/commands/agenda.js` - Commande `/agenda`
4. `src/commands/planifier.js` - Commande `/planifier`

### Configuration Requise
1. **Google Cloud Console**
   - Créer projet "KolaBoT-Agent"
   - Activer Calendar API
   - Créer Service Account
   - Télécharger credentials.json

2. **Permissions Calendar**
   - Déléguer accès à Service Account
   - Scope : `https://www.googleapis.com/auth/calendar`

3. **Variables Environnement Render**
   - `GOOGLE_CLIENT_EMAIL` (Service Account)
   - `GOOGLE_PRIVATE_KEY` (Service Account Key)
   - `GOOGLE_CALENDAR_ID` (ID Calendar principal)

### Tests Phase 1
```
Test 1: Lire calendrier
User: "!agenda"
Bot: "📅 Agenda du 31/05/2026:
      16h00 - Site web restaurant (Kolaole)
      18h00 - Réunion équipe"

Test 2: Créer événement
User: "!planifier demain 10h Appel client X"
Bot: "✅ Événement créé : 01/06/2026 10h - Appel client X"

Test 3: Auto-création via conversation
User: "Je veux un RDV aujourd'hui à 16h"
Bot: "✅ RDV planifié : Site web restaurant - 31/05 16h"
→ Événement créé automatiquement dans Calendar
```

### Durée Estimée : 2-3 jours
- Jour 1 : Setup Google Cloud + Auth
- Jour 2 : Intégration Calendar API + Tests
- Jour 3 : Auto-création depuis conversations + Polish

---

## 🔧 Phase 2 : Google Contacts + Gmail (2-3 jours)

### Objectifs
- ✅ Chercher contacts Google
- ✅ Ajouter nouveaux contacts
- ✅ Envoyer emails Gmail
- ✅ Enrichir conversations avec infos contact

### Fichiers à Créer
1. `src/services/googleContacts.js` - API Contacts
2. `src/services/gmail.js` - API Gmail
3. `src/commands/contact.js` - Commande `/contact`
4. `src/commands/email.js` - Commande `/email`

### Configuration Requise
1. **Google Cloud Console**
   - Activer People API (Contacts)
   - Activer Gmail API
   - Ajouter scopes OAuth

2. **Scopes Additionnels**
   - `https://www.googleapis.com/auth/contacts`
   - `https://www.googleapis.com/auth/gmail.send`

### Tests Phase 2
```
Test 1: Chercher contact
User: "!contact Kolaole"
Bot: "👤 Kolaole
      📱 +22964052710
      🏢 Restaurant
      📅 Dernier contact: 31/05/2026"

Test 2: Envoyer email
User: "!email kolaole@example.com Confirmation RDV Votre RDV est confirmé..."
Bot: "✅ Email envoyé à kolaole@example.com"

Test 3: Auto-ajout contact
User reçoit message d'un nouveau numéro
Bot: "👤 Nouveau contact détecté: +22964052710
      💾 Voulez-vous l'ajouter à vos contacts?"
User: "Oui, nom: Kolaole, entreprise: Restaurant"
Bot: "✅ Contact ajouté à Google Contacts"
```

### Durée Estimée : 2-3 jours
- Jour 1 : Intégration Contacts API
- Jour 2 : Intégration Gmail API
- Jour 3 : Auto-enrichissement conversations + Tests

---

## 🔧 Phase 3 : Prospection Autonome (3-5 jours)

### Objectifs
- ✅ Upload liste prospects (CSV/Sheets)
- ✅ Envoi messages personnalisés automatiques
- ✅ Tracking réponses et qualification leads
- ✅ Follow-ups automatiques programmés
- ✅ Logs activité prospection

### Fichiers à Créer
1. `src/services/prospection.js` - Engine prospection
2. `src/services/leadScoring.js` - Qualification leads
3. `src/commands/prospecter.js` - Commande `/prospecter`
4. `src/commands/leads.js` - Commande `/leads`
5. `data/prospects/template-message.json` - Templates

### Architecture Prospection
```
┌─────────────────────────────────────┐
│       Prospection Engine            │
├─────────────────────────────────────┤
│                                     │
│  1. Import Prospects (CSV/Sheets)   │
│     ↓                               │
│  2. Queue (50 max/jour)             │
│     ↓                               │
│  3. Personnalisation Messages       │
│     ↓                               │
│  4. Envoi (1 msg/30-60 sec)         │
│     ↓                               │
│  5. Tracking Réponses               │
│     ↓                               │
│  6. Scoring Leads (chaud/tiède/froid)│
│     ↓                               │
│  7. Follow-ups Automatiques         │
│     ↓                               │
│  8. Logs Google Sheets              │
│                                     │
└─────────────────────────────────────┘
```

### Configuration Requise
1. **Google Sheets API**
   - Activer Sheets API
   - Sheet "Prospects" (lecture)
   - Sheet "Logs Prospection" (écriture)

2. **Supabase (Alternative)**
   - Table `prospects`
   - Table `lead_interactions`
   - Table `prospection_campaigns`

3. **Variables Environnement**
   - `GOOGLE_SHEETS_ID_PROSPECTS` (Sheet prospects)
   - `GOOGLE_SHEETS_ID_LOGS` (Sheet logs)
   - `PROSPECTION_MAX_PER_DAY` (défaut: 50)
   - `PROSPECTION_DELAY_SEC` (défaut: 45)

### Templates Messages
```json
{
  "templates": {
    "initial_contact": {
      "fr": "Bonjour {nom} ! 👋 Je suis l'assistant de Sidoine. J'ai vu que vous travaillez dans {secteur}. Sidoine aide des professionnels comme vous avec {service}. Seriez-vous intéressé par un échange rapide ? 😊",
      "variables": ["nom", "secteur", "service"]
    },
    "follow_up_1": {
      "fr": "Bonjour {nom} ! 🙏 Je reviens vers vous concernant {sujet}. Avez-vous eu le temps d'y réfléchir ?",
      "delay_days": 2
    },
    "follow_up_2": {
      "fr": "Dernier message {nom} 😊 Si le timing n'est pas bon, pas de souci ! Je vous laisse mes coordonnées au cas où : {contact}",
      "delay_days": 5
    }
  }
}
```

### Lead Scoring
```javascript
Score = 0-100 basé sur:
- Réponse dans 1h : +40 pts
- Réponse dans 24h : +20 pts
- Questions posées : +15 pts/question
- Demande RDV : +30 pts
- Partage coordonnées : +25 pts
- Message > 50 mots : +10 pts

Catégories:
- 🔥 Chaud (80-100) : Priorité immédiate
- 🟡 Tiède (50-79) : Follow-up J+2
- ❄️ Froid (0-49) : Follow-up J+7
```

### Tests Phase 3
```
Test 1: Import prospects
User: "!prospecter import prospects-restaurants.csv"
Bot: "📊 Import réussi: 25 prospects
      🎯 Campagne lancée: Restaurants Q2 2026
      ⏰ Durée estimée: 1-2 jours (50 msg/jour max)"

Test 2: Status campagne
User: "!leads status"
Bot: "📊 Campagne: Restaurants Q2 2026
      📤 Envoyés: 15/25 (60%)
      💬 Réponses: 5 (33%)
      🔥 Chauds: 2
      🟡 Tièdes: 3
      ⏰ Prochain envoi: dans 45 min"

Test 3: Qualification automatique
Prospect: "Oui je suis intéressé ! Quand peut-on se parler ?"
Bot (interne): "🔥 Lead CHAUD détecté: +22964052710
                Score: 85/100
                Action: Notification Sidoine + Proposition créneaux"
Bot (à prospect): "Super ! Sidoine peut vous appeler demain 10h ou 14h ?"
```

### Durée Estimée : 3-5 jours
- Jour 1 : Architecture prospection engine
- Jour 2 : Import CSV/Sheets + Queue
- Jour 3 : Envoi personnalisé + Tracking
- Jour 4 : Lead scoring + Follow-ups
- Jour 5 : Tests complets + Sécurité anti-spam

---

## 🔧 Phase 4 : Rapports & Intelligence (2-3 jours)

### Objectifs
- ✅ Logs structurés (toutes interactions)
- ✅ Rapports quotidiens automatiques (18h)
- ✅ Rapports hebdomadaires (Lundi 8h)
- ✅ Dashboard analytics en temps réel
- ✅ Alertes intelligentes

### Fichiers à Créer
1. `src/services/reporting.js` - Générateur rapports
2. `src/services/analytics.js` - Analytics engine
3. `src/services/autonomousEngine.js` - Orchestrateur
4. `src/commands/rapport.js` - Commande `/rapport`

### Architecture Reporting
```
┌─────────────────────────────────────┐
│       Reporting Engine              │
├─────────────────────────────────────┤
│                                     │
│  Data Sources:                      │
│  • Conversation logs (SQLite)       │
│  • Calendar events (Google)         │
│  • Prospection logs (Sheets)        │
│  • Contact interactions (Google)    │
│                                     │
│  Reports Generated:                 │
│  • Daily Summary (18h)              │
│  • Weekly Digest (Lundi 8h)         │
│  • Campaign Performance             │
│  • Lead Funnel Analytics            │
│                                     │
│  Delivery:                          │
│  • WhatsApp message                 │
│  • Email (optionnel)                │
│  • Google Sheets (historique)       │
│                                     │
└─────────────────────────────────────┘
```

### Configuration Requise
1. **Cron Jobs Render**
   - Daily: 18h00 UTC (rapport quotidien)
   - Weekly: Lundi 8h00 UTC (rapport hebdo)
   - Hourly: Check rappels + follow-ups

2. **Google Sheets Logs**
   - Sheet "Interactions" (toutes conversations)
   - Sheet "Events" (Calendar events créés)
   - Sheet "Prospection" (campagnes)
   - Sheet "Reports" (rapports historiques)

3. **Variables Environnement**
   - `REPORT_DAILY_TIME` (défaut: 18:00)
   - `REPORT_WEEKLY_DAY` (défaut: Monday)
   - `REPORT_SEND_EMAIL` (true/false)

### Template Rapport Quotidien
```
📊 Rapport Quotidien KolaBoT - 31/05/2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 Conversations
   • Total: 12 conversations
   • Nouveaux contacts: 3
   • Temps moyen réponse: 45 sec

📅 Agenda
   • RDV créés: 3
   • RDV confirmés: 3/3 (100%)
   • Prochains RDV: 2 (demain)

🎯 Prospection
   • Messages envoyés: 15
   • Taux réponse: 33% (5/15)
   • Leads chauds: 2 🔥
   • Leads tièdes: 3 🟡

📧 Communications
   • Emails envoyés: 5
   • Confirmations RDV: 3
   • Follow-ups: 2

🏆 Top Interactions
   1. Kolaole - Restaurant (RDV 16h) 🔥
   2. Marie D. - E-commerce (Follow-up J+2)
   3. Jean P. - Tech (Attente réponse)

⏰ Actions à Venir
   • 16h00 - RDV Site web restaurant (Kolaole)
   • 19h00 - Follow-up prospect Marie D.
   • 22h00 - Rappel RDV demain 10h

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 KolaBoT - Assistant Autonome de Sidoine
```

### Alertes Intelligentes
```javascript
Alertes automatiques:

1. Lead chaud détecté
   → Notification immédiate Sidoine
   → Proposition créneaux automatique

2. RDV dans 1h
   → Rappel Sidoine
   → Confirmation client

3. Taux réponse prospection < 20%
   → Alerte qualité messages
   → Suggestion amélioration

4. Contact inactif > 7 jours
   → Proposition follow-up automatique

5. Objectif journalier atteint
   → Célébration 🎉
```

### Tests Phase 4
```
Test 1: Rapport manuel
User: "!rapport aujourd'hui"
Bot: [Envoie rapport quotidien immédiat]

Test 2: Rapport période
User: "!rapport semaine"
Bot: [Envoie rapport hebdomadaire]

Test 3: Rapport automatique 18h
Bot (à 18h): "📊 Rapport Quotidien - 31/05/2026
              💬 12 conversations | 📅 3 RDV | 🎯 15 prospects
              [Détails complets...]"

Test 4: Alerte lead chaud
Prospect répond: "Oui intéressé, appelez-moi vite!"
Bot (à Sidoine): "🔥 LEAD CHAUD: +22964052710
                  Message: [...]
                  Score: 95/100
                  Action: Appel recommandé maintenant"
```

### Durée Estimée : 2-3 jours
- Jour 1 : Architecture logs + Reporting engine
- Jour 2 : Templates rapports + Cron jobs
- Jour 3 : Alertes intelligentes + Tests + Polish

---

## 📊 Timeline Global

```
Semaine 1 (31/05 - 06/06):
├─ Jour 1-3: Phase 1 - Google Calendar ✅
└─ Jour 4-6: Phase 2 - Contacts + Gmail ✅

Semaine 2 (07/06 - 13/06):
├─ Jour 1-5: Phase 3 - Prospection Autonome ✅
└─ Jour 6-7: Tests intégration Phase 3

Semaine 3 (14/06 - 20/06):
├─ Jour 1-3: Phase 4 - Rapports + Intelligence ✅
├─ Jour 4-5: Tests complets 4 phases
└─ Jour 6-7: Polish + Documentation finale
```

**Durée totale : 2-3 semaines**

---

## ✅ Checklist Avant Lancement

### Configuration Google
- [ ] Projet Google Cloud créé
- [ ] APIs activées (Calendar, Contacts, Gmail, Sheets)
- [ ] Service Account créé + credentials
- [ ] OAuth 2.0 configuré
- [ ] Permissions Calendar/Contacts/Gmail accordées

### Configuration Render
- [ ] Variables environnement Google ajoutées
- [ ] Cron jobs configurés (rapports)
- [ ] Logs activés
- [ ] Monitoring configuré

### Tests Phase par Phase
- [ ] Phase 1 : Création événement Calendar ✅
- [ ] Phase 2 : Envoi email Gmail ✅
- [ ] Phase 3 : Prospection 10 contacts test ✅
- [ ] Phase 4 : Rapport quotidien généré ✅

### Sécurité & Conformité
- [ ] Respect limites WhatsApp (50 msg/jour max)
- [ ] Opt-out implémenté pour prospects
- [ ] Logs RGPD-compliant
- [ ] Credentials sécurisés (variables env, pas code)

---

## 🎯 KPIs de Succès

### Performance Technique
- ✅ Uptime > 99%
- ✅ Temps réponse < 2 sec
- ✅ Taux erreur < 1%

### Performance Business
- ✅ Taux réponse prospection > 25%
- ✅ Leads chauds > 5/semaine
- ✅ RDV automatiques > 10/semaine
- ✅ Satisfaction utilisateurs > 4.5/5

---

## 📞 Support & Maintenance

**Monitoring quotidien :**
- Check logs erreurs (Render Dashboard)
- Vérifier rapports quotidiens reçus
- Valider prospection en cours

**Maintenance hebdomadaire :**
- Review lead scoring accuracy
- Optimiser templates messages
- Update AI prompts si besoin

**Améliorations continues :**
- Collecter feedback Sidoine
- Analyser taux conversion
- Ajouter nouvelles fonctionnalités

---

**Créé le :** 2026-05-31  
**Auteur :** Claude Code + Sidoine  
**Version :** 1.0.0
