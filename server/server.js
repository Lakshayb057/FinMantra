const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const http = require('http');
const WebSocket = require('ws');
const db = require('./db');
const baileys = require('./baileys');

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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

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

// Helper to send messages via Meta WhatsApp Cloud API
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
  const gateway = settings.whatsapp_gateway || 'baileys';

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
    console.error('[WhatsApp] Gateway is set to Baileys but it is not connected.');
    throw new Error('WhatsApp linked device is not connected.');
  }

  const apiKey = settings.wa_api_key || process.env.WA_API_KEY;
  const phoneId = settings.wa_phone_number_id || process.env.WA_PHONE_NUMBER_ID;
  const apiVersion = settings.wa_api_version || process.env.WA_API_VERSION || 'v25.0';

  if (!apiKey || !phoneId) {
    const baileysStatus = baileys.getBaileysStatus();
    if (baileysStatus.status === 'CONNECTED') {
      console.log(`[WhatsApp Fallback] Meta API not configured. Routing message to ${toPhone} via Baileys linked device...`);
      try {
        const text = getFallbackText(isOtpAuth, parameters, settings);
        const result = await baileys.sendBaileysMessage(toPhone, text);
        return { sentViaBaileys: true, result };
      } catch (err) {
        console.error('[WhatsApp Fallback] Failed to send via Baileys:', err.message);
        throw err;
      }
    }
    console.log(`[WhatsApp Simulation] Meta API credentials missing & Baileys disconnected. Simulating template "${templateName}" to ${toPhone} with params:`, parameters);
    return { simulated: true };
  }

  // Format phone number to E.164 (Meta requires country code without + or leading zeros)
  let formattedPhone = toPhone.trim().replace(/\D/g, '');
  if (formattedPhone.length === 10) {
    formattedPhone = '91' + formattedPhone; // Default to India country code if 10 digits
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: formattedPhone,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: settings.wa_template_language || process.env.WA_TEMPLATE_LANGUAGE || 'en'
      }
    }
  };

  if (isOtpAuth) {
    // Authentication Template requires specific structure (body parameter + button parameter)
    // The first parameter in 'parameters' array is assumed to be the OTP code
    const otpCode = String(parameters[0] || '');
    payload.template.components = [
      {
        type: 'body',
        parameters: [
          {
            type: 'text',
            text: otpCode
          }
        ]
      },
      {
        type: 'button',
        sub_type: 'otp',
        index: '0',
        parameters: [
          {
            type: 'text',
            text: otpCode
          }
        ]
      }
    ];
  } else if (parameters.length > 0) {
    // If wa_referral_link_type is 'button', split body and button parameters
    const waLinkType = settings.wa_referral_link_type || 'body';
    
    // Find if there is a URL parameter
    const urlParamIdx = parameters.findIndex(p => typeof p === 'string' && (p.startsWith('http://') || p.startsWith('https://')));
    
    if (waLinkType === 'button' && urlParamIdx !== -1) {
      const fullUrl = parameters[urlParamIdx];
      // Extract suffix after /refer/
      let suffix = '';
      const referIdx = fullUrl.indexOf('/refer/');
      if (referIdx !== -1) {
        suffix = fullUrl.substring(referIdx + 7); // extract after "/refer/"
      } else {
        // Fallback: extract path after host
        try {
          const parsed = new URL(fullUrl);
          suffix = parsed.pathname.substring(1) + parsed.search; // remove leading /
        } catch (e) {
          suffix = fullUrl;
        }
      }

      // Filter out the URL parameter from the body parameters list
      const bodyParams = parameters.filter((_, idx) => idx !== urlParamIdx);
      
      payload.template.components = [
        {
          type: 'body',
          parameters: bodyParams.map(p => ({
            type: 'text',
            text: String(p)
          }))
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            {
              type: 'text',
              text: suffix
            }
          ]
        }
      ];
    } else {
      // Standard body parameters
      payload.template.components = [
        {
          type: 'body',
          parameters: parameters.map(p => ({
            type: 'text',
            text: String(p)
          }))
        }
      ];
    }
  }

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const https = require('https');
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
          try {
            resolve(JSON.parse(responseBody));
          } catch (e) {
            resolve(responseBody);
          }
        } else {
          let errMsg = `Meta API error (status ${res.statusCode}): ${responseBody}`;
          try {
            const parsed = JSON.parse(responseBody);
            if (parsed && parsed.error && parsed.error.message) {
              errMsg = `Meta API Error: ${parsed.error.message} (Code: ${parsed.error.code}, Subcode: ${parsed.error.error_subcode})`;
            }
          } catch (e) {}
          
          const baileysStatus = baileys.getBaileysStatus();
          if (baileysStatus.status === 'CONNECTED') {
            console.warn(`[WhatsApp Fallback] Meta API failed (status ${res.statusCode}). Attempting delivery via Baileys...`);
            try {
              const text = getFallbackText(isOtpAuth, parameters, settings);
              baileys.sendBaileysMessage(toPhone, text).then(result => {
                resolve({ sentViaBaileys: true, metaError: errMsg, result });
              }).catch(baileysErr => {
                reject(new Error(`${errMsg}. Fallback to Baileys also failed: ${baileysErr.message}`));
              });
              return;
            } catch (baileysErr) {
              return reject(new Error(`${errMsg}. Fallback to Baileys also failed: ${baileysErr.message}`));
            }
          }
          reject(new Error(errMsg));
        }
      });
    });

    req.on('error', async (err) => {
      const baileysStatus = baileys.getBaileysStatus();
      if (baileysStatus.status === 'CONNECTED') {
        console.warn(`[WhatsApp Fallback] Meta connection failed (${err.message}). Attempting delivery via Baileys...`);
        try {
          const text = getFallbackText(isOtpAuth, parameters, settings);
          baileys.sendBaileysMessage(toPhone, text).then(result => {
            resolve({ sentViaBaileys: true, metaError: err.message, result });
          }).catch(baileysErr => {
            reject(new Error(`Meta Connection Error: ${err.message}. Fallback to Baileys also failed: ${baileysErr.message}`));
          });
          return;
        } catch (baileysErr) {
          return reject(new Error(`Meta Connection Error: ${err.message}. Fallback to Baileys also failed: ${baileysErr.message}`));
        }
      }
      reject(err);
    });

    req.write(postData);
    req.end();
  });
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
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
    return res.json({ token, role: 'admin' });
  }
  res.status(401).json({ error: 'Invalid admin password' });
});

// Agent Login
app.post('/api/agents/login', loginRateLimiter.middleware(), async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const agent = await db.getAgentByUsername(username);

  if (agent && agent.password_hash === sha256(password)) {
    const token = jwt.sign({ id: agent.id, name: agent.name, role: 'agent' }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({
      token,
      role: 'agent',
      agent: { id: agent.id, name: agent.name, email: agent.email, locations: agent.locations }
    });
  }
  res.status(401).json({ error: 'Invalid agent credentials or inactive account' });
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
  const apiKey = settings.wa_api_key || process.env.WA_API_KEY;
  const phoneId = settings.wa_phone_number_id || process.env.WA_PHONE_NUMBER_ID;

  let isSimulated = true;
  let apiError = null;

  if (apiKey && phoneId) {
    const otpTemplateName = settings.wa_otp_template_name || process.env.WA_OTP_TEMPLATE_NAME || 'auth_otp';
    const isOtpAuth = settings.wa_otp_is_auth_template === 'true' || settings.wa_otp_is_auth_template === true;
    try {
      let params = [otp];
      if (otpTemplateName === 'jaspers_market_order_confirmation_v1') {
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        params = ['Customer', otp, dateStr];
      }
      const result = await sendWhatsAppTemplate(phone, otpTemplateName, params, isOtpAuth);
      isSimulated = false;
      console.log(`[WhatsApp API] Message sent to ${phone} via Meta API.`);
    } catch (err) {
      apiError = err.message;
      console.error('-----------------------------------------');
      console.error(`[WhatsApp API Error sending to ${phone}]:`);
      console.error(err.message);
      console.error('-----------------------------------------');
    }
  } else {
    isSimulated = true;
    if (apiKey && !phoneId) {
      console.error('CRITICAL WARNING: WA_API_KEY is defined but WA_PHONE_NUMBER_ID is missing!');
    }
  }

  if (apiError) {
    return res.status(502).json({
      error: 'Failed to send WhatsApp verification code',
      details: apiError
    });
  }

  console.log(`=========================================`);
  console.log(`[OTP Verification Code for ${phone}]: ${otp}`);
  console.log(`=========================================`);

  res.json({
    success: true,
    message: isSimulated ? 'OTP sent successfully (Simulation Mode)' : 'OTP sent successfully',
    simulatedOtp: isSimulated ? otp : null
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
    ad_id
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
    
    // First, check if there is an active card matching by ad_id (ad_id, utm_creative, utm_content, or utm_id)
    const adIdToCheck = ad_id || utm_creative || utm_content || utm_id;
    if (adIdToCheck) {
      const activeCards = await db.getCards(false);
      const adIdStr = String(adIdToCheck).trim();
      matchedCard = activeCards.find(c => c.ad_id && String(c.ad_id).trim() === adIdStr);
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
    city: source === 'agent' ? city : null,
    employment: source === 'agent' ? employment : null,
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
    ad_id: ad_id || utm_creative || utm_content || utm_id || (card ? card.ad_id : null) || null
  };

  const newLead = await db.addLead(leadData);

  // Compute redirect URL using template placeholders (case-insensitive)
  const agentCodeVal = (source === 'agent' && agent_id) ? agent_id : '';
  let redirectUrl = redirectUrlTemplate;
  redirectUrl = redirectUrl
    .replace(/{name}/gi, encodeURIComponent(trimmedName))
    .replace(/{phone}/gi, encodeURIComponent(trimmedPhone))
    .replace(/{email}/gi, encodeURIComponent(trimmedEmail))
    .replace(/{urn}/gi, encodeURIComponent(newLead.urn))
    .replace(/{urm}/gi, encodeURIComponent(newLead.urn)) // support legacy placeholder if any
    .replace(/{agent_id}/gi, encodeURIComponent(agentCodeVal))
    .replace(/{utm_source}/gi, encodeURIComponent(utm_source || ''))
    .replace(/{utm_medium}/gi, encodeURIComponent(utm_medium || ''))
    .replace(/{utm_campaign}/gi, encodeURIComponent(utm_campaign || ''))
    .replace(/{utm_id}/gi, encodeURIComponent(utm_id || ''))
    .replace(/{utm_term}/gi, encodeURIComponent(utm_term || ''))
    .replace(/{utm_creative}/gi, encodeURIComponent(utm_creative || ''))
    .replace(/{ad_id}/gi, encodeURIComponent(leadData.ad_id || ''))
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
  const referralTemplateName = settings.wa_referral_template_name || process.env.WA_REFERRAL_TEMPLATE_NAME || 'transactional_link';
  try {
    let params = [trimmedName, referralLink];
    if (referralTemplateName === 'jaspers_market_order_confirmation_v1') {
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      params = [trimmedName, referralLink, dateStr];
    }
    const result = await sendWhatsAppTemplate(trimmedPhone, referralTemplateName, params);
    if (!result.simulated) {
      console.log(`[WhatsApp API] Referral template sent to ${trimmedPhone} via Meta API.`);
    }
  } catch (err) {
    console.error('Failed to send WhatsApp referral link via Meta API:', err.message);
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

// Fetch Leads (Admin or Agent)
app.get('/api/leads', authenticateToken, async (req, res) => {
  const role = req.user.role;
  if (role === 'admin' || role === 'agent') {
    const agentId = role === 'agent' ? req.user.id : null;
    const leads = await db.getLeadsFiltered({ agentId });
    res.json(leads);
  } else {
    res.status(403).json({ error: 'Access denied' });
  }
});

// Bulk/Single Delete Leads (Admin Only)
app.post('/api/leads/delete-bulk', authenticateToken, requireAdmin, async (req, res) => {
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
  const { id } = req.params;
  await db.deleteLead(id);
  
  // Broadcast deletion update
  broadcast({ type: 'LEADS_UPDATED' });
  
  res.json({ success: true, message: 'Lead deleted successfully' });
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
      { id: "ad_id", header: "Ad ID (ad_id)", source: "ad_id" },
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
        val = l.created_at ? (typeof l.created_at === 'string' ? l.created_at : new Date(l.created_at).toISOString()).replace('T', ' ').slice(0, 16) : '';
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
  const { name, bank, category, ad_id, description, redirect_url_template, display_order, active, card_locations } = req.body;

  const trimmedName = name ? String(name).trim() : '';
  const trimmedBank = bank ? String(bank).trim() : '';
  const trimmedUrl = redirect_url_template ? String(redirect_url_template).trim() : '';

  if (!trimmedName || !trimmedBank || !trimmedUrl) {
    return res.status(400).json({ error: 'Card Name, Bank and Redirect URL Template are required' });
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
  const { name, bank, category, ad_id, description, redirect_url_template, display_order, active, card_locations } = req.body;

  const trimmedName = name ? String(name).trim() : '';
  const trimmedBank = bank ? String(bank).trim() : '';
  const trimmedUrl = redirect_url_template ? String(redirect_url_template).trim() : '';

  if (!trimmedName || !trimmedBank || !trimmedUrl) {
    return res.status(400).json({ error: 'Card Name, Bank and Redirect URL Template are required' });
  }

  if (!/^https?:\/\//i.test(trimmedUrl)) {
    return res.status(400).json({ error: 'Redirect URL Template must start with http:// or https://' });
  }

  const updated = await db.updateCard(req.params.id, {
    name: trimmedName,
    bank: trimmedBank,
    category: category || 'Offline',
    ad_id: ad_id || '',
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
  const { id, name, phone, email, username, password, status, locations } = req.body;
  
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

  const password_hash = sha256(password);
  const newAgent = await db.addAgent({
    id: trimmedId,
    name: trimmedName,
    phone: trimmedPhone || null,
    email: trimmedEmail || null,
    username: trimmedUsername,
    password_hash,
    status: status || 'active',
    locations: locations || []
  });

  // Broadcast agents change
  broadcast({ type: 'AGENTS_UPDATED' });

  res.json(newAgent);
});

// Update Agent
app.put('/api/agents/:id', authenticateToken, requireAdmin, async (req, res) => {
  const updateData = { ...req.body };
  if (updateData.password) {
    updateData.password_hash = sha256(updateData.password);
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

// --- SETTINGS MANAGEMENT ---

// Get Settings
app.get('/api/settings', async (req, res) => {
  const settings = await db.getSettings();
  res.json(settings);
});

// Update Settings (Admin Only)
app.put('/api/settings', authenticateToken, requireAdmin, async (req, res) => {
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
