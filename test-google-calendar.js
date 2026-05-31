/**
 * Test Google Calendar Integration
 * Verify authentication and basic operations
 */

require('dotenv').config();
const googleAuth = require('./src/integrations/googleAuth');
const googleCalendar = require('./src/services/googleCalendar');

async function runTests() {
    console.log('=' .repeat(80));
    console.log('  GOOGLE CALENDAR INTEGRATION TEST');
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

    // Test 2: Fetch today's events
    console.log('TEST 2: Fetch Today Events');
    console.log('-'.repeat(80));
    try {
        const events = await googleCalendar.getTodayEvents();
        console.log(`✅ Found ${events.length} events today`);

        if (events.length > 0) {
            events.forEach((event, index) => {
                console.log(`\n   ${index + 1}. ${event.summary}`);
                console.log(`      Time: ${event.startTime.toLocaleString('fr-FR')}`);
                if (event.description) {
                    console.log(`      Description: ${event.description}`);
                }
            });
        } else {
            console.log('   (No events scheduled for today)');
        }
    } catch (error) {
        console.log('❌ Error fetching events:', error.message);
    }
    console.log();

    // Test 3: Create test event
    console.log('TEST 3: Create Test Event');
    console.log('-'.repeat(80));
    try {
        const testDate = new Date();
        testDate.setHours(testDate.getHours() + 2); // 2 hours from now

        const event = await googleCalendar.createEvent({
            summary: 'KolaBoT Test Event',
            description: 'Test event created by automated test',
            startDateTime: testDate.toISOString(),
            location: 'Virtual'
        });

        console.log('✅ Event created successfully');
        console.log(`   ID: ${event.id}`);
        console.log(`   Summary: ${event.summary}`);
        console.log(`   Start: ${event.startTime.toLocaleString('fr-FR')}`);
        console.log(`   Link: ${event.htmlLink}`);
        console.log();
        console.log('⚠️  Note: Please delete this test event manually from your calendar');

    } catch (error) {
        console.log('❌ Error creating event:', error.message);
    }
    console.log();

    // Test 4: Parse natural language
    console.log('TEST 4: Natural Language Parsing');
    console.log('-'.repeat(80));
    const testCases = [
        "aujourd'hui 16h",
        "demain 10h30",
        "01/06 14h",
        "rdv aujourd'hui 16h pour site web restaurant"
    ];

    testCases.forEach(testCase => {
        const parsed = googleCalendar.parseDateTime(testCase);
        if (parsed) {
            console.log(`✅ "${testCase}"`);
            console.log(`   → ${parsed.toLocaleString('fr-FR')}`);
        } else {
            console.log(`❌ "${testCase}"`);
            console.log(`   → Failed to parse`);
        }
    });
    console.log();

    // Summary
    console.log('=' .repeat(80));
    console.log('  TEST SUMMARY');
    console.log('=' .repeat(80));
    console.log();
    console.log('✅ If all tests passed, Google Calendar integration is working!');
    console.log();
    console.log('Next steps:');
    console.log('1. Add variables to Render Environment:');
    console.log('   • GOOGLE_CLIENT_EMAIL');
    console.log('   • GOOGLE_PRIVATE_KEY');
    console.log('   • GOOGLE_CALENDAR_ID');
    console.log();
    console.log('2. Share Calendar with Service Account:');
    console.log(`   Email: ${process.env.GOOGLE_CLIENT_EMAIL || 'kolabot@kolabot-agent.iam.gserviceaccount.com'}`);
    console.log();
    console.log('3. Test commands on WhatsApp:');
    console.log('   • !calendar');
    console.log('   • !planifier demain 10h Test meeting');
    console.log();
    console.log('=' .repeat(80));
}

// Run tests
runTests().catch(console.error);
