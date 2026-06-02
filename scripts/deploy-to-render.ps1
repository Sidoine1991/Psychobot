# PsychoBot Render Deployment Script
# Automates backend and frontend deployment

param(
    [string]$RdsHost = "",
    [string]$RdsUser = "",
    [string]$RdsPassword = "",
    [string]$RenderApiKey = "",
    [string]$Environment = "production"
)

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Cyan = "Cyan"

function Write-Status {
    param([string]$Message, [string]$Status)
    $color = switch($Status) {
        "OK" { $Green }
        "ERROR" { $Red }
        "WAIT" { $Yellow }
        default { $Cyan }
    }
    Write-Host "[$Status] $Message" -ForegroundColor $color
}

function Confirm-Deployment {
    Write-Host "`nDEPLOYMENT SUMMARY:" -ForegroundColor Cyan
    Write-Host "- Environment: $Environment"
    Write-Host "- RDS Host: $RdsHost"
    Write-Host "- RDS User: $RdsUser"
    Write-Host ""

    $confirm = Read-Host "Proceed with deployment? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Status "Deployment cancelled" "CANCELLED"
        exit 0
    }
}

# Phase 1: Validate Environment
Write-Status "Phase 1: Validating environment..." "WAIT"

if (-not (Test-Path ".env.production")) {
    Write-Status "Missing .env.production file" "ERROR"
    exit 1
}

if (-not (Test-Path "scripts/setup-psychobot-rds.py")) {
    Write-Status "Missing setup-psychobot-rds.py script" "ERROR"
    exit 1
}

Write-Status "Environment files found" "OK"

# Phase 2: Configure RDS
Write-Status "Phase 2: Configuring RDS credentials..." "WAIT"

if ([string]::IsNullOrEmpty($RdsHost)) {
    $RdsHost = Read-Host "Enter RDS Host"
}
if ([string]::IsNullOrEmpty($RdsUser)) {
    $RdsUser = Read-Host "Enter RDS User"
}
if ([string]::IsNullOrEmpty($RdsPassword)) {
    $RdsPassword = Read-Host "Enter RDS Password" -AsSecureString
    $RdsPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($RdsPassword))
}

# Set environment variables
$env:AWS_RDS_HOST = $RdsHost
$env:AWS_RDS_PORT = "5432"
$env:AWS_RDS_DATABASE = "psychobot"
$env:AWS_RDS_USER = $RdsUser
$env:AWS_RDS_PASSWORD = $RdsPassword
$env:AWS_RDS_SSLMODE = "require"

Write-Status "RDS credentials configured" "OK"

# Phase 3: Confirm deployment
Confirm-Deployment

# Phase 4: Setup RDS Schema
Write-Status "Phase 4: Setting up RDS schema..." "WAIT"

python scripts/setup-psychobot-rds.py
if ($LASTEXITCODE -ne 0) {
    Write-Status "RDS schema setup failed" "ERROR"
    exit 1
}

Write-Status "RDS schema created successfully" "OK"

# Phase 5: Build Backend
Write-Status "Phase 5: Building backend..." "WAIT"

npm install
if ($LASTEXITCODE -ne 0) {
    Write-Status "npm install failed" "ERROR"
    exit 1
}

npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Status "Backend build failed" "ERROR"
    exit 1
}

Write-Status "Backend built successfully" "OK"

# Phase 6: Build Frontend
Write-Status "Phase 6: Building frontend..." "WAIT"

npm run build:frontend
if ($LASTEXITCODE -ne 0) {
    Write-Status "Frontend build failed" "ERROR"
    exit 1
}

Write-Status "Frontend built successfully" "OK"

# Phase 7: Run Tests
Write-Status "Phase 7: Running tests..." "WAIT"

npm test
if ($LASTEXITCODE -ne 0) {
    Write-Status "Tests failed - deployment aborted" "ERROR"
    exit 1
}

Write-Status "All tests passed" "OK"

# Phase 8: Push to GitHub
Write-Status "Phase 8: Pushing to GitHub..." "WAIT"

git add .
git commit -m "chore: Deploy to production"
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Status "Git push failed" "ERROR"
    exit 1
}

Write-Status "Code pushed to GitHub" "OK"

# Phase 9: Trigger Render Deployment
Write-Status "Phase 9: Triggering Render deployment..." "WAIT"

if (-not [string]::IsNullOrEmpty($RenderApiKey)) {
    # Trigger backend deployment
    $BackendResponse = Invoke-RestMethod `
        -Uri "https://api.render.com/v1/services/srv-backend/deploy" `
        -Method POST `
        -Headers @{ "Authorization" = "Bearer $RenderApiKey" }

    # Trigger frontend deployment
    $FrontendResponse = Invoke-RestMethod `
        -Uri "https://api.render.com/v1/services/srv-frontend/deploy" `
        -Method POST `
        -Headers @{ "Authorization" = "Bearer $RenderApiKey" }

    Write-Status "Render deployment triggered" "OK"
    Write-Host "Backend Deploy ID: $($BackendResponse.id)"
    Write-Host "Frontend Deploy ID: $($FrontendResponse.id)"
} else {
    Write-Status "Render API Key not provided - manual deployment required" "WAIT"
    Write-Host "Go to https://dashboard.render.com and click 'Deploy' on both services"
}

# Phase 10: Verify Deployment
Write-Status "Phase 10: Verifying deployment..." "WAIT"

Start-Sleep -Seconds 30

$ApiUrl = "https://psychobot-api.onrender.com"
$HealthCheck = $null

try {
    $HealthCheck = Invoke-WebRequest -Uri "$ApiUrl/api/health" -ErrorAction SilentlyContinue
} catch {
    Write-Status "API health check failed - deployment may still be in progress" "WAIT"
    Write-Host "Check logs at: https://dashboard.render.com"
}

if ($HealthCheck.StatusCode -eq 200) {
    Write-Status "API is healthy" "OK"
} else {
    Write-Status "API health check warning" "WAIT"
}

# Final Summary
Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend API: https://psychobot-api.onrender.com"
Write-Host "Frontend: https://psychobot.onrender.com"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Monitor logs: https://dashboard.render.com"
Write-Host "2. Test API endpoints"
Write-Host "3. Verify database connectivity"
Write-Host "4. Enable auto-deploy in Render settings"
Write-Host ""
Write-Status "Deployment successful" "OK"
