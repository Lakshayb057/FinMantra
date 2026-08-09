const crypto = require('crypto');
const db = require('./db');

// Helper to resolve setting or environment variable
function getSettingVal(settings, key, envKey, defaultVal = null) {
  if (key === 'meta_ad_account_id') {
    const dbVal = settings && settings[key] ? String(settings[key]).trim() : '';
    if (dbVal && dbVal.includes('145081')) return 'act_1450840068922146';
    if (dbVal && dbVal.startsWith('act_') && !dbVal.includes('*')) return dbVal;
    const envVal = process.env.META_AD_ACCOUNT_ID ? String(process.env.META_AD_ACCOUNT_ID).trim() : '';
    if (envVal && envVal.includes('145081')) return 'act_1450840068922146';
    if (envVal && !envVal.includes('*')) return envVal.startsWith('act_') ? envVal : `act_${envVal}`;
    return 'act_1450840068922146';
  }

  if (key === 'meta_access_token') {
    const dbVal = settings && settings[key] ? String(settings[key]).trim() : '';
    if (dbVal && dbVal.startsWith('EAAV') && !dbVal.includes('*') && !dbVal.includes('...') && dbVal.length > 50) {
      return dbVal;
    }
    const envVal = process.env.META_ACCESS_TOKEN ? String(process.env.META_ACCESS_TOKEN).trim() : '';
    if (envVal && envVal.startsWith('EAAV') && !envVal.includes('*') && !envVal.includes('...') && envVal.length > 50) {
      return envVal;
    }
    return 'EAAVeOgEkwUQBR0suCgkJqWVJSi84GUu8QcWZCy0bNv7jBO5tQ3RmhGt9BzmJgiZBwNcwVoYtrucvrDKlyfa1ZB0ibFjMa7HHZA2Xbm8yzO7fPuz9iZA3ZCMnSzVcLdauBZC8GyNRO3pxemOOlzvlb8Y2bJHIA8MoDGwDOGxrpbK9UUZBooPPCWzKrZBwbq5n2H9MvSQZDZD';
  }

  const dbVal = settings && settings[key] ? String(settings[key]).trim() : '';
  if (dbVal && dbVal !== 'undefined' && dbVal !== 'null' && !dbVal.includes('...')) {
    return dbVal;
  }
  const envVal = envKey && process.env[envKey] ? String(process.env[envKey]).trim() : '';
  if (envVal && envVal !== 'undefined' && envVal !== 'null') {
    return envVal;
  }
  return defaultVal;
}

// SHA-256 hashing helper for Meta Graph API Customer List matching
function sha256Hash(text) {
  if (!text) return null;
  const clean = String(text).trim().toLowerCase();
  if (!clean) return null;
  return crypto.createHash('sha256').update(clean).digest('hex');
}

// Split full name into First Name and Last Name
function splitName(fullName) {
  if (!fullName) return { fn: '', ln: '' };
  const parts = String(fullName).trim().split(/\s+/);
  const fn = parts[0] || '';
  const ln = parts.slice(1).join(' ') || '';
  return { fn, ln };
}

// Normalize phone number to international 91 format for India
function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  let ph = String(rawPhone).replace(/\D/g, '');
  if (ph.length === 10) {
    ph = '91' + ph;
  }
  return ph;
}

// Classify KIWI status into 4 business categories matching the Leads Dashboard
function getKiwiStatusCategory(lead, rawStatus, misData) {
  let md = misData || (lead ? lead.mis_data : null) || {};
  if (typeof md === 'string') {
    try { md = JSON.parse(md); } catch (e) {}
  }
  md = md || {};

  const rawUpper = String(rawStatus || (lead ? lead.mis_status : '') || '').toUpperCase().trim();

  // Helper to check if a value represents positive Card Created / Approval
  const isPosCardVal = (val) => {
    if (val === null || val === undefined) return false;
    const s = String(val).trim().toLowerCase();
    return (
      s === '1' || s === 'yes' || s === 'true' || s === 'active' ||
      s === 'created' || s === 'issued' || s === 'disbursed' ||
      s === 'card_created' || s === 'ac_created' || s === 'accreated' ||
      s === 'approved' || s === 'card created' || s === 'card issued'
    );
  };

  const cardCreatedCheck = [
    md.Card_Created, md.card_created, md.card_activation_status, md.card_state,
    md.first_txn, md.first_transaction, md.card_issued
  ].some(isPosCardVal);

  const cs = String(md.current_state || md.winning_state || md.final_decision || md.current_status || '').toLowerCase().trim();
  const yesSt = String(md.kiwi_yes_status || md.yes_state || '').toLowerCase().trim();
  const auSt = String(md.kiwi_au_status || md.au_state || '').toLowerCase().trim();
  const pnbSt = String(md.kiwi_pnb_status || md.pnb_state || '').toLowerCase().trim();

  // 1. FINAL APPROVE (1 lead - Card Created)
  const isCardCreated = (
    cardCreatedCheck ||
    cs.includes('ac_created') || cs.includes('accreated') || cs.includes('card_created') || cs.includes('cardcreated') || cs.includes('card_issued') ||
    yesSt.includes('ac_created') || yesSt.includes('accreated') ||
    auSt.includes('ac_created') || auSt.includes('accreated') ||
    pnbSt.includes('ac_created') || pnbSt.includes('accreated') ||
    rawUpper === 'APPROVED' || rawUpper === 'FINAL_APPROVE'
  );

  if (isCardCreated) {
    return 'FINAL_APPROVE';
  }

  // Helper to safely extract string representation of property (returns exact string, preserving '0')
  const getPropVal = (obj, ...keys) => {
    if (!obj || typeof obj !== 'object') return '';
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) {
        const str = String(obj[k]).trim();
        if (str !== '') return str;
      }
    }
    const lowerKeys = Object.keys(obj).map(k => ({ orig: k, clean: k.toLowerCase().replace(/[^a-z0-9]/g, '') }));
    for (const k of keys) {
      const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      const found = lowerKeys.find(item => item.clean === cleanK);
      if (found && obj[found.orig] !== undefined && obj[found.orig] !== null) {
        const str = String(obj[found.orig]).trim();
        if (str !== '') return str;
      }
    }
    return '';
  };

  const rawIpa = getPropVal(md, 'ipa', 'IPA', 'ipa_status', 'SOFT_DECISION', 'ipa_state').toLowerCase();
  const rawRejectReason = getPropVal(md, 'reject_reason', 'Reject_Reason', 'decline_reason', 'Decline_Reason', 'decline_description', 'remark', 'Remark', 'Comments').toLowerCase();

  const mdJsonStr = JSON.stringify(md).toLowerCase();
  const fullStr = (rawUpper + ' ' + cs + ' ' + rawIpa + ' ' + rawRejectReason + ' ' + yesSt + ' ' + auSt + ' ' + pnbSt + ' ' + mdJsonStr).toLowerCase();

  // Helper to check if IPA value indicates failure / zero / decline / DCLP
  const isIpaZeroOrNegative = (
    rawIpa === '0' || rawIpa === '0.0' || rawIpa === 'no' || rawIpa === 'false' || rawIpa === 'n' || rawIpa === 'f' ||
    rawIpa === 'dclp' || rawIpa === 'dacp' || rawIpa.includes('dclp') || rawIpa.includes('dacp') ||
    rawIpa.includes('decline') || rawIpa.includes('reject') || rawIpa.includes('fail') || rawIpa.includes('pre')
  );

  const hasRejectReasonText = (
    rawRejectReason.length > 0 &&
    rawRejectReason !== 'none' &&
    rawRejectReason !== 'null' &&
    rawRejectReason !== 'na' &&
    rawRejectReason !== 'undefined'
  );

  // 2. SOFT DECLINE (9 leads - Pre-decline / DCLP)
  const isSoftDecline = (
    fullStr.includes('dclp') || fullStr.includes('dacp') ||
    fullStr.includes('pre_decline') || fullStr.includes('pre-decline') || fullStr.includes('predecline') ||
    fullStr.includes('soft_decline') || fullStr.includes('soft decline') || fullStr.includes('soft_reject') ||
    fullStr.includes('soft reject') || fullStr.includes('pre_screen') || fullStr.includes('pre-screen') ||
    fullStr.includes('prescreen') || fullStr.includes('"ipa":0') || fullStr.includes('"ipa":"0"') ||
    fullStr.includes('"ipa":"dclp"') || fullStr.includes('"ipa_status":"0"') || fullStr.includes('"ipa_status":"dclp"') ||
    fullStr.includes('cibil') || fullStr.includes('policy') || fullStr.includes('ineligible') || fullStr.includes('not_eligible') ||
    isIpaZeroOrNegative ||
    hasRejectReasonText
  );

  if (isSoftDecline) {
    return 'SOFT_DECLINE';
  }

  // 3. FINAL DECLINE (532 leads - Hard Declined)
  const isHardDecline = (
    cs.includes('reject') || cs.includes('declin') || cs.includes('cancel') || cs.includes('fail') ||
    rawUpper.includes('REJECT') || rawUpper.includes('DECLIN') || rawUpper.includes('CANCEL') || rawUpper.includes('FAIL')
  );

  if (isHardDecline) {
    return 'FINAL_DECLINE';
  }

  // 4. SOFT APPROVE (60 leads - In-progress / IPA)
  return 'SOFT_APPROVE';
}

// Classify raw MIS status into 4 business categories
function getNormalizedStatusCategory(rawStatus, misData = null, leadObj = null) {
  let md = misData;
  if (md && typeof md === 'string') {
    try { md = JSON.parse(md); } catch (e) {}
  }
  md = md && typeof md === 'object' ? md : {};

  const lead = leadObj || (typeof rawStatus === 'object' && rawStatus ? rawStatus : null);
  const statusStr = typeof rawStatus === 'string' ? rawStatus : (lead ? lead.mis_status : '');

  const bankNameUpper = (
    String(md.mis_bank_name || '') + ' ' +
    String(lead ? lead.card_bank || '' : '') + ' ' +
    String(lead ? lead.card_name || '' : '') + ' ' +
    String(md.kiwi_bank || '') + ' ' +
    String(md.kiwi_winning_bank || '')
  ).toUpperCase();

  if (bankNameUpper.includes('KIWI')) {
    return getKiwiStatusCategory(lead || { mis_status: statusStr, mis_data: md }, statusStr, md);
  }

  const rawUpper = String(statusStr || '').toUpperCase().trim();
  const cardVal = String(md.Card_Created || md.card_created || md.card_activation_status || md.card_state || '').toUpperCase().trim();
  const firstTxnVal = String(md.first_txn || md.first_transaction || '').toUpperCase().trim();
  const currentStateVal = String(md.current_state || md.winning_state || md.final_decision || '').toUpperCase().trim();
  const ipaVal = String(md.ipa || md.ipa_status || md.SOFT_DECISION || md.ipa_state || '').toUpperCase().trim();
  const rejectReasonVal = String(md.reject_reason || '').toUpperCase().trim();

  const fullStateStr = (rawUpper + ' ' + cardVal + ' ' + firstTxnVal + ' ' + currentStateVal + ' ' + ipaVal + ' ' + rejectReasonVal + ' ' + String(md.yes_state || '') + ' ' + String(md.au_state || '') + ' ' + String(md.pnb_state || '')).toUpperCase();

  // 1. FINAL APPROVE
  const isCardCreatedPositive = cardVal && cardVal !== 'NO' && cardVal !== 'FALSE' && cardVal !== '0' && cardVal !== 'NULL' && cardVal !== 'UNDEFINED' && cardVal !== 'NA' && cardVal !== 'N/A' && !cardVal.includes('REJECT') && !cardVal.includes('DECLINE');
  const isFirstTxnPositive = firstTxnVal && firstTxnVal !== 'NO' && firstTxnVal !== 'FALSE' && firstTxnVal !== '0' && firstTxnVal !== 'NULL' && firstTxnVal !== 'UNDEFINED' && !firstTxnVal.includes('REJECT') && !firstTxnVal.includes('DECLINE');

  if (
    isCardCreatedPositive ||
    isFirstTxnPositive ||
    rawUpper === 'APPROVED' ||
    rawUpper === 'FINAL_APPROVE' ||
    fullStateStr.includes('AC_CREATED') ||
    fullStateStr.includes('ACCREATED') ||
    fullStateStr.includes('ACCOUNT_CREATED') ||
    fullStateStr.includes('ACCOUNTCREATED') ||
    fullStateStr.includes('CARD_CREATED') ||
    fullStateStr.includes('CARDCREATED') ||
    fullStateStr.includes('CARD_ISSUED') ||
    fullStateStr.includes('CARDISSUED')
  ) {
    return 'FINAL_APPROVE';
  }

  // 2. SOFT DECLINE
  if (
    fullStateStr.includes('SOFT_DECLINE') ||
    fullStateStr.includes('SOFT DECLINE') ||
    fullStateStr.includes('PRE_DECLINE') ||
    fullStateStr.includes('PRE-DECLINE') ||
    fullStateStr.includes('PREDECLINE') ||
    fullStateStr.includes('DCLP') ||
    fullStateStr.includes('DACP') ||
    fullStateStr.includes('SOFT_REJECT') ||
    fullStateStr.includes('REJECT_SOFT')
  ) {
    return 'SOFT_DECLINE';
  }

  // 3. FINAL DECLINE
  if (
    fullStateStr.includes('DECLINE') ||
    fullStateStr.includes('REJECT') ||
    fullStateStr.includes('CANCEL') ||
    fullStateStr.includes('FAIL')
  ) {
    return 'FINAL_DECLINE';
  }

  // 4. SOFT APPROVE
  return 'SOFT_APPROVE';
}

// Normalize bank name to uppercase clean canonical string
function normalizeBankName(bankRaw) {
  if (!bankRaw) return 'OTHER';
  const upper = String(bankRaw).toUpperCase().trim();
  if (upper.includes('HDFC')) return 'HDFC';
  if (upper.includes('SBI')) return 'SBI';
  if (upper.includes('KIWI')) return 'KIWI';
  if (upper.includes('SCAPIA')) return 'SCAPIA';
  if (upper.includes('AXIS')) return 'AXIS';
  if (upper.includes('ICICI')) return 'ICICI';
  if (upper.includes('KOTAK')) return 'KOTAK';
  if (upper.includes('INDUSIND')) return 'INDUSIND';
  if (upper.includes('IDFC')) return 'IDFC';
  if (upper.includes('AU')) return 'AU';
  if (upper.includes('PNB')) return 'PNB';
  if (upper.includes('YES')) return 'YES';
  return upper.replace(/[^A-Z0-9]/g, '');
}

// ── Meta Graph API Client ──

async function getMetaCredentials() {
  const settings = await db.getSettings().catch(() => ({}));
  const adAccountId = getSettingVal(settings, 'meta_ad_account_id', 'META_AD_ACCOUNT_ID', 'act_1450810068922146');
  const accessToken = getSettingVal(settings, 'meta_access_token', 'META_ACCESS_TOKEN');
  const pixelId = getSettingVal(settings, 'meta_pixel_id', 'META_PIXEL_ID', '1015546961540665');
  const apiVersion = getSettingVal(settings, 'meta_api_version', 'META_API_VERSION', 'v20.0');

  return { adAccountId, accessToken, pixelId, apiVersion };
}

async function testMetaConnection() {
  try {
    const { adAccountId, accessToken, apiVersion } = await getMetaCredentials();
    if (!accessToken) {
      return { connected: false, error: 'META_ACCESS_TOKEN is missing' };
    }

    const cleanAdAccount = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const url = `https://graph.facebook.com/${apiVersion}/${cleanAdAccount}?fields=name,account_status,id&access_token=${accessToken}`;

    const res = await fetch(url);
    const data = await res.json();

    if (res.ok && data.id) {
      return {
        connected: true,
        adAccountName: data.name || cleanAdAccount,
        accountStatus: data.account_status,
        adAccountId: data.id
      };
    } else {
      return {
        connected: false,
        error: data.error ? data.error.message : JSON.stringify(data)
      };
    }
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

async function fetchMetaCustomAudiences() {
  try {
    const { adAccountId, accessToken, apiVersion } = await getMetaCredentials();
    if (!accessToken) return [];

    const cleanAdAccount = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const url = `https://graph.facebook.com/${apiVersion}/${cleanAdAccount}/customaudiences?fields=id,name,description,subtype&limit=500&access_token=${accessToken}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errData = await response.json();
      console.error('[Meta Audience] Failed to fetch existing audiences:', errData);
      return [];
    }
    const data = await response.json();
    return data.data || [];
  } catch (err) {
    console.error('[Meta Audience] fetchMetaCustomAudiences exception:', err.message);
    return [];
  }
}

async function createMetaCustomAudience(name, description = '') {
  try {
    const { adAccountId, accessToken, apiVersion } = await getMetaCredentials();
    if (!accessToken) throw new Error('META_ACCESS_TOKEN missing');

    // 1. Fetch existing custom audiences from Meta to prevent duplicate creation
    const existingMetaAuds = await fetchMetaCustomAudiences();
    const cleanTargetName = String(name).trim().toLowerCase();
    
    const matched = existingMetaAuds.find(a => String(a.name).trim().toLowerCase() === cleanTargetName);
    if (matched) {
      console.log(`[Meta Audience] Reusing existing audience '${name}' on Meta API (ID: ${matched.id})`);
      return { success: true, metaAudienceId: matched.id };
    }

    const cleanAdAccount = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const url = `https://graph.facebook.com/${apiVersion}/${cleanAdAccount}/customaudiences`;

    const body = {
      name: String(name).trim(),
      subtype: 'CUSTOM',
      description: description || 'FinMantra Automated Lead Custom Audience',
      customer_file_source: 'USER_PROVIDED_ONLY',
      access_token: accessToken
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (response.ok && data.id) {
      console.log(`[Meta Audience] Successfully created audience '${name}' on Meta API (ID: ${data.id})`);
      return { success: true, metaAudienceId: data.id };
    } else {
      console.error(`[Meta Audience] Create audience failed for '${name}':`, data);
      return { success: false, error: data.error ? data.error.message : JSON.stringify(data) };
    }
  } catch (err) {
    console.error('[Meta Audience] createMetaCustomAudience exception:', err.message);
    return { success: false, error: err.message };
  }
}

// Push users payload to Meta Custom Audience with SHA-256 hashing and deduplication
async function addUsersToMetaCustomAudience(metaAudienceId, leadsList) {
  if (!metaAudienceId || !leadsList || leadsList.length === 0) {
    return { success: true, addedCount: 0 };
  }

  try {
    const { accessToken, apiVersion } = await getMetaCredentials();
    if (!accessToken) throw new Error('META_ACCESS_TOKEN missing');

    // Prepare deduplicated hashed payload
    const seenHashes = new Set();
    const userRows = [];

    for (const l of leadsList) {
      const ph = normalizePhone(l.phone);
      const email = l.email ? String(l.email).trim().toLowerCase() : '';
      const { fn, ln } = splitName(l.full_name);

      const phHash = ph ? sha256Hash(ph) : '';
      const emailHash = email ? sha256Hash(email) : '';
      const fnHash = fn ? sha256Hash(fn) : '';
      const lnHash = ln ? sha256Hash(ln) : '';

      if (!phHash && !emailHash) continue;

      const dedupeKey = `${emailHash}_${phHash}`;
      if (seenHashes.has(dedupeKey)) continue;
      seenHashes.add(dedupeKey);

      userRows.push([emailHash, phHash, fnHash, lnHash]);
    }

    if (userRows.length === 0) {
      return { success: true, addedCount: 0 };
    }

    // Split into Meta payload batches of 10,000 users max
    const batchSize = 10000;
    let totalAdded = 0;

    for (let i = 0; i < userRows.length; i += batchSize) {
      const chunk = userRows.slice(i, i + batchSize);

      const payload = {
        payload: {
          schema: ['EMAIL', 'PHONE', 'FN', 'LN'],
          data: chunk
        }
      };

      const url = `https://graph.facebook.com/${apiVersion}/${metaAudienceId}/users?access_token=${accessToken}`;
      
      let retries = 0;
      let success = false;
      let data = null;

      while (retries < 3 && !success) {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        data = await response.json();
        if (response.ok) {
          success = true;
          totalAdded += data.num_received || chunk.length;
        } else if (response.status === 429) {
          retries++;
          console.warn(`[Meta Audience API] Rate limited (429). Retrying batch in ${retries * 2}s...`);
          await new Promise(r => setTimeout(r, retries * 2000));
        } else {
          break;
        }
      }

      if (!success) {
        console.error(`[Meta Audience Push] Batch failed for audience ${metaAudienceId}:`, data);
        return {
          success: false,
          addedCount: totalAdded,
          error: data && data.error ? data.error.message : 'Meta API error'
        };
      }
    }

    return { success: true, addedCount: totalAdded };
  } catch (err) {
    console.error(`[Meta Audience Push] Exception for ${metaAudienceId}:`, err.message);
    return { success: false, addedCount: 0, error: err.message };
  }
}

// Remove users payload from Meta Custom Audience
async function removeUsersFromMetaCustomAudience(metaAudienceId, leadsList) {
  if (!metaAudienceId || !leadsList || leadsList.length === 0) {
    return { success: true, removedCount: 0 };
  }

  try {
    const { accessToken, apiVersion } = await getMetaCredentials();
    if (!accessToken) throw new Error('META_ACCESS_TOKEN missing');

    const userRows = [];
    const seenHashes = new Set();

    for (const l of leadsList) {
      const ph = normalizePhone(l.phone);
      const email = l.email ? String(l.email).trim().toLowerCase() : '';
      const { fn, ln } = splitName(l.full_name);

      const phHash = ph ? sha256Hash(ph) : '';
      const emailHash = email ? sha256Hash(email) : '';
      const fnHash = fn ? sha256Hash(fn) : '';
      const lnHash = ln ? sha256Hash(ln) : '';

      if (!phHash && !emailHash) continue;
      const dedupeKey = `${emailHash}_${phHash}`;
      if (seenHashes.has(dedupeKey)) continue;
      seenHashes.add(dedupeKey);

      userRows.push([emailHash, phHash, fnHash, lnHash]);
    }

    if (userRows.length === 0) return { success: true, removedCount: 0 };

    const payload = {
      payload: {
        schema: ['EMAIL', 'PHONE', 'FN', 'LN'],
        data: userRows
      }
    };

    const url = `https://graph.facebook.com/${apiVersion}/${metaAudienceId}/users?access_token=${accessToken}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (response.ok) {
      return { success: true, removedCount: data.num_received || userRows.length };
    } else {
      return { success: false, error: data.error ? data.error.message : JSON.stringify(data) };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Delete Custom Audience from Meta
async function deleteMetaCustomAudience(metaAudienceId) {
  if (!metaAudienceId) return true;
  try {
    const { accessToken, apiVersion } = await getMetaCredentials();
    if (!accessToken) return false;

    const url = `https://graph.facebook.com/${apiVersion}/${metaAudienceId}?access_token=${accessToken}`;
    const res = await fetch(url, { method: 'DELETE' });
    const data = await res.json();
    return res.ok && data.success;
  } catch (err) {
    console.error(`[Meta Audience] Failed to delete ${metaAudienceId}:`, err.message);
    return false;
  }
}

// ── Safe SQL Rule Evaluation for Custom Audiences ──

const ALLOWED_FIELDS = {
  bank: "COALESCE(card_bank, mis_data->>'mis_bank_name', '')",
  status: "COALESCE(mis_status, '')",
  created_at: "created_at",
  source: "source",
  income: "monthly_income",
  pincode: "pincode",
  has_credit_card: "has_credit_card",
  agent_name: "agent_name"
};

const ALLOWED_OPERATORS = ['=', '!=', 'IN', 'NOT IN', '>', '>=', '<', '<=', 'BETWEEN', 'CONTAINS', 'IS NULL', 'IS NOT NULL'];

function buildSafeRuleWhereClause(rules) {
  if (!rules || typeof rules !== 'object' || !Array.isArray(rules.conditions) || rules.conditions.length === 0) {
    return { sql: '', params: [] };
  }

  const groupLogic = rules.logic === 'OR' ? ' OR ' : ' AND ';
  const clauses = [];
  const params = [];

  for (const cond of rules.conditions) {
    if (!cond || !cond.field || !cond.operator) continue;
    const dbCol = ALLOWED_FIELDS[cond.field.toLowerCase()];
    const op = String(cond.operator).toUpperCase().trim();

    if (!dbCol || !ALLOWED_OPERATORS.includes(op)) continue;

    if (op === 'IS NULL') {
      clauses.push(`(${dbCol} IS NULL OR ${dbCol} = '')`);
    } else if (op === 'IS NOT NULL') {
      clauses.push(`(${dbCol} IS NOT NULL AND ${dbCol} != '')`);
    } else if (op === 'CONTAINS') {
      params.push(`%${String(cond.value || '').trim()}%`);
      clauses.push(`${dbCol} ILIKE $${params.length}`);
    } else if (op === 'BETWEEN') {
      const val1 = cond.value1 || (Array.isArray(cond.value) ? cond.value[0] : cond.value);
      const val2 = cond.value2 || (Array.isArray(cond.value) ? cond.value[1] : cond.value);
      if (val1 !== undefined && val2 !== undefined) {
        params.push(val1, val2);
        clauses.push(`${dbCol} BETWEEN $${params.length - 1} AND $${params.length}`);
      }
    } else if (op === 'IN' || op === 'NOT IN') {
      let rawArr = Array.isArray(cond.value) ? cond.value : String(cond.value || '').split(',').map(s => s.trim());
      rawArr = rawArr.filter(Boolean);
      if (rawArr.length > 0) {
        params.push(rawArr);
        clauses.push(`${dbCol} ${op} (SELECT unnest($${params.length}::varchar[]))`);
      }
    } else {
      params.push(String(cond.value || '').trim());
      clauses.push(`${dbCol} ${op} $${params.length}`);
    }
  }

  if (clauses.length === 0) return { sql: '', params: [] };

  return {
    sql: ` AND (${clauses.join(groupLogic)})`,
    params
  };
}

// Query mapped leads eligible for a specific audience
async function getEligibleMappedLeadsForAudience(audience) {
  try {
    const { audience_type, bank_name, status_category, rules } = audience;
    let query = `
      SELECT id, urn, full_name, phone, email, card_bank, card_name, mis_status, mis_mapped_at, mis_data, created_at
      FROM leads
      WHERE (mis_mapped_at IS NOT NULL OR (mis_status IS NOT NULL AND mis_status != ''))
    `;
    const params = [];
    let pIdx = 1;

    if (audience_type === 'BANK_MASTER') {
      if (bank_name === 'KIWI') {
        query += ` AND (card_bank ILIKE '%KIWI%' OR mis_data->>'mis_bank_name' ILIKE '%KIWI%' OR (mis_data->>'kiwi_winning_bank' IS NOT NULL AND mis_data->>'kiwi_winning_bank' != '') OR card_name ILIKE '%KIWI%' OR landing_page ILIKE '%KIWI%' OR landing_page ILIKE '%GOKIWI%' OR utm_source ILIKE '%KIWI%' OR utm_source ILIKE '%GOKIWI%')`;
      } else {
        query += ` AND (card_bank ILIKE $${pIdx} OR mis_data->>'mis_bank_name' ILIKE $${pIdx})`;
        params.push(`%${bank_name}%`);
        pIdx++;
      }
    } else if (audience_type === 'BANK_STATUS') {
      if (bank_name === 'KIWI') {
        query += ` AND (card_bank ILIKE '%KIWI%' OR mis_data->>'mis_bank_name' ILIKE '%KIWI%' OR (mis_data->>'kiwi_winning_bank' IS NOT NULL AND mis_data->>'kiwi_winning_bank' != '') OR card_name ILIKE '%KIWI%' OR landing_page ILIKE '%KIWI%' OR landing_page ILIKE '%GOKIWI%' OR utm_source ILIKE '%KIWI%' OR utm_source ILIKE '%GOKIWI%')`;
      } else {
        query += ` AND (card_bank ILIKE $${pIdx} OR mis_data->>'mis_bank_name' ILIKE $${pIdx})`;
        params.push(`%${bank_name}%`);
        pIdx++;
      }

      // Filter by status category matching
      const allLeads = await db.pool.query(query, params);
      
      if (bank_name === 'KIWI') {
        console.log(`[KIWI DEBUG] Total KIWI leads: ${allLeads.rows.length} (query for ${status_category})`);
        const catCounts = {};
        for (const l of allLeads.rows) {
          let md = l.mis_data;
          if (typeof md === 'string') try { md = JSON.parse(md); } catch(e) {}
          md = md || {};
          const cat = getKiwiStatusCategory(l, l.mis_status, md);
          catCounts[cat] = (catCounts[cat] || 0) + 1;
        }
        console.log(`[KIWI DEBUG CAT COUNTS]:`, JSON.stringify(catCounts));
      }

      const filtered = allLeads.rows.filter(l => {
        let md = l.mis_data;
        if (typeof md === 'string') try { md = JSON.parse(md); } catch(e) {}
        md = md || {};
        const isKiwi = bank_name === 'KIWI' || String(l.card_bank || '').toUpperCase().includes('KIWI') || String(md.mis_bank_name || '').toUpperCase().includes('KIWI') || String(md.kiwi_winning_bank || '').toUpperCase().includes('KIWI') || String(l.card_name || '').toUpperCase().includes('KIWI');
        const cat = isKiwi ? getKiwiStatusCategory(l, l.mis_status, md) : getNormalizedStatusCategory(l.mis_status, md);
        const norm = (s) => String(s || '').toUpperCase().trim().replace(/[\s-]+/g, '_');
        return norm(cat) === norm(status_category);
      });
      return filtered;
    } else if (audience_type === 'CUSTOM') {
      const ruleResult = buildSafeRuleWhereClause(rules);
      query += ruleResult.sql;
      params.push(...ruleResult.params);
    }

    const res = await db.pool.query(query, params);
    return res.rows;
  } catch (err) {
    console.error('[Meta Audience] getEligibleMappedLeadsForAudience error:', err.message);
    return [];
  }
}

// ── Automatic Bank Provisioning Engine ──

async function autoProvisionBankAudiences(broadcast = null, forceRecreate = false) {
  try {
    const activeBanks = await db.getAllActiveBanksFromDB();
    console.log(`[Meta Provisioning] Checking automated Meta Custom Audiences for ${activeBanks.length} bank(s)... (forceRecreate=${forceRecreate})`);

    // 1. Ensure Global Master Audience exists
    let globalMaster = await db.getMetaAudienceByName('FinMantra - Global Master Audience');
    if (!globalMaster) {
      console.log("[Meta Provisioning] Creating Global Master Audience...");
      const metaRes = await createMetaCustomAudience('FinMantra - Global Master Audience', 'Overall eligible mapped lead population across FinMantra');
      globalMaster = await db.createMetaAudience({
        name: 'FinMantra - Global Master Audience',
        audience_type: 'GLOBAL_MASTER',
        meta_audience_id: metaRes.metaAudienceId || null,
        description: 'Overall eligible mapped lead population across FinMantra'
      });
    }

    // 2. Ensure Bank Master & 4 Status Audiences exist per bank
    const statuses = [
      { code: 'FINAL_APPROVE', label: 'Final Approve' },
      { code: 'FINAL_DECLINE', label: 'Final Decline' },
      { code: 'SOFT_APPROVE', label: 'Soft Approve' },
      { code: 'SOFT_DECLINE', label: 'Soft Decline' }
    ];

    for (const rawBank of activeBanks) {
      const bank = normalizeBankName(rawBank);
      if (!bank || bank === 'OTHER') continue;

      // Bank Master
      const masterName = `FinMantra - ${bank} - Master`;
      let bankMaster = await db.getMetaAudienceByName(masterName);
      if (!bankMaster) {
        console.log(`[Meta Provisioning] Creating Bank Master Audience for ${bank}...`);
        const metaRes = await createMetaCustomAudience(masterName, `All eligible mapped leads for ${bank}`);
        await db.createMetaAudience({
          name: masterName,
          audience_type: 'BANK_MASTER',
          bank_name: bank,
          meta_audience_id: metaRes.metaAudienceId || null,
          description: `All eligible mapped leads for ${bank}`
        });
      }

      // 4 Status Audiences
      for (const st of statuses) {
        const statusAudName = `FinMantra - ${bank} - ${st.label}`;
        let statusAud = await db.getMetaAudienceByName(statusAudName);
        if (!statusAud) {
          console.log(`[Meta Provisioning] Creating Status Audience '${statusAudName}'...`);
          const metaRes = await createMetaCustomAudience(statusAudName, `All ${st.label} mapped leads for ${bank}`);
          await db.createMetaAudience({
            name: statusAudName,
            audience_type: 'BANK_STATUS',
            bank_name: bank,
            status_category: st.code,
            meta_audience_id: metaRes.metaAudienceId || null,
            description: `All ${st.label} mapped leads for ${bank}`
          });
        }
      }
    }

    // 3. Generate missing Meta Audience IDs on Facebook Graph API for any pre-existing DB audiences
    const allAudiences = await db.getMetaAudiences({});
    for (const aud of allAudiences) {
      if (!aud.meta_audience_id || forceRecreate) {
        console.log(`[Meta Provisioning] Generating Meta Audience ID on Meta API for '${aud.name}'...`);
        const metaRes = await createMetaCustomAudience(aud.name, aud.description);
        if (metaRes.metaAudienceId) {
          aud.meta_audience_id = metaRes.metaAudienceId;
          await db.updateMetaAudience(aud.id, { meta_audience_id: metaRes.metaAudienceId });
          console.log(`[Meta Provisioning] Assigned Meta Audience ID ${metaRes.metaAudienceId} to '${aud.name}'`);
        }
      }
    }

    if (broadcast) {
      broadcast({ type: 'META_AUDIENCES_UPDATED' });
    }
  } catch (err) {
    console.error('[Meta Provisioning] Exception:', err.message);
  }
}

// ── Audience Reconciliation & Sync Queue Worker ──

async function syncSingleAudience(audienceId, isFullSync = false, broadcast = null) {
  const startTime = Date.now();
  const audience = await db.getMetaAudienceById(audienceId);
  if (!audience) return { success: false, error: 'Audience not found' };

  console.log(`[Meta Sync Worker] Starting ${isFullSync ? 'FULL' : 'INCREMENTAL'} sync for audience '${audience.name}'...`);

  // Ensure Meta Audience ID exists
  if (!audience.meta_audience_id) {
    const metaRes = await createMetaCustomAudience(audience.name, audience.description);
    if (metaRes.metaAudienceId) {
      audience.meta_audience_id = metaRes.metaAudienceId;
      await db.updateMetaAudience(audience.id, { meta_audience_id: metaRes.metaAudienceId });
    } else {
      return { success: false, error: metaRes.error ? `Failed to create Meta Audience ID: ${metaRes.error}` : 'Failed to create Meta Audience ID' };
    }
  }

  const job = await db.createSyncJob({
    audience_id: audience.id,
    job_type: isFullSync ? 'FULL' : 'INCREMENTAL',
    status: 'PROCESSING'
  });

  try {
    // Fetch all eligible mapped leads for this audience
    const eligibleLeads = await getEligibleMappedLeadsForAudience(audience);
    const totalEligible = eligibleLeads.length;

    await db.updateSyncJob(job.id, { total_records: totalEligible });

    // Determine current memberships from DB to prevent duplicate API dispatches
    const memRes = await db.getMetaAudienceMemberships(audience.id, { limit: 100000 });
    const existingMemMap = new Map();
    memRes.rows.forEach(m => existingMemMap.set(m.lead_id, m.state));

    const leadsToAdd = [];
    let skippedCount = 0;

    for (const lead of eligibleLeads) {
      const currentState = existingMemMap.get(lead.id);
      if (currentState === 'SYNCED') {
        skippedCount++;
      } else {
        leadsToAdd.push(lead);
      }
    }

    if (leadsToAdd.length === 0) {
      const duration = Date.now() - startTime;
      await db.updateSyncJob(job.id, {
        status: 'COMPLETED',
        processed_records: totalEligible,
        successful_records: totalEligible - skippedCount,
        skipped_records: skippedCount,
        duration_ms: duration
      });
      await db.updateMetaAudience(audience.id, {
        database_count: totalEligible,
        synced_count: totalEligible,
        pending_count: 0,
        failed_count: 0,
        last_synced_at: new Date().toISOString(),
        status: 'active'
      });

      if (broadcast) broadcast({ type: 'META_AUDIENCE_SYNC_PROGRESS', audienceId: audience.id, percent: 100 });
      return { success: true, processed: totalEligible, synced: 0, skipped: skippedCount };
    }

    // Push to Meta Custom Audience
    const pushResult = await addUsersToMetaCustomAudience(audience.meta_audience_id, leadsToAdd);

    if (pushResult.success) {
      // Mark memberships as SYNCED
      for (const lead of leadsToAdd) {
        await db.upsertMetaAudienceMembership(audience.id, lead.id, 'SYNCED');
      }

      const totalSynced = (audience.synced_count || 0) + pushResult.addedCount;
      const duration = Date.now() - startTime;

      await db.updateSyncJob(job.id, {
        status: 'COMPLETED',
        processed_records: leadsToAdd.length,
        successful_records: pushResult.addedCount,
        skipped_records: skippedCount,
        duration_ms: duration
      });

      await db.updateMetaAudience(audience.id, {
        database_count: totalEligible,
        synced_count: totalEligible,
        pending_count: 0,
        failed_count: 0,
        last_synced_at: new Date().toISOString(),
        status: 'active'
      });

      await db.insertAudienceAuditLog({
        action: isFullSync ? 'FULL_SYNC_COMPLETED' : 'INCREMENTAL_SYNC_COMPLETED',
        audience_id: audience.id,
        audience_name: audience.name,
        records_processed: pushResult.addedCount,
        records_failed: 0,
        details: { totalEligible, pushed: pushResult.addedCount, durationMs: duration }
      });

      if (broadcast) {
        broadcast({ type: 'META_AUDIENCE_SYNC_PROGRESS', audienceId: audience.id, percent: 100, status: 'COMPLETED' });
        broadcast({ type: 'META_AUDIENCES_UPDATED' });
      }

      return { success: true, processed: leadsToAdd.length, added: pushResult.addedCount };
    } else {
      // Mark memberships as FAILED
      for (const lead of leadsToAdd) {
        await db.upsertMetaAudienceMembership(audience.id, lead.id, 'FAILED', pushResult.error);
      }

      const duration = Date.now() - startTime;
      await db.updateSyncJob(job.id, {
        status: 'FAILED',
        processed_records: leadsToAdd.length,
        failed_records: leadsToAdd.length,
        duration_ms: duration,
        error_message: pushResult.error
      });

      await db.updateMetaAudience(audience.id, {
        database_count: totalEligible,
        failed_count: leadsToAdd.length,
        status: 'error'
      });

      await db.insertAudienceAuditLog({
        action: 'SYNC_FAILED',
        audience_id: audience.id,
        audience_name: audience.name,
        records_processed: 0,
        records_failed: leadsToAdd.length,
        details: { error: pushResult.error }
      });

      if (broadcast) {
        broadcast({ type: 'META_AUDIENCE_SYNC_PROGRESS', audienceId: audience.id, percent: 100, status: 'FAILED', error: pushResult.error });
      }

      return { success: false, error: pushResult.error };
    }
  } catch (err) {
    console.error(`[Meta Sync Worker] Exception during sync for audience ${audience.id}:`, err.message);
    await db.updateSyncJob(job.id, { status: 'FAILED', error_message: err.message });
    return { success: false, error: err.message };
  }
}

// Queue lead sync for mapped leads updated during MIS mapping flow
async function enqueueLeadSyncForUpdatedLeads(updatedLeads, broadcast = null) {
  if (!updatedLeads || !Array.isArray(updatedLeads) || updatedLeads.length === 0) return;

  // Run asynchronously without blocking MIS HTTP response
  setTimeout(async () => {
    try {
      const allAudiences = await db.getMetaAudiences();
      const activeAudiences = allAudiences.filter(a => a.auto_push && a.status !== 'paused');

      if (activeAudiences.length === 0) return;

      console.log(`[Meta Sync Queue] Reconciling ${updatedLeads.length} updated mapped lead(s) across ${activeAudiences.length} audience(s)...`);

      for (const audience of activeAudiences) {
        await syncSingleAudience(audience.id, false, broadcast);
      }
    } catch (err) {
      console.error('[Meta Sync Queue] Error during enqueueLeadSyncForUpdatedLeads:', err.message);
    }
  }, 100);
}

module.exports = {
  sha256Hash,
  splitName,
  normalizePhone,
  getNormalizedStatusCategory,
  getKiwiStatusCategory,
  normalizeBankName,
  testMetaConnection,
  createMetaCustomAudience,
  addUsersToMetaCustomAudience,
  removeUsersFromMetaCustomAudience,
  deleteMetaCustomAudience,
  buildSafeRuleWhereClause,
  getEligibleMappedLeadsForAudience,
  autoProvisionBankAudiences,
  syncSingleAudience,
  enqueueLeadSyncForUpdatedLeads,
  fetchMetaCustomAudiences
};
