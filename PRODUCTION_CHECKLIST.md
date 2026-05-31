# PsychoBot Production Deployment Checklist

## Pre-Deployment (Day -1)

### Infrastructure
- [ ] AWS RDS instance created and tested
- [ ] Database backup configured
- [ ] Render account created and team invited
- [ ] GitHub repository ready with main branch protected

### Code Quality
- [ ] All tests pass locally: `npm test`
- [ ] No console.log statements in production code
- [ ] No hardcoded secrets or API keys
- [ ] ESLint passes: `npm run lint`
- [ ] Build succeeds: `npm run build`

### Documentation
- [ ] README.md updated with deployment instructions
- [ ] API endpoints documented
- [ ] Environment variables documented
- [ ] Database schema documented

## Deployment Day (Day 0)

### Phase 1: Database Setup (15 min)

1. **Configure Environment**
   ```bash
   # Set credentials
   export AWS_RDS_HOST="your-rds-host"
   export AWS_RDS_USER="psych_admin"
   export AWS_RDS_PASSWORD="<secure-password>"
   export AWS_RDS_DATABASE="psychobot"
   ```

2. **Create Schema**
   ```bash
   cd D:/Dev/Depot\ Github/Psychobot
   python scripts/setup-psychobot-rds.py
   ```
   - [ ] All 3 tables created (applications, stories, job_scores)
   - [ ] All 5 indices created
   - [ ] Trigger created successfully
   - [ ] Test connectivity: `SELECT 1;` works

3. **Verify Database**
   ```bash
   psql -h $AWS_RDS_HOST -U $AWS_RDS_USER -d psychobot \
     -c "SELECT table_name FROM information_schema.tables WHERE table_schema='psychobot';"
   ```
   - [ ] Returns 3 tables

### Phase 2: Render Backend (10 min)

1. **Create Backend Service**
   - Go to render.com → Create New → Web Service
   - [ ] Connected to GitHub repository
   - [ ] Build command: `npm install`
   - [ ] Start command: `npm start`
   - [ ] Region: US (Oregon)

2. **Set Environment Variables**
   - [ ] NODE_ENV=production
   - [ ] API_PORT=3000
   - [ ] USE_RDS=true
   - [ ] AWS_RDS_HOST=<your-host>
   - [ ] AWS_RDS_USER=<your-user>
   - [ ] AWS_RDS_PASSWORD=<your-password>
   - [ ] AWS_RDS_DATABASE=psychobot
   - [ ] AWS_RDS_SSLMODE=require

3. **Deploy**
   - [ ] Click "Create Web Service"
   - [ ] Wait for deployment to complete
   - [ ] Logs show "Server running on port 3000"
   - [ ] Note the service URL (e.g., `psychobot-api.onrender.com`)

### Phase 3: Test Backend (5 min)

```bash
# Replace URL with your actual Render URL
API_URL="https://psychobot-api.onrender.com"

# Test 1: Health check
curl $API_URL/api/health

# Test 2: Job search (should return empty but no error)
curl "$API_URL/api/jobs/search?q=engineer"

# Test 3: Check logs
curl $API_URL/api/logs | head -20
```

- [ ] Health check returns 200
- [ ] Job search returns valid JSON response
- [ ] No database connection errors in logs

### Phase 4: Render Frontend (10 min)

1. **Create Frontend Service**
   - Go to render.com → Create New → Static Site
   - [ ] Connected to GitHub repository
   - [ ] Build command: `npm run build`
   - [ ] Publish directory: `frontend/dist`

2. **Set Environment Variables**
   - [ ] REACT_APP_API_URL=https://psychobot-api.onrender.com

3. **Deploy**
   - [ ] Click "Create Static Site"
   - [ ] Wait for build to complete (1-3 min)
   - [ ] Logs show "Site ready at: ..."
   - [ ] Note the frontend URL (e.g., `psychobot.onrender.com`)

### Phase 5: Test Frontend (5 min)

1. Open `https://psychobot.onrender.com`
2. Wait for page to load (may take 10-15 sec on free tier)

- [ ] Dashboard loads without errors
- [ ] No 404s in browser console
- [ ] API calls show in Network tab
- [ ] Can search jobs and see results

### Phase 6: Configure RDS Security (5 min)

1. AWS Console → RDS → Security Groups
2. Add inbound rule:
   - [ ] Protocol: TCP
   - [ ] Port: 5432
   - [ ] Source: 0.0.0.0/0 (allow all for now)

Note: Can be restricted to Render IP later if needed

### Phase 7: Enable Auto-Deploy (5 min)

1. Render Backend Service → Settings
   - [ ] Connect GitHub Repo
   - [ ] Enable "Auto-Deploy on Push to main"

2. Render Frontend Service → Settings
   - [ ] Connect GitHub Repo
   - [ ] Enable "Auto-Deploy on Push to main"

## Post-Deployment (Day 1)

### Monitoring

1. **Check Logs**
   - [ ] No error messages in backend logs
   - [ ] No 5xx errors in API responses
   - [ ] Database queries completing successfully

2. **Performance**
   - [ ] API response times < 500ms
   - [ ] Frontend loads < 3 seconds
   - [ ] Database queries < 100ms

3. **Data Flow**
   - [ ] Can create new applications
   - [ ] Can save job stories
   - [ ] Can search jobs with Career-Ops scores
   - [ ] Follow-up dates calculated correctly

### Testing Workflows

1. **Career-Ops Scoring**
   - [ ] All 10 dimensions calculated
   - [ ] Scores return A-F grades
   - [ ] Numeric scores 0-100

2. **Job Search**
   - [ ] Can search by company name
   - [ ] Can search by role
   - [ ] Results ranked by score
   - [ ] Pagination working

3. **Batch Processing**
   - [ ] Can upload 50+ jobs
   - [ ] Parallel processing (5 workers)
   - [ ] Batch report generated
   - [ ] Export to CSV/JSON

4. **Interview Prep**
   - [ ] Can save STAR stories
   - [ ] Stories ranked by role relevance
   - [ ] Confidence levels tracked
   - [ ] Story search working

5. **Application Tracking**
   - [ ] Can mark applications as Applied
   - [ ] Follow-up dates auto-calculated
   - [ ] Status pipeline working (Applied → Interviewing → Offer → Closed)
   - [ ] WhatsApp notifications triggered

## First Week

### Week 1 Checklist

- [ ] Monitor logs daily for errors
- [ ] Test manual job uploads
- [ ] Verify WhatsApp notifications work
- [ ] Check database performance
- [ ] Get user feedback on UI/UX
- [ ] Document any issues found

### Bug Tracking

If issues found:
1. Create GitHub issue with reproduction steps
2. Assign priority (Critical / High / Medium / Low)
3. Fix and test locally
4. Commit with message: `fix: <description>`
5. Auto-deploy will trigger

## Ongoing Maintenance

### Daily (Automated)

- [ ] Backup RDS database (AWS automatic)
- [ ] Monitor error rates
- [ ] Check API response times

### Weekly

- [ ] Review logs for patterns
- [ ] Check disk usage
- [ ] Verify backups are current
- [ ] Monitor cost on Render

### Monthly

- [ ] Update dependencies: `npm update`
- [ ] Security audit: `npm audit`
- [ ] Review and rotate RDS password
- [ ] Analyze usage patterns
- [ ] Plan for scaling if needed

## Rollback Plan

If critical issues found:

1. **Revert Render Deployment**
   ```bash
   # Push previous working commit
   git revert <bad-commit>
   git push origin main
   # Render auto-deploys previous version
   ```

2. **Restore Database from Backup**
   ```bash
   aws rds restore-db-instance-from-db-snapshot \
     --db-instance-identifier psychobot-restored \
     --db-snapshot-identifier <snapshot-id>
   ```

3. **Update Render to Use Restored DB**
   - Update AWS_RDS_HOST env var to restored instance
   - Trigger re-deploy

## Success Criteria

Deployment is successful when:

- ✅ Frontend loads in < 3 seconds
- ✅ All API endpoints respond in < 500ms
- ✅ Database queries complete in < 100ms
- ✅ No errors in logs
- ✅ All features tested and working
- ✅ Auto-deploy triggered successfully
- ✅ Team can access and use the system
- ✅ Backups are current and tested

## Contact & Support

- **Backend Issues**: Check `psychobot-api` service logs on Render
- **Frontend Issues**: Check browser console (F12)
- **Database Issues**: Check RDS logs in AWS console
- **Deployment Issues**: Check GitHub Actions workflow logs

## Post-Launch Improvements

After successful launch, plan for:

1. **Performance Optimization**
   - Implement caching layer
   - Optimize database queries
   - Compress assets

2. **Feature Additions**
   - More scoring dimensions
   - Interview video prep
   - Salary negotiation guide
   - Portfolio integration

3. **Scaling**
   - Upgrade Render tier if needed
   - Implement CDN for frontend
   - Add read replicas for RDS

---

**Deployment Date**: _______
**Deployed By**: _______
**Sign Off**: _______
