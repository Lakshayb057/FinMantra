const { pool } = require('./db');

async function run() {
  try {
    console.log('Querying all mapped leads in DB...');
    const res = await pool.query(`
      SELECT id, full_name, phone, email, card_bank, card_name, source, mis_status, mis_data 
      FROM leads 
      WHERE mis_status IS NOT NULL OR mis_mapped_at IS NOT NULL
    `);
    console.log('TOTAL MAPPED LEADS IN DB:', res.rows.length);

    let matchCount = 0;
    for (const r of res.rows) {
      const md = r.mis_data || {};
      const str = JSON.stringify(md);
      const isKiwi = (String(r.card_bank || md.mis_bank_name || r.card_name || r.source || md.kiwi_winning_bank || '').toUpperCase().includes('KIWI') || String(r.source || '').toLowerCase() === 'kiwi' || md.kiwi_winning_bank || md.winning_bank || String(md.partner || '').toLowerCase().includes('kiwi'));
      
      const kiwiCard = (String(md.Card_Created || md.card_activation_status || md.card_created || md.card_state || md.current_state || md.winning_state || md.mis_status || r.mis_status || '') + ' ' + String(md.pnb_state || '') + ' ' + String(md.yes_state || '') + ' ' + String(md.au_state || '')).toLowerCase();
      const isCardCreated = kiwiCard.includes('yes') || kiwiCard.includes('active') || kiwiCard.includes('created') || kiwiCard.includes('issued') || kiwiCard.includes('disbursed') || kiwiCard.includes('card_created') || kiwiCard === '1';

      if (isKiwi || isCardCreated || str.toUpperCase().includes('CARD')) {
        if (isCardCreated) {
          matchCount++;
          console.log('\n=== CARD CREATED LEAD MATCHED ===');
          console.log({
            id: r.id,
            name: r.full_name,
            phone: r.phone,
            status: r.mis_status,
            card_bank: r.card_bank,
            source: r.source,
            kiwiCard,
            mis_data: md
          });
        }
      }
    }
    console.log('\nTotal Card Created Matches:', matchCount);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

run();
