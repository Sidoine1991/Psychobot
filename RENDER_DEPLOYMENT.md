# PsychoBot Render Deployment Guide

## Architecture

```
GitHub Repository
    ↓
GitHub Actions (CI/CD)
    ↓
Render Backend (Node.js API)  +  Render Frontend (React SPA)
    ↓                              ↓
AWS RDS PostgreSQL Database  ←----┘
```

## Prerequisites

- Render account (free tier available)
- GitHub account with PsychoBot repository
- AWS RDS instance with PsychoBot schema created
- Environment variables configured

## Phase 1: Prepare Code

### 1. Update render.yaml

```yaml
services:
  - type: web
    name: psychobot-api
    runtime: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: API_PORT
        value: 3000
      - key: USE_RDS
        value: true
      - key: LOG_LEVEL
        value: info
      - key: AWS_RDS_HOST
        sync: false
      - key: AWS_RDS_PORT
        value: 5432
      - key: AWS_RDS_DATABASE
        value: psychobot
      - key: AWS_RDS_USER
        sync: false
      - key: AWS_RDS_PASSWORD
        sync: false
      - key: AWS_RDS_SSLMODE
        value: require

  - type: static_site
    name: psychobot
    buildCommand: npm run build
    staticPublishPath: frontend/dist
    envVars:
      - key: REACT_APP_API_URL
        value: https://psychobot-api.onrender.com
```

### 2. Verify GitHub Workflow

`.github/workflows/deploy.yml` should contain:

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
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run build
      - name: Deploy to Render
        env:
          RENDER_API_KEY: ${{ secrets.RENDER_API_KEY }}
        run: |
          curl -X POST https://api.render.com/deploy/srv-xxxxx \
            -H "Authorization: Bearer $RENDER_API_KEY"
```

## Phase 2: Create Render Services

### 1. Backend API Service

1. Go to **render.com** → Create New → Web Service
2. Connect GitHub repository
3. Configure:
   - **Name**: `psychobot-api`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Region**: US (Oregon) or EU
   - **Plan**: Free (0.5 CPU, 512 MB RAM)

4. Add Environment Variables:
   ```
   NODE_ENV=production
   API_PORT=3000
   USE_RDS=true
   AWS_RDS_HOST=<your-rds-host>
   AWS_RDS_PORT=5432
   AWS_RDS_DATABASE=psychobot
   AWS_RDS_USER=<your-rds-user>
   AWS_RDS_PASSWORD=<your-rds-password>
   AWS_RDS_SSLMODE=require
   LOG_LEVEL=info
   ```

5. Click **Create Web Service**
6. Note the service URL: `https://psychobot-api.onrender.com`

### 2. Frontend Static Site

1. Go to **render.com** → Create New → Static Site
2. Connect GitHub repository
3. Configure:
   - **Name**: `psychobot`
   - **Build Command**: `npm run build`
   - **Publish Directory**: `frontend/dist`
   - **Region**: US (Oregon) or EU

4. Add Environment Variables:
   ```
   REACT_APP_API_URL=https://psychobot-api.onrender.com
   ```

5. Click **Create Static Site**
6. Note the service URL: `https://psychobot.onrender.com`

## Phase 3: Configure RDS Security

### 1. Allow Render IP Addresses

AWS RDS Security Group:

```
Protocol: TCP
Port: 5432
Source: 0.0.0.0/0 (or Render's static IP range)
Description: Render Deployment Access
```

### 2. Test Connection from Render

1. Go to Render service → Logs
2. Should see successful connection messages

## Phase 4: Initial Deploy

### 1. Backend Deploy

1. Go to `psychobot-api` service on Render
2. Click **Manual Deploy** → **Deploy Latest Commit**
3. Wait for deployment to complete (2-5 min)
4. Check Logs for errors

### 2. Frontend Deploy

1. Go to `psychobot` service on Render
2. Click **Manual Deploy** → **Deploy Latest Commit**
3. Wait for build to complete (1-3 min)

### 3. Verify Deployment

```bash
# Test API
curl https://psychobot-api.onrender.com/api/health

# Test Frontend
open https://psychobot.onrender.com

# Test Database Connection
curl https://psychobot-api.onrender.com/api/jobs/search?q=engineer
```

## Phase 5: Setup Auto-Deploy

### 1. Enable GitHub Auto-Deploy

1. Go to `psychobot-api` service on Render
2. Settings → GitHub Repo → Connect
3. Enable **Auto-deploy on push to main**

Do the same for `psychobot` frontend service.

### 2. Verify Auto-Deploy Trigger

1. Make a small change to code
2. Push to `main` branch
3. Render should automatically deploy
4. Check Render Logs for confirmation

## Monitoring

### 1. Setup Error Alerts

1. Go to Render Dashboard → Settings
2. Enable email notifications for:
   - Deployment failures
   - Service crashes

### 2. Check Logs

```bash
# Backend logs
render.com/services/psychobot-api/logs

# Frontend logs
render.com/services/psychobot/logs
```

### 3. Performance Monitoring

1. Check API response times in logs
2. Monitor database query performance
3. Watch for memory/CPU spikes on free tier

## Troubleshooting

### Deployment Fails

1. Check Build Logs on Render
2. Common issues:
   - Node modules not installed: Check `package.json`
   - Environment variable missing: Verify all required vars set
   - Port already in use: Check `API_PORT` configuration

### API Errors

```bash
# Check health endpoint
curl -v https://psychobot-api.onrender.com/api/health

# Check error logs
curl https://psychobot-api.onrender.com/api/logs

# Enable debug mode
# Set LOG_LEVEL=debug in environment variables
```

### Database Connection Issues

1. Verify RDS is public accessible
2. Check security group allows port 5432
3. Test connection locally first:
   ```bash
   psql -h <rds-host> -U <user> -d psychobot
   ```

### Frontend Build Issues

```bash
# Local test
npm run build

# Check dist folder
ls -la frontend/dist

# Verify API_URL is set
echo $REACT_APP_API_URL
```

## Cost Optimization

### Free Tier Limits

- **Compute**: 0.5 CPU, 512 MB RAM (both services combined)
- **Bandwidth**: Limited but sufficient for small apps
- **Databases**: Not included (use AWS RDS)

### Upgrade When Needed

- **Starter**: $7/month per service
- **Standard**: $12/month per service
- **Pro**: $29/month per service

## Security Checklist

- [ ] RDS credentials stored securely
- [ ] HTTPS enabled on Render
- [ ] CORS properly configured
- [ ] Input validation on API endpoints
- [ ] Rate limiting enabled
- [ ] Error messages don't leak sensitive data
- [ ] Logs don't contain secrets
- [ ] Regular backups of RDS database
- [ ] Monitor suspicious activity

## Backup & Recovery

### Daily Backups

1. Go to AWS RDS Console
2. Configure **Automated Backups**:
   - Backup Retention Period: 30 days
   - Backup Window: 03:00-04:00 UTC

### Manual Backup

```bash
# Create snapshot
aws rds create-db-snapshot \
  --db-instance-identifier psychobot \
  --db-snapshot-identifier psychobot-$(date +%Y%m%d-%H%M%S)
```

## Next Steps

- [ ] Create Render account
- [ ] Configure RDS security group
- [ ] Deploy backend service
- [ ] Deploy frontend service
- [ ] Test all endpoints
- [ ] Enable auto-deploy
- [ ] Setup monitoring
- [ ] Document in team wiki
