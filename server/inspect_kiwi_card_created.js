// Run from server/ directory: node inspect_kiwi_card_created.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function inspect() {
  try {
    const res = await pool.query(`
      SELECT id, urn, full_name, card_bank, card_name, mis_status, mis_data,
             landing_page, utm_source
      FROM leads
      WHERE (card_bank ILIKE '%KIWI%' 
             OR mis_data->>'mis_bank_name' ILIKE '%KIWI%' 
             OR (mis_data->>'kiwi_winning_bank' IS NOT NULL AND mis_data->>'kiwi_winning_bank' != '')
             OR card_name ILIKE '%KIWI%' 
             OR landing_page ILIKE '%KIWI%' OR landing_page ILIKE '%GOKIWI%' 
             OR utm_source ILIKE '%KIWI%' OR utm_source ILIKE '%GOKIWI%')
      AND (mis_mapped_at IS NOT NULL OR (mis_status IS NOT NULL AND mis_status != ''))
    `);

    console.log('Total KIWI mapped leads:', res.rows.length);
    
    let found = [];
    for (const l of res.rows) {
      let md = l.mis_data;
      if (typeof md === 'string') try { md = JSON.parse(md); } catch(e) {}
      md = md || {};

      const kiwiCard = (
        String(md.Card_Created || md.card_activation_status || md.card_created || md.card_state || md.current_state || md.winning_state || md.mis_status || l.mis_status || '') + ' ' +
        String(md.pnb_state || '') + ' ' +
        String(md.yes_state || '') + ' ' +
        String(md.au_state || '')
      ).toLowerCase();

      const origMatch = kiwiCard.includes('yes') || kiwiCard.includes('approve') || kiwiCard.includes('active') || kiwiCard.includes('created') || kiwiCard.includes('issued') || kiwiCard.includes('disbursed') || kiwiCard.includes('card_created') || kiwiCard === '1';

      if (origMatch) {
        found.push({
          id: l.id,
          urn: l.urn,
          name: l.full_name,
          card_bank: l.card_bank,
          mis_status: l.mis_status,
          kiwiCardStr: kiwiCard.substring(0, 200),
          Card_Created: md.Card_Created || null,
          card_created_lc: md.card_created || null,
          card_activation_status: md.card_activation_status || null,
          card_state: md.card_state || null,
          current_state: md.current_state || null,
          winning_state: md.winning_state || null,
          winning_bank: md.winning_bank || null,
          yes_state: md.yes_state || null,
          au_state: md.au_state || null,
          pnb_state: md.pnb_state || null,
          first_txn: md.first_txn || null,
        });
      }
    }

    console.log('Leads matching original Card Created logic:', found.length);
    for (const l of found) {
      console.log(JSON.stringify(l));
    }
  } catch(err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

inspect();
