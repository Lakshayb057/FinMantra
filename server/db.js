const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const DEFAULT_CSV_TEMPLATE = JSON.stringify([
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
  { id: "redirect_url", header: "Redirect URL", source: "redirect_url" },
  { id: "has_credit_card", header: "Already Has Credit Card?", source: "has_credit_card" },
  { id: "pincode", header: "Residence Pincode", source: "pincode" },
  { id: "monthly_income", header: "Monthly Income", source: "monthly_income" }
]);

const rawDbUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim().replace(/^["']|["']$/g, '') : '';

if (!rawDbUrl) {
  console.error('====================================================================');
  console.error('[Database] CRITICAL: DATABASE_URL is not set in environment / .env file!');
  console.error('[Database] Local fallback database has been disabled. Server process stopped.');
  console.error('====================================================================');
  process.exit(1);
}

const isLocalhost = rawDbUrl.includes('localhost') || rawDbUrl.includes('127.0.0.1');
const isRDS = rawDbUrl.includes('rds.amazonaws.com');
const sslConfig = (isRDS || (!isLocalhost && process.env.DATABASE_SSL !== 'false'))
  ? { rejectUnauthorized: false }
  : false;

let connectionUrl = rawDbUrl.replace(/sslmode=(require|prefer|verify-ca)/gi, 'sslmode=verify-full');
if (!isLocalhost && !connectionUrl.includes('sslmode=')) {
  connectionUrl += connectionUrl.includes('?') ? '&sslmode=verify-full' : '?sslmode=verify-full';
}

const pgConnectionString = require('pg-connection-string');
const pgConfig = pgConnectionString.parse(connectionUrl);
pgConfig.ssl = sslConfig;
pgConfig.max = 20;
pgConfig.idleTimeoutMillis = 30000;
pgConfig.connectionTimeoutMillis = 10000;

const pool = new Pool(pgConfig);

pool.on('error', (err) => {
  console.error('[Database] Unexpected error on idle PostgreSQL client:', err.message || err);
});

console.log(`[Database] Configured to connect to PostgreSQL (SSL: ${!!sslConfig}, Hostname: ${isLocalhost ? 'localhost' : 'remote'}).`);

async function initPgSchema() {
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    console.error('====================================================================');
    console.error('[DATABASE ERROR] Failed to connect to PostgreSQL Database!');
    console.error('Error details:', err.message);
    
    const errMsg = err.message || '';
    if (errMsg.includes('no pg_hba.conf entry') && errMsg.includes('no encryption')) {
      console.error('[DIAGNOSIS] The PostgreSQL server rejected the connection because it was not encrypted (SSL).');
      console.error('[SOLUTION] Please verify DATABASE_SSL=true in server/.env or append ?sslmode=require to your DATABASE_URL.');
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
        category VARCHAR(50) DEFAULT 'Offline',
        description TEXT,
        redirect_url_template TEXT,
        display_order INTEGER DEFAULT 1,
        active BOOLEAN DEFAULT TRUE,
        thumbnail_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        locations JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id VARCHAR(50) PRIMARY KEY,
        urn VARCHAR(100) UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(255),
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
        utm_source VARCHAR(100),
        utm_info TEXT,
        utm_creative_format VARCHAR(100),
        utm_medium VARCHAR(100),
        utm_campaign VARCHAR(255),
        utm_term VARCHAR(255),
        utm_content VARCHAR(255),
        utm_channel VARCHAR(100),
        utm_category VARCHAR(100),
        fbclid VARCHAR(255),
        gclid VARCHAR(255),
        gclsrc VARCHAR(100),
        dclid VARCHAR(255),
        msclkid VARCHAR(255),
        ttclid VARCHAR(255),
        twclid VARCHAR(255),
        li_fat_id VARCHAR(255),
        utm_id VARCHAR(255),
        utm_creative VARCHAR(255),
        utm_keyword VARCHAR(255),
        utm_matchtype VARCHAR(100),
        utm_network VARCHAR(100),
        utm_placement VARCHAR(255),
        utm_device VARCHAR(100),
        utm_location VARCHAR(255),
        gbraid VARCHAR(255),
        wbraid VARCHAR(255),
        landing_page TEXT,
        first_landing_page TEXT,
        referrer TEXT,
        ad_id VARCHAR(100),
        utm_params JSONB DEFAULT '{}',
        redirect_url TEXT,
        ip_address VARCHAR(100),
        user_agent TEXT,
        capi_status VARCHAR(50),
        capi_response JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS otp_log (
        phone VARCHAR(50) PRIMARY KEY,
        otp VARCHAR(10) NOT NULL,
        created_at BIGINT NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        attempts INTEGER DEFAULT 0
      )
    `);

    try {
      await client.query("UPDATE cards SET category = 'Offline' WHERE category NOT IN ('Offline', 'Digital')");
    } catch (migErr) {}

    try {
      await client.query("ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_locations JSONB DEFAULT '[]'");
    } catch (migErr) {}

    try {
      await client.query("ALTER TABLE cards ADD COLUMN IF NOT EXISTS ad_id VARCHAR(100)");
      await client.query("ALTER TABLE cards ADD COLUMN IF NOT EXISTS utm_internal VARCHAR(100)");
      await client.query("ALTER TABLE cards ALTER COLUMN ad_id TYPE TEXT");
    } catch (migErr) {}

    try {
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_id VARCHAR(255)");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_creative VARCHAR(255)");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_keyword VARCHAR(255)");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_matchtype VARCHAR(100)");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_network VARCHAR(100)");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_placement VARCHAR(255)");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_device VARCHAR(100)");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_location VARCHAR(255)");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS gbraid VARCHAR(255)");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS wbraid VARCHAR(255)");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS landing_page TEXT");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_landing_page TEXT");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS referrer TEXT");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS ad_id VARCHAR(100)");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_internal VARCHAR(100)");
      await client.query("ALTER TABLE leads ALTER COLUMN ad_id TYPE TEXT");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_credit_card VARCHAR(100)");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS pincode VARCHAR(100)");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS monthly_income VARCHAR(100)");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS mis_status VARCHAR(100)");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS mis_mapped_at TIMESTAMP WITH TIME ZONE");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS mis_data JSONB DEFAULT '{}'");
    } catch (migErr) {}

    try {
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100)");
    } catch (migErr) {}
    try {
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS user_agent TEXT");
    } catch (migErr) {}
    try {
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS capi_status VARCHAR(50)");
    } catch (migErr) {}
    try {
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS capi_response JSONB");
    } catch (migErr) {}
    try {
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS pan_no VARCHAR(50)");
    } catch (migErr) {}
    try {
      await client.query("ALTER TABLE agents ADD COLUMN IF NOT EXISTS assigned_bank VARCHAR(255)");
    } catch (migErr) {}

    try {
      const formSchemaQuery = await client.query("SELECT value FROM settings WHERE key = 'landing_form_schema'");
      if (formSchemaQuery.rows.length > 0) {
        const currentVal = formSchemaQuery.rows[0].value;
        const currentSchema = typeof currentVal === 'string' ? JSON.parse(currentVal) : currentVal;
        if (currentSchema && currentSchema.fields && !currentSchema.fields.pan_no) {
          currentSchema.fields.pan_no = {
            visible: true,
            required: true,
            label: "PAN Card Number",
            placeholder: "Enter 10-digit PAN Number"
          };
          await client.query("UPDATE settings SET value = $1 WHERE key = 'landing_form_schema'", [JSON.stringify(currentSchema)]);
          console.log('[Database] Migrated existing landing_form_schema with pan_no field.');
        }
      }
    } catch (e) {
      console.error('[Database] Failed to migrate existing landing_form_schema:', e);
    }

    try {
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_agent_id ON leads(agent_id)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_urn ON leads(urn)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_card_id ON leads(card_id)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source)");
    } catch (migErr) {}

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
        ('whatsapp_gateway', 'meta'),
        ('csv_export_template', $1)
      `, [DEFAULT_CSV_TEMPLATE]);
    }

    // Ensure existing csv_export_template settings key is updated with monthly_income, pincode, has_credit_card
    const csvExportTemplateQuery = await client.query("SELECT value FROM settings WHERE key = 'csv_export_template'");
    if (csvExportTemplateQuery.rows.length > 0) {
      try {
        const currentVal = csvExportTemplateQuery.rows[0].value;
        const currentCols = typeof currentVal === 'string' ? JSON.parse(currentVal) : currentVal;
        if (Array.isArray(currentCols)) {
          let updated = false;
          const targetFields = [
            { id: "has_credit_card", header: "Already Has Credit Card?", source: "has_credit_card" },
            { id: "pincode", header: "Residence Pincode", source: "pincode" },
            { id: "monthly_income", header: "Monthly Income", source: "monthly_income" },
            { id: "pan_no", header: "PAN Number", source: "pan_no" }
          ];
          for (const target of targetFields) {
            const exists = currentCols.some(col => col.id === target.id || col.source === target.source);
            if (!exists) {
              currentCols.push(target);
              updated = true;
            }
          }
          if (updated) {
            await client.query("UPDATE settings SET value = $1 WHERE key = 'csv_export_template'", [JSON.stringify(currentCols)]);
            console.log('[Database] Migrated existing csv_export_template with monthly_income, has_credit_card, pincode, and pan_no columns.');
          }
        }
      } catch (e) {
        console.error('[Database] Failed to migrate existing csv_export_template:', e);
      }
    }

    const formSchemaCheck = await client.query("SELECT COUNT(*) FROM settings WHERE key = 'landing_form_schema'");
    if (parseInt(formSchemaCheck.rows[0].count, 10) === 0) {
      await client.query("INSERT INTO settings (key, value) VALUES ('landing_form_schema', $1)", [
        JSON.stringify({
          fields: {
            fullName: {
              visible: true,
              required: true,
              label: "Full Name (as per PAN Card)",
              placeholder: "Enter your full name as per PAN Card"
            },
            phone: {
              visible: true,
              required: true,
              label: "Mobile Number",
              placeholder: "Enter your mobile number"
            },
            email: {
              visible: true,
              required: true,
              label: "Email Id",
              placeholder: "Enter your email ID"
            },
            has_credit_card: {
              visible: true,
              required: true,
              label: "Do you already have a credit card?"
            },
            employment: {
              visible: true,
              required: true,
              label: "Employment Type",
              options: [
                { value: "Salaried", enabled: true },
                { value: "Self Employed (Business)", enabled: false },
                { value: "Self Employed (Professional)", enabled: false }
              ]
            },
             monthly_income: {
              visible: true,
              required: true,
              label: "Net Monthly Income",
              placeholder: "Net Monthly Income"
            },
            pan_no: {
              visible: true,
              required: true,
              label: "PAN Card Number",
              placeholder: "Enter 10-digit PAN Number"
            },
            pincode: {
              visible: true,
              required: true,
              label: "Residence Pincode",
              placeholder: "Residence Pincode"
            }
          }
        })
      ]);
    }

    const pincodeModeCheck = await client.query("SELECT COUNT(*) FROM settings WHERE key = 'pincode_serviceability_mode'");
    if (parseInt(pincodeModeCheck.rows[0].count, 10) === 0) {
      await client.query("INSERT INTO settings (key, value) VALUES ('pincode_serviceability_mode', 'all')");
    }
    const pincodeListCheck = await client.query("SELECT COUNT(*) FROM settings WHERE key = 'pincode_serviceability_list'");
    if (parseInt(pincodeListCheck.rows[0].count, 10) === 0) {
      await client.query("INSERT INTO settings (key, value) VALUES ('pincode_serviceability_list', '')");
    }
    const cardBanksCheck = await client.query("SELECT COUNT(*) FROM settings WHERE key = 'card_manager_banks'");
    if (parseInt(cardBanksCheck.rows[0].count, 10) === 0) {
      await client.query("INSERT INTO settings (key, value) VALUES ('card_manager_banks', 'HDFC,SBI')");
    }


    await client.query('COMMIT');
    console.log('[Database] PostgreSQL tables checked, initialized and seeded.');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (rbErr) {}
    console.error('[DATABASE ERROR] Failed to execute PostgreSQL migration schema!', err.message);
    throw err;
  } finally {
    if (client) {
      try {
        client.release();
      } catch (relErr) {
        // ignore release error
      }
    }
  }
}

const db = {
  pool,
  // Initialize Database Schema (PG only) with connection retry safety
  async init() {
    let retries = 5;
    while (retries > 0) {
      try {
        await initPgSchema();
        return;
      } catch (err) {
        retries--;
        console.error(`[Database] Connection/initialization failed (retries left: ${retries}):`, err.message);
        if (retries === 0) {
          throw new Error('All database connection retry attempts exhausted. Continuing server execution with offline database status.');
        }
        // Wait 3 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  },

  // --- Leads ---
  async getLeads() {
    const res = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
    return res.rows.map(row => ({
      ...row,
      utm_params: typeof row.utm_params === 'string' ? JSON.parse(row.utm_params) : (row.utm_params || {})
    }));
  },

  async getLeadByUrn(urn) {
    const res = await pool.query('SELECT * FROM leads WHERE urn = $1 LIMIT 1', [urn]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      ...row,
      utm_params: typeof row.utm_params === 'string' ? JSON.parse(row.utm_params) : (row.utm_params || {})
    };
  },

  async getAgentByUsername(username) {
    const res = await pool.query('SELECT * FROM agents WHERE username = $1 AND status = \'active\' LIMIT 1', [username]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      ...row,
      locations: typeof row.locations === 'string' ? JSON.parse(row.locations) : (row.locations || [])
    };
  },

  async getLeadsFiltered({ agentId, page = 1, limit = 50, search = '', card = '', source = '', startDate = '', endDate = '' }) {
    let query = 'SELECT * FROM leads';
    let countQuery = 'SELECT COUNT(*) FROM leads';
    const params = [];
    const clauses = [];
    
    if (agentId) {
      params.push(agentId);
      clauses.push(`agent_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search.trim().toLowerCase()}%`);
      clauses.push(`(LOWER(full_name) LIKE $${params.length} OR phone LIKE $${params.length} OR LOWER(urn) LIKE $${params.length} OR LOWER(pan_no) LIKE $${params.length})`);
    }
    if (card) {
      params.push(card);
      clauses.push(`card_id = $${params.length}`);
    }
    if (source) {
      params.push(source);
      clauses.push(`source = $${params.length}`);
    }
    if (startDate) {
      params.push(startDate);
      clauses.push(`created_at >= $${params.length}::timestamp`);
    }
    if (endDate) {
      params.push(endDate + ' 23:59:59');
      clauses.push(`created_at <= $${params.length}::timestamp`);
    }
    
    if (clauses.length > 0) {
      const whereClause = ' WHERE ' + clauses.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }
    
    // Get total matching count
    const countRes = await pool.query(countQuery, params);
    const total = parseInt(countRes.rows[0].count, 10);
    
    // Pagination
    const offset = (page - 1) * limit;
    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);
    
    const res = await pool.query(query, params);
    const leads = res.rows.map(row => ({
      ...row,
      utm_params: typeof row.utm_params === 'string' ? JSON.parse(row.utm_params) : (row.utm_params || {})
    }));
    
    // Today's leads count (IST)
    const todayISTStr = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
    const todayISTDate = new Date(todayISTStr);
    const yyyy = todayISTDate.getFullYear();
    const mm = String(todayISTDate.getMonth() + 1).padStart(2, '0');
    const dd = String(todayISTDate.getDate()).padStart(2, '0');
    const todayIST = `${yyyy}-${mm}-${dd}`;

    const todayRes = await pool.query('SELECT COUNT(*) FROM leads WHERE created_at >= $1::timestamp', [todayIST + ' 00:00:00']);
    const todaysCount = parseInt(todayRes.rows[0].count, 10);

    return {
      leads,
      total,
      todaysCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  async getLeadsForExport({ startDate, endDate }) {
    let query = 'SELECT * FROM leads';
    const params = [];
    const clauses = [];
    
    if (startDate) {
      params.push(startDate);
      clauses.push(`created_at >= $${params.length}::timestamp`);
    }
    if (endDate) {
      params.push(endDate + ' 23:59:59');
      clauses.push(`created_at <= $${params.length}::timestamp`);
    }
    
    if (clauses.length > 0) {
      query += ' WHERE ' + clauses.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC';
    
    const res = await pool.query(query, params);
    return res.rows.map(row => ({
      ...row,
      utm_params: typeof row.utm_params === 'string' ? JSON.parse(row.utm_params) : (row.utm_params || {})
    }));
  },

  async addLead(lead) {
    const now = new Date();
    const formatterObj = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatterObj.formatToParts(now);
    const dateMap = {};
    parts.forEach(p => dateMap[p.type] = p.value);
    const yearStr = dateMap.year;
    const monthLetter = String.fromCharCode(65 + (parseInt(dateMap.month, 10) - 1));
    const dayStr = dateMap.day;
    const prefix = `FM${yearStr}${monthLetter}${dayStr}`;
    
    const seqQuery = await pool.query('SELECT urn FROM leads WHERE urn LIKE $1', [`${prefix}%`]);
    let sequence = 1;
    if (seqQuery.rows.length > 0) {
      const sequences = seqQuery.rows.map(row => {
        const seqStr = row.urn.replace(prefix, '');
        return parseInt(seqStr, 10) || 0;
      });
      sequence = Math.max(...sequences) + 1;
    }
    const urn = `${prefix}${String(sequence).padStart(5, '0')}`;
    const id = 'lead_' + Math.random().toString(36).substr(2, 9);
    await pool.query(
      `INSERT INTO leads (
        id, urn, full_name, phone, email, city, employment, income_range, card_id, card_name, card_bank, 
        source, agent_id, agent_name, agent_location, consent, 
        utm_source, utm_info, utm_creative_format, utm_medium, utm_campaign, utm_term, utm_content, utm_channel, utm_category, fbclid,
        gclid, gclsrc, dclid, msclkid, ttclid, twclid, li_fat_id,
        utm_id, utm_creative, utm_keyword, utm_matchtype, utm_network, utm_placement,
        utm_device, utm_location, gbraid, wbraid, landing_page, first_landing_page, referrer, ad_id,
        utm_params, redirect_url, ip_address, user_agent, capi_status, capi_response, utm_internal, has_credit_card, pincode, monthly_income, pan_no, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, NOW())`,
      [
        id, urn, lead.full_name, lead.phone, lead.email, lead.city, lead.employment, lead.income_range,
        lead.card_id, lead.card_name, lead.card_bank, lead.source || 'public', lead.agent_id, lead.agent_name,
        lead.agent_location, lead.consent !== undefined ? lead.consent : true,
        lead.utm_source, lead.utm_info, lead.utm_creative_format, lead.utm_medium, lead.utm_campaign, lead.utm_term, lead.utm_content, lead.utm_channel, lead.utm_category, lead.fbclid,
        lead.gclid, lead.gclsrc, lead.dclid, lead.msclkid, lead.ttclid, lead.twclid, lead.li_fat_id,
        lead.utm_id, lead.utm_creative, lead.utm_keyword, lead.utm_matchtype, lead.utm_network, lead.utm_placement,
        lead.utm_device, lead.utm_location, lead.gbraid, lead.wbraid, lead.landing_page, lead.first_landing_page, lead.referrer, lead.ad_id,
        JSON.stringify(lead.utm_params || {}), lead.redirect_url || '',
        lead.ip_address || null, lead.user_agent || null, lead.capi_status || null,
        lead.capi_response ? JSON.stringify(lead.capi_response) : null,
        lead.utm_internal || null,
        lead.has_credit_card || null,
        lead.pincode || null,
        lead.monthly_income || null,
        lead.pan_no || null
      ]
    );
    return { id, urn, ...lead, created_at: new Date().toISOString() };
  },

  async updateLead(id, lead) {
    await pool.query(
      `UPDATE leads SET 
        full_name = $1, phone = $2, email = $3, city = $4, employment = $5, income_range = $6,
        card_id = $7, card_name = $8, card_bank = $9, source = $10, agent_id = $11, agent_name = $12, agent_location = $13, consent = $14,
        utm_source = $15, utm_info = $16, utm_creative_format = $17, utm_medium = $18, utm_campaign = $19, utm_term = $20, utm_content = $21, utm_channel = $22, utm_category = $23, fbclid = $24,
        gclid = $25, gclsrc = $26, dclid = $27, msclkid = $28, ttclid = $29, twclid = $30, li_fat_id = $31,
        utm_id = $32, utm_creative = $33, utm_keyword = $34, utm_matchtype = $35, utm_network = $36, utm_placement = $37,
        utm_device = $38, utm_location = $39, gbraid = $40, wbraid = $41, landing_page = $42, first_landing_page = $43, referrer = $44, ad_id = $45,
        utm_params = $46, redirect_url = $47, ip_address = $48, user_agent = $49, capi_status = $50, capi_response = $51, utm_internal = $52,
        has_credit_card = $53, pincode = $54, monthly_income = $55, pan_no = $56
       WHERE id = $57`,
      [
        lead.full_name, lead.phone, lead.email, lead.city, lead.employment, lead.income_range,
        lead.card_id, lead.card_name, lead.card_bank, lead.source, lead.agent_id, lead.agent_name, lead.agent_location, lead.consent,
        lead.utm_source, lead.utm_info, lead.utm_creative_format, lead.utm_medium, lead.utm_campaign, lead.utm_term, lead.utm_content, lead.utm_channel, lead.utm_category, lead.fbclid,
        lead.gclid, lead.gclsrc, lead.dclid, lead.msclkid, lead.ttclid, lead.twclid, lead.li_fat_id,
        lead.utm_id, lead.utm_creative, lead.utm_keyword, lead.utm_matchtype, lead.utm_network, lead.utm_placement,
        lead.utm_device, lead.utm_location, lead.gbraid, lead.wbraid, lead.landing_page, lead.first_landing_page, lead.referrer, lead.ad_id,
        JSON.stringify(lead.utm_params || {}), lead.redirect_url || '',
        lead.ip_address, lead.user_agent, lead.capi_status,
        lead.capi_response ? JSON.stringify(lead.capi_response) : null,
        lead.utm_internal || null,
        lead.has_credit_card || null,
        lead.pincode || null,
        lead.monthly_income || null,
        lead.pan_no || null,
        id
      ]
    );
    return { id, ...lead };
  },

  async deleteLead(id) {
    await pool.query('DELETE FROM leads WHERE id = $1', [id]);
    return true;
  },

  async deleteLeads(ids) {
    await pool.query('DELETE FROM leads WHERE id = ANY($1::varchar[])', [ids]);
    return true;
  },

  async unmapLead(id) {
    await pool.query("UPDATE leads SET mis_status = NULL, mis_mapped_at = NULL, mis_data = '{}' WHERE id = $1", [id]);
    return true;
  },

  async unmapLeads(ids) {
    await pool.query("UPDATE leads SET mis_status = NULL, mis_mapped_at = NULL, mis_data = '{}' WHERE id = ANY($1::varchar[])", [ids]);
    return true;
  },

  // --- Cards ---
  async getCards(includeInactive = false) {
    const res = includeInactive
      ? await pool.query('SELECT * FROM cards ORDER BY display_order ASC')
      : await pool.query('SELECT * FROM cards WHERE active = true ORDER BY display_order ASC');
    return res.rows.map(row => ({
      ...row,
      card_locations: typeof row.card_locations === 'string' ? JSON.parse(row.card_locations) : (row.card_locations || [])
    }));
  },

  async addCard(card) {
    const id = 'card_' + Math.random().toString(36).substr(2, 9);
    const displayOrder = card.display_order || 1;
    const active = card.active !== undefined ? card.active : true;
    const cardLocationsJson = JSON.stringify(card.card_locations || []);
    await pool.query(
      'INSERT INTO cards (id, name, bank, category, description, redirect_url_template, display_order, active, thumbnail_url, card_locations, ad_id, utm_internal) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
      [id, card.name, card.bank, card.category, card.description, card.redirect_url_template, displayOrder, active, card.thumbnail_url || '', cardLocationsJson, card.ad_id || '', card.utm_internal || '']
    );
    return { id, ...card, display_order: displayOrder, active, card_locations: card.card_locations || [] };
  },

  async updateCard(id, cardData) {
    const fields = [];
    const values = [];
    let idx = 1;
    for (const [key, val] of Object.entries(cardData)) {
      if (['name', 'bank', 'category', 'description', 'redirect_url_template', 'display_order', 'active', 'thumbnail_url', 'ad_id', 'utm_internal'].includes(key)) {
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
  },

  async deleteCard(id) {
    await pool.query('DELETE FROM cards WHERE id = $1', [id]);
    return true;
  },

  // --- Agents ---
  async getAgents() {
    const res = await pool.query('SELECT * FROM agents ORDER BY created_at ASC');
    return res.rows.map(row => ({
      ...row,
      locations: typeof row.locations === 'string' ? JSON.parse(row.locations) : row.locations
    }));
  },

  async addAgent(agent) {
    const locationsJson = JSON.stringify(agent.locations || []);
    await pool.query(
      'INSERT INTO agents (id, name, phone, email, username, password_hash, status, locations, assigned_bank, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())',
      [agent.id, agent.name, agent.phone || '', agent.email || '', agent.username, agent.password_hash, agent.status || 'active', locationsJson, agent.assigned_bank || null]
    );
    return agent;
  },

  async updateAgent(id, agentData) {
    const fields = [];
    const values = [];
    let idx = 1;
    for (const [key, val] of Object.entries(agentData)) {
      if (['name', 'phone', 'email', 'username', 'password_hash', 'status', 'assigned_bank'].includes(key)) {
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
  },

  async deleteAgent(id) {
    await pool.query('DELETE FROM agents WHERE id = $1', [id]);
    return true;
  },

  // --- Locations ---
  async getLocations() {
    const res = await pool.query('SELECT * FROM locations ORDER BY created_at ASC');
    return res.rows;
  },

  async addLocation(loc) {
    const id = 'loc_' + Math.random().toString(36).substr(2, 9);
    const name = loc.name;
    const active = loc.active !== undefined ? loc.active : true;
    await pool.query(
      'INSERT INTO locations (id, name, active, created_at) VALUES ($1, $2, $3, NOW())',
      [id, name, active]
    );
    return { id, name, active };
  },

  async updateLocation(id, locData) {
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
  },

  async deleteLocation(id) {
    await pool.query('DELETE FROM locations WHERE id = $1', [id]);
    return true;
  },

  // --- Settings ---
  async getSettings() {
    const res = await pool.query('SELECT * FROM settings');
    const settings = {};
    res.rows.forEach(row => {
      const val = row.value ? String(row.value).trim() : '';
      if (val && val !== 'undefined' && val !== 'null') {
        settings[row.key] = val;
      }
    });
    if (settings.whatsapp_gateway === undefined) {
      settings.whatsapp_gateway = 'meta';
    }
    if (settings.csv_export_template === undefined) {
      settings.csv_export_template = DEFAULT_CSV_TEMPLATE;
    }
    return settings;
  },


  async updateSettings(settingsData) {
    for (const [key, value] of Object.entries(settingsData)) {
      if (value !== undefined && value !== null) {
        await pool.query(`
          INSERT INTO settings (key, value) VALUES ($1, $2)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        `, [key, String(value).trim()]);
      }
    }
    return this.getSettings();
  },


  // --- OTP Logging & Verification ---
  async saveOTP(phone, otp) {
    const now = new Date().getTime();
    await pool.query(`
      INSERT INTO otp_log (phone, otp, created_at, verified, attempts)
      VALUES ($1, $2, $3, false, 0)
      ON CONFLICT (phone) DO UPDATE
      SET otp = EXCLUDED.otp, created_at = EXCLUDED.created_at, verified = false, attempts = 0
    `, [phone, otp, now]);
    return true;
  },

  async verifyOTP(phone, otp) {
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
  },

  async updateLeadMISStatus(id, misStatus, misData) {
    const res = await pool.query(
      `UPDATE leads 
       SET mis_status = $1, mis_mapped_at = NOW(), mis_data = $2
       WHERE id = $3
       RETURNING id, urn, full_name`,
      [misStatus, JSON.stringify(misData), id]
    );
    return res.rows[0] || null;
  },

  async getMISStats() {
    // 1. Total Leads
    const totalLeadsRes = await pool.query('SELECT COUNT(*) FROM leads');
    const totalLeads = parseInt(totalLeadsRes.rows[0].count, 10);

    // Get all mapped leads
    const mappedLeadsListRes = await pool.query('SELECT * FROM leads WHERE mis_status IS NOT NULL ORDER BY mis_mapped_at DESC');
    
    // Flatten / clean history list in JS
    const expandedList = [];
    mappedLeadsListRes.rows.forEach(row => {
      let misDataObj = {};
      try {
        misDataObj = typeof row.mis_data === 'string' ? JSON.parse(row.mis_data) : (row.mis_data || {});
        // Fall back gracefully for legacy history objects: extract the latest entry
        if (misDataObj && Array.isArray(misDataObj.history) && misDataObj.history.length > 0) {
          const latest = misDataObj.history[misDataObj.history.length - 1];
          misDataObj = latest.data || {};
        }
      } catch (e) {
        misDataObj = {};
      }

      expandedList.push({
        ...row,
        mis_data: misDataObj,
        utm_params: typeof row.utm_params === 'string' ? JSON.parse(row.utm_params) : (row.utm_params || {})
      });
    });

    const totalMapped = expandedList.length;

    // 3. Status breakdown
    const statusBreakdown = {};
    expandedList.forEach(r => {
      const status = r.mis_status || 'Unknown';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    });

    // 4. Card name distribution
    const cardDistMap = {};
    expandedList.forEach(r => {
      const cardName = r.mis_data?.card_name || 'Unknown';
      cardDistMap[cardName] = (cardDistMap[cardName] || 0) + 1;
    });
    const cardDistribution = Object.entries(cardDistMap).map(([name, count]) => ({ name, count }));

    // 5. Timeline - mapped count over past 15 days
    const timelineMap = {};
    expandedList.forEach(r => {
      if (r.mis_mapped_at) {
        const dateStr = new Date(r.mis_mapped_at).toISOString().split('T')[0];
        timelineMap[dateStr] = (timelineMap[dateStr] || 0) + 1;
      }
    });
    const timeline = Object.entries(timelineMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-15);

    // 6. KYC Type distribution
    const kycMap = {};
    expandedList.forEach(r => {
      const kycType = r.mis_data?.kyc_type || 'Unknown';
      kycMap[kycType] = (kycMap[kycType] || 0) + 1;
    });
    const kycDistribution = Object.entries(kycMap).map(([name, count]) => ({ name, count }));

    // 7. Source Type distribution
    const sourceMap = {};
    expandedList.forEach(r => {
      let sourceType = String(r.mis_data?.source_type || '').trim();
      if (!sourceType || sourceType === '-') sourceType = 'Blank';
      sourceMap[sourceType] = (sourceMap[sourceType] || 0) + 1;
    });
    const sourceDistribution = Object.entries(sourceMap).map(([name, count]) => ({ name, count }));

    // 8. Card Type distribution
    const cardTypeMap = {};
    expandedList.forEach(r => {
      const cardType = r.mis_data?.card_type || 'Unknown';
      cardTypeMap[cardType] = (cardTypeMap[cardType] || 0) + 1;
    });
    const cardTypeDistribution = Object.entries(cardTypeMap).map(([name, count]) => ({ name, count }));

    // 9. Customer Type distribution
    const custTypeMap = {};
    expandedList.forEach(r => {
      const custType = r.mis_data?.customer_type || 'Unknown';
      custTypeMap[custType] = (custTypeMap[custType] || 0) + 1;
    });
    const customerTypeDistribution = Object.entries(custTypeMap).map(([name, count]) => ({ name, count }));

    // 10. Card Activation Status distribution
    const activeStatusMap = {};
    expandedList.forEach(r => {
      const act = r.mis_data?.card_activation_status || 'Inactive/Unknown';
      activeStatusMap[act] = (activeStatusMap[act] || 0) + 1;
    });
    const activationStatusDistribution = Object.entries(activeStatusMap).map(([name, count]) => ({ name, count }));

    // 11. Pincode mapping for Heatmap
    const pinMap = {};
    expandedList.forEach(r => {
      const pin = r.mis_data?.PIN_CODE || r.mis_data?.pin_code || r.pincode || 'Unknown';
      pinMap[pin] = (pinMap[pin] || 0) + 1;
    });
    const pincodeHeatmap = Object.entries(pinMap)
      .map(([pincode, count]) => ({ pincode, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 100);

    // 12. Full funnel analytics
    const funnelSubmit = totalLeads;
    
    const funnelIpa = expandedList.filter(l => {
      const ipa = String(l.mis_data?.ipa_status || '').toLowerCase();
      return ipa.includes('approve') || ipa.includes('success');
    }).length;

    const funnelKyc = expandedList.filter(l => {
      const ks = String(l.mis_data?.kyc_status || '').toLowerCase();
      const vs = String(l.mis_data?.vkyc_status || '').toLowerCase();
      const kt = String(l.mis_data?.kyc_type || '').toLowerCase();
      return ks.includes('success') || ks.includes('complete') || vs.includes('success') || vs.includes('complete') || ks.includes('biokyc') || kt.includes('biokyc');
    }).length;

    const funnelDecision = expandedList.filter(l => {
      const dec = String(l.mis_data?.final_decision || '').toLowerCase();
      return dec.includes('approve') || dec.includes('success');
    }).length;

    const funnelActive = expandedList.filter(l => {
      const act = String(l.mis_data?.card_activation_status || '').toLowerCase();
      return act.includes('active') || act === 'yes';
    }).length;

    return {
      totalLeads,
      totalMapped,
      statusBreakdown,
      cardDistribution,
      timeline,
      kycDistribution,
      sourceDistribution,
      cardTypeDistribution,
      customerTypeDistribution,
      activationStatusDistribution,
      pincodeHeatmap,
      mappedLeadsList: expandedList,
      funnel: {
        submit: funnelSubmit,
        ipa: funnelIpa,
        kyc: funnelKyc,
        decision: funnelDecision,
        active: funnelActive
      }
    };
  },

  async bulkUpdateLeadMISStatus(updates) {
    if (!updates || updates.length === 0) return;
    const batchSize = 1000;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      const valueLines = [];
      const queryParams = [];
      let paramIndex = 1;
      
      batch.forEach(up => {
        valueLines.push(`($${paramIndex}::varchar, $${paramIndex + 1}::varchar, $${paramIndex + 2}::jsonb)`);
        queryParams.push(up.id);
        queryParams.push(up.status);
        queryParams.push(JSON.stringify(up.data));
        paramIndex += 3;
      });
      
      const queryText = `
        UPDATE leads AS l
        SET mis_status = tmp.mis_status,
            mis_mapped_at = NOW(),
            mis_data = tmp.mis_data
        FROM (VALUES ${valueLines.join(', ')}) AS tmp(id, mis_status, mis_data)
        WHERE l.id = tmp.id
      `;
      
      await pool.query(queryText, queryParams);
    }
  }
}

module.exports = db;
