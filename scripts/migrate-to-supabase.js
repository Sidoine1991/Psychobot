#!/usr/bin/env node

/**
 * Migration script: Markdown data → Supabase
 * Usage: node scripts/migrate-to-supabase.js
 */

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const followUpService = require('../src/services/followUpService');
const interviewPrepService = require('../src/services/interviewPrepService');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: SUPABASE_URL and SUPABASE_KEY environment variables required');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateApplications() {
    console.log('\n📋 Migrating applications...');

    try {
        const apps = followUpService.loadApplications();

        if (apps.length === 0) {
            console.log('   No applications to migrate');
            return 0;
        }

        let migratedCount = 0;

        for (const app of apps) {
            const { error } = await supabase
                .from('applications')
                .insert([{
                    company: app.company,
                    role: app.role,
                    status: app.status || 'Applied',
                    score: app.score || 'B',
                    applied_date: app.appliedDate,
                    next_followup: app.nextFollowUp,
                    notes: app.notes || ''
                }]);

            if (error) {
                console.error(`   ❌ Error migrating ${app.company}: ${error.message}`);
            } else {
                migratedCount++;
                console.log(`   ✅ ${app.company} - ${app.role}`);
            }
        }

        console.log(`\n✅ Migrated ${migratedCount}/${apps.length} applications`);
        return migratedCount;
    } catch (error) {
        console.error('❌ Migration error:', error.message);
        throw error;
    }
}

async function migrateStories() {
    console.log('\n📖 Migrating interview stories...');

    try {
        const stories = interviewPrepService.listAllStories();

        if (stories.length === 0) {
            console.log('   No stories to migrate');
            return 0;
        }

        let migratedCount = 0;

        for (const story of stories) {
            const { error } = await supabase
                .from('stories')
                .insert([{
                    title: story.title,
                    situation: story.situation,
                    task: story.task,
                    action: story.action,
                    result: story.result,
                    reflection: story.reflection,
                    roles: story.roles || [],
                    confidence: story.confidence || 'Medium',
                    keywords: story.keywords || []
                }]);

            if (error) {
                console.error(`   ❌ Error migrating ${story.title}: ${error.message}`);
            } else {
                migratedCount++;
                console.log(`   ✅ ${story.title}`);
            }
        }

        console.log(`\n✅ Migrated ${migratedCount}/${stories.length} stories`);
        return migratedCount;
    } catch (error) {
        console.error('❌ Migration error:', error.message);
        throw error;
    }
}

async function verifyMigration() {
    console.log('\n🔍 Verifying migration...');

    try {
        const { count: appCount, error: appError } = await supabase
            .from('applications')
            .select('*', { count: 'exact' });

        const { count: storyCount, error: storyError } = await supabase
            .from('stories')
            .select('*', { count: 'exact' });

        if (appError || storyError) {
            console.error('❌ Verification failed');
            return false;
        }

        console.log(`\n📊 Supabase Status:`);
        console.log(`   Applications: ${appCount || 0} records`);
        console.log(`   Stories: ${storyCount || 0} records`);

        return true;
    } catch (error) {
        console.error('❌ Verification error:', error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Starting migration: Markdown → Supabase\n');
    console.log('═'.repeat(50));

    try {
        // Test connection
        console.log('🔌 Testing Supabase connection...');
        const { data, error } = await supabase.from('applications').select('count');

        if (error) {
            console.error('❌ Failed to connect to Supabase:', error.message);
            process.exit(1);
        }
        console.log('✅ Connected to Supabase\n');

        // Migrate
        const appsCount = await migrateApplications();
        const storiesCount = await migrateStories();

        // Verify
        const verified = await verifyMigration();

        console.log('\n' + '═'.repeat(50));
        if (verified && appsCount >= 0 && storiesCount >= 0) {
            console.log('✅ Migration completed successfully!\n');
            console.log('Next steps:');
            console.log('1. Verify data in Supabase dashboard');
            console.log('2. Update services to read from Supabase');
            console.log('3. Test dashboard functionality');
            console.log('4. Deploy to production\n');
        } else {
            console.log('⚠️  Migration completed with warnings. Check logs above.\n');
        }

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    }
}

main();
