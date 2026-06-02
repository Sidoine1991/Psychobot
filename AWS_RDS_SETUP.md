# AWS RDS Setup for PsychoBot — Phase 1 Execution

**Status:** ✅ Scripts ready to execute
**Created:** 2026-05-29
**Objective:** Create PostgreSQL DB + schema for conversation persistence

---

## 📋 What This Does

Phase 1 of the plan creates:
1. **AWS RDS PostgreSQL instance** — `psychobot-db` (t3.micro, Free Tier)
2. **Database** — `psychobot_prod`
3. **Schema** — 7 tables + 8 indexes + 1 view + retention policies
4. **Configuration** — `.env.rds` with connection credentials

---

## 🚀 Quick Start (3 Steps)

### Step 1: Create RDS Instance

**Option A: PowerShell (Automated)**
```powershell
cd D:\Dev\Depot Github\Psychobot
pwsh .\scripts\setup-aws-rds.ps1
```

**Option B: AWS CLI (Manual)**
```bash
aws rds create-db-instance \
  --db-instance-identifier psychobot-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.3 \
  --master-username psychobot_app \
  --master-user-password <YOUR_SECURE_PASSWORD> \
  --allocated-storage 20 \
  --publicly-accessible false \
  --region us-east-1
```

⏱️ **Wait 5-10 minutes** for instance to be "available"

### Step 2: Get Endpoint & Create .env

```bash
# Get endpoint
aws rds describe-db-instances \
  --db-instance-identifier psychobot-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

Create `.env` in PsychoBot root:
```env
AWS_RDS_HOST=psychobot-db.xxxxx.us-east-1.rds.amazonaws.com
AWS_RDS_PORT=5432
AWS_RDS_DATABASE=psychobot_prod
AWS_RDS_USER=psychobot_app
AWS_RDS_PASSWORD=<YOUR_PASSWORD>
AWS_RDS_SSLMODE=require

USE_AWS_RDS=true
CONVERSATION_RETENTION_DAYS=90
MESSAGE_CACHE_RETENTION_DAYS=7
```

### Step 3: Apply Schema

```bash
cd D:\Dev\Depot Github\Psychobot
npm install pg
node scripts/apply-schema.js
```

Expected output:
```
[INFO] ✅ Connected
[SQL] ✅ Database created
[SQL] ✅ Schema applied successfully
[SQL] ✅ Tables created:
      - business_context
      - contact_profiles
      - conversation_history
      - greeted_contacts
      - message_cache
      - tradbot_interactions
      - system_metadata
```

---

## 📊 Tables Created

| Table | Purpose | Rows | Indexes |
|-------|---------|------|---------|
| **conversation_history** | IA message pairs | Unlimited | 1 |
| **greeted_contacts** | Contact intro cooldown | ~100s | 0 |
| **message_cache** | Antidelete/ViewOnce | ~1000s (auto-cleanup) | 1 |
| **contact_profiles** | Enriched metadata | ~100s | 1 |
| **business_context** | Projects/leads | ~1000s | 2 |
| **tradbot_interactions** | !tradbot logs | ~10000s | 2 |
| **system_metadata** | Version tracking | 2 | 0 |

---

## 🔐 Security

### Network Access
- ❌ Not publicly accessible (by default)
- ✅ Only accessible from EC2/Lambda in same VPC
- ⚠️ For Render deployment, add security group rule for Render IP

### Database Credentials
- 🔐 Store in `.env` (git-ignored)
- 🔐 Never commit credentials
- 🔐 Rotate quarterly

### SSL/TLS
- ✅ SSL required (AWS RDS default)
- ✅ Node.js driver configured with `rejectUnauthorized: false`

---

## 🔍 Verification

After schema is applied, verify:

```sql
-- Connect to database
psql -h <endpoint> -U psychobot_app -d psychobot_prod

-- Check tables
SELECT * FROM information_schema.tables WHERE table_schema = 'public';

-- Check indexes
SELECT * FROM pg_indexes WHERE schemaname = 'public';

-- Check views
SELECT * FROM information_schema.views WHERE table_schema = 'public';

-- Check metadata
SELECT * FROM system_metadata;
```

---

## 🧪 Test Connection from Node.js

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.AWS_RDS_HOST,
  port: 5432,
  database: 'psychobot_prod',
  user: 'psychobot_app',
  password: process.env.AWS_RDS_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Connection failed:', err);
  } else {
    console.log('✅ Connected. Time:', res.rows[0]);
    pool.end();
  }
});
```

---

## 🐛 Troubleshooting

### "Connection refused"
```
❌ RDS not running or endpoint incorrect
✅ Check: aws rds describe-db-instances --db-instance-identifier psychobot-db
```

### "ECONNREFUSED on Render"
```
❌ Render IP not in RDS security group
✅ Add Render IP to RDS SG inbound rule (port 5432)
✅ Or use RDS Proxy for connection pooling
```

### "Password authentication failed"
```
❌ Credentials wrong in .env
✅ Check: User = psychobot_app, DB = psychobot_prod
✅ Test with psql CLI first
```

### "SSL certificate verification failed"
```
❌ SSL issue on Windows
✅ Node.js configured with: ssl: { rejectUnauthorized: false }
✅ Production: use proper cert handling
```

---

## 📝 Files Created

```
D:/Dev/Depot Github/Psychobot/
├── migrations/
│   └── 001_initial_schema.sql      ← Schema DDL
├── scripts/
│   ├── setup-aws-rds.ps1           ← PowerShell automation
│   └── apply-schema.js             ← Node.js schema applier
└── AWS_RDS_SETUP.md                ← This guide
```

---

## 🔄 Phase 2: Integration with PsychoBot

After Phase 1 (schema), Phase 2 integrates RDS:

1. **database-rds.js** — Create Node.js module
2. **src/services/ai.js** — Replace RAM with RDS
3. **index.js** — Use RDS for message cache
4. **Deploy** to Render with RDS endpoint

See `..\..\D:\Dev\TradBOT\composed-painting-dongarra.md` for full Phase 2 plan.

---

## 🚨 Important Notes

⚠️ **This creates a LIVE AWS RDS instance:**
- ✅ Free Tier eligible (12 months, t3.micro)
- ✅ ~$15/month after Free Tier expires
- ⚠️ DELETE manually when done testing
- ⚠️ Monitor AWS billing

To DELETE the instance:
```bash
aws rds delete-db-instance \
  --db-instance-identifier psychobot-db \
  --skip-final-snapshot \
  --region us-east-1
```

---

## ✅ Checklist

- [ ] AWS credentials configured (`~/.aws/credentials`)
- [ ] AWS CLI installed and working
- [ ] PowerShell 7+ or bash available
- [ ] Node.js 18+ installed (`node --version`)
- [ ] `npm install pg` will work (has npm)
- [ ] Ready to run: `pwsh .\scripts\setup-aws-rds.ps1`
- [ ] Saved credentials in `.env` (git-ignored)
- [ ] Verified schema with `node scripts/apply-schema.js`
- [ ] Added RDS endpoint to Render/Docker `.env` files
- [ ] Ready for Phase 2 (database-rds.js integration)

---

## 📞 Support

If setup fails:
1. Check AWS credentials: `aws sts get-caller-identity`
2. Check RDS status: `aws rds describe-db-instances`
3. Check schema file exists: `ls migrations/001_initial_schema.sql`
4. Try manual DB connection: `psql -h <endpoint> -U psychobot_app`

Next: Phase 2 — Integrate RDS with PsychoBot service layer.
