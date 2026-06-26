const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const DB_FILE = path.join(__dirname, 'local_database.json');

const DEFAULT_CSV_TEMPLATE = JSON.stringify([
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
]);

// Database mode dispatching
const rawDbUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim().replace(/^["']|["']$/g, '') : '';
let usePg = !!rawDbUrl;
let pool = null;

if (usePg) {
  const isLocalhost = rawDbUrl.includes('localhost') || rawDbUrl.includes('127.0.0.1');
  const sslConfig = (process.env.DATABASE_SSL === 'true' || (!isLocalhost && process.env.DATABASE_SSL !== 'false'))
    ? { rejectUnauthorized: false }
    : false;

  pool = new Pool({
    connectionString: rawDbUrl,
    ssl: sslConfig,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
  pool.on('error', (err) => {
    console.error('[Database] Unexpected error on idle PostgreSQL client:', err.message || err);
  });
  console.log(`[Database] Configured to connect to AWS/RDS PostgreSQL Database (SSL: ${!!sslConfig}).`);
} else {
  console.log('[Database] Configured to use local JSON file database.');
}

// Initialize local database with default seed data if it doesn't exist
function initDb() {
  if (!fs.existsSync(DB_FILE)) {
    const defaultData = {
      leads: [],
      cards: [
        {
          id: 'card_1',
          name: 'HDFC Regalia Gold',
          bank: 'HDFC',
          category: 'Offline',
          description: 'Complimentary Club Vistara & MMT Black memberships. 4 Reward Points per ₹150 spent.',
          redirect_url_template: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/regalia-gold-credit-card?name={name}&phone={phone}&email={email}&urn={urn}',
          display_order: 1,
          active: true,
          thumbnail_url: ''
        },
        {
          id: 'card_2',
          name: 'Diners Club Privilege',
          bank: 'HDFC',
          category: 'Offline',
          description: 'Complimentary annual memberships of Amazon Prime, Swiggy One. 2x on weekend dining.',
          redirect_url_template: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/diners-club-privilege?name={name}&phone={phone}&email={email}&urn={urn}',
          display_order: 2,
          active: true,
          thumbnail_url: ''
        },
        {
          id: 'card_3',
          name: 'Marriott Bonvoy HDFC',
          bank: 'HDFC',
          category: 'Offline',
          description: '1 Free Night Award annually. Silver Elite Status. 8 Marriott Bonvoy Points per ₹150 spent.',
          redirect_url_template: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/marriott-bonvoy?name={name}&phone={phone}&email={email}&urn={urn}',
          display_order: 3,
          active: true,
          thumbnail_url: ''
        },
        {
          id: 'card_4',
          name: 'Swiggy HDFC',
          bank: 'HDFC',
          category: 'Offline',
          description: '10% cashback on Swiggy application. 5% cashback on online shopping. 1% on other spends.',
          redirect_url_template: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/swiggy-hdfc-card?name={name}&phone={phone}&email={email}&urn={urn}',
          display_order: 4,
          active: true,
          thumbnail_url: ''
        },
        {
          id: 'card_5',
          name: 'Tata Neu HDFC Infinity',
          bank: 'HDFC',
          category: 'Offline',
          description: '5% NeuCoins on Tata Neu and partner brands. 1.5% NeuCoins on non-Tata spend.',
          redirect_url_template: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/tata-neu-infinity?name={name}&phone={phone}&email={email}&urn={urn}',
          display_order: 5,
          active: true,
          thumbnail_url: ''
        },
        {
          id: 'card_6',
          name: 'HDFC Pixel Play',
          bank: 'HDFC',
          category: 'Offline',
          description: 'Customizable credit card. Choose your favorite merchants for 5% cashback.',
          redirect_url_template: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/pixel-play?name={name}&phone={phone}&email={email}&urn={urn}',
          display_order: 6,
          active: true,
          thumbnail_url: ''
        }
      ],
      agents: [],
      locations: [],
      settings: {
        public_redirect_url: 'https://applyonline.hdfcbank.com/cards/credit-cards.html?CHANNELSOURCE=TDCC&DEDUPE=N&DSACode=XFIF&LGcode=public&LCcode=public&urn={urn}',
        otp_message_template: 'Your OTP for FinMantra credit card application is: {otp}. Valid for 5 minutes.',
        consent_text: 'I authorise FinMantra and its partner banks to contact me via call, SMS, WhatsApp and email about credit card offers, even if I am registered under DND/NDNC.',
        terms_link: 'https://finmantra.org/terms',
        privacy_link: 'https://finmantra.org/privacy',
        public_site_url: '',
        wa_referral_link_type: 'body',
        whatsapp_gateway: 'baileys'
      },
      otp_log: {}
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
  }
}

// Auto-Migration Schema for PostgreSQL
async function initPgSchema() {
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    console.error('====================================================================');
    console.error('[DATABASE ERROR] Failed to connect to AWS/RDS PostgreSQL Database!');
    console.error('Error details:', err.message);
    
    // Detailed error diagnostics helper
    const errMsg = err.message || '';
    if (errMsg.includes('no pg_hba.conf entry') && errMsg.includes('no encryption')) {
      console.error('[DIAGNOSIS] The PostgreSQL server rejected the connection because it was not encrypted (SSL).');
      console.error('[SOLUTION] Please add DATABASE_SSL=true to your server/.env file or append sslmode=require to your DATABASE_URL.');
    } else if (errMsg.includes('password authentication failed')) {
      console.error('[DIAGNOSIS] Password authentication failed. The password in your DATABASE_URL is incorrect.');
      console.error('[SOLUTION] Please verify the user credentials in your DATABASE_URL connection string.');
    } else if (errMsg.includes('ENOTFOUND') || errMsg.includes('EAI_AGAIN')) {
      console.error('[DIAGNOSIS] Database host not found. Unable to resolve host name.');
      console.error('[SOLUTION] Please check the host name in your DATABASE_URL connection string.');
    } else if (errMsg.includes('ETIMEDOUT') || errMsg.includes('ECONNREFUSED')) {
      console.error('[DIAGNOSIS] Database connection timed out or was refused.');
      console.error('[SOLUTION] Please verify that your PostgreSQL server is running and that your AWS Security Groups allow traffic on port 5432 from this client.');
    }
    console.error('Please verify your DATABASE_URL configuration and database server connectivity.');
    console.error('====================================================================');
    throw err;
  }

  try {
    await client.query('BEGIN');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS cards (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        bank VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        description TEXT,
        redirect_url_template TEXT,
        display_order INT DEFAULT 1,
        active BOOLEAN DEFAULT TRUE,
        thumbnail_url TEXT
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(255),
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        locations JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id VARCHAR(50) PRIMARY KEY,
        urn VARCHAR(50) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        email VARCHAR(255) NOT NULL,
        city VARCHAR(255),
        employment VARCHAR(100),
        income_range VARCHAR(100),
        card_id VARCHAR(50),
        card_name VARCHAR(255),
        card_bank VARCHAR(255),
        source VARCHAR(50) DEFAULT 'public',
        agent_id VARCHAR(50),
        agent_name VARCHAR(255),
        agent_location VARCHAR(255),
        consent BOOLEAN DEFAULT TRUE,
        utm_source VARCHAR(255),
        utm_info VARCHAR(255),
        utm_creative_format VARCHAR(255),
        utm_medium TEXT,
        utm_campaign TEXT,
        utm_term TEXT,
        utm_content TEXT,
        utm_channel TEXT,
        utm_category TEXT,
        fbclid TEXT,
        gclid TEXT,
        gclsrc TEXT,
        dclid TEXT,
        msclkid TEXT,
        ttclid TEXT,
        twclid TEXT,
        li_fat_id TEXT,
        utm_params JSONB,
        redirect_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS otp_log (
        phone VARCHAR(20) PRIMARY KEY,
        otp VARCHAR(10) NOT NULL,
        created_at BIGINT NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        attempts INT DEFAULT 0
      )
    `);

    // Automated PostgreSQL Migration: Rename leads.urm to leads.urn if it exists
    try {
      const hasUrm = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='leads' AND column_name='urm'
      `);
      if (hasUrm.rows.length > 0) {
        await client.query('ALTER TABLE leads RENAME COLUMN urm TO urn');
        console.log('[Database] Migrated column leads.urm to leads.urn in PostgreSQL.');
      }
    } catch (migErr) {
      console.error('[Database] Failed to execute PostgreSQL ALTER column urm -> urn:', migErr.message);
    }

    // Automated PostgreSQL Migration: Add utm_creative_format column if not exists
    try {
      await client.query(`
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_creative_format VARCHAR(255)
      `);
      console.log('[Database] Checked/Added column leads.utm_creative_format in PostgreSQL.');
    } catch (migErr) {
      console.error('[Database] Failed to execute PostgreSQL ALTER TABLE add column utm_creative_format:', migErr.message);
    }

    // Automated PostgreSQL Migration: Add new UTM and tracking columns if not exist
    const newColumns = [
      'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_channel', 'utm_category', 
      'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id'
    ];
    for (const col of newColumns) {
      try {
        await client.query(`
          ALTER TABLE leads ADD COLUMN IF NOT EXISTS ${col} TEXT
        `);
        console.log(`[Database] Checked/Added column leads.${col} in PostgreSQL.`);
      } catch (migErr) {
        console.error(`[Database] Failed to add column leads.${col}:`, migErr.message);
      }
    }

    // Automated PostgreSQL Migration: Add utm_params JSONB column if not exists
    try {
      await client.query(`
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_params JSONB DEFAULT '{}'::jsonb
      `);
      console.log('[Database] Checked/Added column leads.utm_params in PostgreSQL.');
    } catch (migErr) {
      console.error('[Database] Failed to add utm_params column:', migErr.message);
    }

    // Automated PostgreSQL Migration: Add redirect_url TEXT column if not exists
    try {
      await client.query(`
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS redirect_url TEXT DEFAULT ''
      `);
      console.log('[Database] Checked/Added column leads.redirect_url in PostgreSQL.');
    } catch (migErr) {
      console.error('[Database] Failed to add redirect_url column:', migErr.message);
    }


    // Automated PostgreSQL Migration: Update legacy card categories to 'Offline'
    try {
      const migResult = await client.query(`
        UPDATE cards SET category = 'Offline' WHERE category NOT IN ('Offline', 'Digital')
      `);
      if (migResult.rowCount > 0) {
        console.log(`[Database] Migrated ${migResult.rowCount} card(s) category to 'Offline' in PostgreSQL.`);
      }
    } catch (migErr) {
      console.error('[Database] Failed to migrate card categories:', migErr.message);
    }

    // Automated PostgreSQL Migration: Add card_locations column if not exists
    try {
      await client.query(`
        ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_locations JSONB DEFAULT '[]'
      `);
      console.log('[Database] Checked/Added column cards.card_locations in PostgreSQL.');
    } catch (migErr) {
      console.error('[Database] Failed to add card_locations column:', migErr.message);
    }

    // Automated PostgreSQL Migration: Add ad_id column if not exists
    try {
      await client.query(`
        ALTER TABLE cards ADD COLUMN IF NOT EXISTS ad_id VARCHAR(100)
      `);
      console.log('[Database] Checked/Added column cards.ad_id in PostgreSQL.');
    } catch (migErr) {
      console.error('[Database] Failed to add cards.ad_id column:', migErr.message);
    }

    // Automated PostgreSQL Migration: Add new UTM parameters to leads table
    try {
      await client.query(`
        ALTER TABLE leads 
        ADD COLUMN IF NOT EXISTS utm_id TEXT,
        ADD COLUMN IF NOT EXISTS utm_creative TEXT,
        ADD COLUMN IF NOT EXISTS utm_keyword TEXT,
        ADD COLUMN IF NOT EXISTS utm_matchtype TEXT,
        ADD COLUMN IF NOT EXISTS utm_network TEXT,
        ADD COLUMN IF NOT EXISTS utm_placement TEXT
      `);
      console.log('[Database] Checked/Added new UTM parameters to leads table in PostgreSQL.');
    } catch (migErr) {
      console.error('[Database] Failed to add new UTM parameters to leads table:', migErr.message);
    }

    // Automated PostgreSQL Migration: Add attribution test parameters to leads table
    try {
      await client.query(`
        ALTER TABLE leads 
        ADD COLUMN IF NOT EXISTS utm_device TEXT,
        ADD COLUMN IF NOT EXISTS utm_location TEXT,
        ADD COLUMN IF NOT EXISTS gbraid TEXT,
        ADD COLUMN IF NOT EXISTS wbraid TEXT,
        ADD COLUMN IF NOT EXISTS landing_page TEXT,
        ADD COLUMN IF NOT EXISTS first_landing_page TEXT,
        ADD COLUMN IF NOT EXISTS referrer TEXT
      `);
      console.log('[Database] Checked/Added attribution test parameters to leads table in PostgreSQL.');
    } catch (migErr) {
      console.error('[Database] Failed to add attribution test parameters to leads table:', migErr.message);
    }

    // Automated PostgreSQL Migration: Add ad_id column to leads table
    try {
      await client.query(`
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ad_id TEXT
      `);
      console.log('[Database] Checked/Added column leads.ad_id in PostgreSQL.');
    } catch (migErr) {
      console.error('[Database] Failed to add column leads.ad_id:', migErr.message);
    }

    
    // Seed cards if empty
    const cardCount = await client.query('SELECT COUNT(*) FROM cards');
    if (parseInt(cardCount.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO cards (id, name, bank, category, description, redirect_url_template, display_order, active, thumbnail_url) VALUES 
        ('card_1', 'HDFC Regalia Gold', 'HDFC', 'Offline', 'Complimentary Club Vistara & MMT Black memberships. 4 Reward Points per ₹150 spent.', 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/regalia-gold-credit-card?name={name}&phone={phone}&email={email}&urn={urn}', 1, true, ''),
        ('card_2', 'Diners Club Privilege', 'HDFC', 'Offline', 'Complimentary annual memberships of Amazon Prime, Swiggy One. 2x on weekend dining.', 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/diners-club-privilege?name={name}&phone={phone}&email={email}&urn={urn}', 2, true, ''),
        ('card_3', 'Marriott Bonvoy HDFC', 'HDFC', 'Offline', '1 Free Night Award annually. Silver Elite Status. 8 Marriott Bonvoy Points per ₹150 spent.', 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/marriott-bonvoy?name={name}&phone={phone}&email={email}&urn={urn}', 3, true, ''),
        ('card_4', 'Swiggy HDFC', 'HDFC', 'Offline', '10% cashback on Swiggy application. 5% cashback on online shopping. 1% on other spends.', 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/swiggy-hdfc-card?name={name}&phone={phone}&email={email}&urn={urn}', 4, true, ''),
        ('card_5', 'Tata Neu HDFC Infinity', 'HDFC', 'Offline', '5% NeuCoins on Tata Neu and partner brands. 1.5% NeuCoins on non-Tata spend.', 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/tata-neu-infinity?name={name}&phone={phone}&email={email}&urn={urn}', 5, true, ''),
        ('card_6', 'HDFC Pixel Play', 'HDFC', 'Offline', 'Customizable credit card. Choose your favorite merchants for 5% cashback.', 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/pixel-play?name={name}&phone={phone}&email={email}&urn={urn}', 6, true, '')
      `);
    }

    // Seed settings if empty
    const settingsCount = await client.query('SELECT COUNT(*) FROM settings');
    if (parseInt(settingsCount.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO settings (key, value) VALUES 
        ('public_redirect_url', 'https://applyonline.hdfcbank.com/cards/credit-cards.html?CHANNELSOURCE=TDCC&DEDUPE=N&DSACode=XFIF&LGcode=public&LCcode=public&urn={urn}'),
        ('otp_message_template', 'Your OTP for FinMantra credit card application is: {otp}. Valid for 5 minutes.'),
        ('consent_text', 'I authorise FinMantra and its partner banks to contact me via call, SMS, WhatsApp and email about credit card offers, even if I am registered under DND/NDNC.'),
        ('terms_link', 'https://finmantra.org/terms'),
        ('privacy_link', 'https://finmantra.org/privacy'),
        ('public_site_url', ''),
        ('wa_referral_link_type', 'body'),
        ('whatsapp_gateway', 'baileys')
      `);
    }

    // Check and seed default CSV template key in settings
    try {
      const csvTemplateCheck = await client.query("SELECT COUNT(*) FROM settings WHERE key = 'csv_export_template'");
      if (parseInt(csvTemplateCheck.rows[0].count, 10) === 0) {
        await client.query("INSERT INTO settings (key, value) VALUES ('csv_export_template', $1)", [DEFAULT_CSV_TEMPLATE]);
        console.log('[Database] Seeded default csv_export_template in settings.');
      }
    } catch (err) {
      console.error('[Database] Failed to seed csv_export_template setting:', err.message);
    }

    await client.query('COMMIT');
    console.log('[Database] PostgreSQL tables checked, initialized and seeded.');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      // rollback failed if transaction not active
    }
    console.error('====================================================================');
    console.error('[DATABASE ERROR] Failed to execute PostgreSQL migration schema!');
    console.error('Error details:', err.message);
    console.error('====================================================================');
    throw err;
  } finally {
    try {
      if (client) client.release();
    } catch (relErr) {
      // release failed
    }
  }
}

// Helper to read data (local JSON fallback)
function readData() {
  initDb();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading local JSON database:', err);
    return { leads: [], cards: [], agents: [], locations: [], settings: {}, otp_log: {} };
  }
}

// Helper to write data (local JSON fallback)
function writeData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing to local JSON database:', err);
    return false;
  }
}

const db = {
  // Initialize Database Schema (PG or JSON)
  async init() {
    if (usePg) {
      await initPgSchema();
    } else {
      initDb();
    }
  },
  // --- Leads ---
  async getLeads() {
    if (usePg) {
      const res = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
      // Convert properties to match frontend snake_case objects and map JSONB utm_params
      return res.rows.map(row => ({
        ...row,
        utm_params: typeof row.utm_params === 'string' ? JSON.parse(row.utm_params) : row.utm_params
      }));
    }
    const data = readData();
    return data.leads;
  },

  async addLead(lead) {
    if (usePg) {
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
      const prefix = `FM${todayStr}`;
      
      const seqQuery = await pool.query('SELECT urn FROM leads WHERE urn LIKE $1', [`${prefix}%`]);
      let sequence = 1;
      if (seqQuery.rows.length > 0) {
        const sequences = seqQuery.rows.map(row => {
          const seqStr = row.urn.replace(prefix, '');
          return parseInt(seqStr, 10) || 0;
        });
        sequence = Math.max(...sequences) + 1;
      }
      const urn = `${prefix}${String(sequence).padStart(3, '0')}`;
      const id = 'lead_' + Math.random().toString(36).substr(2, 9);
      
      await pool.query(
        `INSERT INTO leads (
          id, urn, full_name, phone, email, city, employment, income_range, card_id, card_name, card_bank, 
          source, agent_id, agent_name, agent_location, consent, 
          utm_source, utm_info, utm_creative_format, utm_medium, utm_campaign, utm_term, utm_content, utm_channel, utm_category, fbclid,
          gclid, gclsrc, dclid, msclkid, ttclid, twclid, li_fat_id,
          utm_id, utm_creative, utm_keyword, utm_matchtype, utm_network, utm_placement,
          utm_device, utm_location, gbraid, wbraid, landing_page, first_landing_page, referrer, ad_id,
          utm_params, redirect_url, created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, NOW())`,
        [
          id, urn, lead.full_name, lead.phone, lead.email, lead.city, lead.employment, lead.income_range,
          lead.card_id, lead.card_name, lead.card_bank, lead.source || 'public', lead.agent_id, lead.agent_name,
          lead.agent_location, lead.consent !== undefined ? lead.consent : true,
          lead.utm_source, lead.utm_info, lead.utm_creative_format, lead.utm_medium, lead.utm_campaign, lead.utm_term, lead.utm_content, lead.utm_channel, lead.utm_category, lead.fbclid,
          lead.gclid, lead.gclsrc, lead.dclid, lead.msclkid, lead.ttclid, lead.twclid, lead.li_fat_id,
          lead.utm_id, lead.utm_creative, lead.utm_keyword, lead.utm_matchtype, lead.utm_network, lead.utm_placement,
          lead.utm_device, lead.utm_location, lead.gbraid, lead.wbraid, lead.landing_page, lead.first_landing_page, lead.referrer, lead.ad_id,
          JSON.stringify(lead.utm_params || {}), lead.redirect_url || ''
        ]
      );
      return { id, urn, ...lead, created_at: new Date().toISOString() };
    }

    const data = readData();
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const prefix = `FM${todayStr}`;
    
    const todaysLeads = data.leads.filter(l => l.urn && l.urn.startsWith(prefix));
    let sequence = 1;
    if (todaysLeads.length > 0) {
      const sequences = todaysLeads.map(l => {
        const seqStr = l.urn.replace(prefix, '');
        return parseInt(seqStr, 10) || 0;
      });
      sequence = Math.max(...sequences) + 1;
    }
    const urn = `${prefix}${String(sequence).padStart(3, '0')}`;
    
    const newLead = {
      id: 'lead_' + Math.random().toString(36).substr(2, 9),
      urn,
      ...lead,
      created_at: new Date().toISOString()
    };
    
    data.leads.push(newLead);
    if (!writeData(data)) throw new Error('Database write operation failed');
    return newLead;
  },

  async updateLead(id, lead) {
    if (usePg) {
      await pool.query(
        `UPDATE leads SET 
          full_name = $1, phone = $2, email = $3, city = $4, employment = $5, income_range = $6,
          card_id = $7, card_name = $8, card_bank = $9, source = $10, agent_id = $11, agent_name = $12, agent_location = $13, consent = $14,
          utm_source = $15, utm_info = $16, utm_creative_format = $17, utm_medium = $18, utm_campaign = $19, utm_term = $20, utm_content = $21, utm_channel = $22, utm_category = $23, fbclid = $24,
          gclid = $25, gclsrc = $26, dclid = $27, msclkid = $28, ttclid = $29, twclid = $30, li_fat_id = $31,
          utm_id = $32, utm_creative = $33, utm_keyword = $34, utm_matchtype = $35, utm_network = $36, utm_placement = $37,
          utm_device = $38, utm_location = $39, gbraid = $40, wbraid = $41, landing_page = $42, first_landing_page = $43, referrer = $44, ad_id = $45,
          utm_params = $46, redirect_url = $47
         WHERE id = $48`,
        [
          lead.full_name, lead.phone, lead.email, lead.city, lead.employment, lead.income_range,
          lead.card_id, lead.card_name, lead.card_bank, lead.source, lead.agent_id, lead.agent_name, lead.agent_location, lead.consent,
          lead.utm_source, lead.utm_info, lead.utm_creative_format, lead.utm_medium, lead.utm_campaign, lead.utm_term, lead.utm_content, lead.utm_channel, lead.utm_category, lead.fbclid,
          lead.gclid, lead.gclsrc, lead.dclid, lead.msclkid, lead.ttclid, lead.twclid, lead.li_fat_id,
          lead.utm_id, lead.utm_creative, lead.utm_keyword, lead.utm_matchtype, lead.utm_network, lead.utm_placement,
          lead.utm_device, lead.utm_location, lead.gbraid, lead.wbraid, lead.landing_page, lead.first_landing_page, lead.referrer, lead.ad_id,
          JSON.stringify(lead.utm_params || {}), lead.redirect_url || '', id
        ]
      );
      return { id, ...lead };
    }

    const data = readData();
    const idx = data.leads.findIndex(l => l.id === id);
    if (idx !== -1) {
      data.leads[idx] = {
        ...data.leads[idx],
        ...lead,
        utm_params: lead.utm_params || {}
      };
      if (!writeData(data)) throw new Error('Database write operation failed');
      return data.leads[idx];
    }
    throw new Error('Lead not found');
  },

  async deleteLead(id) {
    if (usePg) {
      await pool.query('DELETE FROM leads WHERE id = $1', [id]);
      return true;
    }
    const data = readData();
    data.leads = data.leads.filter(l => l.id !== id);
    if (!writeData(data)) throw new Error('Database write operation failed');
    return true;
  },

  async deleteLeads(ids) {
    if (usePg) {
      await pool.query('DELETE FROM leads WHERE id = ANY($1::varchar[])', [ids]);
      return true;
    }
    const data = readData();
    data.leads = data.leads.filter(l => !ids.includes(l.id));
    if (!writeData(data)) throw new Error('Database write operation failed');
    return true;
  },

  // --- Cards ---
  async getCards(includeInactive = false) {
    if (usePg) {
      const res = includeInactive
        ? await pool.query('SELECT * FROM cards ORDER BY display_order ASC')
        : await pool.query('SELECT * FROM cards WHERE active = true ORDER BY display_order ASC');
      return res.rows.map(row => ({
        ...row,
        card_locations: typeof row.card_locations === 'string' ? JSON.parse(row.card_locations) : (row.card_locations || [])
      }));
    }
    const data = readData();
    const cards = includeInactive ? data.cards : data.cards.filter(c => c.active);
    return cards.map(c => ({
      ...c,
      card_locations: c.card_locations || []
    }));
  },

  async addCard(card) {
    if (usePg) {
      const id = 'card_' + Math.random().toString(36).substr(2, 9);
      const displayOrder = card.display_order || 1;
      const active = card.active !== undefined ? card.active : true;
      const cardLocationsJson = JSON.stringify(card.card_locations || []);
      await pool.query(
        'INSERT INTO cards (id, name, bank, category, description, redirect_url_template, display_order, active, thumbnail_url, card_locations, ad_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [id, card.name, card.bank, card.category, card.description, card.redirect_url_template, displayOrder, active, card.thumbnail_url || '', cardLocationsJson, card.ad_id || '']
      );
      return { id, ...card, display_order: displayOrder, active, card_locations: card.card_locations || [] };
    }

    const data = readData();
    const newCard = {
      id: 'card_' + Math.random().toString(36).substr(2, 9),
      ...card,
      card_locations: card.card_locations || [],
      display_order: card.display_order || (data.cards.length + 1)
    };
    data.cards.push(newCard);
    if (!writeData(data)) throw new Error('Database write operation failed');
    return newCard;
  },

  async updateCard(id, cardData) {
    if (usePg) {
      const fields = [];
      const values = [];
      let idx = 1;
      for (const [key, val] of Object.entries(cardData)) {
        if (['name', 'bank', 'category', 'description', 'redirect_url_template', 'display_order', 'active', 'thumbnail_url', 'ad_id'].includes(key)) {
          fields.push(`${key} = $${idx++}`);
          values.push(val);
        } else if (key === 'card_locations') {
          fields.push(`card_locations = $${idx++}`);
          values.push(JSON.stringify(val || []));
        }
      }
      values.push(id);
      const res = await pool.query(`UPDATE cards SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
      if (res.rows[0]) {
        res.rows[0].card_locations = typeof res.rows[0].card_locations === 'string' ? JSON.parse(res.rows[0].card_locations) : (res.rows[0].card_locations || []);
      }
      return res.rows[0] || null;
    }

    const data = readData();
    const idx = data.cards.findIndex(c => c.id === id);
    if (idx !== -1) {
      data.cards[idx] = { ...data.cards[idx], ...cardData };
      if (!writeData(data)) throw new Error('Database write operation failed');
      return data.cards[idx];
    }
    return null;
  },

  async deleteCard(id) {
    if (usePg) {
      await pool.query('DELETE FROM cards WHERE id = $1', [id]);
      return true;
    }
    const data = readData();
    data.cards = data.cards.filter(c => c.id !== id);
    if (!writeData(data)) throw new Error('Database write operation failed');
    return true;
  },

  // --- Agents ---
  async getAgents() {
    if (usePg) {
      const res = await pool.query('SELECT * FROM agents ORDER BY created_at ASC');
      // Format locations array
      return res.rows.map(row => ({
        ...row,
        locations: typeof row.locations === 'string' ? JSON.parse(row.locations) : row.locations
      }));
    }
    const data = readData();
    return data.agents;
  },

  async addAgent(agent) {
    if (usePg) {
      const locationsJson = JSON.stringify(agent.locations || []);
      await pool.query(
        'INSERT INTO agents (id, name, phone, email, username, password_hash, status, locations, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())',
        [agent.id, agent.name, agent.phone || '', agent.email || '', agent.username, agent.password_hash, agent.status || 'active', locationsJson]
      );
      return agent;
    }

    const data = readData();
    if (!agent.id) {
      throw new Error('Agent Code/ID is required and cannot be generated by the server');
    }
    const newAgent = {
      ...agent,
      created_at: new Date().toISOString()
    };
    data.agents.push(newAgent);
    if (!writeData(data)) throw new Error('Database write operation failed');
    return newAgent;
  },

  async updateAgent(id, agentData) {
    if (usePg) {
      const fields = [];
      const values = [];
      let idx = 1;
      for (const [key, val] of Object.entries(agentData)) {
        if (['name', 'phone', 'email', 'username', 'password_hash', 'status'].includes(key)) {
          fields.push(`${key} = $${idx++}`);
          values.push(val);
        } else if (key === 'locations') {
          fields.push(`locations = $${idx++}`);
          values.push(JSON.stringify(val));
        }
      }
      values.push(id);
      const res = await pool.query(`UPDATE agents SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
      if (res.rows[0]) {
        res.rows[0].locations = typeof res.rows[0].locations === 'string' ? JSON.parse(res.rows[0].locations) : res.rows[0].locations;
      }
      return res.rows[0] || null;
    }

    const data = readData();
    const idx = data.agents.findIndex(a => a.id === id);
    if (idx !== -1) {
      data.agents[idx] = { ...data.agents[idx], ...agentData };
      if (!writeData(data)) throw new Error('Database write operation failed');
      return data.agents[idx];
    }
    return null;
  },

  async deleteAgent(id) {
    if (usePg) {
      await pool.query('DELETE FROM agents WHERE id = $1', [id]);
      return true;
    }
    const data = readData();
    data.agents = data.agents.filter(a => a.id !== id);
    if (!writeData(data)) throw new Error('Database write operation failed');
    return true;
  },

  // --- Locations ---
  async getLocations() {
    if (usePg) {
      const res = await pool.query('SELECT * FROM locations ORDER BY created_at ASC');
      return res.rows;
    }
    const data = readData();
    return data.locations;
  },

  async addLocation(loc) {
    if (usePg) {
      const id = 'loc_' + Math.random().toString(36).substr(2, 9);
      const name = loc.name;
      const active = loc.active !== undefined ? loc.active : true;
      await pool.query(
        'INSERT INTO locations (id, name, active, created_at) VALUES ($1, $2, $3, NOW())',
        [id, name, active]
      );
      return { id, name, active };
    }

    const data = readData();
    const newLoc = {
      id: 'loc_' + Math.random().toString(36).substr(2, 9),
      name: loc.name,
      active: loc.active !== undefined ? loc.active : true,
      created_at: new Date().toISOString()
    };
    data.locations.push(newLoc);
    if (!writeData(data)) throw new Error('Database write operation failed');
    return newLoc;
  },

  async updateLocation(id, locData) {
    if (usePg) {
      const fields = [];
      const values = [];
      let idx = 1;
      if (locData.name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(locData.name);
      }
      if (locData.active !== undefined) {
        fields.push(`active = $${idx++}`);
        values.push(locData.active);
      }
      values.push(id);
      const res = await pool.query(
        `UPDATE locations SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      return res.rows[0] || null;
    }

    const data = readData();
    const idx = data.locations.findIndex(l => l.id === id);
    if (idx !== -1) {
      data.locations[idx] = { ...data.locations[idx], ...locData };
      if (!writeData(data)) throw new Error('Database write operation failed');
      return data.locations[idx];
    }
    return null;
  },

  async deleteLocation(id) {
    if (usePg) {
      await pool.query('DELETE FROM locations WHERE id = $1', [id]);
      return true;
    }
    const data = readData();
    data.locations = data.locations.filter(l => l.id !== id);
    if (!writeData(data)) throw new Error('Database write operation failed');
    return true;
  },

  // --- Settings ---
  async getSettings() {
    if (usePg) {
      const res = await pool.query('SELECT * FROM settings');
      const settings = {};
      res.rows.forEach(row => {
        settings[row.key] = row.value;
      });
      if (settings.whatsapp_gateway === undefined) {
        settings.whatsapp_gateway = 'baileys';
      }
      if (settings.csv_export_template === undefined) {
        settings.csv_export_template = DEFAULT_CSV_TEMPLATE;
      }
      return settings;
    }
    const data = readData();
    if (data.settings) {
      if (data.settings.whatsapp_gateway === undefined) {
        data.settings.whatsapp_gateway = 'baileys';
      }
      if (data.settings.csv_export_template === undefined) {
        data.settings.csv_export_template = DEFAULT_CSV_TEMPLATE;
        writeData(data);
      }
    }
    return data.settings;
  },

  async updateSettings(settingsData) {
    if (usePg) {
      for (const [key, value] of Object.entries(settingsData)) {
        await pool.query(`
          INSERT INTO settings (key, value) VALUES ($1, $2)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        `, [key, String(value)]);
      }
      return settingsData;
    }

    const data = readData();
    data.settings = { ...data.settings, ...settingsData };
    if (!writeData(data)) throw new Error('Database write operation failed');
    return data.settings;
  },

  // --- OTP Logging & Verification ---
  async saveOTP(phone, otp) {
    if (usePg) {
      const now = new Date().getTime();
      await pool.query(`
        INSERT INTO otp_log (phone, otp, created_at, verified, attempts)
        VALUES ($1, $2, $3, false, 0)
        ON CONFLICT (phone) DO UPDATE
        SET otp = EXCLUDED.otp, created_at = EXCLUDED.created_at, verified = false, attempts = 0
      `, [phone, otp, now]);
      return true;
    }

    const data = readData();
    data.otp_log = data.otp_log || {};
    data.otp_log[phone] = {
      otp,
      created_at: new Date().getTime(),
      verified: false,
      attempts: 0
    };
    if (!writeData(data)) throw new Error('Database write operation failed');
    return true;
  },

  async verifyOTP(phone, otp) {
    if (usePg) {
      const res = await pool.query('SELECT * FROM otp_log WHERE phone = $1', [phone]);
      const log = res.rows[0];
      if (!log) return { success: false, reason: 'No OTP generated' };

      const now = new Date().getTime();
      if (now - parseInt(log.created_at, 10) > 5 * 60 * 1000) {
        return { success: false, reason: 'OTP expired (5 mins limit)' };
      }

      if (log.attempts >= 3) {
        return { success: false, reason: 'Max verification attempts exceeded' };
      }

      if (log.otp === otp) {
        await pool.query('UPDATE otp_log SET verified = true WHERE phone = $1', [phone]);
        return { success: true };
      } else {
        const newAttempts = log.attempts + 1;
        await pool.query('UPDATE otp_log SET attempts = $1 WHERE phone = $2', [newAttempts, phone]);
        return { success: false, reason: `Invalid OTP. Attempts left: ${3 - newAttempts}` };
      }
    }

    const data = readData();
    data.otp_log = data.otp_log || {};
    const log = data.otp_log[phone];
    if (!log) return { success: false, reason: 'No OTP generated' };

    const now = new Date().getTime();
    if (now - log.created_at > 5 * 60 * 1000) {
      return { success: false, reason: 'OTP expired (5 mins limit)' };
    }

    if (log.attempts >= 3) {
      return { success: false, reason: 'Max verification attempts exceeded' };
    }

    if (log.otp === otp) {
      log.verified = true;
      if (!writeData(data)) throw new Error('Database write operation failed');
      return { success: true };
    } else {
      log.attempts += 1;
      if (!writeData(data)) throw new Error('Database write operation failed');
      return { success: false, reason: `Invalid OTP. Attempts left: ${3 - log.attempts}` };
    }
  }
};

module.exports = db;
