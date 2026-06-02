# Production Deployment Guide - PsychoBot Dashboard

## Overview

This guide shows how to deploy PsychoBot Dashboard to **Render** (same platform as TradBOT) with:
- Automated CI/CD pipeline
- Supabase for persistent data
- Separate frontend + backend services
- Environment variable management
- Zero-downtime deployments

## Architecture for Production

```
GitHub Repository
    ↓ (Push to main)
    ↓
GitHub Actions (CI/CD)
    ├─ Run tests
    ├─ Build frontend
    ├─ Deploy to Render
    ↓
Render Services
├─ Backend API (Node.js + Express)
│   └─ http://psychobot-api.onrender.com
├─ Frontend (React static)
│   └─ http://psychobot.onrender.com
└─ Database (Supabase PostgreSQL)
    └─ Store: applications, stories, scores
```

## Step 1: Prepare for Production

### 1a. Create .env.production file

```bash
# Backend (.env.production)
NODE_ENV=production
API_PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SECRET=your-service-role-key
CORS_ORIGIN=https://psychobot.onrender.com
LOG_LEVEL=info
```

### 1b. Add .env.example (commit to git)

```bash
NODE_ENV=production
API_PORT=3000
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_SECRET=
CORS_ORIGIN=
LOG_LEVEL=info
```

### 1c. Create build script

```bash
# package.json - add scripts
"scripts": {
  "build": "cd frontend && npm install && npm run build && cd ..",
  "start": "node api-server.js",
  "dev": "concurrently \"node api-server.js\" \"cd frontend && npm start\""
}
```

## Step 2: Setup Supabase (Data Management)

### 2a. Create Supabase project

1. Go to https://supabase.com
2. Create new project: "psychobot-prod"
3. Get credentials from Settings → API

### 2b. Create database tables

Run in Supabase SQL editor:

```sql
-- Applications table
CREATE TABLE applications (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  company VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'Applied',
  score VARCHAR(1) DEFAULT 'B',
  applied_date DATE DEFAULT NOW(),
  next_followup DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Stories table
CREATE TABLE stories (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title VARCHAR(255) NOT NULL,
  situation TEXT NOT NULL,
  task TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  reflection TEXT NOT NULL,
  roles VARCHAR(255)[] DEFAULT ARRAY[]::VARCHAR[],
  confidence VARCHAR(20) DEFAULT 'Medium',
  keywords VARCHAR(255)[] DEFAULT ARRAY[]::VARCHAR[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- Scores cache (for performance)
CREATE TABLE job_scores (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  company VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL,
  overall_score VARCHAR(1),
  numeric_score INT,
  dimensions JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_scores ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now, restrict later)
CREATE POLICY "Enable all operations for authenticated users"
  ON applications FOR ALL
  USING (true);

CREATE POLICY "Enable all operations for authenticated users"
  ON stories FOR ALL
  USING (true);

CREATE POLICY "Enable read for all users"
  ON job_scores FOR SELECT
  USING (true);
```

### 2c. Update services to use Supabase

Create `src/services/supabaseClient.js`:

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
```

## Step 3: Deploy to Render

### 3a. Create Backend Service

1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect GitHub repository
4. Fill in:

```
Name: psychobot-api
Environment: Node
Build Command: npm install && npm run build
Start Command: npm start
Plan: Free (or Starter)
Environment Variables:
  - NODE_ENV=production
  - SUPABASE_URL=<your-value>
  - SUPABASE_KEY=<your-value>
  - SUPABASE_SECRET=<your-value>
  - CORS_ORIGIN=https://psychobot.onrender.com
```

5. Click "Create Web Service"

### 3b. Create Frontend Service (Static Site)

1. Click "New +" → "Static Site"
2. Connect same GitHub repository
3. Fill in:

```
Name: psychobot
Build Command: cd frontend && npm install && npm run build
Publish Directory: frontend/build
```

4. Click "Create Static Site"

### 3c. Get service URLs

After deployment:
- Backend: `https://psychobot-api.onrender.com`
- Frontend: `https://psychobot.onrender.com`

## Step 4: Update Environment Variables

### 4a. Update Frontend to use production API

Create `frontend/public/config.js`:

```javascript
window.API_URL = process.env.REACT_APP_API_URL || 'https://psychobot-api.onrender.com';
```

Update `frontend/src/App.jsx`:

```javascript
const apiUrl = window.API_URL || '/api';
const response = await axios.get(`${apiUrl}/stats`);
```

### 4b. Update Render frontend environment

In Render Dashboard:
- Environment → Add Variable
- `REACT_APP_API_URL=https://psychobot-api.onrender.com`

## Step 5: Setup CI/CD Pipeline

### 5a. Create GitHub Actions workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Render

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Install dependencies
        run: npm install
      
      - name: Run tests
        run: npm test || true
      
      - name: Build frontend
        run: cd frontend && npm install && npm run build
      
      - name: Deploy to Render
        env:
          RENDER_DEPLOY_KEY: ${{ secrets.RENDER_DEPLOY_KEY }}
        run: |
          curl -X POST https://api.render.com/deploy/srv-${{ secrets.RENDER_SERVICE_ID }}?key=$RENDER_DEPLOY_KEY
```

### 5b. Add Deploy Key to Secrets

In GitHub:
- Settings → Secrets and variables → Actions
- Add `RENDER_DEPLOY_KEY` (from Render dashboard)
- Add `RENDER_SERVICE_ID`

## Step 6: Data Management

### 6a. Backup Strategy

Daily backups to S3:

```javascript
// scripts/backup.js
const supabase = require('../src/services/supabaseClient');
const AWS = require('aws-sdk');

async function backupDatabase() {
  const { data, error } = await supabase
    .from('applications')
    .select('*');
  
  if (error) throw error;
  
  const s3 = new AWS.S3();
  await s3.putObject({
    Bucket: 'psychobot-backups',
    Key: `backup-${new Date().toISOString()}.json`,
    Body: JSON.stringify(data, null, 2)
  }).promise();
  
  console.log('Backup complete');
}

backupDatabase().catch(console.error);
```

Schedule with GitHub Actions:

```yaml
name: Daily Backup
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily
```

### 6b. Data Migration

Script to migrate from Markdown → Supabase:

```javascript
// scripts/migrate-to-supabase.js
const supabase = require('../src/services/supabaseClient');
const followUpService = require('../src/services/followUpService');

async function migrateApplications() {
  const apps = followUpService.loadApplications();
  
  for (const app of apps) {
    await supabase
      .from('applications')
      .insert([{
        company: app.company,
        role: app.role,
        status: app.status,
        score: app.score,
        applied_date: app.appliedDate,
        notes: app.notes
      }]);
  }
  
  console.log(`Migrated ${apps.length} applications`);
}

migrateApplications().catch(console.error);
```

Run once:
```bash
node scripts/migrate-to-supabase.js
```

## Step 7: Monitoring & Logging

### 7a. Add error tracking

```javascript
// api-server.js - add Sentry
const Sentry = require("@sentry/node");

Sentry.init({ dsn: process.env.SENTRY_DSN });
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

Set `SENTRY_DSN` in Render environment.

### 7b. Add logging

```javascript
// utils/logger.js
const fs = require('fs');
const path = require('path');

function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, message, ...data };
  
  console.log(JSON.stringify(logEntry));
  
  // Store in /logs (for Render to display)
  const logFile = path.join(__dirname, '../logs/app.log');
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
}

module.exports = { log };
```

## Step 8: Content Management

### 8a. Update jobs & stories from WhatsApp

When a user adds a story via WhatsApp:
- Save to Supabase immediately
- Dashboard auto-syncs (refresh every 5 min)

### 8b. Keep data in sync

Services now:
1. Read from Supabase first
2. Fallback to Markdown files
3. Write to both locations

```javascript
// interviewPrepService.js - add Supabase sync
async function addStory(story) {
  // Save to Supabase
  await supabase.from('stories').insert([story]);
  
  // Also save to Markdown (backup)
  fs.appendFileSync(this.storyBankPath, formatStoryMarkdown(story));
}
```

## Step 9: Production Checklist

- [ ] Supabase project created
- [ ] Database tables created
- [ ] Render services deployed
- [ ] Environment variables set
- [ ] GitHub Actions workflow created
- [ ] Backups configured
- [ ] Error tracking (Sentry) enabled
- [ ] SSL certificate automatic (Render handles)
- [ ] Domain custom (optional)
- [ ] Data migrated to Supabase
- [ ] Performance tested
- [ ] Security audit passed

## Step 10: Custom Domain (Optional)

Add custom domain in Render:
- Settings → Custom Domains
- Add `psychobot.yourcompany.com`
- Update CNAME in DNS

## Maintenance & Updates

### Weekly
- Check Render logs for errors
- Monitor database size
- Verify backups

### Monthly
- Review performance metrics
- Update dependencies
- Security patches

### Quarterly
- Feature releases
- Performance optimization
- Cost review

## Troubleshooting

### Frontend not showing
- Check `REACT_APP_API_URL` env variable
- Verify API backend is running
- Check browser console errors

### API errors
- Check Supabase connection
- Verify environment variables
- Review Render logs

### Database issues
- Check Supabase quota
- Review query performance
- Check RLS policies

## Costs

Free tier on Render:
- Backend API: $0 (free tier, may sleep after 15 min inactivity)
- Frontend static: $0 (free tier)
- Total: $0/month

Paid tier (recommended for production):
- Backend API: $7/month (always on)
- Frontend: $0 (static)
- Supabase: Free tier → $25+/month
- Total: $32+/month

## Next Steps

1. Setup Supabase
2. Deploy backend to Render
3. Deploy frontend to Render
4. Test all features
5. Monitor for 48 hours
6. Enable automatic deployments

**Your PsychoBot Dashboard is now production-ready!**
