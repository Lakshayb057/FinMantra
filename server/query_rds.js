const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:FinMantra123!@finmantra-db.cnm6keucqfmp.ap-south-1.rds.amazonaws.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('--- Querying RDS for KIWI Leads ---');
  
  // 1. Group by mis_status for KIWI
  const res1 = await pool.query(`
    SELECT mis_status, COUNT(*) as cnt 
    FROM leads 
    WHERE mis_status IS NOT NULL 
      AND (
        UPPER(card_bank) LIKE '%KIWI%' OR 
        UPPER(mis_data->>'mis_bank_name') LIKE '%KIWI%' OR 
        UPPER(card_name) LIKE '%KIWI%'
      ) 
    GROUP BY mis_status
  `);
  console.log('KIWI mis_status breakdown:', JSON.stringify(res1.rows, null, 2));

  // 2. Card Created or Approved leads
  const res2 = await pool.query(`
    SELECT id, urn, full_name, phone, email, card_bank, card_name, mis_status, mis_data 
    FROM leads 
    WHERE mis_status IS NOT NULL 
      AND (
        UPPER(card_bank) LIKE '%KIWI%' OR 
        UPPER(mis_data->>'mis_bank_name') LIKE '%KIWI%' OR 
        UPPER(card_name) LIKE '%KIWI%'
      )
      AND (
        UPPER(mis_status) LIKE '%CARD%' OR 
        UPPER(mis_status) LIKE '%CREATE%' OR 
        UPPER(mis_status) LIKE '%APPROV%'
      )
  `);
  console.log(`Total Card Created / Approved KIWI leads: ${res2.rows.length}`);
  res2.rows.forEach(r => {
    console.log('Lead row:', {
      id: r.id,
      name: r.full_name,
      card_bank: r.card_bank,
      card_name: r.card_name,
      mis_status: r.mis_status,
      mis_bank_name: r.mis_data?.mis_bank_name
    });
  });

  await pool.end();
}

main().catch(console.error);
