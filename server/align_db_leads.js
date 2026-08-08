const { Pool } = require('pg');

const prodPool = new Pool({
  connectionString: 'postgresql://postgres:FinMantra123!@finmantra-db.cnm6keucqfmp.ap-south-1.rds.amazonaws.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const uatPool = new Pool({
  connectionString: 'postgresql://postgres:FinMantra123!@finmantra-db.cnm6keucqfmp.ap-south-1.rds.amazonaws.com:5432/finmantra_uat',
  ssl: { rejectUnauthorized: false }
});

async function alignPool(pool, dbName) {
  const cards = (await pool.query('SELECT id, bank FROM cards')).rows;
  const cardsMap = new Map();
  cards.forEach(c => cardsMap.set(c.id, c.bank));

  const leads = (await pool.query('SELECT id, urn, card_id, card_name, card_bank, redirect_url, landing_page, utm_source, utm_campaign FROM leads')).rows;
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

      if (inspectStr.includes('hdfc') || inspectStr.includes('pixel')) targetBank = 'HDFC';
      else if (inspectStr.includes('sbi') || inspectStr.includes('simplyclick')) targetBank = 'SBI';
      else if (inspectStr.includes('kiwi')) targetBank = 'KIWI';
      else if (inspectStr.includes('scapia')) targetBank = 'SCAPIA';
      else if (inspectStr.includes('icici')) targetBank = 'ICICI';
      else if (inspectStr.includes('axis')) targetBank = 'AXIS';
      else if (inspectStr.includes('pnb')) targetBank = 'PNB';
      else if (inspectStr.includes('yes')) targetBank = 'YES';
      else if (inspectStr.includes('au')) targetBank = 'AU';
    }

    if (targetBank && targetBank.toUpperCase() !== (lead.card_bank || '').toUpperCase()) {
      await pool.query('UPDATE leads SET card_bank = $1 WHERE id = $2', [targetBank.toUpperCase(), lead.id]);
      count++;
    }
  }
  console.log(`[${dbName}] ✅ Successfully aligned ${count} leads to their redirect card banks!`);
}

async function run() {
  await alignPool(prodPool, 'PROD DB');
  await alignPool(uatPool, 'UAT DB');
  await prodPool.end();
  await uatPool.end();
}

run();
