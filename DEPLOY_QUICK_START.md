# PsychoBot Production Quick Start

**Deploy PsychoBot to production in 30 minutes.**

## 5-Minute Prerequisites

1. **AWS RDS Instance**
   - Create PostgreSQL 14+ instance
   - Get: hostname, port, username, password

2. **Render Account**
   - Sign up at render.com
   - Connect GitHub repository

3. **Environment Ready**
   - Node.js 18+
   - Python 3.8+ with psycopg2
   - Git configured

## Step 1: Configure RDS (5 min)

### Set Environment Variables

**PowerShell:**
```powershell
$env:AWS_RDS_HOST = "your-instance.c9akciq32.us-east-1.rds.amazonaws.com"
$env:AWS_RDS_PORT = "5432"
$env:AWS_RDS_DATABASE = "psychobot"
$env:AWS_RDS_USER = "psych_admin"
$env:AWS_RDS_PASSWORD = "your-secure-password"
$env:AWS_RDS_SSLMODE = "require"
```

**Bash/Mac:**
```bash
export AWS_RDS_HOST="your-instance.c9akciq32.us-east-1.rds.amazonaws.com"
export AWS_RDS_PORT="5432"
export AWS_RDS_DATABASE="psychobot"
export AWS_RDS_USER="psych_admin"
export AWS_RDS_PASSWORD="your-secure-password"
export AWS_RDS_SSLMODE="require"
```

### Create Database Schema

```bash
cd D:/Dev/Depot\ Github/Psychobot
python scripts/setup-psychobot-rds.py
```

Expected output:
```
[SUCCESS] PsychoBot schema setup complete!
```

## Step 2: Build & Test (5 min)

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build both backend and frontend
npm run build
npm run build:frontend
```

All should pass with 0 errors.

## Step 3: Deploy Backend (5 min)

### Create Render Service

1. Go to **render.com** → Create New → Web Service
2. Select your GitHub repository
3. Configure:
   - **Name**: `psychobot-api`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
4. Add Environment Variables:
   ```
   NODE_ENV=production
   API_PORT=3000
   USE_RDS=true
   AWS_RDS_HOST=your-instance.c9akciq32.us-east-1.rds.amazonaws.com
   AWS_RDS_PORT=5432
   AWS_RDS_DATABASE=psychobot
   AWS_RDS_USER=psych_admin
   AWS_RDS_PASSWORD=your-secure-password
   AWS_RDS_SSLMODE=require
   LOG_LEVEL=info
   ```
5. Click **Create Web Service**
6. Wait for deployment (2-5 min)

### Verify Backend

```bash
# Replace with your actual Render URL
curl https://psychobot-api.onrender.com/api/health

# Should return: { "status": "ok" }
```

## Step 4: Deploy Frontend (5 min)

### Create Render Service

1. Go to **render.com** → Create New → Static Site
2. Select your GitHub repository
3. Configure:
   - **Name**: `psychobot`
   - **Build Command**: `npm run build:frontend`
   - **Publish Directory**: `frontend/dist`
4. Add Environment Variables:
   ```
   REACT_APP_API_URL=https://psychobot-api.onrender.com
   ```
5. Click **Create Static Site**
6. Wait for deployment (1-3 min)

## Step 5: Test & Verify (5 min)

### Test API Endpoints

```bash
# Search jobs
curl "https://psychobot-api.onrender.com/api/jobs/search?q=engineer"

# Create application
curl -X POST "https://psychobot-api.onrender.com/api/jobs/track" \
  -H "Content-Type: application/json" \
  -d '{
    "company": "Google",
    "role": "Software Engineer",
    "status": "Applied"
  }'

# Get applications
curl "https://psychobot-api.onrender.com/api/jobs/track"
```

### Test Frontend

1. Open `https://psychobot.onrender.com`
2. Should load without errors
3. Try searching for a job
4. Try creating an application
5. Check browser console (F12) for any errors

## Step 6: Enable Auto-Deploy (5 min)

### Backend

1. Go to Render → `psychobot-api` service
2. Settings → GitHub Repo → Connect
3. Enable **Auto-deploy on push to main**

### Frontend

1. Go to Render → `psychobot` service
2. Settings → GitHub Repo → Connect
3. Enable **Auto-deploy on push to main**

## Done! ✅

Your PsychoBot is now in production:

- **API**: https://psychobot-api.onrender.com
- **Frontend**: https://psychobot.onrender.com
- **Database**: AWS RDS PostgreSQL

## Monitor

### Check Logs

```bash
# Backend logs
Render Dashboard → psychobot-api → Logs

# Frontend logs
Render Dashboard → psychobot → Logs
```

### Check Status

```bash
# API health
curl https://psychobot-api.onrender.com/api/health

# Frontend status
open https://psychobot.onrender.com
```

## Troubleshooting

### API Returns Error

1. Check RDS credentials in Render settings
2. Verify RDS security group allows port 5432
3. Check Render backend logs

### Frontend Shows Blank Page

1. Check `REACT_APP_API_URL` is set correctly
2. Check API health endpoint works
3. Check browser console for errors (F12)

### Build Fails

1. Check build logs on Render
2. Verify all env vars are set
3. Try manual deploy from latest commit

## Next Steps

1. **Configure WhatsApp** for notifications
2. **Setup backups** in AWS RDS console
3. **Monitor costs** on Render dashboard
4. **Scale up** if needed (upgrade to Starter tier)
5. **Document workflows** for team

## Support

- **Render Issues**: https://render.com/docs
- **RDS Issues**: AWS Console → RDS → Support
- **API Issues**: Check GitHub Issues
- **Browser Issues**: Open DevTools (F12)

---

**Time to deployment**: ~30 minutes
**Hosting cost**: Free tier (no credit card)
**Database cost**: ~$15-30/month (AWS RDS)

**For detailed setup**, see:
- `RDS_SETUP_GUIDE.md` - Database configuration
- `RENDER_DEPLOYMENT.md` - Full deployment instructions
- `PRODUCTION_CHECKLIST.md` - Comprehensive checklist
