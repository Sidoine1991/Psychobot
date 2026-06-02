# PsychoBot Documentation Index

Quick navigation to all deployment, configuration, and feature documentation.

## 🚀 Getting Started

**New to PsychoBot?** Start here:

1. **[DEPLOYMENT_COMPLETE.md](DEPLOYMENT_COMPLETE.md)** - Overview of what's ready
2. **[DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md)** - 30-minute deployment guide
3. **[PRODUCTION_README.md](PRODUCTION_README.md)** - Features and architecture

## 📖 Documentation by Topic

### Deployment
| Document | Purpose | Time |
|----------|---------|------|
| [DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md) | Get running in 30 min | 30 min |
| [RDS_SETUP_GUIDE.md](RDS_SETUP_GUIDE.md) | AWS RDS configuration | 15 min |
| [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) | Render platform setup | 20 min |
| [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) | Full verification | 1 hour |
| [PRODUCTION_STATUS.md](PRODUCTION_STATUS.md) | Architecture & readiness | 5 min |

### Operations
| Document | Purpose |
|----------|---------|
| [PRODUCTION_README.md](PRODUCTION_README.md) | Feature overview & monitoring |
| [DEPLOYMENT_COMPLETE.md](DEPLOYMENT_COMPLETE.md) | Project completion status |

### Scripts
| Script | Purpose | Language |
|--------|---------|----------|
| `scripts/setup-psychobot-rds.py` | Create PostgreSQL schema | Python |
| `scripts/deploy-to-render.ps1` | Automated deployment | PowerShell |
| `scripts/migrate-to-rds.js` | Data migration (optional) | Node.js |

### Configuration
| File | Purpose |
|------|---------|
| `.env.production` | Environment variables template |
| `render.yaml` | Render infrastructure-as-code |
| `.github/workflows/deploy.yml` | GitHub Actions CI/CD |

## 🎯 Common Tasks

### I want to...

**Deploy to production**
→ [DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md) (30 min)

**Setup the database**
→ [RDS_SETUP_GUIDE.md](RDS_SETUP_GUIDE.md) (15 min)

**Deploy to Render platform**
→ [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) (20 min)

**Verify everything is working**
→ [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) (1 hour)

**Understand the architecture**
→ [PRODUCTION_STATUS.md](PRODUCTION_STATUS.md) (5 min)

**See what features are available**
→ [PRODUCTION_README.md](PRODUCTION_README.md) (5 min)

**Troubleshoot an issue**
→ [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) - Troubleshooting section

**Monitor the production system**
→ [PRODUCTION_README.md](PRODUCTION_README.md) - Monitoring section

**Check deployment status**
→ [DEPLOYMENT_COMPLETE.md](DEPLOYMENT_COMPLETE.md)

## 📊 Feature Documentation

### Career-Ops Scoring
- 10-dimensional job evaluation
- A-F letter grades (numeric 0-100)
- Batch processing support
- See: [PRODUCTION_README.md](PRODUCTION_README.md) - Features section

### Batch Processing
- Process 50+ jobs in parallel
- Parallel workers (5 concurrent)
- Career-Ops scoring per job
- See: [PRODUCTION_README.md](PRODUCTION_README.md) - Features section

### Interview Preparation
- STAR story bank management
- Role relevance ranking
- Confidence tracking
- See: [PRODUCTION_README.md](PRODUCTION_README.md) - Features section

### Application Tracking
- Full status pipeline
- Auto follow-up cadence
- WhatsApp notifications
- See: [PRODUCTION_README.md](PRODUCTION_README.md) - Features section

## 🏗️ Architecture

```
Frontend (React)
    ↓
Backend (Node.js)
    ↓
Database (AWS RDS PostgreSQL)
    ↓
WhatsApp (Notifications)
```

See: [PRODUCTION_STATUS.md](PRODUCTION_STATUS.md) - Architecture section

## 💾 Database Schema

**Tables:**
- `psychobot.applications` - 3K+ application records
- `psychobot.stories` - STAR story bank
- `psychobot.job_scores` - Scoring cache

**Indices:** 5 performance indices
**Triggers:** Auto-update timestamps

See: [RDS_SETUP_GUIDE.md](RDS_SETUP_GUIDE.md) - Step 3

## 🔐 Security

- SSL/TLS encryption
- Database backups (daily)
- No hardcoded secrets
- Input validation
- Rate limiting

See: [PRODUCTION_README.md](PRODUCTION_README.md) - Security section

## 💰 Costs

| Component | Free Tier | Production |
|-----------|-----------|------------|
| Render Backend | $0 | $7-12/mo |
| Render Frontend | $0 | $0 |
| AWS RDS | $0 (12mo) | $30-50/mo |
| **Total** | **$0** | **$40-60/mo** |

See: [DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md) - Cost section

## 🚀 Deployment Timeline

| Phase | Time | Status |
|-------|------|--------|
| RDS Setup | 5 min | ⏳ Ready |
| Backend Deploy | 5 min | ⏳ Ready |
| Frontend Deploy | 5 min | ⏳ Ready |
| Verification | 5 min | ⏳ Ready |
| **Total** | **20 min** | ✅ Ready |

See: [DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md)

## 📍 Navigation

- **Start Here**: [DEPLOYMENT_COMPLETE.md](DEPLOYMENT_COMPLETE.md)
- **Quick Deploy**: [DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md)
- **Database**: [RDS_SETUP_GUIDE.md](RDS_SETUP_GUIDE.md)
- **Platform**: [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)
- **Verify**: [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)
- **Details**: [PRODUCTION_STATUS.md](PRODUCTION_STATUS.md)
- **Features**: [PRODUCTION_README.md](PRODUCTION_README.md)
- **Overview**: This file

## 🔍 Search Guide

Looking for something specific?

**Database Issues**
→ [RDS_SETUP_GUIDE.md](RDS_SETUP_GUIDE.md) - Troubleshooting section

**Deployment Failures**
→ [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) - Troubleshooting section

**Configuration**
→ [PRODUCTION_STATUS.md](PRODUCTION_STATUS.md) - Architecture section

**Performance**
→ [PRODUCTION_README.md](PRODUCTION_README.md) - Monitoring section

**Costs**
→ [DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md) - Cost section

**Security**
→ [PRODUCTION_README.md](PRODUCTION_README.md) - Security section

## 📞 Support

### Internal
- Check relevant troubleshooting section in each guide
- Review logs: Render dashboard + AWS console
- Enable debug: Set `LOG_LEVEL=debug`

### External
- Render: https://render.com/support
- AWS: https://console.aws.amazon.com/support
- GitHub: Create issue in repository

## ✅ Status

- **Development**: ✅ Complete
- **Testing**: ✅ Complete
- **Documentation**: ✅ Complete
- **Infrastructure**: ✅ Ready
- **Deployment**: ⏳ Ready to launch

## 🎯 Next Step

1. Choose your deployment guide:
   - **Fast** (30 min): [DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md)
   - **Detailed** (1 hour): [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)
   - **Complete**: All guides above

2. Get AWS RDS credentials from your console

3. Follow the chosen guide step-by-step

4. Monitor logs after deployment

---

**Last Updated**: 2026-05-31
**Version**: 1.0.0 Production Ready

**→ Ready to deploy?** Start with [DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md)
