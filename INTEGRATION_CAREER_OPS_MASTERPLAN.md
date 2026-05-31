# 🎯 **MASTER PLAN : INTÉGRER CAREER-OPS À PSYCHOBOT**

## 📊 **CE QU'EST CAREER-OPS** 

Un système **COMPLET** de recherche d'emploi construit par Santiago qui a :
- ✅ **Évalué 740+ offres**
- ✅ **Généré 100+ CVs personnalisés**
- ✅ **Déterrer un rôle Head of Applied AI**

C'est un **VRAI SYSTÈME PRODUCTION** avec :
- Multi-agent orchestration
- Scoring A-F sur 10 dimensions
- PDF generation ATS-optimized
- Portal scanning automatique (Greenhouse, Ashby, Lever)
- Interview prep stories
- Negotiation scripts
- Dashboard TUI
- Batch processing

---

## 🔥 **CE QU'ON PEUT PRENDRE POUR PSYCHOBOT**

### **1️⃣ ARCHITECTURE MULTI-AGENT** (Career-Ops)

Career-Ops utilise **15 commandes slash** organisées autour d'une pipeline :

```
/career-ops scan          → Scanner portals (Greenhouse/Ashby/Lever)
/career-ops evaluate      → Évaluer 1 offre (A-F)
/career-ops ofertas       → Comparer plusieurs offres
/career-ops pdf           → Générer CV personnalisé PDF
/career-ops deep          → Recherche profonde entreprise
/career-ops tracker       → Vue pipeline complète
/career-ops apply         → Assistant de candidature LIVE
/career-ops batch         → Process 10+ offres en parallèle
/career-ops patterns      → Analyser patterns de rejection
/career-ops followup      → Tracker follow-up cadence
/career-ops contact       → Trouver contacts LinkedIn + draft
```

**Pour PsychoBot:**
Actuellement vous avez : `!jobs`, `!track`, `!crm`, `!linkedin`, `!export`

Career-Ops a le **framework** pour orchestrer tout ça + plus.

---

### **2️⃣ SCORING SYSTEM** (Career-Ops)

Career-Ops score chaque offre sur **10 dimensions** :

```
1. Role Clarity      → Est-ce que le rôle est défini?
2. CV Match          → Est-ce que tes skills correspondent?
3. Level Strategy    → Est-ce que c'est le bon level de carrière?
4. Comp Research     → Est-ce que la compensation est juste?
5. Personalization   → Est-ce qu'ils veulent TOI spécifiquement?
6. Interview Prep    → Est-ce que tu peux préparer 5-10 stories?
7. Rejection Risk    → Est-ce qu'il y a un pattern de rejection?
8. Growth Potential  → Est-ce que tu vas apprendre?
9. Team Dynamics     → Est-ce que l'équipe va te matcher?
10. Life Integration → Est-ce que ça fit ton lifestyle?

Score final: A/B/C/D/E/F
```

**Vs. PsychoBot maintenant:**
```
Vous avez: Match % basé sur skills (Python, SQL, etc.)
Career-Ops a: Scoring holistique sur 10 dimensions
```

**À voler:** La structure de scoring. Adaptez les 10 dimensions à vos cas d'usage.

---

### **3️⃣ DATA ARCHITECTURE** (Career-Ops)

Career-Ops organise les données en **2 layers** :

```
USER LAYER (jamais auto-updated):
- cv.md                 → Votre CV source
- config/profile.yml    → Votre profil
- modes/_profile.md     → Vos préférences de scoring
- portals.yml           → Les entreprises que vous ciblez

SYSTEM LAYER (peut être auto-updatable):
- modes/_shared.md      → Logique de scoring partagée
- templates/            → Templates
- *.mjs scripts         → Scripts de traitement

CRITICAL RULE: User customizations go to USER LAYER only.
System updates won't overwrite your data.
```

**Pour PsychoBot:**
Actuellement : Tout est un mélange (services + data)

Career-Ops montre comment séparer :
- **User data** (profile, preferences) = mutable
- **System code** (logic, algorithms) = updateable

**À voler:** Cette séparation. Protéger les données utilisateur lors des mises à jour.

---

### **4️⃣ EVALUATION PIPELINE** (Career-Ops)

Career-Ops évalue chaque offre par étapes :

```
ÉTAPE 1: Parse l'offre
  ↓ Extraire: title, company, salary, location, skills, description

ÉTAPE 2: Score sur 10 dimensions
  ↓ Chaque dimension = weighted score (0-100)

ÉTAPE 3: Générer CV personnalisé
  ↓ ATS-optimized PDF + keywords injected

ÉTAPE 4: Créer interview prep
  ↓ STAR+Reflection stories + company intel

ÉTAPE 5: Tracker + follow-up
  ↓ Sauvegarder dans pipeline + set follow-up cadence

ÉTAPE 6: Recommendation
  ↓ A/B/C/D/E/F score → "Should you apply?"
```

**Pour PsychoBot:**
Vous faites :
1. Scrape → 2. Score → 3. Gen letter → 4. Track

Career-Ops montre comment ajouter :
- Interview prep
- Compensation research
- Company deep dive
- Follow-up cadence
- Rejection pattern analysis

---

### **5️⃣ BATCH PROCESSING** (Career-Ops)

Career-Ops peut traiter **10+ offres en parallèle** :

```bash
/career-ops batch

Entrée: 10 URLs
         ↓
    [Agent 1] → Eval offer 1
    [Agent 2] → Eval offer 2
    [Agent 3] → Eval offer 3
    ...
    [Agent N] → Eval offer N (parallel)
         ↓
    Agrégates results
         ↓
    Sort by score
         ↓
    Output: Ranked list + PDFs
```

**Pour PsychoBot:**
Vous faites : 1 offre à la fois via `!jobs search`

Career-Ops montre comment :
- Scraper 10+ offres en une commande
- Les évaluer en parallèle
- Ranger par score
- Générer tous les PDFs

**Impact:** De "5 offres/day" à "50+ offres/day"

---

### **6️⃣ INTERVIEW PREP** (Career-Ops)

Career-Ops accumule une **story bank** :

```
Interview Prep Story Bank:

🔴 STORY 1: Scaling from 1 to 100
   Situation: Had 1 customer...
   Task: Scale to 100 customers...
   Action: Built pipeline + automation...
   Result: 10x growth in 3 months
   Reflection: Learned that automation beats hiring

🔴 STORY 2: Crisis handling
   Situation: Production outage...
   ...

🔴 STORY 3: Cross-team leadership
   ...

Total: 5-10 master stories

When interview happens:
- "Tell me about your biggest failure" → Story 3
- "How do you handle pressure?" → Story 1
- "Describe a time you led cross-team" → Story 2
```

**Pour PsychoBot:**
Vous avez : Letter generation

Career-Ops montre comment ajouter : Interview prep stories

**Implémentation:** Après chaque lettre générée, ask: "What STAR story did you use for this role?" → Accumulate story bank

---

### **7️⃣ FOLLOW-UP CADENCE** (Career-Ops)

Career-Ops calcule automatiquement quand relancer :

```
Application Timeline:
Day 0   → Applied
Day 3   → No response yet
Day 5   → Check liveness (is posting still active?)
Day 7   → Follow-up cadence kicks in
        → If high fit: Reach out on LinkedIn
        → If medium: Wait 3 more days
        → If low: Archive
Day 14  → Second follow-up attempt
Day 21  → Third follow-up or move on
Day 30+ → Auto-archive
```

**Pour PsychoBot:**
Vous avez : `!track` pour tracker les applications

Career-Ops montre comment ajouter : Automatic follow-up suggestions

**Implémentation:** Add to `!track` → "Follow-up suggested: reach out via LinkedIn"

---

## 🎯 **IMPLEMENTATION ROADMAP FOR PSYCHOBOT**

### **Phase 1: STEAL THE SCORING SYSTEM** (Week 1)
```
Current: Match % (Python, SQL, etc)
New: A-F scoring on 10 dimensions (like Career-Ops)

Time: 6-8 hours
Value: 9/10

Implementation:
1. Read Career-Ops modes/*.md scoring logic
2. Adapt 10 dimensions to your use case
3. Update scoreJob() in profileMatcher.js
4. Display A-F in !jobs details
```

---

### **Phase 2: ADD INTERVIEW PREP** (Week 2)
```
New: Story bank accumulation

Time: 4-6 hours
Value: 7/10

Implementation:
1. Create interviewPrepService.js
2. Ask after letter generation: "What STAR story fits this role?"
3. Accumulate in data/interview-prep/story-bank.md
4. On interview, show relevant stories
```

---

### **Phase 3: FOLLOW-UP CADENCE** (Week 2)
```
New: Auto follow-up suggestions

Time: 4-5 hours
Value: 8/10

Implementation:
1. Update jobTracker.js with timeline
2. Calculate follow-up dates
3. Suggest action: "Time to reach out on LinkedIn"
4. Track follow-up history
```

---

### **Phase 4: BATCH EVALUATION** (Week 3)
```
New: Evaluate 10+ offers at once

Time: 6-8 hours
Value: 8/10

Implementation:
1. Extend jobScraper.js to get 50+ offers
2. Parallel evaluation via workers
3. Sort and rank by score
4. Generate all PDFs at once
```

---

### **Phase 5: DEEP RESEARCH** (Week 3)
```
New: Company deep dive + comp research

Time: 8-10 hours
Value: 7/10

Implementation:
1. Create companyResearchService.js
2. Auto-fetch: Glassdoor salary, company size, funding, etc.
3. Generate PDF with research included
4. Show in !jobs deep
```

---

## 📊 **SIDE-BY-SIDE COMPARISON**

| Feature | Career-Ops | PsychoBot Now | PsychoBot After |
|---------|-----------|---------|---------|
| **Offer evaluation** | A-F (10 dims) | % (skills match) | A-F (10 dims) |
| **Scoring dimensions** | 10 | 1-2 | 10 |
| **Interview prep** | Story bank | ❌ | Story bank |
| **Follow-up cadence** | Auto | ❌ | Auto |
| **Company research** | Deep | Basic | Deep |
| **Comp research** | Included | ❌ | Included |
| **Batch processing** | 10+ parallel | 1 at a time | 10+ parallel |
| **PDF generation** | ATS-optimized | Word .docx | ATS-optimized PDF |
| **Portal scanning** | Ashby/Greenhouse/Lever | Indeed/RemoteOK | + Ashby/Greenhouse |
| **Rejection analysis** | Patterns | ❌ | Patterns |
| **Cost** | $0 | $0.02-0.03 | $0.05-0.10 |

---

## 🚀 **NEXT STEP**

**Option A:** Steal Career-Ops' scoring system (Week 1)
- Read the A-F logic
- Implement 10-dimension scoring
- Show A-F instead of %

**Option B:** Start with interview prep (Week 2)
- Accumulate STAR stories
- Show during interview prep

**Option C:** Both (2 weeks)
- Score (Week 1) + Interview prep (Week 2)

**Option D:** Full integration (4 weeks)
- All 5 phases

---

## 📌 **KEY FILES TO READ FROM CAREER-OPS**

| File | Why |
|------|-----|
| `modes/_shared.md` | Scoring logic (10 dimensions) |
| `modes/_profile.md` | User customization pattern |
| `interview-prep/story-bank.md` | Interview prep template |
| `data/follow-ups.md` | Follow-up cadence pattern |
| `CLAUDE.md` | Architecture decisions |
| `DATA_CONTRACT.md` | User vs System layers |

---

## 💡 **PHILOSOPHY**

Career-Ops teaches us: **AI doesn't replace recruiters, it enables candidates.**

For PsychoBot: **AI doesn't replace the job search, it automates the boring parts and surfaces the important ones.**

The scoring system is where the real value is. Once you score offers holistically (not just by keywords), you can:
- Identify which roles are actually worth your time
- Prepare specifically for interviews
- Know when to follow up
- Learn from rejection patterns
- Negotiate smarter

---

**Ready to steal from Career-Ops?** Which phase sounds most valuable to you?

1. Scoring system (A-F)
2. Interview prep (Stories)
3. Follow-up cadence (Auto)
4. Batch processing (10+ offers)
5. Company research (Deep)
