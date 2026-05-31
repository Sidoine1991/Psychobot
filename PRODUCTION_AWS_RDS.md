# Production Deployment - AWS RDS (PostgreSQL)

## Architecture

```
GitHub Repository
    ↓ (Push to main)
    ↓
GitHub Actions (CI/CD)
    ├─ Build frontend
    ├─ Run tests
    └─ Deploy to Render
         ↓
Render Services
├─ Backend API (Node.js + Express)
│   └─ http://psychobot-api.onrender.com
├─ Frontend (React static)
│   └─ http://psychobot.onrender.com
└─ Database Connection
    └─ AWS RDS (PostgreSQL)
        └─ Same as TradBOT instance
```

## Step 1: Setup AWS RDS PostgreSQL

### 1a. Create RDS Instance (or use existing TradBOT database)

Option A: **Reuse existing TradBOT RDS instance** (recommended)
```
Host: your-tradbot-db.c7xxxxx.us-east-1.rds.amazonaws.com
Port: 5432
Database: psychobot (or tradbot, then create new schema)
User: admin
Password: [existing credentials]
```

Option B: **Create new RDS instance**
```bash
# In AWS Console:
1. RDS → Create Database
2. PostgreSQL engine
3. Free tier eligible (optional)
4. Multi-AZ: No (for dev)
5. Storage: 20GB
6. DB name: psychobot
```

### 1b. Create Database & Tables

Connect to RDS using `aws_rds_helper.py` (you already have this for TradBOT):

```python
# scripts/create_psychobot_schema.py
import sys
sys.path.insert(0, '../src/services')

from aws_rds_helper import RDSHelper

rds = RDSHelper()

# Create schema
rds.execute("""
    CREATE SCHEMA IF NOT EXISTS psychobot;
    
    -- Applications table
    CREATE TABLE IF NOT EXISTS psychobot.applications (
        id SERIAL PRIMARY KEY,
        company VARCHAR(255) NOT NULL,
        role VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'Applied',
        score VARCHAR(1) DEFAULT 'B',
        applied_date DATE DEFAULT NOW(),
        next_followup DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );
    
    -- Stories table
    CREATE TABLE IF NOT EXISTS psychobot.stories (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        situation TEXT NOT NULL,
        task TEXT NOT NULL,
        action TEXT NOT NULL,
        result TEXT NOT NULL,
        reflection TEXT NOT NULL,
        roles TEXT[] DEFAULT ARRAY[]::TEXT[],
        confidence VARCHAR(20) DEFAULT 'Medium',
        keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
        created_at TIMESTAMP DEFAULT NOW()
    );
    
    -- Job scores cache
    CREATE TABLE IF NOT EXISTS psychobot.job_scores (
        id SERIAL PRIMARY KEY,
        company VARCHAR(255) NOT NULL,
        role VARCHAR(255) NOT NULL,
        overall_score VARCHAR(1),
        numeric_score INT,
        dimensions JSONB,
        created_at TIMESTAMP DEFAULT NOW()
    );
    
    -- Indices for performance
    CREATE INDEX IF NOT EXISTS idx_applications_company ON psychobot.applications(company);
    CREATE INDEX IF NOT EXISTS idx_applications_status ON psychobot.applications(status);
    CREATE INDEX IF NOT EXISTS idx_stories_title ON psychobot.stories(title);
    CREATE INDEX IF NOT EXISTS idx_job_scores_company_role ON psychobot.job_scores(company, role);
    
    GRANT ALL ON SCHEMA psychobot TO admin;
    GRANT ALL ON ALL TABLES IN SCHEMA psychobot TO admin;
""")

print("✅ Schema created successfully")
```

Run it:
```bash
python scripts/create_psychobot_schema.py
```

## Step 2: Create RDS Client Service

Create `src/services/rdsClient.js`:

```javascript
/**
 * RDS Client - PostgreSQL connection for production
 */

const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.RDS_HOST,
    port: process.env.RDS_PORT || 5432,
    database: process.env.RDS_DATABASE,
    user: process.env.RDS_USER,
    password: process.env.RDS_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
    console.error('[RDS] Unexpected error on idle client', err);
});

async function query(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log(`[RDS] Query executed in ${duration}ms`, text.substring(0, 50));
        return result;
    } catch (error) {
        console.error('[RDS] Query error:', error);
        throw error;
    }
}

module.exports = { pool, query };
```

## Step 3: Update Services to use RDS

### 3a. Update followUpService.js

```javascript
// src/services/followUpService.js - Add RDS methods

const { query } = require('./rdsClient');

class FollowUpService {
    // ... existing code ...

    async loadApplicationsFromRDS() {
        try {
            const result = await query(
                'SELECT * FROM psychobot.applications ORDER BY applied_date DESC'
            );
            this.applications = result.rows;
            return this.applications;
        } catch (error) {
            console.error('Error loading applications from RDS:', error);
            return this.loadApplications(); // Fallback to Markdown
        }
    }

    async addApplicationToRDS(app) {
        try {
            await query(
                `INSERT INTO psychobot.applications 
                (company, role, score, applied_date, notes)
                VALUES ($1, $2, $3, $4, $5)`,
                [app.company, app.role, app.score || 'B', app.appliedDate, app.notes || '']
            );
            return true;
        } catch (error) {
            console.error('Error adding application to RDS:', error);
            return this.addApplication(app); // Fallback to Markdown
        }
    }

    async updateStatusInRDS(company, newStatus) {
        try {
            await query(
                'UPDATE psychobot.applications SET status = $1 WHERE company = $2',
                [newStatus, company]
            );
            return true;
        } catch (error) {
            console.error('Error updating status in RDS:', error);
            return this.updateStatus(company, newStatus); // Fallback
        }
    }
}
```

### 3b. Update interviewPrepService.js

```javascript
// src/services/interviewPrepService.js - Add RDS methods

const { query } = require('./rdsClient');

class InterviewPrepService {
    // ... existing code ...

    async loadStoriesFromRDS() {
        try {
            const result = await query(
                'SELECT * FROM psychobot.stories ORDER BY created_at DESC'
            );
            this.stories = result.rows.map(row => ({
                ...row,
                roles: row.roles || [],
                keywords: row.keywords || []
            }));
            return this.stories;
        } catch (error) {
            console.error('Error loading stories from RDS:', error);
            return this.loadStories(); // Fallback to Markdown
        }
    }

    async addStoryToRDS(story) {
        try {
            await query(
                `INSERT INTO psychobot.stories 
                (title, situation, task, action, result, reflection, roles, confidence, keywords)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    story.title,
                    story.situation,
                    story.task,
                    story.action,
                    story.result,
                    story.reflection,
                    story.roles || [],
                    story.confidence || 'Medium',
                    story.keywords || []
                ]
            );
            return true;
        } catch (error) {
            console.error('Error adding story to RDS:', error);
            return this.addStory(story); // Fallback to Markdown
        }
    }
}
```

## Step 4: Update API Endpoints

### 4a. Update api-server.js to use RDS

```javascript
// api-server.js - Add RDS endpoints

app.get('/api/track/applications', async (req, res) => {
    try {
        if (process.env.USE_RDS === 'true') {
            await followUpService.loadApplicationsFromRDS();
        }
        const apps = followUpService.loadApplications();
        res.json({ success: true, applications: apps });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/track/add', async (req, res) => {
    try {
        const { company, role, score, notes } = req.body;
        
        if (process.env.USE_RDS === 'true') {
            await followUpService.addApplicationToRDS({
                company, role, score, notes,
                appliedDate: new Date().toISOString().split('T')[0]
            });
        } else {
            followUpService.addApplication({ company, role, score, notes });
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
```

## Step 5: Environment Variables for Production

Update `.env.production`:

```bash
# Backend
NODE_ENV=production
API_PORT=3000

# AWS RDS
USE_RDS=true
RDS_HOST=your-tradbot-db.c7xxxxx.us-east-1.rds.amazonaws.com
RDS_PORT=5432
RDS_DATABASE=psychobot
RDS_USER=admin
RDS_PASSWORD=your-password

# Frontend
REACT_APP_API_URL=https://psychobot-api.onrender.com

# CORS
CORS_ORIGIN=https://psychobot.onrender.com
```

## Step 6: Deploy to Render with RDS

### 6a. Add RDS variables to Render

In Render Dashboard → Environment:

```
USE_RDS=true
RDS_HOST=your-tradbot-db.c7xxxxx.us-east-1.rds.amazonaws.com
RDS_PORT=5432
RDS_DATABASE=psychobot
RDS_USER=admin
RDS_PASSWORD=[your-password]
```

### 6b. Ensure RDS Security Group allows Render

In AWS Console → RDS → Security Groups:

```
Inbound rule:
- Type: PostgreSQL
- Port: 5432
- Source: 0.0.0.0/0 (or Render IP)
```

## Step 7: Hybrid Approach (Markdown + RDS)

Services work in **dual mode**:

1. **Read from RDS** (if available)
2. **Fallback to Markdown** (if RDS down)
3. **Write to both** (sync)

This ensures:
- ✅ No data loss if RDS fails
- ✅ Gradual migration
- ✅ Easy rollback

```javascript
// Example: Try RDS first, then fallback
async function getApplications() {
    try {
        if (process.env.USE_RDS === 'true') {
            const apps = await loadFromRDS();
            return apps;
        }
    } catch (error) {
        console.log('RDS unavailable, using Markdown backup');
    }
    
    return loadFromMarkdown(); // Fallback
}
```

## Step 8: Data Migration Script

Create `scripts/migrate-to-rds.js`:

```javascript
#!/usr/bin/env node

require('dotenv').config({ path: '.env.production' });

const { query } = require('../src/services/rdsClient');
const followUpService = require('../src/services/followUpService');
const interviewPrepService = require('../src/services/interviewPrepService');

async function migrateApplications() {
    console.log('📋 Migrating applications to RDS...');
    
    const apps = followUpService.loadApplications();
    let count = 0;
    
    for (const app of apps) {
        try {
            await query(
                `INSERT INTO psychobot.applications 
                (company, role, status, score, applied_date, notes)
                VALUES ($1, $2, $3, $4, $5, $6)`,
                [app.company, app.role, app.status || 'Applied', 
                 app.score || 'B', app.appliedDate, app.notes || '']
            );
            count++;
            console.log(`✅ ${app.company}`);
        } catch (error) {
            console.error(`❌ ${app.company}: ${error.message}`);
        }
    }
    
    console.log(`\n✅ Migrated ${count}/${apps.length} applications`);
}

async function migrateStories() {
    console.log('\n📖 Migrating stories to RDS...');
    
    const stories = interviewPrepService.listAllStories();
    let count = 0;
    
    for (const story of stories) {
        try {
            await query(
                `INSERT INTO psychobot.stories 
                (title, situation, task, action, result, reflection, roles, confidence, keywords)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [story.title, story.situation, story.task, story.action,
                 story.result, story.reflection, 
                 JSON.stringify(story.roles), story.confidence,
                 JSON.stringify(story.keywords)]
            );
            count++;
            console.log(`✅ ${story.title}`);
        } catch (error) {
            console.error(`❌ ${story.title}: ${error.message}`);
        }
    }
    
    console.log(`\n✅ Migrated ${count}/${stories.length} stories`);
}

async function main() {
    try {
        console.log('🚀 Migrating to AWS RDS\n');
        
        // Test connection
        await query('SELECT 1');
        console.log('✅ Connected to RDS\n');
        
        await migrateApplications();
        await migrateStories();
        
        console.log('\n✅ Migration complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

main();
```

Run it:
```bash
npm install pg
node scripts/migrate-to-rds.js
```

## Step 9: Monitoring & Backups

### 9a. AWS RDS Backups

In AWS Console → RDS → Backups:
- Automated backups: 7 days (default)
- Manual backups: Create snapshot before major changes

### 9b. Query Monitoring

```javascript
// Log slow queries
const slowQueryThreshold = 1000; // 1 second

async function query(text, params) {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > slowQueryThreshold) {
        console.warn(`[SLOW QUERY] ${duration}ms: ${text.substring(0, 50)}`);
    }
    
    return result;
}
```

## Step 10: Production Checklist

- [ ] AWS RDS PostgreSQL instance running
- [ ] Security group allows Render IP
- [ ] RDS tables created (applications, stories, job_scores)
- [ ] RDS credentials in Render environment
- [ ] Data migration script tested
- [ ] Markdown fallback working
- [ ] CI/CD pipeline configured
- [ ] Backups enabled (AWS)
- [ ] Monitoring/logs enabled

## Costs

- **AWS RDS** (Free tier): $0/month for 12 months
- **Render Backend**: $7/month (always-on)
- **Render Frontend**: $0 (static)
- **Total**: ~$7/month

## Rollback Plan

If RDS has issues:

1. Set `USE_RDS=false` in Render environment
2. Services revert to Markdown files
3. Zero downtime
4. Fix RDS issue
5. Re-enable with `USE_RDS=true`

## Success Indicator

After migration, verify data:

```bash
# Connect to RDS
psql -h your-rds-host -U admin -d psychobot

# Check tables
SELECT COUNT(*) FROM psychobot.applications;
SELECT COUNT(*) FROM psychobot.stories;
```

**Your PsychoBot Dashboard is now production-ready on Render + AWS RDS!**
