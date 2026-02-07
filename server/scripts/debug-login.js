const fs = require('fs').promises;
const path = require('path');
const { getUser } = require('../db/users');
const { verifyPassword } = require('../auth/password');
const { getSystemConfig } = require('../db/systemConfig');

async function debugLogin() {
    console.log('=== DEBUGGING LOGIN ===\n');

    try {
        // 1. Check Config
        console.log('1. Checking System Config...');
        const config = await getSystemConfig();
        console.log('Auth Config:', JSON.stringify(config.auth, null, 2));

        if (!config.auth.local.enabled) {
            console.error('❌ Local auth is DISABLED!');
        } else {
            console.log('✅ Local auth is ENABLED');
        }

        // 2. Check User
        console.log('\n2. Checking Admin User...');
        const user = await getUser('admin');
        if (!user) {
            console.error('❌ User "admin" NOT FOUND in database!');
        } else {
            console.log('✅ User "admin" found');
            console.log('User Data:', JSON.stringify({ ...user, passwordHash: '[HIDDEN]' }, null, 2));

            // 3. Verify Password
            console.log('\n3. Verifying Password...');
            const isValid = await verifyPassword('password123', user.passwordHash);
            if (isValid) {
                console.log('✅ Password "password123" is VALID');
            } else {
                console.error('❌ Password "password123" is INVALID');
            }
        }

    } catch (error) {
        console.error('\n❌ Error during debug:', error.message);
    }
}

debugLogin();
