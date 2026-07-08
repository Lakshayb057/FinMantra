require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query('SELECT urn, full_name, created_at FROM leads ORDER BY created_at DESC');
  console.log('Total leads in DB:', res.rows.length);
  
  const matches = res.rows.filter(r => r.urn && (r.urn.includes('A') || r.urn.includes('G') || r.urn.match(/[A-Za-z]/)));
  console.log('URNs containing letters (first 50):');
  console.log(matches.slice(0, 50).map(r => ({ urn: r.urn, name: r.full_name })));
  
  await pool.end();
}

main().catch(console.error);
