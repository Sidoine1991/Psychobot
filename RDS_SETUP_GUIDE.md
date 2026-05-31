# PsychoBot RDS Setup Guide

## Prerequisites

1. **AWS Account** with RDS access
2. **PostgreSQL RDS Instance** created (same as TradBOT if available)
3. **Python 3.8+** with psycopg2 installed
4. **TradBOT Credentials** (if using existing RDS instance)

## Step 1: Get RDS Credentials

### Option A: Create New RDS Instance
1. Go to **AWS RDS Console**
2. Click **Create Database** → **PostgreSQL**
3. Configure:
   - **DB Identifier**: `psychobot-prod`
   - **Master Username**: `psych_admin`
   - **Master Password**: Use AWS Secrets Manager
   - **Database Name**: `psychobot`
   - **Public Accessibility**: Yes (for initial setup)
4. Wait for instance to be available (10-15 min)
5. Note the **Endpoint** URL (e.g., `psychobot-prod.c9akciq32.us-east-1.rds.amazonaws.com`)

### Option B: Use Existing TradBOT RDS
If TradBOT already has an RDS instance:
1. Find credentials in TradBOT environment or AWS console
2. Create new database schema for PsychoBot (next step)

## Step 2: Set Environment Variables

### Method 1: Local Setup (Development)

```bash
# Linux/macOS
export AWS_RDS_HOST="your-rds-host.c9akciq32.us-east-1.rds.amazonaws.com"
export AWS_RDS_PORT=5432
export AWS_RDS_DATABASE=psychobot
export AWS_RDS_USER=psych_admin
export AWS_RDS_PASSWORD="your-secure-password"

# Windows PowerShell
$env:AWS_RDS_HOST="your-rds-host..."
$env:AWS_RDS_PORT="5432"
$env:AWS_RDS_DATABASE="psychobot"
$env:AWS_RDS_USER="psych_admin"
$env:AWS_RDS_PASSWORD="your-secure-password"
```

### Method 2: .env.production File

Edit `D:/Dev/Depot Github/Psychobot/.env.production`:

```env
AWS_RDS_HOST=your-rds-host.c9akciq32.us-east-1.rds.amazonaws.com
AWS_RDS_PORT=5432
AWS_RDS_DATABASE=psychobot
AWS_RDS_USER=psych_admin
AWS_RDS_PASSWORD=your-secure-password-here
AWS_RDS_SSLMODE=require
```

## Step 3: Run Schema Setup

```bash
cd D:/Dev/Depot\ Github/Psychobot

# Install dependencies
pip install psycopg2-binary python-dotenv

# Run schema creation
python scripts/setup-psychobot-rds.py
```

### Expected Output

```
============================================================
[SETUP] PsychoBot - AWS RDS Schema Setup
============================================================

Target: your-rds-host.c9akciq32.us-east-1.rds.amazonaws.com:5432/psychobot
User: psych_admin

[INFO] Connecting to AWS RDS...
[OK] Connected to AWS RDS

[INFO] Creating psychobot schema...
[OK] Schema created

[INFO] Creating applications table...
[OK] applications table created

[INFO] Creating stories table...
[OK] stories table created

[INFO] Creating job_scores table...
[OK] job_scores table created

[INFO] Creating indices for performance...
   [OK] idx_applications_company
   [OK] idx_applications_status
   [OK] idx_applications_date
   [OK] idx_stories_title
   [OK] idx_job_scores_lookup

[INFO] Creating updated_at trigger...
[OK] Trigger created

[INFO] Verifying schema...
   Found 3 tables:
   [OK] applications
   [OK] job_scores
   [OK] stories

[INFO] Initial state:
   Applications: 0 records
   Stories: 0 records

============================================================
[SUCCESS] PsychoBot schema setup complete!
============================================================
```

## Step 4: Verify Connection

```bash
# Test from Node.js backend
npm test

# Or manually query
psql -h your-rds-host.c9akciq32.us-east-1.rds.amazonaws.com \
     -U psych_admin \
     -d psychobot \
     -c "SELECT * FROM psychobot.applications LIMIT 1;"
```

## Step 5: Deploy to Render

1. **Backend Deployment**:
   - Push code to GitHub
   - Connect GitHub repo to Render
   - Add environment variables in Render dashboard
   - Deploy

2. **Frontend Deployment**:
   - Build React app: `npm run build`
   - Deploy static site to Render

3. **Verify**:
   ```bash
   curl https://psychobot-api.onrender.com/api/jobs/search?q=engineer
   ```

## Step 6: Optional - Migrate Markdown Data

If you have existing job tracking data in Markdown:

```bash
# This converts Markdown files to RDS
node scripts/migrate-to-rds.js
```

## Troubleshooting

### Connection Refused
- Verify RDS is public accessible
- Check security group allows port 5432 from your IP
- Verify credentials are correct

### Schema Already Exists
- Safe to re-run - script uses `CREATE ... IF NOT EXISTS`
- Or drop schema first: `psql -c "DROP SCHEMA IF EXISTS psychobot CASCADE;"`

### SSL Error
- Add to connection string: `sslmode=require`
- Download RDS CA certificate if needed

### Credentials Not Found
```bash
# Check environment
echo $AWS_RDS_HOST
echo $AWS_RDS_USER

# Or verify .env.production
cat .env.production | grep AWS_RDS
```

## Security Best Practices

1. **Never commit credentials** - use `.env.production` in `.gitignore`
2. **Use AWS Secrets Manager** for production passwords
3. **Rotate credentials** every 90 days
4. **Enable SSL** for RDS connections (`sslmode=require`)
5. **Restrict security group** to Render IP addresses only
6. **Enable RDS backups** in AWS console

## Next Steps

- [ ] Verify RDS connectivity
- [ ] Run schema setup script
- [ ] Deploy backend to Render
- [ ] Deploy frontend to Render
- [ ] Test API endpoints
- [ ] Monitor logs and performance
