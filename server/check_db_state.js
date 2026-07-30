// Query the actual MIS data fields for SBI and KIWI leads
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    // 1. Get ALL keys from KIWI mapped leads' mis_data
    const kiwiKeys = await pool.query(`
      SELECT DISTINCT jsonb_object_keys(mis_data) as key_name
      FROM leads 
      WHERE mis_mapped_at IS NOT NULL 
        AND mis_data->>'mis_bank_name' = 'KIWI'
        AND (
          (mis_data->>'bank_reference_number' IS NOT NULL AND mis_data->>'bank_reference_number' != '')
          OR (mis_data->>'current_state' IS NOT NULL AND mis_data->>'current_state' != '' AND mis_data->>'current_state' != 'NOT_STARTED')
          OR (mis_data->>'ipa_status' IS NOT NULL AND mis_data->>'ipa_status' != '')
        )
      ORDER BY key_name
    `);
    console.log('=== KIWI MIS DATA KEYS:');
    kiwiKeys.rows.forEach(r => console.log(`  ${r.key_name}`));

    // 2. Sample a KIWI lead with full MIS data
    const kiwiSample = await pool.query(`
      SELECT mis_data FROM leads 
      WHERE mis_mapped_at IS NOT NULL 
        AND mis_data->>'mis_bank_name' = 'KIWI'
        AND mis_data->>'bank_reference_number' IS NOT NULL AND mis_data->>'bank_reference_number' != ''
      LIMIT 3
    `);
    console.log('\n=== KIWI SAMPLE MIS DATA (3 leads):');
    kiwiSample.rows.forEach((r, i) => {
      console.log(`\n--- KIWI Lead ${i+1}:`);
      const data = typeof r.mis_data === 'string' ? JSON.parse(r.mis_data) : r.mis_data;
      for (const [k, v] of Object.entries(data)) {
        if (v && v !== '' && v !== 'undefined' && v !== 'null') {
          console.log(`  ${k}: ${v}`);
        }
      }
    });

    // 3. Get ALL keys from SBI mapped leads' mis_data
    const sbiKeys = await pool.query(`
      SELECT DISTINCT jsonb_object_keys(mis_data) as key_name
      FROM leads 
      WHERE mis_mapped_at IS NOT NULL 
        AND mis_data->>'mis_bank_name' = 'SBI'
      ORDER BY key_name
    `);
    console.log('\n\n=== SBI MIS DATA KEYS:');
    sbiKeys.rows.forEach(r => console.log(`  ${r.key_name}`));

    // 4. Sample SBI lead with full MIS data
    const sbiSample = await pool.query(`
      SELECT mis_data FROM leads 
      WHERE mis_mapped_at IS NOT NULL AND mis_data->>'mis_bank_name' = 'SBI'
      LIMIT 3
    `);
    console.log('\n=== SBI SAMPLE MIS DATA (3 leads):');
    sbiSample.rows.forEach((r, i) => {
      console.log(`\n--- SBI Lead ${i+1}:`);
      const data = typeof r.mis_data === 'string' ? JSON.parse(r.mis_data) : r.mis_data;
      for (const [k, v] of Object.entries(data)) {
        if (v && v !== '' && v !== 'undefined' && v !== 'null') {
          console.log(`  ${k}: ${v}`);
        }
      }
    });

    // 5. Get ALL keys from HDFC mapped leads' mis_data  
    const hdfcKeys = await pool.query(`
      SELECT DISTINCT jsonb_object_keys(mis_data) as key_name
      FROM leads 
      WHERE mis_mapped_at IS NOT NULL 
        AND mis_data->>'mis_bank_name' ILIKE '%HDFC%'
      ORDER BY key_name
    `);
    console.log('\n\n=== HDFC MIS DATA KEYS:');
    hdfcKeys.rows.forEach(r => console.log(`  ${r.key_name}`));

    // 6. Sample HDFC lead 
    const hdfcSample = await pool.query(`
      SELECT mis_data FROM leads 
      WHERE mis_mapped_at IS NOT NULL AND mis_data->>'mis_bank_name' ILIKE '%HDFC%'
      LIMIT 1
    `);
    console.log('\n=== HDFC SAMPLE MIS DATA:');
    if (hdfcSample.rows.length > 0) {
      const data = typeof hdfcSample.rows[0].mis_data === 'string' ? JSON.parse(hdfcSample.rows[0].mis_data) : hdfcSample.rows[0].mis_data;
      for (const [k, v] of Object.entries(data)) {
        if (v && v !== '' && v !== 'undefined' && v !== 'null') {
          console.log(`  ${k}: ${v}`);
        }
      }
    }

    // 7. KIWI status distributions for funnel
    const kiwiStatuses = await pool.query(`
      SELECT 
        mis_data->>'current_state' as current_state,
        mis_data->>'winning_bank' as winning_bank,
        COUNT(*) as cnt
      FROM leads
      WHERE mis_mapped_at IS NOT NULL AND mis_data->>'mis_bank_name' = 'KIWI'
        AND (
          (mis_data->>'bank_reference_number' IS NOT NULL AND mis_data->>'bank_reference_number' != '')
          OR (mis_data->>'current_state' IS NOT NULL AND mis_data->>'current_state' != '' AND mis_data->>'current_state' != 'NOT_STARTED')
          OR (mis_data->>'ipa_status' IS NOT NULL AND mis_data->>'ipa_status' != '')
        )
      GROUP BY mis_data->>'current_state', mis_data->>'winning_bank'
      ORDER BY cnt DESC
    `);
    console.log('\n=== KIWI STATUS DISTRIBUTION (for funnel):');
    kiwiStatuses.rows.forEach(r => console.log(`  state=${r.current_state} | winning_bank=${r.winning_bank}: ${r.cnt}`));

    // 8. SBI status distributions for funnel
    const sbiStatuses = await pool.query(`
      SELECT 
        mis_data->>'CURRENT_STATUS' as current_status,
        mis_data->>'FINAL_STATUS' as final_status,
        mis_data->>'CARD_GEN_STATUS' as card_gen,
        mis_status,
        COUNT(*) as cnt
      FROM leads
      WHERE mis_mapped_at IS NOT NULL AND mis_data->>'mis_bank_name' = 'SBI'
      GROUP BY mis_data->>'CURRENT_STATUS', mis_data->>'FINAL_STATUS', mis_data->>'CARD_GEN_STATUS', mis_status
      ORDER BY cnt DESC
    `);
    console.log('\n=== SBI STATUS DISTRIBUTION (for funnel):');
    sbiStatuses.rows.forEach(r => console.log(`  current=${r.current_status} | final=${r.final_status} | card_gen=${r.card_gen} | mis_status=${r.mis_status}: ${r.cnt}`));

    // 9. Check card_manager_banks setting
    const bankSetting = await pool.query("SELECT value FROM settings WHERE key = 'card_manager_banks'");
    console.log('\n=== card_manager_banks setting:', bankSetting.rows[0]?.value || 'NOT SET');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

check();
