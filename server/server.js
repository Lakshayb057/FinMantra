const dotenv = require('dotenv');
dotenv.config();

process.on('uncaughtException', (err) => {
  console.error('[Global Uncaught Exception]', err.message || err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Global Unhandled Rejection]', reason);
});

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const db = require('./db');
const metaAudienceService = require('./metaAudienceService');
const baileys = require('./baileys');
const sbiEmailFetcher = require('./sbiEmailFetcher');
const kiwiEmailFetcher = require('./kiwiEmailFetcher');
const multer = require('multer');
const xlsx = require('xlsx');
const ExcelJS = require('exceljs');
const pdfParse = require('pdf-parse');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit for large Excel MIS uploads
});

// Load Negative & OCL Pincodes into Memory
let negativePincodesSet = new Set();
try {
  const negPinPath = path.join(__dirname, 'data', 'negative_pincodes.json');
  if (fs.existsSync(negPinPath)) {
    const raw = fs.readFileSync(negPinPath, 'utf8');
    const arr = JSON.parse(raw);
    negativePincodesSet = new Set(arr.map(p => String(p).trim()));
    console.log(`[Negative Pincodes] Loaded ${negativePincodesSet.size} negative pincodes into memory.`);
  }
} catch (err) {
  console.error('[Negative Pincodes Error] Failed to load negative pincodes JSON:', err.message);
}

// Automatically wrap async route handlers to propagate exceptions to global error handler
const Layer = require('express/lib/router/layer');
Object.defineProperty(Layer.prototype, 'handle', {
  enumerable: true,
  get: function() { return this.__handle; },
  set: function(fn) {
    if (fn && fn.constructor.name === 'AsyncFunction') {
      this.__handle = (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
      };
    } else {
      this.__handle = fn;
    }
  }
});

const compression = require('compression');

const app = express();
app.use(compression()); // Gzip/Brotli — reduces JSON payload size by ~80-90%
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

class MemoryRateLimiter {
  constructor(windowMs, maxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map();
    
    // Clean up expired entries periodically to prevent memory leaks
    setInterval(() => {
      const now = Date.now();
      for (const [key, timestamps] of this.requests.entries()) {
        const active = timestamps.filter(t => now - t < this.windowMs);
        if (active.length === 0) {
          this.requests.delete(key);
        } else {
          this.requests.set(key, active);
        }
      }
    }, 60000).unref();
  }

  limit(key) {
    const now = Date.now();
    let timestamps = this.requests.get(key) || [];
    timestamps = timestamps.filter(t => now - t < this.windowMs);
    if (timestamps.length >= this.maxRequests) {
      return false;
    }
    timestamps.push(now);
    this.requests.set(key, timestamps);
    return true;
  }

  middleware() {
    return (req, res, next) => {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      const key = `${req.path}:${ip}`;
      const allowed = this.limit(key);
      if (!allowed) {
        return res.status(429).json({
          success: false,
          error: 'Too many requests. Please try again later.'
        });
      }
      next();
    };
  }
}

// Instantiate specific limiters
const otpRateLimiter = new MemoryRateLimiter(60000, 5);
const loginRateLimiter = new MemoryRateLimiter(60000, 10);
const leadSubmitRateLimiter = new MemoryRateLimiter(60000, 30);

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'finmantrasupersecretjwtkey';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'FM@Chaos!2026';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 10);
const LAKSHAY_PASSWORD = process.env.LAKSHAY_PASSWORD || 'Lakshay@123';
const LAKSHAY_PASSWORD_HASH = bcrypt.hashSync(LAKSHAY_PASSWORD, 10);

// loginTracker keeps track of login failures for security brute-force prevention
const loginTracker = {
  failures: {}, // key: username/role -> { count: N, lockUntil: timestamp }
  
  getLockTimeLeft(ip, identity) {
    const now = Date.now();
    const identityRecord = this.failures[identity];
    if (identityRecord && identityRecord.lockUntil > now) {
      return Math.ceil((identityRecord.lockUntil - now) / 1000); // seconds
    }
    return 0;
  },

  recordFailure(ip, identity) {
    const now = Date.now();
    
    // Record for identity (e.g. username like "agent1" or admin role "admin")
    if (identity) {
      if (!this.failures[identity]) this.failures[identity] = { count: 0, lockUntil: 0 };
      const identRec = this.failures[identity];
      if (identRec.lockUntil <= now) {
        identRec.count += 1;
        if (identRec.count >= 3) {
          identRec.lockUntil = now + 10 * 60 * 1000; // 10 minutes lock
        }
      }
    }
  },

  recordSuccess(ip, identity) {
    if (identity) {
      delete this.failures[identity];
    }
  },

  getAttemptsLeft(ip, identity) {
    const identRec = identity ? this.failures[identity] : null;
    const identCount = identRec ? identRec.count : 0;
    return Math.max(0, 3 - identCount);
  }
};

// Singular link redirection resolver endpoint for non-Android platforms
app.get('/api/resolve-singular', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      }
    });
    const location = response.headers.get('location');
    if (location && location.startsWith('intent://')) {
      const match = location.match(/S\.browser_fallback_url=([^;]+)/);
      if (match && match[1]) {
        const decoded = decodeURIComponent(match[1]);
        console.log(`[Singular Resolver] Resolved intent to fallback web URL: ${decoded}`);
        return res.json({ resolvedUrl: decoded });
      }
    }
    console.log(`[Singular Resolver] Resolved to location: ${location || url}`);
    return res.json({ resolvedUrl: location || url });
  } catch (err) {
    console.error('[Singular Resolver Error]:', err);
    return res.json({ resolvedUrl: url });
  }
});

// Health Check Endpoint - helps diagnose deployment issues
app.get('/api/health', async (req, res) => {
  try {
    const settings = await db.getSettings();
    const apiKey = settings.wa_api_key || process.env.WA_API_KEY;
    const phoneId = settings.wa_phone_number_id || process.env.WA_PHONE_NUMBER_ID;
    const templateName = settings.wa_otp_template_name || process.env.WA_OTP_TEMPLATE_NAME || 'auth_otp';
    const waConfigured = !!(apiKey && phoneId);

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      whatsapp: {
        configured: waConfigured,
        phoneNumberId: phoneId ? '***' + phoneId.slice(-4) : 'NOT SET',
        templateName: templateName,
        apiKeySet: !!apiKey
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Create HTTP server integrating with Express
const server = http.createServer(app);

// Attach WebSocket Server
const wss = new WebSocket.Server({ server });
const wssClients = new Set();

function heartbeat() {
  this.isAlive = true;
}

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', heartbeat);
  wssClients.add(ws);
  console.log(`[WebSocket Server] Client connected from ${req.socket.remoteAddress || 'client'}. Active clients: ${wssClients.size}`);
  
  // Send welcome check
  ws.send(JSON.stringify({ type: 'WS_CONNECTED', message: 'Sync connection established with FinMantra WebSocket' }));

  ws.on('close', () => {
    wssClients.delete(ws);
    console.log(`[WebSocket Server] Client disconnected. Active clients: ${wssClients.size}`);
  });

  ws.on('error', (err) => {
    console.error('[WebSocket Error]', err.message);
    wssClients.delete(ws);
  });
});

// Ping clients every 30s to keep connection alive through Nginx/Cloudflare proxies
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);
pingInterval.unref();

// Broadcast Helper
function broadcast(messageObj) {
  const payload = JSON.stringify(messageObj);
  for (const client of wssClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch(err) {
        console.error('[WebSocket Broadcast Error]', err);
      }
    }
  }
}

// Helper to hash passwords using built-in crypto
function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Helper to safely resolve setting value from DB or process.env
function getSettingVal(settings, key, envKey, defaultVal = null) {
  if (key === 'meta_ad_account_id') {
    const dbVal = settings && settings[key] ? String(settings[key]).trim() : '';
    if (dbVal && dbVal.includes('1450840068922146')) {
      return 'act_1450840068922146';
    }
    return 'act_1450840068922146';
  }
  if (key === 'meta_access_token') {
    const dbVal = settings && settings[key] ? String(settings[key]).trim() : '';
    if (dbVal && dbVal.startsWith('EAAVeOgEkwUQBSHZA5fifeZC')) {
      return dbVal;
    }
    return 'EAAVeOgEkwUQBSHZA5fifeZCMuvEzonYAZCybPbWYdAyBYM6ASvejqeIt9ii4gaXDuLexc7ZBHZA7z6A8hhZA50d1t595kBtsZAb7NFZASRXuc6daX2w1XQD6RY47QA8jZAUbaiAVSm7ColzfIlOvq9BB0ePyM1uoileKbLtFe8BSjfghbZCUtQ5jYO0BjYe3FFxQZDZD';
  }

  const dbVal = settings && settings[key] ? String(settings[key]).trim() : '';
  if (dbVal && dbVal !== 'undefined' && dbVal !== 'null') {
    return dbVal;
  }
  const envVal = envKey && process.env[envKey] ? String(process.env[envKey]).trim() : '';
  if (envVal && envVal !== 'undefined' && envVal !== 'null') {
    return envVal;
  }
  return defaultVal;
}

// Helper to resolve Android intent:// scheme URLs to their browser fallback URL.
// The client browser cannot handle intent:// on desktop/iOS, so we extract the
// S.browser_fallback_url parameter server-side and return a normal HTTPS URL.
function resolveIntentUrl(url) {
  if (url && String(url).startsWith('intent://')) {
    const match = String(url).match(/S\.browser_fallback_url=([^;]+)/);
    if (match && match[1]) {
      try {
        const decoded = decodeURIComponent(match[1]);
        console.log(`[Intent Resolver] Resolved intent:// to fallback: ${decoded}`);
        return decoded;
      } catch (e) {
        console.error('[Intent Resolver] Failed to decode fallback URL:', e);
      }
    }
  }
  return url;
}

// Helper to dynamically resolve domain for WhatsApp referral URLs (uat.finmantra.org vs finmantra.org)
function getPublicSiteUrl(req, settings = {}) {
  const host = req ? (req.get('host') || '') : '';
  const port = String(process.env.PORT || '5000');
  
  if (host.includes('uat.finmantra.org') || port === '5001') {
    return 'https://uat.finmantra.org';
  }
  
  if (host.includes('finmantra.org')) {
    return 'https://finmantra.org';
  }

  const dbUrl = settings && settings.public_site_url ? String(settings.public_site_url).trim() : '';
  if (dbUrl && dbUrl !== 'undefined' && dbUrl !== 'null') {
    return dbUrl.endsWith('/') ? dbUrl.slice(0, -1) : dbUrl;
  }

  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return 'http://localhost:5173';
  }

  const protocol = req ? (req.protocol || 'http') : 'http';
  return host ? `${protocol}://${host}` : 'https://finmantra.org';
}

// Helper to format fallback plain text message for Baileys
function getFallbackText(isOtpAuth, parameters, settings) {
  if (isOtpAuth) {
    const otpCode = String(parameters[0] || '');
    const otpTemplate = settings.otp_message_template || 'Your OTP for FinMantra credit card application is: {otp}. Valid for 5 minutes.';
    return otpTemplate.replace(/{otp}/gi, otpCode);
  } else {
    const name = String(parameters[0] || 'Customer');
    const link = String(parameters[1] || '');
    return `Hello ${name}, thank you for choosing FinMantra. You can access your secure bank portal here: ${link}`;
  }
}

// Helper to send messages via Meta WhatsApp Cloud API (with Baileys QR-Linked Device fallback)
async function sendWhatsAppTemplate(toPhone, templateName, parameters = [], isOtpAuth = false, mediaUrl = null) {
  const settings = await db.getSettings();
  const gateway = settings.whatsapp_gateway || 'meta';

  if (gateway === 'baileys') {
    const baileysStatus = baileys.getBaileysStatus();
    if (baileysStatus.status === 'CONNECTED') {
      console.log(`[WhatsApp] Gateway is set to Baileys. Routing message to ${toPhone} directly via linked device...`);
      try {
        const text = getFallbackText(isOtpAuth, parameters, settings);
        const result = await baileys.sendBaileysMessage(toPhone, text);
        return { sentViaBaileys: true, result };
      } catch (err) {
        console.error('[WhatsApp] Failed to send via Baileys:', err.message);
        throw err;
      }
    }
    console.warn('[WhatsApp Warning] Gateway is set to Baileys but linked device is not connected. Attempting Meta Cloud API fallback...');
  }

  const apiKey = getSettingVal(settings, 'wa_api_key', 'WA_API_KEY');
  const phoneId = getSettingVal(settings, 'wa_phone_number_id', 'WA_PHONE_NUMBER_ID');
  const apiVersion = getSettingVal(settings, 'wa_api_version', 'WA_API_VERSION', 'v25.0');

  if (!apiKey || !phoneId) {
    throw new Error('Meta WhatsApp API credentials missing. Please configure WA_API_KEY and WA_PHONE_NUMBER_ID in settings or .env file.');
  }

  // Format phone number to E.164 (Meta requires country code without + or leading zeros)
  let formattedPhone = toPhone.trim().replace(/\D/g, '');
  if (formattedPhone.length === 10) {
    formattedPhone = '91' + formattedPhone; // Default to India country code if 10 digits
  }

  const baseLang = getSettingVal(settings, 'wa_template_language', 'WA_TEMPLATE_LANGUAGE', 'en');

  const langCandidates = [baseLang, 'en', 'en_US', 'en_GB'].filter((v, i, a) => v && a.indexOf(v) === i);

  // Build list of candidate component payloads to guarantee delivery across all template variations
  const componentStrategies = [];

  if (isOtpAuth && parameters.length === 1) {
    const otpCode = String(parameters[0] || '');

    // Strategy 1: Body param + URL button (matches finmantra_otp dynamic button format)
    componentStrategies.push([
      { type: 'body', parameters: [{ type: 'text', text: otpCode }] },
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: otpCode }] }
    ]);

    // Strategy 2: Body parameter only
    componentStrategies.push([
      { type: 'body', parameters: [{ type: 'text', text: otpCode }] }
    ]);

    // Strategy 3: Auth template with Copy Code button (coupon_code format) + Body param
    componentStrategies.push([
      { type: 'body', parameters: [{ type: 'text', text: otpCode }] },
      { type: 'button', sub_type: 'copy_code', index: '0', parameters: [{ type: 'coupon_code', coupon_code: otpCode }] }
    ]);

    // Strategy 4: Auth template with URL button only (0 Body params)
    componentStrategies.push([
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: otpCode }] }
    ]);

    // Strategy 5: Auth template with Copy Code button only (0 Body params)
    componentStrategies.push([
      { type: 'button', sub_type: 'copy_code', index: '0', parameters: [{ type: 'coupon_code', coupon_code: otpCode }] }
    ]);
  } else {
    // Standard / Referral / Multi-parameter templates
    const urlParamIdx = parameters.findIndex(p => typeof p === 'string' && (p.startsWith('http://') || p.startsWith('https://')));

    if (urlParamIdx !== -1) {
      const fullUrl = parameters[urlParamIdx];
      let noProtocol = fullUrl.replace(/^https?:\/\//i, '');
      let pathOnly = '';
      try {
        pathOnly = new URL(fullUrl).pathname.substring(1);
      } catch (e) {
        pathOnly = noProtocol;
      }
      
      let referSuffix = '';
      const referIdx = fullUrl.indexOf('/refer/');
      if (referIdx !== -1) {
        referSuffix = fullUrl.substring(referIdx + 7);
      } else {
        referSuffix = pathOnly;
      }
      
      const parts = fullUrl.split('/');
      let urnOnly = parts[parts.length - 1] || referSuffix;

      const bodyParams = parameters.filter((_, idx) => idx !== urlParamIdx);
      const urlCandidates = [referSuffix, pathOnly, urnOnly, noProtocol, fullUrl].filter((v, i, a) => v && a.indexOf(v) === i);

      for (const urlVal of urlCandidates) {
        componentStrategies.push([
          { type: 'body', parameters: bodyParams.map(p => ({ type: 'text', text: String(p) })) },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: urlVal }] }
        ]);
      }
    }

    // Strategy Fallback: All parameters in body (for templates with link variable in body text)
    componentStrategies.push([
      {
        type: 'body',
        parameters: parameters.map(p => ({ type: 'text', text: String(p) }))
      }
    ]);

    // Strategy 5: Static template or empty components
    componentStrategies.push([]);
  }

  const https = require('https');

  const executeMetaRequest = (payloadObj) => {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(payloadObj);
      const options = {
        hostname: 'graph.facebook.com',
        port: 443,
        path: `/${apiVersion}/${phoneId}/messages`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => responseBody += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(responseBody)); } catch (e) { resolve(responseBody); }
          } else {
            let errMsg = `Meta API error (status ${res.statusCode}): ${responseBody}`;
            let isAuthError = (res.statusCode === 401);
            let errorCode = null;
            try {
              const parsed = JSON.parse(responseBody);
              if (parsed && parsed.error) {
                if (parsed.error.message) {
                  errMsg = `Meta API Error: ${parsed.error.message} (Code: ${parsed.error.code})`;
                }
                errorCode = parsed.error.code;
                if (errorCode === 190 || errorCode === 195 || errorCode === 102 || errorCode === 200) {
                  isAuthError = true;
                }
              }
            } catch (e) {}
            reject({ statusCode: res.statusCode, body: responseBody, message: errMsg, isAuthError, errorCode });
          }
        });
      });

      req.setTimeout(12000, () => {
        req.destroy();
        reject({ statusCode: 504, message: 'Meta API request timed out after 12 seconds' });
      });

      req.on('error', (err) => reject({ statusCode: 500, message: err.message }));
      req.write(postData);
      req.end();
    });
  };

  let lastError = null;
  let isAuthFailure = false;

  // Try strategies and language codes sequentially
  for (const lang of langCandidates) {
    for (let sIdx = 0; sIdx < componentStrategies.length; sIdx++) {
      let currentComponents = [...componentStrategies[sIdx]];
      if (mediaUrl) {
        let mediaType = 'image';
        const lower = mediaUrl.toLowerCase().trim();
        if (lower.endsWith('.pdf') || lower.endsWith('.doc') || lower.endsWith('.docx')) {
          mediaType = 'document';
        } else if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.avi')) {
          mediaType = 'video';
        }
        
        currentComponents.unshift({
          type: 'header',
          parameters: [
            {
              type: mediaType,
              [mediaType]: {
                link: mediaUrl
              }
            }
          ]
        });
      }

      const payloadObj = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: lang }
        }
      };
      if (currentComponents.length > 0) {
        payloadObj.template.components = currentComponents;
      }

      try {
        const result = await executeMetaRequest(payloadObj);
        console.log(`[WhatsApp API] Message sent successfully to ${formattedPhone} using template "${templateName}" (lang: ${lang}, strategy: ${sIdx + 1}).`);
        return result;
      } catch (err) {
        lastError = err.message || `Meta API Error (status ${err.statusCode})`;
        if (err.isAuthError) {
          isAuthFailure = true;
          console.error(`[WhatsApp API CRITICAL] Authentication Failed for Meta API (Code: ${err.errorCode || 190}). Token is invalid or expired! Stopping further payload/language attempts for "${templateName}".`);
          break;
        }
        console.warn(`[WhatsApp API Warning] Strategy ${sIdx + 1} with lang ${lang} failed for "${templateName}": ${lastError}. Trying next candidate...`);
      }
    }
    if (isAuthFailure) break;
  }

  // If all Meta API strategies failed, check Baileys fallback
  const baileysStatus = baileys.getBaileysStatus();
  if (baileysStatus.status === 'CONNECTED') {
    console.warn(`[WhatsApp Fallback] All Meta API strategies failed for ${toPhone}. Attempting delivery via Baileys linked device...`);
    try {
      const text = getFallbackText(isOtpAuth, parameters, settings);
      const result = await baileys.sendBaileysMessage(toPhone, text);
      return { sentViaBaileys: true, metaError: lastError, result };
    } catch (baileysErr) {
      const finalErr = new Error(`${lastError}. Fallback to Baileys also failed: ${baileysErr.message}`);
      if (isAuthFailure) finalErr.isAuthError = true;
      throw finalErr;
    }
  }

  const finalErr = new Error(lastError || 'Failed to send WhatsApp message via Meta Cloud API.');
  if (isAuthFailure) finalErr.isAuthError = true;
  throw finalErr;
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    
    if (user && user.role === 'agent') {
      try {
        const agent = await db.getAgentById(user.id);
        if (!agent || agent.status !== 'active') {
          return res.status(403).json({ error: 'Account is deactivated, deleted, or unauthorized.' });
        }
        const agentLocs = typeof agent.locations === 'string' ? JSON.parse(agent.locations) : (agent.locations || []);
        if (!agentLocs || agentLocs.length === 0 || !agent.assigned_bank || agent.assigned_bank.trim() === '') {
          return res.status(403).json({ error: 'Agent lacks city or bank assignment. Access denied.' });
        }
      } catch (dbErr) {
        console.error('[AUTH] Failed to verify agent in DB', dbErr);
        return res.status(500).json({ error: 'Authentication internal database error' });
      }
    }
    
    req.user = user;
    next();
  });
}

// Admin Only Middleware
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
}

// --- AUTHENTICATION ROUTES ---

// Admin Login
app.post('/api/admin/login', loginRateLimiter.middleware(), (req, res) => {
  const { password } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // Check brute-force block
  const timeLeft = loginTracker.getLockTimeLeft(ip, 'admin');
  if (timeLeft > 0) {
    return res.status(429).json({ 
      error: `Too many failed login attempts. You are blocked. Please try again after 10 minutes.`, 
      timeLeft 
    });
  }

  const isAdminCorrect = bcrypt.compareSync(password, ADMIN_PASSWORD_HASH);
  const isLakshayCorrect = bcrypt.compareSync(password, LAKSHAY_PASSWORD_HASH);

  if (isAdminCorrect || isLakshayCorrect) {
    loginTracker.recordSuccess(ip, 'admin');
    const isSuperAdmin = isLakshayCorrect;
    const token = jwt.sign(
      { role: 'admin', canDelete: isSuperAdmin, username: isSuperAdmin ? 'lakshay' : 'admin' }, 
      JWT_SECRET, 
      { expiresIn: '1d' }
    );
    return res.json({ 
      token, 
      role: 'admin', 
      canDelete: isSuperAdmin,
      username: isSuperAdmin ? 'lakshay' : 'admin'
    });
  }

  // Record failure
  loginTracker.recordFailure(ip, 'admin');
  const attemptsLeft = loginTracker.getAttemptsLeft(ip, 'admin');
  const finalTimeLeft = loginTracker.getLockTimeLeft(ip, 'admin');

  if (finalTimeLeft > 0) {
    return res.status(429).json({ 
      error: `Too many failed login attempts. You are blocked for 10 minutes.`, 
      timeLeft: finalTimeLeft 
    });
  }

  res.status(401).json({ 
    error: `Invalid admin password. (${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} left)`, 
    attemptsLeft 
  });
});

// Agent Login
app.post('/api/agents/login', loginRateLimiter.middleware(), async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const identity = `agent_${username}`;

  // Check brute-force block
  const timeLeft = loginTracker.getLockTimeLeft(ip, identity);
  if (timeLeft > 0) {
    return res.status(429).json({ 
      error: `Too many failed login attempts. This account or IP is blocked for 10 minutes.`, 
      timeLeft 
    });
  }

  const agent = await db.getAgentByUsername(username);

  let isPasswordValid = false;
  if (agent) {
    // If it's a bcrypt hash
    if (agent.password_hash.startsWith('$2a$') || agent.password_hash.startsWith('$2b$')) {
      isPasswordValid = bcrypt.compareSync(password, agent.password_hash);
    } else {
      // Fallback for old SHA-256 hashes
      isPasswordValid = (agent.password_hash === sha256(password));
      if (isPasswordValid) {
        // Upgrade to bcrypt in the background
        const newHash = bcrypt.hashSync(password, 10);
        db.updateAgent(agent.id, { password_hash: newHash }).catch(err => {
          console.error('[DATABASE] Failed to upgrade agent password to bcrypt', err);
        });
      }
    }
  }

  if (isPasswordValid && agent.status === 'active') {
    const agentLocs = typeof agent.locations === 'string' ? JSON.parse(agent.locations) : (agent.locations || []);
    if (!agentLocs || agentLocs.length === 0) {
      return res.status(403).json({ error: 'Login blocked. No city has been assigned to your account yet. Please contact the administrator.' });
    }
    if (!agent.assigned_bank || agent.assigned_bank.trim() === '') {
      return res.status(403).json({ error: 'Login blocked. No partner bank has been assigned to your account yet. Please contact the administrator.' });
    }

    loginTracker.recordSuccess(ip, identity);
    const canCreate = agent.can_create_leads !== false;
    const canMis = !!agent.can_upload_mis;
    const mode = agent.agent_mode || 'lead_agent';

    const token = jwt.sign({ id: agent.id, name: agent.name, role: 'agent', assigned_bank: agent.assigned_bank, agent_mode: mode, can_create_leads: canCreate, can_upload_mis: canMis }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({
      token,
      role: 'agent',
      agent: { 
        id: agent.id, 
        name: agent.name, 
        email: agent.email, 
        locations: agent.locations, 
        assigned_bank: agent.assigned_bank,
        agent_mode: mode,
        can_create_leads: canCreate,
        can_upload_mis: canMis
      }
    });
  }

  // Record failure
  loginTracker.recordFailure(ip, identity);
  const attemptsLeft = loginTracker.getAttemptsLeft(ip, identity);
  const finalTimeLeft = loginTracker.getLockTimeLeft(ip, identity);

  if (finalTimeLeft > 0) {
    return res.status(429).json({ 
      error: `Too many failed login attempts. This account or IP is blocked for 10 minutes.`, 
      timeLeft: finalTimeLeft 
    });
  }

  res.status(401).json({ 
    error: `Invalid agent credentials or inactive account. (${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} left)`, 
    attemptsLeft 
  });
});

// Verify Current Token & Role
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// --- OTP / WHATSAPP ROUTES ---

// Send WhatsApp OTP
app.post('/api/otp/send', otpRateLimiter.middleware(), async (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length < 10) {
    return res.status(400).json({ error: 'Valid WhatsApp number is required' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await db.saveOTP(phone, otp);

  const settings = await db.getSettings();
  const apiKey = getSettingVal(settings, 'wa_api_key', 'WA_API_KEY');
  const phoneId = getSettingVal(settings, 'wa_phone_number_id', 'WA_PHONE_NUMBER_ID');

  let sentViaMeta = false;
  let apiError = null;

  if (apiKey && phoneId) {
    const configuredTemplate = getSettingVal(settings, 'wa_otp_template_name', 'WA_OTP_TEMPLATE_NAME', 'finmantra_otp');

    const candidateTemplates = [
      configuredTemplate,
      'finmantra_otp',
      'auth_otp',
      'otp',
      'verification_code',
      'jaspers_market_order_confirmation_v1'
    ].filter((v, i, a) => v && a.indexOf(v) === i);
    
    const isOtpAuthSetting = settings.wa_otp_is_auth_template;
    const isOtpAuth = isOtpAuthSetting === undefined || isOtpAuthSetting === null
      ? true 
      : (isOtpAuthSetting === 'true' || isOtpAuthSetting === true);

    for (const tName of candidateTemplates) {
      try {
        let params = [otp];
        let currentIsOtpAuth = isOtpAuth;
        if (tName === 'jaspers_market_order_confirmation_v1') {
          const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          params = ['Customer', otp, dateStr];
          currentIsOtpAuth = false;
        }
        const result = await sendWhatsAppTemplate(phone, tName, params, currentIsOtpAuth);
        sentViaMeta = true;
        apiError = null;
        console.log(`[WhatsApp API] OTP sent successfully to ${phone} via Meta API (template: ${tName}).`);
        break;
      } catch (err) {
        apiError = err.message;
        console.warn(`[WhatsApp API Warning] OTP send via template "${tName}" failed: ${err.message}.`);
        if (err.isAuthError || err.message.includes('Authentication Error') || err.message.includes('Code: 190')) {
          console.error(`[WhatsApp API CRITICAL] Stopping template trials: Meta Access Token is invalid or expired (Code 190).`);
          break;
        }
      }
    }
  } else {
    apiError = 'Meta WhatsApp API credentials missing. Please set WA_API_KEY and WA_PHONE_NUMBER_ID in settings or .env file.';
    console.error(`[WhatsApp API Error]: ${apiError}`);
  }

  if (apiError || !sentViaMeta) {
    console.warn('-----------------------------------------');
    console.warn(`[WhatsApp Meta API Failure for ${phone}]: ${apiError}`);
    console.warn(`[WhatsApp API Fallback]: Falling back to Simulated OTP.`);
    console.warn('-----------------------------------------');
    return res.json({
      success: true,
      message: 'OTP verification code sent successfully (Simulated due to API failure).',
      simulatedOtp: otp
    });
  }

  console.log(`=========================================`);
  console.log(`[Meta API OTP Sent to ${phone}]: ${otp}`);
  console.log(`=========================================`);

  res.json({
    success: true,
    message: 'OTP verification code sent successfully via Meta WhatsApp API.'
  });
});

// Verify OTP
app.post('/api/otp/verify', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP are required' });
  }

  const result = await db.verifyOTP(phone, otp);
  if (result.success) {
    res.json({ success: true, message: 'Phone number verified successfully' });
  } else {
    res.status(400).json({ error: result.reason });
  }
});

// --- LEADS MANAGEMENT ---

// Helper to hash fields for Meta Conversions API (SHA-256)
function sha256Hash(text) {
  if (!text) return null;
  return crypto.createHash('sha256').update(String(text).trim().toLowerCase()).digest('hex');
}

// Helper to check if MIS status represents a Final Approved lead
function isFinalApprovedStatus(rawStatus) {
  if (!rawStatus) return false;
  const upper = String(rawStatus).toUpperCase().trim();
  // Exclude soft status or pending/decline/reject
  if (upper.includes('SOFT') || upper.includes('DCLP') || upper.includes('DACP') || upper.includes('PENDING') || upper.includes('REJECT') || upper.includes('DECLINE')) {
    if (upper.includes('APPROVE') && !upper.includes('SOFT') && !upper.includes('PRE-APPROVED') && !upper.includes('IN-PROCESS')) {
      return true;
    }
    return false;
  }
  return (
    upper.includes('APPROVE') ||
    upper.includes('CARD CREATED') ||
    upper.includes('CARD ISSUED') ||
    upper.includes('DISBURSED') ||
    upper.includes('ACTIVE') ||
    upper.includes('CARD ACTIVATED') ||
    upper.includes('FIRST TXN') ||
    upper.includes('FIRST_TXN') ||
    upper.includes('ACCOUNT CREATED') ||
    upper.includes('SUCCESS')
  );
}

function isMatchingCategoryStatus(rawStatus, category = 'FINAL APPROVED') {
  if (!rawStatus) return false;
  const upper = String(rawStatus).toUpperCase().trim();
  const cat = String(category || 'FINAL APPROVED').toUpperCase().trim();

  if (cat.includes('DECLINE') || cat.includes('REJECT')) {
    if (cat.includes('SOFT')) {
      return (upper.includes('SOFT') && (upper.includes('DECLINE') || upper.includes('REJECT') || upper.includes('DCLP') || upper.includes('DACP'))) || upper.includes('DCLP') || upper.includes('DACP');
    }
    return upper.includes('DECLINE') || upper.includes('REJECT') || upper.includes('CANCEL') || upper.includes('FAIL');
  }

  if (cat.includes('SOFT')) {
    return (upper.includes('SOFT') || upper.includes('PRE-APPROV') || upper.includes('VKYC') || upper.includes('IPA') || upper.includes('PROCESS') || upper.includes('PENDING')) && !upper.includes('DECLINE') && !upper.includes('REJECT');
  }

  if (cat.includes('ALL')) {
    return true;
  }

  // Default: FINAL APPROVED
  return isFinalApprovedStatus(rawStatus);
}

// Helper to split full name into first and last name
function splitName(fullName) {
  if (!fullName) return { fn: '', ln: '' };
  const parts = String(fullName).trim().split(/\s+/);
  const fn = parts[0] || '';
  const ln = parts.slice(1).join(' ') || '';
  return { fn, ln };
}

// Send server-side event to Meta Conversions API (CAPI)
async function sendMetaCapiEvent(lead, eventName = 'Purchase', eventValue = 2000, bankName = null, testEventCode = null) {
  try {
    const settings = await db.getSettings().catch(() => ({}));
    const pixelId = getSettingVal(settings, 'meta_pixel_id', 'META_PIXEL_ID');
    const accessToken = getSettingVal(settings, 'meta_access_token', 'META_ACCESS_TOKEN');

    if (!pixelId || !accessToken) {
      console.log('[Meta CAPI] Skipped: META_PIXEL_ID or META_ACCESS_TOKEN not set.');
      return { status: 'skipped', error: 'Missing API credentials' };
    }

    // Format phone number to E.164 (91XXXXXXXXXX)
    let rawPhone = lead.phone || '';
    rawPhone = rawPhone.replace(/\D/g, '');
    if (rawPhone.length === 10) {
      rawPhone = '91' + rawPhone;
    }

    const { fn, ln } = splitName(lead.full_name);

    const userData = {
      ph: [sha256Hash(rawPhone)],
      em: [sha256Hash(lead.email)],
      fn: fn ? [sha256Hash(fn)] : undefined,
      ln: ln ? [sha256Hash(ln)] : undefined,
      client_ip_address: lead.ip_address || null,
      client_user_agent: lead.user_agent || null,
    };

    // Add fbc if present
    if (lead.fbclid) {
      userData.fbc = `fb.1.${Date.now()}.${lead.fbclid}`;
    } else if (lead.utm_params && lead.utm_params.fbclid) {
      userData.fbc = `fb.1.${Date.now()}.${lead.utm_params.fbclid}`;
    }

    // Add fbp if present
    if (lead.utm_params && lead.utm_params._fbp) {
      userData.fbp = lead.utm_params._fbp;
    }

    const leadBank = bankName || lead.card_bank || (lead.mis_data && lead.mis_data.mis_bank_name) || 'FinMantra Partner';
    const cardName = lead.card_name || (lead.mis_data && lead.mis_data.card_name) || 'Credit Card';

    const payload = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: `${lead.id}_Purchase_${lead.mis_status || 'Approved'}`,
          event_source_url: lead.landing_page || 'https://finmantra.org/',
          action_source: 'website',
          user_data: userData,
          custom_data: {
            currency: 'INR',
            value: Number(eventValue) || 2000,
            content_name: cardName,
            content_category: leadBank,
            bank: leadBank,
            status: lead.mis_status || 'Final Approved'
          }
        }
      ]
    };

    const activeTestCode = testEventCode || settings.meta_test_event_code || process.env.META_TEST_EVENT_CODE;
    if (activeTestCode) {
      payload.test_event_code = activeTestCode;
    }

    const url = `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    if (response.ok) {
      console.log(`[Meta CAPI] Purchase Event (₹${eventValue}) sent successfully for lead ${lead.id}. Trace ID: ${data.fb_trace_id}`);
      await db.updateLeadCapiStatus(lead.id, eventName, eventValue, 'SUCCESS', data);
      return { status: 'success', response: data };
    } else {
      console.error(`[Meta CAPI] Failed for lead ${lead.id}:`, data);
      await db.updateLeadCapiStatus(lead.id, eventName, eventValue, 'FAILED', data);
      return { status: 'failed', response: data };
    }
  } catch (err) {
    console.error(`[Meta CAPI] Network error for lead ${lead.id}:`, err);
    await db.updateLeadCapiStatus(lead.id, eventName, eventValue, 'ERROR', { error: err.message });
    return { status: 'failed', error: err.message };
  }
}

// Batch send Meta Conversions API (CAPI) events for a list of leads (chunks of 500 events)
async function sendMetaCapiBatchEvents(leadsList, eventName = 'Purchase', eventValue = 2000) {
  if (!leadsList || !Array.isArray(leadsList) || leadsList.length === 0) return;
  try {
    const settings = await db.getSettings().catch(() => ({}));
    const pixelId = getSettingVal(settings, 'meta_pixel_id', 'META_PIXEL_ID');
    const accessToken = getSettingVal(settings, 'meta_access_token', 'META_ACCESS_TOKEN');
    if (!pixelId || !accessToken) return;

    const approvedLeads = leadsList.filter(l => isFinalApprovedStatus(l.mis_status));
    if (approvedLeads.length === 0) return;

    const events = approvedLeads.map(lead => {
      let rawPhone = lead.phone || '';
      rawPhone = rawPhone.replace(/\D/g, '');
      if (rawPhone.length === 10) rawPhone = '91' + rawPhone;
      const { fn, ln } = splitName(lead.full_name);

      const userData = {
        ph: [sha256Hash(rawPhone)],
        em: [sha256Hash(lead.email)],
        fn: fn ? [sha256Hash(fn)] : undefined,
        ln: ln ? [sha256Hash(ln)] : undefined
      };

      const leadBank = lead.card_bank || (lead.mis_data && lead.mis_data.mis_bank_name) || 'FinMantra Partner';
      const cardName = lead.card_name || (lead.mis_data && lead.mis_data.card_name) || 'Credit Card';

      return {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: `${lead.id}_Purchase_${lead.mis_status || 'Approved'}`,
        event_source_url: lead.landing_page || 'https://finmantra.org/',
        action_source: 'website',
        user_data: userData,
        custom_data: {
          currency: 'INR',
          value: Number(eventValue) || 2000,
          content_name: cardName,
          content_category: leadBank,
          bank: leadBank,
          status: lead.mis_status || 'Final Approved'
        }
      };
    });

    const chunkSize = 500;
    for (let i = 0; i < events.length; i += chunkSize) {
      const chunk = events.slice(i, i + chunkSize);
      const payload = { data: chunk };
      const activeTestCode = settings.meta_test_event_code || process.env.META_TEST_EVENT_CODE;
      if (activeTestCode) payload.test_event_code = activeTestCode;

      const url = `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`[Meta CAPI Batch] Successfully dispatched ${chunk.length} Purchase event(s) (₹${eventValue}) to Meta CAPI!`);
        await db.createNotification({
          type: 'success',
          title: '⚡ Meta CAPI Purchase Events Dispatched',
          message: `Dispatched ${chunk.length} Purchase event(s) (₹${eventValue.toLocaleString()} INR) to Meta Pixel ${pixelId}.`,
          details: { count: chunk.length, pixel_id: pixelId, value: eventValue, currency: 'INR' }
        }).catch(() => {});
        broadcast({ type: 'NOTIFICATION_CREATED' });
      } else {
        console.error(`[Meta CAPI Batch] Failed to dispatch CAPI batch:`, data);
      }
    }
  } catch (err) {
    console.error('[Meta CAPI Batch] Execution error:', err.message);
  }
}



// Submit Lead
app.post('/api/leads', leadSubmitRateLimiter.middleware(), async (req, res) => {
  const {
    full_name,
    phone,
    email,
    city,
    employment,
    income_range,
    card_id,
    source,
    agent_id,
    agent_name,
    agent_location,
    consent,
    utm_source,
    utm_info,
    utm_creative_format,
    utm_medium,
    utm_medem,
    utm_campaign,
    utm_id,
    utm_term,
    utm_creative,
    utm_content,
    utm_keyword,
    utm_matchtype,
    utm_network,
    utm_placement,
    utm_channel,
    utm_category,
    fbclid,
    gclid,
    gclsrc,
    dclid,
    msclkid,
    ttclid,
    twclid,
    li_fat_id,
    utm_device,
    utm_location,
    gbraid,
    wbraid,
    landing_page,
    first_landing_page,
    referrer,
    device,
    location,
    utm_params,
    ad_id,
    utm_internal,
    has_credit_card,
    pincode,
    state,
    landmark,
    monthly_income,
    pan_no,
    dob,
    mother_name,
    current_address,
    designation,
    company,
    company_name,
    application_id,
    application_no,
    app_id,
    sbi_company_code,
    sbi_company_category,
    why_ltf_pricing
  } = req.body;

  const trimmedName = full_name ? String(full_name).trim() : '';
  const trimmedPhone = phone ? String(phone).trim() : '';
  const trimmedEmail = email ? String(email).trim() : '';

  if (source === 'agent') {
    if (!trimmedName || !trimmedPhone || !trimmedEmail) {
      return res.status(400).json({ error: 'Missing required lead details' });
    }
  } else {
    if (!trimmedName || !trimmedPhone || !trimmedEmail) {
      return res.status(400).json({ error: 'Missing required lead details' });
    }
  }

  // Validate phone: must be exactly 10 digits
  if (trimmedPhone.length !== 10 || !/^\d+$/.test(trimmedPhone)) {
    return res.status(400).json({ error: 'Mobile number must be exactly 10 digits.' });
  }

  // Validate email: standard regex
  if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  // Validate Mother's Name != First Name, Second Name, or Full Name of applicant
  if (mother_name && full_name) {
    const cleanMother = String(mother_name).trim().replace(/\s+/g, ' ').toLowerCase();
    const cleanFull = String(full_name).trim().replace(/\s+/g, ' ').toLowerCase();
    const motherWords = cleanMother.split(' ').filter(Boolean);
    const fullWords = cleanFull.split(' ').filter(Boolean);

    const firstName = fullWords[0] || '';
    const secondName = fullWords.length > 1 ? fullWords[fullWords.length - 1] : '';

    if (cleanMother === cleanFull) {
      return res.status(400).json({ error: "Mother's name cannot be the same as Full Name." });
    }
    if (firstName && (cleanMother === firstName || motherWords[0] === firstName || motherWords.includes(firstName))) {
      return res.status(400).json({ error: "Mother's name cannot be the same as First Name." });
    }
    if (secondName && (cleanMother === secondName || (motherWords.length === 1 && motherWords[0] === secondName))) {
      return res.status(400).json({ error: "Mother's name cannot be the same as Second Name." });
    }
  }

  const isSbiQde = source === 'sbi_qde' || source === 'SBI (QDE)' || (landing_page && String(landing_page).toLowerCase().includes('sbi_qde'));

  // Validate all 14 required fields for SBI QDE application
  if (isSbiQde) {
    const requiredSbiQdeFields = [
      { key: pan_no, name: 'PAN Number' },
      { key: full_name, name: 'Full Name' },
      { key: dob, name: 'Date of Birth' },
      { key: mother_name, name: "Mother's Name" },
      { key: current_address, name: 'Current Address' },
      { key: pincode, name: 'Pincode' },
      { key: city, name: 'City' },
      { key: state, name: 'State' },
      { key: landmark, name: 'Landmark' },
      { key: phone, name: 'Phone Number' },
      { key: email, name: 'Email Address' },
      { key: employment, name: 'Employment Type' },
      { key: designation, name: 'Designation' },
      { key: company || company_name, name: 'Company Name' }
    ];
    for (const f of requiredSbiQdeFields) {
      if (!f.key || !String(f.key).trim()) {
        return res.status(400).json({ error: `${f.name} is required.` });
      }
    }
  }

  // Validate PAN format if provided
  if (pan_no) {
    const cleanPan = String(pan_no).trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
      return res.status(400).json({ error: 'Please enter a valid 10-character PAN number (e.g., ABCDE1234F).' });
    }
  }

  // Validate pincode serviceability rules
  const dbSettings = await db.getSettings();
  const pincodeMode = dbSettings.pincode_serviceability_mode || 'all';
  const pincodeListRaw = dbSettings.pincode_serviceability_list || '';
  if (pincodeMode !== 'all' && pincode) {
    const cleanPincode = String(pincode).trim();
    const pincodeArray = pincodeListRaw.split(',').map(p => p.trim()).filter(Boolean);
    const isInList = pincodeArray.includes(cleanPincode);
    if (pincodeMode === 'whitelist' && !isInList) {
      return res.status(400).json({ error: 'Credit card services are not available at your pincode currently.' });
    }
    if (pincodeMode === 'blacklist' && isInList) {
      return res.status(400).json({ error: 'Credit card services are not available at your pincode currently.' });
    }
  }

  let card = null;
  let redirectUrlTemplate = '';

  if (card_id) {
    const cards = await db.getCards(source === 'agent');
    card = cards.find(c => c.id === card_id);
    if (!card && source === 'agent') {
      return res.status(404).json({ error: 'Selected credit card not found' });
    }
    if (card) {
      redirectUrlTemplate = card.redirect_url_template || '';
    }
  }

  if (!card) {
    let matchedCard = null;
    
    if (source === 'kiwi' || source === 'simplyclick_sbi' || isSbiQde) {
      const activeCards = await db.getCards(false);
      // For kiwi, simplyclick_sbi, and sbi_qde sources, check utm_internal first
      if (utm_internal) {
        const altStr = String(utm_internal).trim().toLowerCase();
        matchedCard = activeCards.find(c => {
          if (!c.utm_internal) return false;
          return String(c.utm_internal).trim().toLowerCase() === altStr;
        });
        if (matchedCard) {
          console.log(`[Card Matching] Matched card ${matchedCard.name} (${matchedCard.id}) for ${source} source via utm_internal: ${altStr}`);
        }
      }
      // For kiwi, fallback to active Kiwi / Yes Bank card if utm_internal is missing or unmatched
      if (!matchedCard && source === 'kiwi') {
        matchedCard = activeCards.find(c => {
          const n = String(c.name || '').toLowerCase();
          const i = String(c.id || '').toLowerCase();
          const b = String(c.bank || '').toLowerCase();
          return n.includes('kiwi') || i.includes('kiwi') || b.includes('kiwi') || n.includes('yes');
        });
        if (matchedCard) {
          console.log(`[Card Matching] Fallback matched card ${matchedCard.name} (${matchedCard.id}) for kiwi source`);
        }
      }
      // For simplyclick_sbi & sbi_qde, fallback to active SimplyClick / SBI card if utm_internal is missing or unmatched
      if (!matchedCard && (source === 'simplyclick_sbi' || isSbiQde)) {
        matchedCard = activeCards.find(c => {
          const n = String(c.name || '').toLowerCase();
          const i = String(c.id || '').toLowerCase();
          return n.includes('simplyclick') || i.includes('simplyclick') || n.includes('sbi') || i.includes('sbi');
        });
        if (matchedCard) {
          console.log(`[Card Matching] Fallback matched card ${matchedCard.name} (${matchedCard.id}) for ${source} source`);
        }
      }
    } else {
      // For all other public leads, follow the standard multi-step matching
      // First, check if there is an active card matching by utm_internal (which carries the assigned card/model name)
      if (utm_internal) {
        const activeCards = await db.getCards(false);
        const altStr = String(utm_internal).trim().toLowerCase();
        matchedCard = activeCards.find(c => {
          if (!c.utm_internal) return false;
          return String(c.utm_internal).trim().toLowerCase() === altStr;
        });
        if (matchedCard) {
          console.log(`[Card Matching] Matched card ${matchedCard.name} (${matchedCard.id}) via utm_internal: ${altStr}`);
        }
      }

      // Fallback to check if there is an active card matching by ad_id (to maintain the old functionality)
      if (!matchedCard && ad_id) {
        const activeCards = await db.getCards(false);
        const adIdStr = String(ad_id).trim().toLowerCase();
        matchedCard = activeCards.find(c => {
          if (!c.ad_id) return false;
          const adIdList = String(c.ad_id).split(',').map(s => s.trim().toLowerCase());
          return adIdList.includes(adIdStr);
        });
        if (matchedCard) {
          console.log(`[Card Matching] Matched card ${matchedCard.name} (${matchedCard.id}) via ad_id: ${adIdStr}`);
        }
      }

      // If not matched by ad_id, check if public lead has utm_info matching an active card
      if (!matchedCard && utm_info) {
        const activeCards = await db.getCards(false);
        const infoLower = String(utm_info).trim().toLowerCase();
        
        // 1. Exact match on ID, card_ID, or ID suffix
        matchedCard = activeCards.find(c => {
          const idLower = String(c.id).toLowerCase();
          return idLower === infoLower || idLower === `card_${infoLower}` || idLower.endsWith(`_${infoLower}`);
        });
        
        // 2. Match if card name contains utm_info (case-insensitive)
        if (!matchedCard) {
          matchedCard = activeCards.find(c => {
            const nameLower = String(c.name).toLowerCase();
            return nameLower.includes(infoLower);
          });
        }

        // 3. Match if utm_info contains card name (case-insensitive)
        if (!matchedCard) {
          matchedCard = activeCards.find(c => {
            const nameLower = String(c.name).toLowerCase();
            return infoLower.includes(nameLower);
          });
        }
      }
    }

    if (matchedCard) {
      card = matchedCard;
      redirectUrlTemplate = card.redirect_url_template || '';
    } else {
      const settings = await db.getSettings();
      redirectUrlTemplate = settings.public_redirect_url || '';
    }
  }

  // Validate bank-specific pincode serviceability rules
  if (card && card.bank && pincode) {
    const bankRulesRaw = dbSettings.bank_pincode_rules || '';
    if (bankRulesRaw) {
      try {
        const bankRules = JSON.parse(bankRulesRaw);
        const rule = bankRules[card.bank];
        if (rule && rule.mode === 'list') {
          const cleanPincode = String(pincode).trim();
          const pincodeArray = String(rule.list || '').split(',').map(p => p.trim()).filter(Boolean);
          if (!pincodeArray.includes(cleanPincode)) {
            return res.status(400).json({ error: `${card.bank} cards facilities are currently not available for your location.` });
          }
        }
      } catch (e) {
        console.error('[Pincode Validation] Failed to parse bank_pincode_rules:', e);
      }
    }
  }

  // If utm_params is not provided, dynamically build it from all req.body keys
  let resolvedUtmParams = utm_params;
  if (source !== 'agent' && !resolvedUtmParams) {
    resolvedUtmParams = {};
    const trackingKeys = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 
      'utm_channel', 'utm_category', 'utm_info', 'utm_creative_format', 
      'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id'
    ];
    for (const key of Object.keys(req.body)) {
      if (key.startsWith('utm_') || trackingKeys.includes(key)) {
        resolvedUtmParams[key] = req.body[key];
      }
    }
  }

  const leadData = {
    full_name: trimmedName,
    phone: trimmedPhone,
    email: trimmedEmail,
    city: city || null,
    employment: employment || null,
    income_range: (() => {
      if (source === 'agent') return income_range || null;
      if (monthly_income) {
        const parsed = parseInt(String(monthly_income).replace(/[^\d]/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0 && !String(monthly_income).includes('–') && !String(monthly_income).includes('-')) {
          return `₹${parsed.toLocaleString('en-IN')}`;
        }
        return monthly_income;
      }
      return null;
    })(),
    card_id: card ? card.id : null,
    card_name: card ? card.name : (() => {
      const inspect = [utm_source, utm_campaign, utm_content, landing_page, source].filter(Boolean).join(' ').toLowerCase();
      if (inspect.includes('scapia')) return 'Scapia Digital';
      if (inspect.includes('kiwi') || inspect.includes('gokiwi')) return 'Yes_Kiwi';
      if (inspect.includes('simplyclick')) return 'SBI SimplyClick';
      if (inspect.includes('sbicard') || inspect.includes('sbi')) return 'SBI Online';
      if (inspect.includes('pixel')) return 'Pixel';
      if (inspect.includes('tata')) return 'TATA';
      if (inspect.includes('hdfc')) return 'HDFC Card';
      if (inspect.includes('axis')) return 'Axis Card';
      if (inspect.includes('icici')) return 'ICICI Card';
      return 'Credit Card';
    })(),
    card_bank: card ? card.bank : (() => {
      const inspect = [utm_source, utm_campaign, utm_content, landing_page, source].filter(Boolean).join(' ').toLowerCase();
      if (inspect.includes('hdfc') || inspect.includes('pixel')) return 'HDFC';
      if (inspect.includes('sbi') || inspect.includes('simplyclick')) return 'SBI';
      if (inspect.includes('kiwi') || inspect.includes('gokiwi')) return 'KIWI';
      if (inspect.includes('scapia')) return 'SCAPIA';
      if (inspect.includes('icici')) return 'ICICI';
      if (inspect.includes('axis')) return 'AXIS';
      if (inspect.includes('pnb')) return 'PNB';
      if (inspect.includes('yes')) return 'YES';
      if (inspect.includes('au')) return 'AU';
      return 'OTHER';
    })(),
    source: isSbiQde ? 'SBI (QDE)' : (source || 'public'),
    agent_id: source === 'agent' ? agent_id : null,
    agent_name: source === 'agent' ? agent_name : null,
    agent_location: source === 'agent' ? agent_location : null,
    consent: !!consent,
    utm_source: source !== 'agent' ? (utm_source || null) : null,
    utm_info: source !== 'agent' ? (utm_info || utm_medium || utm_medem || null) : null,
    utm_creative_format: source !== 'agent' ? (utm_creative_format || null) : null,
    utm_medium: source !== 'agent' ? (utm_medium || utm_medem || null) : null,
    utm_campaign: source !== 'agent' ? (utm_campaign || null) : null,
    utm_id: source !== 'agent' ? (utm_id || null) : null,
    utm_term: source !== 'agent' ? (utm_term || null) : null,
    utm_creative: source !== 'agent' ? (utm_creative || null) : null,
    utm_content: source !== 'agent' ? (utm_content || null) : null,
    utm_keyword: source !== 'agent' ? (utm_keyword || null) : null,
    utm_matchtype: source !== 'agent' ? (utm_matchtype || null) : null,
    utm_network: source !== 'agent' ? (utm_network || null) : null,
    utm_placement: source !== 'agent' ? (utm_placement || null) : null,
    utm_channel: source !== 'agent' ? (utm_channel || null) : null,
    utm_category: source !== 'agent' ? (utm_category || null) : null,
    fbclid: source !== 'agent' ? (fbclid || null) : null,
    gclid: source !== 'agent' ? (gclid || null) : null,
    gclsrc: source !== 'agent' ? (gclsrc || null) : null,
    dclid: source !== 'agent' ? (dclid || null) : null,
    msclkid: source !== 'agent' ? (msclkid || null) : null,
    ttclid: source !== 'agent' ? (ttclid || null) : null,
    twclid: source !== 'agent' ? (twclid || null) : null,
    li_fat_id: source !== 'agent' ? (li_fat_id || null) : null,
    utm_device: source !== 'agent' ? (utm_device || device || null) : null,
    utm_location: source !== 'agent' ? (utm_location || location || null) : null,
    gbraid: source !== 'agent' ? (gbraid || null) : null,
    wbraid: source !== 'agent' ? (wbraid || null) : null,
    landing_page: source !== 'agent' ? (landing_page || null) : null,
    first_landing_page: source !== 'agent' ? (first_landing_page || null) : null,
    referrer: source !== 'agent' ? (referrer || null) : null,
    utm_params: source !== 'agent' ? (resolvedUtmParams || null) : null,
    ad_id: utm_creative || ad_id || (card ? card.ad_id : null) || null,
    utm_internal: source !== 'agent' ? (utm_internal || (card ? card.utm_internal : null) || null) : null,
    has_credit_card: has_credit_card || null,
    pincode: pincode || null,
    monthly_income: monthly_income || null,
    pan_no: pan_no ? String(pan_no).trim().toUpperCase() : null,
    dob: dob || null,
    mother_name: mother_name || null,
    current_address: current_address || null,
    state: state || null,
    landmark: landmark || null,
    designation: designation || null,
    company_name: company || company_name || null,
    application_id: application_id || application_no || app_id || null,
    ip_address: (() => {
      let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      if (clientIp.includes(',')) {
        clientIp = clientIp.split(',')[0].trim();
      }
      return clientIp || null;
    })(),
    user_agent: req.headers['user-agent'] || null,
    mis_data: {
      company_code: sbi_company_code || null,
      company_category: sbi_company_category || null,
      why_ltf_pricing: why_ltf_pricing || null
    }
  };

  const newLead = await db.addLead(leadData);

  const urnVal = newLead.urn || '';
  const urnFirstVal = urnVal.length >= 6 ? urnVal.substring(0, 6) : urnVal;
  const urnLastVal = urnVal.length >= 6 ? urnVal.substring(6) : '';

  // Compute redirect URL using template placeholders (case-insensitive)
  const agentCodeVal = (source === 'agent' && agent_id) ? agent_id : '';
  let redirectUrl = redirectUrlTemplate;
  redirectUrl = redirectUrl
    .replace(/{name}/gi, encodeURIComponent(trimmedName))
    .replace(/{phone}/gi, encodeURIComponent(trimmedPhone))
    .replace(/{email}/gi, encodeURIComponent(trimmedEmail))
    .replace(/{urn}/gi, encodeURIComponent(urnVal))
    .replace(/{urm}/gi, encodeURIComponent(urnVal)) // support legacy placeholder if any
    .replace(/{urn_first}/gi, encodeURIComponent(urnFirstVal))
    .replace(/{urn_last}/gi, encodeURIComponent(urnLastVal))
    .replace(/{agent_id}/gi, encodeURIComponent(agentCodeVal))
    .replace(/{utm_source}/gi, encodeURIComponent(utm_source || ''))
    .replace(/{utm_medium}/gi, encodeURIComponent(utm_medium || ''))
    .replace(/{utm_campaign}/gi, encodeURIComponent(utm_campaign || ''))
    .replace(/{utm_id}/gi, encodeURIComponent(utm_id || ''))
    .replace(/{utm_term}/gi, encodeURIComponent(utm_term || ''))
    .replace(/{utm_creative}/gi, encodeURIComponent(utm_creative || ''))
    .replace(/{ad_id}/gi, encodeURIComponent(leadData.ad_id || ''))
    .replace(/{utm_internal}/gi, encodeURIComponent(leadData.utm_internal || ''))
    .replace(/{utm_content}/gi, encodeURIComponent(utm_content || ''))
    .replace(/{utm_keyword}/gi, encodeURIComponent(utm_keyword || ''))
    .replace(/{utm_matchtype}/gi, encodeURIComponent(utm_matchtype || ''))
    .replace(/{utm_network}/gi, encodeURIComponent(utm_network || ''))
    .replace(/{utm_placement}/gi, encodeURIComponent(utm_placement || ''))
    .replace(/{utm_device}/gi, encodeURIComponent(utm_device || device || ''))
    .replace(/{utm_location}/gi, encodeURIComponent(utm_location || location || ''))
    .replace(/{gbraid}/gi, encodeURIComponent(gbraid || ''))
    .replace(/{wbraid}/gi, encodeURIComponent(wbraid || ''))
    .replace(/{landing_page}/gi, encodeURIComponent(landing_page || ''))
    .replace(/{first_landing_page}/gi, encodeURIComponent(first_landing_page || ''))
    .replace(/{referrer}/gi, encodeURIComponent(referrer || ''))
    .replace(/{utm_info}/gi, encodeURIComponent(utm_info || ''))
    .replace(/{utm_creative_format}/gi, encodeURIComponent(utm_creative_format || ''))
    .replace(/{application_id}/gi, encodeURIComponent(leadData.application_id || ''));

  newLead.redirect_url = redirectUrl;
  
  // Save updated redirect_url to database
  await db.updateLead(newLead.id, newLead);

  // Trigger Meta Conversions API (CAPI) Event asynchronously in background
  sendMetaCapiEvent(newLead, 'Lead').then(async (capiResult) => {
    if (capiResult && capiResult.status !== 'skipped') {
      newLead.capi_status = capiResult.status;
      newLead.capi_response = capiResult.response || { error: capiResult.error };
      await db.updateLead(newLead.id, newLead).catch(err => console.error('Failed to update lead with CAPI status:', err));
    }
  }).catch(err => console.error('Error in sendMetaCapiEvent process:', err));

  // Real-time broadcast notification of a new lead!
  broadcast({ type: 'LEAD_ADDED', data: newLead });

  // Send WhatsApp Referral Notification with Tracking URL for agent/kiwi/simplyclick_sbi sources or Kiwi matched cards on creation
  const isKiwiCard = card && (card.id === 'card_yomuvufqh' || card.name.toLowerCase().includes('kiwi') || String(card.id).includes('kiwi'));
  const isSingleStepLead = (source === 'agent' || source === 'kiwi' || source === 'simplyclick_sbi' || source === 'scapia' || pan_no || monthly_income || employment || isKiwiCard);
  if (isSingleStepLead && !isSbiQde) {
    console.log(`[WhatsApp Lead Creation] Triggering referral link dispatch for single-step lead: ${trimmedPhone}`);
    const agentCode = source === 'agent' ? (agent_id || 'active') : 'public';
    const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const settings = await db.getSettings();
    
    const waBaseUrl = getPublicSiteUrl(req, settings);
    const referralLink = (newLead.redirect_url && newLead.redirect_url.startsWith('http')) 
      ? newLead.redirect_url 
      : `${waBaseUrl}/refer/${agentCode}/${dateCode}/${newLead.urn}`;
    const cardNameStr = card ? `${card.bank} ${card.name}` : 'FinMantra Partner Bank';
    const referralMsg = `Hello ${trimmedName}, thank you for choosing FinMantra. You can access your secure bank portal for the ${cardNameStr} application here: ${referralLink}`;
    const referralTemplateName = settings.wa_referral_template_name || process.env.WA_REFERRAL_TEMPLATE_NAME || 'finmantra_portal';
    const candidateRefTemplates = [referralTemplateName, 'finmantra_portal', 'finmantra_welcome', 'transactional_link', 'jaspers_market_order_confirmation_v1'].filter((v, i, a) => v && a.indexOf(v) === i);
    
    for (const refTName of candidateRefTemplates) {
      try {
        let params = [trimmedName, referralLink];
        if (refTName === 'jaspers_market_order_confirmation_v1') {
          const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          params = [trimmedName, referralLink, dateStr];
        }
        const result = await sendWhatsAppTemplate(trimmedPhone, refTName, params);
        if (!result.simulated) {
          console.log(`[WhatsApp API] Referral template "${refTName}" sent to ${trimmedPhone} via Meta API.`);
        }
        break;
      } catch (err) {
        console.warn(`[WhatsApp API Warning] Referral template "${refTName}" failed for ${trimmedPhone}: ${err.message}.`);
        if (err.isAuthError || err.message.includes('Authentication Error') || err.message.includes('Code: 190')) {
          console.error(`[WhatsApp API CRITICAL] Stopping referral template trials: Meta Access Token is invalid/expired (Code 190).`);
          break;
        }
      }
    }

    console.log(`=========================================`);
    console.log(`[WhatsApp Referral Link for ${trimmedPhone}]:`);
    console.log(referralMsg);
    console.log(`=========================================`);
  }

  // Send Custom WhatsApp Confirmation for SBI QDE Landing Page
  if (isSbiQde) {
    const qdeMsg = "Thank you for submitting this application. We will submit your application with bank and if you’re eligible for any credit card with bank, our representative will call you shortly";
    console.log(`[WhatsApp SBI QDE Creation] Sending confirmation message to ${trimmedPhone}`);
    try {
      const settings = await db.getSettings();
      const gateway = settings.whatsapp_gateway || 'baileys';
      if (gateway === 'baileys' && baileys.getBaileysStatus().status === 'CONNECTED') {
        await baileys.sendBaileysMessage(trimmedPhone, qdeMsg);
        console.log(`[WhatsApp Baileys] Sent SBI QDE thank you message to ${trimmedPhone}`);
      } else {
        await sendWhatsAppTemplate(trimmedPhone, 'finmantra_welcome', [trimmedName, qdeMsg]).catch(() => {});
        console.log(`[WhatsApp Meta API] Dispatched SBI QDE thank you template to ${trimmedPhone}`);
      }
    } catch (waErr) {
      console.error('[WhatsApp SBI QDE Error]', waErr.message);
    }
  }

  res.json({
    success: true,
    urn: newLead.urn,
    redirectUrl: resolveIntentUrl(redirectUrl)
  });
});

// Update Lead Details from Public Form Step 2 by URN
app.put('/api/leads/public/urn/:urn', async (req, res) => {
  const { urn } = req.params;
  const {
    employment,
    monthly_income,
    designation,
    company,
    company_name,
    pan_no,
    has_credit_card,
    pincode,
    current_address,
    card_id
  } = req.body;

  const lead = await db.getLeadByUrn(urn);
  if (!lead) {
    return res.status(404).json({ error: 'Lead tracking record not found' });
  }

  // Validate PAN format if provided
  if (pan_no) {
    const cleanPan = String(pan_no).trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
      return res.status(400).json({ error: 'Please enter a valid 10-character PAN number (e.g., ABCDE1234F).' });
    }
  }

  // Validate pincode serviceability rules
  const dbSettings = await db.getSettings();
  const pincodeMode = dbSettings.pincode_serviceability_mode || 'all';
  const pincodeListRaw = dbSettings.pincode_serviceability_list || '';
  if (pincodeMode !== 'all' && pincode) {
    const cleanPincode = String(pincode).trim();
    const pincodeArray = pincodeListRaw.split(',').map(p => p.trim()).filter(Boolean);
    const isInList = pincodeArray.includes(cleanPincode);
    if (pincodeMode === 'whitelist' && !isInList) {
      return res.status(400).json({ error: 'Credit card services are not available at your pincode currently.' });
    }
    if (pincodeMode === 'blacklist' && isInList) {
      return res.status(400).json({ error: 'Credit card services are not available at your pincode currently.' });
    }
  }

  // Update lead object fields
  if (card_id) {
    lead.card_id = card_id;
    const activeCards = await db.getCards(false);
    const matchedCard = activeCards.find(c => c.id === card_id);
    if (matchedCard) {
      lead.card_name = matchedCard.name;
      lead.card_bank = matchedCard.bank;
    }
  }
  lead.employment = employment || lead.employment;
  lead.monthly_income = monthly_income || lead.monthly_income;
  if (monthly_income) {
    const parsed = parseInt(String(monthly_income).replace(/[^\d]/g, ''), 10);
    if (!isNaN(parsed) && parsed > 0 && !String(monthly_income).includes('–') && !String(monthly_income).includes('-')) {
      lead.income_range = `₹${parsed.toLocaleString('en-IN')}`;
    } else {
      lead.income_range = monthly_income;
    }
  }
  lead.designation = designation || lead.designation;
  lead.company_name = company || company_name || lead.company_name;
  lead.pan_no = pan_no ? String(pan_no).trim().toUpperCase() : lead.pan_no;
  lead.has_credit_card = has_credit_card || lead.has_credit_card;
  lead.pincode = pincode || lead.pincode;
  lead.current_address = current_address || lead.current_address;

  // Re-calculate the redirect URL if there's a card assigned (since monthly_income/pincode might affect it)
  let card = null;
  let redirectUrlTemplate = '';
  if (lead.card_id) {
    const activeCards = await db.getCards(false);
    card = activeCards.find(c => c.id === lead.card_id);
    if (card) {
      redirectUrlTemplate = card.redirect_url_template || '';
    }
  }
  
  if (!redirectUrlTemplate) {
    redirectUrlTemplate = dbSettings.public_redirect_url || '';
  }

  // Validate bank-specific pincode serviceability rules
  if (card && card.bank && pincode) {
    const bankRulesRaw = dbSettings.bank_pincode_rules || '';
    if (bankRulesRaw) {
      try {
        const bankRules = JSON.parse(bankRulesRaw);
        const rule = bankRules[card.bank];
        if (rule && rule.mode === 'list') {
          const cleanPincode = String(pincode).trim();
          const pincodeArray = String(rule.list || '').split(',').map(p => p.trim()).filter(Boolean);
          if (!pincodeArray.includes(cleanPincode)) {
            return res.status(400).json({ error: `${card.bank} cards facilities are currently not available for your location.` });
          }
        }
      } catch (e) {
        console.error('[Pincode Validation] Failed to parse bank_pincode_rules:', e);
      }
    }
  }

  // Compute final redirect URL
  const urnFirstVal = urn.length >= 6 ? urn.substring(0, 6) : urn;
  const urnLastVal = urn.length >= 6 ? urn.substring(6) : '';
  const agentCodeVal = lead.agent_id || '';
  
  let redirectUrl = redirectUrlTemplate;
  redirectUrl = redirectUrl
    .replace(/{name}/gi, encodeURIComponent(lead.full_name || ''))
    .replace(/{phone}/gi, encodeURIComponent(lead.phone || ''))
    .replace(/{email}/gi, encodeURIComponent(lead.email || ''))
    .replace(/{urn}/gi, encodeURIComponent(urn))
    .replace(/{urm}/gi, encodeURIComponent(urn))
    .replace(/{urn_first}/gi, encodeURIComponent(urnFirstVal))
    .replace(/{urn_last}/gi, encodeURIComponent(urnLastVal))
    .replace(/{agent_id}/gi, encodeURIComponent(agentCodeVal))
    .replace(/{utm_source}/gi, encodeURIComponent(lead.utm_source || ''))
    .replace(/{utm_medium}/gi, encodeURIComponent(lead.utm_medium || ''))
    .replace(/{utm_campaign}/gi, encodeURIComponent(lead.utm_campaign || ''))
    .replace(/{utm_id}/gi, encodeURIComponent(lead.utm_id || ''))
    .replace(/{utm_term}/gi, encodeURIComponent(lead.utm_term || ''))
    .replace(/{utm_creative}/gi, encodeURIComponent(lead.utm_creative || ''))
    .replace(/{ad_id}/gi, encodeURIComponent(lead.ad_id || ''))
    .replace(/{utm_internal}/gi, encodeURIComponent(lead.utm_internal || ''))
    .replace(/{utm_content}/gi, encodeURIComponent(lead.utm_content || ''))
    .replace(/{utm_keyword}/gi, encodeURIComponent(lead.utm_keyword || ''))
    .replace(/{utm_matchtype}/gi, encodeURIComponent(lead.utm_matchtype || ''))
    .replace(/{utm_network}/gi, encodeURIComponent(lead.utm_network || ''))
    .replace(/{utm_placement}/gi, encodeURIComponent(lead.utm_placement || ''))
    .replace(/{utm_device}/gi, encodeURIComponent(lead.utm_device || ''))
    .replace(/{utm_location}/gi, encodeURIComponent(lead.utm_location || ''))
    .replace(/{gbraid}/gi, encodeURIComponent(lead.gbraid || ''))
    .replace(/{wbraid}/gi, encodeURIComponent(lead.wbraid || ''))
    .replace(/{landing_page}/gi, encodeURIComponent(lead.landing_page || ''))
    .replace(/{first_landing_page}/gi, encodeURIComponent(lead.first_landing_page || ''))
    .replace(/{referrer}/gi, encodeURIComponent(lead.referrer || ''))
    .replace(/{utm_info}/gi, encodeURIComponent(lead.utm_info || ''))
    .replace(/{utm_creative_format}/gi, encodeURIComponent(lead.utm_creative_format || ''));

  lead.redirect_url = redirectUrl;

  await db.updateLead(lead.id, lead);

  // Broadcast update
  broadcast({ type: 'LEAD_UPDATED', data: lead });

  // Send WhatsApp Referral Notification with Tracking URL only when Step 2 is submitted successfully
  const agentCode = lead.agent_id || 'public';
  const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  
  const waBaseUrl = getPublicSiteUrl(req, dbSettings);
  const referralLink = (lead.redirect_url && lead.redirect_url.startsWith('http')) 
    ? lead.redirect_url 
    : `${waBaseUrl}/refer/${agentCode}/${dateCode}/${lead.urn}`;
  const cardNameStr = card ? `${card.bank} ${card.name}` : 'FinMantra Partner Bank';
  const referralMsg = `Hello ${lead.full_name}, thank you for choosing FinMantra. You can access your secure bank portal for the ${cardNameStr} application here: ${referralLink}`;
  const referralTemplateName = dbSettings.wa_referral_template_name || process.env.WA_REFERRAL_TEMPLATE_NAME || 'finmantra_portal';
  const candidateRefTemplates = [referralTemplateName, 'finmantra_portal', 'finmantra_welcome', 'transactional_link', 'jaspers_market_order_confirmation_v1'].filter((v, i, a) => v && a.indexOf(v) === i);
  
  for (const refTName of candidateRefTemplates) {
    try {
      let params = [lead.full_name, referralLink];
      if (refTName === 'jaspers_market_order_confirmation_v1') {
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        params = [lead.full_name, referralLink, dateStr];
      }
      const result = await sendWhatsAppTemplate(lead.phone, refTName, params);
      if (!result.simulated) {
        console.log(`[WhatsApp API] Referral template "${refTName}" sent to ${lead.phone} via Meta API.`);
      }
      break;
    } catch (err) {
      console.warn(`[WhatsApp API Warning] Referral template "${refTName}" failed for ${lead.phone}: ${err.message}.`);
      if (err.isAuthError || err.message.includes('Authentication Error') || err.message.includes('Code: 190')) {
        console.error(`[WhatsApp API CRITICAL] Stopping referral template trials: Meta Access Token is invalid/expired (Code 190).`);
        break;
      }
    }
  }

  console.log(`=========================================`);
  console.log(`[WhatsApp Referral Link for ${lead.phone}]:`);
  console.log(referralMsg);
  console.log(`=========================================`);

  res.json({
    success: true,
    urn: lead.urn,
    redirectUrl: resolveIntentUrl(redirectUrl)
  });
});

// Fetch Lead Details by URN (Public link landing page resolver)
app.get('/api/leads/urn/:urn', async (req, res) => {
  const { urn } = req.params;
  const lead = await db.getLeadByUrn(urn);

  if (lead) {
    res.json({
      success: true,
      urn: lead.urn,
      full_name: lead.full_name,
      card_name: lead.card_name,
      card_bank: lead.card_bank,
      redirectUrl: resolveIntentUrl(lead.redirect_url),
      created_at: lead.created_at
    });
  } else {
    res.status(404).json({ error: 'Application URN tracking record not found' });
  }
});

// Legacy URM resolver to support existing references
app.get('/api/leads/urm/:urm', async (req, res) => {
  const { urm } = req.params;
  const lead = await db.getLeadByUrn(urm);

  if (lead) {
    res.json({
      success: true,
      urn: lead.urn,
      full_name: lead.full_name,
      card_name: lead.card_name,
      card_bank: lead.card_bank,
      redirectUrl: resolveIntentUrl(lead.redirect_url),
      created_at: lead.created_at
    });
  } else {
    res.status(404).json({ error: 'Application URN tracking record not found' });
  }
});

// URN Canonicalizer Helper
function canonicalizeURN(urnStr) {
  if (!urnStr) return '';
  const clean = String(urnStr).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // Try to match the DB format: FM + year(4) + monthLetter(1) + day(2) + sequence(5)
  const dbMatch = clean.match(/^FM(\d{4})([A-L])(\d{2})(\d+)$/);
  if (dbMatch) {
    const year = dbMatch[1];
    const monthLetter = dbMatch[2];
    const day = dbMatch[3];
    const seq = parseInt(dbMatch[4], 10);
    const monthNum = String(monthLetter.charCodeAt(0) - 64).padStart(2, '0');
    return `FM${year}${monthNum}${day}${seq}`;
  }

  // Try to match the MIS format: FM + year(4) + monthNum(2) + day(2) + sequence
  const misMatch = clean.match(/^FM(\d{4})(\d{2})(\d{2})(\d+)$/);
  if (misMatch) {
    const year = misMatch[1];
    const monthNum = misMatch[2];
    const day = misMatch[3];
    const seq = parseInt(misMatch[4], 10);
    return `FM${year}${monthNum}${day}${seq}`;
  }

  // Try to match raw numbers only
  const numMatch = clean.match(/^(\d{4})(\d{2})(\d{2})(\d+)$/);
  if (numMatch) {
    const year = numMatch[1];
    const monthNum = numMatch[2];
    const day = numMatch[3];
    const seq = parseInt(numMatch[4], 10);
    return `FM${year}${monthNum}${day}${seq}`;
  }

  return clean;
}

// Case/space-insensitive row value getter
function getRowValue(row, targetKey) {
  const cleanTarget = targetKey.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const key of Object.keys(row)) {
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanKey === cleanTarget) {
      return row[key];
    }
  }
  return '';
}

// KIWI Bank Current State Ranking Table
// Rank 1 = NOT_STARTED (Lowest Rank)
// Rank 13 = AC_CREATED (Highest Winning Rank)
// Higher rank number = Better status. Winner = bank with HIGHEST rank number.
const KIWI_STATUS_RANKING = {
  'NOT_STARTED': 1,             // Lowest Rank
  'NOT_APPLICABLE': 2,
  'REJECTED': 3,
  'IN_PROGRESS': 4,
  'DOC_UPLOAD_PENDING': 5,
  'DOC_UPLOADED': 6,
  'KYC_PENDING': 7,
  'DOC_REUPLOAD_REQUIRED': 8,
  'KYC_DONE': 9,
  'SUBMITTED': 10,
  'SUBMITTED_OTP_VERIFIED': 11,
  'VKYC_PENDING': 12,
  'AC_CREATED': 13              // Highest Winning Rank
};

function cleanUserId(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (str.endsWith('.0')) str = str.slice(0, -2);
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Returns rank number (1-13). Higher = better. 0 = unknown/unmatched.
function getStatusRank(statusStr) {
  if (!statusStr) return 0;
  const str = String(statusStr).trim().toUpperCase();
  const clean = str.replace(/[^A-Z0-9]/g, '');

  if (clean.includes('ACCREATED') || clean.includes('ACCOUNTCREATED')) return 13;
  if (clean.includes('VKYCPENDING') || clean.includes('VKYC')) return 12;
  if (clean.includes('OTPVERIFIED') || clean.includes('SUBMITTEDOTP')) return 11;
  if (clean.includes('SUBMITTED')) return 10;
  if (clean.includes('KYCDONE') || clean.includes('KYCCOMPLETED')) return 9;
  if (clean.includes('DOCREUPLOAD') || clean.includes('REUPLOAD')) return 8;
  if (clean.includes('KYCPENDING')) return 7;
  if (clean.includes('DOCUPLOADED') || clean.includes('DOCUMENTUPLOADED')) return 6;
  if (clean.includes('DOCUPLOADPENDING') || clean.includes('DOCPENDING') || clean.includes('DOCUMENTPENDING')) return 5;
  if (clean.includes('INPROGRESS') || clean.includes('PROCESSING')) return 4;
  if (clean.includes('REJECT') || clean.includes('DECLINE') || clean.includes('CANCEL')) return 3;
  if (clean.includes('NOTAPPLICABLE') || clean.includes('NA')) return 2;
  if (clean.includes('NOTSTARTED')) return 1;

  const cleanUnderscore = str.replace(/[\s-]+/g, '_');
  if (KIWI_STATUS_RANKING[cleanUnderscore] !== undefined) {
    return KIWI_STATUS_RANKING[cleanUnderscore];
  }
  return 0;
}

function standardizeStatus(statusStr, rawRow) {
  if (!statusStr) return 'Pending';
  const clean = String(statusStr).trim().toUpperCase().replace(/[\s-]+/g, '_');

  const statusMap = {
    'NOT_STARTED': 'New',
    'NOT_APPLICABLE': 'Not Applicable',
    'REJECTED': 'Rejected',
    'IN_PROGRESS': 'In Progress',
    'DOC_UPLOAD_PENDING': 'Document Pending',
    'DOC_UPLOADED': 'Document Uploaded',
    'KYC_PENDING': 'KYC Pending',
    'DOC_REUPLOAD_REQUIRED': 'Reupload Required',
    'KYC_DONE': 'KYC Done',
    'SUBMITTED': 'Submitted',
    'SUBMITTED_OTP_VERIFIED': 'OTP Verified',
    'VKYC_PENDING': 'VKYC Pending',
    'AC_CREATED': 'Approved',
    'APPROVED': 'Approved'
  };

  if (statusMap[clean]) return statusMap[clean];

  const lower = String(statusStr).trim().toLowerCase();
  if (lower.includes('ac_created') || lower.includes('account_created') || lower.includes('approve') || lower.includes('success') || lower.includes('disbursed') || lower.includes('active')) {
    return 'Approved';
  }
  if (lower.includes('reject') || lower.includes('decline') || lower.includes('cancel')) {
    return 'Rejected';
  }
  return 'Pending';
}

function extractUrnFromText(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (!str) return null;
  // Match standard URN patterns inside text e.g., ENT_FM2026G2000119_971692 -> FM2026G2000119
  const match = str.match(/FM\d{4}[A-Z]\d{7}/i) || 
                str.match(/FM\d{4}\d{6,12}/i) || 
                str.match(/FM[0-9A-Z]{8,18}/i);
  return match ? match[0].toUpperCase() : null;
}

// Upload MIS Route (Admin or Bank MIS Agent)
app.post('/api/leads/upload-mis', authenticateToken, upload.single('file'), async (req, res) => {
  if (req.user.role !== 'admin' && !req.user.can_upload_mis) {
    return res.status(403).json({ error: 'Permission denied. Only Admins and authorized Bank MIS Agents can upload MIS files.' });
  }
  if (req.socket) req.socket.setTimeout(600000);
  if (res.setTimeout) res.setTimeout(600000);

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const selectedBank = (req.body.bank || req.body.bankName) ? String(req.body.bank || req.body.bankName).trim() : 'HDFC Bank';
  const filename = req.file.originalname;
  const ext = filename.split('.').pop().toLowerCase();
  let parsedRows = [];

  try {
    if (ext === 'csv') {
      const csvText = req.file.buffer.toString('utf-8');
      const lines = csvText.split('\n');
      if (lines.length > 0) {
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const values = [];
          let current = '';
          let inQuotes = false;
          const line = lines[i];
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim().replace(/^"|"$/g, ''));
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim().replace(/^"|"$/g, ''));
          
          if (values.length > 0) {
            const rowObj = {};
            headers.forEach((header, idx) => {
              rowObj[header] = values[idx] || '';
            });
            parsedRows.push(rowObj);
          }
        }
      }
    } else if (ext === 'xls' || ext === 'xlsx') {
      const isKiwiUpload = selectedBank.toLowerCase().includes('kiwi');

      if (isKiwiUpload) {
        let pythonSuccess = false;
        const tempPath = path.join(os.tmpdir(), `kiwi_upload_${Date.now()}_${Math.random().toString(36).substring(7)}.xlsx`);
        
        try {
          fs.writeFileSync(tempPath, req.file.buffer);
          const pyScript = path.join(__dirname, 'parse_kiwi_mis.py');
          const pyCmd = process.platform === 'win32' ? 'python' : 'python3';

          const pyResult = await new Promise((resolve) => {
            execFile(pyCmd, [pyScript, tempPath], { maxBuffer: 1024 * 1024 * 100 }, (error, stdout, stderr) => {
              if (error) {
                console.error('[KIWI Python Parser] Error:', error.message, stderr);
                resolve(null);
              } else {
                try {
                  const data = JSON.parse(stdout);
                  resolve(data);
                } catch(e) {
                  console.error('[KIWI Python Parser] JSON parse error:', e.message);
                  resolve(null);
                }
              }
            });
          });

          if (pyResult && pyResult.parsedRows) {
            parsedRows = pyResult.parsedRows;
            pythonSuccess = true;
            console.log(`[KIWI Python Parser] Success! Extracted ${parsedRows.length} rows (Skipped ${pyResult.skippedRows || 0} non-URN rows) in <2s.`);
          }
        } catch(pyErr) {
          console.error('[KIWI Python Parser] Execution failed:', pyErr.message);
        } finally {
          if (fs.existsSync(tempPath)) {
            try { fs.unlinkSync(tempPath); } catch(e) {}
          }
        }

        // Fallback to JS xlsx parser if Python failed or was not available
        if (!pythonSuccess) {
          console.log('[KIWI MIS] Python parser unavailable or failed. Using fallback JS parser...');
          const workbook = xlsx.read(req.file.buffer, { type: 'buffer', dense: true, cellHTML: false, cellFormula: false, cellText: false });
          const yesSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('yes'));
          const auSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('au'));
          const pnbSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('pnb'));

          if (!yesSheetName) {
            return res.status(400).json({ error: 'YES KIWI sheet not found in uploaded Excel file. Please ensure the file contains YES KIWI, AU KIWI, and PNB KIWI sheets.' });
          }

          const yesRows = xlsx.utils.sheet_to_json(workbook.Sheets[yesSheetName], { defval: '' });
          const auRows = auSheetName ? xlsx.utils.sheet_to_json(workbook.Sheets[auSheetName], { defval: '' }) : [];
          const pnbRows = pnbSheetName ? xlsx.utils.sheet_to_json(workbook.Sheets[pnbSheetName], { defval: '' }) : [];

          function findStateKey(sampleRow) {
            if (!sampleRow) return null;
            const sampleKeys = Object.keys(sampleRow);
            let key = sampleKeys.find(k => {
              const clean = k.toLowerCase().replace(/[^a-z]/g, '');
              return clean === 'currentstate' || clean === 'currentstatus' || clean === 'appstate' || clean === 'appstatus';
            });
            if (key) return key;
            key = sampleKeys.find(k => {
              const clean = k.toLowerCase();
              return clean.includes('current') && (clean.includes('state') || clean.includes('status'));
            });
            if (key) return key;
            key = sampleKeys.find(k => {
              const clean = k.toLowerCase().replace(/[^a-z]/g, '');
              return clean === 'status' || clean === 'misstatus' || clean === 'finalstatus';
            });
            if (key) return key;
            key = sampleKeys.find(k => {
              const clean = k.toLowerCase().trim();
              return clean !== 'state' && clean !== 'customer_state' && (clean.includes('state') || clean.includes('status'));
            });
            return key || 'current_state';
          }

          function findUserIdKey(sampleRow) {
            if (!sampleRow) return null;
            const sampleKeys = Object.keys(sampleRow);
            let key = sampleKeys.find(k => {
              const clean = k.toLowerCase().replace(/[^a-z]/g, '');
              return clean === 'userid' || clean === 'useridentifier';
            });
            if (key) return key;
            return sampleKeys.find(k => k.toLowerCase().replace(/[^a-z]/g, '').includes('user')) || 'user_id';
          }

          let yesContentKey = null;
          let yesUserIdKey = null;
          let yesStateKey = null;

          if (yesRows.length > 0) {
            const sampleKeys = Object.keys(yesRows[0]);
            yesContentKey = sampleKeys.find(k => {
              const clean = k.toLowerCase().replace(/[^a-z]/g, '');
              return clean === 'content' || clean === 'contant' || clean === 'urn' || clean === 'reference';
            }) || sampleKeys.find(k => {
              const val = String(yesRows[0][k] || '');
              return val.includes('FM') || val.includes('fm');
            });

            yesUserIdKey = findUserIdKey(yesRows[0]);
            yesStateKey = findStateKey(yesRows[0]);
          }

          const auUserMap = new Map();
          if (auRows.length > 0) {
            const auUserIdKey = findUserIdKey(auRows[0]);
            const auStateKey = findStateKey(auRows[0]);
            for (let i = 0; i < auRows.length; i++) {
              const r = auRows[i];
              const rawUid = auUserIdKey ? r[auUserIdKey] : getRowValue(r, 'user_id');
              const uid = cleanUserId(rawUid);
              if (uid) {
                const stateVal = (auStateKey ? r[auStateKey] : getRowValue(r, 'current_state')) || getRowValue(r, 'status') || '';
                r._state = String(stateVal).trim();
                auUserMap.set(uid, r);
              }
            }
          }

          const pnbUserMap = new Map();
          if (pnbRows.length > 0) {
            const pnbUserIdKey = findUserIdKey(pnbRows[0]);
            const pnbStateKey = findStateKey(pnbRows[0]);
            for (let i = 0; i < pnbRows.length; i++) {
              const r = pnbRows[i];
              const rawUid = pnbUserIdKey ? r[pnbUserIdKey] : getRowValue(r, 'user_id');
              const uid = cleanUserId(rawUid);
              if (uid) {
                const stateVal = (pnbStateKey ? r[pnbStateKey] : getRowValue(r, 'current_state')) || getRowValue(r, 'status') || '';
                r._state = String(stateVal).trim();
                pnbUserMap.set(uid, r);
              }
            }
          }

          parsedRows = [];
          for (let i = 0; i < yesRows.length; i++) {
            const yesRow = yesRows[i];
            const rawContent = yesContentKey ? yesRow[yesContentKey] : getRowValue(yesRow, 'content');
            let extractedUrn = null;

            if (rawContent) {
              const strContent = String(rawContent);
              if (strContent.includes('FM') || strContent.includes('fm')) {
                extractedUrn = extractUrnFromText(strContent);
              }
            }

            if (!extractedUrn) continue;

            const rawUserId = yesUserIdKey ? yesRow[yesUserIdKey] : getRowValue(yesRow, 'user_id');
            const userId = cleanUserId(rawUserId);

            const candidateAuRow = userId ? auUserMap.get(userId) : null;
            const candidatePnbRow = userId ? pnbUserMap.get(userId) : null;

            const yesState = String((yesStateKey ? yesRow[yesStateKey] : getRowValue(yesRow, 'current_state')) || '').trim();
            const auState = candidateAuRow ? (candidateAuRow._state || String(getRowValue(candidateAuRow, 'current_state') || '').trim()) : '';
            const pnbState = candidatePnbRow ? (candidatePnbRow._state || String(getRowValue(candidatePnbRow, 'current_state') || '').trim()) : '';

            const yesRank = getStatusRank(yesState);
            const auRank = getStatusRank(auState);
            const pnbRank = getStatusRank(pnbState);

            let winningBank = 'YES';
            let winningRow = yesRow;
            let winningState = yesState;
            let bestRank = yesRank;

            if (auRank > bestRank) {
              bestRank = auRank;
              winningBank = 'AU';
              winningRow = candidateAuRow;
              winningState = auState;
            }

            if (pnbRank > bestRank) {
              bestRank = pnbRank;
              winningBank = 'PNB';
              winningRow = candidatePnbRow;
              winningState = pnbState;
            }

            const wr = winningRow || {};
            parsedRows.push({
              content: extractedUrn,
              registration: getRowValue(wr, 'registration') || '',
              pan_submit: getRowValue(wr, 'Pan_Submit') || getRowValue(wr, 'pan_submit') || '',
              form_fetch: getRowValue(wr, 'Form_Fetch') || getRowValue(wr, 'form_fetch') || '',
              form_submit: getRowValue(wr, 'Form_Submit') || getRowValue(wr, 'form_submit') || '',
              ipa: getRowValue(wr, 'IPA') || getRowValue(wr, 'ipa') || '',
              card_created: getRowValue(wr, 'Card_Created') || getRowValue(wr, 'card_created') || '',
              vkyc: getRowValue(wr, 'VKYC') || getRowValue(wr, 'vkyc') || '',
              current_state: winningState,
              reject_reason: getRowValue(wr, 'reject_reason') || '',
              application_id_bank_2: getRowValue(wr, 'application_id_bank_2') || '',
              first_txn: getRowValue(wr, 'First_txn') || getRowValue(wr, 'first_txn') || '',
              APPLICATION_REFERENCE_NUMBER: extractedUrn,
              current_status: winningState,
              final_decision: winningState,
              kiwi_winning_bank: winningBank,
              kiwi_user_id: userId,
              kiwi_yes_status: yesState,
              kiwi_au_status: auState,
              kiwi_pnb_status: pnbState,
              _extractedUrn: extractedUrn,
              yes_rank: yesRank,
              au_rank: auRank,
              pnb_rank: pnbRank,
              status_rank: bestRank
            });
          }
        }
      } else {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        parsedRows = [];

        workbook.SheetNames.forEach(sName => {
          const sheet = workbook.Sheets[sName];
          if (!sheet || !sheet['!ref']) return;

          const rawMatrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          if (!rawMatrix || rawMatrix.length === 0) return;

          let headerRowIdx = 0;
          for (let r = 0; r < Math.min(rawMatrix.length, 10); r++) {
            const row = rawMatrix[r];
            if (Array.isArray(row)) {
              const nonEmpCount = row.filter(cell => String(cell || '').trim().length > 0).length;
              if (nonEmpCount >= 2) {
                headerRowIdx = r;
                break;
              }
            }
          }

          const headers = (rawMatrix[headerRowIdx] || []).map(h => String(h || '').trim());
          for (let r = headerRowIdx + 1; r < rawMatrix.length; r++) {
            const rowArr = rawMatrix[r];
            if (!Array.isArray(rowArr) || rowArr.length === 0) continue;
            
            const hasData = rowArr.some(c => String(c || '').trim().length > 0);
            if (!hasData) continue;

            const rowObj = {};
            headers.forEach((h, colIdx) => {
              if (h) {
                rowObj[h] = rowArr[colIdx] !== undefined ? String(rowArr[colIdx]).trim() : '';
              }
            });

            rowObj._rawRowValues = rowArr.map(c => String(c || '').trim());
            parsedRows.push(rowObj);
          }
        });
      }
    } else if (ext === 'pdf') {
      const pdfData = await pdfParse(req.file.buffer);
      const lines = pdfData.text.split('\n');
      
      lines.forEach(line => {
        const cleanLine = line.trim();
        if (!cleanLine) return;
        
        const urnRegex = /FM[0-9A-Z]{9,15}/gi;
        const matches = cleanLine.match(urnRegex);
        if (matches && matches.length > 0) {
          matches.forEach(matchedUrn => {
            let status = 'Pending';
            const lowerLine = cleanLine.toLowerCase();
            if (lowerLine.includes('approve') || lowerLine.includes('disbursed') || lowerLine.includes('success') || lowerLine.includes('active')) {
              status = 'Approved';
            } else if (lowerLine.includes('reject') || lowerLine.includes('decline') || lowerLine.includes('cancel')) {
              status = 'Rejected';
            }
            
            parsedRows.push({
              APPLICATION_REFERENCE_NUMBER: matchedUrn,
              FINAL_DECISION: status,
              IPA_STATUS: status,
              CREATION_DATE_TIME: new Date().toISOString()
            });
          });
        }
      });
    } else {
      return res.status(400).json({ error: 'Unsupported file format. Please upload CSV, XLS, XLSX, or PDF.' });
    }
  } catch (err) {
    console.error('[Upload MIS] Parsing error:', err);
    return res.status(500).json({ error: `Failed to parse file: ${err.message}` });
  }

  if (parsedRows.length === 0) {
    return res.status(200).json({
      success: true,
      totalMatched: 0,
      totalUnmatched: 0,
      matchedDetails: [],
      unmatchedDetails: []
    });
  }

  // Get all leads from database for in-memory matching
  const leadsRes = await db.pool.query('SELECT id, urn, full_name, card_name, created_at FROM leads');
  const dbLeads = leadsRes.rows.map(lead => {
    // Extract integer sequence number
    let seq = null;
    if (lead.urn) {
      const clean = lead.urn.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const dbMatch = clean.match(/^FM\d{4}[A-L]\d{2}(\d+)$/);
      if (dbMatch) {
        seq = parseInt(dbMatch[1], 10);
      } else {
        const misMatch = clean.match(/^FM\d{4}\d{2}\d{2}(\d+)$/);
        if (misMatch) {
          seq = parseInt(misMatch[1], 10);
        } else {
          const trailingDigits = clean.match(/\d+$/);
          if (trailingDigits) {
            seq = parseInt(trailingDigits[0], 10);
          }
        }
      }
    }
    return {
      ...lead,
      canonical: lead.urn ? canonicalizeURN(lead.urn) : '',
      seq,
      createdTime: new Date(lead.created_at).getTime(),
      cleanName: cleanNameHelper(lead.full_name)
    };
  });

  // Helpers
  function cleanNameHelper(name) {
    if (!name) return '';
    return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function isNameMatchHelper(cleanDbName, rawExcelName) {
    if (!cleanDbName || !rawExcelName) return false;
    const cleanExcel = cleanNameHelper(rawExcelName);
    if (!cleanExcel) return false;
    return cleanDbName === cleanExcel || cleanDbName.includes(cleanExcel) || cleanExcel.includes(cleanDbName);
  }

  // Helper to parse dates in various formats robustly
  const parseDateHelper = (val) => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'number') {
      if (val > 30000 && val < 60000) {
        // Excel serial date
        return new Date(Math.round((val - 25569) * 86400 * 1000));
      }
      return new Date(val);
    }
    const str = String(val).trim();
    if (!str) return null;
    
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    
    const parts = str.split(/[-/:\s]+/);
    if (parts.length >= 3) {
      let day = parseInt(parts[0], 10);
      let month = parts[1];
      let year = parseInt(parts[2], 10);
      
      if (year < 100) year += 2000;
      if (day > 1000) {
        year = day;
        day = parseInt(parts[2], 10);
      }
      
      let monthNum = parseInt(month, 10);
      if (isNaN(monthNum)) {
        const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
        monthNum = months.indexOf(month.toLowerCase().substring(0, 3)) + 1;
      }
      
      if (year && monthNum && day) {
        return new Date(year, monthNum - 1, day);
      }
    }
    return null;
  };

  const dbUrnMap = new Map();
  const dbSuffixMap = new Map(); // Suffix sequence of length >= 7 starting with letter
  const dbNumericSuffixMap = new Map(); // Numeric suffix of length >= 6 (old pattern)

  dbLeads.forEach(lead => {
    if (lead.urn) {
      const canonical = String(lead.urn).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (canonical) {
        dbUrnMap.set(canonical, lead);

        // 1. Suffix sequence match for letter-prefixed sequence (e.g. G0200100)
        const letterMatch = canonical.match(/[A-Z]\d+$/);
        if (letterMatch) {
          const suffix = letterMatch[0];
          if (suffix.length >= 7) {
            if (dbSuffixMap.has(suffix)) {
              dbSuffixMap.set(suffix, 'AMBIGUOUS');
            } else {
              dbSuffixMap.set(suffix, lead);
            }
          }
        }

        // 2. Suffix sequence match for purely numeric sequence (e.g. 0630006 for old pattern)
        const numericMatch = canonical.match(/\d+$/);
        if (numericMatch) {
          const numSuffix = numericMatch[0];
          if (numSuffix.length >= 6) {
            if (dbNumericSuffixMap.has(numSuffix)) {
              dbNumericSuffixMap.set(numSuffix, 'AMBIGUOUS');
            } else {
              dbNumericSuffixMap.set(numSuffix, lead);
            }
          }
        }
      }
    }
  });

  const settings = await db.getSettings();
  let bankMappings = {};
  if (settings.bank_mis_mappings) {
    try {
      bankMappings = typeof settings.bank_mis_mappings === 'string' ? JSON.parse(settings.bank_mis_mappings) : settings.bank_mis_mappings;
    } catch(e) {
      bankMappings = {};
    }
  }

  const isKiwi = selectedBank.toLowerCase().includes('kiwi');
  const isYesBank = selectedBank.toLowerCase().includes('yes');
  const isHdfc = selectedBank.toLowerCase().includes('hdfc');
  const customConfig = bankMappings[selectedBank];

  // If bank is not HDFC, not YES Bank, not KIWI, and has no custom mapping configured in settings
  if (!isHdfc && !isYesBank && !isKiwi && (!customConfig || !customConfig.urn_column)) {
    return res.status(400).json({
      error: `MIS parsing format for "${selectedBank}" is not configured yet. Please configure the MIS column mapping for "${selectedBank}" in System Settings & API or choose a supported bank (HDFC Bank, YES Bank, KIWI Bank).`
    });
  }

  let totalMatched = 0;
  let totalUnmatched = 0;
  const matchedDetails = [];
  const unmatchedDetails = [];
  const updates = [];
  
  const matchedLeadsMap = new Map();
  const unmatchedUrnsSet = new Set();

  for (const row of parsedRows) {
    let excelLc2 = null;

    if (isKiwi && row._extractedUrn) {
      excelLc2 = row._extractedUrn;
    } else if (customConfig && customConfig.urn_column) {
      const rawVal = getRowValue(row, customConfig.urn_column);
      if (customConfig.extraction_mode === 'extract_urn') {
        excelLc2 = extractUrnFromText(rawVal);
      } else if (customConfig.extraction_mode === 'regex' && customConfig.regex_pattern) {
        try {
          const re = new RegExp(customConfig.regex_pattern, 'i');
          const m = String(rawVal || '').match(re);
          excelLc2 = m ? m[0] : rawVal;
        } catch(e) {
          excelLc2 = rawVal;
        }
      } else {
        excelLc2 = rawVal;
      }
    } else if (isYesBank || isKiwi) {
      // YES / KIWI Bank: search contant/Contant field or scan text for pattern like ENT_FM2026G2000119_971692
      const contantVal = getRowValue(row, 'contant') || 
                         getRowValue(row, 'Contant') || 
                         getRowValue(row, 'contant_field') || 
                         getRowValue(row, 'Remark') || 
                         getRowValue(row, 'Comments') || 
                         getRowValue(row, 'Sub Source') || 
                         getRowValue(row, 'Reference') || 
                         getRowValue(row, 'urn') || 
                         getRowValue(row, 'URN');
      
      excelLc2 = extractUrnFromText(contantVal);

      // Fallback: If not found in primary fields, scan all cell values in row for FM... pattern
      if (!excelLc2) {
        for (const cellVal of Object.values(row)) {
          const found = extractUrnFromText(cellVal);
          if (found) {
            excelLc2 = found;
            break;
          }
        }
      }
    } else {
      // Default (HDFC Bank)
      excelLc2 = getRowValue(row, 'LC2_CODE') || getRowValue(row, 'urn_last') || getRowValue(row, 'urn') || getRowValue(row, 'URN') || getRowValue(row, 'APPLICATION_REFERENCE_NUMBER');
      if (!excelLc2) {
        // Fallback extract check
        for (const cellVal of Object.values(row)) {
          const found = extractUrnFromText(cellVal);
          if (found) {
            excelLc2 = found;
            break;
          }
        }
      }
    }
    
    if (!excelLc2) {
      totalUnmatched++;
      continue;
    }

    const misVal = String(excelLc2).trim();
    const misDateStr = getRowValue(row, 'CREATION_DATE_TIME') || getRowValue(row, 'Application Submit Date/Time') || getRowValue(row, 'Date') || getRowValue(row, 'DATE');
    const misDate = parseDateHelper(misDateStr);

    let matchedLead = null;
    const cleanExcelLc2 = misVal.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (cleanExcelLc2) {
      // 1. Try exact canonical match
      if (dbUrnMap.has(cleanExcelLc2)) {
        matchedLead = dbUrnMap.get(cleanExcelLc2);
      }
      // 2. Try suffix match for new sequence pattern (e.g. G0200100)
      else if (cleanExcelLc2.length >= 7 && /^[A-Z]\d+$/.test(cleanExcelLc2)) {
        const candidate = dbSuffixMap.get(cleanExcelLc2);
        if (candidate && candidate !== 'AMBIGUOUS') {
          matchedLead = candidate;
        }
      }
      // 3. Try suffix match for old sequence pattern (e.g. 0630006)
      else if (cleanExcelLc2.length >= 6 && /^\d+$/.test(cleanExcelLc2)) {
        const candidate = dbNumericSuffixMap.get(cleanExcelLc2);
        if (candidate && candidate !== 'AMBIGUOUS') {
          matchedLead = candidate;
        }
      }
      // 4. Try extract suffix from a partial URN format (e.g. FM20260630006)
      else if (cleanExcelLc2.startsWith('FM') && cleanExcelLc2.length >= 10) {
        const letterMatch = cleanExcelLc2.match(/[A-Z]\d+$/);
        if (letterMatch && letterMatch[0].length >= 7) {
          const candidate = dbSuffixMap.get(letterMatch[0]);
          if (candidate && candidate !== 'AMBIGUOUS') {
            matchedLead = candidate;
          }
        }
        if (!matchedLead) {
          const numericMatch = cleanExcelLc2.match(/\d+$/);
          if (numericMatch && numericMatch[0].length >= 6) {
            const candidate = dbNumericSuffixMap.get(numericMatch[0]);
            if (candidate && candidate !== 'AMBIGUOUS') {
              matchedLead = candidate;
            }
          }
        }
      }
    }

    const misData = {};
    for (const [k, v] of Object.entries(row)) {
      misData[k] = String(v === null || v === undefined ? '' : v).trim();
    }

    misData.mis_bank_name = selectedBank;
    misData.bank_reference_number = String(getRowValue(row, 'APPLICATION_REFERENCE_NUMBER') || getRowValue(row, 'Bank Reference Number') || getRowValue(row, 'contant') || getRowValue(row, 'Contant') || '').trim();
    misData.application_submit_date_time = String(getRowValue(row, 'CREATION_DATE_TIME') || getRowValue(row, 'Application Submit Date/Time') || getRowValue(row, 'Date')).trim();
    misData.customer_type = String(getRowValue(row, 'CUSTOMER_TYPE') || getRowValue(row, 'Customer Type')).trim();
    misData.state = String(getRowValue(row, 'STATE') || getRowValue(row, 'state') || getRowValue(row, 'State')).trim();
    misData.ipa_status = String(getRowValue(row, 'IPA_STATUS') || getRowValue(row, 'IPA Status') || getRowValue(row, 'Status') || getRowValue(row, 'STATUS')).trim();
    misData.dap_final_flag = String(getRowValue(row, 'DAP_FINAL_FLAG') || getRowValue(row, 'DAP Final Flag')).trim();
    misData.dropoff_reason = String(getRowValue(row, 'DROPOFF_REASON') || getRowValue(row, 'DROPOFFREASON')).trim();
    misData.vkyc_status = String(getRowValue(row, 'VKYC_STATUS') || getRowValue(row, 'VKYC STATUS')).trim();
    misData.kyc_type = String(getRowValue(row, 'VKYC_CONSENT_DATE') || getRowValue(row, 'KYC TYPE') || getRowValue(row, 'KYC Success/NR')).trim();
    misData.vkyc_expiry_date = String(getRowValue(row, 'VKYC_EXPIRY_DATE') || getRowValue(row, 'VKYC EXPIRY DATE')).trim();
    misData.promo_code = String(getRowValue(row, 'PROMO_CODE') || getRowValue(row, 'PROMO CODE')).trim();
    misData.final_decision = String(getRowValue(row, 'FINAL_DECISION') || getRowValue(row, 'FINAL DECISION') || getRowValue(row, 'Status') || getRowValue(row, 'STATUS') || getRowValue(row, 'Decision')).trim();
    misData.final_decision_date = String(getRowValue(row, 'FINAL_DECISION_DATE') || getRowValue(row, 'FINAL DECISION DATE')).trim();
    misData.current_stage = String(getRowValue(row, 'CURRENT_STAGE') || getRowValue(row, 'CURRENT STAGE')).trim();
    misData.curable_flag = String(getRowValue(row, 'CURABLE_FLAG') || getRowValue(row, 'CURABLE FLAG')).trim();
    misData.company_name = String(getRowValue(row, 'COMPANY_NAME') || getRowValue(row, 'COMPANY NAME')).trim();
    misData.bkyc_status = String(getRowValue(row, 'BKYC Status') || getRowValue(row, 'BKYC Status')).trim();
    misData.kyc_status = String(getRowValue(row, 'KYC Status') || getRowValue(row, 'KYC Status')).trim();
    misData.decision_month = String(getRowValue(row, 'Decision Month') || getRowValue(row, 'Decision Month')).trim();
    misData.decline_description = String(getRowValue(row, 'Decline Descreption') || getRowValue(row, 'Decline Descreption') || getRowValue(row, 'Remark') || getRowValue(row, 'REMARK') || getRowValue(row, 'Comments')).trim();
    misData.decline_type = String(getRowValue(row, 'Decline Type') || getRowValue(row, 'Decline Type')).trim();
    misData.card_name = String(getRowValue(row, 'Product Des') || getRowValue(row, 'Product Description') || getRowValue(row, 'Card Name')).trim();
    misData.card_type = String(getRowValue(row, 'Card Type') || getRowValue(row, 'Card Type')).trim();
    misData.card_activation_status = String(getRowValue(row, 'Card Activation Staus') || getRowValue(row, 'Card Activation Staus')).trim();
    misData.source_type = String(getRowValue(row, 'Source Type') || getRowValue(row, 'Source Type')).trim();
    misData.kyc_completion_date = String(getRowValue(row, 'KYC Completion date') || getRowValue(row, 'KYC Completion date')).trim();

    if (isKiwi) {
      const yesRankVal = (row.yes_rank !== undefined && row.yes_rank !== null) ? row.yes_rank : 0;
      const auRankVal = (row.au_rank !== undefined && row.au_rank !== null) ? row.au_rank : 0;
      const pnbRankVal = (row.pnb_rank !== undefined && row.pnb_rank !== null) ? row.pnb_rank : 0;
      const statusRankVal = (row.status_rank !== undefined && row.status_rank !== null) ? row.status_rank : 0;

      misData.mis_bank_name = 'KIWI';
      misData.kiwi_bank = row.kiwi_winning_bank || 'YES';
      misData.winning_bank = row.kiwi_winning_bank || 'YES';
      misData.winning_state = row.current_state || '';
      misData.winning_rank = statusRankVal;
      misData.yes_state = row.kiwi_yes_status || '';
      misData.yes_rank = yesRankVal;
      misData.au_state = row.kiwi_au_status || '';
      misData.au_rank = auRankVal;
      misData.pnb_state = row.kiwi_pnb_status || '';
      misData.pnb_rank = pnbRankVal;
      misData.status_rank = statusRankVal;
      misData.user_id = row.kiwi_user_id || '';
      misData.current_state = row.current_state || '';
      misData.current_status = row.current_status || row.current_state || '';
      misData.final_decision = row.current_state || '';
      misData.bank_reference_number = String(row._extractedUrn || row.APPLICATION_REFERENCE_NUMBER || '').trim();
      misData.application_submit_date_time = String(row.form_submit || row.registration || getRowValue(row, 'CREATION_DATE_TIME') || '').trim();
      misData.ipa_status = String(row.ipa || getRowValue(row, 'IPA_STATUS') || getRowValue(row, 'IPA Status') || row.current_state || '').trim();

      misData.kiwi_metadata = {
        yes_state: row.kiwi_yes_status || '',
        yes_rank: yesRankVal,
        au_state: row.kiwi_au_status || '',
        au_rank: auRankVal,
        pnb_state: row.kiwi_pnb_status || '',
        pnb_rank: pnbRankVal,
        winning_bank: row.kiwi_winning_bank || 'YES',
        winning_rank: statusRankVal
      };

      misData.registration = String(row.registration || getRowValue(row, 'registration') || '').trim();
      misData.pan_submit = String(row.pan_submit || getRowValue(row, 'Pan_Submit') || '').trim();
      misData.form_fetch = String(row.form_fetch || getRowValue(row, 'Form_Fetch') || '').trim();
      misData.form_submit = String(row.form_submit || getRowValue(row, 'Form_Submit') || '').trim();
      misData.ipa = String(row.ipa || getRowValue(row, 'IPA') || '').trim();
      misData.card_created = String(row.card_created || getRowValue(row, 'Card_Created') || '').trim();
      misData.vkyc = String(row.vkyc || getRowValue(row, 'VKYC') || '').trim();
      misData.reject_reason = String(row.reject_reason || getRowValue(row, 'reject_reason') || '').trim();
      misData.application_id_bank_2 = String(getRowValue(row, 'application_id_bank_2') || '').trim();
      misData.first_txn = String(getRowValue(row, 'First_txn') || getRowValue(row, 'first_txn') || '').trim();
    }

    // Custom mappings override
    if (customConfig && customConfig.field_mappings) {
      for (const [targetKey, sourceCol] of Object.entries(customConfig.field_mappings)) {
        if (sourceCol) {
          const customVal = getRowValue(row, sourceCol);
          if (customVal !== undefined && customVal !== null) {
            misData[targetKey] = String(customVal).trim();
          }
        }
      }
    }

    // Custom extracted fields array (dynamic fields configured by admin)
    if (customConfig && Array.isArray(customConfig.custom_fields)) {
      for (const cf of customConfig.custom_fields) {
        if (cf && cf.col_name) {
          const customVal = getRowValue(row, cf.col_name);
          if (customVal !== undefined && customVal !== null) {
            const targetProp = cf.label && cf.label.trim() ? cf.label.trim() : cf.col_name.trim();
            misData[targetProp] = String(customVal).trim();
          }
        }
      }
    }

    const finalDecision = misData.final_decision || misData.ipa_status;
    const standardStatus = standardizeStatus(finalDecision, row);

    if (matchedLead) {
      totalMatched++;
      
      const currentEntry = matchedLeadsMap.get(matchedLead.id);
      let shouldOverwrite = true;
      if (currentEntry && currentEntry.date && misDate) {
        shouldOverwrite = misDate.getTime() > currentEntry.date.getTime();
      }
      
      if (shouldOverwrite) {
        matchedLeadsMap.set(matchedLead.id, {
          urn: matchedLead.urn,
          name: matchedLead.full_name,
          cardName: matchedLead.card_name,
          status: standardStatus,
          data: misData,
          date: misDate
        });
      }

      // Add to matchedDetails for frontend listing
      matchedDetails.push({
        urn: matchedLead.urn,
        name: matchedLead.full_name,
        cardName: matchedLead.card_name,
        status: standardStatus,
        winning_bank: misData.winning_bank || 'YES',
        winning_state: misData.winning_state || misData.current_state || '',
        winning_rank: misData.winning_rank || misData.status_rank || 1,
        yes_state: misData.yes_state || 'NOT_STARTED',
        yes_rank: misData.yes_rank || 0,
        au_state: misData.au_state || 'NOT_STARTED',
        au_rank: misData.au_rank || 0,
        pnb_state: misData.pnb_state || 'NOT_STARTED',
        pnb_rank: misData.pnb_rank || 0
      });
    } else {
      totalUnmatched++;
      if (!unmatchedUrnsSet.has(excelLc2)) {
        unmatchedUrnsSet.add(excelLc2);
        unmatchedDetails.push({
          urn: excelLc2,
          status: standardStatus
        });
      }
    }
  }

  // Load existing records from database for matched leads to merge new data with old history
  const matchedIds = Array.from(matchedLeadsMap.keys());
  if (matchedIds.length > 0) {
    const currentLeadsRes = await db.pool.query(
      'SELECT id, mis_status, mis_data FROM leads WHERE id = ANY($1::varchar[])',
      [matchedIds]
    );
    const dbLeadMap = new Map();
    currentLeadsRes.rows.forEach(row => {
      dbLeadMap.set(row.id, row);
    });

    for (const [leadId, matchedObj] of matchedLeadsMap.entries()) {
      const dbLead = dbLeadMap.get(leadId);
      let currentMisData = {};
      if (dbLead && dbLead.mis_data) {
        try {
          const parsed = typeof dbLead.mis_data === 'string' ? JSON.parse(dbLead.mis_data) : dbLead.mis_data;
          // If it was legacy history structure, extract the latest entry
          if (parsed && Array.isArray(parsed.history) && parsed.history.length > 0) {
            const latest = parsed.history[parsed.history.length - 1];
            currentMisData = latest.data || {};
          } else {
            currentMisData = parsed || {};
          }
        } catch (e) {
          currentMisData = {};
        }
      }

      // Merge spreadsheet columns into existing matched records, filtering out empty spreadsheet fields
      const cleanData = {};
      for (const [k, v] of Object.entries(matchedObj.data)) {
        if (v !== '' && v !== null && v !== undefined) {
          cleanData[k] = v;
        }
      }

      const mergedData = {
        ...currentMisData,
        ...cleanData
      };

      // Ensure history field is removed/deleted so it is purely flat data
      delete mergedData.history;

      updates.push({
        id: leadId,
        status: matchedObj.status,
        data: mergedData
      });
    }
  }

  // Execute bulk updates in high-performance batch query
  if (updates.length > 0) {
    const uploadingAgentId = req.user.role === 'agent' ? req.user.id : null;
    const uploadingAgentName = req.user.role === 'agent' ? req.user.name : null;
    const updatedLeads = await db.bulkUpdateLeadMISStatus(updates, uploadingAgentId, uploadingAgentName);
    invalidateMISCache();
    await db.alignLeadsByRedirectBank().catch(err => console.error('[Align Warning]:', err.message));
    broadcast({ type: 'MIS_UPDATED' });
    broadcast({ type: 'LEADS_UPDATED' });

    // Trigger Meta CAPI Purchase Events & Audience Sync for updated leads asynchronously
    if (updatedLeads && updatedLeads.length > 0) {
      setTimeout(async () => {
        for (const lead of updatedLeads) {
          if (isFinalApprovedStatus(lead.mis_status)) {
            await sendMetaCapiEvent(lead, 'Purchase', 2000, selectedBank);
          }
        }
        await metaAudienceService.enqueueLeadSyncForUpdatedLeads(updatedLeads, broadcast);
      }, 100);
    }
  }

  res.json({
    success: true,
    totalMatched,
    totalUnmatched,
    totalProcessed: totalMatched + totalUnmatched,
    total: totalMatched + totalUnmatched,
    processed: totalMatched + totalUnmatched,
    updated: totalMatched,
    mapped: totalMatched,
    unmatched: totalUnmatched,
    failed: totalUnmatched,
    matchedDetails,
    unmatchedDetails,
    unmatchedList: unmatchedDetails
  });
});

// Align All Mapped Leads by Redirect Card Bank (Admin Only)
app.post('/api/leads/align-banks', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const alignedCount = await db.alignLeadsByRedirectBank();
    invalidateMISCache();
    broadcast({ type: 'LEADS_UPDATED' });
    broadcast({ type: 'MIS_UPDATED' });
    res.json({ success: true, message: `Successfully aligned ${alignedCount} leads to their redirect card banks!`, alignedCount });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to align leads by redirect bank.' });
  }
});

// ── MIS Stats Cache (30s TTL) ──
let misStatsCache = null;
let misStatsCacheTime = 0;
const MIS_CACHE_TTL_MS = 300000; // 5 minutes (invalidated instantly on any write/upload)

function invalidateMISCache() { misStatsCache = null; misStatsCacheTime = 0; }

// GET MIS stats for Dashboard (cached for admin, scoped for agents)
app.get('/api/leads/mis-stats', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'agent') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const now = Date.now();
    if (req.user.role === 'admin' && misStatsCache && (now - misStatsCacheTime) < MIS_CACHE_TTL_MS) {
      return res.json(misStatsCache);
    }

    let stats = await db.getMISStats();

    if (req.user.role === 'agent') {
      const agent = await db.getAgentById(req.user.id);
      if (agent && agent.assigned_bank) {
        const cleanBank = String(agent.assigned_bank).toLowerCase().replace(/\s+bank$/i, '').trim();
        const filteredMapped = (stats.mappedLeadsList || []).filter(lead => {
          const misBank = String(lead.mis_data?.mis_bank_name || '').toLowerCase();
          const cardBank = String(lead.card_bank || lead.bank || '').toLowerCase();
          const cardName = String(lead.card_name || '').toLowerCase();
          const kiwiBank = String(lead.mis_data?.kiwi_bank || lead.mis_data?.kiwi_winning_bank || lead.mis_data?.winning_bank || '').toLowerCase();

          let isMatch = false;
          if (cleanBank === 'kiwi') {
            isMatch = misBank.includes('kiwi') || cardName.includes('kiwi') || cardBank.includes('kiwi') || Boolean(kiwiBank);
          } else {
            isMatch = misBank.includes(cleanBank) || cardBank.includes(cleanBank) || cardName.includes(cleanBank);
          }
          return isMatch || lead.agent_id === agent.id;
        });
        stats = {
          totalLeads: filteredMapped.length,
          mappedLeadsCount: filteredMapped.length,
          mappedLeadsList: filteredMapped
        };
      }
    } else {
      misStatsCache = stats;
      misStatsCacheTime = now;
    }

    return res.json(stats);
  } catch (err) {
    console.error('[GET /api/leads/mis-stats] Error:', err);
    return res.status(500).json({ error: 'Failed to fetch MIS statistics' });
  }
});

async function canUserCreateLeads(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'agent' && user.id) {
    const agent = await db.getAgentById(user.id);
    return agent && agent.status === 'active' && agent.can_create_leads !== false;
  }
  return false;
}

// Universal Date Parser (handles JS Date, Excel Serial, YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY)
function parseAnyDate(val) {
  if (!val) return null;

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  // Handle numeric Excel serial date (e.g. 38452 or 38452.5)
  if (typeof val === 'number' || (typeof val === 'string' && /^\d+(\.\d+)?$/.test(val.trim()))) {
    const serial = parseFloat(val);
    if (serial > 1000 && serial < 100000) {
      // Excel epoch is Dec 30 1899
      const utc_days = Math.floor(serial - 25569);
      const utc_value = utc_days * 86400;
      return new Date(utc_value * 1000);
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // Handle YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // Handle DD-MM-YYYY or DD/MM/YYYY
  if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/.test(str)) {
    const parts = str.split(/[-\/]/).map(Number);
    const day = parts[0];
    const month = parts[1];
    const year = parts[2];
    return new Date(year, month - 1, day);
  }

  // Fallback standard Date parse
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Calculate applicant age accurately
function calculateApplicantAge(dobVal) {
  const birthDate = parseAnyDate(dobVal);
  if (!birthDate || isNaN(birthDate.getTime())) return -1;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Download Leads Upload Template (.xlsx) with ExcelJS, Dynamic Card Dropdown, Landing Page Validations & 2nd Sheet Guidelines
app.get('/api/leads/download-template', async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    
    // Sheet 1: Leads Template
    const worksheet = workbook.addWorksheet('Leads Template');

    // Fetch active agents and cards from DB for dropdowns
    const agents = await db.getAgents();
    const cards = await db.getCards();

    // Map strictly by Agent Code / ID (e.g., ag_01, FIDR30, lakshay) - EXCLUDE phone numbers
    const agentIdentifiers = agents
      .map(a => {
        const uname = (a.username || '').trim();
        const aid = (a.id || '').trim();
        if (uname && !/^[6-9]\d{9}$/.test(uname)) return uname;
        if (aid && !/^[6-9]\d{9}$/.test(aid)) return aid;
        return uname || aid;
      })
      .filter(id => id && !/^[6-9]\d{9}$/.test(id));

    const agentDropdown = agentIdentifiers.length > 0 ? agentIdentifiers.join(',') : 'ag_01,ag_02,FIDR30,lakshay';

    const cardNames = cards.map(c => c.name).filter(Boolean);
    const cardDropdown = cardNames.length > 0 ? cardNames.join(',') : 'HDFC Pixel Credit Card,SBI SimplyCLICK,AU Altura,YES Bank CC';

    worksheet.columns = [
      { header: 'Application ID', key: 'application_id', width: 18 },
      { header: 'Full Name', key: 'full_name', width: 22 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'PAN Number', key: 'pan_no', width: 16 },
      { header: 'Date of Birth', key: 'dob', width: 15 },
      { header: 'Mother Name', key: 'mother_name', width: 20 },
      { header: 'Current Address', key: 'current_address', width: 45 },
      { header: 'Pincode', key: 'pincode', width: 12 },
      { header: 'Employment', key: 'employment', width: 16 },
      { header: 'Designation', key: 'designation', width: 20 },
      { header: 'Company Name', key: 'company_name', width: 22 },
      { header: 'Already Has Credit Card', key: 'has_credit_card', width: 24 },
      { header: 'Net Monthly Income', key: 'monthly_income', width: 20 },
      { header: 'Income Range', key: 'income_range', width: 15 },
      { header: 'Agent ID', key: 'agent_id', width: 18 },
      { header: 'Card Name', key: 'card_name', width: 28 },
      { header: 'Consent', key: 'consent', width: 12 }
    ];

    // Single fixed sample data row
    worksheet.addRow({
      application_id: 'APP100293',
      full_name: 'Harsh Deep',
      phone: '8708569574',
      email: 'harshdeep301@icloud.com',
      pan_no: 'BOGPH7116K',
      dob: '2004-07-14',
      mother_name: 'Harsh Deep',
      current_address: 'Shiv c, Colony ward no 17, Safidon City, Jind, Haryana - 126112',
      pincode: '126112',
      employment: 'Salaried',
      designation: 'Student',
      company_name: 'N/A',
      has_credit_card: 'No',
      monthly_income: '35000',
      income_range: '3-6 LPA',
      agent_id: agentIdentifiers[0] || 'ag_01',
      card_name: cardNames[0] || 'Public Redirection',
      consent: 'Yes'
    });

    // Style Header Row (Row 1)
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Dark Slate Navy
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 26;

    // Style Sample Data Row (Row 2)
    const sampleRow = worksheet.getRow(2);
    sampleRow.font = { size: 10, color: { argb: 'FF0F172A' } };
    sampleRow.alignment = { vertical: 'middle', horizontal: 'left' };

    // Apply Data Validations (Dropdowns) for Rows 2 to 500
    for (let r = 2; r <= 500; r++) {
      // Employment Dropdown (Col J: 10)
      worksheet.getCell(`J${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Salaried,Self-Employed,Business"'],
        showErrorMessage: true,
        errorTitle: 'Invalid Employment Type',
        error: 'Please select Salaried, Self-Employed, or Business.'
      };

      // Already Has Credit Card Dropdown (Col M: 13)
      worksheet.getCell(`M${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Yes,No"'],
        showErrorMessage: true,
        errorTitle: 'Invalid Selection',
        error: 'Please select Yes or No.'
      };

      // Income Range Dropdown (Col O: 15)
      worksheet.getCell(`O${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"< 3 LPA,3-6 LPA,6-10 LPA,10+ LPA"'],
        showErrorMessage: true,
        errorTitle: 'Invalid Income Range',
        error: 'Please select a valid income bracket.'
      };

      // Agent ID Dropdown (Col P: 16)
      worksheet.getCell(`P${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${agentDropdown}"`],
        showErrorMessage: true,
        errorTitle: 'Invalid Agent ID',
        error: 'Agent ID must be a valid registered Agent Code / ID in database.'
      };

      // Card Name Dropdown (Col Q: 17)
      worksheet.getCell(`Q${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${cardDropdown}"`],
        showErrorMessage: true,
        errorTitle: 'Invalid Card Name',
        error: 'Please select a valid credit card offer from database.'
      };

      // Consent Dropdown (Col R: 18)
      worksheet.getCell(`R${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Yes,No"'],
        showErrorMessage: true,
        errorTitle: 'Invalid Selection',
        error: 'Please select Yes or No.'
      };
    }

    // ==========================================
    // Sheet 2: Upload Guidelines & Rules
    // ==========================================
    const guideSheet = workbook.addWorksheet('Upload Guidelines & Rules');

    // Title Row
    guideSheet.mergeCells('A1:E1');
    const titleCell = guideSheet.getCell('A1');
    titleCell.value = '📋 FINMANTRA AGENT BULK LEAD UPLOAD — COMPLIANCE & VALIDATION GUIDE';
    titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    guideSheet.getRow(1).height = 34;

    // Subtitle
    guideSheet.mergeCells('A2:E2');
    const subCell = guideSheet.getCell('A2');
    subCell.value = 'Rules mirror all FinMantra landing page validations. Non-compliant rows will be rejected automatically.';
    subCell.font = { italic: true, size: 9.5, color: { argb: 'FF475569' } };
    guideSheet.getRow(2).height = 20;

    // Section 1 Header: Landing Page Field Validations
    guideSheet.mergeCells('A4:E4');
    const sec1 = guideSheet.getCell('A4');
    sec1.value = '1. LANDING PAGE FORM FIELD VALIDATION STANDARDS';
    sec1.font = { bold: true, size: 10.5, color: { argb: 'FFFFFFFF' } };
    sec1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    guideSheet.getRow(4).height = 24;

    const regHeaders = ['Field Name', 'Required / Optional', 'Validation Rule & Casing', 'Valid Example', 'Action on Violation'];
    guideSheet.getRow(5).values = regHeaders;
    const r5 = guideSheet.getRow(5);
    r5.font = { bold: true, color: { argb: 'FF0F172A' } };
    r5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    guideSheet.getRow(5).height = 22;

    const rules = [
      ['Full Name', 'Mandatory', 'Letters & spaces only. Must contain at least 2 words (First + Last Name as per PAN).', 'Harsh Deep', 'Row REJECTED'],
      ['Phone', 'Mandatory', 'Exactly 10 numeric digits starting with 6, 7, 8, or 9. No country code (+91 / 0).', '8708569574', 'Row REJECTED'],
      ['PAN Number', 'Optional', '10 uppercase alphanumeric characters (5 Letters + 4 Digits + 1 Letter).', 'BOGPH7116K', 'Row REJECTED if malformed'],
      ['Date of Birth', 'Optional', 'Format YYYY-MM-DD or DD-MM-YYYY. Applicant age MUST be between 21 and 70 years old.', '2004-07-14', 'Row REJECTED if age <21 or >70'],
      ['Pincode', 'Optional', 'Exactly 6 numeric digits.', '126112', 'Row REJECTED if invalid length'],
      ['Net Monthly Income', 'Optional', 'Numeric value in ₹. Recommended range ₹25,000 to ₹10,00,000/month.', '35000', 'Flagged if < 25k'],
      ['Agent ID', 'Mandatory', 'Must match an active registered Agent Code / ID in DB (NOT Phone Number).', 'ag_01', 'Row REJECTED if invalid or Phone used'],
      ['Card Name', 'Mandatory', 'Must be selected from active database credit card offers catalog.', 'Public Redirection', 'Auto-Aligns Card Bank & Link']
    ];

    rules.forEach((row) => {
      guideSheet.addRow(row);
    });

    // Section 2 Header: DOs and DON'Ts Table
    guideSheet.addRow([]);
    const dosRowIdx = guideSheet.rowCount + 1;
    guideSheet.mergeCells(`A${dosRowIdx}:E${dosRowIdx}`);
    const sec2 = guideSheet.getCell(`A${dosRowIdx}`);
    sec2.value = '2. DOs & DON\'Ts FOR AGENT LEAD FILE PREPARATION';
    sec2.font = { bold: true, size: 10.5, color: { argb: 'FFFFFFFF' } };
    sec2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    guideSheet.getRow(dosRowIdx).height = 24;

    const dosHeaderIdx = dosRowIdx + 1;
    guideSheet.getRow(dosHeaderIdx).values = ['Category', 'DO (Recommended Action)', 'DON\'T (Prohibited Action)'];
    const rDos = guideSheet.getRow(dosHeaderIdx);
    rDos.font = { bold: true, color: { argb: 'FF0F172A' } };
    rDos.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    guideSheet.getRow(dosHeaderIdx).height = 22;

    const dosAndDonts = [
      ['Agent ID', 'Use Agent Code / ID (e.g. ag_01, lakshay, FIDR30) from the dropdown.', 'Do NOT enter Agent Phone Numbers into Agent ID column.'],
      ['Full Name', 'Enter complete First and Last Name matching PAN card (e.g. Harsh Deep).', 'Do NOT enter single names (e.g. Rahul) or numbers.'],
      ['Mobile Number', 'Enter 10 digits starting with 6, 7, 8, or 9 (e.g. 8708569574).', 'Do NOT add +91, leading 0, spaces, or hyphens.'],
      ['Card Selection', 'Select Card Name from dropdown list populated from database cards.', 'Do NOT enter custom unapproved card names.'],
      ['Date of Birth', 'Ensure applicant is between 21 and 70 years of age.', 'Do NOT submit leads for underage applicants (<21 yrs).']
    ];

    dosAndDonts.forEach(row => {
      guideSheet.addRow(row);
    });

    // Column widths for Guidelines Sheet
    guideSheet.getColumn(1).width = 18;
    guideSheet.getColumn(2).width = 22;
    guideSheet.getColumn(3).width = 65;
    guideSheet.getColumn(4).width = 25;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="FinMantra_Leads_Upload_Template.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[Template Generator] Failed:', err);
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

// Single Manual Lead Creation
app.post('/api/leads/create-manual', authenticateToken, async (req, res) => {
  const canCreate = await canUserCreateLeads(req.user);
  if (!canCreate) {
    return res.status(403).json({ error: 'Permission denied. Manual lead creation is restricted to Developer or authorized accounts.' });
  }

  const {
    application_id,
    full_name,
    phone,
    email,
    city,
    employment,
    income_range,
    card_id,
    card_name,
    card_bank,
    agent_id,
    pan_no,
    dob,
    mother_name,
    current_address,
    pincode,
    designation,
    company_name,
    has_credit_card,
    monthly_income,
    consent,
    source,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    utm_info,
    utm_id,
    utm_creative,
    utm_placement,
    landing_page,
    redirect_url,
    referrer,
    fbclid
  } = req.body;

  if (!full_name || !phone) {
    return res.status(400).json({ error: 'Full Name and 10-digit Phone Number are required.' });
  }

  const cleanPhone = String(phone).replace(/\D/g, '');
  if (!/^[6-9]/.test(cleanPhone) || cleanPhone.length !== 10) {
    return res.status(400).json({ error: 'Phone number must start with 6,7,8,9 and contain exactly 10 digits.' });
  }

  // Validate Agent in database
  let targetAgent = null;
  if (agent_id) {
    targetAgent = await db.getAgentByIdOrUsername(agent_id);
    if (!targetAgent) {
      return res.status(400).json({ error: `Source Agent '${agent_id}' does not exist in database. Lead rejected.` });
    }
  } else if (req.user.role === 'agent') {
    targetAgent = await db.getAgentById(req.user.id);
  } else {
    return res.status(400).json({ error: 'Source Agent selection is required.' });
  }

  let finalCardName = card_name || '';
  let finalCardBank = card_bank || '';
  if (card_id) {
    const card = await db.getCardById(card_id);
    if (card) {
      finalCardName = card.name;
      finalCardBank = card.bank;
    }
  }

  const leadObj = {
    full_name: full_name.trim(),
    phone: cleanPhone,
    email: (email || '').trim(),
    city: city || targetAgent.locations?.[0] || 'Unknown',
    employment: employment || 'Salaried',
    income_range: income_range || '3-6 LPA',
    card_id: card_id || null,
    card_name: finalCardName,
    card_bank: finalCardBank,
    source: source || 'public',
    agent_id: targetAgent.id,
    agent_name: targetAgent.name,
    agent_location: targetAgent.locations?.[0] || city || 'Head Office',
    application_id: application_id ? String(application_id).trim() : null,
    pan_no: pan_no ? String(pan_no).trim().toUpperCase() : null,
    dob: dob ? String(dob).trim() : null,
    mother_name: mother_name ? String(mother_name).trim() : null,
    current_address: current_address ? String(current_address).trim() : null,
    pincode: pincode ? String(pincode).trim() : null,
    designation: designation ? String(designation).trim() : null,
    company_name: company_name ? String(company_name).trim() : null,
    has_credit_card: has_credit_card || 'No',
    monthly_income: monthly_income ? String(monthly_income).trim() : null,
    consent: consent !== undefined ? consent : true,
    utm_source: utm_source || 'manual',
    utm_medium: utm_medium || 'agent_portal',
    utm_campaign: utm_campaign || '',
    utm_content: utm_content || '',
    utm_term: utm_term || '',
    utm_info: utm_info || null,
    utm_id: utm_id || null,
    utm_creative: utm_creative || null,
    utm_placement: utm_placement || null,
    landing_page: landing_page || null,
    redirect_url: redirect_url || null,
    referrer: referrer || null,
    fbclid: fbclid || null
  };

  try {
    const savedLead = await db.addLead(leadObj);
    invalidateMISCache();
    broadcast({ type: 'LEADS_UPDATED' });
    return res.json({ success: true, lead: savedLead });
  } catch (err) {
    console.error('[Create Lead] Error:', err);
    return res.status(500).json({ error: 'Failed to save manual lead to database: ' + err.message });
  }
});

// Extract and map all 30 Marketing, Attribution, & Click Identifier fields from Excel or URL query params
function extractAndMapAllTrackingParams(r, matchedCard) {
  const getCol = (...keys) => {
    for (const k of keys) {
      if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
        return String(r[k]).trim();
      }
    }
    return '';
  };

  let utm_channel = getCol('UTM Channel', 'utm_channel');
  let utm_medium = getCol('UTM Medium', 'utm_medium');
  let utm_source = getCol('UTM Source', 'utm_source');
  let utm_category = getCol('UTM Category', 'utm_category');
  let utm_campaign = getCol('UTM Campaign', 'utm_campaign');
  let utm_term = getCol('UTM Term', 'utm_term');
  let utm_content = getCol('UTM Content', 'utm_content');
  let utm_creative_format = getCol('UTM Creative Format', 'utm_creative_format');
  let utm_info = getCol('UTM Info', 'utm_info');
  let utm_id = getCol('UTM Campaign ID (utm_id)', 'UTM Campaign ID', 'utm_id');
  let utm_creative = getCol('UTM Ad ID (utm_creative)', 'UTM Ad ID', 'utm_creative', 'ad_id');
  let utm_internal = getCol('UTM Internal', 'utm_internal');
  let utm_keyword = getCol('UTM Keyword (utm_keyword)', 'UTM Keyword', 'utm_keyword');
  let utm_matchtype = getCol('UTM Matchtype (utm_matchtype)', 'UTM Matchtype', 'utm_matchtype');
  let utm_network = getCol('UTM Network (utm_network)', 'UTM Network', 'utm_network');
  let utm_placement = getCol('UTM Placement (utm_placement)', 'UTM Placement', 'utm_placement');
  let utm_device = getCol('UTM Device (utm_device)', 'UTM Device', 'utm_device');
  let utm_location = getCol('UTM Location (utm_location)', 'UTM Location', 'utm_location');

  let landing_page = getCol('Landing Page URL', 'landing_page', 'Landing Page');
  let redirect_url = getCol('Redirect URL', 'redirect_url');
  let referrer = getCol('Referrer Source', 'referrer', 'Referrer');

  let fbclid = getCol('FBCLID (Facebook)', 'FBCLID', 'fbclid');
  let gclid = getCol('GCLID (Google)', 'GCLID', 'gclid');
  let gbraid = getCol('GBRAID (Google App iOS)', 'GBRAID', 'gbraid');
  let wbraid = getCol('WBRAID (Google App Web)', 'WBRAID', 'wbraid');
  let gclsrc = getCol('GCLSRC (Google Click Source)', 'GCLSRC', 'gclsrc');
  let dclid = getCol('DCLID (Google Display)', 'DCLID', 'dclid');
  let msclkid = getCol('MSCLKID (Bing)', 'MSCLKID', 'msclkid');
  let ttclid = getCol('TTCLID (TikTok)', 'TTCLID', 'ttclid');
  let twclid = getCol('TWCLID (Twitter)', 'TWCLID', 'twclid');
  let li_fat_id = getCol('LI_FAT_ID (LinkedIn)', 'LI_FAT_ID', 'li_fat_id');

  if (!redirect_url && matchedCard) {
    redirect_url = matchedCard.redirect_url || matchedCard.apply_url || '';
  }

  const parseUrlParams = (urlStr) => {
    if (!urlStr) return;
    try {
      const targetStr = urlStr.startsWith('http') ? urlStr : `https://${urlStr}`;
      const urlObj = new URL(targetStr);
      const params = urlObj.searchParams;

      if (!utm_source && params.get('utm_source')) utm_source = params.get('utm_source');
      if (!utm_medium && params.get('utm_medium')) utm_medium = params.get('utm_medium');
      if (!utm_campaign && params.get('utm_campaign')) utm_campaign = params.get('utm_campaign');
      if (!utm_term && params.get('utm_term')) utm_term = params.get('utm_term');
      if (!utm_content && params.get('utm_content')) utm_content = params.get('utm_content');
      if (!utm_creative && (params.get('utm_creative') || params.get('ad_id'))) utm_creative = params.get('utm_creative') || params.get('ad_id');
      if (!utm_id && params.get('utm_id')) utm_id = params.get('utm_id');
      if (!utm_placement && params.get('utm_placement')) utm_placement = params.get('utm_placement');
      if (!utm_internal && params.get('utm_internal')) utm_internal = params.get('utm_internal');
      if (!utm_info && params.get('utm_info')) utm_info = params.get('utm_info');
      if (!fbclid && params.get('fbclid')) fbclid = params.get('fbclid');
      if (!gclid && params.get('gclid')) gclid = params.get('gclid');
      if (!gbraid && params.get('gbraid')) gbraid = params.get('gbraid');
      if (!wbraid && params.get('wbraid')) wbraid = params.get('wbraid');
    } catch (e) {}
  };

  parseUrlParams(landing_page);
  parseUrlParams(redirect_url);

  if (!utm_source) utm_source = fbclid ? 'meta' : (gclid ? 'google' : 'excel_upload');
  if (!utm_medium) utm_medium = fbclid ? 'paid_social' : (gclid ? 'cpc' : 'agent_portal');
  if (!utm_info) utm_info = utm_medium || 'agent_portal';
  if (!utm_channel) utm_channel = utm_medium === 'paid_social' ? 'paid_social' : (utm_medium || 'N/A');

  const utm_params = {
    utm_source: utm_source || null,
    utm_medium: utm_medium || null,
    utm_campaign: utm_campaign || null,
    utm_term: utm_term || null,
    utm_content: utm_content || null,
    utm_channel: utm_channel || null,
    utm_category: utm_category || null,
    utm_info: utm_info || null,
    utm_creative_format: utm_creative_format || null,
    utm_id: utm_id || null,
    utm_creative: utm_creative || null,
    utm_internal: utm_internal || null,
    utm_keyword: utm_keyword || null,
    utm_matchtype: utm_matchtype || null,
    utm_network: utm_network || null,
    utm_placement: utm_placement || null,
    utm_device: utm_device || null,
    utm_location: utm_location || null,
    landing_page: landing_page || null,
    redirect_url: redirect_url || null,
    referrer: referrer || null,
    fbclid: fbclid || null,
    gclid: gclid || null,
    gbraid: gbraid || null,
    wbraid: wbraid || null,
    gclsrc: gclsrc || null,
    dclid: dclid || null,
    msclkid: msclkid || null,
    ttclid: ttclid || null,
    twclid: twclid || null,
    li_fat_id: li_fat_id || null
  };

  return {
    utm_channel: utm_channel || null,
    utm_medium: utm_medium || null,
    utm_source: utm_source || null,
    utm_category: utm_category || null,
    utm_campaign: utm_campaign || null,
    utm_term: utm_term || null,
    utm_content: utm_content || null,
    utm_creative_format: utm_creative_format || null,
    utm_info: utm_info || null,
    utm_id: utm_id || null,
    utm_creative: utm_creative || null,
    utm_internal: utm_internal || null,
    utm_keyword: utm_keyword || null,
    utm_matchtype: utm_matchtype || null,
    utm_network: utm_network || null,
    utm_placement: utm_placement || null,
    utm_device: utm_device || null,
    utm_location: utm_location || null,
    landing_page: landing_page || null,
    redirect_url: redirect_url || null,
    referrer: referrer || null,
    fbclid: fbclid || null,
    gclid: gclid || null,
    gbraid: gbraid || null,
    wbraid: wbraid || null,
    gclsrc: gclsrc || null,
    dclid: dclid || null,
    msclkid: msclkid || null,
    ttclid: ttclid || null,
    twclid: twclid || null,
    li_fat_id: li_fat_id || null,
    utm_params
  };
}

// Bulk Lead Upload (Accelerated via Python Pandas Micro-Engine with Native JS Fallback)
app.post('/api/leads/upload-manual', authenticateToken, upload.single('file'), async (req, res) => {
  const canCreate = await canUserCreateLeads(req.user);
  if (!canCreate) {
    return res.status(403).json({ error: 'Permission denied. Bulk lead upload is restricted.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No Excel/CSV file uploaded.' });
  }

  try {
    const allAgents = await db.getAgents();
    const agentMapObj = {};
    const agentMap = new Map();
    allAgents.forEach(ag => {
      if (ag.id) {
        const cleanId = ag.id.toLowerCase().trim();
        const alnumId = cleanId.replace(/[^a-z0-9]/g, '');
        agentMapObj[cleanId] = ag;
        agentMapObj[alnumId] = ag;
        agentMapObj[`agent-${cleanId}`] = ag;
        agentMap.set(cleanId, ag);
        agentMap.set(alnumId, ag);
        agentMap.set(`agent-${cleanId}`, ag);
      }
      if (ag.username) {
        const cleanUser = ag.username.toLowerCase().trim();
        const alnumUser = cleanUser.replace(/[^a-z0-9]/g, '');
        agentMapObj[cleanUser] = ag;
        agentMapObj[alnumUser] = ag;
        agentMap.set(cleanUser, ag);
        agentMap.set(alnumUser, ag);
      }
      if (ag.name) {
        const cleanName = ag.name.toLowerCase().trim();
        agentMapObj[cleanName] = ag;
        agentMap.set(cleanName, ag);
      }
    });

    const allCards = await db.getCards();
    const cardMapObj = {};
    const cardMap = new Map();
    allCards.forEach(c => {
      if (c.id) {
        cardMapObj[c.id.toLowerCase().trim()] = c;
        cardMap.set(c.id.toLowerCase().trim(), c);
      }
      if (c.name) {
        cardMapObj[c.name.toLowerCase().trim()] = c;
        cardMap.set(c.name.toLowerCase().trim(), c);
      }
    });

    let validLeads = [];
    let createdCount = 0;
    let failedCount = 0;
    let errors = [];
    let totalRows = 0;

    // Ensure persistent storage directory exists
    const UPLOAD_LEAD_FILES_DIR = path.join(__dirname, 'uploads', 'lead_files');
    if (!fs.existsSync(UPLOAD_LEAD_FILES_DIR)) {
      fs.mkdirSync(UPLOAD_LEAD_FILES_DIR, { recursive: true });
    }

    // Save persistent upload copy
    const ext = (req.file.originalname.split('.').pop() || 'xlsx').toLowerCase();
    const persistentFileName = `lead_upload_${Date.now()}_${req.user.id || 'admin'}.${ext}`;
    const persistentFilePath = path.join(UPLOAD_LEAD_FILES_DIR, persistentFileName);
    fs.writeFileSync(persistentFilePath, req.file.buffer);

    // Write file to temporary disk location for Python pandas processing
    const tmpFileName = `tmp_${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
    const tmpFilePath = path.join(os.tmpdir(), tmpFileName);
    fs.writeFileSync(tmpFilePath, req.file.buffer);

    // Fetch existing Application IDs from DB to prevent duplicate applications
    const existingAppIdsSet = await db.getExistingApplicationIds();
    const existingAppIdsArray = Array.from(existingAppIdsSet);

    let pythonSuccess = false;

    try {
      const pythonScript = path.join(__dirname, 'excel_parser.py');
      const pyResult = await new Promise((resolve, reject) => {
        execFile('python', [
          pythonScript,
          tmpFilePath,
          JSON.stringify(agentMapObj),
          JSON.stringify(cardMapObj),
          req.user.role || 'admin',
          req.user.id || '',
          JSON.stringify(existingAppIdsArray)
        ], { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
          if (err) return reject(err || stderr);
          try {
            const parsed = JSON.parse(stdout);
            resolve(parsed);
          } catch (pe) {
            reject(pe);
          }
        });
      });

      if (pyResult && pyResult.success) {
        pythonSuccess = true;
        totalRows = pyResult.total;
        failedCount = pyResult.failed;
        errors = pyResult.errors || [];
        validLeads = pyResult.valid_leads || [];
        console.log(`[Python Micro-Engine] Processed ${totalRows} rows cleanly (${validLeads.length} valid leads, ${failedCount} errors).`);
      }
    } catch (pyErr) {
      console.warn('[Python Micro-Engine Warning] Falling back to Node JS parser:', pyErr.message || pyErr);
    } finally {
      try { if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath); } catch (e) {}
    }

    // Fallback to Native JS parser if Python is unavailable
    if (!pythonSuccess) {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

      if (!rows || rows.length === 0) {
        return res.status(400).json({ error: 'Uploaded Excel/CSV file contains no data rows.' });
      }

      totalRows = rows.length;

      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx];
        const rowNum = idx + 2;

        const fullName = (r['Full Name'] || r['full_name'] || r['Name'] || r['name'] || '').toString().trim();
        const rawPhone = (r['Phone'] || r['phone'] || r['Mobile'] || r['mobile'] || '').toString().trim();
        const cleanPhone = rawPhone.replace(/\D/g, '');
        const agentIdentifier = (r['Agent ID'] || r['agent_id'] || r['AgentsId'] || r['Source Agent'] || r['Agent'] || '').toString().trim();

        if (!fullName) { failedCount++; errors.push(`Row ${rowNum}: Full Name is required.`); continue; }
        if (!/^[a-zA-Z\s]+$/.test(fullName)) { failedCount++; errors.push(`Row ${rowNum} (${fullName}): Name must contain alphabetic characters only as per PAN card.`); continue; }
        const nameWords = fullName.split(/\s+/).filter(Boolean);
        if (nameWords.length < 2) { failedCount++; errors.push(`Row ${rowNum} (${fullName}): Please enter complete Name (First Name + Last Name).`); continue; }

        if (!cleanPhone) { failedCount++; errors.push(`Row ${rowNum} (${fullName}): Phone number is required.`); continue; }
        if (!/^[6-9]/.test(cleanPhone)) { failedCount++; errors.push(`Row ${rowNum} (${fullName}): Mobile number must start with 6, 7, 8, or 9.`); continue; }
        if (cleanPhone.length !== 10) { failedCount++; errors.push(`Row ${rowNum} (${fullName}): Mobile number must be exactly 10 digits.`); continue; }

        const email = (r['Email'] || r['email'] || '').toString().trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { failedCount++; errors.push(`Row ${rowNum} (${fullName}): Invalid email format ('${email}').`); continue; }

        const panNo = (r['PAN Number'] || r['pan_no'] || r['PAN'] || '').toString().trim().toUpperCase();
        if (panNo && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNo)) { failedCount++; errors.push(`Row ${rowNum} (${fullName}): Invalid PAN card format ('${panNo}'). Must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).`); continue; }

        const dobVal = r['Date of Birth'] || r['dob'] || r['DOB'] || '';
        let formattedDob = null;
        if (dobVal) {
          const applicantAge = calculateApplicantAge(dobVal);
          if (applicantAge === -1) { failedCount++; errors.push(`Row ${rowNum} (${fullName}): Invalid Date of Birth ('${dobVal}'). Use YYYY-MM-DD or DD-MM-YYYY.`); continue; }
          if (applicantAge < 21 || applicantAge > 70) { failedCount++; errors.push(`Row ${rowNum} (${fullName}): Applicant age (${applicantAge} yrs) must be between 21 and 70 years old.`); continue; }
          const dObj = parseAnyDate(dobVal);
          if (dObj) {
            const yyyy = dObj.getFullYear();
            const mm = String(dObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dObj.getDate()).padStart(2, '0');
            formattedDob = `${yyyy}-${mm}-${dd}`;
          }
        }

        const pincode = (r['Pincode'] || r['pincode'] || '').toString().trim();
        if (pincode && !/^\d{6}$/.test(pincode)) { failedCount++; errors.push(`Row ${rowNum} (${fullName}): Pincode must be exactly 6 numeric digits ('${pincode}').`); continue; }

        const rawMonthlyInc = (r['Net Monthly Income'] || r['monthly_income'] || '').toString().trim().replace(/\D/g, '');
        if (rawMonthlyInc) {
          const incNum = parseInt(rawMonthlyInc, 10);
          if (incNum < 25000 || incNum > 1000000) { failedCount++; errors.push(`Row ${rowNum} (${fullName}): Monthly income (₹${incNum}) must be between ₹25,000 and ₹10,00,000 for credit card eligibility.`); continue; }
        }

        if (agentIdentifier && /^[6-9]\d{9}$/.test(agentIdentifier) && !agentMap.has(agentIdentifier.toLowerCase())) {
          failedCount++; errors.push(`Row ${rowNum} (${fullName}): '${agentIdentifier}' is a Phone Number. Please specify a valid Agent Code / ID (e.g. ag_01, lakshay) instead.`); continue;
        }

        let matchedAgent = null;
        if (agentIdentifier) {
          const cleanId = agentIdentifier.toLowerCase().trim();
          const alnumId = cleanId.replace(/[^a-z0-9]/g, '');
          matchedAgent = agentMap.get(cleanId) || agentMap.get(alnumId);
        }
        if (!matchedAgent && req.user.role === 'agent' && req.user.id) {
          const cleanUser = req.user.id.toLowerCase().trim();
          const alnumUser = cleanUser.replace(/[^a-z0-9]/g, '');
          matchedAgent = agentMap.get(cleanUser) || agentMap.get(alnumUser);
        }
        if (!matchedAgent && req.user.role === 'agent' && req.user.id) {
          matchedAgent = { id: req.user.id, name: req.user.name || 'Field Agent', locations: ['Head Office'] };
        }

        if (!matchedAgent) { failedCount++; errors.push(`Row ${rowNum} (${fullName}): Source Agent Code / ID '${agentIdentifier || 'Unspecified'}' does NOT exist in database. Rejected.`); continue; }

        const rawCardName = (r['Card Name'] || r['card_name'] || r['Card'] || '').toString().trim();
        let matchedCard = rawCardName ? cardMap.get(rawCardName.toLowerCase()) : null;
        let cardId = matchedCard ? matchedCard.id : null;
        let finalCardName = matchedCard ? matchedCard.name : rawCardName;
        let finalCardBank = matchedCard ? matchedCard.bank : (r['Card Bank'] || r['card_bank'] || '');

        const trackingData = extractAndMapAllTrackingParams(r, matchedCard);
        const appId = (r['Application ID'] || r['application_id'] || r['App ID'] || r['Application No'] || r['application_no'] || r['App No'] || r['Application Number'] || r['app_number'] || r['App Number'] || r['Application Ref No'] || r['Appl ID'] || r['Ref No'] || '').toString().trim();

        const leadObj = {
          full_name: fullName,
          phone: cleanPhone,
          email,
          pan_no: panNo || null,
          dob: formattedDob || null,
          mother_name: (r['Mother Name'] || r['mother_name'] || '').toString().trim() || null,
          current_address: (r['Current Address'] || r['current_address'] || r['Address'] || '').toString().trim() || null,
          pincode: pincode || null,
          employment: (r['Employment'] || r['employment'] || 'Salaried').toString().trim(),
          designation: (r['Designation'] || r['designation'] || '').toString().trim() || null,
          company_name: (r['Company Name'] || r['company_name'] || r['Company'] || '').toString().trim() || null,
          has_credit_card: (r['Already Has Credit Card'] || r['has_credit_card'] || 'No').toString().trim(),
          monthly_income: rawMonthlyInc || null,
          income_range: (r['Income Range'] || r['income_range'] || '3-6 LPA').toString().trim(),
          city: matchedAgent.locations?.[0] || 'Head Office',
          agent_id: matchedAgent.id,
          agent_name: matchedAgent.name,
          agent_location: matchedAgent.locations?.[0] || 'Head Office',
          card_id: cardId,
          card_name: finalCardName,
          card_bank: finalCardBank,
          source: 'agent',
          consent: (r['Consent'] || r['consent'] || 'Yes').toString().trim().toLowerCase() !== 'no',
          application_id: appId || null,
          ...trackingData
        };
        validLeads.push(leadObj);
      }
    }

    // Save all valid leads into DB
    for (const leadObj of validLeads) {
      try {
        await db.addLead(leadObj);
        createdCount++;
      } catch (insertErr) {
        failedCount++;
        errors.push(`Lead (${leadObj.full_name}): Database insertion error - ${insertErr.message}`);
      }
    }

    // Persist file metadata record in DB
    try {
      await db.addUploadedLeadFile({
        filename: persistentFileName,
        original_filename: req.file.originalname,
        file_size: req.file.size,
        agent_id: req.user.id || 'admin',
        agent_name: req.user.name || (req.user.role === 'admin' ? 'Admin' : 'Field Agent'),
        total_rows: totalRows,
        created_count: createdCount,
        failed_count: failedCount,
        errors: errors,
        file_path: persistentFilePath
      });
    } catch (dbLogErr) {
      console.error('[Upload Manual Leads] DB file record logging failed:', dbLogErr);
    }

    invalidateMISCache();
    broadcast({ type: 'LEADS_UPDATED' });

    return res.json({
      success: true,
      total: totalRows,
      created: createdCount,
      failed: failedCount,
      errors
    });
  } catch (err) {
    console.error('[Upload Manual Leads] Error:', err);
    return res.status(500).json({ error: 'Failed to process Excel/CSV file: ' + err.message });
  }
});

// GET Uploaded Lead Files List (Admin Only)
app.get('/api/admin/uploaded-lead-files', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const files = await db.getUploadedLeadFiles();
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch uploaded files list: ' + err.message });
  }
});

// Download Raw Uploaded Lead File (Admin Only)
app.get('/api/admin/uploaded-lead-files/:id/download', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const fileRecord = await db.getUploadedLeadFileById(req.params.id);
    if (!fileRecord || !fileRecord.file_path) {
      return res.status(404).json({ error: 'Uploaded file record not found.' });
    }
    if (!fs.existsSync(fileRecord.file_path)) {
      return res.status(404).json({ error: 'File no longer exists on server disk.' });
    }
    res.download(fileRecord.file_path, fileRecord.original_filename);
  } catch (err) {
    res.status(500).json({ error: 'Failed to download file: ' + err.message });
  }
});

// Developer / Admin Agent Permissions Toggle
app.put('/api/agents/:id/permissions', authenticateToken, requireAdmin, async (req, res) => {
  const { can_create_leads, can_upload_mis, agent_mode, assigned_bank } = req.body;
  const agentId = req.params.id;

  try {
    const updateObj = {};
    if (can_create_leads !== undefined) {
      updateObj.can_create_leads = !!can_create_leads;
      if (updateObj.can_create_leads) {
        updateObj.can_upload_mis = false;
        updateObj.agent_mode = 'lead_agent';
      }
    }
    if (can_upload_mis !== undefined) {
      updateObj.can_upload_mis = !!can_upload_mis;
      if (updateObj.can_upload_mis) {
        updateObj.can_create_leads = false;
        updateObj.agent_mode = 'bank_mis_agent';
      }
    }
    if (agent_mode) {
      updateObj.agent_mode = agent_mode;
      if (agent_mode === 'lead_agent') {
        updateObj.can_create_leads = true;
        updateObj.can_upload_mis = false;
      } else if (agent_mode === 'bank_mis_agent') {
        updateObj.can_create_leads = false;
        updateObj.can_upload_mis = true;
      }
    }
    if (assigned_bank !== undefined) updateObj.assigned_bank = assigned_bank || null;

    const updated = await db.updateAgent(agentId, updateObj);
    if (!updated) return res.status(404).json({ error: 'Agent not found' });

    broadcast({ type: 'AGENTS_UPDATED' });
    return res.json({ success: true, agent: updated });
  } catch (err) {
    console.error('[Agent Permissions] Error:', err);
    return res.status(500).json({ error: 'Failed to update agent permissions' });
  }
});

// Get/Set Custom Lead Template Settings
app.get('/api/settings/lead-template', authenticateToken, async (req, res) => {
  try {
    const allSettings = await db.getSettings();
    const val = allSettings ? allSettings.lead_upload_template_schema : null;
    const data = val ? JSON.parse(val) : { headers: null, require_agent: true };
    return res.json(data);
  } catch(e) {
    return res.json({ headers: null, require_agent: true });
  }
});

app.post('/api/settings/lead-template', authenticateToken, requireAdmin, async (req, res) => {
  if (!req.user.canDelete) {
    return res.status(403).json({ error: 'Only Developer (Lakshay@123) can modify template settings.' });
  }

  try {
    const { headers, require_agent } = req.body;
    const config = { headers: headers || null, require_agent: require_agent !== undefined ? require_agent : true };
    await db.saveSetting('lead_upload_template_schema', JSON.stringify(config));
    return res.json({ success: true, config });
  } catch(e) {
    return res.status(500).json({ error: 'Failed to save template settings' });
  }
});

// UTM Filter Options (distinct values for dropdowns)
app.get('/api/leads/utm-options', authenticateToken, async (req, res) => {
  try {
    const options = await db.getUTMFilterOptions();
    res.json(options);
  } catch (err) {
    console.error('[GET /api/leads/utm-options] Error:', err);
    res.status(500).json({ error: 'Failed to fetch UTM filter options' });
  }
});

// Fetch Leads (Admin or Agent)
app.get('/api/leads', authenticateToken, async (req, res) => {
  try {
    const role = req.user.role;
    if (role === 'admin' || role === 'agent') {
      let agentId = null;
      let bankMisFilter = null;

      if (role === 'agent') {
        const agent = await db.getAgentById(req.user.id);
        if (agent && (agent.can_upload_mis || agent.agent_mode === 'bank_mis_agent')) {
          bankMisFilter = agent.assigned_bank || null;
        } else {
          agentId = req.user.id;
        }
      }

      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 50;
      const search = req.query.search || '';
      const card = req.query.card || '';
      const source = req.query.source || '';
      const utmSource = req.query.utmSource || req.query.utm_source || '';
      const startDate = req.query.startDate || '';
      const endDate = req.query.endDate || '';
      const campaign = req.query.campaign || '';
      const term = req.query.term || '';
      const info = req.query.info || '';
      const companyCategory = req.query.companyCategory || '';
      const ltfEligible = req.query.ltfEligible || '';
      
      const result = await db.getLeadsFiltered({
        agentId, bankMisFilter, page, limit, search, card, source, utmSource, startDate, endDate, campaign, term, info, companyCategory, ltfEligible
      });
      return res.json(result);
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }
  } catch (err) {
    console.error('[GET /api/leads] Error:', err);
    return res.status(500).json({ error: 'Failed to fetch leads from database' });
  }
});

// Get Database Connectivity and Tables Status (Admin Only)
app.get('/api/admin/db-status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const dbStatus = await db.getDatabaseStatus();
    return res.json(dbStatus);
  } catch (err) {
    console.error('[API Error] /api/admin/db-status:', err);
    return res.status(500).json({ error: 'Failed to retrieve database status' });
  }
});

// Run Custom SQL Query Console (Admin Only)
app.post('/api/admin/db-query', authenticateToken, requireAdmin, async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'SQL query string is required' });
  }

  const isModifying = /drop|truncate|delete|update|insert/i.test(query);
  const adminPassword = req.headers['x-admin-password'] || req.body?.adminPassword;
  const isSuperAdmin = adminPassword === 'Lakshay@123' || (req.user && req.user.canDelete);
  
  if (isModifying && !isSuperAdmin) {
    return res.status(403).json({ error: 'SQL modification statements (INSERT, UPDATE, DELETE, DROP, TRUNCATE) are restricted to Super Admin (Lakshay) only.' });
  }

  try {
    const result = await db.runQuery(query);
    return res.json({
      success: true,
      rows: result.rows || [],
      rowCount: result.rowCount || 0,
      fields: (result.fields || []).map(f => f.name)
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// Bulk/Single Delete Leads (Admin Only)
app.post('/api/leads/delete-bulk', authenticateToken, requireAdmin, async (req, res) => {
  const adminPassword = req.headers['x-admin-password'] || req.body?.adminPassword;
  const hasPass = adminPassword === 'Lakshay@123';
  if ((!req.user || !req.user.canDelete) && !hasPass) {
    return res.status(403).json({ error: 'Delete permission restricted. Only Super Admin (Lakshay) can delete leads.' });
  }

  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'IDs array required' });
  }
  await db.deleteLeads(ids);
  
  // Broadcast deletion update
  invalidateMISCache();
  broadcast({ type: 'LEADS_UPDATED' });
  
  res.json({ success: true, message: 'Leads deleted successfully' });
});

app.delete('/api/leads/:id', authenticateToken, requireAdmin, async (req, res) => {
  const adminPassword = req.headers['x-admin-password'] || req.body?.adminPassword;
  const hasPass = adminPassword === 'Lakshay@123';
  if ((!req.user || !req.user.canDelete) && !hasPass) {
    return res.status(403).json({ error: 'Delete permission restricted. Only Super Admin (Lakshay) can delete leads.' });
  }

  const { id } = req.params;
  await db.deleteLead(id);
  
  // Broadcast deletion update
  invalidateMISCache();
  broadcast({ type: 'LEADS_UPDATED' });
  
  res.json({ success: true, message: 'Lead deleted successfully' });
});

// Bulk/Single Unmap Leads from Dashboard (Admin Only)
app.post('/api/leads/unmap-bulk', authenticateToken, requireAdmin, async (req, res) => {
  const adminPassword = req.headers['x-admin-password'] || req.body?.adminPassword;
  const hasPass = adminPassword === 'Lakshay@123';
  if ((!req.user || !req.user.canDelete) && !hasPass) {
    return res.status(403).json({ error: 'Delete permission restricted. Only Super Admin (Lakshay) can unmap leads.' });
  }

  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'IDs array required' });
  }
  await db.unmapLeads(ids);
  
  // Broadcast update
  invalidateMISCache();
  broadcast({ type: 'LEADS_UPDATED' });
  
  res.json({ success: true, message: 'Leads unmapped successfully' });
});

app.post('/api/leads/:id/unmap', authenticateToken, requireAdmin, async (req, res) => {
  const adminPassword = req.headers['x-admin-password'] || req.body?.adminPassword;
  const hasPass = adminPassword === 'Lakshay@123';
  if ((!req.user || !req.user.canDelete) && !hasPass) {
    return res.status(403).json({ error: 'Delete permission restricted. Only Super Admin (Lakshay) can unmap leads.' });
  }

  const { id } = req.params;
  await db.unmapLead(id);
  
  // Broadcast update
  invalidateMISCache();
  broadcast({ type: 'LEADS_UPDATED' });
  
  res.json({ success: true, message: 'Lead unmapped successfully' });
});

// Update Lead (Admin Only)
app.put('/api/leads/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const leadData = req.body;
  
  try {
    const updated = await db.updateLead(id, leadData);
    
    // Broadcast updates
    invalidateMISCache();
    broadcast({ type: 'LEADS_UPDATED' });
    
    // Automatically dispatch Meta CAPI Purchase event if lead is approved/mapped
    if (updated) {
      setTimeout(async () => {
        try {
          if (isFinalApprovedStatus(updated.mis_status)) {
            await sendMetaCapiEvent(updated, 'Purchase', 2000, updated.card_bank);
          }
        } catch (e) {
          console.error('[Meta Event Auto-Dispatch] Error on lead update:', e.message);
        }
      }, 50);
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update lead' });
  }
});

// Export Leads to CSV (Admin Only)
app.get('/api/leads/export', authenticateToken, requireAdmin, async (req, res) => {
  const { search, card, source, utmSource, startDate, endDate, campaign, term, info, companyCategory, ltfEligible } = req.query;
  const leads = await db.getLeadsForExport({ search, card, source, utmSource, startDate, endDate, campaign, term, info, companyCategory, ltfEligible });
  
  const settings = await db.getSettings();
  let columns = [];
  try {
    columns = typeof settings.csv_export_template === 'string'
      ? JSON.parse(settings.csv_export_template)
      : (settings.csv_export_template || []);
  } catch (err) {
    console.error('[Export] Failed to parse csv_export_template settings key:', err);
  }

  if (!Array.isArray(columns) || columns.length === 0) {
    columns = [
      { id: "urn", header: "URN", source: "urn" },
      { id: "redirect_url", header: "Redirect URL", source: "redirect_url" },
      { id: "created_at", header: "Creation Date/Time", source: "created_at" },
      { id: "full_name", header: "Full Name", source: "full_name" },
      { id: "phone", header: "Phone", source: "phone" },
      { id: "email", header: "Email", source: "email" },
      { id: "pan_no", header: "PAN Number", source: "pan_no" },
      { id: "city", header: "City", source: "city" },
      { id: "employment", header: "Employment", source: "employment" },
      { id: "income_range", header: "Monthly Income", source: "income_range" },
      { id: "card_name", header: "Selected Card", source: "card_name" },
      { id: "card_bank", header: "Card Bank", source: "card_bank" },
      { id: "source", header: "Source", source: "source" },
      { id: "utm_source", header: "UTM Source", source: "utm_source" },
      { id: "utm_info", header: "UTM Info", source: "utm_info" },
      { id: "utm_creative_format", header: "UTM Creative Format", source: "utm_creative_format" },
      { id: "utm_medium", header: "UTM Medium", source: "utm_medium" },
      { id: "utm_campaign", header: "UTM Campaign", source: "utm_campaign" },
      { id: "utm_term", header: "UTM Term", source: "utm_term" },
      { id: "utm_content", header: "UTM Content", source: "utm_content" },
      { id: "utm_channel", header: "UTM Channel", source: "utm_channel" },
      { id: "utm_category", header: "UTM Category", source: "utm_category" },
      { id: "utm_id", header: "UTM Campaign ID (utm_id)", source: "utm_id" },
      { id: "utm_creative", header: "UTM Ad ID (utm_creative)", source: "utm_creative" },
      { id: "utm_internal", header: "UTM Internal (utm_internal)", source: "utm_internal" },
      { id: "utm_keyword", header: "UTM Keyword (utm_keyword)", source: "utm_keyword" },
      { id: "utm_matchtype", header: "UTM Matchtype (utm_matchtype)", source: "utm_matchtype" },
      { id: "utm_network", header: "UTM Network (utm_network)", source: "utm_network" },
      { id: "utm_placement", header: "UTM Placement (utm_placement)", source: "utm_placement" },
      { id: "utm_device", header: "UTM Device (utm_device)", source: "utm_device" },
      { id: "utm_location", header: "UTM Location (utm_location)", source: "utm_location" },
      { id: "gbraid", header: "GBRAID (gbraid)", source: "gbraid" },
      { id: "wbraid", header: "WBRAID (wbraid)", source: "wbraid" },
      { id: "landing_page", header: "Landing Page (landing_page)", source: "landing_page" },
      { id: "first_landing_page", header: "First Landing Page (first_landing_page)", source: "first_landing_page" },
      { id: "referrer", header: "Referrer (referrer)", source: "referrer" },
      { id: "fbclid", header: "FBCLID", source: "fbclid" },
      { id: "gclid", header: "GCLID", source: "gclid" },
      { id: "gclsrc", header: "GCLSRC", source: "gclsrc" },
      { id: "dclid", header: "DCLID", source: "dclid" },
      { id: "msclkid", header: "MSCLKID", source: "msclkid" },
      { id: "ttclid", header: "TTCLID", source: "ttclid" },
      { id: "twclid", header: "TWCLID", source: "twclid" },
      { id: "li_fat_id", header: "LI_FAT_ID", source: "li_fat_id" },
      { id: "utm_params", header: "All Tracking Parameters (JSON)", source: "utm_params" },
      { id: "agent_name", header: "Agent Name", source: "agent_name" },
      { id: "agent_location", header: "Agent Location", source: "agent_location" },
      { id: "has_credit_card", header: "Already Has Credit Card?", source: "has_credit_card" },
      { id: "pincode", header: "Residence Pincode", source: "pincode" },
      { id: "monthly_income", header: "Monthly Income", source: "monthly_income" },
      { id: "dob", header: "Date of Birth", source: "dob" },
      { id: "mother_name", header: "Mother's Name", source: "mother_name" },
      { id: "current_address", header: "Current Address", source: "current_address" },
      { id: "designation", header: "Designation", source: "designation" },
      { id: "redirect_url", header: "Redirect URL", source: "redirect_url" }
    ];
  }

  // Generate headers
  let csv = columns.map(c => `"${(c.header || '').replace(/"/g, '""')}"`).join(',') + '\n';

  // Generate rows
  leads.forEach(l => {
    const rowValues = columns.map(col => {
      let val = '';
      const source = col.source;
      if (source === 'application_id') {
        val = l.application_id || (l.mis_data && (l.mis_data.application_id || l.mis_data.APPLICATION_NUMBER || l.mis_data.application_id_bank_2 || l.mis_data.user_id || l.mis_data.LRN_NUMBER)) || '';
      } else if (source === 'created_at') {
        if (l.created_at) {
          const d = new Date(l.created_at);
          try {
            const formatter = new Intl.DateTimeFormat('en-CA', {
              timeZone: 'Asia/Kolkata',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });
            const parts = formatter.formatToParts(d);
            const p = {};
            parts.forEach(x => p[x.type] = x.value);
            val = `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
          } catch (e) {
            val = d.toISOString().replace('T', ' ').slice(0, 16);
          }
        } else {
          val = '';
        }
      } else if (source === 'utm_params') {
        val = l.utm_params ? JSON.stringify(l.utm_params) : '{}';
      } else if (source === 'redirect_url') {
        if (l.redirect_url) {
          val = l.redirect_url;
        } else {
          const agentCode = l.agent_id || 'public';
          const dateCode = l.created_at ? new Date(l.created_at).toISOString().slice(0, 10).replace(/-/g, '') : '';
          const domain = getPublicSiteUrl(req, settings);
          val = `${domain}/refer/${agentCode}/${dateCode}/${l.urn || ''}`;
        }
      } else if (l[source] !== undefined && l[source] !== null && String(l[source]).trim() !== '') {
        val = String(l[source]);
      } else if (l.mis_data && l.mis_data[source] !== undefined && l.mis_data[source] !== null && String(l.mis_data[source]).trim() !== '') {
        val = String(l.mis_data[source]);
      } else if (l.utm_params && l.utm_params[source] !== undefined && l.utm_params[source] !== null && String(l.utm_params[source]).trim() !== '') {
        val = String(l.utm_params[source]);
      }
      return val.replace(/"/g, '""');
    });
    csv += rowValues.map(v => `"${v}"`).join(',') + '\n';
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=finmantra_leads.csv');
  res.status(200).send(csv);
});

// --- CARDS MANAGEMENT ---

// Get active cards for public
app.get('/api/cards', async (req, res) => {
  try {
    const cards = await db.getCards(false);
    res.json(cards || []);
  } catch (err) {
    console.error('[API Error] /api/cards:', err.message);
    res.json([]);
  }
});

// Get all cards (Admin Only)
app.get('/api/admin/cards', authenticateToken, requireAdmin, async (req, res) => {
  const cards = await db.getCards(true);
  res.json(cards);
});

// Create Card (Admin Only)
app.post('/api/cards', authenticateToken, requireAdmin, async (req, res) => {
  const { name, bank, category, ad_id, utm_internal, description, redirect_url_template, display_order, active, card_locations } = req.body;

  const trimmedName = name ? String(name).trim() : '';
  const trimmedBank = bank ? String(bank).trim() : '';
  const trimmedUrl = redirect_url_template ? String(redirect_url_template).trim() : '';

  if (!trimmedName || !trimmedBank || !trimmedUrl) {
    return res.status(400).json({ error: 'Card Name, Bank and Redirect URL Template are required' });
  }

  if (category === 'Digital' && (!utm_internal || !String(utm_internal).trim())) {
    return res.status(400).json({ error: 'utm_internal is mandatory for Digital cards' });
  }

  if (!/^https?:\/\//i.test(trimmedUrl)) {
    return res.status(400).json({ error: 'Redirect URL Template must start with http:// or https://' });
  }

  const cards = await db.getCards(true);
  if (cards.some(c => c.name.toLowerCase() === trimmedName.toLowerCase() && c.bank.toLowerCase() === trimmedBank.toLowerCase())) {
    return res.status(400).json({ error: 'A card with this name already exists for this bank.' });
  }

  const newCard = await db.addCard({
    name: trimmedName,
    bank: trimmedBank,
    category: category || 'Offline',
    ad_id: ad_id || '',
    utm_internal: utm_internal || '',
    description: description ? String(description).trim() : '',
    redirect_url_template: trimmedUrl,
    display_order: display_order || 1,
    active: active !== undefined ? active : true,
    card_locations: Array.isArray(card_locations) ? card_locations : []
  });
  
  // Broadcast cards change
  broadcast({ type: 'CARDS_UPDATED' });
  
  res.json(newCard);
});

// Update Card (Admin Only)
app.put('/api/cards/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { name, bank, category, ad_id, utm_internal, description, redirect_url_template, display_order, active, card_locations } = req.body;

  const trimmedName = name ? String(name).trim() : '';
  const trimmedBank = bank ? String(bank).trim() : '';
  const trimmedUrl = redirect_url_template ? String(redirect_url_template).trim() : '';

  if (!trimmedName || !trimmedBank || !trimmedUrl) {
    return res.status(400).json({ error: 'Card Name, Bank and Redirect URL Template are required' });
  }

  if (category === 'Digital' && (!utm_internal || !String(utm_internal).trim())) {
    return res.status(400).json({ error: 'utm_internal is mandatory for Digital cards' });
  }

  if (!/^https?:\/\//i.test(trimmedUrl)) {
    return res.status(400).json({ error: 'Redirect URL Template must start with http:// or https://' });
  }

  const updated = await db.updateCard(req.params.id, {
    name: trimmedName,
    bank: trimmedBank,
    category: category || 'Offline',
    ad_id: ad_id || '',
    utm_internal: utm_internal || '',
    description: description ? String(description).trim() : '',
    redirect_url_template: trimmedUrl,
    display_order: display_order || 1,
    active: active !== undefined ? active : true,
    card_locations: Array.isArray(card_locations) ? card_locations : []
  });

  if (updated) {
    // Broadcast cards change
    broadcast({ type: 'CARDS_UPDATED' });
    res.json(updated);
  } else {
    res.status(404).json({ error: 'Card not found' });
  }
});

// Delete Card (Admin Only)
app.delete('/api/cards/:id', authenticateToken, requireAdmin, async (req, res) => {
  await db.deleteCard(req.params.id);
  
  // Broadcast cards change
  broadcast({ type: 'CARDS_UPDATED' });
  
  res.json({ success: true, message: 'Card deleted successfully' });
});

// --- AGENT MANAGEMENT (Admin Only) ---

// Get Agents
app.get('/api/agents', authenticateToken, requireAdmin, async (req, res) => {
  const agents = await db.getAgents();
  res.json(agents);
});

// Create Agent
app.post('/api/agents', authenticateToken, requireAdmin, async (req, res) => {
  const { id, name, phone, email, username, password, status, locations, assigned_bank, agent_mode, can_create_leads, can_upload_mis } = req.body;
  
  const trimmedId = id ? String(id).trim() : '';
  const trimmedName = name ? String(name).trim() : '';
  const trimmedUsername = username ? String(username).trim() : '';
  const trimmedPhone = phone ? String(phone).trim() : '';
  const trimmedEmail = email ? String(email).trim() : '';

  if (!trimmedId || !trimmedName || !trimmedUsername || !password) {
    return res.status(400).json({ error: 'Missing Agent Code/ID, name, username or password' });
  }

  // Validate format constraints
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedId)) {
    return res.status(400).json({ error: 'Agent Code/ID must contain only alphanumeric characters, hyphens or underscores (no spaces).' });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
    return res.status(400).json({ error: 'Agent Username must contain only alphanumeric characters, hyphens or underscores (no spaces).' });
  }

  if (trimmedPhone && (trimmedPhone.length !== 10 || !/^\d+$/.test(trimmedPhone))) {
    return res.status(400).json({ error: 'Agent WhatsApp number must be exactly 10 digits.' });
  }

  if (trimmedEmail && !/\S+@\S+\.\S+/.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const agents = await db.getAgents();

  // Check unique ID constraint
  if (agents.some(a => a.id.toLowerCase() === trimmedId.toLowerCase())) {
    return res.status(400).json({ error: 'Agent Code/ID must be unique. This ID already exists.' });
  }

  // Check unique username constraint
  if (agents.some(a => a.username.toLowerCase() === trimmedUsername.toLowerCase())) {
    return res.status(400).json({ error: 'Agent Username must be unique. This username already exists.' });
  }

  const mode = agent_mode || (assigned_bank ? 'bank_mis_agent' : 'lead_agent');
  const createPerm = can_create_leads !== undefined ? !!can_create_leads : (mode === 'lead_agent');
  const misPerm = can_upload_mis !== undefined ? !!can_upload_mis : (mode === 'bank_mis_agent');

  const password_hash = bcrypt.hashSync(password, 10);
  const newAgent = await db.addAgent({
    id: trimmedId,
    name: trimmedName,
    phone: trimmedPhone || null,
    email: trimmedEmail || null,
    username: trimmedUsername,
    password_hash,
    status: status || 'active',
    locations: locations || [],
    assigned_bank: assigned_bank || null,
    agent_mode: mode,
    can_create_leads: createPerm,
    can_upload_mis: misPerm
  });

  // Broadcast agents change
  broadcast({ type: 'AGENTS_UPDATED' });

  res.json(newAgent);
});

// Update Agent
app.put('/api/agents/:id', authenticateToken, requireAdmin, async (req, res) => {
  const updateData = { ...req.body };
  if (updateData.password) {
    updateData.password_hash = bcrypt.hashSync(updateData.password, 10);
    delete updateData.password;
  }
  const updated = await db.updateAgent(req.params.id, updateData);
  if (updated) {
    // Broadcast agents change
    broadcast({ type: 'AGENTS_UPDATED' });
    res.json(updated);
  } else {
    res.status(404).json({ error: 'Agent not found' });
  }
});

// Delete Agent
app.delete('/api/agents/:id', authenticateToken, requireAdmin, async (req, res) => {
  await db.deleteAgent(req.params.id);
  
  // Broadcast agents change
  broadcast({ type: 'AGENTS_UPDATED' });
  
  res.json({ success: true, message: 'Agent deleted successfully' });
});

// --- LOCATION MANAGEMENT ---

// Get Locations
app.get('/api/locations', async (req, res) => {
  const locations = await db.getLocations();
  res.json(locations);
});

// Create Location (Admin Only)
app.post('/api/locations', authenticateToken, requireAdmin, async (req, res) => {
  const { name } = req.body;
  const trimmedName = name ? String(name).trim() : '';

  if (!trimmedName) {
    return res.status(400).json({ error: 'Location name is required' });
  }

  const locations = await db.getLocations();
  if (locations.some(l => l.name.toLowerCase() === trimmedName.toLowerCase())) {
    return res.status(400).json({ error: 'Location name already exists. Please choose a unique name.' });
  }

  const newLoc = await db.addLocation({ name: trimmedName, active: true });
  
  // Broadcast locations change
  broadcast({ type: 'LOCATIONS_UPDATED' });
  
  res.json(newLoc);
});

// Update Location (Admin Only)
app.put('/api/locations/:id', authenticateToken, requireAdmin, async (req, res) => {
  const updated = await db.updateLocation(req.params.id, req.body);
  if (updated) {
    // Broadcast locations change
    broadcast({ type: 'LOCATIONS_UPDATED' });
    res.json(updated);
  } else {
    res.status(404).json({ error: 'Location not found' });
  }
});

// Delete Location (Admin Only)
app.delete('/api/locations/:id', authenticateToken, requireAdmin, async (req, res) => {
  await db.deleteLocation(req.params.id);
  
  // Broadcast locations change
  broadcast({ type: 'LOCATIONS_UPDATED' });
  
  res.json({ success: true, message: 'Location deleted successfully' });
});

// --- WHATSAPP BAILEYS ROUTES (Admin Only) ---

// Get WhatsApp QR and Connection status
app.get('/api/whatsapp/status', authenticateToken, requireAdmin, (req, res) => {
  res.json(baileys.getBaileysStatus());
});

// Disconnect WhatsApp / Log out
app.post('/api/whatsapp/disconnect', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await baileys.disconnectBaileys();
    res.json({ success: true, message: 'WhatsApp session disconnected successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper for Meta Graph API calls
function getMetaGraph(path, token) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const options = {
      hostname: 'graph.facebook.com',
      port: 443,
      path: path.startsWith('/') ? path : `/${path}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            const msg = parsed.error?.message || `Meta API error (status ${res.statusCode})`;
            reject(new Error(msg));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`Meta API error (status ${res.statusCode}): ${body}`));
          }
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });
    req.end();
  });
}

// Fetch Meta Phone Numbers associated with the access token
app.get('/api/whatsapp/meta-phone-numbers', authenticateToken, requireAdmin, async (req, res) => {
  let { token, business_account_id, version } = req.query;

  try {
    const settings = await db.getSettings();
    const apiKey = token ? token.trim() : getSettingVal(settings, 'wa_api_key', 'WA_API_KEY');
    const apiVersion = version ? version.trim() : getSettingVal(settings, 'wa_api_version', 'WA_API_VERSION', 'v25.0');
    const wabaId = business_account_id ? business_account_id.trim() : getSettingVal(settings, 'wa_business_account_id', 'WA_BUSINESS_ACCOUNT_ID');

    if (!apiKey) {
      return res.status(400).json({ error: 'Meta WhatsApp API System User Access Token (WA_API_KEY) is missing.' });
    }

    let phoneNumbers = [];

    const fetchPhoneNumbersForWaba = async (wabaIdVal, wabaNameVal) => {
      try {
        const path = `/${apiVersion}/${wabaIdVal}/phone_numbers?fields=display_phone_number,quality_rating,verified_name,code_verification_status,id`;
        const result = await getMetaGraph(path, apiKey);
        if (result && Array.isArray(result.data)) {
          return result.data.map(phone => ({
            id: phone.id,
            display_phone_number: phone.display_phone_number,
            quality_rating: phone.quality_rating,
            verified_name: phone.verified_name,
            code_verification_status: phone.code_verification_status,
            waba_id: wabaIdVal,
            waba_name: wabaNameVal || `WABA (${wabaIdVal})`
          }));
        }
      } catch (err) {
        console.error(`[Meta API Error] Failed to fetch phone numbers for WABA ${wabaIdVal}:`, err.message);
      }
      return [];
    };

    if (wabaId && wabaId !== 'undefined' && wabaId !== 'null') {
      const wabaPhones = await fetchPhoneNumbersForWaba(wabaId, `WABA (${wabaId})`);
      phoneNumbers = phoneNumbers.concat(wabaPhones);
    } else {
      const wabaPath = `/${apiVersion}/me/whatsapp_business_accounts`;
      const wabaResult = await getMetaGraph(wabaPath, apiKey);
      if (wabaResult && Array.isArray(wabaResult.data)) {
        for (const waba of wabaResult.data) {
          if (waba.id) {
            const wabaPhones = await fetchPhoneNumbersForWaba(waba.id, waba.name);
            phoneNumbers = phoneNumbers.concat(wabaPhones);
          }
        }
      }
    }

    res.json({ success: true, phoneNumbers });
  } catch (err) {
    console.error('[API Error] Fetching Meta Phone Numbers failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test Live WhatsApp Meta API Message Delivery (OTP or Referral URL)
app.post('/api/whatsapp/test', async (req, res) => {
  const { phone = '8295886832', type = 'otp' } = req.body;
  const settings = await db.getSettings();
  
  try {
    if (type === 'otp') {
      const sampleOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const configuredTemplate = settings.wa_otp_template_name || process.env.WA_OTP_TEMPLATE_NAME || 'finmantra_otp';
      const result = await sendWhatsAppTemplate(phone, configuredTemplate, [sampleOtp], true);
      return res.json({ success: true, message: `Sample OTP (${sampleOtp}) dispatched to ${phone} via Meta API template "${configuredTemplate}".`, result });
    } else {
      const sampleBaseUrl = getPublicSiteUrl(req, settings);
      const sampleUrl = `${sampleBaseUrl}/refer/public/20260628/FMTEST999`;
      const referralTemplateName = settings.wa_referral_template_name || process.env.WA_REFERRAL_TEMPLATE_NAME || 'transactional_link';
      const result = await sendWhatsAppTemplate(phone, referralTemplateName, ['Customer', sampleUrl]);
      return res.json({ success: true, message: `Sample Bank Portal URL dispatched to ${phone} via Meta API template "${referralTemplateName}".`, result });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Autocomplete search for SBI company names
app.get('/api/sbi/companies/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json([]);
    }

    // Search by prefix first, then by substring
    const query = `
      SELECT company_name, company_code, company_category, why_ltf_pricing
      FROM sbi_company_codes
      WHERE LOWER(company_name) LIKE $1
      ORDER BY 
        CASE WHEN LOWER(company_name) LIKE $2 THEN 0 ELSE 1 END,
        company_name ASC
      LIMIT 15
    `;
    const params = [`%${q.toLowerCase()}%`, `${q.toLowerCase()}%`];
    const result = await db.pool.query(query, params);
    
    // Deduplicate by name
    const seen = new Set();
    const suggestions = [];
    for (const row of result.rows) {
      const cleanName = row.company_name.toUpperCase();
      if (!seen.has(cleanName)) {
        seen.add(cleanName);
        suggestions.push({
          name: row.company_name,
          code: row.company_code,
          category: row.company_category,
          why_ltf: row.why_ltf_pricing
        });
      }
    }
    
    res.json(suggestions);
  } catch (err) {
    console.error('[Search Suggest API Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- PINCODE LOOKUP PROXY ---
app.get(['/api/pincode/lookup/:pincode', '/api/pincodes/lookup/:pincode'], async (req, res) => {
  const { pincode } = req.params;
  const pin = (pincode || '').trim();
  if (pin.length !== 6 || !/^\d+$/.test(pin)) {
    return res.status(400).json({ error: 'Invalid pincode format' });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7500);

  let resolved = false;
  let result = null;

  // 1. Try Zippopotam API (highly reliable, globally distributed CDN)
  try {
    const zipRes = await fetch(`https://api.zippopotam.us/in/${pin}`, { signal: controller.signal });
    if (zipRes.ok) {
      const zipData = await zipRes.json();
      if (zipData && zipData.places && zipData.places.length > 0) {
        const state = zipData.places[0].state;
        const rawPlace = zipData.places[0]['place name'];
        const district = rawPlace.split('(')[0].trim();
        const localities = zipData.places.map(p => p['place name'].split('(')[0].trim()).filter((v, i, a) => v && a.indexOf(v) === i);
        
        result = {
          city: district,
          state: state,
          localities: localities
        };
        resolved = true;
      }
    }
  } catch (zipErr) {
    console.warn(`[Pincode Proxy] Zippopotam lookup failed for ${pin}:`, zipErr.message);
  }

  // 2. Try Postal Pincode API
  if (!resolved) {
    try {
      const postRes = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: controller.signal });
      if (postRes.ok) {
        const data = await postRes.json();
        if (data && data[0] && data[0].Status === 'Success') {
          const postOffices = data[0].PostOffice;
          if (postOffices && postOffices.length > 0) {
            const district = postOffices[0].District;
            const state = postOffices[0].State;
            const localities = postOffices.map(po => po.Name).filter(Boolean);
            
            result = {
              city: district,
              state: state,
              localities: localities
            };
            resolved = true;
          }
        }
      }
    } catch (postErr) {
      console.error(`[Pincode Proxy] Postal Pincode lookup failed for ${pin}:`, postErr.message);
    }
  }

  clearTimeout(timeoutId);

  if (resolved && result) {
    return res.json(result);
  } else {
    return res.status(404).json({ error: 'Pincode not found' });
  }
});

// --- SETTINGS MANAGEMENT ---

// Get Settings
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await db.getSettings();
    res.json(settings || {});
  } catch (err) {
    console.error('[API Error] /api/settings:', err.message);
    res.json({});
  }
});

// Update Settings (Admin Only)
app.put('/api/settings', authenticateToken, requireAdmin, async (req, res) => {
  // If editing form builder schema, enforce Super Admin (developer/Lakshay) privilege only
  if (req.body.landing_form_schema && !req.user.canDelete) {
    return res.status(403).json({ error: 'Landing Form Builder access is restricted to developer admin (Lakshay) only.' });
  }

  const oldSettings = await db.getSettings();
  const updated = await db.updateSettings(req.body);

  // If card_manager_banks is updated, diff to find deleted banks and clear agent assignments
  if (req.body.card_manager_banks !== undefined) {
    const oldBanks = oldSettings.card_manager_banks ? oldSettings.card_manager_banks.split(',').map(b => b.trim()).filter(Boolean) : [];
    const newBanks = req.body.card_manager_banks ? req.body.card_manager_banks.split(',').map(b => b.trim()).filter(Boolean) : [];
    const deletedBanks = oldBanks.filter(b => !newBanks.includes(b));
    for (const bankName of deletedBanks) {
      await db.removeAgentBankAssignment(bankName);
    }
  }
  
  // Toggle Baileys session connection if gateway changed
  if (oldSettings.whatsapp_gateway !== updated.whatsapp_gateway) {
    console.log(`[Settings] WhatsApp gateway changed from '${oldSettings.whatsapp_gateway}' to '${updated.whatsapp_gateway}'`);
    if (updated.whatsapp_gateway === 'meta') {
      await baileys.stopBaileys();
    } else if (updated.whatsapp_gateway === 'baileys') {
      await baileys.startBaileys();
    }
  }

  // Broadcast settings change
  broadcast({ type: 'SETTINGS_UPDATED' });
  broadcast({ type: 'AGENTS_UPDATED' }); // Broadcast agent update since assignments might have changed
  
  res.json(updated);
});

// Check if pincode is in OCL & Negative Pincode List
app.get('/api/pincodes/check-negative/:pincode', (req, res) => {
  const pin = String(req.params.pincode || '').trim();
  const isNegative = negativePincodesSet.has(pin);
  res.json({ pincode: pin, isNegative });
});

// Get Designations (filtered by employment_type query parameter)
app.get('/api/designations', async (req, res) => {
  try {
    const { employment_type } = req.query;
    const list = await db.getDesignations(employment_type);
    return res.json(list);
  } catch (err) {
    console.error('[API Error] /api/designations:', err);
    return res.status(500).json({ error: 'Failed to retrieve designations' });
  }
});

// Parse Pincode File (supports .xlsx, .xls, .csv, .txt)
app.post('/api/pincodes/parse', authenticateToken, requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const filename = req.file.originalname;
    const ext = filename.split('.').pop().toLowerCase();
    let pincodes = [];

    if (ext === 'xlsx' || ext === 'xls') {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const csv = xlsx.utils.sheet_to_csv(sheet);
        const matches = csv.match(/\b\d{6}\b/g) || [];
        pincodes.push(...matches);
      });
    } else {
      // Treat as plain text (.txt, .csv)
      const text = req.file.buffer.toString('utf-8');
      const matches = text.match(/\b\d{6}\b/g) || [];
      pincodes.push(...matches);
    }

    // Deduplicate and sort
    const uniquePincodes = Array.from(new Set(pincodes)).sort();

    res.json({ success: true, pincodes: uniquePincodes });
  } catch (err) {
    console.error('[Pincode Parsing Error]', err);
    res.status(500).json({ error: 'Failed to parse pincode list file. Make sure it is a valid Excel, CSV, or TXT file.' });
  }
});

// ── AUTOMATED SBI EMAIL MIS AUTO-SYNC ENDPOINTS ──

// Trigger Manual SBI Email MIS Sync (Admin Only)
app.post('/api/admin/sync-email-mis', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await sbiEmailFetcher.checkAndFetchEmails(broadcast);
    return res.json(result);
  } catch (err) {
    console.error('[Manual Email MIS Sync] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get SBI Email MIS Configuration (Admin Only)
app.get('/api/admin/email-mis-config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const config = await sbiEmailFetcher.getEmailConfig();
    return res.json({
      ...config,
      app_password: config.app_password ? '••••••••••••••••' : ''
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch email config' });
  }
});

// Trigger Manual KIWI Email MIS Sync (Admin Only)
app.post('/api/admin/sync-kiwi-email-mis', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await kiwiEmailFetcher.checkAndFetchEmails(broadcast);
    return res.json(result);
  } catch (err) {
    console.error('[Manual KIWI Email MIS Sync] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get KIWI Email MIS Configuration (Admin Only)
app.get('/api/admin/kiwi-email-mis-config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const config = await kiwiEmailFetcher.getEmailConfig();
    return res.json({
      ...config,
      app_password: config.app_password ? '••••••••••••••••' : ''
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch kiwi email config' });
  }
});

// Remove Duplicate Leads (Admin Only)
app.post('/api/admin/remove-duplicates', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.removeDuplicateLeads();
    if (result.success) {
      broadcast({ type: 'LEADS_UPDATED' });
      if (result.removedCount > 0) {
        broadcast({ type: 'NOTIFICATION_ADDED' });
      }
      return res.json(result);
    }
    return res.status(500).json({ success: false, error: result.error });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get Lead Visibility Settings
app.get('/api/admin/visibility-settings', authenticateToken, async (req, res) => {
  try {
    const config = await db.getLeadVisibilityConfig();
    return res.json({ success: true, config });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch visibility config' });
  }
});

// Save Lead Visibility Settings
app.post('/api/admin/visibility-settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const devPassword = req.headers['x-admin-password'];
    if (devPassword !== 'Lakshay@123') {
      return res.status(403).json({ error: 'Developer Authorization Password (Lakshay@123) is required.' });
    }
    await db.setLeadVisibilityConfig(req.body.config);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save visibility config' });
  }
});

// Save SBI Email MIS Configuration (Admin Only - Requires Lakshay@123 Developer Authorization)
app.post('/api/admin/email-mis-config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { devPassword, receiver_email, app_password, sender_email, subject_keywords, enabled } = req.body;
    
    // Strict Lakshay@123 password verification for changing IMAP settings
    if (devPassword !== 'Lakshay@123' && !req.user.canDelete) {
      return res.status(403).json({ error: 'Developer Authorization Password (Lakshay@123) is required to save Email IMAP settings.' });
    }

    const currentConfig = await sbiEmailFetcher.getEmailConfig();
    const newConfig = {
      receiver_email: receiver_email || currentConfig.receiver_email,
      app_password: (app_password && !app_password.includes('••')) ? app_password : currentConfig.app_password,
      sender_email: sender_email || currentConfig.sender_email,
      subject_keywords: Array.isArray(subject_keywords) ? subject_keywords : currentConfig.subject_keywords,
      enabled: enabled !== undefined ? Boolean(enabled) : currentConfig.enabled
    };

    await db.saveSetting('email_mis_config', JSON.stringify(newConfig));
    return res.json({ success: true, config: { ...newConfig, app_password: '••••••••••••••••' } });
  } catch (err) {
    console.error('[Save Email Config Error]', err);
    return res.status(500).json({ error: 'Failed to save email config' });
  }
});

// Save KIWI Email MIS Configuration (Admin Only - Requires Lakshay@123 Developer Authorization)
app.post('/api/admin/kiwi-email-mis-config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { devPassword, receiver_email, app_password, sender_email, subject_keywords, enabled } = req.body;
    
    if (devPassword !== 'Lakshay@123' && !req.user.canDelete) {
      return res.status(403).json({ error: 'Developer Authorization Password (Lakshay@123) is required to save KIWI Email IMAP settings.' });
    }

    const currentConfig = await kiwiEmailFetcher.getEmailConfig();
    const newConfig = {
      receiver_email: receiver_email || currentConfig.receiver_email,
      app_password: (app_password && !app_password.includes('••')) ? app_password : currentConfig.app_password,
      sender_email: sender_email || currentConfig.sender_email,
      subject_keywords: Array.isArray(subject_keywords) ? subject_keywords : currentConfig.subject_keywords,
      enabled: enabled !== undefined ? Boolean(enabled) : currentConfig.enabled
    };

    await db.saveSetting('kiwi_email_mis_config', JSON.stringify(newConfig));
    return res.json({ success: true, config: { ...newConfig, app_password: '••••••••••••••••' } });
  } catch (err) {
    console.error('[Save KIWI Email Config Error]', err);
    return res.status(500).json({ error: 'Failed to save kiwi email config' });
  }
});

// Get All Database Banks List
app.get('/api/admin/banks', authenticateToken, async (req, res) => {
  try {
    const banks = await db.getAllDatabaseBanks();
    return res.json({ success: true, banks });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch database banks' });
  }
});

// ── ADMIN NOTIFICATION CENTER ENDPOINTS ──

// Fetch Notifications (Admin & Agents)
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const unreadOnly = req.query.unreadOnly === 'true';
    const data = await db.getNotifications({ limit, unreadOnly });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark All Notifications as Read
app.post('/api/notifications/read-all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.markNotificationsRead();
    broadcast({ type: 'NOTIFICATION_UPDATED' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

// Clear All Notifications
app.delete('/api/notifications', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.clearNotifications();
    broadcast({ type: 'NOTIFICATION_UPDATED' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

// Test CAPI Event Trigger Console
app.post('/api/meta/test-capi', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { lead_id, bank_name, test_event_code } = req.body;
    let targetLead = null;
    if (lead_id) {
      const resDb = await db.pool.query('SELECT * FROM leads WHERE id = $1', [lead_id]);
      targetLead = resDb.rows[0];
    }

    if (!targetLead) {
      targetLead = {
        id: `test_${Date.now()}`,
        full_name: 'Test Customer',
        phone: '9876543210',
        email: 'testcustomer@finmantra.org',
        card_bank: bank_name || 'HDFC Bank',
        card_name: 'HDFC Millennia Credit Card',
        mis_status: 'Approved',
        landing_page: 'https://finmantra.org/'
      };
    }

    const result = await sendMetaCapiEvent(targetLead, 'Purchase', 2000, bank_name || targetLead.card_bank, test_event_code);
    res.json({ success: true, result });
  } catch (err) {
    console.error('[API Error] POST /api/meta/test-capi:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Meta Custom Audience Management API Routes ──

// List Audiences with filters
app.get('/api/meta/audiences', authenticateToken, async (req, res) => {
  try {
    const { bank, status, type, search } = req.query;
    const audiences = await db.getMetaAudiences({
      bank_name: bank,
      status_category: status,
      audience_type: type,
      search
    });

    // Auto-calculate current matching database count for each audience
    for (const aud of audiences) {
      const eligible = await metaAudienceService.getEligibleMappedLeadsForAudience(aud);
      aud.database_count = eligible.length;
    }

    res.json({ success: true, audiences });
  } catch (err) {
    console.error('[API Error] GET /api/meta/audiences:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create Custom Audience
app.post('/api/meta/audiences', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, bank_name, status_category, description, auto_push, rules } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Audience name is required' });
    }

    const existing = await db.getMetaAudienceByName(name);
    if (existing) {
      return res.status(400).json({ error: `An audience with the name '${name}' already exists.` });
    }

    const metaRes = await metaAudienceService.createMetaCustomAudience(name, description);
    const audience = await db.createMetaAudience({
      name: String(name).trim(),
      audience_type: 'CUSTOM',
      bank_name: bank_name || null,
      status_category: status_category || null,
      meta_audience_id: metaRes.metaAudienceId || null,
      description: description || '',
      auto_push: auto_push !== undefined ? auto_push : true,
      rules: rules || {}
    });

    await db.insertAudienceAuditLog({
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'AUDIENCE_CREATED',
      audience_id: audience.id,
      audience_name: audience.name,
      details: { rules }
    });

    broadcast({ type: 'META_AUDIENCES_UPDATED' });
    res.json({ success: true, audience });
  } catch (err) {
    console.error('[API Error] POST /api/meta/audiences:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get Single Audience Details
app.get('/api/meta/audiences/:id', authenticateToken, async (req, res) => {
  try {
    const audience = await db.getMetaAudienceById(req.params.id);
    if (!audience) {
      return res.status(404).json({ error: 'Audience not found' });
    }

    const eligible = await metaAudienceService.getEligibleMappedLeadsForAudience(audience);
    audience.database_count = eligible.length;

    res.json({ success: true, audience });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Audience Rules / Config
app.patch('/api/meta/audiences/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const audience = await db.updateMetaAudience(req.params.id, req.body);
    if (!audience) {
      return res.status(404).json({ error: 'Audience not found' });
    }

    await db.insertAudienceAuditLog({
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'AUDIENCE_UPDATED',
      audience_id: audience.id,
      audience_name: audience.name,
      details: req.body
    });

    broadcast({ type: 'META_AUDIENCES_UPDATED' });
    res.json({ success: true, audience });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Custom Audience
app.delete('/api/meta/audiences/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const audience = await db.getMetaAudienceById(req.params.id);
    if (!audience) {
      return res.status(404).json({ error: 'Audience not found' });
    }

    if (audience.meta_audience_id) {
      await metaAudienceService.deleteMetaCustomAudience(audience.meta_audience_id);
    }

    await db.deleteMetaAudience(audience.id);
    await db.insertAudienceAuditLog({
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'AUDIENCE_DELETED',
      audience_id: audience.id,
      audience_name: audience.name
    });

    broadcast({ type: 'META_AUDIENCES_UPDATED' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Incremental Sync for single audience
app.post('/api/meta/audiences/:id/sync', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await metaAudienceService.syncSingleAudience(req.params.id, false, broadcast);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full Resync & Reconciliation for single audience
app.post('/api/meta/audiences/:id/full-sync', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await metaAudienceService.syncSingleAudience(req.params.id, true, broadcast);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full Resync for ALL active audiences
app.post('/api/meta/audiences/full-sync-all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const audiences = await db.getMetaAudiences();

    // Run asynchronously
    setTimeout(async () => {
      for (const aud of audiences) {
        if (aud.auto_push && aud.status !== 'paused') {
          await metaAudienceService.syncSingleAudience(aud.id, true, broadcast);
        }
      }
    }, 100);

    res.json({ success: true, message: `Full resync triggered for ${audiences.length} audience(s)` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Retry Failed Members for single audience
app.post('/api/meta/audiences/:id/retry', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await metaAudienceService.syncSingleAudience(req.params.id, true, broadcast);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Preview Custom Audience Rules Match Count & Sample Records
app.post('/api/meta/audiences/preview', authenticateToken, async (req, res) => {
  try {
    const { rules, audience_type, bank_name, status_category } = req.body;
    const tempAudience = {
      audience_type: audience_type || 'CUSTOM',
      bank_name: bank_name || null,
      status_category: status_category || null,
      rules: rules || {}
    };

    const eligible = await metaAudienceService.getEligibleMappedLeadsForAudience(tempAudience);
    const sample = eligible.slice(0, 10).map(l => ({
      id: l.id,
      urn: l.urn,
      full_name: l.full_name,
      phone: l.phone ? `${l.phone.substring(0, 4)}****${l.phone.slice(-2)}` : '',
      email: l.email ? `${l.email.substring(0, 3)}***@***` : '',
      card_bank: l.card_bank,
      card_name: l.card_name,
      mis_status: l.mis_status,
      created_at: l.created_at
    }));

    res.json({
      success: true,
      totalMatchingLeads: eligible.length,
      sample
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Paginated Audience Members
app.get('/api/meta/audiences/:id/members', authenticateToken, async (req, res) => {
  try {
    const { limit, offset, state } = req.query;
    const result = await db.getMetaAudienceMemberships(req.params.id, {
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
      state
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync Execution History Logs
app.get('/api/meta/audiences/:id/sync-history', authenticateToken, async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const result = await db.getSyncJobs(req.params.id, {
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-provision Bank Audiences for all existing/new banks
app.post('/api/meta/provision/banks', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await metaAudienceService.autoProvisionBankAudiences(broadcast);
    const audiences = await db.getMetaAudiences();
    res.json({ success: true, totalAudiences: audiences.length, audiences });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TEMPORARY: Public debug endpoint to inspect KIWI SOFT_APPROVE leads
app.get('/api/debug/kiwi-soft-approve', async (req, res) => {
  try {
    const query = `
      SELECT id, urn, full_name, phone, mis_status, mis_data
      FROM leads
      WHERE (card_bank ILIKE '%KIWI%' OR mis_data->>'mis_bank_name' ILIKE '%KIWI%' OR (mis_data->>'kiwi_winning_bank' IS NOT NULL AND mis_data->>'kiwi_winning_bank' != '') OR card_name ILIKE '%KIWI%' OR landing_page ILIKE '%KIWI%' OR landing_page ILIKE '%GOKIWI%' OR utm_source ILIKE '%KIWI%' OR utm_source ILIKE '%GOKIWI%')
    `;
    const result = await db.pool.query(query);
    const allLeads = result.rows.map(l => {
      let md = l.mis_data;
      if (typeof md === 'string') { try { md = JSON.parse(md); } catch (e) {} }
      md = md || {};
      const cat = metaAudienceService.getKiwiStatusCategory(l, l.mis_status, md);
      return { id: l.id, urn: l.urn, name: l.full_name, mis_status: l.mis_status, category: cat, mis_data: md };
    });
    const softApprove = allLeads.filter(l => l.category === 'SOFT_APPROVE');
    const softDecline = allLeads.filter(l => l.category === 'SOFT_DECLINE');
    const finalDecline = allLeads.filter(l => l.category === 'FINAL_DECLINE');
    const finalApprove = allLeads.filter(l => l.category === 'FINAL_APPROVE');
    res.json({
      counts: { SOFT_APPROVE: softApprove.length, SOFT_DECLINE: softDecline.length, FINAL_DECLINE: finalDecline.length, FINAL_APPROVE: finalApprove.length, TOTAL: allLeads.length },
      softApproveLeads: softApprove,
      softDeclineLeads: softDecline
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug endpoint to inspect all KIWI lead statuses in DB
app.get('/api/debug/kiwi-leads', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT id, urn, full_name, phone, mis_status, mis_data
      FROM leads
      WHERE (card_bank ILIKE '%KIWI%' OR mis_data->>'mis_bank_name' ILIKE '%KIWI%' OR (mis_data->>'kiwi_winning_bank' IS NOT NULL AND mis_data->>'kiwi_winning_bank' != '') OR card_name ILIKE '%KIWI%' OR landing_page ILIKE '%KIWI%' OR landing_page ILIKE '%GOKIWI%' OR utm_source ILIKE '%KIWI%' OR utm_source ILIKE '%GOKIWI%')
    `;
    const result = await db.pool.query(query);
    const inspectList = result.rows.map(l => {
      let md = l.mis_data;
      if (typeof md === 'string') { try { md = JSON.parse(md); } catch (e) {} }
      md = md || {};
      const cat = metaAudienceService.getNormalizedStatusCategory ? metaAudienceService.getNormalizedStatusCategory(l.mis_status, l.mis_data) : null;
      return {
        id: l.id,
        urn: l.urn,
        name: l.full_name,
        mis_status: l.mis_status,
        calculated_category: cat,
        card_created: md.card_created || md.Card_Created || null,
        card_activation_status: md.card_activation_status || null,
        current_state: md.current_state || null,
        winning_state: md.winning_state || null,
        yes_state: md.yes_state || null,
        au_state: md.au_state || null,
        pnb_state: md.pnb_state || null,
        first_txn: md.first_txn || null
      };
    });

    const categoriesCount = {};
    inspectList.forEach(item => {
      const c = item.calculated_category || 'UNCLASSIFIED';
      categoriesCount[c] = (categoriesCount[c] || 0) + 1;
    });

    res.json({ total: inspectList.length, categoriesCount, leads: inspectList });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Meta Connection Status Check
app.get('/api/meta/config/status', authenticateToken, async (req, res) => {
  try {
    const settings = await db.getSettings();
    const connResult = await metaAudienceService.testMetaConnection();
    
    let rawToken = settings.meta_access_token || process.env.META_ACCESS_TOKEN || '';
    if (!rawToken || !rawToken.startsWith('EAAVeOgE') || rawToken.includes('*') || rawToken.length < 50) {
      rawToken = 'EAAVeOgEkwUQBR0suCgkJqWVJSi84GUu8QcWZCy0bNv7jBO5tQ3RmhGt9BzmJgiZBwNcwVoYtrucvrDKlyfa1ZB0ibFjMa7HHZA2Xbm8yzO7fPuz9iZA3ZCMnSzVcLdauBZC8GyNRO3pxemOOlzvlb8Y2bJHIA8MoDGwDOGxrpbK9UUZBooPPCWzKrZBwbq5n2H9MvSQZDZD';
    }
    const maskedToken = `${rawToken.substring(0, 8)}************${rawToken.slice(-6)}`;

    res.json({
      success: true,
      connected: connResult.connected,
      meta_pixel_id: settings.meta_pixel_id || process.env.META_PIXEL_ID || '1015546961540665',
      meta_ad_account_id: (settings.meta_ad_account_id && !settings.meta_ad_account_id.includes('145081')) ? settings.meta_ad_account_id : 'act_1450840068922146',
      meta_api_version: settings.meta_api_version || process.env.META_API_VERSION || 'v20.0',
      meta_access_token_masked: maskedToken,
      meta_test_event_code: settings.meta_test_event_code || process.env.META_TEST_EVENT_CODE || '',
      adAccountName: connResult.adAccountName || null,
      error: connResult.error || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Meta Configuration Credentials (Developer Admin Only)
app.patch('/api/meta/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { meta_pixel_id, meta_ad_account_id, meta_access_token, meta_api_version, meta_test_event_code } = req.body;

    if (meta_pixel_id !== undefined) await db.setSetting('meta_pixel_id', String(meta_pixel_id).trim());
    if (meta_ad_account_id !== undefined) await db.setSetting('meta_ad_account_id', String(meta_ad_account_id).trim());
    if (meta_access_token !== undefined && !String(meta_access_token).includes('*') && !String(meta_access_token).includes('...') && String(meta_access_token).trim().length > 50) {
      await db.setSetting('meta_access_token', String(meta_access_token).trim());
    }
    if (meta_api_version !== undefined) await db.setSetting('meta_api_version', String(meta_api_version).trim());
    if (meta_test_event_code !== undefined) await db.setSetting('meta_test_event_code', String(meta_test_event_code).trim());

    await db.insertAudienceAuditLog({
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'META_CONFIG_UPDATED'
    });

    const connResult = await metaAudienceService.testMetaConnection();
    res.json({ success: true, connected: connResult.connected, connection: connResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test Meta API Connection Endpoint
app.post('/api/meta/test-connection', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const connResult = await metaAudienceService.testMetaConnection();
    res.json(connResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to decrypt WhatsApp Flow encrypted payload (Asymmetric Private/Public key format)
function decryptWhatsAppFlowPayload(body, privateKeyPEM, req) {
  if (!body || !body.encrypted_flow_data || !body.encrypted_aes_key || !body.initial_vector) {
    return body;
  }
  
  if (!privateKeyPEM) {
    throw new Error('Asymmetric decryption requested but private key is not configured in settings.');
  }

  try {
    const encryptedAesKeyBuf = Buffer.from(body.encrypted_aes_key, 'base64');
    const encryptedFlowDataBuf = Buffer.from(body.encrypted_flow_data, 'base64');
    const ivBuf = Buffer.from(body.initial_vector, 'base64');

    // 1. Decrypt the AES Key with RSA Private Key
    const decryptedAesKey = crypto.privateDecrypt(
      {
        key: privateKeyPEM,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      encryptedAesKeyBuf
    );

    // 2. Decrypt the Flow Data with AES-GCM
    const tagLen = 16;
    const ciphertext = encryptedFlowDataBuf.subarray(0, encryptedFlowDataBuf.length - tagLen);
    const tag = encryptedFlowDataBuf.subarray(encryptedFlowDataBuf.length - tagLen);

    const decipher = crypto.createDecipheriv('aes-128-gcm', decryptedAesKey, ivBuf);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, 'binary', 'utf8');
    decrypted += decipher.final('utf8');

    if (req) {
      req.whatsappFlowAesKey = decryptedAesKey;
      req.whatsappFlowOriginalIv = ivBuf;
      req.isWhatsAppFlowEncrypted = true;
    }

    return JSON.parse(decrypted);
  } catch (err) {
    console.error('[WhatsApp Flow Decryption] SHA-256 decryption failed, trying SHA-1 fallback:', err.message);
    try {
      const encryptedAesKeyBuf = Buffer.from(body.encrypted_aes_key, 'base64');
      const encryptedFlowDataBuf = Buffer.from(body.encrypted_flow_data, 'base64');
      const ivBuf = Buffer.from(body.initial_vector, 'base64');

      const decryptedAesKey = crypto.privateDecrypt(
        {
          key: privateKeyPEM,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha1'
        },
        encryptedAesKeyBuf
      );

      const tagLen = 16;
      const ciphertext = encryptedFlowDataBuf.subarray(0, encryptedFlowDataBuf.length - tagLen);
      const tag = encryptedFlowDataBuf.subarray(encryptedFlowDataBuf.length - tagLen);

      const decipher = crypto.createDecipheriv('aes-128-gcm', decryptedAesKey, ivBuf);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(ciphertext, 'binary', 'utf8');
      decrypted += decipher.final('utf8');

      if (req) {
        req.whatsappFlowAesKey = decryptedAesKey;
        req.whatsappFlowOriginalIv = ivBuf;
        req.isWhatsAppFlowEncrypted = true;
      }

      return JSON.parse(decrypted);
    } catch (fallbackErr) {
      console.error('[WhatsApp Flow Decryption] Both SHA-256 and SHA-1 decryptions failed:', fallbackErr.message);
      throw new Error('Failed to decrypt WhatsApp Flow payload: ' + fallbackErr.message);
    }
  }
}

// Helper to encrypt WhatsApp Flow response payload using AES-128-GCM and inverting the IV
function encryptWhatsAppFlowResponse(responsePayload, aesKey, originalIv) {
  try {
    const iv = Buffer.alloc(originalIv.length);
    for (let i = 0; i < originalIv.length; i++) {
      iv[i] = ~originalIv[i]; // Bitwise NOT on each byte of the IV
    }

    const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(responsePayload), 'utf8'),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([encrypted, authTag]).toString('base64');
  } catch (err) {
    console.error('[WhatsApp Flow Response Encryption Failed]:', err.message);
    throw err;
  }
}

// WhatsApp Flow API Decryption & Lead Ingestion Webhook
app.post('/api/whatsapp/flow-endpoint', async (req, res) => {
  try {
    const settings = await db.getSettings();
    const flowApiKey = settings.whatsapp_flow_api_key;
    const privateKeyPEM = settings.whatsapp_flow_private_key;

    let providedApiKey = req.headers['x-api-key'] || req.headers['X-API-Key'] || req.query.api_key;
    if (!providedApiKey && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      providedApiKey = req.headers.authorization.substring(7).trim();
    }
    const isEncryptedPayload = req.body && req.body.encrypted_flow_data;

    let authorized = false;
    let decryptedBody = null;

    // 1. Check API Key
    if (flowApiKey && providedApiKey === flowApiKey) {
      authorized = true;
    }

    // 2. Decrypt with Private Key if encrypted
    if (!authorized && isEncryptedPayload) {
      if (!privateKeyPEM) {
        return res.status(401).json({ error: 'Unauthorized: Missing encryption credentials or API Key.' });
      }
      try {
        decryptedBody = decryptWhatsAppFlowPayload(req.body, privateKeyPEM, req);
        authorized = true;
      } catch (decryptionErr) {
        console.error('[WhatsApp Flow Webhook] Decryption failure:', decryptionErr.message);
        return res.status(401).json({ error: 'Unauthorized: Decryption of Flow payload failed.' });
      }
    }

    // 3. Fallback unauthorized
    if (!authorized) {
      return res.status(401).json({ error: 'Unauthorized: Invalid API Key or signature validation failed.' });
    }

    const body = decryptedBody || req.body;
    console.log('[WhatsApp Flow Endpoint] Received payload:', JSON.stringify(body));

    // Helper to send response (encrypting it if request was encrypted)
    const sendResponse = (statusCode, dataObj) => {
      if (req.isWhatsAppFlowEncrypted && req.whatsappFlowAesKey && req.whatsappFlowOriginalIv) {
        try {
          const encryptedString = encryptWhatsAppFlowResponse(dataObj, req.whatsappFlowAesKey, req.whatsappFlowOriginalIv);
          return res.status(statusCode).send(encryptedString);
        } catch (encErr) {
          console.error('[WhatsApp Flow Send Response Encryption Error]:', encErr.message);
          return res.status(500).json({ error: 'Encryption of response failed.' });
        }
      } else {
        return res.status(statusCode).json(dataObj);
      }
    };

    // Handle health check / ping check from Meta Flow publisher
    const isPing = body && (body.action === 'ping' || (body.data && body.data.action === 'ping'));
    if (isPing) {
      return sendResponse(200, {
        data: {
          status: 'active'
        }
      });
    }

    const rawName = body.full_name || body.user_name || body.name || body.userName || '';
    const rawPhone = body.phone || body.user_phone || body.mobile || body.phone_number || '';
    const rawEmail = body.email || body.user_email || body.email_address || '';
    
    const pan_no = body.pan || body.pan_no || body.user_pan || body.panNo || null;
    const dob = body.dob || body.date_of_birth || body.user_dob || null;
    const mother_name = body.mother_name || body.motherName || body.user_mother || null;
    const current_address = body.current_address || body.address || body.user_address || null;
    const pincode = body.pincode || body.pin || body.user_pincode || null;
    const landmark = body.landmark || null;
    const city = body.city || null;
    const state = body.state || null;
    const employment = body.employment || body.employment_type || null;
    const designation = body.designation || null;
    const company_name = body.company_name || body.company || body.employer || null;
    
    const trimmedName = rawName ? String(rawName).trim() : '';
    const trimmedEmail = rawEmail ? String(rawEmail).trim() : '';

    let cleanedPhone = rawPhone ? String(rawPhone).replace(/[^\d]/g, '') : '';
    if (cleanedPhone.length > 10) {
      if (cleanedPhone.startsWith('91')) {
        cleanedPhone = cleanedPhone.substring(2);
      } else if (cleanedPhone.startsWith('0')) {
        cleanedPhone = cleanedPhone.substring(1);
      }
    }
    const trimmedPhone = cleanedPhone.slice(-10);

    if (!trimmedName || !trimmedPhone || !trimmedEmail) {
      return sendResponse(400, { error: 'Missing required lead details (name, phone, or email).' });
    }

    if (trimmedPhone.length !== 10 || !/^\d+$/.test(trimmedPhone)) {
      return sendResponse(400, { error: 'Mobile number must be exactly 10 digits.' });
    }

    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      return sendResponse(400, { error: 'Please enter a valid email address.' });
    }

    const leadData = {
      full_name: trimmedName,
      phone: trimmedPhone,
      email: trimmedEmail,
      city: city || null,
      employment: employment || null,
      card_name: 'WhatsApp Flow Lead',
      card_bank: 'META',
      source: 'WhatsApp Flow',
      consent: true,
      pincode: pincode || null,
      pan_no: pan_no ? String(pan_no).trim().toUpperCase() : null,
      dob: dob || null,
      mother_name: mother_name || null,
      current_address: current_address || null,
      state: state || null,
      landmark: landmark || null,
      designation: designation || null,
      company_name: company_name || null,
      ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress || null,
      user_agent: req.headers['user-agent'] || null,
      utm_source: body.utm_source || 'whatsapp',
      utm_medium: body.utm_medium || 'flow',
      utm_campaign: body.utm_campaign || null
    };

    const newLead = await db.addLead(leadData);

    // Real-time broadcast notification of a new lead!
    broadcast({ type: 'LEAD_ADDED', data: newLead });

    try {
      const qdeMsg = `Your WhatsApp Flow lead application (URN: ${newLead.urn}) has been recorded successfully.`;
      const gateway = settings.whatsapp_gateway || 'meta';
      if (gateway === 'baileys') {
        await baileys.sendMessage(trimmedPhone, `Thank you ${trimmedName}! ${qdeMsg}`).catch(() => {});
      } else {
        await sendWhatsAppTemplate(trimmedPhone, 'finmantra_welcome', [trimmedName, qdeMsg]).catch(() => {});
      }
    } catch (waErr) {
      console.error('[WhatsApp Flow Endpoint WA Trigger Error]', waErr.message);
    }

    try {
      if (settings.meta_pixel_id && settings.meta_access_token) {
        const eventData = {
          event_name: 'Lead',
          event_time: Math.floor(Date.now() / 1000),
          user_data: {
            ph: [crypto.createHash('sha256').update(trimmedPhone).digest('hex')],
            em: [crypto.createHash('sha256').update(trimmedEmail.toLowerCase()).digest('hex')],
            fn: [crypto.createHash('sha256').update(trimmedName.split(' ')[0].toLowerCase()).digest('hex')]
          },
          custom_data: {
            currency: 'INR',
            value: 0.00
          },
          event_source_url: `https://${req.hostname}/api/whatsapp/flow-endpoint`,
          action_source: 'system_generated'
        };
        metaAudienceService.sendMetaCapiEvent(eventData).catch(() => {});
      }
    } catch (capiErr) {
      console.error('[WhatsApp Flow Endpoint CAPI Error]', capiErr.message);
    }

    return sendResponse(200, {
      status: 'success',
      message: 'Lead received and processed successfully',
      urn: newLead.urn,
      id: newLead.id
    });

  } catch (err) {
    console.error('[WhatsApp Flow Endpoint Error]:', err);
    return res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  }
});

// --- CAMPAIGNS & BROADCASTS API ENDPOINTS & SCHEDULER ---

const nodemailer = require('nodemailer');

// Dynamically create nodemailer transporter using SMTP settings in DB
async function getEmailTransporter() {
  const settings = await db.getSettings();
  const host = settings.campaign_smtp_host;
  const port = parseInt(settings.campaign_smtp_port, 10);
  const user = settings.campaign_smtp_user;
  const pass = settings.campaign_smtp_pass;
  const secure = settings.campaign_smtp_secure === 'true';

  if (!host || !port || !user || !pass) {
    console.log('[Email Campaigns] SMTP settings not configured. Running in mock/simulation mode.');
    return null; // Fallback to mock mode
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    }
  });
}

// Background scheduler function
async function checkAndRunScheduledBroadcasts() {
  try {
    const scheduled = await db.getScheduledBroadcastsToRun();
    if (scheduled.length === 0) return;

    console.log(`[Campaign Scheduler] Found ${scheduled.length} scheduled broadcasts to run.`);
    const settings = await db.getSettings();
    const fromEmail = settings.campaign_smtp_from_email || 'no-reply@finmantra.com';
    const fromName = settings.campaign_smtp_from_name || 'FinMantra';

    for (const b of scheduled) {
      // 1. Mark as processing
      await db.updateCampaignBroadcastStatus(b.id, 'processing');
      console.log(`[Campaign Scheduler] Started processing broadcast: "${b.name}" (ID: ${b.id})`);

      // 2. Fetch leads
      const leads = await db.getCampaignLeads(b.campaign_id);
      let sentCount = 0;
      let failedCount = 0;

      const transporter = await getEmailTransporter();

      for (const lead of leads) {
        let emailSuccess = true;
        let waSuccess = true;
        let emailError = null;
        let waError = null;

        // Perform dynamic replacements for {name}, {contact}, {mail}, {address}
        const replacePlaceholders = (text) => {
          if (!text) return '';
          return text
            .replace(/{name}/gi, lead.name || '')
            .replace(/{contact}/gi, lead.contact || '')
            .replace(/{mail}/gi, lead.mail || '')
            .replace(/{address}/gi, lead.address || '');
        };

        // --- EMAIL CHANNEL ---
        if (b.channel === 'email' || b.channel === 'both') {
          const subject = replacePlaceholders(b.email_subject || 'FinMantra Campaign');
          const body = replacePlaceholders(b.email_body || '');
          
          if (transporter) {
            try {
              await transporter.sendMail({
                from: `"${fromName}" <${fromEmail}>`,
                to: lead.mail,
                subject,
                html: body.replace(/\n/g, '<br/>')
              });
            } catch (err) {
              emailSuccess = false;
              emailError = err.message;
            }
          } else {
            console.log(`[Simulated Email] Sent to ${lead.mail} with subject "${subject}"`);
          }

          const logId = 'log_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
          await db.logCampaignBroadcastDelivery(
            logId,
            b.id,
            lead.id,
            'email',
            emailSuccess ? 'sent' : 'failed',
            emailError
          );
        }

        // --- WHATSAPP CHANNEL ---
        if (b.channel === 'whatsapp' || b.channel === 'both') {
          const waMessage = replacePlaceholders(b.whatsapp_message || '');
          
          try {
            if (b.whatsapp_template) {
              const params = [lead.name, waMessage];
              await sendWhatsAppTemplate(lead.contact, b.whatsapp_template, params, false, b.media_url);
            } else {
              const gateway = settings.whatsapp_gateway || 'baileys';
              if (gateway === 'baileys') {
                const status = baileys.getBaileysStatus();
                if (status.status === 'CONNECTED') {
                  await baileys.sendBaileysMessage(lead.contact, waMessage);
                } else {
                  throw new Error('Baileys WhatsApp device is not connected.');
                }
              } else {
                throw new Error('Meta Graph API requires template. Free-text WhatsApp is only supported via Baileys linked device.');
              }
            }
          } catch (err) {
            waSuccess = false;
            waError = err.message;
          }

          const logId = 'log_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
          await db.logCampaignBroadcastDelivery(
            logId,
            b.id,
            lead.id,
            'whatsapp',
            waSuccess ? 'sent' : 'failed',
            waError
          );
        }

        if (emailSuccess && waSuccess) {
          sentCount++;
        } else {
          failedCount++;
        }
      }

      const finalStatus = failedCount === leads.length ? 'failed' : 'sent';
      await db.updateCampaignBroadcastStatus(b.id, finalStatus, sentCount, failedCount);
      console.log(`[Campaign Scheduler] Completed broadcast: "${b.name}". Sent: ${sentCount}, Failed: ${failedCount}`);

      // Create system notification
      try {
        await db.createNotification({
          type: finalStatus === 'sent' ? 'success' : 'error',
          title: finalStatus === 'sent' ? 'Campaign Broadcast Sent' : 'Campaign Broadcast Failed',
          message: `Broadcast "${b.name}" finished. Channel: ${b.channel}. Sent: ${sentCount}, Failed: ${failedCount}.`,
          details: { broadcastId: b.id, campaignId: b.campaign_id }
        });
        broadcast({ type: 'NOTIFICATION_CREATED' });
      } catch (notifErr) {
        console.error('[Campaign Scheduler Notification Error]', notifErr);
      }
    }
  } catch (err) {
    console.error('[Campaign Scheduler Exception]:', err);
  }
}

// Helper to register message template with Meta API
const registerMetaTemplate = async ({ apiKey, wabaId, name, category, language, headerFormat, bodyText }) => {
  return new Promise((resolve, reject) => {
    const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const components = [];
    
    if (headerFormat && headerFormat !== 'NONE') {
      const headerComp = {
        type: 'HEADER',
        format: headerFormat.toUpperCase()
      };
      if (headerFormat === 'TEXT') {
        headerComp.text = 'Notification';
      }
      components.push(headerComp);
    }
    
    components.push({
      type: 'BODY',
      text: bodyText
    });
    
    const payload = {
      name: cleanName,
      language: language || 'en_US',
      category: category || 'MARKETING',
      components
    };
    
    const postData = JSON.stringify(payload);
    const options = {
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/v25.0/${wabaId}/message_templates`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(responseBody)); } catch (e) { resolve({ success: true }); }
        } else {
          reject(new Error(`Meta Template API rejected request (status ${res.statusCode}): ${responseBody}`));
        }
      });
    });
    
    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
};

// --- CAMPAIGN REUSABLE TEMPLATES ROUTES ---

// Sync and fetch template approval status from Meta
app.get('/api/campaigns/templates/meta-sync', authenticateToken, async (req, res) => {
  try {
    const settings = await db.getSettings();
    const apiKey = getSettingVal(settings, 'wa_api_key', 'WA_API_KEY');
    let wabaId = getSettingVal(settings, 'wa_business_account_id', 'WA_BUSINESS_ACCOUNT_ID');
    const apiVersion = getSettingVal(settings, 'wa_api_version', 'WA_API_VERSION', 'v25.0');
    
    if (!apiKey) {
      return res.json({ success: true, metaStatuses: {} });
    }

    if (!wabaId || wabaId === 'undefined' || wabaId === 'null') {
      const fetchWabas = async () => {
        return new Promise((resolveWaba, rejectWaba) => {
          const options = {
            hostname: 'graph.facebook.com',
            port: 443,
            path: `/${apiVersion}/me/whatsapp_business_accounts`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` }
          };
          const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                  const parsed = JSON.parse(body);
                  if (parsed.data && parsed.data.length > 0) {
                    resolveWaba(parsed.data[0].id);
                  } else {
                    resolveWaba(null);
                  }
                } catch (e) { resolveWaba(null); }
              } else { resolveWaba(null); }
            });
          });
          req.on('error', () => resolveWaba(null));
          req.end();
        });
      };
      wabaId = await fetchWabas();
    }

    if (!wabaId) {
      return res.json({ success: true, metaStatuses: {} });
    }

    const fetchMetaTemplates = () => {
      return new Promise((resolve, reject) => {
        const options = {
          hostname: 'graph.facebook.com',
          port: 443,
          path: `/${apiVersion}/${wabaId}/message_templates?limit=100`,
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}` }
        };
        const req = https.request(options, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Invalid JSON.')); }
            } else { reject(new Error(`Meta API error ${res.statusCode}: ${body}`)); }
          });
        });
        req.on('error', err => reject(err));
        req.end();
      });
    };

    const result = await fetchMetaTemplates();
    const metaStatuses = {};
    if (result && Array.isArray(result.data)) {
      for (const t of result.data) {
        metaStatuses[t.name.toLowerCase()] = {
          status: t.status,
          category: t.category,
          language: t.language
        };
      }
    }
    res.json({ success: true, metaStatuses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List all campaign templates
app.get('/api/campaigns/templates', authenticateToken, async (req, res) => {
  try {
    const list = await db.getCampaignTemplates();
    res.json({ success: true, templates: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create/Update a template
app.post('/api/campaigns/templates', authenticateToken, async (req, res) => {
  try {
    const { id, name, type, subject, body, metaTemplateName, mediaUrl, category, language, headerFormat } = req.body;
    if (!name || !type || !body) {
      return res.status(400).json({ success: false, error: 'Name, Type and Body are required fields.' });
    }

    // Register template directly to Meta WhatsApp Business Account if type is whatsapp
    if (type === 'whatsapp') {
      const cleanName = metaTemplateName ? metaTemplateName.toLowerCase().replace(/[^a-z0-9_]/g, '_') : name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const settings = await db.getSettings();
      const apiKey = getSettingVal(settings, 'wa_api_key', 'WA_API_KEY');
      let wabaId = getSettingVal(settings, 'wa_business_account_id', 'WA_BUSINESS_ACCOUNT_ID');
      const apiVersion = getSettingVal(settings, 'wa_api_version', 'WA_API_VERSION', 'v25.0');
      
      if (!apiKey) {
        return res.status(400).json({ success: false, error: 'Meta WhatsApp API Credentials are not configured. Please setup WA_API_KEY first.' });
      }

      if (!wabaId || wabaId === 'undefined' || wabaId === 'null') {
        const fetchWabas = async () => {
          return new Promise((resolveWaba, rejectWaba) => {
            const options = {
              hostname: 'graph.facebook.com',
              port: 443,
              path: `/${apiVersion}/me/whatsapp_business_accounts`,
              method: 'GET',
              headers: { 'Authorization': `Bearer ${apiKey}` }
            };
            const req = https.request(options, (res) => {
              let responseBody = '';
              res.on('data', chunk => responseBody += chunk);
              res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                  try {
                    const parsed = JSON.parse(responseBody);
                    if (parsed.data && parsed.data.length > 0) {
                      resolveWaba(parsed.data[0].id);
                    } else {
                      rejectWaba(new Error('No WhatsApp Business Accounts found.'));
                    }
                  } catch (e) { rejectWaba(new Error('WABA JSON parsing failed.')); }
                } else { rejectWaba(new Error(`Failed to fetch WABA (status ${res.statusCode})`)); }
              });
            });
            req.on('error', err => rejectWaba(err));
            req.end();
          });
        };
        try {
          wabaId = await fetchWabas();
        } catch (wabaErr) {
          return res.status(400).json({ success: false, error: `WABA Account lookup failed: ${wabaErr.message}` });
        }
      }

      try {
        await registerMetaTemplate({
          apiKey,
          wabaId,
          name: cleanName,
          category: category || 'MARKETING',
          language: language || 'en_US',
          headerFormat: headerFormat || 'NONE',
          bodyText: body
        });
      } catch (metaErr) {
        return res.status(400).json({
          success: false,
          error: `Meta rejected template registration: ${metaErr.message}. Make sure template name is unique, contains only lowercase letters and underscores, and body variables are formatted properly (e.g. {{1}}).`
        });
      }
    }

    const templateId = id || 'tpl_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const saved = await db.createCampaignTemplate({
      id: templateId,
      name,
      type,
      subject: subject || null,
      body,
      metaTemplateName: metaTemplateName ? metaTemplateName.toLowerCase().replace(/[^a-z0-9_]/g, '_') : null,
      mediaUrl: mediaUrl || null
    });
    res.json({ success: true, template: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a template
app.delete('/api/campaigns/templates/:templateId', authenticateToken, async (req, res) => {
  try {
    const deleted = await db.deleteCampaignTemplate(req.params.templateId);
    res.json({ success: true, template: deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- MASTER DATA CENTER ROUTES ---

// List master leads
app.get('/api/campaigns/master/leads', authenticateToken, async (req, res) => {
  try {
    const list = await db.getMasterLeads();
    res.json({ success: true, leads: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload master leads via Excel/CSV
app.post('/api/campaigns/master/leads/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No Excel/CSV file uploaded.' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Spreadsheet has no rows.' });
    }

    // Fetch existing master contacts to check for duplicates
    const existingLeads = await db.getMasterLeads();
    const existingPhones = new Set(existingLeads.map(l => l.contact));
    const existingEmails = new Set(existingLeads.map(l => l.mail.toLowerCase().trim()));

    // Track duplicates within the uploaded file itself
    const sheetPhones = new Set();
    const sheetEmails = new Set();

    const leads = [];
    let rejectedCount = 0;
    const errors = [];

    rows.forEach((r, idx) => {
      const rowNum = idx + 2;
      const name = (r['Name'] || r['name'] || r['Full Name'] || r['full_name'] || '').toString().trim();
      const rawContact = (r['Contact'] || r['contact'] || r['Phone'] || r['phone'] || r['Mobile'] || r['mobile'] || '').toString().trim();
      const contact = rawContact.replace(/\D/g, '');
      const mail = (r['Mail'] || r['mail'] || r['Email'] || r['email'] || '').toString().trim();
      const address = (r['Address'] || r['address'] || '').toString().trim();

      if (!name) {
        rejectedCount++;
        errors.push(`Row ${rowNum}: Name is missing.`);
        return;
      }
      if (!contact || contact.length < 10) {
        rejectedCount++;
        errors.push(`Row ${rowNum} (${name}): Contact number is missing or invalid.`);
        return;
      }
      if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
        rejectedCount++;
        errors.push(`Row ${rowNum} (${name}): Email address is missing or invalid format.`);
        return;
      }

      // Check duplicates
      const mailKey = mail.toLowerCase().trim();
      if (existingPhones.has(contact) || sheetPhones.has(contact)) {
        rejectedCount++;
        errors.push(`Row ${rowNum} (${name}): Contact phone number already exists in Master Data Center.`);
        return;
      }
      if (existingEmails.has(mailKey) || sheetEmails.has(mailKey)) {
        rejectedCount++;
        errors.push(`Row ${rowNum} (${name}): Email address already exists in Master Data Center.`);
        return;
      }

      sheetPhones.add(contact);
      sheetEmails.add(mailKey);

      leads.push({
        id: 'ml_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6) + '_' + idx,
        name,
        contact,
        mail,
        address
      });
    });

    if (leads.length > 0) {
      await db.addMasterLeads(leads);
    }

    res.json({
      success: true,
      insertedCount: leads.length,
      rejectedCount,
      errors
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete master lead
app.delete('/api/campaigns/master/leads/:leadId', authenticateToken, async (req, res) => {
  try {
    const deleted = await db.deleteMasterLead(req.params.leadId);
    res.json({ success: true, lead: deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bulk delete master leads
app.post('/api/campaigns/master/leads/delete-bulk', authenticateToken, async (req, res) => {
  try {
    const { leadIds } = req.body;
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No contact IDs selected for deletion.' });
    }
    const count = await db.deleteMasterLeadsBulk(leadIds);
    res.json({ success: true, deletedCount: count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Import master leads to a specific campaign
app.post('/api/campaigns/:id/leads/import-master', authenticateToken, async (req, res) => {
  try {
    const campaignId = req.params.id;
    const { leadIds } = req.body;
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No contact IDs selected for import.' });
    }
    const count = await db.importMasterLeadsToCampaign(campaignId, leadIds);
    res.json({ success: true, importedCount: count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List campaigns
app.get('/api/campaigns', authenticateToken, async (req, res) => {
  try {
    const list = await db.getCampaigns();
    res.json({ success: true, campaigns: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create campaign
app.post('/api/campaigns', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Campaign name is required.' });
    }

    // Enforce unique campaign names constraint
    const existing = await db.runQuery("SELECT * FROM campaigns WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))", [name]);
    if (existing.rows && existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'A campaign with this name already exists. Please choose a unique name.' });
    }

    const id = 'camp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const newCamp = await db.createCampaign(id, name, description);
    res.json({ success: true, campaign: newCamp });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete campaign
app.delete('/api/campaigns/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await db.deleteCampaign(req.params.id);
    res.json({ success: true, campaign: deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List campaign leads/contacts
app.get('/api/campaigns/:id/leads', authenticateToken, async (req, res) => {
  try {
    const list = await db.getCampaignLeads(req.params.id);
    res.json({ success: true, leads: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload campaign leads via Excel/CSV
app.post('/api/campaigns/:id/leads/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No Excel/CSV file uploaded.' });
  }

  try {
    const campaignId = req.params.id;
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Spreadsheet has no rows.' });
    }

    // Fetch existing contacts in the campaign to prevent duplicates
    const existingLeads = await db.getCampaignLeads(campaignId);
    const existingPhones = new Set(existingLeads.map(l => l.contact));
    const existingEmails = new Set(existingLeads.map(l => l.mail.toLowerCase().trim()));

    // Track duplicates within the uploaded file itself
    const sheetPhones = new Set();
    const sheetEmails = new Set();

    const leads = [];
    let rejectedCount = 0;
    const errors = [];

    rows.forEach((r, idx) => {
      const rowNum = idx + 2;
      const name = (r['Name'] || r['name'] || r['Full Name'] || r['full_name'] || '').toString().trim();
      const rawContact = (r['Contact'] || r['contact'] || r['Phone'] || r['phone'] || r['Mobile'] || r['mobile'] || '').toString().trim();
      const contact = rawContact.replace(/\D/g, '');
      const mail = (r['Mail'] || r['mail'] || r['Email'] || r['email'] || '').toString().trim();
      const address = (r['Address'] || r['address'] || '').toString().trim();

      if (!name) {
        rejectedCount++;
        errors.push(`Row ${rowNum}: Name is missing.`);
        return;
      }
      if (!contact || contact.length < 10) {
        rejectedCount++;
        errors.push(`Row ${rowNum} (${name}): Contact number is missing or invalid.`);
        return;
      }
      if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
        rejectedCount++;
        errors.push(`Row ${rowNum} (${name}): Email address is missing or invalid format.`);
        return;
      }

      // Check duplicates
      const mailKey = mail.toLowerCase().trim();
      if (existingPhones.has(contact) || sheetPhones.has(contact)) {
        rejectedCount++;
        errors.push(`Row ${rowNum} (${name}): Contact phone number already exists in this campaign.`);
        return;
      }
      if (existingEmails.has(mailKey) || sheetEmails.has(mailKey)) {
        rejectedCount++;
        errors.push(`Row ${rowNum} (${name}): Email address already exists in this campaign.`);
        return;
      }

      sheetPhones.add(contact);
      sheetEmails.add(mailKey);

      leads.push({
        id: 'cl_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6) + '_' + idx,
        campaign_id: campaignId,
        name,
        contact,
        mail,
        address
      });
    });

    if (leads.length > 0) {
      await db.addCampaignLeads(leads);
    }

    res.json({
      success: true,
      created: leads.length,
      failed: rejectedCount,
      errors
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete lead
app.delete('/api/campaigns/:id/leads/:leadId', authenticateToken, async (req, res) => {
  try {
    const deleted = await db.deleteCampaignLead(req.params.leadId);
    res.json({ success: true, lead: deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List broadcasts under a campaign
app.get('/api/campaigns/:id/broadcasts', authenticateToken, async (req, res) => {
  try {
    const list = await db.getCampaignBroadcasts(req.params.id);
    res.json({ success: true, broadcasts: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create campaign broadcast (draft or scheduled)
app.post('/api/campaigns/:id/broadcasts', authenticateToken, async (req, res) => {
  try {
    const campaignId = req.params.id;
    const { name, channel, whatsappTemplate, whatsappMessage, emailSubject, emailBody, scheduledAt, mediaUrl } = req.body;
    
    if (!name || !channel) {
      return res.status(400).json({ success: false, error: 'Broadcast Name and Channel are required.' });
    }

    const leads = await db.getCampaignLeads(campaignId);
    const targetedCount = leads.length;

    const id = 'bc_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const newBroadcast = await db.createCampaignBroadcast(
      id,
      campaignId,
      name,
      channel,
      whatsappTemplate || null,
      whatsappMessage || null,
      emailSubject || null,
      emailBody || null,
      targetedCount,
      scheduledAt ? new Date(scheduledAt) : null,
      mediaUrl || null
    );

    res.json({ success: true, broadcast: newBroadcast });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger broadcast immediately (manually)
app.post('/api/campaigns/:id/broadcasts/:broadcastId/trigger', authenticateToken, async (req, res) => {
  try {
    const { broadcastId } = req.params;
    const b = await db.getCampaignBroadcastById(broadcastId);
    if (!b) {
      return res.status(404).json({ success: false, error: 'Broadcast not found.' });
    }

    // Throttle check: Once per hour for successful broadcasts only
    if (b.last_triggered_at && b.last_trigger_status === 'sent') {
      const lastTriggered = new Date(b.last_triggered_at).getTime();
      const now = Date.now();
      const diffMs = now - lastTriggered;
      const oneHourMs = 60 * 60 * 1000;
      if (diffMs < oneHourMs) {
        const remainingMin = Math.ceil((oneHourMs - diffMs) / (60 * 1000));
        return res.status(400).json({
          success: false,
          error: `This successful broadcast was recently triggered. Please wait ${remainingMin} minutes before triggering it again.`
        });
      }
    }

    await db.runQuery(
      `UPDATE campaign_broadcasts 
       SET status = 'scheduled', scheduled_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [broadcastId]
    );

    checkAndRunScheduledBroadcasts().catch(err => console.error('[Manual trigger background run error]', err));

    res.json({ success: true, message: 'Broadcast triggered successfully! Processing started in the background.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete broadcast
app.delete('/api/campaigns/:id/broadcasts/:broadcastId', authenticateToken, async (req, res) => {
  try {
    const deleted = await db.deleteCampaignBroadcast(req.params.broadcastId);
    res.json({ success: true, broadcast: deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get detailed delivery logs for a broadcast
app.get('/api/campaigns/:id/broadcasts/:broadcastId/logs', authenticateToken, async (req, res) => {
  try {
    const list = await db.getCampaignLogs(req.params.broadcastId);
    res.json({ success: true, logs: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Global exception and error handling middleware
app.use((err, req, res, next) => {
  console.error('[Express Async Error Handler Exception]:', err);
  
  // Return formatted JSON instead of HTML crashes
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Database Server Exception',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start Server on http node object
server.listen(PORT, async () => {
  console.log(`FinMantra backend running on port ${PORT}`);
  
  try {
    // Ensure database is fully connected and initialized before serving requests
    await db.init();
    console.log('[Startup] Database initialization completed successfully.');

    // Initialize campaign cron worker checking every 30 seconds
    setInterval(checkAndRunScheduledBroadcasts, 30000);
    console.log('[Startup] Campaigns Scheduled Broadcast daemon started.');

    const settings = await db.getSettings();
    const gateway = settings.whatsapp_gateway || 'baileys';
    if (gateway === 'baileys') {
      console.log('[Startup] WhatsApp gateway is set to Baileys. Initializing socket...');
      await baileys.initBaileys(broadcast);
    } else {
      console.log('[Startup] WhatsApp gateway is set to Meta. Keeping Baileys socket stopped.');
      // Initialize with broadcast to register the handler but keep socket stopped
      await baileys.stopBaileys();
      await baileys.initBaileys(broadcast);
    }

    // Initialize Email MIS Auto-Sync Poller (Runs sequentially to prevent IMAP connection contention)
    const runEmailPollers = async () => {
      try {
        await sbiEmailFetcher.checkAndFetchEmails(broadcast);
      } catch (err) {
        console.error('[SBI Email MIS Poller] Error:', err.message);
      }
      await new Promise(r => setTimeout(r, 4000));
      try {
        await kiwiEmailFetcher.checkAndFetchEmails(broadcast);
      } catch (err) {
        console.error('[KIWI Email MIS Poller] Error:', err.message);
      }
    };

    setTimeout(() => {
      runEmailPollers();
    }, 15000);

    setInterval(() => {
      runEmailPollers();
    }, 2 * 60 * 1000);
  } catch (err) {
    console.error('====================================================================');
    console.error('[Database] WARNING: Server startup failed to initialize database connectivity.');
    console.error('Error message:', err.message);
    console.error('[Startup] Server process is kept alive to prevent 502 Bad Gateway errors.');
    console.error('====================================================================');
  }
});
