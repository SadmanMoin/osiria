import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

const BLOCKED_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "password1234",
  "admin",
  "admin123",
  "admin1234",
  "admin12345",
  "administrator",
  "osiria",
  "osiria123",
  "osiria-admin",
  "changeme",
  "changeme123",
  "letmein",
  "welcome",
  "welcome1",
  "qwerty12345",
  "qwerty123456",
  "passw0rd",
  "default",
  "defaultpassword",
  "secret",
  "secret123",
  "root",
  "toor",
]);

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024 },
      (error, derived) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derived);
      },
    );
  });
}

export function isBlockedPassword(password: string): boolean {
  const normalized = password.toLowerCase();
  if (BLOCKED_PASSWORDS.has(normalized)) {
    return true;
  }
  if (/^admin\d*$/.test(normalized) || /^password\d*$/.test(normalized)) {
    return true;
  }
  if (/^osiria[\w-]*$/.test(normalized) && normalized.length < 24) {
    return true;
  }
  return false;
}

export function validatePassword(
  password: string,
  email: string,
): { ok: true } | { ok: false; message: string } {
  if (password.length < 12) {
    return { ok: false, message: "Password must be at least 12 characters." };
  }
  if (password.length > 128) {
    return { ok: false, message: "Password must be at most 128 characters." };
  }
  if (password !== password.trim()) {
    return { ok: false, message: "Password cannot start or end with a space." };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, message: "Password must include a letter and a number." };
  }
  if (password.toLowerCase() === email.toLowerCase()) {
    return { ok: false, message: "Password cannot match the email address." };
  }
  if (isBlockedPassword(password)) {
    return { ok: false, message: "That password is too easy to guess." };
  }
  return { ok: true };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const parts = passwordHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }
  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  if (nRaw !== String(SCRYPT_N) || rRaw !== String(SCRYPT_R) || pRaw !== String(SCRYPT_P)) {
    return false;
  }
  if (!saltRaw || !hashRaw) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltRaw, "base64url");
    expected = Buffer.from(hashRaw, "base64url");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length !== KEY_LENGTH) {
    return false;
  }

  const actual = await scrypt(password, salt);
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

let dummyHashPromise: Promise<string> | null = null;

export function getDummyPasswordHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(randomBytes(32).toString("base64url"));
  }
  return dummyHashPromise;
}
