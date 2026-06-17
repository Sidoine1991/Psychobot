#!/usr/bin/env node
/**
 * Test Pullback Webhook
 * Tests the /pullback-webhook endpoint
 */

const axios = require('axios');

const WEBHOOK_URL = 'http://localhost:3000/pullback-webhook';

async function testWebhook() {
    console.log('🧪 Testing Pullback Webhook...\n');

    // Test event
    const testEvent = {
        phase: 'pullback_start',
        symbol: 'Boom 150 Index',
        direction: 'BUY',
        breakout_price: 1456.23,
        gom_level: 'PERFECT BUY',
        gom_confidence: 0.85,
        gom_coherence: 75.0,
        message_preview: `🎯 *PULLBACK ENTRY INITIATED*\n\n🟢 *Boom 150 Index* — BUY\nEntry Level: 1456.23\n\n📊 *GOM Context:*\nGOM Level: PERFECT BUY\nConfidence: 85%\nCoherence: 75%`
    };

    try {
        console.log(`📤 Sending test event to ${WEBHOOK_URL}`);
        console.log(`Event: ${JSON.stringify(testEvent, null, 2)}\n`);

        const response = await axios.post(WEBHOOK_URL, testEvent, {
            timeout: 5000
        });

        console.log('✅ Response received:');
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.success) {
            console.log('\n🎉 Webhook test PASSED!');
        } else {
            console.log('\n❌ Webhook test FAILED - success=false');
        }

    } catch (error) {
        if (error.response) {
            console.error('❌ HTTP Error:', error.response.status);
            console.error('Response:', error.response.data);
        } else if (error.code === 'ECONNREFUSED') {
            console.error('❌ Connection refused - is PsychoBot server running on port 3000?');
            console.error('   Start it with: npm start (in Psychobot directory)');
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

testWebhook();
