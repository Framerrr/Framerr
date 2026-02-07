/**
 * Test Script: Verify Overseerr returns Radarr API keys
 * 
 * Run with: npx ts-node scripts/test-overseerr-apikey.ts
 * 
 * This script tests whether we can match Radarr instances by API key:
 * 1. Gets Radarr servers from Overseerr's /settings/radarr endpoint
 * 2. Shows whether apiKey is included in the response
 */

// You'll need to fill in these values:
const OVERSEERR_URL = 'http://192.168.6.141:5056';  // e.g., http://localhost:5055
const OVERSEERR_API_KEY = 'MTc1NTg5OTAzNjUzMTRjOWU1MDFhLWFmMWItNGEzZC04MDFhLTliMDEzZmExYThlNQ==';

async function testOverseerrApiKeys() {
    console.log('=== Testing Overseerr API Key Exposure ===\n');

    try {
        // Test 1: Call /api/v1/service/radarr (current endpoint - likely no apiKey)
        console.log('1. Testing /api/v1/service/radarr (current endpoint)...');
        const serviceResponse = await fetch(`${OVERSEERR_URL}/api/v1/service/radarr`, {
            headers: { 'X-Api-Key': OVERSEERR_API_KEY }
        });
        const serviceData = await serviceResponse.json();

        console.log('   Response fields:', Object.keys(serviceData[0] || {}));
        console.log('   Has apiKey?', serviceData[0]?.apiKey ? 'YES ✓' : 'NO ✗');
        if (serviceData[0]?.apiKey) {
            console.log('   apiKey (first 10 chars):', serviceData[0].apiKey.substring(0, 10) + '...');
        }
        console.log('   Full response sample:', JSON.stringify(serviceData[0], null, 2));

        console.log('\n---\n');

        // Test 2: Call /settings/radarr (should include apiKey)
        console.log('2. Testing /settings/radarr (settings endpoint)...');
        const settingsResponse = await fetch(`${OVERSEERR_URL}/api/v1/settings/radarr`, {
            headers: { 'X-Api-Key': OVERSEERR_API_KEY }
        });
        const settingsData = await settingsResponse.json();

        // Settings might return array or single object
        const servers = Array.isArray(settingsData) ? settingsData : [settingsData];

        console.log('   Response fields:', Object.keys(servers[0] || {}));
        console.log('   Has apiKey?', servers[0]?.apiKey ? 'YES ✓' : 'NO ✗');
        if (servers[0]?.apiKey) {
            console.log('   apiKey (first 10 chars):', servers[0].apiKey.substring(0, 10) + '...');
        }
        console.log('   Full response sample:', JSON.stringify(servers[0], null, 2));

        console.log('\n=== Summary ===');
        console.log('/service/radarr has apiKey:', serviceData[0]?.apiKey ? 'YES' : 'NO');
        console.log('/settings/radarr has apiKey:', servers[0]?.apiKey ? 'YES' : 'NO');

        if (servers[0]?.apiKey) {
            console.log('\n✅ API Key matching will work! We can use /settings/radarr');
        } else if (serviceData[0]?.apiKey) {
            console.log('\n✅ API Key matching will work! We can use /service/radarr');
        } else {
            console.log('\n❌ Neither endpoint returns apiKey. Need alternative matching.');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testOverseerrApiKeys();
