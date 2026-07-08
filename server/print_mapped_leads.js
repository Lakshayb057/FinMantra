require('dotenv').config();
const db = require('./db.js');

async function main() {
  const res = await db.pool.query('SELECT urn, full_name, mis_status, mis_mapped_at, mis_data FROM leads WHERE mis_status IS NOT NULL');
  console.log(`Total mapped leads in DB: ${res.rows.length}`);
  res.rows.forEach(r => {
    console.log(`URN: ${r.urn} | Name: ${r.full_name} | MIS Status: ${r.mis_status} | Mapped At: ${r.mis_mapped_at}`);
  });
  await db.pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
