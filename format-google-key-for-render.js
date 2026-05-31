/**
 * Format Google Private Key for Render Environment Variable
 * Converts multiline key to single line with \n escapes
 */

const fs = require('fs');
const path = require('path');

// Read the service account JSON file
const credentialsPath = path.join(__dirname, 'kolabot-agent-3931f21ef414.json');

if (!fs.existsSync(credentialsPath)) {
    console.error('❌ File not found: kolabot-agent-3931f21ef414.json');
    console.error('   Please place the JSON file in the Psychobot directory');
    process.exit(1);
}

const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));

console.log('═'.repeat(80));
console.log('  GOOGLE CREDENTIALS FOR RENDER ENVIRONMENT VARIABLES');
console.log('═'.repeat(80));
console.log();

console.log('📋 Copy these values to Render Dashboard → Environment:');
console.log();

console.log('─'.repeat(80));
console.log('VARIABLE: GOOGLE_CLIENT_EMAIL');
console.log('─'.repeat(80));
console.log(credentials.client_email);
console.log();

console.log('─'.repeat(80));
console.log('VARIABLE: GOOGLE_PRIVATE_KEY');
console.log('─'.repeat(80));
console.log('⚠️  OPTION 1 - Copy EXACTLY (with quotes):');
console.log();
console.log(JSON.stringify(credentials.private_key));
console.log();
console.log('⚠️  OPTION 2 - If Render adds quotes automatically, use without quotes:');
console.log();
console.log(credentials.private_key.replace(/\n/g, '\\n'));
console.log();

console.log('─'.repeat(80));
console.log('VARIABLE: GOOGLE_CALENDAR_ID');
console.log('─'.repeat(80));
console.log('syebadokpo@gmail.com');
console.log();

console.log('═'.repeat(80));
console.log('  INSTRUCTIONS');
console.log('═'.repeat(80));
console.log();
console.log('1. Go to Render Dashboard → Your Service → Environment');
console.log('2. Add/Edit these 3 variables with the values above');
console.log('3. IMPORTANT: For GOOGLE_PRIVATE_KEY, copy the ENTIRE line');
console.log('   including quotes if shown, or paste without quotes if Render');
console.log('   automatically adds them');
console.log('4. Click "Save Changes"');
console.log('5. Render will automatically redeploy');
console.log('6. Test !calendar command on WhatsApp');
console.log();
console.log('═'.repeat(80));
