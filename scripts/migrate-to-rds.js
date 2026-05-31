#!/usr/bin/env node

/**
 * Migration script: Markdown data → AWS RDS PostgreSQL
 * Usage: node scripts/migrate-to-rds.js
 *
 * Requires:
 * - .env.production with RDS credentials
 * - npm install pg
 */

require('dotenv').config({ path: '.env.production' });

const { Pool } = require('pg');
const followUpService = require('../src/services/followUpService');
const interviewPrepService = require('../src/services/interviewPrepService');

// RDS Connection
const pool = new Pool({
    host: process.env.RDS_HOST,
    port: process.env.RDS_PORT || 5432,
    database: process.env.RDS_DATABASE,
    user: process.env.RDS_USER,
    password: process.env.RDS_PASSWORD,
});

async function query(text, params) {
    return await pool.query(text, params);
}

async function testConnection() {
    try {
        await query('SELECT NOW()');
        console.log('✅ Connected to RDS PostgreSQL\n');
        return true;
    } catch (error) {
        console.error('❌ Failed to connect to RDS:', error.message);
        return false;
    }
}

async function createSchema() {
    console.log('📋 Creating schema...');
    try {
        await query(`
            CREATE SCHEMA IF NOT EXISTS psychobot;

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

            CREATE TABLE IF NOT EXISTS psychobot.job_scores (
                id SERIAL PRIMARY KEY,
                company VARCHAR(255) NOT NULL,
                role VARCHAR(255) NOT NULL,
                overall_score VARCHAR(1),
                numeric_score INT,
                dimensions JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_applications_company
                ON psychobot.applications(company);
            CREATE INDEX IF NOT EXISTS idx_applications_status
                ON psychobot.applications(status);
            CREATE INDEX IF NOT EXISTS idx_stories_title
                ON psychobot.stories(title);
        `);
        console.log('✅ Schema created\n');
        return true;
    } catch (error) {
        console.error('❌ Schema creation failed:', error.message);
        return false;
    }
}

async function migrateApplications() {
    console.log('📋 Migrating applications...');

    try {
        const apps = followUpService.loadApplications();

        if (apps.length === 0) {
            console.log('   (No applications to migrate)\n');
            return 0;
        }

        let successCount = 0;

        for (const app of apps) {
            try {
                await query(
                    `INSERT INTO psychobot.applications
                    (company, role, status, score, applied_date, notes)
                    VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        app.company,
                        app.role,
                        app.status || 'Applied',
                        app.score || 'B',
                        app.appliedDate,
                        app.notes || ''
                    ]
                );
                console.log(`   ✅ ${app.company} - ${app.role}`);
                successCount++;
            } catch (error) {
                console.error(`   ❌ ${app.company}: ${error.message}`);
            }
        }

        console.log(`\n✅ Migrated ${successCount}/${apps.length} applications\n`);
        return successCount;
    } catch (error) {
        console.error('❌ Migration error:', error.message);
        return 0;
    }
}

async function migrateStories() {
    console.log('📖 Migrating interview stories...');

    try {
        const stories = interviewPrepService.listAllStories();

        if (stories.length === 0) {
            console.log('   (No stories to migrate)\n');
            return 0;
        }

        let successCount = 0;

        for (const story of stories) {
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
                        JSON.stringify(story.roles || []),
                        story.confidence || 'Medium',
                        JSON.stringify(story.keywords || [])
                    ]
                );
                console.log(`   ✅ ${story.title}`);
                successCount++;
            } catch (error) {
                console.error(`   ❌ ${story.title}: ${error.message}`);
            }
        }

        console.log(`\n✅ Migrated ${successCount}/${stories.length} stories\n`);
        return successCount;
    } catch (error) {
        console.error('❌ Migration error:', error.message);
        return 0;
    }
}

async function verifyMigration() {
    console.log('🔍 Verifying migration...');

    try {
        const appsResult = await query('SELECT COUNT(*) FROM psychobot.applications');
        const storiesResult = await query('SELECT COUNT(*) FROM psychobot.stories');

        const appCount = parseInt(appsResult.rows[0].count);
        const storyCount = parseInt(storiesResult.rows[0].count);

        console.log(`\n📊 Data in RDS:`);
        console.log(`   Applications: ${appCount} records`);
        console.log(`   Stories: ${storyCount} records\n`);

        return true;
    } catch (error) {
        console.error('❌ Verification error:', error.message);
        return false;
    }
}

async function main() {
    console.log('\n' + '═'.repeat(60));
    console.log('🚀 PsychoBot - Markdown → AWS RDS Migration');
    console.log('═'.repeat(60) + '\n');

    try {
        // Check environment
        if (!process.env.RDS_HOST || !process.env.RDS_USER) {
            console.error('❌ Error: RDS credentials not found in .env.production');
            console.error('   Required: RDS_HOST, RDS_PORT, RDS_DATABASE, RDS_USER, RDS_PASSWORD');
            process.exit(1);
        }

        // Connect
        if (!(await testConnection())) {
            process.exit(1);
        }

        // Create schema
        if (!(await createSchema())) {
            process.exit(1);
        }

        // Migrate data
        const appsCount = await migrateApplications();
        const storiesCount = await migrateStories();

        // Verify
        await verifyMigration();

        console.log('═'.repeat(60));
        console.log('✅ Migration completed successfully!\n');
        console.log('Next steps:');
        console.log('1. Set USE_RDS=true in Render environment');
        console.log('2. Verify data appears in dashboard');
        console.log('3. Monitor logs for any issues');
        console.log('4. Keep Markdown files as backup\n');
        console.log('═'.repeat(60) + '\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
