const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DB_FILE = path.join(__dirname, 'local_database.json');

// Database mode dispatching
let usePg = !!process.env.DATABASE_URL;
let pool = null;

if (usePg) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
  console.log('[Database] Configured to connect to AWS/RDS PostgreSQL Database.');
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
          category: 'Premium',
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
          category: 'Rewards',
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
          category: 'Travel',
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
          category: 'Cashback',
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
          category: 'Shopping',
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
          category: 'Digital',
          description: 'Customizable credit card. Choose your favorite merchants for 5% cashback.',
          redirect_url_template: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/pixel-play?name={name}&phone={phone}&email={email}&urn={urn}',
          display_order: 6,
          active: true,
          thumbnail_url: ''
        }
      ],
      agents: [
        {
          id: 'agent_1',
          name: 'Rajesh Kumar',
          phone: '9876543210',
          email: 'rajesh@finmantra.com',
          username: 'rajesh123',
          password_hash: 'f44d1ac9bf0c69b083380b86dbdf3b73797150e3cca4820ac399f7917e607647', // SHA256 of "agent123"
          status: 'active',
          locations: ['Mumbai Airport Kiosk', 'Delhi Kiosk'],
          created_at: new Date().toISOString()
        }
      ],
      locations: [
        { id: 'loc_1', name: 'Mumbai Airport Kiosk', active: true, created_at: new Date().toISOString() },
        { id: 'loc_2', name: 'Delhi Kiosk', active: true, created_at: new Date().toISOString() },
        { id: 'loc_3', name: 'Bangalore Office', active: true, created_at: new Date().toISOString() },
        { id: 'loc_4', name: 'Pune Kiosk', active: true, created_at: new Date().toISOString() }
      ],
      settings: {
        public_redirect_url: 'https://applyonline.hdfcbank.com/cards/credit-cards.html?CHANNELSOURCE=TDCC&DEDUPE=N&DSACode=XFIF&LGcode=public&LCcode=public&urn={urn}',
        otp_message_template: 'Your OTP for FinMantra credit card application is: {otp}. Valid for 5 minutes.',
        consent_text: 'I authorise FinMantra and its partner banks to contact me via call, SMS, WhatsApp and email about credit card offers, even if I am registered under DND/NDNC.',
        terms_link: 'https://finmantra.org/terms',
        privacy_link: 'https://finmantra.org/privacy'
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
    console.error('[Database] Failed to connect to AWS/RDS PostgreSQL Database. Falling back to local JSON database. Error:', err.message);
    usePg = false;
    return;
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

    
    // Seed locations if empty
    const locCount = await client.query('SELECT COUNT(*) FROM locations');
    if (parseInt(locCount.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO locations (id, name, active, created_at) VALUES 
        ('loc_1', 'Mumbai Airport Kiosk', true, NOW()),
        ('loc_2', 'Delhi Kiosk', true, NOW()),
        ('loc_3', 'Bangalore Office', true, NOW()),
        ('loc_4', 'Pune Kiosk', true, NOW())
      `);
    }

    // Seed cards if empty
    const cardCount = await client.query('SELECT COUNT(*) FROM cards');
    if (parseInt(cardCount.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO cards (id, name, bank, category, description, redirect_url_template, display_order, active, thumbnail_url) VALUES 
        ('card_1', 'HDFC Regalia Gold', 'HDFC', 'Premium', 'Complimentary Club Vistara & MMT Black memberships. 4 Reward Points per ₹150 spent.', 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/regalia-gold-credit-card?name={name}&phone={phone}&email={email}&urn={urn}', 1, true, ''),
        ('card_2', 'Diners Club Privilege', 'HDFC', 'Rewards', 'Complimentary annual memberships of Amazon Prime, Swiggy One. 2x on weekend dining.', 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/diners-club-privilege?name={name}&phone={phone}&email={email}&urn={urn}', 2, true, ''),
        ('card_3', 'Marriott Bonvoy HDFC', 'HDFC', 'Travel', '1 Free Night Award annually. Silver Elite Status. 8 Marriott Bonvoy Points per ₹150 spent.', 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/marriott-bonvoy?name={name}&phone={phone}&email={email}&urn={urn}', 3, true, ''),
        ('card_4', 'Swiggy HDFC', 'HDFC', 'Cashback', '10% cashback on Swiggy application. 5% cashback on online shopping. 1% on other spends.', 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/swiggy-hdfc-card?name={name}&phone={phone}&email={email}&urn={urn}', 4, true, ''),
        ('card_5', 'Tata Neu HDFC Infinity', 'HDFC', 'Shopping', '5% NeuCoins on Tata Neu and partner brands. 1.5% NeuCoins on non-Tata spend.', 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/tata-neu-infinity?name={name}&phone={phone}&email={email}&urn={urn}', 5, true, ''),
        ('card_6', 'HDFC Pixel Play', 'HDFC', 'Digital', 'Customizable credit card. Choose your favorite merchants for 5% cashback.', 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/pixel-play?name={name}&phone={phone}&email={email}&urn={urn}', 6, true, '')
      `);
    }

    // Seed agents if empty
    const agentCount = await client.query('SELECT COUNT(*) FROM agents');
    if (parseInt(agentCount.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO agents (id, name, phone, email, username, password_hash, status, locations, created_at) VALUES 
        ('agent_1', 'Rajesh Kumar', '9876543210', 'rajesh@finmantra.com', 'rajesh123', 'f44d1ac9bf0c69b083380b86dbdf3b73797150e3cca4820ac399f7917e607647', 'active', '["Mumbai Airport Kiosk", "Delhi Kiosk"]'::jsonb, NOW())
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
        ('privacy_link', 'https://finmantra.org/privacy')
      `);
    }

    await client.query('COMMIT');
    console.log('[Database] PostgreSQL tables checked, initialized and seeded.');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      // rollback failed if transaction not active
    }
    console.error('[Database] Failed to execute PostgreSQL migration schema. Falling back to local JSON database. Error:', err);
    usePg = false;
  } finally {
    try {
      client.release();
    } catch (relErr) {
      // release failed
    }
  }
}

if (usePg) {
  initPgSchema();
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
        `INSERT INTO leads (id, urn, full_name, phone, email, city, employment, income_range, card_id, card_name, card_bank, source, agent_id, agent_name, agent_location, consent, utm_source, utm_info, utm_params, redirect_url, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())`,
        [
          id, urn, lead.full_name, lead.phone, lead.email, lead.city, lead.employment, lead.income_range,
          lead.card_id, lead.card_name, lead.card_bank, lead.source || 'public', lead.agent_id, lead.agent_name,
          lead.agent_location, lead.consent !== undefined ? lead.consent : true, lead.utm_source, lead.utm_info,
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
      return res.rows;
    }
    const data = readData();
    if (includeInactive) return data.cards;
    return data.cards.filter(c => c.active);
  },

  async addCard(card) {
    if (usePg) {
      const id = 'card_' + Math.random().toString(36).substr(2, 9);
      const displayOrder = card.display_order || 1;
      const active = card.active !== undefined ? card.active : true;
      await pool.query(
        'INSERT INTO cards (id, name, bank, category, description, redirect_url_template, display_order, active, thumbnail_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [id, card.name, card.bank, card.category, card.description, card.redirect_url_template, displayOrder, active, card.thumbnail_url || '']
      );
      return { id, ...card, display_order: displayOrder, active };
    }

    const data = readData();
    const newCard = {
      id: 'card_' + Math.random().toString(36).substr(2, 9),
      ...card,
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
        if (['name', 'bank', 'category', 'description', 'redirect_url_template', 'display_order', 'active', 'thumbnail_url'].includes(key)) {
          fields.push(`${key} = $${idx++}`);
          values.push(val);
        }
      }
      values.push(id);
      const res = await pool.query(`UPDATE cards SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
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
      return settings;
    }
    const data = readData();
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
