const { Pool } = require('pg');

const prodPool = new Pool({
  connectionString: 'postgresql://postgres:FinMantra123!@finmantra-db.cnm6keucqfmp.ap-south-1.rds.amazonaws.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const uatPool = new Pool({
  connectionString: 'postgresql://postgres:FinMantra123!@finmantra-db.cnm6keucqfmp.ap-south-1.rds.amazonaws.com:5432/finmantra_uat',
  ssl: { rejectUnauthorized: false }
});

async function fixMisBankNames(pool, dbName) {
  const cards = (await pool.query('SELECT id, bank FROM cards')).rows;
  const cardsMap = new Map();
  cards.forEach(c => cardsMap.set(c.id, c.bank));

  const leads = (await pool.query("SELECT id, urn, card_id, card_name, card_bank, redirect_url, landing_page, utm_source, utm_campaign, mis_data FROM leads WHERE mis_data IS NOT NULL")).rows;
  let count = 0;

  for (const lead of leads) {
    let targetBank = null;
    if (lead.card_id && cardsMap.has(lead.card_id)) {
      targetBank = cardsMap.get(lead.card_id);
    }

    if (!targetBank) {
      const inspectStr = [
        lead.redirect_url,
        lead.card_id,
        lead.card_name,
        lead.landing_page,
        lead.utm_source,
        lead.utm_campaign
      ].filter(Boolean).join(' ').toLowerCase();

      if (inspectStr.includes('hdfc') || inspectStr.includes('pixel') || inspectStr.includes('applyonline.hdfcbank')) targetBank = 'HDFC';
      else if (inspectStr.includes('sbi') || inspectStr.includes('simplyclick') || inspectStr.includes('sbicard')) targetBank = 'SBI';
      else if (inspectStr.includes('kiwi') || inspectStr.includes('gokiwi')) targetBank = 'KIWI';
      else if (inspectStr.includes('scapia')) targetBank = 'SCAPIA';
      else if (inspectStr.includes('icici')) targetBank = 'ICICI';
      else if (inspectStr.includes('axis')) targetBank = 'AXIS';
      else if (inspectStr.includes('pnb')) targetBank = 'PNB';
      else if (inspectStr.includes('yes')) targetBank = 'YES';
      else if (inspectStr.includes('au')) targetBank = 'AU';
    }

    if (targetBank) {
      let md = typeof lead.mis_data === 'string' ? JSON.parse(lead.mis_data) : (lead.mis_data || {});
      if (md.mis_bank_name !== targetBank.toUpperCase()) {
        md.mis_bank_name = targetBank.toUpperCase();
        await pool.query('UPDATE leads SET card_bank = $1, mis_data = $2 WHERE id = $3', [targetBank.toUpperCase(), JSON.stringify(md), lead.id]);
        count++;
      }
    }
  }
  console.log(`[${dbName}] ✅ Fixed mis_bank_name for ${count} leads!`);
}

async function run() {
  await fixMisBankNames(prodPool, 'PROD DB');
  await fixMisBankNames(uatPool, 'UAT DB');
  await prodPool.end();
  await uatPool.end();
}

run();
