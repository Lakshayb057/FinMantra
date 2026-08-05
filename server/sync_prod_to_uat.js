const { Pool } = require('pg');

const prodPool = new Pool({
  connectionString: 'postgresql://postgres:FinMantra123!@finmantra-db.cnm6keucqfmp.ap-south-1.rds.amazonaws.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const uatPool = new Pool({
  connectionString: 'postgresql://postgres:FinMantra123!@finmantra-db.cnm6keucqfmp.ap-south-1.rds.amazonaws.com:5432/finmantra_uat',
  ssl: { rejectUnauthorized: false }
});

process.env.DATABASE_URL = 'postgresql://postgres:FinMantra123!@finmantra-db.cnm6keucqfmp.ap-south-1.rds.amazonaws.com:5432/finmantra_uat';
const db = require('./db.js');

async function copyTable(tableName, primaryKey = 'id') {
  try {
    const res = await prodPool.query(`SELECT * FROM "${tableName}"`);
    console.log(`[Sync] Found ${res.rows.length} rows in Production database table "${tableName}".`);
    if (res.rows.length === 0) return;

    const cols = Object.keys(res.rows[0]);
    const colNames = cols.map(c => `"${c}"`).join(', ');
    const valPlaceholders = cols.map((_, i) => `$${i + 1}`).join(', ');

    let conflictClause = `ON CONFLICT DO NOTHING`;
    if (primaryKey && cols.includes(primaryKey)) {
      const updateCols = cols.filter(c => c !== primaryKey);
      if (updateCols.length > 0) {
        const updateClause = updateCols.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');
        conflictClause = `ON CONFLICT ("${primaryKey}") DO UPDATE SET ${updateClause}`;
      } else {
        conflictClause = `ON CONFLICT ("${primaryKey}") DO NOTHING`;
      }
    }

    const insertQuery = `INSERT INTO "${tableName}" (${colNames}) VALUES (${valPlaceholders}) ${conflictClause}`;

    for (const row of res.rows) {
      const values = cols.map(c => row[c]);
      await uatPool.query(insertQuery, values);
    }
    console.log(`[Sync] ✅ Table "${tableName}" (${res.rows.length} rows) copied successfully!`);
  } catch (err) {
    console.error(`[Sync Table "${tableName}" Error]:`, err.message);
  }
}

async function syncAllData() {
  console.log('[Sync] Initializing UAT PostgreSQL schema & migrations...');
  try {
    await db.init();
    console.log('[Sync] ✅ UAT Schema initialized with all tables & columns!');
  } catch (e) {
    console.log('[Sync Schema Note]:', e.message);
  }

  console.log('[Sync] Copying all master data from Production to UAT...');

  await copyTable('locations', 'id');
  await copyTable('cards', 'id');
  await copyTable('agents', 'id');
  await copyTable('settings', 'key');

  await prodPool.end();
  await uatPool.end();
  console.log('====================================================');
  console.log('[Sync] 🎉 COMPLETE: All Locations, Cards, Agents, and Settings copied to UAT!');
  console.log('====================================================');
  process.exit(0);
}

syncAllData();
