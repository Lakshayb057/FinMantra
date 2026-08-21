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

    await client.query(`
      CREATE TABLE IF NOT EXISTS meta_audiences (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        audience_type VARCHAR(50) NOT NULL DEFAULT 'CUSTOM',
        bank_name VARCHAR(255),
        status_category VARCHAR(50),
        meta_audience_id VARCHAR(100),
        description TEXT,
        auto_push BOOLEAN DEFAULT TRUE,
        rules JSONB DEFAULT '{}',
        database_count INTEGER DEFAULT 0,
        synced_count INTEGER DEFAULT 0,
        pending_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'active',
        last_synced_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Auto-migrate schema columns for pre-existing meta_audiences tables
    await client.query(`
      ALTER TABLE meta_audiences ADD COLUMN IF NOT EXISTS audience_type VARCHAR(50) DEFAULT 'CUSTOM';
      ALTER TABLE meta_audiences ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);
      ALTER TABLE meta_audiences ADD COLUMN IF NOT EXISTS status_category VARCHAR(50);
      ALTER TABLE meta_audiences ADD COLUMN IF NOT EXISTS meta_audience_id VARCHAR(100);
      ALTER TABLE meta_audiences ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE meta_audiences ADD COLUMN IF NOT EXISTS auto_push BOOLEAN DEFAULT TRUE;
      ALTER TABLE meta_audiences ADD COLUMN IF NOT EXISTS rules JSONB DEFAULT '{}';
      ALTER TABLE meta_audiences ADD COLUMN IF NOT EXISTS database_count INTEGER DEFAULT 0;
      ALTER TABLE meta_audiences ADD COLUMN IF NOT EXISTS synced_count INTEGER DEFAULT 0;
      ALTER TABLE meta_audiences ADD COLUMN IF NOT EXISTS pending_count INTEGER DEFAULT 0;
      ALTER TABLE meta_audiences ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0;
      ALTER TABLE meta_audiences ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
      ALTER TABLE meta_audiences ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE meta_audiences ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE meta_audiences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `);

    // Auto-correct pre-existing settings typo for meta_ad_account_id
    await client.query(`
      UPDATE settings SET value = 'act_1450840068922146' WHERE key = 'meta_ad_account_id' AND (value LIKE '%145081%' OR value IS NULL);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS meta_audience_memberships (
        id VARCHAR(50) PRIMARY KEY,
        audience_id VARCHAR(50) REFERENCES meta_audiences(id) ON DELETE CASCADE,
        lead_id VARCHAR(50) REFERENCES leads(id) ON DELETE CASCADE,
        state VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        last_synced_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(audience_id, lead_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS meta_audience_sync_jobs (
        id VARCHAR(50) PRIMARY KEY,
        audience_id VARCHAR(50),
        job_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        total_records INTEGER DEFAULT 0,
        processed_records INTEGER DEFAULT 0,
        successful_records INTEGER DEFAULT 0,
        failed_records INTEGER DEFAULT 0,
        skipped_records INTEGER DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS meta_audience_audit_logs (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50),
        user_name VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        audience_id VARCHAR(50),
        audience_name VARCHAR(255),
        records_processed INTEGER DEFAULT 0,
        records_failed INTEGER DEFAULT 0,
        details JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sbi_company_codes (
        id SERIAL PRIMARY KEY,
        company_code VARCHAR(100),
        company_name VARCHAR(255) NOT NULL,
        company_category VARCHAR(50),
        source_file VARCHAR(255),
        why_ltf_pricing TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS campaign_leads (
        id VARCHAR(50) PRIMARY KEY,
        campaign_id VARCHAR(50) REFERENCES campaigns(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        contact VARCHAR(50),
        mail VARCHAR(255),
        address TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS campaign_broadcasts (
        id VARCHAR(50) PRIMARY KEY,
        campaign_id VARCHAR(50) REFERENCES campaigns(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        channel VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        whatsapp_template VARCHAR(255),
        whatsapp_message TEXT,
        email_subject VARCHAR(255),
        email_body TEXT,
        targeted_count INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        scheduled_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS campaign_logs (
        id VARCHAR(50) PRIMARY KEY,
        broadcast_id VARCHAR(50) REFERENCES campaign_broadcasts(id) ON DELETE CASCADE,
        campaign_lead_id VARCHAR(50) REFERENCES campaign_leads(id) ON DELETE CASCADE,
        channel VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        error_message TEXT,
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS campaign_master_leads (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        contact VARCHAR(50),
        mail VARCHAR(255),
        address TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS campaign_templates (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        subject VARCHAR(255),
        body TEXT NOT NULL,
        meta_template_name VARCHAR(255),
        media_url VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const safeQuery = async (qStr, params = []) => {
      try {
        await client.query('SAVEPOINT mig_sp');
        await client.query(qStr, params);
        await client.query('RELEASE SAVEPOINT mig_sp');
      } catch (migErr) {
        try { await client.query('ROLLBACK TO SAVEPOINT mig_sp'); } catch (rbErr) {}
      }
    };

    await safeQuery("ALTER TABLE campaign_master_leads ALTER COLUMN mail DROP NOT NULL");
    await safeQuery("ALTER TABLE campaign_master_leads ALTER COLUMN contact DROP NOT NULL");
    await safeQuery("ALTER TABLE campaign_leads ALTER COLUMN mail DROP NOT NULL");
    await safeQuery("ALTER TABLE campaign_leads ALTER COLUMN contact DROP NOT NULL");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_meta_audiences_type_bank ON meta_audiences (audience_type, bank_name)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_meta_audiences_meta_id ON meta_audiences (meta_audience_id) WHERE meta_audience_id IS NOT NULL");
    await safeQuery("CREATE UNIQUE INDEX IF NOT EXISTS uq_meta_audiences_name ON meta_audiences (LOWER(TRIM(name)))");
    await safeQuery("DROP INDEX IF EXISTS uq_idx_master_mail");
    await safeQuery("DROP INDEX IF EXISTS uq_idx_master_contact");
    await safeQuery("DROP INDEX IF EXISTS uq_idx_campaign_mail");
    await safeQuery("DROP INDEX IF EXISTS uq_idx_campaign_contact");
    await safeQuery("CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_master_contact ON campaign_master_leads (contact) WHERE contact IS NOT NULL AND contact != ''");
    await safeQuery("CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_master_mail ON campaign_master_leads (LOWER(TRIM(mail))) WHERE mail IS NOT NULL AND TRIM(mail) != ''");
    await safeQuery("CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_campaign_contact ON campaign_leads (campaign_id, contact) WHERE contact IS NOT NULL AND contact != ''");
    await safeQuery("CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_campaign_mail ON campaign_leads (campaign_id, LOWER(TRIM(mail))) WHERE mail IS NOT NULL AND TRIM(mail) != ''");
    await safeQuery("ALTER TABLE campaign_broadcasts ADD COLUMN IF NOT EXISTS media_url VARCHAR(255)");
    await safeQuery("ALTER TABLE campaign_broadcasts ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMP WITH TIME ZONE");
    await safeQuery("ALTER TABLE campaign_broadcasts ADD COLUMN IF NOT EXISTS last_trigger_status VARCHAR(50)");
    await safeQuery("ALTER TABLE campaign_broadcasts ADD COLUMN IF NOT EXISTS meta_phone_number_id VARCHAR(100)");
    await safeQuery("ALTER TABLE campaign_broadcasts ADD COLUMN IF NOT EXISTS meta_phone_number VARCHAR(100)");
    await safeQuery("ALTER TABLE campaign_broadcasts ADD COLUMN IF NOT EXISTS sender_email VARCHAR(255)");
    await safeQuery("ALTER TABLE campaign_broadcasts ADD COLUMN IF NOT EXISTS delivered_count INTEGER DEFAULT 0");
    await safeQuery("ALTER TABLE campaign_broadcasts ADD COLUMN IF NOT EXISTS read_count INTEGER DEFAULT 0");
    await safeQuery("ALTER TABLE campaign_broadcasts ADD COLUMN IF NOT EXISTS clicked_count INTEGER DEFAULT 0");
    await safeQuery("ALTER TABLE campaign_broadcasts ADD COLUMN IF NOT EXISTS uploaded_leads_count INTEGER DEFAULT 0");

    await safeQuery("ALTER TABLE campaign_templates ADD COLUMN IF NOT EXISTS buttons TEXT");
    await safeQuery("ALTER TABLE campaign_templates ADD COLUMN IF NOT EXISTS meta_phone_number_id VARCHAR(100)");
    await safeQuery("ALTER TABLE campaign_templates ADD COLUMN IF NOT EXISTS waba_id VARCHAR(100)");
    await safeQuery("ALTER TABLE campaign_templates ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'APPROVED'");
    await safeQuery("ALTER TABLE campaign_templates ADD COLUMN IF NOT EXISTS language VARCHAR(50) DEFAULT 'en_US'");
    await safeQuery("ALTER TABLE campaign_templates ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'MARKETING'");
    await safeQuery("ALTER TABLE campaign_templates ADD COLUMN IF NOT EXISTS header_format VARCHAR(50) DEFAULT 'NONE'");
    await safeQuery("ALTER TABLE campaign_templates ADD COLUMN IF NOT EXISTS header_text TEXT");
    await safeQuery("ALTER TABLE campaign_logs DROP CONSTRAINT IF EXISTS campaign_logs_campaign_lead_id_fkey");
    await safeQuery("ALTER TABLE campaign_logs ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(50)");
    await safeQuery("ALTER TABLE campaign_logs ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255)");
    await safeQuery("ALTER TABLE campaign_logs ADD COLUMN IF NOT EXISTS wamid VARCHAR(150)");
    await safeQuery("ALTER TABLE campaign_logs ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE");
    await safeQuery("ALTER TABLE campaign_logs ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE");
    await safeQuery("ALTER TABLE campaign_logs ADD COLUMN IF NOT EXISTS error_code VARCHAR(50)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_campaign_logs_wamid ON campaign_logs (wamid)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_campaign_logs_bc_status ON campaign_logs (broadcast_id, status)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_campaign_logs_bc_phone ON campaign_logs (broadcast_id, recipient_phone)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_campaign_logs_phone ON campaign_logs (recipient_phone)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_campaign_logs_email ON campaign_logs (recipient_email)");
    await safeQuery("ALTER TABLE campaign_broadcasts ADD COLUMN IF NOT EXISTS smtp_account_id VARCHAR(50)");

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS campaign_smtp_accounts (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        host VARCHAR(255) NOT NULL,
        port INTEGER NOT NULL DEFAULT 465,
        username VARCHAR(255) NOT NULL,
        password TEXT NOT NULL,
        secure BOOLEAN DEFAULT TRUE,
        from_name VARCHAR(255) DEFAULT 'FinMantra',
        from_email VARCHAR(255) NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await safeQuery("ALTER TABLE campaign_smtp_accounts ADD COLUMN IF NOT EXISTS provider_type VARCHAR(50) DEFAULT 'smtp'");
    await safeQuery("ALTER TABLE campaign_smtp_accounts ADD COLUMN IF NOT EXISTS aws_access_key_id VARCHAR(255)");
    await safeQuery("ALTER TABLE campaign_smtp_accounts ADD COLUMN IF NOT EXISTS aws_secret_access_key TEXT");
    await safeQuery("ALTER TABLE campaign_smtp_accounts ADD COLUMN IF NOT EXISTS aws_region VARCHAR(100) DEFAULT 'ap-south-1'");
    await safeQuery("ALTER TABLE campaign_smtp_accounts ADD COLUMN IF NOT EXISTS aws_session_token TEXT");
    await safeQuery("ALTER TABLE campaign_smtp_accounts ADD COLUMN IF NOT EXISTS configuration_set VARCHAR(255)");
    await safeQuery("ALTER TABLE campaign_smtp_accounts ALTER COLUMN host DROP NOT NULL");
    await safeQuery("ALTER TABLE campaign_smtp_accounts ALTER COLUMN port DROP NOT NULL");
    await safeQuery("ALTER TABLE campaign_smtp_accounts ALTER COLUMN username DROP NOT NULL");
    await safeQuery("ALTER TABLE campaign_smtp_accounts ALTER COLUMN password DROP NOT NULL");

    await safeQuery("ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS finmantra_id VARCHAR(50)");
    await safeQuery("ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS campaign_data_id VARCHAR(50)");
    await safeQuery("ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS whatsapp_optin BOOLEAN DEFAULT TRUE");
    await safeQuery("ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS email_optin BOOLEAN DEFAULT TRUE");
    await safeQuery("ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS last_broadcast_id VARCHAR(50)");
    await safeQuery("ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS last_broadcast_name VARCHAR(255)");
    await safeQuery("ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS last_broadcast_date TIMESTAMP WITH TIME ZONE");
    await safeQuery("ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS meta_whatsapp_no VARCHAR(100)");
    await safeQuery("ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS sender_email VARCHAR(255)");
    await safeQuery("ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS wa_sent_count INTEGER DEFAULT 0");
    await safeQuery("ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS wa_delivered_count INTEGER DEFAULT 0");
    await safeQuery("ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS wa_read_count INTEGER DEFAULT 0");
    await safeQuery("ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS wa_clicked_count INTEGER DEFAULT 0");
    await safeQuery("ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS email_sent_count INTEGER DEFAULT 0");
    await safeQuery("ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS email_delivered_count INTEGER DEFAULT 0");
    await safeQuery("ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS email_read_count INTEGER DEFAULT 0");
    await safeQuery("ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS email_clicked_count INTEGER DEFAULT 0");
    await safeQuery("ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}'");
    await safeQuery("ALTER TABLE campaign_master_leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_master_leads_last_bc_date ON campaign_master_leads (last_broadcast_date DESC)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_master_leads_finmantra_id ON campaign_master_leads (finmantra_id)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_master_leads_campaign_data_id ON campaign_master_leads (campaign_data_id)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_meta_memberships_aud_lead ON meta_audience_memberships (audience_id, lead_id)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_meta_memberships_state ON meta_audience_memberships (state)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_meta_sync_jobs_aud ON meta_audience_sync_jobs (audience_id)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_meta_audit_logs_created ON meta_audience_audit_logs (created_at DESC)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_sbi_company_codes_name_lower ON sbi_company_codes (LOWER(company_name))");

    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS application_id VARCHAR(255)");
    await safeQuery("UPDATE cards SET category = 'Offline' WHERE category NOT IN ('Offline', 'Digital')");
    await safeQuery("ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_locations JSONB DEFAULT '[]'");
    await safeQuery("ALTER TABLE cards ADD COLUMN IF NOT EXISTS ad_id VARCHAR(100)");
    await safeQuery("ALTER TABLE cards ADD COLUMN IF NOT EXISTS utm_internal VARCHAR(100)");
    await safeQuery("ALTER TABLE cards ALTER COLUMN ad_id TYPE TEXT");

    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_id VARCHAR(255)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_creative VARCHAR(255)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_keyword VARCHAR(255)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_matchtype VARCHAR(100)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_network VARCHAR(100)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_placement VARCHAR(255)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_device VARCHAR(100)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_location VARCHAR(255)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS gbraid VARCHAR(255)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS wbraid VARCHAR(255)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS landing_page TEXT");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_landing_page TEXT");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS referrer TEXT");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS ad_id VARCHAR(100)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_internal VARCHAR(100)");
    await safeQuery("ALTER TABLE leads ALTER COLUMN ad_id TYPE TEXT");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_credit_card VARCHAR(100)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS pincode VARCHAR(100)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS monthly_income VARCHAR(100)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS mis_status VARCHAR(100)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS mis_mapped_at TIMESTAMP WITH TIME ZONE");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS mis_data JSONB DEFAULT '{}'");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS state VARCHAR(255)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS landmark VARCHAR(255)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS user_agent TEXT");

    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS capi_status VARCHAR(50)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS capi_response JSONB");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS capi_last_event VARCHAR(100)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS capi_last_value NUMERIC");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS capi_last_status VARCHAR(50)");
    await safeQuery("ALTER TABLE leads ADD COLUMN IF NOT EXISTS capi_last_at TIMESTAMP WITH TIME ZONE");

    // Performance indexes for high-speed dashboard & repository queries
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_leads_mis_status ON leads (mis_status) WHERE mis_status IS NOT NULL");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_leads_mis_mapped_at ON leads (mis_mapped_at DESC) WHERE mis_status IS NOT NULL");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_leads_mis_mapped_at_all ON leads (mis_mapped_at DESC)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_leads_agent_id ON leads (agent_id)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_leads_application_id ON leads (application_id) WHERE application_id IS NOT NULL");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_uploaded_lead_files_created_at ON uploaded_lead_files (created_at DESC)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_leads_card_id ON leads (card_id)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_leads_source ON leads (source)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads (phone)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_leads_urn ON leads (urn)");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_leads_pan_no ON leads (pan_no) WHERE pan_no IS NOT NULL");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_leads_utm_campaign ON leads (utm_campaign) WHERE utm_campaign IS NOT NULL AND utm_campaign != ''");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_leads_utm_term ON leads (utm_term) WHERE utm_term IS NOT NULL AND utm_term != ''");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_leads_utm_info ON leads (utm_info) WHERE utm_info IS NOT NULL AND utm_info != ''");
    await safeQuery("CREATE INDEX IF NOT EXISTS idx_leads_card_bank ON leads (card_bank)");

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
    const waFlowApiKeyCheck = await client.query("SELECT COUNT(*) FROM settings WHERE key = 'whatsapp_flow_api_key'");
    if (parseInt(waFlowApiKeyCheck.rows[0].count, 10) === 0) {
      const generatedKey = 'wa_flow_' + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
      await client.query("INSERT INTO settings (key, value) VALUES ('whatsapp_flow_api_key', $1)", [generatedKey]);
    }
    const waFlowPrivateKeyCheck = await client.query("SELECT COUNT(*) FROM settings WHERE key = 'whatsapp_flow_private_key'");
    if (parseInt(waFlowPrivateKeyCheck.rows[0].count, 10) === 0) {
      await client.query("INSERT INTO settings (key, value) VALUES ('whatsapp_flow_private_key', '')");
    }

    await client.query('COMMIT');
    console.log('[Database] PostgreSQL tables checked, initialized and seeded.');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (rbErr) {}
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

async function importSbiCompanyCodes() {
  const client = await pool.connect();
  try {
    const countRes = await client.query('SELECT COUNT(*) FROM sbi_company_codes');
    const count = parseInt(countRes.rows[0].count, 10);
    if (count > 0) {
      console.log(`[SBI Company Importer] Table already has ${count} records. Skipping import.`);
      return;
    }

    console.log('[SBI Company Importer] Starting import from Excel files...');

    const xlsx = require('xlsx');
    const fs = require('fs');

    let file1Path = "C:\\Users\\laksh\\Downloads\\CC Company Code Master_29-Apr-26.xlsx";
    let file2Path = "C:\\Users\\laksh\\Downloads\\Key Corporates_LTF Pricing_vFeb'26.xlsx";

    if (!fs.existsSync(file1Path)) {
      file1Path = "/home/ubuntu/downloads/CC Company Code Master_29-Apr-26.xlsx";
    }
    if (!fs.existsSync(file2Path)) {
      file2Path = "/home/ubuntu/downloads/Key Corporates_LTF Pricing_vFeb'26.xlsx";
    }

    const insertRows = [];

    // Process File 1 (Company Code Master)
    if (fs.existsSync(file1Path)) {
      console.log(`[SBI Company Importer] Reading File 1: ${file1Path}`);
      const wb1 = xlsx.readFile(file1Path);
      const sheetName = wb1.SheetNames[0];
      const sheet = wb1.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);
      console.log(`[SBI Company Importer] Parsed ${data.length} rows from File 1`);
      
      for (const row of data) {
        const code = row['COMPANY_CODE'] || '';
        const name = row['COMPANY_NAME'] || '';
        const cat = row['COMPANY_CATEGORY'] || row["COMPANY_CATEGORY (Mar'26)"] || '';
        if (name) {
          insertRows.push({
            code: String(code).trim(),
            name: String(name).trim(),
            category: String(cat).trim(),
            source: 'CC Company Code Master',
            why_ltf: null
          });
        }
      }
    } else {
      console.error(`[SBI Company Importer] File 1 not found: ${file1Path}`);
    }

    // Process File 2 (Key Corporates)
    if (fs.existsSync(file2Path)) {
      console.log(`[SBI Company Importer] Reading File 2: ${file2Path}`);
      const wb2 = xlsx.readFile(file2Path);
      const sheetName = wb2.SheetNames[0];
      const sheet = wb2.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);
      console.log(`[SBI Company Importer] Parsed ${data.length} rows from File 2`);

      for (const row of data) {
        const code = row['CC Co Co'] || '';
        const name = row['Company Name '] || '';
        const cat = row['Co CAT'] || '';
        const why = row['Why LTF pricing offered! '] || '';
        if (name) {
          insertRows.push({
            code: String(code).trim(),
            name: String(name).trim(),
            category: String(cat).trim(),
            source: 'Key Corporates LTF Pricing',
            why_ltf: String(why).trim()
          });
        }
      }
    } else {
      console.error(`[SBI Company Importer] File 2 not found: ${file2Path}`);
    }

    if (insertRows.length === 0) {
      console.log('[SBI Company Importer] No rows to insert.');
      return;
    }

    console.log(`[SBI Company Importer] Inserting ${insertRows.length} total records in batches...`);
    
    // Batch insert
    const batchSize = 5000;
    for (let i = 0; i < insertRows.length; i += batchSize) {
      const chunk = insertRows.slice(i, i + batchSize);
      
      let queryStr = `
        INSERT INTO sbi_company_codes (company_code, company_name, company_category, source_file, why_ltf_pricing)
        VALUES 
      `;
      const values = [];
      
      const valueClauses = chunk.map((row, rIdx) => {
        const base = rIdx * 5;
        values.push(row.code, row.name, row.category, row.source, row.why_ltf);
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
      });

      queryStr += valueClauses.join(', ');
      await client.query(queryStr, values);
    }

    console.log('[SBI Company Importer] Import completed successfully!');
  } catch (err) {
    console.error('[SBI Company Importer] Error importing company codes:', err);
  } finally {
    client.release();
  }
}

async function importDesignations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS designations (
        id SERIAL PRIMARY KEY,
        employment_type VARCHAR(100) NOT NULL,
        designation VARCHAR(150) NOT NULL
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_designations_emp_type ON designations (employment_type)');

    const countRes = await client.query('SELECT COUNT(*) FROM designations');
    const count = parseInt(countRes.rows[0].count, 10);
    if (count >= 578) {
      console.log(`[Designations Importer] Table already has ${count} records. Skipping import.`);
      return;
    }

    console.log('[Designations Importer] Starting import from Excel file...');

    const xlsx = require('xlsx');
    const fs = require('fs');

    let file1Path = "C:\\Users\\laksh\\Downloads\\Global_Designations_List.xlsx";
    if (!fs.existsSync(file1Path)) {
      file1Path = "/home/ubuntu/downloads/Global_Designations_List.xlsx";
    }

    if (fs.existsSync(file1Path)) {
      console.log(`[Designations Importer] Reading File: ${file1Path}`);
      const workbook = xlsx.readFile(file1Path);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet);
      console.log(`[Designations Importer] Parsed ${rows.length} rows.`);

      await client.query('TRUNCATE designations RESTART IDENTITY');

      const batchSize = 100;
      let values = [];
      let insertedCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const empType = row['Employment Type'] ? String(row['Employment Type']).trim() : null;
        const designation = row['Designation'] ? String(row['Designation']).trim() : null;

        if (empType && designation) {
          values.push(empType, designation);
          insertedCount++;

          if (insertedCount % batchSize === 0 || i === rows.length - 1) {
            const placeholders = [];
            for (let j = 0; j < values.length / 2; j++) {
              placeholders.push(`($${j * 2 + 1}, $${j * 2 + 2})`);
            }

            if (placeholders.length > 0) {
              await client.query(
                `INSERT INTO designations (employment_type, designation) VALUES ${placeholders.join(', ')}`,
                values
              );
            }
            values = [];
          }
        }
      }
      console.log(`[Designations Importer] Successfully imported ${insertedCount} designations.`);
    } else {
      console.log(`[Designations Importer] Excel file not found at ${file1Path}. Skipping import.`);
    }
  } catch (err) {
    console.error('[Designations Importer Exception]:', err);
  } finally {
    client.release();
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
        // Run import check asynchronously in background so server startup is fast
        importSbiCompanyCodes().catch(err => console.error('[SBI Import Background Exception]:', err));
        importDesignations().catch(err => console.error('[Designations Import Background Exception]:', err));
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
    if (_utmOptionsCache && (now - _utmOptionsCacheTime) < 15 * 1000) {
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
    const utmSourceSet = new Set();

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

  async getLeadsFiltered({ agentId = null, bankMisFilter = null, page = 1, limit = 50, search = '', card = '', source = '', utmSource = '', startDate = '', endDate = '', campaign = '', term = '', info = '', companyCategory = '', ltfEligible = '' }) {
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
      clauses.push(`(
        LOWER(full_name) LIKE $${params.length} 
        OR phone LIKE $${params.length} 
        OR LOWER(urn) LIKE $${params.length} 
        OR LOWER(pan_no) LIKE $${params.length}
        OR LOWER(company_name) LIKE $${params.length}
        OR LOWER(mis_data->>'company_code') LIKE $${params.length}
      )`);
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
    if (companyCategory) {
      params.push(companyCategory.trim().toUpperCase());
      clauses.push(`UPPER(mis_data->>'company_category') = $${params.length}`);
    }
    if (ltfEligible === 'true' || ltfEligible === true) {
      clauses.push(`(mis_data->>'why_ltf_pricing' IS NOT NULL AND mis_data->>'why_ltf_pricing' != '')`);
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

  async getLeadsForExport({ search = '', card = '', source = '', utmSource = '', startDate = '', endDate = '', campaign = '', term = '', info = '', companyCategory = '', ltfEligible = '' }) {
    let query = 'SELECT * FROM leads';
    const params = [];
    const clauses = [];
    
    if (search) {
      params.push(`%${search.trim().toLowerCase()}%`);
      clauses.push(`(
        LOWER(full_name) LIKE $${params.length} 
        OR phone LIKE $${params.length} 
        OR LOWER(urn) LIKE $${params.length} 
        OR LOWER(pan_no) LIKE $${params.length}
        OR LOWER(company_name) LIKE $${params.length}
        OR LOWER(mis_data->>'company_code') LIKE $${params.length}
      )`);
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
    if (companyCategory) {
      params.push(companyCategory.trim().toUpperCase());
      clauses.push(`UPPER(mis_data->>'company_category') = $${params.length}`);
    }
    if (ltfEligible === 'true' || ltfEligible === true) {
      clauses.push(`(mis_data->>'why_ltf_pricing' IS NOT NULL AND mis_data->>'why_ltf_pricing' != '')`);
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
        utm_params, redirect_url, ip_address, user_agent, capi_status, capi_response, utm_internal, has_credit_card, pincode, monthly_income, pan_no, dob, mother_name, current_address, designation, company_name, mis_data, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62, $63, $64, $65, NOW())`,
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
        lead.company_name || null,
        lead.mis_data ? JSON.stringify(lead.mis_data) : '{}'
      ]
    );
    this.clearUTMCache();
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
    this.clearUTMCache();
    return { id, ...lead };
  },

  async deleteLead(id) {
    await pool.query('DELETE FROM leads WHERE id = $1', [id]);
    this.clearUTMCache();
    return true;
  },

  async deleteLeads(ids) {
    await pool.query('DELETE FROM leads WHERE id = ANY($1::varchar[])', [ids]);
    this.clearUTMCache();
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

  async setSetting(key, val) {
    return this.saveSetting(key, val);
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
    if (!updates || updates.length === 0) return [];
    const client = await pool.connect();
    const updatedLeads = [];
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
          RETURNING l.id, l.urn, l.full_name, l.phone, l.email, l.card_bank, l.card_name, l.mis_status, l.mis_data, l.fbclid, l.utm_params, l.ip_address, l.user_agent, l.landing_page
        `;
        
        const res = await client.query(queryText, queryParams);
        if (res.rows && res.rows.length > 0) {
          updatedLeads.push(...res.rows);
        }
      }
      return updatedLeads;
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

  getLeadCardKey(lead) {
    if (!lead) return 'other_card';
    if (lead.card_id && String(lead.card_id).trim()) {
      return String(lead.card_id).toLowerCase().trim();
    }
    const cardName = String(lead.card_name || '').toLowerCase().trim();
    const cardBank = String(lead.card_bank || '').toLowerCase().trim();
    const redirectUrl = String(lead.redirect_url || '').toLowerCase().trim();

    if (cardName) return cardName;
    if (cardBank) return cardBank;
    if (redirectUrl) return redirectUrl;

    return 'other_card';
  },

  async removeDuplicateLeads() {
    try {
      const allLeads = await this.getAllLeadsUnfiltered();
      const grouped = new Map();

      const isSyncedWithMis = (l) => {
        return !!(l.mis_status || l.mis_mapped_at || (l.mis_data && Object.keys(l.mis_data).length > 0));
      };

      allLeads.forEach(lead => {
        if (!lead.phone) return;
        const cleanPhone = String(lead.phone).replace(/\D/g, '').slice(-10);
        if (!cleanPhone || cleanPhone.length < 10) return;

        const cardKey = this.getLeadCardKey(lead);
        const dateStr = lead.created_at ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(lead.created_at)) : 'nodate';

        // Group by Phone + IST Creation Date (Same Day) + Specific Card Selection
        const key = `${cleanPhone}_${dateStr}_${cardKey}`;

        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key).push(lead);
      });

      const idsToDeleteSet = new Set();

      for (const [key, leads] of grouped.entries()) {
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

            // Always keep lead if it is mapped with Bank MIS
            if (isSyncedWithMis(dup)) {
              continue;
            }

            idsToDeleteSet.add(dup.id);
          }
        }
      }

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
          message: `Deduplication engine removed ${idsToDelete.length} duplicate lead(s) matching same contact, date & card selection. MIS mapped cases were preserved.`,
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
  },

  // --- Meta CAPI Lead Status ---
  async updateLeadCapiStatus(leadId, capiEvent, capiValue, capiStatus, capiResponse) {
    try {
      await pool.query(
        `UPDATE leads SET 
           capi_last_event = $1,
           capi_last_value = $2,
           capi_last_status = $3,
           capi_response = $4,
           capi_last_at = NOW()
         WHERE id = $5`,
        [capiEvent, capiValue, capiStatus, JSON.stringify(capiResponse || {}), leadId]
      );
    } catch (e) {
      console.error('[DB] updateLeadCapiStatus error:', e.message);
    }
  },

  // --- Meta Custom Audiences DB Helpers ---
  async getMetaAudiences(filters = {}) {
    try {
      let query = 'SELECT * FROM meta_audiences WHERE 1=1';
      const params = [];
      let paramIdx = 1;

      if (filters.bank_name && filters.bank_name !== 'ALL') {
        query += ` AND (bank_name ILIKE $${paramIdx} OR audience_type = 'GLOBAL_MASTER')`;
        params.push(`%${filters.bank_name}%`);
        paramIdx++;
      }

      if (filters.status_category && filters.status_category !== 'ALL') {
        query += ` AND (status_category = $${paramIdx} OR audience_type IN ('GLOBAL_MASTER', 'BANK_MASTER'))`;
        params.push(filters.status_category);
        paramIdx++;
      }

      if (filters.audience_type && filters.audience_type !== 'ALL') {
        query += ` AND audience_type = $${paramIdx}`;
        params.push(filters.audience_type);
        paramIdx++;
      }

      if (filters.search) {
        query += ` AND name ILIKE $${paramIdx}`;
        params.push(`%${filters.search}%`);
        paramIdx++;
      }

      query += ' ORDER BY created_at DESC';
      const res = await pool.query(query, params);
      return res.rows;
    } catch (e) {
      console.error('[DB] getMetaAudiences error:', e.message);
      return [];
    }
  },

  async getMetaAudienceById(id) {
    try {
      const res = await pool.query('SELECT * FROM meta_audiences WHERE id = $1', [id]);
      return res.rows[0] || null;
    } catch (e) {
      console.error('[DB] getMetaAudienceById error:', e.message);
      return null;
    }
  },

  async getMetaAudienceByName(name) {
    try {
      const res = await pool.query('SELECT * FROM meta_audiences WHERE name = $1', [name]);
      return res.rows[0] || null;
    } catch (e) {
      console.error('[DB] getMetaAudienceByName error:', e.message);
      return null;
    }
  },

  async createMetaAudience(aud) {
    try {
      const id = aud.id || `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const res = await pool.query(
        `INSERT INTO meta_audiences (
           id, name, audience_type, bank_name, status_category, meta_audience_id, description, auto_push, rules, database_count, synced_count, pending_count, failed_count, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          id,
          aud.name,
          aud.audience_type,
          aud.bank_name || null,
          aud.status_category || null,
          aud.meta_audience_id || null,
          aud.description || '',
          aud.auto_push !== undefined ? aud.auto_push : true,
          JSON.stringify(aud.rules || {}),
          aud.database_count || 0,
          aud.synced_count || 0,
          aud.pending_count || 0,
          aud.failed_count || 0,
          aud.status || 'active'
        ]
      );
      return res.rows[0];
    } catch (e) {
      console.error('[DB] createMetaAudience error:', e.message);
      throw e;
    }
  },

  async updateMetaAudience(id, updates) {
    try {
      const allowed = ['name', 'bank_name', 'status_category', 'meta_audience_id', 'description', 'auto_push', 'rules', 'database_count', 'synced_count', 'pending_count', 'failed_count', 'status', 'last_synced_at'];
      const setClauses = [];
      const params = [id];
      let paramIdx = 2;

      for (const field of allowed) {
        if (updates[field] !== undefined) {
          if (field === 'rules') {
            setClauses.push(`${field} = $${paramIdx}`);
            params.push(JSON.stringify(updates[field]));
          } else {
            setClauses.push(`${field} = $${paramIdx}`);
            params.push(updates[field]);
          }
          paramIdx++;
        }
      }

      if (setClauses.length === 0) return await this.getMetaAudienceById(id);

      const query = `UPDATE meta_audiences SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`;
      const res = await pool.query(query, params);
      return res.rows[0] || null;
    } catch (e) {
      console.error('[DB] updateMetaAudience error:', e.message);
      return null;
    }
  },

  async deleteMetaAudience(id) {
    try {
      await pool.query('DELETE FROM meta_audiences WHERE id = $1', [id]);
      return true;
    } catch (e) {
      console.error('[DB] deleteMetaAudience error:', e.message);
      return false;
    }
  },

  async upsertMetaAudienceMembership(audienceId, leadId, state = 'PENDING', errorMessage = null) {
    try {
      const id = `mem_${audienceId}_${leadId}`;
      const res = await pool.query(
        `INSERT INTO meta_audience_memberships (id, audience_id, lead_id, state, error_message, last_synced_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (audience_id, lead_id)
         DO UPDATE SET state = EXCLUDED.state, error_message = EXCLUDED.error_message, last_synced_at = NOW(), updated_at = NOW()
         RETURNING *`,
        [id, audienceId, leadId, state, errorMessage]
      );
      return res.rows[0];
    } catch (e) {
      console.error('[DB] upsertMetaAudienceMembership error:', e.message);
      return null;
    }
  },

  async getMetaAudienceMemberships(audienceId, options = {}) {
    try {
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      const state = options.state;

      let query = `
        SELECT m.*, l.full_name, l.phone, l.email, l.card_bank, l.mis_status, l.created_at as lead_created_at
        FROM meta_audience_memberships m
        JOIN leads l ON m.lead_id = l.id
        WHERE m.audience_id = $1
      `;
      const params = [audienceId];
      let pIdx = 2;

      if (state) {
        query += ` AND m.state = $${pIdx}`;
        params.push(state);
        pIdx++;
      }

      query += ` ORDER BY m.updated_at DESC LIMIT $${pIdx} OFFSET $${pIdx + 1}`;
      params.push(limit, offset);

      const res = await pool.query(query, params);
      
      const countRes = await pool.query(
        `SELECT COUNT(*) FROM meta_audience_memberships WHERE audience_id = $1 ${state ? 'AND state = $2' : ''}`,
        state ? [audienceId, state] : [audienceId]
      );

      return {
        rows: res.rows,
        total: parseInt(countRes.rows[0].count, 10)
      };
    } catch (e) {
      console.error('[DB] getMetaAudienceMemberships error:', e.message);
      return { rows: [], total: 0 };
    }
  },

  async createSyncJob(jobData) {
    try {
      const id = jobData.id || `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const res = await pool.query(
        `INSERT INTO meta_audience_sync_jobs (
           id, audience_id, job_type, status, total_records, processed_records, successful_records, failed_records, skipped_records, started_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         RETURNING *`,
        [
          id,
          jobData.audience_id || null,
          jobData.job_type || 'INCREMENTAL',
          jobData.status || 'PROCESSING',
          jobData.total_records || 0,
          jobData.processed_records || 0,
          jobData.successful_records || 0,
          jobData.failed_records || 0,
          jobData.skipped_records || 0
        ]
      );
      return res.rows[0];
    } catch (e) {
      console.error('[DB] createSyncJob error:', e.message);
      return null;
    }
  },

  async updateSyncJob(jobId, updates) {
    try {
      const setClauses = [];
      const params = [jobId];
      let pIdx = 2;

      const fields = ['status', 'total_records', 'processed_records', 'successful_records', 'failed_records', 'skipped_records', 'duration_ms', 'error_message'];
      for (const field of fields) {
        if (updates[field] !== undefined) {
          setClauses.push(`${field} = $${pIdx}`);
          params.push(updates[field]);
          pIdx++;
        }
      }

      if (updates.status === 'COMPLETED' || updates.status === 'FAILED') {
        setClauses.push('completed_at = NOW()');
      }

      if (setClauses.length === 0) return null;

      const query = `UPDATE meta_audience_sync_jobs SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`;
      const res = await pool.query(query, params);
      return res.rows[0] || null;
    } catch (e) {
      console.error('[DB] updateSyncJob error:', e.message);
      return null;
    }
  },

  async getSyncJobs(audienceId = null, options = {}) {
    try {
      const limit = options.limit || 50;
      const offset = options.offset || 0;

      let query = `
        SELECT j.*, a.name as audience_name
        FROM meta_audience_sync_jobs j
        LEFT JOIN meta_audiences a ON j.audience_id = a.id
        WHERE 1=1
      `;
      const params = [];
      let pIdx = 1;

      if (audienceId) {
        query += ` AND j.audience_id = $${pIdx}`;
        params.push(audienceId);
        pIdx++;
      }

      query += ` ORDER BY j.created_at DESC LIMIT $${pIdx} OFFSET $${pIdx + 1}`;
      params.push(limit, offset);

      const res = await pool.query(query, params);

      let countQuery = 'SELECT COUNT(*) FROM meta_audience_sync_jobs WHERE 1=1';
      if (audienceId) countQuery += ' AND audience_id = $1';
      const countRes = await pool.query(countQuery, audienceId ? [audienceId] : []);

      return {
        rows: res.rows,
        total: parseInt(countRes.rows[0].count, 10)
      };
    } catch (e) {
      console.error('[DB] getSyncJobs error:', e.message);
      return { rows: [], total: 0 };
    }
  },

  async insertAudienceAuditLog(logData) {
    try {
      const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await pool.query(
        `INSERT INTO meta_audience_audit_logs (
           id, user_id, user_name, action, audience_id, audience_name, records_processed, records_failed, details
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          logData.user_id || null,
          logData.user_name || 'System',
          logData.action,
          logData.audience_id || null,
          logData.audience_name || null,
          logData.records_processed || 0,
          logData.records_failed || 0,
          JSON.stringify(logData.details || {})
        ]
      );
    } catch (e) {
      console.error('[DB] insertAudienceAuditLog error:', e.message);
    }
  },

  async getAudienceAuditLogs(audienceId = null, options = {}) {
    try {
      const limit = options.limit || 50;
      const offset = options.offset || 0;

      let query = 'SELECT * FROM meta_audience_audit_logs WHERE 1=1';
      const params = [];
      let pIdx = 1;

      if (audienceId) {
        query += ` AND audience_id = $${pIdx}`;
        params.push(audienceId);
        pIdx++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${pIdx} OFFSET $${pIdx + 1}`;
      params.push(limit, offset);

      const res = await pool.query(query, params);
      return res.rows;
    } catch (e) {
      console.error('[DB] getAudienceAuditLogs error:', e.message);
      return [];
    }
  },

  async getAllActiveBanksFromDB() {
    try {
      const res = await pool.query(`
        SELECT DISTINCT TRIM(UPPER(card_bank)) as bank_name
        FROM leads
        WHERE card_bank IS NOT NULL AND card_bank != ''
        UNION
        SELECT DISTINCT TRIM(UPPER(bank)) as bank_name
        FROM cards
        WHERE bank IS NOT NULL AND bank != ''
      `);

      const banks = new Set(['SBI', 'HDFC', 'KIWI', 'SCAPIA']);
      res.rows.forEach(r => {
        if (r.bank_name) {
          let b = r.bank_name;
          if (b.includes('HDFC')) b = 'HDFC';
          else if (b.includes('SBI')) b = 'SBI';
          else if (b.includes('KIWI')) b = 'KIWI';
          else if (b.includes('SCAPIA')) b = 'SCAPIA';
          else if (b.includes('AXIS')) b = 'AXIS';
          else if (b.includes('ICICI')) b = 'ICICI';
          else if (b.includes('KOTAK')) b = 'KOTAK';
          else if (b.includes('INDUSIND')) b = 'INDUSIND';
          else if (b.includes('IDFC')) b = 'IDFC';
          else if (b.includes('AU')) b = 'AU';
          else if (b.includes('PNB')) b = 'PNB';
          else if (b.includes('YES')) b = 'YES';
          banks.add(b);
        }
      });

      return Array.from(banks);
    } catch (e) {
      console.error('[DB] getAllActiveBanksFromDB error:', e.message);
      return ['SBI', 'HDFC', 'KIWI', 'SCAPIA'];
    }
  },

  async getDatabaseStatus() {
    const status = {
      connected: true,
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'finmantra',
      dbSize: 'Unknown',
      rowCounts: {
        leads: 0,
        sbi_company_codes: 0,
        agents: 0,
        cards: 0,
        locations: 0
      }
    };
    try {
      const sizeRes = await pool.query("SELECT pg_size_pretty(pg_database_size(current_database())) AS size");
      if (sizeRes.rows[0]) {
        status.dbSize = sizeRes.rows[0].size;
      }
      
      const tables = ['leads', 'sbi_company_codes', 'agents', 'cards', 'locations'];
      for (const t of tables) {
        try {
          const countRes = await pool.query(`SELECT COUNT(*) FROM ${t}`);
          status.rowCounts[t] = parseInt(countRes.rows[0].count, 10);
        } catch (e) {
          status.rowCounts[t] = 0;
        }
      }
    } catch (err) {
      status.connected = false;
      status.error = err.message;
    }
    return status;
  },

  async runQuery(sql, params = []) {
    return await pool.query(sql, params);
  },

  async getDesignations(employmentType) {
    if (employmentType) {
      const res = await pool.query('SELECT designation FROM designations WHERE LOWER(employment_type) = LOWER($1) ORDER BY designation ASC', [employmentType]);
      return res.rows.map(r => r.designation);
    }
    const res = await pool.query('SELECT employment_type, designation FROM designations ORDER BY employment_type ASC, designation ASC');
    return res.rows;
  },

  // --- Campaigns Database Helper Operations ---
  async getCampaigns() {
    const res = await pool.query(
      `SELECT c.*, COUNT(l.id)::int as leads_count 
       FROM campaigns c 
       LEFT JOIN campaign_leads l ON c.id = l.campaign_id 
       GROUP BY c.id 
       ORDER BY c.created_at DESC`
    );
    return res.rows;
  },

  async createCampaign(id, name, description) {
    const res = await pool.query(
      'INSERT INTO campaigns (id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [id, name, description]
    );
    return res.rows[0];
  },

  async deleteCampaign(id) {
    const res = await pool.query('DELETE FROM campaigns WHERE id = $1 RETURNING *', [id]);
    return res.rows[0];
  },

  async getCampaignLeads(campaignId) {
    const res = await pool.query('SELECT * FROM campaign_leads WHERE campaign_id = $1 ORDER BY created_at DESC', [campaignId]);
    return res.rows;
  },

  async addCampaignLeads(leads) {
    if (leads.length === 0) return 0;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const seenContacts = new Set();
      for (const lead of leads) {
        const contactVal = (lead.contact || '').trim();
        if (contactVal && seenContacts.has(contactVal)) continue;
        if (contactVal) seenContacts.add(contactVal);

        const cleanMail = lead.mail && String(lead.mail).includes('@') ? String(lead.mail).toLowerCase().trim() : null;
        await client.query(
          `INSERT INTO campaign_leads (id, campaign_id, name, contact, mail, address) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           ON CONFLICT (id) DO UPDATE SET name = $3, contact = $4, mail = $5, address = $6`,
          [lead.id, lead.campaign_id, lead.name, contactVal || null, cleanMail, lead.address]
        ).catch(() => {});
      }
      await client.query('COMMIT');
      return leads.length;
    } catch (err) {
      await client.query('ROLLBACK');
      return 0;
    } finally {
      client.release();
    }
  },

  async deleteCampaignLead(leadId) {
    const res = await pool.query('DELETE FROM campaign_leads WHERE id = $1 RETURNING *', [leadId]);
    return res.rows[0];
  },

  async createCampaignBroadcast(id, campaignId, name, channel, whatsappTemplate, whatsappMessage, emailSubject, emailBody, targetedCount, scheduledAt, mediaUrl = null) {
    const res = await pool.query(
      `INSERT INTO campaign_broadcasts 
       (id, campaign_id, name, channel, whatsapp_template, whatsapp_message, email_subject, email_body, targeted_count, scheduled_at, status, media_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING *`,
      [id, campaignId, name, channel, whatsappTemplate, whatsappMessage, emailSubject, emailBody, targetedCount, scheduledAt, scheduledAt ? 'scheduled' : 'draft', mediaUrl]
    );
    return res.rows[0];
  },

  async updateCampaignBroadcast(id, { name, channel, whatsappTemplate, whatsappMessage, emailSubject, emailBody, scheduledAt, mediaUrl, metaPhoneNumberId, metaPhoneNumber, senderEmail, smtpAccountId }) {
    const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
    const res = await pool.query(
      `UPDATE campaign_broadcasts 
       SET name = COALESCE($2::text, name), 
           channel = COALESCE($3::text, channel), 
           whatsapp_template = COALESCE($4::text, whatsapp_template), 
           whatsapp_message = COALESCE($5::text, whatsapp_message), 
           email_subject = COALESCE($6::text, email_subject), 
           email_body = COALESCE($7::text, email_body), 
           scheduled_at = $8::timestamptz, 
           media_url = COALESCE($9::text, media_url),
           meta_phone_number_id = COALESCE($10::text, meta_phone_number_id),
           meta_phone_number = COALESCE($11::text, meta_phone_number),
           sender_email = COALESCE($12::text, sender_email),
           smtp_account_id = COALESCE($13::text, smtp_account_id),
           status = CASE WHEN $8::timestamptz IS NOT NULL AND status != 'sent' THEN 'scheduled' ELSE status END
       WHERE id = $1::text 
       RETURNING *`,
      [
        id, 
        name || null, 
        channel || null, 
        whatsappTemplate !== undefined ? (whatsappTemplate || null) : null, 
        whatsappMessage !== undefined ? (whatsappMessage || null) : null, 
        emailSubject !== undefined ? (emailSubject || null) : null, 
        emailBody !== undefined ? (emailBody || null) : null, 
        scheduledDate, 
        mediaUrl !== undefined ? (mediaUrl || null) : null,
        metaPhoneNumberId !== undefined ? (metaPhoneNumberId || null) : null,
        metaPhoneNumber !== undefined ? (metaPhoneNumber || null) : null,
        senderEmail !== undefined ? (senderEmail || null) : null,
        smtpAccountId !== undefined ? (smtpAccountId || null) : null
      ]
    );
    return res.rows[0];
  },

  async getSmtpAccounts() {
    const res = await pool.query('SELECT * FROM campaign_smtp_accounts ORDER BY is_default DESC, created_at ASC');
    return res.rows;
  },

  async getSmtpAccountById(id) {
    const res = await pool.query('SELECT * FROM campaign_smtp_accounts WHERE id = $1', [id]);
    return res.rows[0] || null;
  },

  async getDefaultSmtpAccount() {
    const res = await pool.query('SELECT * FROM campaign_smtp_accounts WHERE is_default = TRUE LIMIT 1');
    if (res.rows.length > 0) return res.rows[0];
    const anyRes = await pool.query('SELECT * FROM campaign_smtp_accounts ORDER BY created_at ASC LIMIT 1');
    return anyRes.rows[0] || null;
  },

  async createSmtpAccount({ id, name, host, port, username, password, secure, fromName, fromEmail, isDefault, providerType = 'smtp', awsAccessKeyId, awsSecretAccessKey, awsRegion = 'ap-south-1', awsSessionToken, configurationSet }) {
    const aid = id || ((providerType === 'aws_ses' ? 'ses_' : 'smtp_') + Date.now().toString(36) + Math.random().toString(36).substring(2, 6));
    if (isDefault) {
      await pool.query('UPDATE campaign_smtp_accounts SET is_default = FALSE');
    } else {
      const countRes = await pool.query('SELECT COUNT(*) FROM campaign_smtp_accounts');
      if (parseInt(countRes.rows[0].count, 10) === 0) {
        isDefault = true;
      }
    }
    const res = await pool.query(
      `INSERT INTO campaign_smtp_accounts 
       (id, name, host, port, username, password, secure, from_name, from_email, is_default, provider_type, aws_access_key_id, aws_secret_access_key, aws_region, aws_session_token, configuration_set)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        aid,
        name,
        host || null,
        port ? parseInt(port, 10) : 465,
        username || null,
        password || null,
        secure ?? true,
        fromName || 'FinMantra',
        fromEmail,
        !!isDefault,
        providerType || 'smtp',
        awsAccessKeyId || null,
        awsSecretAccessKey || null,
        awsRegion || 'ap-south-1',
        awsSessionToken || null,
        configurationSet || null
      ]
    );
    return res.rows[0];
  },

  async updateSmtpAccount(id, { name, host, port, username, password, secure, fromName, fromEmail, isDefault, providerType, awsAccessKeyId, awsSecretAccessKey, awsRegion, awsSessionToken, configurationSet }) {
    if (isDefault) {
      await pool.query('UPDATE campaign_smtp_accounts SET is_default = FALSE WHERE id != $1', [id]);
    }
    const res = await pool.query(
      `UPDATE campaign_smtp_accounts
       SET name = COALESCE($2, name),
           host = COALESCE($3, host),
           port = COALESCE($4, port),
           username = COALESCE($5, username),
           password = CASE WHEN $6::text IS NOT NULL AND $6::text != '' THEN $6::text ELSE password END,
           secure = COALESCE($7, secure),
           from_name = COALESCE($8, from_name),
           from_email = COALESCE($9, from_email),
           is_default = COALESCE($10, is_default),
           provider_type = COALESCE($11, provider_type),
           aws_access_key_id = COALESCE($12, aws_access_key_id),
           aws_secret_access_key = CASE WHEN $13::text IS NOT NULL AND $13::text != '' THEN $13::text ELSE aws_secret_access_key END,
           aws_region = COALESCE($14, aws_region),
           aws_session_token = COALESCE($15, aws_session_token),
           configuration_set = COALESCE($16, configuration_set),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        id,
        name,
        host || null,
        port ? parseInt(port, 10) : null,
        username || null,
        password || null,
        secure,
        fromName,
        fromEmail,
        isDefault,
        providerType || null,
        awsAccessKeyId || null,
        awsSecretAccessKey || null,
        awsRegion || null,
        awsSessionToken || null,
        configurationSet || null
      ]
    );
    return res.rows[0];
  },

  async deleteSmtpAccount(id) {
    const res = await pool.query('DELETE FROM campaign_smtp_accounts WHERE id = $1 RETURNING *', [id]);
    if (res.rows[0]?.is_default) {
      await pool.query('UPDATE campaign_smtp_accounts SET is_default = TRUE WHERE id = (SELECT id FROM campaign_smtp_accounts ORDER BY created_at ASC LIMIT 1)');
    }
    return res.rows[0];
  },

  async setDefaultSmtpAccount(id) {
    await pool.query('UPDATE campaign_smtp_accounts SET is_default = FALSE');
    const res = await pool.query('UPDATE campaign_smtp_accounts SET is_default = TRUE WHERE id = $1 RETURNING *', [id]);
    return res.rows[0];
  },

  async getCampaignBroadcasts(campaignId) {
    let res;
    if (campaignId) {
      res = await pool.query('SELECT * FROM campaign_broadcasts WHERE campaign_id = $1 ORDER BY created_at DESC', [campaignId]);
    } else {
      res = await pool.query('SELECT * FROM campaign_broadcasts ORDER BY created_at DESC');
    }
    return res.rows;
  },

  async getCampaignBroadcastById(id) {
    const res = await pool.query('SELECT * FROM campaign_broadcasts WHERE id = $1 LIMIT 1', [id]);
    return res.rows[0] || null;
  },

  async deleteCampaignBroadcast(id) {
    await pool.query('DELETE FROM campaign_logs WHERE broadcast_id = $1', [id]).catch(() => {});
    const res = await pool.query('DELETE FROM campaign_broadcasts WHERE id = $1 RETURNING *', [id]);
    return res.rows[0];
  },

  async updateCampaignBroadcastStatus(id, status, sentCount = 0, failedCount = 0) {
    let lastTriggerStatus = null;
    if (status === 'sent') {
      lastTriggerStatus = 'sent';
    } else if (status === 'failed') {
      lastTriggerStatus = 'failed';
    }

    if (lastTriggerStatus) {
      const res = await pool.query(
        `UPDATE campaign_broadcasts 
         SET status = $2, sent_count = $3, failed_count = $4, last_triggered_at = CURRENT_TIMESTAMP, last_trigger_status = $5 
         WHERE id = $1 
         RETURNING *`,
        [id, status, sentCount, failedCount, lastTriggerStatus]
      );
      return res.rows[0];
    } else {
      const res = await pool.query(
        `UPDATE campaign_broadcasts 
         SET status = $2, sent_count = $3, failed_count = $4 
         WHERE id = $1 
         RETURNING *`,
        [id, status, sentCount, failedCount]
      );
      return res.rows[0];
    }
  },

  async getScheduledBroadcastsToRun() {
    const res = await pool.query(
      `SELECT * FROM campaign_broadcasts 
       WHERE status = 'scheduled' AND scheduled_at <= CURRENT_TIMESTAMP`
    );
    return res.rows;
  },

  async logCampaignBroadcastDelivery(id, broadcastId, campaignLeadId, channel, status, errorMessage, recipientPhone = '', recipientEmail = '', wamid = null, errorCode = null) {
    const isDelivered = (status === 'delivered' || status === 'read');
    const isRead = (status === 'read');
    try {
      const res = await pool.query(
        `INSERT INTO campaign_logs (id, broadcast_id, campaign_lead_id, channel, status, error_message, recipient_phone, recipient_email, wamid, error_code, delivered_at, read_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
                 CASE WHEN $11::boolean = true THEN CURRENT_TIMESTAMP ELSE NULL END,
                 CASE WHEN $12::boolean = true THEN CURRENT_TIMESTAMP ELSE NULL END) 
         RETURNING *`,
        [id, broadcastId, campaignLeadId, channel, status, errorMessage, recipientPhone, recipientEmail, wamid, errorCode, isDelivered, isRead]
      );
      return res.rows[0];
    } catch (err) {
      console.error('[logCampaignBroadcastDelivery] Warning on insert:', err.message);
      try {
        const fallback = await pool.query(
          `INSERT INTO campaign_logs (id, broadcast_id, channel, status, error_message, recipient_phone, recipient_email, wamid, error_code) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
           RETURNING *`,
          [id, broadcastId, channel, status, (errorMessage || '') + (campaignLeadId ? ` (Lead: ${campaignLeadId})` : ''), recipientPhone, recipientEmail, wamid, errorCode]
        );
        return fallback.rows[0];
      } catch (e) {
        return null;
      }
    }
  },

  async updateBroadcastDeliveryCounters(broadcastId) {
    if (!broadcastId) return null;
    try {
      const res = await pool.query(`
        UPDATE campaign_broadcasts b
        SET 
          sent_count = (
            SELECT COUNT(*) FROM campaign_logs 
            WHERE broadcast_id = b.id AND status IN ('sent', 'delivered', 'read')
          ),
          delivered_count = (
            SELECT COUNT(*) FROM campaign_logs 
            WHERE broadcast_id = b.id AND status IN ('delivered', 'read')
          ),
          read_count = (
            SELECT COUNT(*) FROM campaign_logs 
            WHERE broadcast_id = b.id AND status = 'read'
          ),
          failed_count = (
            SELECT COUNT(*) FROM campaign_logs 
            WHERE broadcast_id = b.id AND status = 'failed'
          )
        WHERE b.id = $1
        RETURNING *
      `, [broadcastId]);
      return res.rows[0] || null;
    } catch (err) {
      console.error('[updateBroadcastDeliveryCounters Error]:', err.message);
      return null;
    }
  },

  async getCampaignLogs(broadcastId) {
    const res = await pool.query(`
      SELECT l.*, 
             COALESCE(ml.name, cl.name, 'Recipient') as lead_name,
             COALESCE(ml.contact, cl.contact, l.recipient_phone, '') as lead_contact,
             COALESCE(ml.mail, cl.mail, l.recipient_email, '') as lead_mail,
             COALESCE(ml.finmantra_id, '') as lead_finmantra_id
      FROM campaign_logs l
      LEFT JOIN campaign_master_leads ml ON (ml.id = l.campaign_lead_id OR (l.recipient_phone != '' AND ml.contact = l.recipient_phone))
      LEFT JOIN campaign_leads cl ON cl.id = l.campaign_lead_id
      WHERE l.broadcast_id = $1 
      ORDER BY l.sent_at DESC
    `, [broadcastId]);
    return res.rows;
  },

  // --- Master Data Center Helper Operations ---
  async getNextFinmantraId() {
    return this.getNextCampaignDataId();
  },

  async getNextCampaignDataId() {
    const res = await pool.query(`
      SELECT finmantra_id, campaign_data_id FROM campaign_master_leads 
      WHERE finmantra_id LIKE 'FMCB%' OR campaign_data_id LIKE 'FMCB%'
    `);
    let maxSeq = 0;
    res.rows.forEach(r => {
      const match1 = (r.finmantra_id || '').match(/FMCB(\d+)/i);
      const match2 = (r.campaign_data_id || '').match(/FMCB(\d+)/i);
      if (match1 && match1[1]) maxSeq = Math.max(maxSeq, parseInt(match1[1], 10));
      if (match2 && match2[1]) maxSeq = Math.max(maxSeq, parseInt(match2[1], 10));
    });
    const nextSeq = maxSeq + 1;
    return `FMCB${String(nextSeq).padStart(5, '0')}`;
  },

  async getMasterLeadsFiltered({
    search = '',
    broadcastName = '',
    broadcastDateFrom = '',
    broadcastDateTo = '',
    metaWhatsappNo = '',
    senderEmail = '',
    optinWhatsapp = '',
    optinEmail = '',
    page = 1,
    limit = 50
  }) {
    let whereClauses = [];
    let params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      whereClauses.push(`(
        LOWER(name) LIKE $${params.length} OR 
        contact LIKE $${params.length} OR 
        LOWER(mail) LIKE $${params.length} OR 
        LOWER(COALESCE(finmantra_id, '')) LIKE $${params.length} OR 
        LOWER(COALESCE(campaign_data_id, '')) LIKE $${params.length} OR 
        LOWER(COALESCE(address, '')) LIKE $${params.length}
      )`);
    }

    if (broadcastName && broadcastName.trim()) {
      params.push(broadcastName.trim());
      const pIdx = params.length;
      whereClauses.push(`(
        LOWER(last_broadcast_name) = LOWER($${pIdx}) 
        OR last_broadcast_id IN (SELECT id FROM campaign_broadcasts WHERE LOWER(name) = LOWER($${pIdx}))
        OR id IN (
          SELECT campaign_lead_id FROM campaign_logs 
          WHERE broadcast_id IN (SELECT id FROM campaign_broadcasts WHERE LOWER(name) = LOWER($${pIdx}))
        )
        OR contact IN (
          SELECT recipient_phone FROM campaign_logs 
          WHERE broadcast_id IN (SELECT id FROM campaign_broadcasts WHERE LOWER(name) = LOWER($${pIdx}))
        )
        OR mail IN (
          SELECT recipient_email FROM campaign_logs 
          WHERE broadcast_id IN (SELECT id FROM campaign_broadcasts WHERE LOWER(name) = LOWER($${pIdx}))
        )
      )`);
    }

    if (broadcastDateFrom) {
      params.push(new Date(broadcastDateFrom).toISOString());
      const pIdx = params.length;
      whereClauses.push(`(last_broadcast_date >= $${pIdx} OR created_at >= $${pIdx})`);
    }

    if (broadcastDateTo) {
      const toDate = new Date(broadcastDateTo);
      toDate.setHours(23, 59, 59, 999);
      params.push(toDate.toISOString());
      const pIdx = params.length;
      whereClauses.push(`(last_broadcast_date <= $${pIdx} OR created_at <= $${pIdx})`);
    }

    if (metaWhatsappNo && metaWhatsappNo.trim()) {
      params.push(metaWhatsappNo.trim());
      const pIdx = params.length;
      whereClauses.push(`(
        meta_whatsapp_no = $${pIdx} 
        OR last_broadcast_id IN (SELECT id FROM campaign_broadcasts WHERE meta_phone_number = $${pIdx} OR meta_phone_number_id = $${pIdx})
      )`);
    }

    if (senderEmail && senderEmail.trim()) {
      params.push(senderEmail.trim().toLowerCase());
      const pIdx = params.length;
      whereClauses.push(`(
        LOWER(sender_email) = $${pIdx} 
        OR last_broadcast_id IN (SELECT id FROM campaign_broadcasts WHERE LOWER(sender_email) = $${pIdx})
      )`);
    }

    if (optinWhatsapp !== '' && optinWhatsapp !== undefined && optinWhatsapp !== null && optinWhatsapp !== 'all') {
      const isOptin = (optinWhatsapp === 'true' || optinWhatsapp === true);
      if (isOptin) {
        whereClauses.push(`COALESCE(whatsapp_optin, TRUE) = TRUE`);
      } else {
        whereClauses.push(`whatsapp_optin = FALSE`);
      }
    }

    if (optinEmail !== '' && optinEmail !== undefined && optinEmail !== null && optinEmail !== 'all') {
      const isOptin = (optinEmail === 'true' || optinEmail === true);
      if (isOptin) {
        whereClauses.push(`COALESCE(email_optin, TRUE) = TRUE`);
      } else {
        whereClauses.push(`email_optin = FALSE`);
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*)::int as total FROM campaign_master_leads ${whereSql}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    let leads = [];
    if (limit && limit > 0) {
      const offset = (Math.max(1, page) - 1) * limit;
      const dataParams = [...params, limit, offset];
      const dataRes = await pool.query(
        `SELECT * FROM campaign_master_leads 
         ${whereSql} 
         ORDER BY created_at DESC 
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );
      leads = dataRes.rows;
    } else {
      // Return all for export
      const dataRes = await pool.query(
        `SELECT * FROM campaign_master_leads 
         ${whereSql} 
         ORDER BY created_at DESC`,
        params
      );
      leads = dataRes.rows;
    }

    return { total, page: Number(page), limit: Number(limit), leads };
  },

  async getMasterFilterOptions() {
    const [bcNamesRes, waNosRes, emailsRes] = await Promise.all([
      pool.query(`
        SELECT DISTINCT name FROM (
          SELECT name FROM campaign_broadcasts WHERE name IS NOT NULL AND TRIM(name) != ''
          UNION
          SELECT last_broadcast_name as name FROM campaign_master_leads WHERE last_broadcast_name IS NOT NULL AND TRIM(last_broadcast_name) != ''
        ) t ORDER BY name ASC
      `),
      pool.query(`
        SELECT DISTINCT no FROM (
          SELECT meta_phone_number as no FROM campaign_broadcasts WHERE meta_phone_number IS NOT NULL AND TRIM(meta_phone_number) != ''
          UNION
          SELECT meta_whatsapp_no as no FROM campaign_master_leads WHERE meta_whatsapp_no IS NOT NULL AND TRIM(meta_whatsapp_no) != ''
        ) t ORDER BY no ASC
      `),
      pool.query(`
        SELECT DISTINCT email FROM (
          SELECT sender_email as email FROM campaign_broadcasts WHERE sender_email IS NOT NULL AND TRIM(sender_email) != ''
          UNION
          SELECT sender_email as email FROM campaign_master_leads WHERE sender_email IS NOT NULL AND TRIM(sender_email) != ''
        ) t ORDER BY email ASC
      `)
    ]);

    return {
      broadcastNames: bcNamesRes.rows.map(r => r.name).filter(Boolean),
      metaWhatsappNos: waNosRes.rows.map(r => r.no).filter(Boolean),
      senderEmails: emailsRes.rows.map(r => r.email).filter(Boolean)
    };
  },

  async getMasterLeads() {
    const res = await pool.query('SELECT * FROM campaign_master_leads ORDER BY created_at DESC');
    return res.rows;
  },

  async getMasterLeadById(id) {
    if (!id) return null;
    let cleanId = String(id).trim();
    
    // Strip compound broadcast tokens if present
    if (cleanId.includes('&utm_brodcast_id=')) {
      cleanId = cleanId.split('&utm_brodcast_id=')[0];
    } else if (cleanId.includes('&broadcast_id=')) {
      cleanId = cleanId.split('&broadcast_id=')[0];
    } else if (cleanId.includes('_bc_')) {
      cleanId = cleanId.split('_bc_')[0];
    }

    let phoneDigits = cleanId.replace(/\D/g, '');
    let phone10 = phoneDigits.length === 12 && phoneDigits.startsWith('91') ? phoneDigits.substring(2) : phoneDigits.length === 10 ? phoneDigits : '';
    let phone12 = phoneDigits.length === 10 ? '91' + phoneDigits : phoneDigits.length === 12 ? phoneDigits : '';

    // 1. Primary lookup in campaign_master_leads
    const res = await pool.query(
      `SELECT * FROM campaign_master_leads 
       WHERE id = $1 
          OR finmantra_id = $1 
          OR campaign_data_id = $1
          OR ($2 != '' AND (contact = $2 OR contact = $3))
          OR (mail != '' AND LOWER(TRIM(mail)) = LOWER($1))
       LIMIT 1`, 
      [cleanId, phone10, phone12]
    );

    if (res.rows[0]) return res.rows[0];

    // 2. Fallback lookup in main 'leads' table
    try {
      const fallbackRes = await pool.query(
        `SELECT id, urn, name as full_name, phone as contact, email as mail, 
                whatsapp_optin, email_optin, 
                COALESCE(urn, id::text) as finmantra_id, created_at 
         FROM leads 
         WHERE id::text = $1 
            OR urn = $1
            OR ($2 != '' AND (phone = $2 OR phone = $3)) 
            OR (email != '' AND LOWER(TRIM(email)) = LOWER($1)) 
         LIMIT 1`,
        [cleanId, phone10, phone12]
      );
      if (fallbackRes.rows[0]) return fallbackRes.rows[0];
    } catch (e) {}

    // 3. Fallback for phone/email direct parameters: dynamically resolve so user can always manage preferences with 0 errors
    if (phone10 || phone12 || cleanId.includes('@')) {
      const contactVal = phone10 || (cleanId.includes('@') ? '' : cleanId);
      const mailVal = cleanId.includes('@') ? cleanId : '';
      return {
        id: 'contact_' + (contactVal || mailVal.replace(/[^a-zA-Z0-9]/g, '_')),
        finmantra_id: 'FMCB_' + (contactVal || 'USER'),
        campaign_data_id: 'FMCB_' + (contactVal || 'USER'),
        name: 'Valued Customer',
        contact: contactVal,
        mail: mailVal,
        whatsapp_optin: true,
        email_optin: true
      };
    }

    return null;
  },

  async upsertMasterLeadsFromBroadcast(rawLeads, broadcastInfo = {}) {
    if (!rawLeads || rawLeads.length === 0) return { total: 0, inserted: 0, updated: 0, leads: [] };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Fetch existing FMCB IDs to accurately sequence next unmapped FMCB numbers
      const existingFmcbRes = await client.query(`
        SELECT finmantra_id, campaign_data_id FROM campaign_master_leads 
        WHERE finmantra_id LIKE 'FMCB%' OR campaign_data_id LIKE 'FMCB%'
      `);
      let maxFmcbSeq = 0;
      existingFmcbRes.rows.forEach(r => {
        const m1 = (r.finmantra_id || '').match(/FMCB(\d+)/i);
        const m2 = (r.campaign_data_id || '').match(/FMCB(\d+)/i);
        if (m1 && m1[1]) maxFmcbSeq = Math.max(maxFmcbSeq, parseInt(m1[1], 10));
        if (m2 && m2[1]) maxFmcbSeq = Math.max(maxFmcbSeq, parseInt(m2[1], 10));
      });

      let insertedCount = 0;
      let updatedCount = 0;
      const processedLeads = [];

      for (let i = 0; i < rawLeads.length; i++) {
        const item = rawLeads[i];
        const rawContactStr = String(item.contact || item.phone || item.mobile || '').trim();
        const contactDigits = rawContactStr.replace(/\D/g, '');
        const contact = contactDigits;
        const mail = String(item.mail || item.email || '').trim();
        const name = String(item.name || item.full_name || 'Contact').trim();
        const address = String(item.address || item.city || item.location || '').trim();

        if (!contact && !mail) continue; // Must have either contact or email

        let contact10 = '';
        let contact12 = '';
        if (contactDigits.length === 10) {
          contact10 = contactDigits;
          contact12 = '91' + contactDigits;
        } else if (contactDigits.length === 12 && contactDigits.startsWith('91')) {
          contact10 = contactDigits.substring(2);
          contact12 = contactDigits;
        } else if (contactDigits.length > 10) {
          contact10 = contactDigits.slice(-10);
          contact12 = contactDigits;
        } else {
          contact10 = contactDigits;
          contact12 = contactDigits;
        }
        const cleanMail = mail && mail.includes('@') ? mail.toLowerCase().trim() : null;

        // Check if contact or email already exists in campaign_master_leads
        const existingRes = await client.query(
          `SELECT * FROM campaign_master_leads 
           WHERE (contact != '' AND (contact = $1 OR contact = $2 OR contact = $3)) 
              OR ($4::text IS NOT NULL AND mail IS NOT NULL AND LOWER(TRIM(mail)) = LOWER(TRIM($4))) 
           LIMIT 1`,
          [contact || '__NONE__', contact10 || '__NONE__', contact12 || '__NONE__', cleanMail]
        );

        // Check Leads Repository (leads table) for matching contact or email to pick URN
        const leadMatchRes = await client.query(
          `SELECT urn, id, full_name FROM leads 
           WHERE ($1 != '' AND (
                  phone = $1 OR phone = $2 OR phone = $3 
                  OR RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = $2
                ))
              OR ($4::text IS NOT NULL AND email IS NOT NULL AND LOWER(TRIM(email)) = $4)
           ORDER BY created_at DESC 
           LIMIT 1`,
          [contact || '', contact10 || '', contact12 || '', cleanMail]
        );

        let mappedUrn = null;
        if (leadMatchRes.rows.length > 0 && leadMatchRes.rows[0].urn && String(leadMatchRes.rows[0].urn).trim() !== '') {
          mappedUrn = String(leadMatchRes.rows[0].urn).trim();
        }

        const bcId = broadcastInfo.broadcastId || null;
        const bcName = broadcastInfo.broadcastName || null;
        const metaWaNo = broadcastInfo.metaWaNo || null;
        const senderEmail = broadcastInfo.senderEmail || null;

        if (existingRes.rows.length > 0) {
          const existingLead = existingRes.rows[0];
          // If existing master lead did not have a URN, but we found a match in Leads Repository, upgrade ID to URN
          let updatedFinmantraId = existingLead.finmantra_id;
          let updatedCampaignDataId = existingLead.campaign_data_id;
          
          if (mappedUrn && (!updatedFinmantraId || !updatedFinmantraId.startsWith('FM') || updatedFinmantraId.startsWith('FMCB') || updatedFinmantraId.startsWith('CD'))) {
            updatedFinmantraId = mappedUrn;
            updatedCampaignDataId = mappedUrn;
          } else if (!updatedFinmantraId) {
            if (mappedUrn) {
              updatedFinmantraId = mappedUrn;
              updatedCampaignDataId = mappedUrn;
            } else {
              maxFmcbSeq++;
              const genId = `FMCB${String(maxFmcbSeq).padStart(5, '0')}`;
              updatedFinmantraId = genId;
              updatedCampaignDataId = genId;
            }
          }

          await client.query(
            `UPDATE campaign_master_leads 
             SET finmantra_id = COALESCE($1, finmantra_id),
                 campaign_data_id = COALESCE($2, campaign_data_id),
                 name = CASE WHEN (name IS NULL OR name = '' OR name = 'Contact') AND $3 != '' THEN $3 ELSE name END,
                 address = CASE WHEN (address IS NULL OR address = '') AND $4 != '' THEN $4 ELSE address END,
                 mail = CASE WHEN (mail IS NULL OR mail = '') AND $5::text IS NOT NULL THEN $5 ELSE mail END,
                 last_broadcast_id = COALESCE($6, last_broadcast_id),
                 last_broadcast_name = COALESCE($7, last_broadcast_name),
                 meta_whatsapp_no = COALESCE($8, meta_whatsapp_no),
                 sender_email = COALESCE($9, sender_email),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $10`,
            [updatedFinmantraId, updatedCampaignDataId, name, address, cleanMail, bcId, bcName, metaWaNo, senderEmail, existingLead.id]
          );
          updatedCount++;
          processedLeads.push({ ...existingLead, finmantra_id: updatedFinmantraId, campaign_data_id: updatedCampaignDataId, isNew: false });
        } else {
          const newId = 'cml_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
          let assignedFinmantraId = '';
          if (mappedUrn) {
            assignedFinmantraId = mappedUrn;
          } else {
            maxFmcbSeq++;
            assignedFinmantraId = `FMCB${String(maxFmcbSeq).padStart(5, '0')}`;
          }
          const assignedCampaignDataId = assignedFinmantraId;

          await client.query(
            `INSERT INTO campaign_master_leads 
             (id, finmantra_id, campaign_data_id, name, contact, mail, address, last_broadcast_id, last_broadcast_name, meta_whatsapp_no, sender_email)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO NOTHING`,
            [newId, assignedFinmantraId, assignedCampaignDataId, name, contact, cleanMail, address, bcId, bcName, metaWaNo, senderEmail]
          );
          insertedCount++;
          processedLeads.push({
            id: newId,
            finmantra_id: assignedFinmantraId,
            campaign_data_id: assignedCampaignDataId,
            name,
            contact,
            mail: cleanMail,
            address,
            whatsapp_optin: true,
            email_optin: true,
            isNew: true
          });
        }
      }

      await client.query('COMMIT');
      return { total: rawLeads.length, inserted: insertedCount, updated: updatedCount, leads: processedLeads };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async updateMasterLeadOptin(idOrFinmantraId, { whatsapp_optin, email_optin, reason = '' }) {
    const cleanId = String(idOrFinmantraId || '').trim();
    let phoneDigits = cleanId.replace(/\D/g, '');
    let phone10 = phoneDigits.length === 12 && phoneDigits.startsWith('91') ? phoneDigits.substring(2) : phoneDigits.length === 10 ? phoneDigits : '';
    let phone12 = phoneDigits.length === 10 ? '91' + phoneDigits : phoneDigits.length === 12 ? phoneDigits : '';

    const updates = [];
    const params = [cleanId, phone10, phone12];

    if (whatsapp_optin !== undefined) {
      params.push(Boolean(whatsapp_optin));
      updates.push(`whatsapp_optin = $${params.length}`);
    }

    if (email_optin !== undefined) {
      params.push(Boolean(email_optin));
      updates.push(`email_optin = $${params.length}`);
    }

    if (updates.length === 0) return null;

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    let res = await pool.query(
      `UPDATE campaign_master_leads 
       SET ${updates.join(', ')} 
       WHERE id = $1 
          OR finmantra_id = $1 
          OR campaign_data_id = $1 
          OR ($2 != '' AND (contact = $2 OR contact = $3))
          OR (mail != '' AND LOWER(TRIM(mail)) = LOWER($1))
       RETURNING *`,
      params
    );

    if (res.rows && res.rows.length > 0) {
      return res.rows[0];
    }

    // If record did not exist in campaign_master_leads, insert it as opted out
    if (phone10 || cleanId) {
      const contactVal = phone10 || (cleanId.includes('@') ? '' : cleanId);
      const mailVal = cleanId.includes('@') ? cleanId : '';
      const newId = 'cml_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const fmId = 'FM' + String(Date.now()).slice(-5);
      const ins = await pool.query(
        `INSERT INTO campaign_master_leads (id, finmantra_id, contact, mail, name, whatsapp_optin, email_optin)
         VALUES ($1, $2, $3, $4, 'Customer', $5, $6)
         ON CONFLICT (id) DO UPDATE SET whatsapp_optin = EXCLUDED.whatsapp_optin, email_optin = EXCLUDED.email_optin
         RETURNING *`,
        [newId, fmId, contactVal, mailVal, whatsapp_optin !== undefined ? Boolean(whatsapp_optin) : true, email_optin !== undefined ? Boolean(email_optin) : true]
      );
      return ins.rows[0] || null;
    }

    return null;
  },

  async incrementMasterLeadMetric(leadIdOrContact, channel, metricType) {
    // channel: 'whatsapp' | 'email'
    // metricType: 'sent' | 'delivered' | 'read' | 'clicked'
    const columnMap = {
      'whatsapp_sent': 'wa_sent_count',
      'whatsapp_delivered': 'wa_delivered_count',
      'whatsapp_read': 'wa_read_count',
      'whatsapp_clicked': 'wa_clicked_count',
      'email_sent': 'email_sent_count',
      'email_delivered': 'email_delivered_count',
      'email_read': 'email_read_count',
      'email_clicked': 'email_clicked_count'
    };

    const targetCol = columnMap[`${channel}_${metricType}`];
    if (!targetCol) return;

    const rawStr = String(leadIdOrContact || '').trim();
    const phoneDigits = rawStr.replace(/\D/g, '');
    const phone10 = phoneDigits.length === 12 && phoneDigits.startsWith('91') ? phoneDigits.substring(2) : phoneDigits.length === 10 ? phoneDigits : '';
    const phone12 = phoneDigits.length === 10 ? '91' + phoneDigits : phoneDigits.length === 12 ? phoneDigits : '';

    await pool.query(
      `UPDATE campaign_master_leads 
       SET ${targetCol} = COALESCE(${targetCol}, 0) + 1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
          OR finmantra_id = $1 
          OR campaign_data_id = $1
          OR contact = $1 
          OR ($2 != '' AND (contact = $2 OR contact = $3))
          OR (mail != '' AND LOWER(TRIM(mail)) = LOWER($1))`,
      [rawStr, phone10, phone12]
    );
  },

  async deleteMasterLead(leadId) {
    const res = await pool.query('DELETE FROM campaign_master_leads WHERE id = $1 RETURNING *', [leadId]);
    return res.rows[0];
  },

  async deleteMasterLeadsBulk(leadIds) {
    if (leadIds.length === 0) return 0;
    const res = await pool.query('DELETE FROM campaign_master_leads WHERE id = ANY($1)', [leadIds]);
    return res.rowCount;
  },

  // --- Communication Dashboard Analytics Operations ---
  async getCommunicationDashboardAnalytics({
    dateFrom = '',
    dateTo = '',
    broadcastName = '',
    metaWhatsappNo = '',
    senderEmail = ''
  } = {}) {
    let bcWhere = [];
    let bcParams = [];

    if (broadcastName && broadcastName.trim()) {
      bcParams.push(broadcastName.trim());
      bcWhere.push(`name = $${bcParams.length}`);
    }

    if (dateFrom) {
      bcParams.push(new Date(dateFrom).toISOString());
      bcWhere.push(`created_at >= $${bcParams.length}`);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      bcParams.push(toDate.toISOString());
      bcWhere.push(`created_at <= $${bcParams.length}`);
    }

    if (metaWhatsappNo && metaWhatsappNo.trim()) {
      bcParams.push(metaWhatsappNo.trim());
      bcWhere.push(`meta_phone_number = $${bcParams.length}`);
    }

    if (senderEmail && senderEmail.trim()) {
      bcParams.push(senderEmail.trim().toLowerCase());
      bcWhere.push(`LOWER(sender_email) = $${bcParams.length}`);
    }

    const bcWhereSql = bcWhere.length > 0 ? `WHERE ${bcWhere.join(' AND ')}` : '';

    // Aggregate Broadcast KPIs
    const kpiRes = await pool.query(
      `SELECT 
         COUNT(*)::int as total_broadcasts,
         COALESCE(SUM(targeted_count), 0)::int as total_targeted,
         COALESCE(SUM(sent_count), 0)::int as total_sent,
         COALESCE(SUM(delivered_count), 0)::int as total_delivered,
         COALESCE(SUM(read_count), 0)::int as total_read,
         COALESCE(SUM(clicked_count), 0)::int as total_clicked,
         COALESCE(SUM(failed_count), 0)::int as total_failed,
         COUNT(CASE WHEN channel = 'whatsapp' THEN 1 END)::int as wa_broadcasts,
         COUNT(CASE WHEN channel = 'email' THEN 1 END)::int as email_broadcasts,
         COUNT(CASE WHEN channel = 'both' THEN 1 END)::int as hybrid_broadcasts
       FROM campaign_broadcasts 
       ${bcWhereSql}`,
      bcParams
    );
    const kpis = kpiRes.rows[0] || {};

    // Filter master stats if any broadcast filter is applied
    let masterWhere = [];
    let masterParams = [];

    if (broadcastName && broadcastName.trim()) {
      masterParams.push(broadcastName.trim());
      const pIdx = masterParams.length;
      masterWhere.push(`(
        LOWER(last_broadcast_name) = LOWER($${pIdx}) 
        OR last_broadcast_id IN (SELECT id FROM campaign_broadcasts WHERE LOWER(name) = LOWER($${pIdx}))
      )`);
    }

    if (dateFrom) {
      masterParams.push(new Date(dateFrom).toISOString());
      const pIdx = masterParams.length;
      masterWhere.push(`(last_broadcast_date >= $${pIdx} OR created_at >= $${pIdx})`);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      masterParams.push(toDate.toISOString());
      const pIdx = masterParams.length;
      masterWhere.push(`(last_broadcast_date <= $${pIdx} OR created_at <= $${pIdx})`);
    }

    if (metaWhatsappNo && metaWhatsappNo.trim()) {
      masterParams.push(metaWhatsappNo.trim());
      const pIdx = masterParams.length;
      masterWhere.push(`(
        meta_whatsapp_no = $${pIdx} 
        OR last_broadcast_id IN (SELECT id FROM campaign_broadcasts WHERE meta_phone_number = $${pIdx} OR meta_phone_number_id = $${pIdx})
      )`);
    }

    if (senderEmail && senderEmail.trim()) {
      masterParams.push(senderEmail.trim().toLowerCase());
      const pIdx = masterParams.length;
      masterWhere.push(`(
        LOWER(sender_email) = $${pIdx} 
        OR last_broadcast_id IN (SELECT id FROM campaign_broadcasts WHERE LOWER(sender_email) = $${pIdx})
      )`);
    }

    const masterWhereSql = masterWhere.length > 0 ? `WHERE ${masterWhere.join(' AND ')}` : '';

    // Aggregate Master Leads Analytics
    const masterStatsRes = await pool.query(
      `SELECT 
         COUNT(*)::int as total_master_contacts,
         COUNT(CASE WHEN whatsapp_optin = true THEN 1 END)::int as wa_optin_count,
         COUNT(CASE WHEN whatsapp_optin = false THEN 1 END)::int as wa_optout_count,
         COUNT(CASE WHEN email_optin = true THEN 1 END)::int as email_optin_count,
         COUNT(CASE WHEN email_optin = false THEN 1 END)::int as email_optout_count,
         COALESCE(SUM(wa_sent_count), 0)::int as sum_wa_sent,
         COALESCE(SUM(wa_delivered_count), 0)::int as sum_wa_delivered,
         COALESCE(SUM(wa_read_count), 0)::int as sum_wa_read,
         COALESCE(SUM(wa_clicked_count), 0)::int as sum_wa_clicked,
         COALESCE(SUM(email_sent_count), 0)::int as sum_email_sent,
         COALESCE(SUM(email_delivered_count), 0)::int as sum_email_delivered,
         COALESCE(SUM(email_read_count), 0)::int as sum_email_read,
         COALESCE(SUM(email_clicked_count), 0)::int as sum_email_clicked
       FROM campaign_master_leads
       ${masterWhereSql}`,
      masterParams
    );
    const masterStats = masterStatsRes.rows[0] || {};

    // Fetch recent broadcasts with performance metrics
    const broadcastsListRes = await pool.query(
      `SELECT * FROM campaign_broadcasts 
       ${bcWhereSql} 
       ORDER BY created_at DESC 
       LIMIT 100`,
      bcParams
    );

    return {
      kpis,
      masterStats,
      recentBroadcasts: broadcastsListRes.rows
    };
  },

  async getCampaignTemplates() {
    const res = await pool.query('SELECT * FROM campaign_templates ORDER BY created_at DESC');
    return res.rows;
  },

  async createCampaignTemplate({ id, name, type, subject, body, metaTemplateName, mediaUrl, buttons, metaPhoneNumberId, wabaId }) {
    const res = await pool.query(
      `INSERT INTO campaign_templates (id, name, type, subject, body, meta_template_name, media_url, buttons, meta_phone_number_id, waba_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET 
         name = $2, type = $3, subject = $4, body = $5, meta_template_name = $6, media_url = $7, buttons = $8,
         meta_phone_number_id = $9, waba_id = $10
       RETURNING *`,
      [id, name, type, subject, body, metaTemplateName, mediaUrl, buttons || null, metaPhoneNumberId || null, wabaId || null]
    );
    return res.rows[0];
  },

  async deleteCampaignTemplate(id) {
    const res = await pool.query('DELETE FROM campaign_templates WHERE id = $1 RETURNING *', [id]);
    return res.rows[0];
  }
};

module.exports = db;

