#!/usr/bin/env node
/**
 * Framerr CLI
 * 
 * Admin command-line tool for Framerr server management.
 * 
 * Usage:
 *   framerr reset-password -u <username>
 * 
 * In development:
 *   npx ts-node server/scripts/cli.ts reset-password -u <username>
 * 
 * In Docker:
 *   framerr reset-password -u <username>
 */

import { createInterface } from 'readline';
import path from 'path';

// ============================================
// Readline helpers
// ============================================

function createPrompt() {
    return createInterface({
        input: process.stdin,
        output: process.stdout,
    });
}

function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer));
    });
}


// ============================================
// Database helpers (direct access, no Express)
// ============================================

function getDatabase() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = require('better-sqlite3');
    const dataDir = process.env.DATA_DIR || path.resolve(__dirname, '../../data');
    const dbPath = path.join(dataDir, 'framerr.db');
    return new Database(dbPath);
}

// ============================================
// reset-password command
// ============================================

async function resetPassword(username: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bcrypt = require('bcryptjs');

    console.log('');
    console.log('🔐 Framerr Password Reset');
    console.log('─'.repeat(40));

    const db = getDatabase();

    // Find user
    const user = db.prepare('SELECT id, username FROM users WHERE LOWER(username) = LOWER(?)').get(username) as { id: string; username: string } | undefined;

    if (!user) {
        console.error(`\n❌ User "${username}" not found.`);
        const allUsers = db.prepare('SELECT username FROM users').all() as { username: string }[];
        if (allUsers.length > 0) {
            console.log('\nAvailable users:');
            allUsers.forEach(u => console.log(`  • ${u.username}`));
        }
        db.close();
        process.exit(1);
    }

    console.log(`User: ${user.username}`);
    console.log('');

    const rl = createPrompt();

    // Ask for password or auto-generate
    let newPassword: string;
    const passwordInput = await ask(rl, 'Enter new password (or press Enter to auto-generate): ');

    if (passwordInput.trim()) {
        // Confirm password
        const confirm = await ask(rl, 'Confirm password: ');
        if (passwordInput !== confirm) {
            console.error('\n❌ Passwords do not match.');
            rl.close();
            db.close();
            process.exit(1);
        }
        newPassword = passwordInput;
    } else {
        // Auto-generate
        newPassword = 'temp' + Math.random().toString(36).substr(2, 8);
        console.log('  (auto-generated)');
    }

    // Ask about force-change
    const forceChangeAnswer = await ask(rl, 'Require password change on next login? (Y/n): ');
    const forceChange = forceChangeAnswer.trim().toLowerCase() !== 'n';

    rl.close();

    // Hash and update
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    db.prepare('UPDATE users SET password = ?, require_password_reset = ? WHERE id = ?')
        .run(passwordHash, forceChange ? 1 : 0, user.id);

    // Revoke all sessions
    const sessionsDeleted = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

    db.close();

    // Output results
    console.log('');
    console.log('─'.repeat(40));
    console.log(`✅ Password updated for "${user.username}"`);
    console.log(`🔑 New password: ${newPassword}`);
    console.log(`✅ ${sessionsDeleted.changes} session(s) revoked`);
    if (forceChange) {
        console.log('✅ User will be required to change password on next login');
    } else {
        console.log('ℹ️  User will NOT be required to change password on next login');
    }
    console.log('');
}

// ============================================
// Main CLI router
// ============================================

function showHelp(): void {
    console.log(`
Framerr CLI - Server Management Tool

Usage:
  framerr <command> [options]

Commands:
  reset-password -u <username>    Reset a user's password

Options:
  -u, --username <name>    Target username (required for reset-password)
  -h, --help               Show this help message

Examples:
  framerr reset-password -u admin
  framerr reset-password --username john
`);
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
        showHelp();
        process.exit(0);
    }

    const command = args[0];

    switch (command) {
        case 'reset-password': {
            const usernameIdx = args.indexOf('-u') !== -1 ? args.indexOf('-u') : args.indexOf('--username');
            if (usernameIdx === -1 || !args[usernameIdx + 1]) {
                console.error('Error: --username (-u) is required for reset-password');
                console.error('Usage: framerr reset-password -u <username>');
                process.exit(1);
            }
            await resetPassword(args[usernameIdx + 1]);
            break;
        }
        default:
            console.error(`Unknown command: ${command}`);
            showHelp();
            process.exit(1);
    }
}

main().catch((err) => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
