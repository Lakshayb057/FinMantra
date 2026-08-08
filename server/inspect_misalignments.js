const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:FinMantra123!@finmantra-db.cnm6keucqfmp.ap-south-1.rds.amazonaws.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function inspect() {
  const res = await pool.query(`
    SELECT id, urn, card_id, card_name, card_bank, redirect_url, mis_data->>'mis_bank_name' as mis_bank
    FROM leads
    WHERE (redirect_url ILIKE '%gokiwi%' OR redirect_url ILIKE '%kiwi%' OR card_name ILIKE '%kiwi%')
    LIMIT 25
  `);
  console.log('KIWI LEADS IN DB:');
  console.log(res.rows);

  const misaligned = await pool.query(`
    SELECT id, urn, card_name, card_bank, redirect_url, mis_data->>'mis_bank_name' as mis_bank
    FROM leads
    WHERE (redirect_url ILIKE '%gokiwi%' AND card_bank != 'KIWI')
       OR (redirect_url ILIKE '%hdfc%' AND card_bank != 'HDFC')
       OR (redirect_url ILIKE '%sbicard%' AND card_bank != 'SBI')
       OR (redirect_url ILIKE '%scapia%' AND card_bank != 'SCAPIA')
    LIMIT 25
  `);
  console.log('\nMISALIGNED LEADS IN DB:');
  console.log(misaligned.rows);

  await pool.end();
}

inspect();
