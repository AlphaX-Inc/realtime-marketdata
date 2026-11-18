import "../env.js";
import { createInterface } from "node:readline/promises";
import { hashPassword } from "../auth/password.js";
import { db } from "../db.js";

// Create a new dashboard admin without logging in. Never modifies existing users.
// Usage: create-admin <email> <name>   (password is read from stdin)

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const [rawEmail, rawName] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();
const name = rawName?.trim();

if (!email || !name) {
  fail('Usage: create-admin <email> "<name>"');
}

if (await db.user.findUnique({ where: { email } })) {
  fail(`User already exists: ${email}. Nothing changed.`);
}

const prompt = createInterface({ input: process.stdin, output: process.stdout });
const password = await prompt.question("Password (8+ characters): ");
prompt.close();

if (password.length < 8) {
  fail("Password must be at least 8 characters");
}

const user = await db.user.create({
  data: {
    email,
    name,
    passwordHash: await hashPassword(password),
  },
});

console.log(`Created admin ${user.email}`);
// ponytail: explicit exit because the pg Pool in packages/db keeps the event loop alive.
process.exit(0);
