const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const http = require('http');
const WebSocket = require('ws');
const db = require('./db');
const baileys = require('./baileys');
const multer = require('multer');
const xlsx = require('xlsx');
const pdfParse = require('pdf-parse');
const upload = multer({ storage: multer.memoryStorage() });

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

const app = express();
app.use(cors());
app.use(express.json());

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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'finMantra@org';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 10);
const LAKSHAY_PASSWORD = process.env.LAKSHAY_PASSWORD || 'Lakshay@123';
const LAKSHAY_PASSWORD_HASH = bcrypt.hashSync(LAKSHAY_PASSWORD, 10);

// loginTracker keeps track of login failures for security brute-force prevention
const loginTracker = {
  failures: {}, // key: IP or username/role -> { count: N, lockUntil: timestamp }
  
  getLockTimeLeft(ip, identity) {
    const now = Date.now();
    const ipRecord = this.failures[ip];
    if (ipRecord && ipRecord.lockUntil > now) {
      return Math.ceil((ipRecord.lockUntil - now) / 1000); // seconds
    }
    const identityRecord = this.failures[identity];
    if (identityRecord && identityRecord.lockUntil > now) {
      return Math.ceil((identityRecord.lockUntil - now) / 1000); // seconds
    }
    return 0;
  },

  recordFailure(ip, identity) {
    const now = Date.now();
    
    // Record for IP
    if (!this.failures[ip]) this.failures[ip] = { count: 0, lockUntil: 0 };
    const ipRec = this.failures[ip];
    if (ipRec.lockUntil <= now) {
      ipRec.count += 1;
      if (ipRec.count >= 3) {
        ipRec.lockUntil = now + 10 * 60 * 1000; // 10 minutes lock
      }
    }

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
    delete this.failures[ip];
    if (identity) {
      delete this.failures[identity];
    }
  },

  getAttemptsLeft(ip, identity) {
    const ipRec = this.failures[ip];
    const identRec = identity ? this.failures[identity] : null;
    const ipCount = ipRec ? ipRec.count : 0;
    const identCount = identRec ? identRec.count : 0;
    const maxCount = Math.max(ipCount, identCount);
    return Math.max(0, 3 - maxCount);
  }
};

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

wss.on('connection', (ws) => {
  wssClients.add(ws);
  console.log(`[WebSocket Server] Client connected. Active clients: ${wssClients.size}`);
  
  // Send welcome check
  ws.send(JSON.stringify({ type: 'WS_CONNECTED', message: 'Sync connection established with FinMantra WebSocket' }));

  ws.on('close', () => {
    wssClients.delete(ws);
    console.log(`[WebSocket Server] Client disconnected. Active clients: ${wssClients.size}`);
  });
});

// Broadcast Helper
function broadcast(messageObj) {
  const payload = JSON.stringify(messageObj);
  for (const client of wssClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// Helper to hash passwords using built-in crypto
function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Helper to safely resolve setting value from DB or process.env
function getSettingVal(settings, key, envKey, defaultVal = null) {
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
async function sendWhatsAppTemplate(toPhone, templateName, parameters = [], isOtpAuth = false) {
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
      const payloadObj = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: lang }
        }
      };
      if (componentStrategies[sIdx].length > 0) {
        payloadObj.template.components = componentStrategies[sIdx];
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

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
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
    loginTracker.recordSuccess(ip, identity);
    const token = jwt.sign({ id: agent.id, name: agent.name, role: 'agent', assigned_bank: agent.assigned_bank }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({
      token,
      role: 'agent',
      agent: { id: agent.id, name: agent.name, email: agent.email, locations: agent.locations, assigned_bank: agent.assigned_bank }
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

// Send server-side event to Meta Conversions API (CAPI)
async function sendMetaCapiEvent(lead, eventName = 'Lead', testEventCode = null) {
  try {
    const settings = await db.getSettings().catch(() => ({}));
    const pixelId = getSettingVal(settings, 'meta_pixel_id', 'META_PIXEL_ID');
    const accessToken = getSettingVal(settings, 'meta_access_token', 'META_ACCESS_TOKEN');

    
    if (!pixelId || !accessToken) {
      console.log('[Meta CAPI] Skipped: META_PIXEL_ID or META_ACCESS_TOKEN not set.');
      return { status: 'skipped', error: 'Missing API credentials' };
    }
    
    // Format phone number to E.164 if possible
    let rawPhone = lead.phone || '';
    rawPhone = rawPhone.replace(/\D/g, '');
    if (rawPhone.length === 10) {
      rawPhone = '91' + rawPhone; // Default country code for India
    }

    const userData = {
      ph: [sha256Hash(rawPhone)],
      em: [sha256Hash(lead.email)],
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

    const payload = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: lead.urn || lead.id,
          event_source_url: lead.landing_page || 'https://finmantra.org/',
          action_source: 'website',
          user_data: userData,
          custom_data: {
            currency: 'INR',
            value: lead.income_range ? parseFloat(lead.income_range.replace(/[^\d.]/g, '')) || 0 : 0,
            content_name: lead.card_name || 'Credit Card Lead',
            content_category: lead.card_bank || 'Financial Services'
          }
        }
      ]
    };

    // Support for Meta CAPI real-time testing console
    const activeTestCode = testEventCode || settings.meta_test_event_code || process.env.META_TEST_EVENT_CODE;
    if (activeTestCode) {
      payload.test_event_code = activeTestCode;
    }

    const url = `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    if (response.ok) {
      console.log(`[Meta CAPI] Event '${eventName}' sent successfully. FB Trace ID: ${data.fb_trace_id}`);
      return { status: 'success', response: data };
    } else {
      console.error(`[Meta CAPI] Failed:`, data);
      return { status: 'failed', response: data };
    }
  } catch (err) {
    console.error(`[Meta CAPI] Network error:`, err);
    return { status: 'failed', error: err.message };
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
    monthly_income,
    pan_no
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

  if (source === 'agent' && card_id) {
    const cards = await db.getCards(true);
    card = cards.find(c => c.id === card_id);
    if (!card) {
      return res.status(404).json({ error: 'Selected credit card not found' });
    }
    redirectUrlTemplate = card.redirect_url_template || '';
  } else {
    let matchedCard = null;
    
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

    if (matchedCard) {
      card = matchedCard;
      redirectUrlTemplate = card.redirect_url_template || '';
    } else {
      const settings = await db.getSettings();
      redirectUrlTemplate = settings.public_redirect_url || '';
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
    income_range: source === 'agent' ? income_range : null,
    card_id: card ? card.id : null,
    card_name: card ? card.name : 'Public Redirection',
    card_bank: card ? card.bank : 'N/A',
    source: source || 'public',
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
    ip_address: (() => {
      let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      if (clientIp.includes(',')) {
        clientIp = clientIp.split(',')[0].trim();
      }
      return clientIp || null;
    })(),
    user_agent: req.headers['user-agent'] || null
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
    .replace(/{utm_creative_format}/gi, encodeURIComponent(utm_creative_format || ''));

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

  // Send WhatsApp Referral Notification with Tracking URL
  const agentCode = (source === 'agent' && agent_id) ? agent_id : 'public';
  const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  
  const settings = await db.getSettings();
  
  // Resolve base URL based on settings or fallback dynamically
  let baseUrl = settings.public_site_url ? settings.public_site_url.trim() : '';
  if (baseUrl) {
    // Strip trailing slash if present
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.substring(0, baseUrl.length - 1);
    }
  } else {
    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol || 'http';
    baseUrl = `${protocol}://${host}`;
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      baseUrl = 'http://localhost:5173';
    }
  }
  
  const referralLink = `${baseUrl}/refer/${agentCode}/${dateCode}/${newLead.urn}`;
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

  // Print simulation output to console in all cases for local testing visibility
  console.log(`=========================================`);
  console.log(`[WhatsApp Referral Link for ${trimmedPhone}]:`);
  console.log(referralMsg);
  console.log(`=========================================`);

  res.json({
    success: true,
    urn: newLead.urn,
    redirectUrl
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
      redirectUrl: lead.redirect_url,
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
      redirectUrl: lead.redirect_url,
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

// Helper to standardise MIS status
function standardizeStatus(statusStr, rawRow) {
  if (!statusStr) return 'Pending';
  const clean = String(statusStr).trim().toLowerCase();
  
  if (clean.includes('approve') || clean.includes('success') || clean.includes('disbursed') || clean.includes('active') || clean === 'approved') {
    return 'Approved';
  }
  if (clean.includes('reject') || clean.includes('decline') || clean.includes('cancel') || clean === 'rejected') {
    return 'Rejected';
  }
  return 'Pending';
}

// Upload MIS Route
app.post('/api/leads/upload-mis', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

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
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      parsedRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
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

  let totalMatched = 0;
  let totalUnmatched = 0;
  const matchedDetails = [];
  const unmatchedDetails = [];
  const updates = [];
  
  const matchedLeadsMap = new Map();
  const unmatchedUrnsSet = new Set();

  for (const row of parsedRows) {
    const excelLc2 = getRowValue(row, 'LC2_CODE') || getRowValue(row, 'urn_last') || getRowValue(row, 'urn');
    
    if (!excelLc2) {
      totalUnmatched++;
      continue;
    }

    const misVal = String(excelLc2).trim();
    const misDateStr = getRowValue(row, 'CREATION_DATE_TIME') || getRowValue(row, 'Application Submit Date/Time');
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

    misData.bank_reference_number = String(getRowValue(row, 'APPLICATION_REFERENCE_NUMBER') || getRowValue(row, 'Bank Reference Number')).trim();
    misData.application_submit_date_time = String(getRowValue(row, 'CREATION_DATE_TIME') || getRowValue(row, 'Application Submit Date/Time')).trim();
    misData.customer_type = String(getRowValue(row, 'CUSTOMER_TYPE') || getRowValue(row, 'Customer Type')).trim();
    misData.state = String(getRowValue(row, 'STATE') || getRowValue(row, 'state')).trim();
    misData.ipa_status = String(getRowValue(row, 'IPA_STATUS') || getRowValue(row, 'IPA Status')).trim();
    misData.dap_final_flag = String(getRowValue(row, 'DAP_FINAL_FLAG') || getRowValue(row, 'DAP Final Flag')).trim();
    misData.dropoff_reason = String(getRowValue(row, 'DROPOFF_REASON') || getRowValue(row, 'DROPOFFREASON')).trim();
    misData.vkyc_status = String(getRowValue(row, 'VKYC_STATUS') || getRowValue(row, 'VKYC STATUS')).trim();
    misData.kyc_type = String(getRowValue(row, 'VKYC_CONSENT_DATE') || getRowValue(row, 'KYC TYPE') || getRowValue(row, 'KYC Success/NR')).trim();
    misData.vkyc_expiry_date = String(getRowValue(row, 'VKYC_EXPIRY_DATE') || getRowValue(row, 'VKYC EXPIRY DATE')).trim();
    misData.promo_code = String(getRowValue(row, 'PROMO_CODE') || getRowValue(row, 'PROMO CODE')).trim();
    misData.final_decision = String(getRowValue(row, 'FINAL_DECISION') || getRowValue(row, 'FINAL DECISION')).trim();
    misData.final_decision_date = String(getRowValue(row, 'FINAL_DECISION_DATE') || getRowValue(row, 'FINAL DECISION DATE')).trim();
    misData.current_stage = String(getRowValue(row, 'CURRENT_STAGE') || getRowValue(row, 'CURRENT STAGE')).trim();
    misData.curable_flag = String(getRowValue(row, 'CURABLE_FLAG') || getRowValue(row, 'CURABLE FLAG')).trim();
    misData.company_name = String(getRowValue(row, 'COMPANY_NAME') || getRowValue(row, 'COMPANY NAME')).trim();
    misData.bkyc_status = String(getRowValue(row, 'BKYC Status') || getRowValue(row, 'BKYC Status')).trim();
    misData.kyc_status = String(getRowValue(row, 'KYC Status') || getRowValue(row, 'KYC Status')).trim();
    misData.decision_month = String(getRowValue(row, 'Decision Month') || getRowValue(row, 'Decision Month')).trim();
    misData.decline_description = String(getRowValue(row, 'Decline Descreption') || getRowValue(row, 'Decline Descreption') || getRowValue(row, 'Remark')).trim();
    misData.decline_type = String(getRowValue(row, 'Decline Type') || getRowValue(row, 'Decline Type')).trim();
    misData.card_name = String(getRowValue(row, 'Product Des') || getRowValue(row, 'Product Description') || getRowValue(row, 'Card Name')).trim();
    misData.card_type = String(getRowValue(row, 'Card Type') || getRowValue(row, 'Card Type')).trim();
    misData.card_activation_status = String(getRowValue(row, 'Card Activation Staus') || getRowValue(row, 'Card Activation Staus')).trim();
    misData.source_type = String(getRowValue(row, 'Source Type') || getRowValue(row, 'Source Type')).trim();
    misData.kyc_completion_date = String(getRowValue(row, 'KYC Completion date') || getRowValue(row, 'KYC Completion date')).trim();

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
        status: standardStatus
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
    await db.bulkUpdateLeadMISStatus(updates);
  }

  res.json({
    success: true,
    totalMatched,
    totalUnmatched,
    matchedDetails,
    unmatchedDetails
  });
});

// GET MIS stats for Dashboard
app.get('/api/leads/mis-stats', authenticateToken, requireAdmin, async (req, res) => {
  const stats = await db.getMISStats();
  res.json(stats);
});

// Fetch Leads (Admin or Agent)
app.get('/api/leads', authenticateToken, async (req, res) => {
  const role = req.user.role;
  if (role === 'admin' || role === 'agent') {
    const agentId = role === 'agent' ? req.user.id : null;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const search = req.query.search || '';
    const card = req.query.card || '';
    const source = req.query.source || '';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';
    
    const result = await db.getLeadsFiltered({
      agentId, page, limit, search, card, source, startDate, endDate
    });
    res.json(result);
  } else {
    res.status(403).json({ error: 'Access denied' });
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
    broadcast({ type: 'LEADS_UPDATED' });
    
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update lead' });
  }
});

// Export Leads to CSV (Admin Only)
app.get('/api/leads/export', authenticateToken, requireAdmin, async (req, res) => {
  const { startDate, endDate } = req.query;
  const leads = await db.getLeadsForExport({ startDate, endDate });
  
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
      if (source === 'created_at') {
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
      } else if (l[source] !== undefined && l[source] !== null) {
        val = String(l[source]);
      } else if (l.utm_params && l.utm_params[source] !== undefined && l.utm_params[source] !== null) {
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
  const cards = await db.getCards(false);
  res.json(cards);
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
  const { id, name, phone, email, username, password, status, locations, assigned_bank } = req.body;
  
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
    assigned_bank: assigned_bank || null
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
      const sampleUrl = 'https://finmantra.org/refer/public/20260628/FMTEST999';
      const referralTemplateName = settings.wa_referral_template_name || process.env.WA_REFERRAL_TEMPLATE_NAME || 'transactional_link';
      const result = await sendWhatsAppTemplate(phone, referralTemplateName, ['Customer', sampleUrl]);
      return res.json({ success: true, message: `Sample Bank Portal URL dispatched to ${phone} via Meta API template "${referralTemplateName}".`, result });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- SETTINGS MANAGEMENT ---

// Get Settings
app.get('/api/settings', async (req, res) => {
  const settings = await db.getSettings();
  res.json(settings);
});

// Update Settings (Admin Only)
app.put('/api/settings', authenticateToken, requireAdmin, async (req, res) => {
  // If editing form builder schema, enforce Super Admin (developer/Lakshay) privilege only
  if (req.body.landing_form_schema && !req.user.canDelete) {
    return res.status(403).json({ error: 'Landing Form Builder access is restricted to developer admin (Lakshay) only.' });
  }

  const oldSettings = await db.getSettings();
  const updated = await db.updateSettings(req.body);
  
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
  
  res.json(updated);
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
  } catch (err) {
    console.error('====================================================================');
    console.error('[Database] WARNING: Server startup failed to initialize database connectivity.');
    console.error('Error message:', err.message);
    console.error('[Startup] Server process is kept alive to prevent 502 Bad Gateway errors.');
    console.error('====================================================================');
  }
});
