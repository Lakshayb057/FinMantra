const { Pool } = require('pg');

const prodPool = new Pool({
  connectionString: 'postgresql://postgres:FinMantra123!@finmantra-db.cnm6keucqfmp.ap-south-1.rds.amazonaws.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const uatPool = new Pool({
  connectionString: 'postgresql://postgres:FinMantra123!@finmantra-db.cnm6keucqfmp.ap-south-1.rds.amazonaws.com:5432/finmantra_uat',
  ssl: { rejectUnauthorized: false }
});

function computeOriginalBankUrl(lead, cardsMap) {
  const urn = lead.urn || '';
  let urn_first = '';
  let urn_last = '';
  if (urn.length > 7) {
    urn_first = urn.slice(0, 7);
    urn_last = urn.slice(7);
  } else {
    urn_first = urn;
    urn_last = urn;
  }
  const agentId = lead.agent_id || 'public';
  const utmFormat = lead.utm_creative_format || 'default';

  // 1. If lead has card_id in cards catalog with redirect template
  if (lead.card_id && cardsMap.has(lead.card_id)) {
    const c = cardsMap.get(lead.card_id);
    if (c.redirect_url_template) {
      let tpl = c.redirect_url_template;
      tpl = tpl.replace(/\{urn\}/g, urn);
      tpl = tpl.replace(/\{urn_first\}/g, urn_first);
      tpl = tpl.replace(/\{urn_last\}/g, urn_last);
      tpl = tpl.replace(/\{agent_id\}/g, agentId);
      tpl = tpl.replace(/\{utm_creative_format\}/g, utmFormat);
      return tpl;
    }
  }

  // 2. If lead.redirect_url is already a valid bank URL
  if (lead.redirect_url && 
      !lead.redirect_url.includes('finmantra.org/refer') && 
      !lead.redirect_url.includes('uat.finmantra.org/refer') && 
      !lead.redirect_url.includes('localhost')) {
    return lead.redirect_url;
  }

  // 3. Resolve by bank / card_name / inspect parameters
  const bank = (lead.card_bank || '').toUpperCase();
  const cardName = (lead.card_name || '').toLowerCase();
  const inspect = [lead.landing_page, lead.utm_source, lead.utm_campaign, lead.utm_content].filter(Boolean).join(' ').toLowerCase();

  if (bank === 'SCAPIA' || inspect.includes('scapia') || cardName.includes('scapia')) {
    return `https://apply.scapia.cards/landing_page?utm_source=RKPL_offline&utm_medium=BOBCARD&utm_campaign=web&utm_content=HA_SPK1_${urn}_travel&utm_term=card`;
  }

  if (bank === 'KIWI' || inspect.includes('kiwi') || cardName.includes('kiwi') || inspect.includes('gokiwi')) {
    return `https://gokiwi.sng.link/D5owq/zu1ht?utm_source=mmm&utm_campaign=&utm_medium=apply&utm_term=EARNTRA&utm_content=ENT_${urn}_971692`;
  }

  if (bank === 'HDFC' || inspect.includes('hdfc') || cardName.includes('pixel')) {
    return `https://applyonline.hdfcbank.com/cards/credit-cards.html?CHANNELSOURCE=ZETA&DSACode=XRKD&LGcode=HSPK01&LCcode=${urn_first}&LC2=${urn_last}&SMcode=A28596#nbb`;
  }

  if (bank === 'SBI' || inspect.includes('sbi') || cardName.includes('sbi') || cardName.includes('simplyclick')) {
    if (cardName.includes('simplyclick')) {
      return `https://www.sbicard.com/sprint/c/SimplyClick?CHN=OMLG&GEMID1=SSAA1&GEMID2=LGSS01`;
    }
    return `https://www.sbicard.com/corecards/?CHN=OMLG&GEMID1=SSAA1&GEMID2=LGSS01`;
  }

  return `https://finmantra.org/refer/${agentId}/${urn}`;
}

async function updateDbBankUrls(pool, dbName) {
  console.log(`[${dbName}] Fetching cards and leads...`);
  const cards = (await pool.query('SELECT id, bank, name, redirect_url_template FROM cards')).rows;
  const cardsMap = new Map();
  cards.forEach(c => cardsMap.set(c.id, c));

  const leads = (await pool.query('SELECT id, urn, agent_id, card_id, card_name, card_bank, redirect_url, landing_page, utm_source, utm_campaign, utm_content, utm_creative_format FROM leads')).rows;
  let updatedCount = 0;

  for (const lead of leads) {
    const originalUrl = computeOriginalBankUrl(lead, cardsMap);
    if (originalUrl && originalUrl !== lead.redirect_url) {
      await pool.query('UPDATE leads SET redirect_url = $1 WHERE id = $2', [originalUrl, lead.id]);
      updatedCount++;
    }
  }

  console.log(`[${dbName}] ✅ Successfully updated ${updatedCount} leads with their original bank redirection URLs!`);
}

async function run() {
  await updateDbBankUrls(prodPool, 'PROD DB');
  await updateDbBankUrls(uatPool, 'UAT DB');
  await prodPool.end();
  await uatPool.end();
}

run();
