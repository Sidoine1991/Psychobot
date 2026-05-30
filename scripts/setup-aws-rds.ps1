#!/usr/bin/env pwsh
#=============================================================================
# Setup AWS RDS for PsychoBot — Phase 1
# Purpose: Create PostgreSQL instance + BD + schema
# Usage: pwsh .\scripts\setup-aws-rds.ps1
#=============================================================================

param(
    [string]$DBName = "psychobot_prod",
    [string]$DBUser = "psychobot_app",
    [string]$DBPassword = "",
    [string]$DBInstanceId = "psychobot-db",
    [string]$Region = "us-east-1",
    [string]$InstanceClass = "db.t3.micro"
)

# Color output
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "[ERROR] $args" -ForegroundColor Red }

Write-Info "================================"
Write-Info "PsychoBot AWS RDS Setup — Phase 1"
Write-Info "================================"

# Step 1: Validate AWS credentials
Write-Info "Step 1: Validating AWS credentials..."
try {
    $identity = & aws sts get-caller-identity --region $Region 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "AWS credentials invalid or SSL issue"
        Write-Error $identity
        exit 1
    }
    Write-Info "✅ AWS credentials OK"
} catch {
    Write-Error "Failed to validate credentials: $_"
    exit 1
}

# Step 2: Check if DB instance already exists
Write-Info ""
Write-Info "Step 2: Checking if RDS instance exists..."
$exists = & aws rds describe-db-instances --db-instance-identifier $DBInstanceId --region $Region 2>&1 | grep -q "DBInstanceIdentifier"
if ($?) {
    Write-Warn "RDS instance '$DBInstanceId' already exists"
    Write-Info "Skipping creation..."
} else {
    # Step 3: Create RDS instance
    Write-Info ""
    Write-Info "Step 3: Creating RDS PostgreSQL instance..."
    Write-Info "  Instance: $DBInstanceId"
    Write-Info "  Class: $InstanceClass"
    Write-Info "  Region: $Region"

    # Generate password if not provided
    if ([string]::IsNullOrEmpty($DBPassword)) {
        $DBPassword = -join ((33..126) | Get-Random -Count 20 | % {[char]$_})
        Write-Warn "Generated random password (save this!): $DBPassword"
    }

    try {
        $result = & aws rds create-db-instance `
            --db-instance-identifier $DBInstanceId `
            --db-instance-class $InstanceClass `
            --engine postgres `
            --engine-version "15.3" `
            --master-username $DBUser `
            --master-user-password $DBPassword `
            --allocated-storage 20 `
            --storage-type gp2 `
            --publicly-accessible false `
            --no-multi-az `
            --region $Region `
            --tags "Key=Project,Value=PsychoBot" "Key=Environment,Value=Production" `
            2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Info "✅ RDS instance creation initiated"
            Write-Info "   (This takes 5-10 minutes...)"
        } else {
            Write-Error "Failed to create RDS instance: $result"
            exit 1
        }
    } catch {
        Write-Error "Exception creating RDS: $_"
        exit 1
    }

    # Step 4: Wait for instance to be available
    Write-Info ""
    Write-Info "Step 4: Waiting for RDS instance to be available..."
    $maxAttempts = 60
    $attempt = 0
    $available = $false

    while ($attempt -lt $maxAttempts) {
        $status = & aws rds describe-db-instances `
            --db-instance-identifier $DBInstanceId `
            --region $Region `
            --query 'DBInstances[0].DBInstanceStatus' `
            --output text 2>&1

        if ($status -eq "available") {
            $available = $true
            break
        }

        Write-Host "  Status: $status... (attempt $($attempt + 1)/$maxAttempts)" -ForegroundColor Cyan
        Start-Sleep -Seconds 10
        $attempt++
    }

    if (-not $available) {
        Write-Error "RDS instance did not become available after $(($maxAttempts * 10) / 60) minutes"
        exit 1
    }

    Write-Info "✅ RDS instance is available"
}

# Step 5: Get RDS endpoint
Write-Info ""
Write-Info "Step 5: Getting RDS endpoint..."
$endpoint = & aws rds describe-db-instances `
    --db-instance-identifier $DBInstanceId `
    --region $Region `
    --query 'DBInstances[0].Endpoint.Address' `
    --output text 2>&1

if ([string]::IsNullOrEmpty($endpoint)) {
    Write-Error "Could not retrieve RDS endpoint"
    exit 1
}

Write-Info "✅ RDS Endpoint: $endpoint"

# Step 6: Create database and schema
Write-Info ""
Write-Info "Step 6: Creating database and schema..."
Write-Info "  Host: $endpoint"
Write-Info "  User: $DBUser"
Write-Info "  Database: $DBName"

# Create .env file for connection
$envContent = @"
# AWS RDS PostgreSQL Configuration
# Generated: $(Get-Date)

AWS_RDS_HOST=$endpoint
AWS_RDS_PORT=5432
AWS_RDS_DATABASE=$DBName
AWS_RDS_USER=$DBUser
AWS_RDS_PASSWORD=$DBPassword
AWS_RDS_SSLMODE=require

# Retention policies
CONVERSATION_RETENTION_DAYS=90
MESSAGE_CACHE_RETENTION_DAYS=7
GREETING_TTL_HOURS=24

# Enable RDS
USE_AWS_RDS=true
"@

$envPath = "D:\Dev\Depot Github\Psychobot\.env.rds"
$envContent | Set-Content -Path $envPath -Encoding UTF8
Write-Info "✅ .env file created: $envPath"
Write-Warn "⚠️ SAVE THIS FILE — contains your database credentials!"

# Step 7: Execute schema SQL (using Node.js script)
Write-Info ""
Write-Info "Step 7: Executing schema SQL..."
Write-Info "  You'll need to run: npm install pg && node scripts/apply-schema.js"

# Create apply-schema.js script
$schemaScript = @"
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.AWS_RDS_HOST,
  port: parseInt(process.env.AWS_RDS_PORT || '5432'),
  database: 'postgres',  // Connect to default db first
  user: process.env.AWS_RDS_USER,
  password: process.env.AWS_RDS_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function setupDatabase() {
  const client = await pool.connect();
  try {
    // Create database
    console.log('[SQL] Creating database...');
    await client.query(`CREATE DATABASE \`$DBName\` WITH ENCODING 'UTF8';`).catch(() => {
      console.log('[SQL] Database already exists');
    });

    // Connect to new database
    await client.end();

    const mainPool = new Pool({
      host: process.env.AWS_RDS_HOST,
      port: parseInt(process.env.AWS_RDS_PORT || '5432'),
      database: '$DBName',
      user: process.env.AWS_RDS_USER,
      password: process.env.AWS_RDS_PASSWORD,
      ssl: { rejectUnauthorized: false }
    });

    const mainClient = await mainPool.connect();
    try {
      // Read and execute schema
      const schemaPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');

      console.log('[SQL] Executing schema...');
      await mainClient.query(schemaSql);
      console.log('[SQL] ✅ Schema applied successfully');

      // Verify tables
      const result = await mainClient.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
      );
      console.log('[SQL] Tables created:', result.rows.map(r => r.table_name).join(', '));

    } finally {
      mainClient.release();
    }
  } finally {
    await pool.end();
  }
}

setupDatabase().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
"@

$scriptPath = "D:\Dev\Depot Github\Psychobot\scripts\apply-schema.js"
$schemaScript | Set-Content -Path $scriptPath -Encoding UTF8
Write-Info "✅ Schema apply script created: $scriptPath"

# Final summary
Write-Info ""
Write-Info "================================"
Write-Info "✅ AWS RDS Setup Complete!"
Write-Info "================================"
Write-Info ""
Write-Info "Configuration saved to: $envPath"
Write-Info ""
Write-Info "Next steps:"
Write-Info "1. Copy .env.rds variables to your .env file"
Write-Info "2. Run: cd D:\Dev\Depot Github\Psychobot"
Write-Info "3. Run: npm install pg"
Write-Info "4. Run: node scripts/apply-schema.js"
Write-Info ""
Write-Info "RDS Endpoint: $endpoint"
Write-Info "Database: $DBName"
Write-Info "User: $DBUser"
Write-Info ""
Write-Info "⚠️ Keep .env.rds safe — it contains credentials!"
