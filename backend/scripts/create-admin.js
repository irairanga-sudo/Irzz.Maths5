/**
 * Run once after the database is migrated:
 *   node scripts/create-admin.js
 * Creates the first teacher/admin account from FIRST_ADMIN_USERNAME /
 * FIRST_ADMIN_PASSWORD in .env, then you should change the password
 * and remove those values from .env.
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../config/db');

(async () => {
  const username = process.env.FIRST_ADMIN_USERNAME;
  const password = process.env.FIRST_ADMIN_PASSWORD;
  if (!username || !password) {
    console.error('Set FIRST_ADMIN_USERNAME and FIRST_ADMIN_PASSWORD in .env first.');
    process.exit(1);
  }

  const [existing] = await db.query('SELECT id FROM teachers WHERE username = ?', [username]);
  if (existing.length) {
    console.log('An admin with this username already exists.');
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.query(
    `INSERT INTO teachers (username, password_hash, full_name, education, contact, created_at)
     VALUES (?, ?, 'G. Iranga Sathsara', 'Colombo University CS Undergraduate', '0782944774', NOW())`,
    [username, passwordHash]
  );
  console.log(`Admin account "${username}" created. Log in and change the password.`);
  process.exit(0);
})();
