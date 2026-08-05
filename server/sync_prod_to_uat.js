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

// Auto-sync missing table columns from Prod to UAT database
async function syncTableStructure(tableName) {
  try {
    const colRes = await prodPool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = $1
    `, [tableName]);

    for (const col of colRes.rows) {
      const colName = col.column_name;
      let colType = col.data_type.toUpperCase();
      if (colType.includes('CHARACTER VARYING') || colType === 'VARCHAR') {
        colType = 'TEXT';
      } else if (colType === 'USER-DEFINED') {
        colType = col.udt_name.toUpperCase();
      }
      try {
        await uatPool.query(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${colName}" ${colType}`);
      } catch (e) {
        // ignore column alter warnings
      }
    }
  } catch (err) {
    console.error(`[Sync Column Structure Error for ${tableName}]:`, err.message);
  }
}

async function copyTable(tableName, primaryKey = 'id') {
  try {
    // 1. Ensure UAT table structure matches Production exactly
    await syncTableStructure(tableName);

    // 2. Fetch all rows from Production
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
    console.log('[Sync] ✅ UAT Schema initialized!');
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
