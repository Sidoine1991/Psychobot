# PsychoBot — START HERE ✅

**Status**: Production Ready
**Time to Deploy**: 30 minutes
**Cost**: Free (first month)

---

## What Is PsychoBot?

PsychoBot is a **Career-Ops job evaluation system** integrated into your WhatsApp bot. It scores jobs across **10 dimensions**, manages interview preparation, and tracks applications with auto follow-ups.

### Key Abilities

✅ **Score Any Job** - 10-dimensional Career-Ops analysis (A-F grades)
✅ **Batch Process** - Evaluate 50+ jobs in parallel
✅ **Interview Prep** - STAR story bank with role matching
✅ **Track Applications** - Full pipeline with auto follow-ups
✅ **WhatsApp Integration** - Get updates via WhatsApp messages

---

## 🚀 Deploy in 30 Minutes

### Step 1: Get AWS RDS Credentials (5 min)
```
AWS Console → RDS → Create Database
- Engine: PostgreSQL 14+
- Get: hostname, username, password
```

### Step 2: Create Database Schema (5 min)
```bash
cd D:/Dev/Depot\ Github/Psychobot

# Set credentials
export AWS_RDS_HOST="your-host"
export AWS_RDS_USER="admin"
export AWS_RDS_PASSWORD="password"

# Create schema
python scripts/setup-psychobot-rds.py
```

### Step 3: Deploy to Render (5 min each)
1. Go to **render.com** → Create Web Service
2. Connect GitHub repository
3. Add environment variables (see `.env.production`)
4. Deploy

Do the same for frontend (Static Site)

### Step 4: Test (5 min)
```bash
curl https://psychobot-api.onrender.com/api/health
open https://psychobot.onrender.com
```

**Done!** Your PsychoBot is live.

---

## 📚 Documentation

Start with these files in order:

| # | File | Purpose | Time |
|---|------|---------|------|
| 1 | [INDEX.md](INDEX.md) | Full documentation map | 2 min |
| 2 | [DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md) | Step-by-step deployment | 30 min |
| 3 | [PRODUCTION_README.md](PRODUCTION_README.md) | Features & monitoring | 5 min |
| 4 | [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) | Verification (optional) | 1 hour |

---

## 🎯 Features

### 1. Career-Ops Scoring
Score jobs across 10 dimensions:
- CV Match
- Role Clarity
- Level Strategy
- Compensation Research
- Growth Trajectory
- Interview Prep
- Location Fit
- Sector Alignment
- Team Dynamics
- Life Integration

**Result**: A-F grade (numeric 0-100)

### 2. Batch Processing
Upload 50+ jobs at once:
- Parallel processing (5 workers)
- Career-Ops score for each
- Aggregated report
- CSV/JSON export

### 3. Interview Prep
Manage STAR stories:
- Create story bank
- Rank by role relevance
- Track confidence level
- Quick search

### 4. Application Tracking
Full status pipeline:
- Applied → Interviewing → Offer → Closed
- Auto follow-up dates (7d, 14d, 21d, 30d)
- WhatsApp notifications
- Historical tracking

---

## 🗄️ Architecture

```
You (WhatsApp)
    ↓ (Command: !batch, !track, !prep)
PsychoBot WhatsApp Bot
    ↓ (HTTP API calls)
Backend (Node.js) on Render
    ↓ (SQL queries)
Database (PostgreSQL) on AWS RDS
    ↓ (Results)
WhatsApp Notifications
```

---

## 💰 Costs

| Period | Cost |
|--------|------|
| **Month 1** (Free Tier) | **$0** |
| **Month 2+** (Production) | **$40-60/month** |

- AWS RDS: Free 12 months, then ~$30-50/month
- Render: Free tier (upgradeable)

---

## ✅ What's Ready

- [x] Career-Ops scoring (10 dimensions)
- [x] Batch processing (50+ jobs)
- [x] Interview prep (STAR bank)
- [x] Application tracking (full pipeline)
- [x] Database schema (PostgreSQL)
- [x] Backend API (Node.js + Express)
- [x] Frontend Dashboard (React SPA)
- [x] GitHub Actions CI/CD
- [x] Render deployment config
- [x] Setup automation scripts
- [x] Complete documentation
- [x] Security best practices

---

## 🚀 Next Steps

### Immediate
1. Read [DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md)
2. Get AWS RDS credentials
3. Run `python scripts/setup-psychobot-rds.py`
4. Deploy to Render (backend + frontend)
5. Test endpoints

### After Launch
1. Monitor logs (Render dashboard)
2. Get user feedback
3. Configure WhatsApp notifications
4. Enable auto-deploy on GitHub
5. Setup backups

### Future Enhancements
- Video interview prep
- Salary negotiation guide
- Portfolio integration
- Advanced analytics
- Email notifications

---

## 🆘 Quick Troubleshooting

**"RDS Connection Error"**
→ Check credentials in `DEPLOY_QUICK_START.md` Step 1

**"API Returns 503"**
→ Check Render backend logs in dashboard

**"Frontend Blank Page"**
→ Open DevTools (F12) and check console errors

**"Build Failed"**
→ Check Render build logs for specific error

For detailed help, see [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) - Troubleshooting section

---

## 📖 Documentation Map

```
START_HERE.md (you are here)
    ↓
INDEX.md (full navigation)
    ↓
DEPLOY_QUICK_START.md (30-min guide)
    ├── RDS_SETUP_GUIDE.md (database)
    ├── RENDER_DEPLOYMENT.md (platform)
    ├── PRODUCTION_README.md (features)
    ├── PRODUCTION_CHECKLIST.md (verify)
    ├── PRODUCTION_STATUS.md (architecture)
    └── DEPLOYMENT_COMPLETE.md (overview)
```

---

## 💡 Tips

**Deploy at your pace**
- Can take 30 min or 1 hour
- All guides are detailed with screenshots
- Can pause and resume anytime

**Use free tier first**
- Test everything before upgrading
- Switch to paid tier only when needed
- No credit card needed for 30 days

**Enable auto-deploy**
- Push code → Render auto-deploys
- No manual steps needed after first deploy
- Rollback available anytime

**Monitor from day 1**
- Check Render + AWS logs daily
- Set up email alerts (in settings)
- Test health endpoints regularly

---

## 🎉 Success Criteria

Your deployment is successful when:

✅ Frontend loads at https://psychobot.onrender.com
✅ API health check: `curl https://psychobot-api.onrender.com/api/health`
✅ Can search jobs with Career-Ops scores
✅ Can track applications
✅ WhatsApp bot responds to commands
✅ No errors in logs

---

## 📞 Need Help?

1. **Check documentation**: [INDEX.md](INDEX.md)
2. **Review troubleshooting**: [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)
3. **Enable debug mode**: Set `LOG_LEVEL=debug`
4. **Check logs**: Render Dashboard → Logs
5. **External support**:
   - Render: https://render.com/support
   - AWS: https://console.aws.amazon.com/support
   - GitHub Issues: Create issue in repo

---

## 🚀 Ready? Let's Go!

**Next file to read**: [DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md)

Takes 30 minutes from here to production.

---

**Version**: 1.0.0 Production Ready
**Last Updated**: 2026-05-31
**Status**: ✅ Ready to Deploy

---

**Questions?** Start with [INDEX.md](INDEX.md) for the full documentation map.

**Ready to deploy?** Go to [DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md) now.
