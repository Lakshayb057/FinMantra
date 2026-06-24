const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const http = require('http');
const WebSocket = require('ws');
const db = require('./db');

dotenv.config();

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
async function sendWhatsAppTemplate(toPhone, templateName, parameters = []) {
  const settings = await db.getSettings();
  const apiKey = settings.wa_api_key || process.env.WA_API_KEY;
  const phoneId = settings.wa_phone_number_id || process.env.WA_PHONE_NUMBER_ID;

  if (!apiKey || !phoneId) {
    console.log(`[WhatsApp Simulation] Meta API credentials missing. Simulating template "${templateName}" to ${toPhone} with params:`, parameters);
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

  if (parameters.length > 0) {
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

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const https = require('https');
    const options = {
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/${process.env.WA_API_VERSION || 'v25.0'}/${phoneId}/messages`,
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
          reject(new Error(errMsg));
        }
      });
    });

    req.on('error', (err) => {
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
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
    return res.json({ token, role: 'admin' });
  }
  res.status(401).json({ error: 'Invalid admin password' });
});

// Agent Login
app.post('/api/agents/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const agents = await db.getAgents();
  const agent = agents.find(a => a.username === username && a.status === 'active');

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
app.post('/api/otp/send', async (req, res) => {
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
    try {
      let params = [otp];
      if (otpTemplateName === 'jaspers_market_order_confirmation_v1') {
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        params = ['Customer', otp, dateStr];
      }
      const result = await sendWhatsAppTemplate(phone, otpTemplateName, params);
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
app.post('/api/leads', async (req, res) => {
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
    utm_params
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
    const settings = await db.getSettings();
    redirectUrlTemplate = settings.public_redirect_url || '';
  }

  const leadData = {
    full_name: trimmedName,
    phone: trimmedPhone,
    email: trimmedEmail,
    city: source === 'agent' ? city : null,
    employment: source === 'agent' ? employment : null,
    income_range: source === 'agent' ? income_range : null,
    card_id: source === 'agent' ? card_id : null,
    card_name: card ? card.name : 'Public Redirection',
    card_bank: card ? card.bank : 'N/A',
    source: source || 'public',
    agent_id: source === 'agent' ? agent_id : null,
    agent_name: source === 'agent' ? agent_name : null,
    agent_location: source === 'agent' ? agent_location : null,
    consent: !!consent,
    utm_source: source !== 'agent' ? (utm_source || null) : null,
    utm_info: source !== 'agent' ? (utm_info || null) : null,
    utm_params: source !== 'agent' ? (utm_params || null) : null
  };

  const newLead = await db.addLead(leadData);

  // Compute redirect URL using template placeholders (case-insensitive)
  const agentCodeVal = (source === 'agent' && agent_id) ? agent_id : '';
  const utmSourceVal = utm_source || '';
  const utmInfoVal = utm_info || '';
  let redirectUrl = redirectUrlTemplate;
  redirectUrl = redirectUrl
    .replace(/{name}/gi, encodeURIComponent(trimmedName))
    .replace(/{phone}/gi, encodeURIComponent(trimmedPhone))
    .replace(/{email}/gi, encodeURIComponent(trimmedEmail))
    .replace(/{urm}/gi, encodeURIComponent(newLead.urm))
    .replace(/{agent_id}/gi, encodeURIComponent(agentCodeVal))
    .replace(/{utm_source}/gi, encodeURIComponent(utmSourceVal))
    .replace(/{utm_info}/gi, encodeURIComponent(utmInfoVal));

  // Propagate all initial query parameters (including UTM and other URL credentials)
  if (source !== 'agent' && utm_params && typeof utm_params === 'object') {
    try {
      const urlObj = new URL(redirectUrl);
      for (const [key, value] of Object.entries(utm_params)) {
        if (value && !urlObj.searchParams.has(key)) {
          urlObj.searchParams.set(key, value);
        }
      }
      redirectUrl = urlObj.toString();
    } catch (e) {
      const parts = [];
      for (const [key, value] of Object.entries(utm_params)) {
        if (value && !redirectUrl.includes(`${key}=`)) {
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        }
      }
      if (parts.length > 0) {
        let hashtag = '';
        let urlWithoutHash = redirectUrl;
        const hashIdx = redirectUrl.indexOf('#');
        if (hashIdx !== -1) {
          urlWithoutHash = redirectUrl.substring(0, hashIdx);
          hashtag = redirectUrl.substring(hashIdx);
        }
        const separator = urlWithoutHash.includes('?') ? '&' : '?';
        redirectUrl = urlWithoutHash + separator + parts.join('&') + hashtag;
      }
    }
  }

  newLead.redirect_url = redirectUrl;
  
  // Update local file database
  const leads = await db.getLeads();
  const idx = leads.findIndex(l => l.id === newLead.id);
  if (idx !== -1) {
    leads[idx].redirect_url = redirectUrl;
    const fs = require('fs');
    const path = require('path');
    const DB_FILE = path.join(__dirname, 'local_database.json');
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    data.leads = leads;
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  // Real-time broadcast notification of a new lead!
  broadcast({ type: 'LEAD_ADDED', data: newLead });

  // Send WhatsApp Referral Notification with Tracking URL
  const agentCode = (source === 'agent' && agent_id) ? agent_id : 'public';
  const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const referralLink = `http://localhost:5173/refer/${agentCode}/${dateCode}/${newLead.urm}`;
  const cardNameStr = card ? `${card.bank} ${card.name}` : 'FinMantra Partner Bank';
  const referralMsg = `Hello ${trimmedName}, thank you for choosing FinMantra. You can access your secure bank portal for the ${cardNameStr} application here: ${referralLink}`;

  const settings = await db.getSettings();
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
    urm: newLead.urm,
    redirectUrl
  });
});

// Fetch Lead Details by URM (Public link landing page resolver)
app.get('/api/leads/urm/:urm', async (req, res) => {
  const { urm } = req.params;
  const leads = await db.getLeads();
  const lead = leads.find(l => l.urm === urm);

  if (lead) {
    res.json({
      success: true,
      urm: lead.urm,
      full_name: lead.full_name,
      card_name: lead.card_name,
      card_bank: lead.card_bank,
      redirectUrl: lead.redirect_url,
      created_at: lead.created_at
    });
  } else {
    res.status(404).json({ error: 'Application URM tracking record not found' });
  }
});

// Fetch Leads (Admin or Agent)
app.get('/api/leads', authenticateToken, async (req, res) => {
  const leads = await db.getLeads();
  if (req.user.role === 'admin') {
    res.json(leads);
  } else if (req.user.role === 'agent') {
    const agentLeads = leads.filter(l => l.agent_id === req.user.id);
    res.json(agentLeads);
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

// Export Leads to CSV (Admin Only)
app.get('/api/leads/export', authenticateToken, requireAdmin, async (req, res) => {
  const leads = await db.getLeads();
  
  let csv = 'URM,Creation Date/Time,Full Name,Phone,Email,City,Employment,Monthly Income,Selected Card,Card Bank,Source,UTM Source,UTM Info,Agent Name,Agent Location,Redirect URL\n';
  
  leads.forEach(l => {
    const createdDateTime = l.created_at ? l.created_at.replace('T', ' ').slice(0, 16) : '';
    csv += `"${l.urm || ''}","${createdDateTime}","${l.full_name || ''}","${l.phone || ''}","${l.email || ''}","${l.city || ''}","${l.employment || ''}","${l.income_range || ''}","${l.card_name || ''}","${l.card_bank || ''}","${l.source || ''}","${l.utm_source || ''}","${l.utm_info || ''}","${l.agent_name || ''}","${l.agent_location || ''}","${l.redirect_url || ''}"\n`;
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
  const { name, bank, category, description, redirect_url_template, display_order, active } = req.body;

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
    category: category || 'Premium',
    description: description ? String(description).trim() : '',
    redirect_url_template: trimmedUrl,
    display_order: display_order || 1,
    active: active !== undefined ? active : true
  });
  
  // Broadcast cards change
  broadcast({ type: 'CARDS_UPDATED' });
  
  res.json(newCard);
});

// Update Card (Admin Only)
app.put('/api/cards/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { name, bank, category, description, redirect_url_template, display_order, active } = req.body;

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
    category: category || 'Premium',
    description: description ? String(description).trim() : '',
    redirect_url_template: trimmedUrl,
    display_order: display_order || 1,
    active: active !== undefined ? active : true
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

// --- SETTINGS MANAGEMENT ---

// Get Settings
app.get('/api/settings', async (req, res) => {
  const settings = await db.getSettings();
  res.json(settings);
});

// Update Settings (Admin Only)
app.put('/api/settings', authenticateToken, requireAdmin, async (req, res) => {
  const updated = await db.updateSettings(req.body);
  
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
server.listen(PORT, () => {
  console.log(`FinMantra backend running on port ${PORT}`);
});
