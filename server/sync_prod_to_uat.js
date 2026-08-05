const { Pool } = require('pg');

const prodPool = new Pool({
  connectionString: 'postgresql://postgres:FinMantra123!@finmantra-db.cnm6keucqfmp.ap-south-1.rds.amazonaws.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const uatPool = new Pool({
  connectionString: 'postgresql://postgres:FinMantra123!@finmantra-db.cnm6keucqfmp.ap-south-1.rds.amazonaws.com:5432/finmantra_uat',
  ssl: { rejectUnauthorized: false }
});

async function syncSeedData() {
  console.log('[Sync] Starting seed data copy from Production (postgres) to UAT (finmantra_uat)...');

  // 1. Sync Cards Catalog
  try {
    const cards = await prodPool.query('SELECT * FROM cards');
    console.log(`[Sync] Found ${cards.rows.length} cards in Production database.`);
    for (const card of cards.rows) {
      await uatPool.query(
        `INSERT INTO cards (id, name, bank, redirect_url, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           bank = EXCLUDED.bank,
           redirect_url = EXCLUDED.redirect_url,
           is_active = EXCLUDED.is_active,
           updated_at = EXCLUDED.updated_at`,
        [card.id, card.name, card.bank, card.redirect_url, card.is_active, card.created_at, card.updated_at]
      );
    }
    console.log('[Sync] ✅ Cards catalog synced successfully!');
  } catch (err) {
    console.error('[Sync Cards Error]:', err.message);
  }

  // 2. Sync Locations
  try {
    const locs = await prodPool.query('SELECT * FROM locations');
    console.log(`[Sync] Found ${locs.rows.length} locations in Production database.`);
    for (const loc of locs.rows) {
      await uatPool.query(
        `INSERT INTO locations (id, name, is_active, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = EXCLUDED.is_active`,
        [loc.id, loc.name, loc.is_active, loc.created_at]
      );
    }
    console.log('[Sync] ✅ Locations synced successfully!');
  } catch (err) {
    console.error('[Sync Locations Error]:', err.message);
  }

  // 3. Sync Agents
  try {
    const agents = await prodPool.query('SELECT * FROM agents');
    console.log(`[Sync] Found ${agents.rows.length} agents in Production database.`);
    for (const ag of agents.rows) {
      await uatPool.query(
        `INSERT INTO agents (id, name, passcode, location, phone_number, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           passcode = EXCLUDED.passcode,
           location = EXCLUDED.location,
           phone_number = EXCLUDED.phone_number,
           is_active = EXCLUDED.is_active`,
        [ag.id, ag.name, ag.passcode, ag.location, ag.phone_number, ag.is_active, ag.created_at]
      );
    }
    console.log('[Sync] ✅ Agents synced successfully!');
  } catch (err) {
    console.error('[Sync Agents Error]:', err.message);
  }

  // 4. Sync Settings
  try {
    const settings = await prodPool.query('SELECT * FROM settings');
    console.log(`[Sync] Found ${settings.rows.length} settings in Production database.`);
    for (const s of settings.rows) {
      await uatPool.query(
        `INSERT INTO settings (key, value)
         VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [s.key, s.value]
      );
    }
    console.log('[Sync] ✅ Settings synced successfully!');
  } catch (err) {
    console.error('[Sync Settings Error]:', err.message);
  }

  await prodPool.end();
  await uatPool.end();
  console.log('====================================================');
  console.log('[Sync] 🎉 COMPLETE: All Cards, Locations, Agents, and Settings copied to UAT!');
  console.log('====================================================');
}

syncSeedData();
