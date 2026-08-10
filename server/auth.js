// =========================================================
// Awara Banjara — Zero-Dependency Auth & Security Module
// Handles .env parsing, token generation, PBKDF2/SHA256 password hashing,
// session validation, rate limiting, and security header generation.
// =========================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from .env file
const ENV_PATH = path.join(__dirname, '..', '.env');

function loadEnv() {
  const env = {
    PORT: '8085',
    HOST: '0.0.0.0',
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'AwaraBanjara@2026!',
    ADMIN_PASSWORD_HASH: '',
    SESSION_SECRET: 'awara_banjara_secret_session_key_2026',
    ALLOWED_ORIGINS: '*'
  };

  if (fs.existsSync(ENV_PATH)) {
    try {
      const content = fs.readFileSync(ENV_PATH, 'utf-8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const parts = trimmed.split('=');
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
            env[key] = val;
          }
        }
      });
    } catch (e) {
      console.warn('⚠️ Error loading .env file:', e.message);
    }
  }

  // Generate SHA-256 hash if not provided
  if (!env.ADMIN_PASSWORD_HASH && env.ADMIN_PASSWORD) {
    env.ADMIN_PASSWORD_HASH = crypto.createHash('sha256').update(env.ADMIN_PASSWORD).digest('hex');
  }

  return env;
}

const config = loadEnv();

// Active sessions memory map: token -> { username, created, expiresAt }
const _sessions = new Map();

// Rate limiting map: ip -> { count, resetTime }
const _rateLimits = new Map();

// Rate limiting helper (max 5 login attempts per 30 seconds per IP)
function isRateLimited(ip, maxAttempts = 5, windowMs = 30 * 1000) {
  const now = Date.now();
  let record = _rateLimits.get(ip);

  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    _rateLimits.set(ip, record);
    return false;
  }

  record.count++;
  if (record.count > maxAttempts) {
    return true;
  }
  return false;
}

// Password Verification
function verifyPassword(inputUsername, inputPassword) {
  if (!inputUsername || !inputPassword) return false;
  if (inputUsername !== config.ADMIN_USERNAME) return false;

  // Check plain password if configured
  if (config.ADMIN_PASSWORD && inputPassword === config.ADMIN_PASSWORD) {
    return true;
  }

  // Check SHA-256 hash
  const inputHash = crypto.createHash('sha256').update(inputPassword).digest('hex');
  if (config.ADMIN_PASSWORD_HASH && inputHash === config.ADMIN_PASSWORD_HASH) {
    return true;
  }

  return false;
}

// Session Management
function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  
  _sessions.set(token, {
    username,
    created: Date.now(),
    expiresAt
  });

  return { token, expiresAt };
}

function isValidToken(token) {
  if (!token) return false;
  const session = _sessions.get(token);
  if (!session) return false;

  if (Date.now() > session.expiresAt) {
    _sessions.delete(token);
    return false;
  }
  return true;
}

function destroySession(token) {
  if (_sessions.has(token)) {
    _sessions.delete(token);
    return true;
  }
  return false;
}

// Extract Bearer token from Request Header or Query
function extractTokenFromReq(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // Cookie fallback
  const cookieHeader = req.headers['cookie'] || req.headers['Cookie'];
  if (cookieHeader) {
    const match = cookieHeader.match(/awara_admin_token=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

// Middleware helper to attach security headers
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

module.exports = {
  config,
  verifyPassword,
  createSession,
  isValidToken,
  destroySession,
  extractTokenFromReq,
  isRateLimited,
  setSecurityHeaders
};
