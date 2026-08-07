const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const DEFAULT_CSV_TEMPLATE = JSON.stringify([
  { id: "urn", header: "URN", source: "urn" },
  { id: "application_id", header: "Application ID", source: "application_id" },
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
  { id: "monthly_income", header: "Monthly Income", source: "monthly_income" },
  { id: "dob", header: "Date of Birth", source: "dob" },
  { id: "mother_name", header: "Mother's Name", source: "mother_name" },
  { id: "current_address", header: "Current Address", source: "current_address" },
  { id: "designation", header: "Designation", source: "designation" },
  { id: "company_name", header: "Company / Employer", source: "company_name" }
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
pgConfig.max = 10;
pgConfig.idleTimeoutMillis = 0; // Never kill idle connections (we manage via heartbeat)
pgConfig.connectionTimeoutMillis = 20000;
pgConfig.keepAlive = true;
pgConfig.keepAliveInitialDelayMillis = 10000;
pgConfig.statement_timeout = 120000; // 2 minutes statement timeout for heavy queries
pgConfig.allowExitOnIdle = false;

const pool = new Pool(pgConfig);

pool.on('error', (err) => {
  console.error('[Database] Unexpected error on idle PostgreSQL client:', err.message || err);
});

// Heartbeat: ping the database every 2 minutes to keep connections alive
// This prevents cloud PostgreSQL providers (Supabase/Neon/RDS) from killing idle connections
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error('[Database] Heartbeat failed:', err.message);
  }
}, 120000); // every 2 minutes

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
      CREATE TABLE IF NOT EXISTS admin_notifications (
        id VARCHAR(50) PRIMARY KEY,
        type VARCHAR(50) DEFAULT 'info',
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        details JSONB DEFAULT '{}',
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Clean up existing repetitive failed sync notifications
    await client.query(`DELETE FROM admin_notifications WHERE title LIKE '%SBI Email MIS Sync Failed%'`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS processed_email_mis (
        id VARCHAR(50) PRIMARY KEY,
        message_uid VARCHAR(255) UNIQUE NOT NULL,
        subject VARCHAR(255),
        sender VARCHAR(255),
        attachment_name VARCHAR(255),
        total_processed INTEGER DEFAULT 0,
        mapped_count INTEGER DEFAULT 0,
        warning_count INTEGER DEFAULT 0,
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
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS application_id VARCHAR(255)");
    } catch (migErr) {}

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
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS dob VARCHAR(50)");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS mother_name VARCHAR(255)");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS current_address TEXT");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS designation VARCHAR(255)");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_name VARCHAR(255)");
    } catch (migErr) {}
    try {
      await client.query("ALTER TABLE agents ADD COLUMN IF NOT EXISTS assigned_bank VARCHAR(255)");
      await client.query("ALTER TABLE agents ADD COLUMN IF NOT EXISTS can_create_leads BOOLEAN DEFAULT TRUE");
      await client.query("ALTER TABLE agents ADD COLUMN IF NOT EXISTS can_upload_mis BOOLEAN DEFAULT FALSE");
      await client.query("ALTER TABLE agents ADD COLUMN IF NOT EXISTS agent_mode VARCHAR(50) DEFAULT 'lead_agent'");
      await client.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS application_id VARCHAR(100)");
    } catch (migErr) {}

    await client.query(`
      CREATE TABLE IF NOT EXISTS uploaded_lead_files (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        file_size INT,
        agent_id VARCHAR(100),
        agent_name VARCHAR(255),
        total_rows INT DEFAULT 0,
        created_count INT DEFAULT 0,
        failed_count INT DEFAULT 0,
        errors JSONB DEFAULT '[]'::jsonb,
        file_path VARCHAR(500) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Performance indexes for high-speed dashboard & repository queries
    try {
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_mis_status ON leads (mis_status) WHERE mis_status IS NOT NULL");
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_mis_mapped_at ON leads (mis_mapped_at DESC) WHERE mis_status IS NOT NULL");
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_mis_mapped_at_all ON leads (mis_mapped_at DESC)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_agent_id ON leads (agent_id)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_application_id ON leads (application_id) WHERE application_id IS NOT NULL");
      await client.query("CREATE INDEX IF NOT EXISTS idx_uploaded_lead_files_created_at ON uploaded_lead_files (created_at DESC)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_card_id ON leads (card_id)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_source ON leads (source)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads (phone)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_urn ON leads (urn)");
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_pan_no ON leads (pan_no) WHERE pan_no IS NOT NULL");
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_utm_campaign ON leads (utm_campaign) WHERE utm_campaign IS NOT NULL AND utm_campaign != ''");
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_utm_term ON leads (utm_term) WHERE utm_term IS NOT NULL AND utm_term != ''");
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_utm_info ON leads (utm_info) WHERE utm_info IS NOT NULL AND utm_info != ''");
      await client.query("CREATE INDEX IF NOT EXISTS idx_leads_card_bank ON leads (card_bank)");
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
            { id: "application_id", header: "Application ID", source: "application_id" },
            { id: "has_credit_card", header: "Already Has Credit Card?", source: "has_credit_card" },
            { id: "pincode", header: "Residence Pincode", source: "pincode" },
            { id: "monthly_income", header: "Monthly Income", source: "monthly_income" },
            { id: "pan_no", header: "PAN Number", source: "pan_no" },
            { id: "dob", header: "Date of Birth", source: "dob" },
            { id: "mother_name", header: "Mother's Name", source: "mother_name" },
            { id: "current_address", header: "Current Address", source: "current_address" },
            { id: "designation", header: "Designation", source: "designation" }
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
    } else {
      const existingCardBanks = await client.query("SELECT value FROM settings WHERE key = 'card_manager_banks'");
      if (existingCardBanks.rows.length > 0) {
        const val = existingCardBanks.rows[0].value || '';
        const unwanted = ['AU', 'AXIS', 'BOB', 'FEDERAL', 'HSBC', 'ICICI', 'IDFC', 'INDUSIND', 'KIWI YES BANK', 'KOTAK', 'N/A', 'STANDARD CHARTERED', 'YES'];
        const filtered = val.split(',')
          .map(b => b.trim())
          .filter(b => b && !unwanted.includes(b.toUpperCase()));
        const cleanedStr = Array.from(new Set(filtered.length > 0 ? filtered : ['HDFC', 'SBI', 'KIWI'])).join(',');
        await client.query("UPDATE settings SET value = $1 WHERE key = 'card_manager_banks'", [cleanedStr]);
      }
    }
    const linkedinCheck = await client.query("SELECT COUNT(*) FROM settings WHERE key = 'linkedin_partner_id'");
    if (parseInt(linkedinCheck.rows[0].count, 10) === 0) {
      await client.query("INSERT INTO settings (key, value) VALUES ('linkedin_partner_id', '9660484')");
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

let _utmOptionsCache = null;
let _utmOptionsCacheTime = 0;

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

  async getAllLeadsUnfiltered() {
    return this.getLeads();
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

  async getUTMFilterOptions() {
    const now = Date.now();
    if (_utmOptionsCache && (now - _utmOptionsCacheTime) < 10 * 60 * 1000) {
      return _utmOptionsCache;
    }
    const [campRes, termRes, infoRes, utmSourceRes, comboRes] = await Promise.all([
      pool.query(`SELECT DISTINCT utm_campaign FROM leads WHERE utm_campaign IS NOT NULL AND utm_campaign != '' ORDER BY utm_campaign`),
      pool.query(`SELECT DISTINCT utm_term FROM leads WHERE utm_term IS NOT NULL AND utm_term != '' ORDER BY utm_term`),
      pool.query(`SELECT DISTINCT utm_info FROM leads WHERE utm_info IS NOT NULL AND utm_info != '' ORDER BY utm_info`),
      pool.query(`SELECT DISTINCT utm_source FROM leads WHERE utm_source IS NOT NULL AND utm_source != '' ORDER BY utm_source`),
      pool.query(`SELECT DISTINCT card_bank, card_name, source, agent_name, utm_source FROM leads`)
    ]);

    const sourceSet = new Set();
    const utmSourceSet = new Set(['META', 'GOOGLE', 'LINKEDIN', 'INSTAGRAM', 'PUBLIC', 'AGENT', 'FACEBOOK', 'CHATGPT.COM', 'EXCEL_UPLOAD']);

    utmSourceRes.rows.forEach(r => {
      if (r.utm_source) {
        const u = r.utm_source.toUpperCase().trim();
        if (u) {
          utmSourceSet.add(u);
          sourceSet.add(u);
        }
      }
    });

    comboRes.rows.forEach(r => {
      const cardName = (r.card_name || '').trim();
      let bank = (r.card_bank || r.card_name || '').toUpperCase().trim();
      if (bank.includes('SBI')) bank = 'SBI';
      else if (bank.includes('KIWI') || bank.includes('YES')) bank = 'KIWI';
      else if (bank.includes('HDFC')) bank = 'HDFC';
      else if (bank.includes('SCAPIA') || bank.includes('BOB')) bank = 'SCAPIA';
      else if (!bank) bank = 'PUBLIC';

      const isAgent = r.source === 'agent';
      const agentName = r.agent_name || 'Staff';
      const utmSrc = r.utm_source ? r.utm_source.toUpperCase().trim() : 'PUBLIC';

      let displayBank = isAgent ? `${bank} (${agentName})` : `${bank} (${utmSrc})`;
      if (displayBank) {
        sourceSet.add(displayBank);
        if (!isAgent) {
          utmSourceSet.add(displayBank);
        }
      }

      if (cardName) {
        const displayCard = isAgent ? `${cardName} (${agentName})` : `${cardName} (${utmSrc})`;
        sourceSet.add(displayCard);
        if (!isAgent) {
          utmSourceSet.add(displayCard);
        }
      }
    });

    _utmOptionsCache = {
      sources: Array.from(sourceSet).sort(),
      utm_sources: Array.from(utmSourceSet).sort(),
      campaigns: campRes.rows.map(r => r.utm_campaign),
      terms: termRes.rows.map(r => r.utm_term),
      infos: infoRes.rows.map(r => r.utm_info)
    };
    _utmOptionsCacheTime = now;
    return _utmOptionsCache;
  },

  clearUTMCache() {
    _utmOptionsCache = null;
    _utmOptionsCacheTime = 0;
  },

  async getLeadsFiltered({ agentId = null, bankMisFilter = null, page = 1, limit = 50, search = '', card = '', source = '', utmSource = '', startDate = '', endDate = '', campaign = '', term = '', info = '' }) {
    const LEAD_COLUMNS = `id, urn, full_name, phone, email, city, employment, income_range,
      card_id, card_name, card_bank, source, agent_id, agent_name, agent_location, consent, application_id,
      created_at, mis_status, mis_mapped_at, pan_no, pincode, has_credit_card, monthly_income,
      dob, mother_name, current_address, designation, company_name, redirect_url,
      utm_source, utm_info, utm_creative_format, utm_medium, utm_campaign, utm_term, utm_content, utm_channel, utm_category, fbclid,
      gclid, gclsrc, dclid, msclkid, ttclid, twclid, li_fat_id,
      utm_id, utm_creative, utm_keyword, utm_matchtype, utm_network, utm_placement,
      utm_device, utm_location, gbraid, wbraid, landing_page, first_landing_page, referrer, ad_id, utm_internal, utm_params`;

    let whereClause = '';
    const params = [];
    const clauses = [];
    
    if (bankMisFilter) {
      const cleanBank = String(bankMisFilter).toLowerCase().trim().replace(/\s+bank$/i, '').trim();
      if (cleanBank) {
        params.push(`%${cleanBank}%`);
        const pIdx = params.length;
        if (cleanBank === 'kiwi') {
          clauses.push(`(
            LOWER(card_bank) LIKE $${pIdx}
            OR LOWER(mis_data->>'mis_bank_name') LIKE $${pIdx}
            OR LOWER(card_name) LIKE $${pIdx}
            OR mis_data->>'kiwi_bank' IS NOT NULL
            OR mis_data->>'kiwi_winning_bank' IS NOT NULL
          )`);
        } else {
          clauses.push(`(
            LOWER(card_bank) LIKE $${pIdx}
            OR LOWER(mis_data->>'mis_bank_name') LIKE $${pIdx}
            OR LOWER(card_name) LIKE $${pIdx}
          )`);
        }
      }
    } else if (agentId) {
      const cleanAgentId = agentId.toLowerCase().trim();
      const alnumAgentId = cleanAgentId.replace(/[^a-z0-9]/g, '');
      params.push(cleanAgentId);
      const p1 = params.length;
      params.push(alnumAgentId);
      const p2 = params.length;
      params.push(`%${cleanAgentId}%`);
      const p3 = params.length;
      
      clauses.push(`(
        LOWER(agent_id) = $${p1} 
        OR REPLACE(REPLACE(LOWER(agent_id), '_', ''), '-', '') = $${p2} 
        OR LOWER(agent_id) LIKE $${p3}
        OR LOWER(agent_name) LIKE $${p3}
      )`);
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
      const trimmedSource = source.trim();
      const matchParen = trimmedSource.match(/^([^(]+)\s*\(([^)]+)\)$/);
      if (matchParen) {
        const bankPart = matchParen[1].trim().toLowerCase();
        const srcPart = matchParen[2].trim().toLowerCase();
        params.push(`%${bankPart}%`);
        const pBank = params.length;
        params.push(srcPart);
        const pSrc = params.length;
        params.push(`%${srcPart}%`);
        const pSrcLike = params.length;

        clauses.push(`(
          (LOWER(card_bank) LIKE $${pBank} OR LOWER(card_name) LIKE $${pBank} OR LOWER(redirect_url) LIKE $${pBank})
          AND (
            LOWER(utm_source) = $${pSrc}
            OR LOWER(source) = $${pSrc}
            OR LOWER(agent_name) LIKE $${pSrcLike}
            OR ($${pSrc} = 'public' AND (utm_source IS NULL OR utm_source = '' OR utm_source = 'public'))
          )
        )`);
      } else {
        params.push(`%${trimmedSource.toLowerCase()}%`);
        const pIdx = params.length;
        clauses.push(`(
          LOWER(source) LIKE $${pIdx}
          OR LOWER(utm_source) LIKE $${pIdx}
          OR LOWER(agent_name) LIKE $${pIdx}
          OR LOWER(card_bank) LIKE $${pIdx}
          OR LOWER(card_name) LIKE $${pIdx}
        )`);
      }
    }
    if (utmSource) {
      const trimmedUtm = utmSource.trim();
      const matchParen = trimmedUtm.match(/^([^(]+)\s*\(([^)]+)\)$/);
      if (matchParen) {
        const cardOrBankPart = matchParen[1].trim().toLowerCase();
        const srcPart = matchParen[2].trim().toLowerCase();
        params.push(`%${cardOrBankPart}%`);
        const pCardBank = params.length;
        params.push(srcPart);
        const pSrc = params.length;
        params.push(`%${srcPart}%`);
        const pSrcLike = params.length;

        clauses.push(`(
          (LOWER(card_bank) LIKE $${pCardBank} OR LOWER(card_name) LIKE $${pCardBank} OR LOWER(redirect_url) LIKE $${pCardBank})
          AND (
            LOWER(utm_source) = $${pSrc}
            OR LOWER(source) = $${pSrc}
            OR LOWER(agent_name) LIKE $${pSrcLike}
            OR ($${pSrc} = 'public' AND (utm_source IS NULL OR utm_source = '' OR utm_source = 'public'))
          )
        )`);
      } else {
        const cleanUtm = trimmedUtm.toLowerCase();
        params.push(cleanUtm);
        const pExact = params.length;
        params.push(`%${cleanUtm}%`);
        const pLike = params.length;
        clauses.push(`(
          LOWER(utm_source) = $${pExact}
          OR LOWER(utm_source) LIKE $${pLike}
          OR LOWER(source) LIKE $${pLike}
          OR LOWER(card_name) LIKE $${pLike}
          OR LOWER(card_bank) LIKE $${pLike}
          OR ($${pExact} = 'public' AND (utm_source IS NULL OR utm_source = '' OR utm_source = 'public'))
          OR ($${pExact} = 'agent' AND source = 'agent')
        )`);
      }
    }
    if (startDate) {
      params.push(startDate + ' 00:00:00+05:30');
      clauses.push(`created_at >= $${params.length}::timestamptz`);
    }
    if (endDate) {
      params.push(endDate + ' 23:59:59+05:30');
      clauses.push(`created_at <= $${params.length}::timestamptz`);
    }
    if (campaign) {
      params.push(`%${campaign.trim().toLowerCase()}%`);
      clauses.push(`LOWER(utm_campaign) LIKE $${params.length}`);
    }
    if (term) {
      params.push(`%${term.trim().toLowerCase()}%`);
      clauses.push(`LOWER(utm_term) LIKE $${params.length}`);
    }
    if (info) {
      params.push(`%${info.trim().toLowerCase()}%`);
      clauses.push(`LOWER(utm_info) LIKE $${params.length}`);
    }
    
    if (clauses.length > 0) {
      whereClause = ' WHERE ' + clauses.join(' AND ');
    }
    
    // Pagination params
    const offset = (page - 1) * limit;
    const dataParams = [...params, limit, offset];
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    // Today's IST date start (12:00:00 AM IST)
    const formatterObj = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatterObj.formatToParts(new Date());
    const dateMap = {};
    parts.forEach(p => dateMap[p.type] = p.value);
    const todayISTStart = `${dateMap.year}-${dateMap.month}-${dateMap.day} 00:00:00+05:30`;

    // Run ALL 3 queries in parallel
    const [countRes, dataRes, todayRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM leads${whereClause}`, params),
      pool.query(
        `SELECT ${LEAD_COLUMNS} FROM leads${whereClause} ORDER BY created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        dataParams
      ),
      pool.query('SELECT COUNT(*) FROM leads WHERE created_at >= $1::timestamptz', [todayISTStart])
    ]);

    const total = parseInt(countRes.rows[0].count, 10);
    const todaysCount = parseInt(todayRes.rows[0].count, 10);

    const leads = dataRes.rows.map(row => ({
      ...row,
      utm_params: typeof row.utm_params === 'string' ? JSON.parse(row.utm_params) : (row.utm_params || {})
    }));

    return {
      leads,
      total,
      todaysCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  async getLeadsForExport({ search = '', card = '', source = '', startDate = '', endDate = '', campaign = '', term = '', info = '' }) {
    let query = 'SELECT * FROM leads';
    const params = [];
    const clauses = [];
    
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
      params.push(startDate + ' 00:00:00+05:30');
      clauses.push(`created_at >= $${params.length}::timestamptz`);
    }
    if (endDate) {
      params.push(endDate + ' 23:59:59+05:30');
      clauses.push(`created_at <= $${params.length}::timestamptz`);
    }
    if (campaign) {
      params.push(`%${campaign.trim().toLowerCase()}%`);
      clauses.push(`LOWER(utm_campaign) LIKE $${params.length}`);
    }
    if (term) {
      params.push(`%${term.trim().toLowerCase()}%`);
      clauses.push(`LOWER(utm_term) LIKE $${params.length}`);
    }
    if (info) {
      params.push(`%${info.trim().toLowerCase()}%`);
      clauses.push(`LOWER(utm_info) LIKE $${params.length}`);
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
        source, agent_id, agent_name, agent_location, consent, application_id,
        utm_source, utm_info, utm_creative_format, utm_medium, utm_campaign, utm_term, utm_content, utm_channel, utm_category, fbclid,
        gclid, gclsrc, dclid, msclkid, ttclid, twclid, li_fat_id,
        utm_id, utm_creative, utm_keyword, utm_matchtype, utm_network, utm_placement,
        utm_device, utm_location, gbraid, wbraid, landing_page, first_landing_page, referrer, ad_id,
        utm_params, redirect_url, ip_address, user_agent, capi_status, capi_response, utm_internal, has_credit_card, pincode, monthly_income, pan_no, dob, mother_name, current_address, designation, company_name, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62, $63, $64, NOW())`,
      [
        id, urn, lead.full_name, lead.phone, lead.email, lead.city, lead.employment, lead.income_range,
        lead.card_id, lead.card_name, lead.card_bank, lead.source || 'public', lead.agent_id, lead.agent_name,
        lead.agent_location, lead.consent !== undefined ? lead.consent : true, lead.application_id || null,
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
        lead.pan_no || null,
        lead.dob || null,
        lead.mother_name || null,
        lead.current_address || null,
        lead.designation || null,
        lead.company_name || null
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
        has_credit_card = $53, pincode = $54, monthly_income = $55, pan_no = $56, dob = $57, mother_name = $58, current_address = $59, designation = $60, company_name = $61, application_id = $62
       WHERE id = $63`,
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
        lead.dob || null,
        lead.mother_name || null,
        lead.current_address || null,
        lead.designation || null,
        lead.company_name || null,
        lead.application_id || null,
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
    try {
      const res = includeInactive
        ? await pool.query('SELECT * FROM cards ORDER BY display_order ASC')
        : await pool.query('SELECT * FROM cards WHERE active = true ORDER BY display_order ASC');
      return res.rows.map(row => ({
        ...row,
        card_locations: typeof row.card_locations === 'string' ? JSON.parse(row.card_locations) : (row.card_locations || [])
      }));
    } catch (err) {
      console.error('[DB Error] getCards failed:', err.message);
      return [];
    }
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

  // --- Unique Application ID Lookup ---
  async getExistingApplicationIds() {
    const res = await pool.query("SELECT DISTINCT application_id FROM leads WHERE application_id IS NOT NULL AND application_id != ''");
    const set = new Set();
    res.rows.forEach(r => {
      if (r.application_id) set.add(r.application_id.trim().toLowerCase());
    });
    return set;
  },

  // --- Persistent Uploaded Lead Files ---
  async addUploadedLeadFile(fileData) {
    const res = await pool.query(
      `INSERT INTO uploaded_lead_files 
       (filename, original_filename, file_size, agent_id, agent_name, total_rows, created_count, failed_count, errors, file_path, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING *`,
      [
        fileData.filename,
        fileData.original_filename,
        fileData.file_size || 0,
        fileData.agent_id || null,
        fileData.agent_name || null,
        fileData.total_rows || 0,
        fileData.created_count || 0,
        fileData.failed_count || 0,
        JSON.stringify(fileData.errors || []),
        fileData.file_path
      ]
    );
    return res.rows[0];
  },

  async getUploadedLeadFiles() {
    const res = await pool.query('SELECT * FROM uploaded_lead_files ORDER BY created_at DESC LIMIT 200');
    return res.rows.map(r => ({
      ...r,
      errors: typeof r.errors === 'string' ? JSON.parse(r.errors) : (r.errors || [])
    }));
  },

  async getUploadedLeadFileById(id) {
    const res = await pool.query('SELECT * FROM uploaded_lead_files WHERE id = $1 LIMIT 1', [id]);
    return res.rows[0] || null;
  },

  // --- Agents ---
  async getAgents() {
    const res = await pool.query('SELECT * FROM agents ORDER BY created_at ASC');
    return res.rows.map(row => ({
      ...row,
      locations: typeof row.locations === 'string' ? JSON.parse(row.locations) : row.locations,
      can_create_leads: row.can_create_leads !== false,
      can_upload_mis: !!row.can_upload_mis,
      agent_mode: row.agent_mode || 'lead_agent'
    }));
  },

  async addAgent(agent) {
    const locationsJson = JSON.stringify(agent.locations || []);
    const agentMode = agent.agent_mode || (agent.assigned_bank ? 'bank_mis_agent' : 'lead_agent');
    const canCreate = agent.can_create_leads !== undefined ? !!agent.can_create_leads : (agentMode === 'lead_agent');
    const canMis = agent.can_upload_mis !== undefined ? !!agent.can_upload_mis : (agentMode === 'bank_mis_agent');

    await pool.query(
      'INSERT INTO agents (id, name, phone, email, username, password_hash, status, locations, assigned_bank, agent_mode, can_create_leads, can_upload_mis, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())',
      [agent.id, agent.name, agent.phone || '', agent.email || '', agent.username, agent.password_hash, agent.status || 'active', locationsJson, agent.assigned_bank || null, agentMode, canCreate, canMis]
    );
    return agent;
  },

  async updateAgent(id, agentData) {
    const fields = [];
    const values = [];
    let idx = 1;
    for (const [key, val] of Object.entries(agentData)) {
      if (['name', 'phone', 'email', 'username', 'password_hash', 'status', 'assigned_bank', 'can_create_leads', 'can_upload_mis', 'agent_mode'].includes(key)) {
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

  async getAgentById(id) {
    const res = await pool.query('SELECT * FROM agents WHERE id = $1 LIMIT 1', [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      ...row,
      locations: typeof row.locations === 'string' ? JSON.parse(row.locations) : (row.locations || [])
    };
  },

  async getAgentByIdOrUsername(identifier) {
    if (!identifier) return null;
    const clean = String(identifier).trim().toLowerCase();
    const res = await pool.query(
      'SELECT * FROM agents WHERE LOWER(id) = $1 OR LOWER(username) = $1 OR LOWER(name) = $1 LIMIT 1',
      [clean]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      ...row,
      locations: typeof row.locations === 'string' ? JSON.parse(row.locations) : (row.locations || [])
    };
  },

  async removeAgentBankAssignment(bankName) {
    await pool.query('UPDATE agents SET assigned_bank = NULL WHERE assigned_bank = $1', [bankName]);
    return true;
  },

  // --- Locations ---
  async getLocations() {
    try {
      const res = await pool.query('SELECT * FROM locations ORDER BY created_at ASC');
      return res.rows;
    } catch (err) {
      console.error('[DB Error] getLocations failed:', err.message);
      return [];
    }
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
    const locRes = await pool.query('SELECT name FROM locations WHERE id = $1', [id]);
    if (locRes.rows.length > 0) {
      const cityName = locRes.rows[0].name;
      await pool.query('DELETE FROM locations WHERE id = $1', [id]);
      await pool.query(`
        UPDATE agents 
        SET locations = COALESCE(
          (
            SELECT jsonb_agg(elem) 
            FROM jsonb_array_elements_text(locations) AS elem 
            WHERE elem <> $1
          ), 
          '[]'::jsonb
        )
        WHERE locations ? $1
      `, [cityName]);
    }
    return true;
  },

  // --- Settings ---
  async getSettings() {
    try {
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
    } catch (err) {
      console.error('[DB Error] getSettings failed:', err.message);
      return { whatsapp_gateway: 'meta', csv_export_template: DEFAULT_CSV_TEMPLATE };
    }
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

  async saveSetting(key, val) {
    try {
      const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, valStr]
      );
      return true;
    } catch (e) {
      console.error('[DB Error] saveSetting failed:', e.message);
      return false;
    }
  },

  async getSetting(key) {
    try {
      const res = await pool.query(`SELECT value FROM settings WHERE key = $1`, [key]);
      return res.rows[0]?.value || null;
    } catch (e) {
      console.error('[DB Error] getSetting failed:', e.message);
      return null;
    }
  },

  async getAllDatabaseBanks() {
    try {
      const settingsRes = await pool.query(`SELECT value FROM settings WHERE key = 'card_manager_banks'`);
      if (settingsRes.rows[0]?.value) {
        return settingsRes.rows[0].value.split(',').map(b => b.trim()).filter(Boolean).sort();
      }
      return ['HDFC', 'SBI', 'KIWI'];
    } catch (e) {
      console.error('[DB Error] getAllDatabaseBanks failed:', e.message);
      return ['HDFC', 'SBI', 'KIWI'];
    }
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

  async updateLeadMISStatus(id, misStatus, misData, agentId = null, agentName = null) {
    let query = `UPDATE leads SET mis_status = $1, mis_mapped_at = NOW(), mis_data = $2`;
    const params = [misStatus, JSON.stringify(misData), id];

    if (agentId) {
      params.push(agentId);
      params.push(agentName || agentId);
      query += `, agent_id = COALESCE(agent_id, $4), agent_name = COALESCE(agent_name, $5)`;
    }

    query += ` WHERE id = $3 RETURNING id, urn, full_name, agent_id, agent_name, mis_status`;
    const res = await pool.query(query, params);
    return res.rows[0] || null;
  },

  async getMISStats() {
    // Run count and mapped leads queries in parallel for ultra-fast speed
    const [totalLeadsRes, mappedLeadsListRes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM leads'),
      pool.query(`
        SELECT id, urn, full_name, phone, COALESCE(mis_status, 'Pending') as mis_status, mis_mapped_at, mis_data,
               agent_name, pincode, card_bank, card_name, source
        FROM leads
        WHERE mis_mapped_at IS NOT NULL
        ORDER BY mis_mapped_at DESC
      `)
    ]);
    const totalLeads = parseInt(totalLeadsRes.rows[0].count, 10);

    // Flatten / clean history list in JS
    const expandedList = new Array(mappedLeadsListRes.rows.length);
    for (let i = 0; i < mappedLeadsListRes.rows.length; i++) {
      const row = mappedLeadsListRes.rows[i];
      let misDataObj = row.mis_data || {};
      try {
        if (typeof misDataObj === 'string') misDataObj = JSON.parse(misDataObj);
        // Fall back gracefully for legacy history objects: extract the latest entry
        if (misDataObj && Array.isArray(misDataObj.history) && misDataObj.history.length > 0) {
          misDataObj = misDataObj.history[misDataObj.history.length - 1].data || {};
        }
      } catch (e) {
        misDataObj = {};
      }
      
      // Prevent massive JSON payload causing OOM crash
      if (misDataObj) {
        delete misDataObj['_rawRowValues'];
        delete misDataObj['All Tracking Parameters (JSON)'];
      }

      expandedList[i] = {
        id: row.id, urn: row.urn, full_name: row.full_name, phone: row.phone,
        mis_status: row.mis_status, mis_mapped_at: row.mis_mapped_at,
        mis_data: misDataObj, agent_name: row.agent_name,
        pincode: row.pincode, card_bank: row.card_bank, card_name: row.card_name, source: row.source
      };
    }

    const totalMapped = expandedList.length;

    // ── SINGLE-PASS: compute ALL distributions, funnel counts, timeline, and status breakdown in one loop ──
    const statusBreakdown = {};
    const cardDistMap = {};
    const timelineMap = {};
    const kycMap = {};
    const sourceMap = {};
    const cardTypeMap = {};
    const custTypeMap = {};
    const activeStatusMap = {};
    const pinMap = {};
    const cardNameMap = {};
    let funnelIpa = 0, funnelKyc = 0, funnelDecision = 0, funnelActive = 0;

    for (let i = 0; i < expandedList.length; i++) {
      const r = expandedList[i];
      const md = r.mis_data || {};

      // Status breakdown
      const status = r.mis_status || 'Unknown';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

      // Card name distribution
      const cardName = md.card_name || 'Unknown';
      cardDistMap[cardName] = (cardDistMap[cardName] || 0) + 1;
      cardNameMap[cardName] = (cardNameMap[cardName] || 0) + 1;

      // Timeline
      if (r.mis_mapped_at) {
        const dateStr = new Date(r.mis_mapped_at).toISOString().split('T')[0];
        timelineMap[dateStr] = (timelineMap[dateStr] || 0) + 1;
      }

      // KYC Type
      const kycType = md.kyc_type || 'Unknown';
      kycMap[kycType] = (kycMap[kycType] || 0) + 1;

      // Source Type
      let sourceType = String(md.source_type || '').trim();
      if (!sourceType || sourceType === '-') sourceType = 'Blank';
      sourceMap[sourceType] = (sourceMap[sourceType] || 0) + 1;

      // Card Type
      const cardType = md.card_type || 'Unknown';
      cardTypeMap[cardType] = (cardTypeMap[cardType] || 0) + 1;

      // Customer Type
      const custType = md.customer_type || 'Unknown';
      custTypeMap[custType] = (custTypeMap[custType] || 0) + 1;

      // Activation Status
      const actStatus = md.card_activation_status || 'Inactive/Unknown';
      activeStatusMap[actStatus] = (activeStatusMap[actStatus] || 0) + 1;

      // Pincode
      const pin = md.PIN_CODE || md.pin_code || r.pincode || 'Unknown';
      pinMap[pin] = (pinMap[pin] || 0) + 1;

      // Funnel: IPA
      const ipaLower = String(md.ipa_status || '').toLowerCase();
      if (ipaLower.includes('approve') || ipaLower.includes('success')) funnelIpa++;

      // Funnel: KYC
      const ksLower = String(md.kyc_status || '').toLowerCase();
      const vsLower = String(md.vkyc_status || '').toLowerCase();
      const ktLower = String(md.kyc_type || '').toLowerCase();
      if (ksLower.includes('success') || ksLower.includes('complete') || vsLower.includes('success') || vsLower.includes('complete') || ksLower.includes('biokyc') || ktLower.includes('biokyc')) funnelKyc++;

      // Funnel: Decision
      const decLower = String(md.final_decision || '').toLowerCase();
      if (decLower.includes('approve') || decLower.includes('success')) funnelDecision++;

      // Funnel: Active
      const actLower = String(md.card_activation_status || '').toLowerCase();
      if (actLower.includes('active') || actLower === 'yes') funnelActive++;
    }

    // Build sorted output arrays from the maps
    const cardDistribution = Object.entries(cardDistMap).map(([name, count]) => ({ name, count }));
    const timeline = Object.entries(timelineMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-15);
    const kycDistribution = Object.entries(kycMap).map(([name, count]) => ({ name, count }));
    const sourceDistribution = Object.entries(sourceMap).map(([name, count]) => ({ name, count }));
    const cardTypeDistribution = Object.entries(cardTypeMap).map(([name, count]) => ({ name, count }));
    const customerTypeDistribution = Object.entries(custTypeMap).map(([name, count]) => ({ name, count }));
    const activationStatusDistribution = Object.entries(activeStatusMap).map(([name, count]) => ({ name, count }));
    const pincodeHeatmap = Object.entries(pinMap)
      .map(([pincode, count]) => ({ pincode, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 100);

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
        submit: totalLeads,
        ipa: funnelIpa,
        kyc: funnelKyc,
        decision: funnelDecision,
        active: funnelActive
      }
    };
  },

  async bulkUpdateLeadMISStatus(updates, agentId = null, agentName = null) {
    if (!updates || updates.length === 0) return;
    const client = await pool.connect();
    try {
      await client.query("SET statement_timeout = 300000");
      const batchSize = 50;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        const valueLines = [];
        const queryParams = [];
        let paramIndex = 1;
        
        batch.forEach(up => {
          valueLines.push(`($${paramIndex}::varchar, $${paramIndex + 1}::varchar, $${paramIndex + 2}::jsonb, $${paramIndex + 3}::varchar, $${paramIndex + 4}::varchar, $${paramIndex + 5}::varchar)`);
          queryParams.push(up.id);
          queryParams.push(up.status);
          queryParams.push(JSON.stringify(up.data));
          queryParams.push(up.agent_id || agentId || null);
          queryParams.push(up.agent_name || agentName || null);
          queryParams.push(up.application_id || null);
          paramIndex += 6;
        });
        
        const queryText = `
          UPDATE leads AS l
          SET mis_status = tmp.mis_status,
              mis_mapped_at = NOW(),
              mis_data = tmp.mis_data,
              agent_id = COALESCE(l.agent_id, tmp.agent_id),
              agent_name = COALESCE(l.agent_name, tmp.agent_name),
              application_id = COALESCE(NULLIF(tmp.app_id, ''), l.application_id)
          FROM (VALUES ${valueLines.join(', ')}) AS tmp(id, mis_status, mis_data, agent_id, agent_name, app_id)
          WHERE l.id = tmp.id
        `;
        
        await client.query(queryText, queryParams);
      }
    } catch (e) {
      console.error('[DB] bulkUpdateLeadMISStatus error:', e.message);
      throw e;
    } finally {
      client.release();
    }
  },

  async alignLeadsByRedirectBank() {
    console.log('[Align] Starting lead bank and card name alignment based on redirect card URLs...');
    const cardsRes = await pool.query('SELECT id, bank, name, redirect_url_template FROM cards');
    const cardsMap = new Map();
    cardsRes.rows.forEach(c => cardsMap.set(c.id, c));

    const leadsRes = await pool.query(`
      SELECT id, urn, card_id, card_name, card_bank, redirect_url, landing_page, utm_source, utm_campaign
      FROM leads
    `);

    let alignedCount = 0;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const lead of leadsRes.rows) {
        const redirectUrl = String(lead.redirect_url || '').toLowerCase();

        // 1. Direct REDIRECT URL matching takes top priority over everything else!
        if (redirectUrl.includes('gokiwi') || redirectUrl.includes('kiwi')) {
          targetBank = 'KIWI';
          targetCardName = 'Yes_Kiwi';
        } else if (redirectUrl.includes('scapia')) {
          targetBank = 'SCAPIA';
          targetCardName = 'Scapia Digital';
        } else if (redirectUrl.includes('applyonline.hdfcbank') || redirectUrl.includes('hdfcbank') || redirectUrl.includes('hdfc')) {
          targetBank = 'HDFC';
          targetCardName = redirectUrl.includes('pixel') ? 'Pixel' : (redirectUrl.includes('tdcc') ? 'TATA' : 'HDFC Card');
        } else if (redirectUrl.includes('sbicard') || redirectUrl.includes('simplyclick') || redirectUrl.includes('sbi')) {
          targetBank = 'SBI';
          targetCardName = redirectUrl.includes('simplyclick') ? 'SBI SimplyClick' : 'SBI Online';
        } else if (redirectUrl.includes('icici')) {
          targetBank = 'ICICI';
          targetCardName = 'ICICI Card';
        } else if (redirectUrl.includes('axis')) {
          targetBank = 'AXIS';
          targetCardName = 'Axis Card';
        }

        // 2. Card Selection / Card ID from cards catalog
        if (!targetBank && lead.card_id && cardsMap.has(lead.card_id)) {
          const cardObj = cardsMap.get(lead.card_id);
          targetBank = cardObj.bank;
          targetCardName = cardObj.name;
        }

        // 3. Fallback to inspect parameters
        if (!targetBank) {
          const inspectStr = [
            lead.card_id,
            lead.card_name,
            lead.landing_page,
            lead.utm_source,
            lead.utm_campaign
          ].filter(Boolean).join(' ').toLowerCase();

          if (inspectStr.includes('gokiwi') || inspectStr.includes('kiwi')) targetBank = 'KIWI';
          else if (inspectStr.includes('scapia')) targetBank = 'SCAPIA';
          else if (inspectStr.includes('hdfc') || inspectStr.includes('pixel') || inspectStr.includes('applyonline.hdfcbank')) targetBank = 'HDFC';
          else if (inspectStr.includes('sbi') || inspectStr.includes('simplyclick') || inspectStr.includes('sbicard')) targetBank = 'SBI';
          else if (inspectStr.includes('icici')) targetBank = 'ICICI';
          else if (inspectStr.includes('axis')) targetBank = 'AXIS';
        }

        if (!targetCardName || targetCardName === 'Public Redirection') {
          const inspectStr = [lead.redirect_url, lead.card_name, lead.landing_page, lead.utm_source, lead.utm_campaign].filter(Boolean).join(' ').toLowerCase();
          if (inspectStr.includes('scapia')) targetCardName = 'Scapia Digital';
          else if (inspectStr.includes('gokiwi') || inspectStr.includes('kiwi')) targetCardName = 'Yes_Kiwi';
          else if (inspectStr.includes('simplyclick')) targetCardName = 'SBI SimplyClick';
          else if (inspectStr.includes('sbicard') || inspectStr.includes('sbi')) targetCardName = 'SBI Online';
          else if (inspectStr.includes('pixel')) targetCardName = 'Pixel';
          else if (inspectStr.includes('tdcc') || inspectStr.includes('tata')) targetCardName = 'TATA';
          else if (inspectStr.includes('hdfc')) targetCardName = 'HDFC Card';
          else if (inspectStr.includes('axis')) targetCardName = 'Axis Card';
          else if (inspectStr.includes('icici')) targetCardName = 'ICICI Card';
        }

        const newBank = (targetBank || lead.card_bank || 'OTHER').toUpperCase();
        const newCardName = targetCardName || (lead.card_name && lead.card_name !== 'Public Redirection' ? lead.card_name : 'Credit Card');

        const needsBankUpdate = newBank !== (lead.card_bank || '').toUpperCase();
        const needsNameUpdate = (lead.card_name || '') === 'Public Redirection' || (!lead.card_name && newCardName);

        if (needsBankUpdate || needsNameUpdate) {
          await client.query(
            'UPDATE leads SET card_bank = $1, card_name = $2 WHERE id = $3',
            [newBank, newCardName, lead.id]
          );
          alignedCount++;
        }
      }
      await client.query("COMMIT");
      console.log(`[Align] ✅ Successfully aligned ${alignedCount} lead bank and card names!`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error('[Align Error]:', e.message);
      throw e;
    } finally {
      client.release();
    }
    return alignedCount;
  },

  // ── NOTIFICATION CENTER HELPERS ──
  async createNotification({ type = 'info', title, message, details = {} }) {
    try {
      const id = 'notif_' + Math.random().toString(36).substring(2, 11);
      const res = await pool.query(
        `INSERT INTO admin_notifications (id, type, title, message, details, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, FALSE, NOW())
         RETURNING *`,
        [id, type, title, message, JSON.stringify(details)]
      );
      return res.rows[0];
    } catch (e) {
      console.error('[DB] createNotification error:', e.message);
      return null;
    }
  },

  async getNotifications({ limit = 50, unreadOnly = false } = {}) {
    try {
      let query = `SELECT * FROM admin_notifications`;
      const params = [];
      if (unreadOnly) {
        query += ` WHERE is_read = FALSE`;
      }
      query += ` ORDER BY created_at DESC LIMIT $1`;
      params.push(limit);

      const res = await pool.query(query, params);
      const unreadRes = await pool.query(`SELECT COUNT(*)::int as count FROM admin_notifications WHERE is_read = FALSE`);

      return {
        notifications: res.rows.map(row => ({
          ...row,
          details: typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {})
        })),
        unreadCount: unreadRes.rows[0]?.count || 0
      };
    } catch (e) {
      console.error('[DB] getNotifications error:', e.message);
      return { notifications: [], unreadCount: 0 };
    }
  },

  async markNotificationsRead() {
    try {
      await pool.query(`UPDATE admin_notifications SET is_read = TRUE WHERE is_read = FALSE`);
      return true;
    } catch (e) {
      console.error('[DB] markNotificationsRead error:', e.message);
      return false;
    }
  },

  async clearNotifications() {
    try {
      await pool.query(`DELETE FROM admin_notifications`);
      return true;
    } catch (e) {
      console.error('[DB] clearNotifications error:', e.message);
      return false;
    }
  },

  // ── PROCESSED EMAIL TRACKER HELPERS ──
  async getProcessedEmailUids() {
    try {
      const res = await pool.query(`SELECT message_uid FROM processed_email_mis WHERE attachment_name != 'No Excel Attachment'`);
      return new Set(res.rows.map(r => String(r.message_uid)));
    } catch (e) {
      console.error('[DB] getProcessedEmailUids error:', e.message);
      return new Set();
    }
  },

  async saveProcessedEmailMis({ message_uid, subject, sender, attachment_name, total_processed, mapped_count, warning_count }) {
    try {
      const id = 'proc_email_' + Math.random().toString(36).substring(2, 11);
      await pool.query(
        `INSERT INTO processed_email_mis (id, message_uid, subject, sender, attachment_name, total_processed, mapped_count, warning_count, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (message_uid) DO NOTHING`,
        [id, String(message_uid), subject || '', sender || '', attachment_name || '', total_processed || 0, mapped_count || 0, warning_count || 0]
      );
      return true;
    } catch (e) {
      console.error('[DB] saveProcessedEmailMis error:', e.message);
      return false;
    }
  },

  getCanonicalLeadBank(lead) {
    if (!lead) return 'OTHER';
    const md = lead.mis_data || {};
    const bankName = String(md.mis_bank_name || md.bank_name || '').toUpperCase().trim();
    const redirectUrl = String(lead.redirect_url || '').toLowerCase();
    const cardName = String(lead.card_name || '').toLowerCase();
    const cardBank = String(lead.card_bank || '').toLowerCase();

    // 1. Direct REDIRECT URL matching
    if (redirectUrl.includes('gokiwi') || redirectUrl.includes('kiwi')) return 'KIWI';
    if (redirectUrl.includes('scapia')) return 'SCAPIA';
    if (redirectUrl.includes('applyonline.hdfcbank') || redirectUrl.includes('hdfcbank') || redirectUrl.includes('hdfc')) return 'HDFC';
    if (redirectUrl.includes('sbicard') || redirectUrl.includes('simplyclick') || redirectUrl.includes('sbi')) return 'SBI';
    if (redirectUrl.includes('icici')) return 'ICICI';
    if (redirectUrl.includes('axis')) return 'AXIS';

    // 2. Card Name / Card Bank
    if (cardName.includes('kiwi') || cardBank.includes('kiwi')) return 'KIWI';
    if (cardName.includes('scapia') || cardBank.includes('scapia')) return 'SCAPIA';
    if (cardName.includes('sbi') || cardBank.includes('sbi') || cardName.includes('simplyclick')) return 'SBI';
    if (cardName.includes('hdfc') || cardBank.includes('hdfc') || cardName.includes('pixel')) return 'HDFC';
    if (cardName.includes('icici') || cardBank.includes('icici')) return 'ICICI';
    if (cardName.includes('axis') || cardBank.includes('axis')) return 'AXIS';
    if (cardName.includes('tata') || cardBank.includes('idfc')) return 'IDFC';

    // 3. Inspection of tracking & landing page fields
    const utmInspect = [
      lead.landing_page,
      lead.source,
      lead.utm_source,
      lead.utm_campaign,
      lead.utm_content
    ].filter(Boolean).join(' ').toLowerCase();

    if (utmInspect.includes('gokiwi') || utmInspect.includes('kiwi')) return 'KIWI';
    if (utmInspect.includes('scapia')) return 'SCAPIA';
    if (utmInspect.includes('applyonline.hdfcbank') || utmInspect.includes('pixel') || utmInspect.includes('hdfc')) return 'HDFC';
    if (utmInspect.includes('sbicard') || utmInspect.includes('simplyclick') || utmInspect.includes('sbi')) return 'SBI';
    if (utmInspect.includes('icici')) return 'ICICI';
    if (utmInspect.includes('axis')) return 'AXIS';

    if (bankName) {
      if (bankName.includes('SBI')) return 'SBI';
      if (bankName.includes('KIWI') || bankName.includes('YES')) return 'KIWI';
      if (bankName.includes('HDFC')) return 'HDFC';
      if (bankName.includes('SCAPIA') || bankName.includes('BOB')) return 'SCAPIA';
      return bankName;
    }

    return 'OTHER';
  },

  async removeDuplicateLeads() {
    try {
      const allLeads = await this.getAllLeadsUnfiltered();
      const groupedSameDay = new Map();
      const groupedSameBank = new Map();

      const isSyncedWithMis = (l) => {
        return !!(l.mis_status || l.mis_mapped_at || (l.mis_data && Object.keys(l.mis_data).length > 0));
      };

      allLeads.forEach(lead => {
        if (!lead.phone) return;
        const cleanPhone = String(lead.phone).replace(/\D/g, '').slice(-10);
        if (!cleanPhone || cleanPhone.length < 10) return;

        const bank = this.getCanonicalLeadBank(lead);
        if (!bank || bank === 'OTHER') return;

        const dateStr = lead.created_at ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(lead.created_at)) : 'nodate';
        
        // Pass 1: Same Phone + Same Day + Same Bank
        const keyDay = `${cleanPhone}_${dateStr}_${bank}`;
        if (!groupedSameDay.has(keyDay)) {
          groupedSameDay.set(keyDay, []);
        }
        groupedSameDay.get(keyDay).push(lead);

        // Pass 2: Same Phone + Same Bank (for unsynced duplicate attempts)
        const keyBank = `${cleanPhone}_${bank}`;
        if (!groupedSameBank.has(keyBank)) {
          groupedSameBank.set(keyBank, []);
        }
        groupedSameBank.get(keyBank).push(lead);
      });

      const idsToDeleteSet = new Set();

      const processGroup = (groupMap) => {
        for (const [key, leads] of groupMap.entries()) {
          if (leads.length > 1) {
            leads.sort((a, b) => {
              const aMapped = isSyncedWithMis(a) ? 100 : 0;
              const bMapped = isSyncedWithMis(b) ? 100 : 0;

              if (aMapped !== bMapped) {
                return bMapped - aMapped;
              }

              const dateA = new Date(a.created_at || 0).getTime();
              const dateB = new Date(b.created_at || 0).getTime();
              return dateB - dateA;
            });

            for (let i = 1; i < leads.length; i++) {
              const dup = leads[i];
              const dupIsSynced = isSyncedWithMis(dup);
              const keeperIsSynced = isSyncedWithMis(leads[0]);

              if (dupIsSynced && keeperIsSynced) {
                continue;
              }
              idsToDeleteSet.add(dup.id);
            }
          }
        }
      };

      processGroup(groupedSameDay);
      processGroup(groupedSameBank);

      const idsToDelete = Array.from(idsToDeleteSet);

      if (idsToDelete.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < idsToDelete.length; i += chunkSize) {
          const chunk = idsToDelete.slice(i, i + chunkSize);
          await pool.query('DELETE FROM leads WHERE id = ANY($1::varchar[])', [chunk]);
        }
        await this.createNotification({
          type: 'warning',
          title: '🧹 Duplicate Leads Cleaned',
          message: `Deduplication engine removed ${idsToDelete.length} duplicate lead(s) with matching phone, date & bank. Synced URNs were preserved.`,
          details: { removedCount: idsToDelete.length }
        });
      }
      return { success: true, removedCount: idsToDelete.length };
    } catch (e) {
      console.error('[DB] removeDuplicateLeads error:', e.message);
      return { success: false, error: e.message };
    }
  },

  async getLeadVisibilityConfig() {
    try {
      const res = await pool.query('SELECT value FROM settings WHERE key = $1', ['lead_visibility_config']);
      if (res.rows.length > 0) {
        return JSON.parse(res.rows[0].value);
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  async setLeadVisibilityConfig(config) {
    try {
      const configStr = JSON.stringify(config);
      await pool.query(
        `INSERT INTO settings (key, value, updated_at) VALUES ('lead_visibility_config', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [configStr]
      );
      return true;
    } catch (e) {
      console.error('[DB] setLeadVisibilityConfig error:', e.message);
      return false;
    }
  }
}

module.exports = db;
