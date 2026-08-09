const crypto = require('crypto');
const db = require('./db');

function getSettingVal(settings, key, envKey) {
  if (settings && settings[key] !== undefined && settings[key] !== null && String(settings[key]).trim() !== '') {
    return String(settings[key]).trim();
  }
  return process.env[envKey] || null;
}

// Helper to hash fields for Meta Conversions API (SHA-256)
function sha256Hash(text) {
  if (!text) return null;
  return crypto.createHash('sha256').update(String(text).trim().toLowerCase()).digest('hex');
}

// Helper to check if MIS status represents a Final Approved lead
function isFinalApprovedStatus(rawStatus) {
  if (!rawStatus) return false;
  const upper = String(rawStatus).toUpperCase().trim();
  if (upper.includes('SOFT') || upper.includes('DCLP') || upper.includes('DACP') || upper.includes('PENDING') || upper.includes('REJECT') || upper.includes('DECLINE')) {
    if (upper.includes('APPROVE') && !upper.includes('SOFT') && !upper.includes('PRE-APPROVED') && !upper.includes('IN-PROCESS')) {
      return true;
    }
    return false;
  }
  return (
    upper.includes('APPROVE') ||
    upper.includes('CARD CREATED') ||
    upper.includes('CARD ISSUED') ||
    upper.includes('DISBURSED') ||
    upper.includes('ACTIVE') ||
    upper.includes('CARD ACTIVATED') ||
    upper.includes('FIRST TXN') ||
    upper.includes('FIRST_TXN') ||
    upper.includes('ACCOUNT CREATED') ||
    upper.includes('SUCCESS')
  );
}

// Helper to split full name into first and last name
function splitName(fullName) {
  if (!fullName) return { fn: '', ln: '' };
  const parts = String(fullName).trim().split(/\s+/);
  const fn = parts[0] || '';
  const ln = parts.slice(1).join(' ') || '';
  return { fn, ln };
}

// Send server-side event to Meta Conversions API (CAPI)
async function sendMetaCapiEvent(lead, eventName = 'Purchase', eventValue = 2000, bankName = null, testEventCode = null) {
  try {
    const settings = await db.getSettings().catch(() => ({}));
    const pixelId = getSettingVal(settings, 'meta_pixel_id', 'META_PIXEL_ID');
    const accessToken = getSettingVal(settings, 'meta_access_token', 'META_ACCESS_TOKEN');

    if (!pixelId || !accessToken) {
      console.log('[Meta CAPI] Skipped: META_PIXEL_ID or META_ACCESS_TOKEN not set.');
      return { status: 'skipped', error: 'Missing API credentials' };
    }

    let rawPhone = lead.phone || '';
    rawPhone = rawPhone.replace(/\D/g, '');
    if (rawPhone.length === 10) {
      rawPhone = '91' + rawPhone;
    }

    const { fn, ln } = splitName(lead.full_name);

    const userData = {
      ph: [sha256Hash(rawPhone)],
      em: [sha256Hash(lead.email)],
      fn: fn ? [sha256Hash(fn)] : undefined,
      ln: ln ? [sha256Hash(ln)] : undefined,
      client_ip_address: lead.ip_address || null,
      client_user_agent: lead.user_agent || null,
    };

    if (lead.fbclid) {
      userData.fbc = `fb.1.${Date.now()}.${lead.fbclid}`;
    } else if (lead.utm_params && lead.utm_params.fbclid) {
      userData.fbc = `fb.1.${Date.now()}.${lead.utm_params.fbclid}`;
    }

    if (lead.utm_params && lead.utm_params._fbp) {
      userData.fbp = lead.utm_params._fbp;
    }

    const leadBank = bankName || lead.card_bank || (lead.mis_data && lead.mis_data.mis_bank_name) || 'FinMantra Partner';
    const cardName = lead.card_name || (lead.mis_data && lead.mis_data.card_name) || 'Credit Card';

    const payload = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: `${lead.id}_Purchase_${lead.mis_status || 'Approved'}`,
          event_source_url: lead.landing_page || 'https://finmantra.org/',
          action_source: 'website',
          user_data: userData,
          custom_data: {
            currency: 'INR',
            value: Number(eventValue) || 2000,
            content_name: cardName,
            content_category: leadBank,
            bank: leadBank,
            status: lead.mis_status || 'Final Approved'
          }
        }
      ]
    };

    const activeTestCode = testEventCode || settings.meta_test_event_code || process.env.META_TEST_EVENT_CODE;
    if (activeTestCode) {
      payload.test_event_code = activeTestCode;
    }

    const url = `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (response.ok) {
      console.log(`[Meta CAPI] Purchase Event (₹${eventValue}) sent successfully for lead ${lead.id}. Trace ID: ${data.fb_trace_id}`);
      await db.updateLeadCapiStatus(lead.id, eventName, eventValue, 'SUCCESS', data);
      return { status: 'success', response: data };
    } else {
      console.error(`[Meta CAPI] Failed for lead ${lead.id}:`, data);
      await db.updateLeadCapiStatus(lead.id, eventName, eventValue, 'FAILED', data);
      return { status: 'failed', response: data };
    }
  } catch (err) {
    console.error(`[Meta CAPI] Network error for lead ${lead.id}:`, err);
    await db.updateLeadCapiStatus(lead.id, eventName, eventValue, 'ERROR', { error: err.message });
    return { status: 'failed', error: err.message };
  }
}

// Push lead records to active Meta Custom Audiences
async function syncLeadsToMetaCustomAudiences(leadsList, targetAudienceId = null) {
  if (!leadsList || !Array.isArray(leadsList) || leadsList.length === 0) return;

  try {
    const settings = await db.getSettings().catch(() => ({}));
    const accessToken = getSettingVal(settings, 'meta_access_token', 'META_ACCESS_TOKEN');
    if (!accessToken) {
      console.log('[Meta Audience Push] Skipped: META_ACCESS_TOKEN not set.');
      return;
    }

    let audiences = [];
    if (targetAudienceId) {
      const single = await db.getMetaAudienceById(targetAudienceId);
      if (single) audiences = [single];
    } else {
      audiences = await db.getMetaAudiences();
      audiences = audiences.filter(a => a.auto_push && a.meta_audience_id);
    }

    if (audiences.length === 0) return;

    for (const audience of audiences) {
      if (!audience.meta_audience_id) continue;

      const targetBank = audience.bank_name || 'ALL';
      const matchingLeads = leadsList.filter(l => {
        if (!isFinalApprovedStatus(l.mis_status)) return false;
        if (targetBank === 'ALL') return true;
        const leadBank = String(l.card_bank || (l.mis_data && l.mis_data.mis_bank_name) || '').toUpperCase();
        return leadBank.includes(targetBank.toUpperCase());
      });

      if (matchingLeads.length === 0) continue;

      const userRows = matchingLeads.map(l => {
        let ph = (l.phone || '').replace(/\D/g, '');
        if (ph.length === 10) ph = '91' + ph;
        const { fn, ln } = splitName(l.full_name);

        return [
          sha256Hash(l.email) || '',
          sha256Hash(ph) || '',
          sha256Hash(fn) || '',
          sha256Hash(ln) || ''
        ];
      }).filter(row => row[0] || row[1]);

      if (userRows.length === 0) continue;

      const payload = {
        payload: {
          schema: ['EMAIL_SHA256', 'PHONE_SHA256', 'FN_SHA256', 'LN_SHA256'],
          data: userRows
        }
      };

      const url = `https://graph.facebook.com/v20.0/${audience.meta_audience_id}/users?access_token=${accessToken}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok) {
        const addedCount = data.num_received || userRows.length;
        const newTotal = (Number(audience.total_records) || 0) + addedCount;
        await db.updateMetaAudience(audience.id, {
          total_records: newTotal,
          last_synced_at: new Date().toISOString(),
          status: 'active'
        });
        await db.insertAudienceHistoryLog({
          audience_id: audience.id,
          audience_name: audience.name,
          records_processed: addedCount,
          records_failed: 0,
          query: `Select finmatraid, where mis_status is Final Approved for bank ${targetBank}`,
          status: 'SUCCESS'
        });
        console.log(`[Meta Audience Push] Successfully pushed ${addedCount} user(s) to audience '${audience.name}' (${audience.meta_audience_id}).`);
      } else {
        console.error(`[Meta Audience Push] Error pushing to '${audience.name}':`, data);
        await db.insertAudienceHistoryLog({
          audience_id: audience.id,
          audience_name: audience.name,
          records_processed: 0,
          records_failed: userRows.length,
          query: `Select finmatraid, where mis_status is Final Approved for bank ${targetBank}`,
          error_message: data.error ? data.error.message : JSON.stringify(data),
          status: 'FAILED'
        });
      }
    }
  } catch (err) {
    console.error('[Meta Audience Push] Execution error:', err.message);
  }
}

module.exports = {
  sha256Hash,
  isFinalApprovedStatus,
  splitName,
  sendMetaCapiEvent,
  syncLeadsToMetaCustomAudiences,
  getSettingVal
};
