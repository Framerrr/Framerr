const { createUser, listUsers } = require('../db/users');
const { hashPassword } = require('../auth/password');
const logger = require('../utils/logger');

async function createAdmin() {
    try {
        const users = await listUsers();
        if (users.length > 0) {
            logger.warn('Users already exist. Skipping admin creation.');
            console.log('Users already exist:', users.map(u => u.username).join(', '));
            return;
        }

        const password = 'password123';
        const passwordHash = await hashPassword(password);

        const user = await createUser({
            username: 'admin',
            passwordHash,
            displayName: 'Administrator',
            group: 'admin',
            preferences: {
                theme: 'dark'
            }
        });

        logger.info('Admin user created successfully');
        console.log('\n✅ Admin user created:');
        console.log('Username: admin');
        console.log('Password: password123');
        console.log('\nYou can now log in at http://localhost:5173/login\n');

    } catch (error) {
        logger.error('Failed to create admin', { error: error.message });
        console.error('Error:', error.message);
    }
}

createAdmin();
