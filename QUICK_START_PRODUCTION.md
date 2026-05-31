# 🚀 Quick Start - Production Deployment

## 5-Minute Setup

### Step 1: Prepare AWS RDS

```bash
# Use your existing TradBOT RDS instance
# OR create new PostgreSQL database

# Connection info:
Host: your-rds-endpoint.amazonaws.com
Port: 5432
Database: psychobot
User: admin
Password: [your-password]
```

### Step 2: Create RDS Schema

```bash
# Install PostgreSQL client
brew install postgresql  # macOS
# or: apt-get install postgresql-client  # Linux

# Connect and create tables
psql -h your-rds-endpoint.amazonaws.com \
  -U admin \
  -d psychobot \
  -f scripts/create-psychobot-schema.sql

# Verify
psql -h your-rds-endpoint.amazonaws.com \
  -U admin \
  -d psychobot \
  -c "SELECT COUNT(*) FROM psychobot.applications;"
```

### Step 3: Setup .env.production

```bash
# Copy template
cp .env.example .env.production

# Edit with your values
nano .env.production
```

```env
NODE_ENV=production
API_PORT=3000

USE_RDS=true
RDS_HOST=your-rds-endpoint.amazonaws.com
RDS_PORT=5432
RDS_DATABASE=psychobot
RDS_USER=admin
RDS_PASSWORD=your-password

REACT_APP_API_URL=https://psychobot-api.onrender.com
CORS_ORIGIN=https://psychobot.onrender.com
```

### Step 4: Migrate Data (Optional)

```bash
# Install pg client
npm install pg

# Run migration
node scripts/migrate-to-rds.js

# Output: ✅ Migration completed successfully!
```

### Step 5: Deploy to Render

#### Option A: Using render.yaml (Recommended)

```bash
# 1. Push to GitHub
git add -A
git commit -m "Production ready"
git push origin main

# 2. Go to https://render.com
# 3. Click "New +" → "Publish from Git"
# 4. Select repo
# 5. Choose "render.yaml"
# 6. Add secrets:
#    - RDS_HOST
#    - RDS_USER
#    - RDS_PASSWORD
# 7. Click "Create"
```

#### Option B: Manual Setup

```
Backend Service:
- Name: psychobot-api
- Environment: Node
- Build: npm install && cd frontend && npm install && npm run build && cd ..
- Start: npm start

Frontend Service (Static):
- Name: psychobot
- Build: cd frontend && npm install && npm run build
- Publish: frontend/build
```

### Step 6: Update Render Secrets

In Render Dashboard:

```
Environment Variables:
- NODE_ENV=production
- USE_RDS=true
- RDS_HOST=your-rds-endpoint.amazonaws.com
- RDS_PORT=5432
- RDS_DATABASE=psychobot
- RDS_USER=admin
- RDS_PASSWORD=[your-password]
- REACT_APP_API_URL=https://psychobot-api.onrender.com
```

### Step 7: Verify Deployment

```bash
# Backend health check
curl https://psychobot-api.onrender.com/api/health

# Expected: {"status":"ok","timestamp":"...","version":"1.0.0"}

# Frontend
Open: https://psychobot.onrender.com
```

## ✅ Deployment Complete!

### What you now have:

- 🌐 **Dashboard:** https://psychobot.onrender.com
- 🔌 **API:** https://psychobot-api.onrender.com
- 💾 **Database:** AWS RDS PostgreSQL
- 📊 **Data:** Auto-synced from Markdown
- ⚡ **Fallback:** Markdown files (if RDS down)
- 🚀 **CI/CD:** GitHub Actions auto-deploy

### Daily Operations:

**From WhatsApp:**
```
!jobs search Python   → Scored via 10-dim system
!track                → Saved to RDS + Markdown
!prep list            → Queries RDS database
```

**From Web:**
- Dashboard: View all data from RDS
- Sync: Auto-refresh every 5 minutes
- Export: Download CSV from RDS

### If RDS Has Issues:

1. Set `USE_RDS=false` in Render
2. Services use Markdown backup
3. Zero downtime
4. All data safe

### Monitoring:

```bash
# Check RDS connection
psql -h your-rds-endpoint.amazonaws.com \
  -U admin \
  -d psychobot \
  -c "SELECT COUNT(*) FROM psychobot.applications;"

# View Render logs
# In Render Dashboard → Logs tab

# Check performance
# In Render Dashboard → Metrics tab
```

## Cost Summary

| Service | Free Tier | Price |
|---------|-----------|-------|
| AWS RDS | ✅ (12 months) | $0 |
| Render Backend | ❌ | $7/month |
| Render Frontend | ✅ | $0 |
| **Total** | | **~$7/month** |

## Rollback

If something breaks:

```bash
# 1. Set USE_RDS=false
# 2. Services revert to Markdown
# 3. Debug RDS issue
# 4. Fix and re-enable

git push  # This triggers new deployment
```

## Next: Automated Updates

Enable GitHub Actions for auto-deploy:

```bash
# 1. Go to GitHub Settings → Secrets
# 2. Add RENDER_DEPLOY_KEY (from Render)
# 3. Push to main → Auto-deploys!
```

---

**Your PsychoBot Dashboard is now LIVE in production!** 🎉

Access it: **https://psychobot.onrender.com**
