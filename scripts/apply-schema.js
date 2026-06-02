#!/usr/bin/env node
/**
 * Apply PsychoBot schema to AWS RDS
 * Usage: node scripts/apply-schema.js
 * Requires: .env file with AWS_RDS_* variables
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.AWS_RDS_HOST,
  port: parseInt(process.env.AWS_RDS_PORT || '5432'),
  database: 'postgres',  // Connect to default db first
  user: process.env.AWS_RDS_USER,
  password: process.env.AWS_RDS_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function setupDatabase() {
  let client;
  try {
    console.log('[INFO] Connecting to AWS RDS...');
    client = await pool.connect();
    console.log('[INFO] ✅ Connected');

    // Create database
    const dbName = process.env.AWS_RDS_DATABASE || 'psychobot_prod';
    console.log(`[SQL] Creating database: ${dbName}`);

    try {
      await client.query(`CREATE DATABASE "${dbName}" WITH ENCODING 'UTF8';`);
      console.log('[SQL] ✅ Database created');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('[SQL] ⚠️ Database already exists (skipping)');
      } else {
        throw err;
      }
    }

    // Disconnect from default db
    client.release();

    // Connect to new database
    const mainPool = new Pool({
      host: process.env.AWS_RDS_HOST,
      port: parseInt(process.env.AWS_RDS_PORT || '5432'),
      database: dbName,
      user: process.env.AWS_RDS_USER,
      password: process.env.AWS_RDS_PASSWORD,
      ssl: { rejectUnauthorized: false }
    });

    const mainClient = await mainPool.connect();
    try {
      // Read schema file
      const schemaPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
      if (!fs.existsSync(schemaPath)) {
        throw new Error(`Schema file not found: ${schemaPath}`);
      }

      const schemaSql = fs.readFileSync(schemaPath, 'utf8');

      console.log('[SQL] Executing schema...');
      await mainClient.query(schemaSql);
      console.log('[SQL] ✅ Schema applied successfully');

      // Verify tables
      const result = await mainClient.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
      );

      console.log('[SQL] ✅ Tables created:');
      result.rows.forEach(row => {
        console.log(`      - ${row.table_name}`);
      });

      // Verify indexes
      const indexResult = await mainClient.query(
        "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'"
      );
      console.log(`[SQL] ✅ Indexes created: ${indexResult.rows.length}`);

      // Verify views
      const viewResult = await mainClient.query(
        "SELECT table_name FROM information_schema.views WHERE table_schema = 'public'"
      );
      if (viewResult.rows.length > 0) {
        console.log('[SQL] ✅ Views created:');
        viewResult.rows.forEach(row => {
          console.log(`      - ${row.table_name}`);
        });
      }

      // Get schema metadata
      const metaResult = await mainClient.query('SELECT * FROM system_metadata');
      console.log('[SQL] ✅ Schema metadata:');
      metaResult.rows.forEach(row => {
        console.log(`      - ${row.key}: ${row.value}`);
      });

    } finally {
      mainClient.release();
      await mainPool.end();
    }

    console.log('');
    console.log('================================');
    console.log('✅ Database setup complete!');
    console.log('================================');
    console.log('');
    console.log('PsychoBot is ready to use AWS RDS');
    console.log('Environment variables saved in: .env');
    console.log('');

  } catch (err) {
    console.error('[ERROR]', err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error('[ERROR] Could not connect to RDS. Check:');
      console.error('  - RDS instance is running');
      console.error('  - Endpoint is correct: ' + process.env.AWS_RDS_HOST);
      console.error('  - Security group allows inbound port 5432');
      console.error('  - Network can reach RDS (check VPC/subnet)');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();
