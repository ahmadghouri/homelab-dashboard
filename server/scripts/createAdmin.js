// Creates the first admin user.
//
// Usage:
//   npm run create-admin -- --email you@example.com --name "Your Name"
//
// Password: set ADMIN_PASSWORD in the environment, or leave it empty and a strong
// random password is generated and printed once. Change it after the first login.

import crypto from 'node:crypto';
import { parseArgs } from 'node:util';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { hashPassword } from '../src/services/authService.js';

const MIN_PASSWORD_LENGTH = 8;

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string', default: 'Admin' },
  },
});

const email = values.email?.trim().toLowerCase();
if (!email || !email.includes('@')) {
  console.error('Usage: npm run create-admin -- --email you@example.com --name "Your Name"');
  process.exit(1);
}

const providedPassword = process.env.ADMIN_PASSWORD;
if (providedPassword && providedPassword.length < MIN_PASSWORD_LENGTH) {
  console.error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
  process.exit(1);
}
const password = providedPassword || crypto.randomBytes(12).toString('base64url');

await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 5000 });

try {
  if (await User.exists({ email })) {
    console.error(`A user with email ${email} already exists. Nothing changed.`);
    process.exitCode = 1;
  } else {
    await User.create({
      name: values.name.trim(),
      email,
      passwordHash: await hashPassword(password),
      role: 'admin',
    });
    console.log(`Admin created: ${email}`);
    if (!providedPassword) {
      console.log(`Generated password (shown only once): ${password}`);
    }
  }
} finally {
  await mongoose.disconnect();
}
