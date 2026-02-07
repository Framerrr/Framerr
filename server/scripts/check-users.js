// Quick check script for debugging users
const { listUsers } = require('../db/users');

console.log('=== USER DATABASE CHECK ===\n');

(async () => {
    try {
        const users = await listUsers();

        console.log(`Total users: ${users.length}`);
        console.log('\nUsers found:');
        users.forEach(user => {
            console.log(`- ${user.username} (${user.groupId}) - Created: ${new Date(user.createdAt * 1000).toISOString()}`);
        });

        if (users.length === 0) {
            console.log('\n⚠️  No users found!');
            console.log('👉 Run: node server/scripts/create-admin.js');
        }
    } catch (error) {
        console.error('Error reading users database:', error.message);
        process.exit(1);
    }
})();

