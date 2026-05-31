# PsychoBot Production Deployment

Complete, battle-tested production deployment for PsychoBot Career-Ops integration.

## Quick Start (30 Minutes)

```bash
# 1. Set RDS credentials
export AWS_RDS_HOST="your-rds-host"
export AWS_RDS_USER="psych_admin"
export AWS_RDS_PASSWORD="<secure-password>"

# 2. Create database schema
python scripts/setup-psychobot-rds.py

# 3. Deploy to Render
# Manual: https://render.com (create 2 services: backend + frontend)
# Or automated: ./scripts/deploy-to-render.ps1
```

See **[DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md)** for detailed 30-minute guide.

## Documentation

### Deployment Guides

| Document | Purpose | Time |
|----------|---------|------|
| **[DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md)** | Get running in 30 min | 30 min |
| **[RDS_SETUP_GUIDE.md](RDS_SETUP_GUIDE.md)** | AWS RDS configuration | 15 min |
| **[RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)** | Render backend + frontend | 20 min |
| **[PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)** | Full verification steps | 1 hour |
| **[PRODUCTION_STATUS.md](PRODUCTION_STATUS.md)** | Architecture & readiness | 5 min |

### Setup Scripts

| Script | Purpose |
|--------|---------|
| `scripts/setup-psychobot-rds.py` | Create PostgreSQL schema |
| `scripts/deploy-to-render.ps1` | Automated Render deployment |
| `scripts/migrate-to-rds.js` | Data migration (optional) |

## Architecture

```
GitHub (Code)
    ↓
GitHub Actions (CI/CD)
    ↓
Render Services (Backend + Frontend)
    ↓
AWS RDS PostgreSQL (Data)
    ↓
WhatsApp Integration (Notifications)
```

## Features

### Career-Ops Scoring
- 10-dimension evaluation (CV Match, Role Clarity, Level Strategy, etc.)
- A-F letter grades (numeric 0-100 scale)
- Weighted scoring with validation
- Deep role matching

### Batch Job Processing
- Process 50+ jobs simultaneously
- Parallel workers (5 concurrent)
- Career-Ops scoring for each
- Aggregated reports

### Interview Preparation
- STAR story bank (Situation-Task-Action-Result)
- Role relevance ranking
- Confidence tracking
- Keyword search

### Application Tracking
- Full status pipeline
- Auto-generated follow-up cadence
- Score-based strategy
- WhatsApp notifications

## Components

### Backend (Node.js + Express)
- `/api/jobs/search` - Search jobs with Career-Ops scoring
- `/api/jobs/batch` - Batch process multiple jobs
- `/api/jobs/track` - Track applications
- `/api/prep/stories` - Manage STAR stories
- `/api/health` - Health check

### Frontend (React SPA)
- Dashboard - Overview and quick actions
- Job Search - Real-time search with 10-dimension display
- Batch Processor - Upload and score 50+ jobs
- Application Tracker - Full pipeline management
- Interview Prep - STAR story manager

### Database (AWS RDS PostgreSQL)
- `psychobot.applications` - 3K+ application records
- `psychobot.stories` - STAR story bank
- `psychobot.job_scores` - Scoring cache
- 5 performance indices
- Auto-update triggers

## Deployment Environments

### Development
- Local database (Markdown files)
- Local Node.js server
- http://localhost:3000

### Staging
- AWS RDS (dev instance)
- Render (staging services)
- Pre-production verification

### Production
- AWS RDS (prod instance)
- Render (prod services)
- Auto-deploy on main branch push

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.8+
- AWS Account (free RDS tier eligible)
- Render Account (free tier available)
- GitHub Repository

### Step 1: Local Setup
```bash
git clone https://github.com/you/psychobot
cd psychobot
npm install
npm test
```

### Step 2: Database Setup
See **[RDS_SETUP_GUIDE.md](RDS_SETUP_GUIDE.md)**
```bash
python scripts/setup-psychobot-rds.py
```

### Step 3: Deploy to Render
See **[RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)**
- Create backend web service
- Create frontend static site
- Connect GitHub for auto-deploy

### Step 4: Verify
```bash
curl https://psychobot-api.onrender.com/api/health
open https://psychobot.onrender.com
```

## Monitoring

### Health Checks
```bash
# API health
curl https://psychobot-api.onrender.com/api/health

# Database status
curl https://psychobot-api.onrender.com/api/db/status
```

### Logs
- Backend: Render Dashboard → psychobot-api → Logs
- Frontend: Render Dashboard → psychobot → Logs
- Database: AWS RDS → Logs

### Alerts
- Email notifications (Render)
- Log aggregation (optional)
- Performance monitoring (optional)

## Troubleshooting

### Common Issues

**API returns 503**
- Check RDS credentials in Render settings
- Verify RDS security group allows port 5432
- Check Render backend logs

**Frontend shows blank page**
- Verify `REACT_APP_API_URL` is set correctly
- Check API health endpoint
- Open DevTools (F12) for errors

**Database connection fails**
- Test locally: `psql -h $AWS_RDS_HOST -U $AWS_RDS_USER`
- Verify RDS is publicly accessible
- Check security group settings

See **[PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)** for detailed troubleshooting.

## Security

### Credentials
- Never commit `.env` files
- Use `.env.production` (template only)
- Store actual credentials in Render/GitHub secrets
- Rotate credentials every 90 days

### Data Protection
- SSL/TLS for all connections
- Database backups (daily)
- Access logs and monitoring
- Input validation on all endpoints

### Compliance
- No hardcoded secrets
- CORS properly configured
- Rate limiting on endpoints
- Error messages sanitized

## Scaling

### Free Tier Limits
- Compute: 0.5 CPU, 512 MB RAM
- Bandwidth: Limited
- Database: AWS RDS free tier (12 months)

### Upgrade Path
- Render: Free → Starter ($7/mo) → Standard ($12/mo)
- RDS: t3.micro → t3.small → t3.medium

## Cost Estimate

### Month 1 (Free Tier)
- Render: $0
- AWS RDS: $0 (12-month free tier)
- **Total: $0**

### Ongoing (After Free Tier)
- Render Backend: $7-12/month
- Render Frontend: $0 (static)
- AWS RDS: $30-50/month
- **Total: $40-60/month**

## Next Steps

1. **Deploy** - Follow [DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md)
2. **Configure** - Set up WhatsApp integration
3. **Monitor** - Enable error alerts
4. **Extend** - Add video prep, salary guide, etc.

## Support

### Resources
- [Render Docs](https://render.com/docs)
- [AWS RDS Docs](https://docs.aws.amazon.com/rds/)
- [GitHub Actions Docs](https://github.com/features/actions)

### Issues
- Check GitHub Issues for known problems
- Enable debug logging: `LOG_LEVEL=debug`
- Review deployment checklist: [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)

## Contributors

- Career-Ops Integration
- Database Architecture
- Render Deployment
- WhatsApp Integration

## License

[Your License Here]

---

**Status**: ✅ Production Ready
**Last Updated**: 2026-05-31
**Version**: 1.0.0

**→ Start deployment:** See [DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md)
