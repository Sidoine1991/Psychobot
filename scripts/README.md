# PsychoBot Scripts

## Setup & Migration Scripts

### 1. setup-psychobot-rds.py (⭐ Start here!)

**Creates the complete PsychoBot schema in your AWS RDS**

Uses the same `aws_rds_helper.py` from TradBOT

```bash
python scripts/setup-psychobot-rds.py
```

**What it does:**
- ✅ Connects to your existing RDS instance
- ✅ Creates `psychobot` schema
- ✅ Creates 3 tables: applications, stories, job_scores
- ✅ Creates performance indices
- ✅ Sets up auto-update triggers
- ✅ Verifies all tables created successfully

**Output:**
```
🚀 PsychoBot - AWS RDS Schema Setup
============================================================

🔌 Connecting to AWS RDS...
✅ Connected to AWS RDS

📋 Creating psychobot schema...
✅ Schema created

📋 Creating applications table...
✅ applications table created

📋 Creating stories table...
✅ stories table created

📋 Creating job_scores table...
✅ job_scores table created

📋 Creating indices for performance...
   ✅ idx_applications_company
   ✅ idx_applications_status
   ✅ idx_applications_date
   ✅ idx_stories_title
   ✅ idx_job_scores_lookup

📋 Creating updated_at trigger...
✅ Trigger created

🔍 Verifying schema...
   Found 3 tables:
   ✅ applications
   ✅ job_scores
   ✅ stories

📊 Initial state:
   Applications: 0 records
   Stories: 0 records

============================================================
✅ PsychoBot schema setup complete!
============================================================

Next steps:
1. Set USE_RDS=true in .env.production
2. Set RDS_HOST, RDS_USER, RDS_PASSWORD, RDS_DATABASE
3. Deploy to Render
4. Run: node scripts/migrate-to-rds.js (optional, to migrate Markdown data)
```

### 2. migrate-to-rds.js

**Migrates Markdown data → AWS RDS**

```bash
npm install pg
node scripts/migrate-to-rds.js
```

**What it does:**
- ✅ Loads applications from Markdown files
- ✅ Loads stories from Markdown files
- ✅ Inserts all data into RDS
- ✅ Verifies migration success
- ✅ Provides rollback information

**When to run:**
- After `setup-psychobot-rds.py` succeeds
- When you want to migrate existing Markdown data
- Optional if starting fresh

### 3. create-psychobot-schema.sql

**SQL script for manual schema creation**

```bash
psql -h your-rds-endpoint -U admin -d psychobot \
  -f scripts/create-psychobot-schema.sql
```

**When to use:**
- If `setup-psychobot-rds.py` fails
- If you prefer to run SQL directly
- For understanding the schema structure

## Deployment Flow

### Option A: Automated (Recommended)

```bash
# Step 1: Create RDS schema
python scripts/setup-psychobot-rds.py
# ✅ Tables created

# Step 2: Deploy to Render
git push origin main
# ✅ GitHub Actions auto-deploys

# Step 3: Verify
curl https://psychobot-api.onrender.com/api/health
# ✅ API running
```

### Option B: Manual Migration

```bash
# Step 1: Create schema
python scripts/setup-psychobot-rds.py

# Step 2: Migrate data
node scripts/migrate-to-rds.js

# Step 3: Deploy
git push origin main
```

## Environment Variables

Required before running scripts:

### For setup-psychobot-rds.py

Python will use your existing RDS credentials from:
- AWS environment variables
- `.env` file with RDS_* variables
- aws_rds_helper configuration

### For migrate-to-rds.js

```bash
# Create .env.production
NODE_ENV=production
USE_RDS=true
RDS_HOST=your-rds-endpoint.amazonaws.com
RDS_PORT=5432
RDS_DATABASE=psychobot
RDS_USER=admin
RDS_PASSWORD=your-password
```

## Troubleshooting

### setup-psychobot-rds.py fails to import

```bash
# Make sure aws_rds_helper is available
# Check if TradBOT services are accessible

# Fix:
# 1. Verify src/services/aws_rds_helper.py exists
# 2. Check Python path includes src/services
# 3. Ensure dependencies are installed (psycopg2, etc.)
```

### migrate-to-rds.js cannot connect

```bash
# Verify RDS credentials
psql -h your-rds-endpoint -U admin -d psychobot -c "SELECT 1;"

# Fix:
# 1. Double-check RDS_HOST, RDS_USER, RDS_PASSWORD
# 2. Ensure RDS security group allows connection
# 3. Verify schema was created: python scripts/setup-psychobot-rds.py
```

### No data in tables after migration

```bash
# Check if migration ran successfully
node scripts/migrate-to-rds.js

# Verify RDS tables have data
psql -h your-rds-endpoint -U admin -d psychobot \
  -c "SELECT COUNT(*) FROM psychobot.applications;"

# If empty:
# 1. Check if Markdown files exist: ls data/applications/
# 2. Check if stories exist: ls data/interview-prep/
# 3. Re-run migration with debug output
```

## Success Checklist

After running these scripts, verify:

- [ ] `python scripts/setup-psychobot-rds.py` completes with ✅
- [ ] RDS shows 3 tables created
- [ ] `node scripts/migrate-to-rds.js` imports data successfully (if needed)
- [ ] RDS tables have expected record counts
- [ ] `.env.production` has `USE_RDS=true`
- [ ] `git push` triggers GitHub Actions deploy
- [ ] Dashboard loads at https://psychobot.onrender.com
- [ ] API responds at https://psychobot-api.onrender.com/api/health

---

**You're ready for production!** 🚀
