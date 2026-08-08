const { Pool } = require('pg');

const prodPool = new Pool({
  connectionString: 'postgresql://postgres:FinMantra123!@finmantra-db.cnm6keucqfmp.ap-south-1.rds.amazonaws.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const uatPool = new Pool({
  connectionString: 'postgresql://postgres:FinMantra123!@finmantra-db.cnm6keucqfmp.ap-south-1.rds.amazonaws.com:5432/finmantra_uat',
  ssl: { rejectUnauthorized: false }
});

async function fixGroundTruth(pool, dbName) {
  const cards = (await pool.query('SELECT id, bank, name FROM cards')).rows;
  const cardsMap = new Map();
  cards.forEach(c => cardsMap.set(c.id, c));

  const leads = (await pool.query(`
    SELECT id, urn, card_id, card_name, card_bank, redirect_url, landing_page, utm_source, utm_campaign, utm_content, mis_data 
    FROM leads
  `)).rows;

  let fixedCount = 0;

  for (const lead of leads) {
    let targetBank = null;
    let targetCardName = null;

    const redirectUrl = String(lead.redirect_url || '').toLowerCase();

    // 1. Direct REDIRECT URL matching takes top priority!
    if (redirectUrl.includes('gokiwi') || redirectUrl.includes('kiwi')) {
      targetBank = 'KIWI';
      targetCardName = 'Yes_Kiwi';
    } else if (redirectUrl.includes('scapia')) {
      targetBank = 'SCAPIA';
      targetCardName = 'Scapia Digital';
    } else if (redirectUrl.includes('applyonline.hdfcbank') || redirectUrl.includes('hdfcbank') || redirectUrl.includes('hdfc')) {
      targetBank = 'HDFC';
      targetCardName = redirectUrl.includes('pixel') ? 'Pixel' : (redirectUrl.includes('tdcc') ? 'TATA' : 'HDFC Card');
    } else if (redirectUrl.includes('sbicard') || redirectUrl.includes('simplyclick') || redirectUrl.includes('sbi')) {
      targetBank = 'SBI';
      targetCardName = redirectUrl.includes('simplyclick') ? 'SBI SimplyClick' : 'SBI Online';
    } else if (redirectUrl.includes('icici')) {
      targetBank = 'ICICI';
      targetCardName = 'ICICI Card';
    } else if (redirectUrl.includes('axis')) {
      targetBank = 'AXIS';
      targetCardName = 'Axis Card';
    }

    // 2. Card Selection / Card ID from cards catalog
    if (!targetBank && lead.card_id && cardsMap.has(lead.card_id)) {
      const c = cardsMap.get(lead.card_id);
      targetBank = c.bank;
      targetCardName = c.name;
    }

    // 3. Fallback parameter inspect
    if (!targetBank) {
      const utmInspect = [lead.landing_page, lead.utm_source, lead.utm_campaign, lead.utm_content].filter(Boolean).join(' ').toLowerCase();
      if (utmInspect.includes('gokiwi') || utmInspect.includes('kiwi')) targetBank = 'KIWI';
      else if (utmInspect.includes('scapia')) targetBank = 'SCAPIA';
      else if (utmInspect.includes('applyonline.hdfcbank') || utmInspect.includes('pixel') || utmInspect.includes('hdfc')) targetBank = 'HDFC';
      else if (utmInspect.includes('sbicard') || utmInspect.includes('simplyclick') || utmInspect.includes('sbi')) targetBank = 'SBI';
    }

    if (targetBank) {
      const newBank = targetBank.toUpperCase();
      const newCardName = targetCardName || lead.card_name || 'Credit Card';

      let md = typeof lead.mis_data === 'string' ? JSON.parse(lead.mis_data) : (lead.mis_data || {});
      const needsBankUpdate = (lead.card_bank || '').toUpperCase() !== newBank;
      const needsNameUpdate = (lead.card_name || '') === 'Public Redirection' || lead.card_name !== newCardName;
      const needsMisBankUpdate = md.mis_bank_name !== newBank;

      if (needsBankUpdate || needsNameUpdate || needsMisBankUpdate) {
        md.mis_bank_name = newBank;
        await pool.query(
          'UPDATE leads SET card_bank = $1, card_name = $2, mis_data = $3 WHERE id = $4',
          [newBank, newCardName, JSON.stringify(md), lead.id]
        );
        fixedCount++;
      }
    }
  }

  console.log(`[${dbName}] ✅ Re-aligned ${fixedCount} leads using Redirect URL priority!`);
}

async function run() {
  await fixGroundTruth(prodPool, 'PROD DB');
  await fixGroundTruth(uatPool, 'UAT DB');
  await prodPool.end();
  await uatPool.end();
}

run();
