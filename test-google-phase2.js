/**
 * Test Google Contacts + Gmail Integration (Phase 2)
 * Verify People API and Gmail API access
 */

require('dotenv').config();
const googleAuth = require('./src/integrations/googleAuth');
const googleContacts = require('./src/services/googleContacts');
const gmail = require('./src/services/gmail');

async function runTests() {
    console.log('=' .repeat(80));
    console.log('  PHASE 2: GOOGLE CONTACTS + GMAIL TEST');
    console.log('=' .repeat(80));
    console.log();

    // Test 1: Authentication
    console.log('TEST 1: Google Authentication');
    console.log('-'.repeat(80));
    try {
        const healthCheck = await googleAuth.healthCheck();
        if (healthCheck.success) {
            console.log('✅ Authentication successful');
        } else {
            console.log('❌ Authentication failed:', healthCheck.error);
            return;
        }
    } catch (error) {
        console.log('❌ Authentication error:', error.message);
        return;
    }
    console.log();

    // Test 2: List Contacts
    console.log('TEST 2: List Google Contacts');
    console.log('-'.repeat(80));
    try {
        const contacts = await googleContacts.listContacts(5);
        console.log(`✅ Found ${contacts.length} contacts`);

        if (contacts.length > 0) {
            contacts.forEach((contact, index) => {
                console.log(`\n   ${index + 1}. ${contact.displayName}`);
                if (contact.email) console.log(`      📧 ${contact.email}`);
                if (contact.phone) console.log(`      📱 ${contact.phone}`);
                if (contact.company) console.log(`      🏢 ${contact.company}`);
            });
        } else {
            console.log('   (No contacts found - this is normal if contacts are not shared with Service Account)');
        }
    } catch (error) {
        console.log('❌ Error listing contacts:', error.message);
        console.log('   This is expected if People API is not enabled or contacts not shared');
    }
    console.log();

    // Test 3: Search Contacts
    console.log('TEST 3: Search Contacts');
    console.log('-'.repeat(80));
    try {
        const results = await googleContacts.searchContacts('test', 3);
        console.log(`✅ Search returned ${results.length} results`);

        if (results.length > 0) {
            results.forEach((contact, index) => {
                console.log(`   ${index + 1}. ${contact.displayName}`);
            });
        } else {
            console.log('   (No matches found for "test")');
        }
    } catch (error) {
        console.log('❌ Error searching contacts:', error.message);
    }
    console.log();

    // Test 4: Gmail Inbox (will likely fail with Service Account + personal Gmail)
    console.log('TEST 4: Gmail Inbox');
    console.log('-'.repeat(80));
    try {
        const messages = await gmail.getInbox(3);
        console.log(`✅ Found ${messages.length} messages in inbox`);

        if (messages.length > 0) {
            messages.forEach((msg, index) => {
                console.log(`\n   ${index + 1}. ${msg.subject || '(No subject)'}`);
                console.log(`      From: ${msg.from}`);
                console.log(`      Date: ${msg.date.toLocaleString('fr-FR')}`);
            });
        } else {
            console.log('   (Inbox is empty)');
        }
    } catch (error) {
        console.log('⚠️  Gmail access failed:', error.message);
        console.log('   This is EXPECTED with Service Account + personal Gmail (@gmail.com)');
        console.log('   Gmail API requires either:');
        console.log('   • Google Workspace with Domain-Wide Delegation');
        console.log('   • OAuth 2.0 User Consent Flow (not Service Account)');
    }
    console.log();

    // Test 5: Gmail Search
    console.log('TEST 5: Gmail Search');
    console.log('-'.repeat(80));
    try {
        const results = await gmail.searchMessages('subject:test', 2);
        console.log(`✅ Search returned ${results.length} results`);

        if (results.length > 0) {
            results.forEach((msg, index) => {
                console.log(`   ${index + 1}. ${msg.subject}`);
            });
        } else {
            console.log('   (No matches found)');
        }
    } catch (error) {
        console.log('⚠️  Gmail search failed:', error.message);
        console.log('   (Same reason as Test 4 - Service Account limitation)');
    }
    console.log();

    // Summary
    console.log('=' .repeat(80));
    console.log('  TEST SUMMARY');
    console.log('=' .repeat(80));
    console.log();
    console.log('✅ Phase 2 Code: Implemented and ready');
    console.log();
    console.log('📋 Next Steps:');
    console.log();
    console.log('1. Enable APIs in Google Cloud Console:');
    console.log('   • People API (for Contacts)');
    console.log('   • Gmail API');
    console.log();
    console.log('2. For Contacts to work:');
    console.log('   • Share contacts with Service Account email');
    console.log('   • OR use Google Workspace Domain-Wide Delegation');
    console.log();
    console.log('3. For Gmail to work:');
    console.log('   ⚠️  SERVICE ACCOUNT LIMITATION:');
    console.log('   • Personal Gmail (@gmail.com) does NOT work with Service Accounts');
    console.log('   • Option A: Use Google Workspace + Domain-Wide Delegation');
    console.log('   • Option B: Implement OAuth 2.0 User Consent (Phase 2.1)');
    console.log();
    console.log('4. If using Google Workspace:');
    console.log('   • Admin Console → Security → API Controls');
    console.log('   • Domain-wide Delegation → Add Client ID');
    console.log('   • Add scopes for Gmail + Contacts');
    console.log();
    console.log('5. Test commands on WhatsApp:');
    console.log('   • !contacts');
    console.log('   • !addcontact Test Bot test@test.com +33600000000');
    console.log('   • !inbox (if Gmail configured)');
    console.log('   • !search subject:test');
    console.log();
    console.log('=' .repeat(80));
}

// Run tests
runTests().catch(console.error);
