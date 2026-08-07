const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const db = require('./db');
const sbiFetcher = require('./sbiEmailFetcher'); // To reuse config

async function getEmailConfig() {
  const sbiConfig = await sbiFetcher.getEmailConfig();
  const defaultConf = {
    receiver_email: sbiConfig.receiver_email || 'spikemarketingsolutions25@gmail.com',
    app_password: sbiConfig.app_password || '',
    sender_email: 'harbans.anand@mymoneymantra.com',
    subject_keywords: ['kiwi mis'],
    enabled: true
  };
  
  try {
    const raw = await db.getSetting('kiwi_email_mis_config');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { 
        ...defaultConf, 
        ...parsed,
        receiver_email: parsed.receiver_email || defaultConf.receiver_email,
        app_password: parsed.app_password || defaultConf.app_password
      };
    }
  } catch (e) {
    console.error('Error parsing kiwi email config:', e);
  }
  return defaultConf;
}

// Map Status Helper
function getStatusRank(status) {
  const s = String(status || '').toUpperCase();
  if (s.includes('APPROV') || s.includes('ISSUED') || s.includes('SUCCESS') || s.includes('SANCTION')) return 100;
  if (s.includes('REJECT') || s.includes('DECLINE')) return 10;
  if (s.includes('PROCESS') || s.includes('WIP') || s.includes('IN PROGRESS')) return 50;
  return 0;
}

function getRowValue(rowObj, searchKey) {
  if (!rowObj) return '';
  const searchLower = String(searchKey).trim().toLowerCase();
  for (const [key, val] of Object.entries(rowObj)) {
    if (String(key).trim().toLowerCase() === searchLower) {
      return val;
    }
  }
  return '';
}

function cleanUserId(uid) {
  if (uid === null || uid === undefined) return null;
  const s = String(uid).trim();
  return s === '' ? null : s;
}

function extractUrnFromText(text) {
  if (!text) return null;
  const str = String(text);
  const regex = /FM[0-9A-Z]{9,15}/gi;
  const matches = str.match(regex);
  if (matches && matches.length > 0) {
    return matches[0].toUpperCase();
  }
  return null;
}

function standardizeStatus(statusStr, rowObj) {
  const s = String(statusStr || '').toUpperCase();
  if (s.includes('APPROV') || s.includes('ISSUED') || s.includes('SUCCESS')) return 'APPROVED';
  if (s.includes('REJECT') || s.includes('DECLIN') || s.includes('CANCEL')) return 'REJECTED';
  if (s.includes('VERIF') || s.includes('PROCESS') || s.includes('WIP')) return 'IN PROGRESS';
  return 'Pending';
}

async function processKiwiMisBuffer(buffer, attachmentName, broadcastFn = null) {
  let parsedRows = [];
  let pythonSuccess = false;
  const tempPath = path.join(os.tmpdir(), `kiwi_email_${Date.now()}_${Math.random().toString(36).substring(7)}.xlsx`);
  
  try {
    fs.writeFileSync(tempPath, buffer);
    const pyScript = path.join(__dirname, 'parse_kiwi_mis.py');
    const pyCmd = process.platform === 'win32' ? 'python' : 'python3';

    const pyResult = await new Promise((resolve) => {
      execFile(pyCmd, [pyScript, tempPath], { maxBuffer: 1024 * 1024 * 100 }, (error, stdout, stderr) => {
        if (error) {
          console.error('[KIWI Email Fetcher] Python Parser Error:', error.message, stderr);
          resolve(null);
        } else {
          try {
            resolve(JSON.parse(stdout));
          } catch(e) {
            console.error('[KIWI Email Fetcher] JSON parse error:', e.message);
            resolve(null);
          }
        }
      });
    });

    if (pyResult && pyResult.parsedRows) {
      parsedRows = pyResult.parsedRows;
      pythonSuccess = true;
      console.log(`[KIWI Email Fetcher] Extracted ${parsedRows.length} rows via python.`);
    }
  } catch(pyErr) {
    console.error('[KIWI Email Fetcher] Execution failed:', pyErr.message);
  } finally {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch(e) {}
    }
  }

  // Fallback to JS xlsx parser if Python failed
  if (!pythonSuccess) {
    console.log('[KIWI Email Fetcher] Python parser failed. Using fallback JS parser...');
    try {
      const workbook = xlsx.read(buffer, { type: 'buffer', dense: true, cellHTML: false, cellFormula: false, cellText: false });
      const yesSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('yes'));
      const auSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('au'));
      const pnbSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('pnb'));

      if (yesSheetName) {
        const yesRows = xlsx.utils.sheet_to_json(workbook.Sheets[yesSheetName], { defval: '' });
        const auRows = auSheetName ? xlsx.utils.sheet_to_json(workbook.Sheets[auSheetName], { defval: '' }) : [];
        const pnbRows = pnbSheetName ? xlsx.utils.sheet_to_json(workbook.Sheets[pnbSheetName], { defval: '' }) : [];

        // Simple fallback extraction logic mirroring server.js
        const yesContentKey = Object.keys(yesRows[0] || {}).find(k => String(yesRows[0][k]).includes('FM')) || 'contant';
        const auUserMap = new Map();
        auRows.forEach(r => auUserMap.set(cleanUserId(getRowValue(r, 'user_id')), r));
        const pnbUserMap = new Map();
        pnbRows.forEach(r => pnbUserMap.set(cleanUserId(getRowValue(r, 'user_id')), r));

        for (let i = 0; i < yesRows.length; i++) {
          const yesRow = yesRows[i];
          const rawContent = yesRow[yesContentKey] || getRowValue(yesRow, 'content');
          const extractedUrn = extractUrnFromText(rawContent);
          if (!extractedUrn) continue;

          const userId = cleanUserId(getRowValue(yesRow, 'user_id'));
          const candidateAuRow = userId ? auUserMap.get(userId) : null;
          const candidatePnbRow = userId ? pnbUserMap.get(userId) : null;

          const yesState = String(getRowValue(yesRow, 'current_state') || '').trim();
          const auState = candidateAuRow ? String(getRowValue(candidateAuRow, 'current_state') || '').trim() : '';
          const pnbState = candidatePnbRow ? String(getRowValue(candidatePnbRow, 'current_state') || '').trim() : '';

          parsedRows.push({
            content: extractedUrn,
            APPLICATION_REFERENCE_NUMBER: extractedUrn,
            kiwi_winning_bank: 'YES',
            kiwi_user_id: userId,
            kiwi_yes_status: yesState,
            kiwi_au_status: auState,
            kiwi_pnb_status: pnbState,
            _extractedUrn: extractedUrn,
            current_state: yesState,
            status_rank: getStatusRank(yesState)
          });
        }
      }
    } catch(e) {
      console.error('[KIWI Email Fetcher] Fallback parsing error:', e.message);
    }
  }

  if (parsedRows.length === 0) {
    return { total: 0, mapped: 0, warnings: 0, matchedDetails: [] };
  }

  const allLeads = await db.getAllLeadsUnfiltered();
  const dbLeads = allLeads.filter(lead => {
    const src = String(lead.source || '').toLowerCase();
    const cName = String(lead.card_name || '').toLowerCase();
    const cBank = String(lead.card_bank || '').toLowerCase();
    return src.includes('kiwi') || cName.includes('kiwi') || cBank.includes('kiwi');
  });

  const dbUrnMap = new Map();
  const dbSuffixMap = new Map();
  const dbNumericSuffixMap = new Map();

  dbLeads.forEach(lead => {
    if (lead.urn) {
      const canonical = String(lead.urn).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (canonical) {
        dbUrnMap.set(canonical, lead);
        const letterMatch = canonical.match(/[A-Z]\d+$/);
        if (letterMatch && letterMatch[0].length >= 7) dbSuffixMap.set(letterMatch[0], lead);
        const numericMatch = canonical.match(/\d+$/);
        if (numericMatch && numericMatch[0].length >= 6) dbNumericSuffixMap.set(numericMatch[0], lead);
      }
    }
  });

  const updates = [];
  const matchedDetails = [];
  let mappedCount = 0;

  for (const row of parsedRows) {
    let excelLc2 = row._extractedUrn || extractUrnFromText(getRowValue(row, 'contant') || getRowValue(row, 'urn'));
    if (!excelLc2) {
      for (const cellVal of Object.values(row)) {
        const found = extractUrnFromText(cellVal);
        if (found) { excelLc2 = found; break; }
      }
    }
    
    if (!excelLc2) continue;

    const cleanExcelLc2 = excelLc2.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let matchedLead = null;

    if (cleanExcelLc2) {
      if (dbUrnMap.has(cleanExcelLc2)) {
        matchedLead = dbUrnMap.get(cleanExcelLc2);
      } else if (cleanExcelLc2.length >= 7 && /^[A-Z]\d+$/.test(cleanExcelLc2)) {
        matchedLead = dbSuffixMap.get(cleanExcelLc2);
      } else if (cleanExcelLc2.length >= 6 && /^\d+$/.test(cleanExcelLc2)) {
        matchedLead = dbNumericSuffixMap.get(cleanExcelLc2);
      } else if (cleanExcelLc2.startsWith('FM') && cleanExcelLc2.length >= 10) {
        const letterMatch = cleanExcelLc2.match(/[A-Z]\d+$/);
        if (letterMatch && letterMatch[0].length >= 7) matchedLead = dbSuffixMap.get(letterMatch[0]);
        if (!matchedLead) {
          const numericMatch = cleanExcelLc2.match(/\d+$/);
          if (numericMatch && numericMatch[0].length >= 6) matchedLead = dbNumericSuffixMap.get(numericMatch[0]);
        }
      }
    }

    if (matchedLead) {
      mappedCount++;
      const misData = {
        mis_bank_name: 'KIWI',
        kiwi_bank: row.kiwi_winning_bank || 'YES',
        winning_bank: row.kiwi_winning_bank || 'YES',
        winning_state: row.current_state || '',
        winning_rank: row.status_rank || 0,
        yes_state: row.kiwi_yes_status || '',
        au_state: row.kiwi_au_status || '',
        pnb_state: row.kiwi_pnb_status || '',
        user_id: row.kiwi_user_id || '',
        current_state: row.current_state || '',
        final_decision: row.current_state || '',
        bank_reference_number: String(row._extractedUrn || row.APPLICATION_REFERENCE_NUMBER || '').trim(),
        application_submit_date_time: String(row.form_submit || row.registration || '').trim(),
        registration: row.registration || '',
        pan_submit: row.pan_submit || '',
        form_fetch: row.form_fetch || '',
        form_submit: row.form_submit || '',
        ipa: row.ipa || '',
        card_created: row.card_created || '',
        vkyc: row.vkyc || '',
        reject_reason: row.reject_reason || '',
        application_id_bank_2: row.application_id_bank_2 || '',
        first_txn: row.first_txn || '',
      };

      const finalDecision = misData.final_decision;
      const standardStatus = standardizeStatus(finalDecision, row);

      const currentMisData = typeof matchedLead.mis_data === 'string' ? JSON.parse(matchedLead.mis_data) : (matchedLead.mis_data || {});
      const mergedData = { ...currentMisData, ...misData };
      delete mergedData.history;

      updates.push({
        id: matchedLead.id,
        status: standardStatus,
        data: mergedData,
        agent_id: matchedLead.agent_id,
        agent_name: matchedLead.agent_name
      });

      matchedDetails.push({
        urn: matchedLead.urn,
        name: matchedLead.full_name,
        status: standardStatus
      });
    }
  }

  if (updates.length > 0) {
    await db.bulkUpdateLeadMISStatus(updates);
  }

  return {
    total: parsedRows.length,
    mapped: mappedCount,
    warnings: 0,
    matchedDetails
  };
}

async function checkAndFetchEmails(broadcastFn = null) {
  const config = await getEmailConfig();
  if (!config.enabled) {
    return { success: false, reason: 'Disabled in settings' };
  }

  if (!config.app_password) {
    return { success: false, reason: 'No password configured' };
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: config.receiver_email,
      pass: config.app_password
    },
    logger: false
  });

  client.on('error', err => {
    const msg = err.message || '';
    if (msg.includes('Unexpected close') || msg.includes('Connection not available') || msg.includes('Socket timeout')) {
      return; // Ignore routine idle connection closures from Gmail IMAP
    }
    console.error('[KIWI Email Fetcher] ImapFlow Client Error:', msg);
  });

  let totalMappedInSync = 0;
  let processedFilesCount = 0;

  try {
    console.log(`[KIWI Email Fetcher] Connecting to IMAP server for ${config.receiver_email}...`);
    await client.connect();
    
    const lock = await client.getMailboxLock('INBOX');
    try {
      const processedUids = await db.getProcessedEmailUids();
      
      const senderList = (config.sender_email || '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);

      const defaultKiwiKeywords = ['kiwi mis', 'kiwi', 'gokiwi', 'yes bank'];
      const subjectKeywords = (config.subject_keywords && config.subject_keywords.length > 0)
        ? config.subject_keywords
        : defaultKiwiKeywords;

      // Phase 1: Collect candidate matching email headers first (avoids IMAP command collision)
      const candidates = [];
      const messages = client.fetch('1:*', { uid: true, envelope: true });
      
      for await (const message of messages) {
        if (!message || !message.uid) continue;
        const uidStr = String(message.uid);
        const kiwiUidKey = `kiwi_${uidStr}`;
        if (processedUids.has(kiwiUidKey) || processedUids.has(uidStr)) continue;

        const fromAddr = (message.envelope?.from?.[0]?.address || '').toLowerCase();
        const fromName = (message.envelope?.from?.[0]?.name || '').toLowerCase();
        const fullSender = `${fromAddr} ${fromName}`;
        const subject = message.envelope?.subject || '';
        const normSubject = subject.toLowerCase();

        // Check Subject Match
        const isSubjectMatch = subjectKeywords.some(kw => {
          const cleanKw = String(kw).toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanSubj = normSubject.replace(/[^a-z0-9]/g, '');
          return cleanSubj.includes(cleanKw) || normSubject.includes(String(kw).toLowerCase());
        });

        if (!isSubjectMatch) continue;

        // Check Sender Match (lenient for forwarded emails matching target MIS)
        let isSenderAllowed = true;
        if (senderList.length > 0) {
          isSenderAllowed = senderList.some(s => fullSender.includes(s) || normSubject.includes(s) || s === 'all');
        }
        // Allow forwarded emails if subject clearly indicates KIWI MIS
        if (!isSenderAllowed && (normSubject.includes('kiwi') || normSubject.includes('gokiwi'))) {
          isSenderAllowed = true;
        }

        if (!isSenderAllowed) continue;

        candidates.push({ uidStr, kiwiUidKey, subject, fromAddr });
      }

      // Phase 2: Fetch full message source specifically for each collected candidate UID
      for (const cand of candidates) {
        const { uidStr, kiwiUidKey, subject, fromAddr } = cand;
        console.log(`[KIWI Email Fetcher] Matched target email: "${subject}" (UID: ${uidStr}). Fetching attachment...`);

        let fullMsg = null;
        try {
          fullMsg = await client.fetchOne(uidStr, { source: true }, { uid: true });
        } catch (fetchErr) {
          console.error(`[KIWI Email Fetcher] Error fetching message UID ${uidStr}:`, fetchErr.message);
          continue;
        }

        if (!fullMsg || !fullMsg.source) continue;

        const parsed = await simpleParser(fullMsg.source);
        if (parsed.attachments && parsed.attachments.length > 0) {
          console.log(`[KIWI Email Fetcher] Email UID ${uidStr} has ${parsed.attachments.length} attachment(s).`);
          for (const attachment of parsed.attachments) {
            const fname = attachment.filename || attachment.name || 'kiwi_mis.xlsx';
            const fnLower = fname.toLowerCase();
            const cType = (attachment.contentType || '').toLowerCase();

            const isExcelOrCsv = fnLower.endsWith('.xlsx') || 
                                 fnLower.endsWith('.xls') || 
                                 fnLower.endsWith('.csv') ||
                                 fnLower.endsWith('.txt') ||
                                 cType.includes('spreadsheet') || 
                                 cType.includes('excel') || 
                                 cType.includes('csv') ||
                                 cType.includes('octet-stream') ||
                                 fnLower.includes('kiwi') ||
                                 fnLower.includes('mis');

            if (isExcelOrCsv) {
              console.log(`[KIWI Email Fetcher] Extracting Excel/CSV attachment: ${fname} (${attachment.size} bytes)`);

              const result = await processKiwiMisBuffer(attachment.content, fname, broadcastFn);

              totalMappedInSync += result.mapped;
              processedFilesCount++;

              await db.saveProcessedEmailMis({
                message_uid: kiwiUidKey,
                subject,
                sender: fromAddr || config.sender_email,
                attachment_name: fname,
                total_processed: result.total,
                mapped_count: result.mapped,
                warning_count: result.warnings
              });
              
              await db.createNotification({
                type: 'success',
                title: `🥝 KIWI MIS Sync Completed`,
                message: `Successfully fetched and mapped ${result.mapped} leads from "${subject}" (${fname}).`,
                details: { subject, filename: fname, totalRows: result.total, mappedCount: result.mapped }
              });
              processedUids.add(uidStr);
            }
          }
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();

    if (processedFilesCount > 0 && broadcastFn) {
      broadcastFn({ type: 'MIS_UPDATED' });
      broadcastFn({ type: 'LEADS_UPDATED' });
      broadcastFn({ type: 'NOTIFICATION_ADDED' });
    }

    return {
      success: true,
      processedFiles: processedFilesCount,
      mappedLeads: totalMappedInSync
    };
  } catch (err) {
    const msg = err.message || '';
    if (!msg.includes('Unexpected close') && !msg.includes('Connection not available') && !msg.includes('Socket timeout')) {
      console.error('[KIWI Email Fetcher] IMAP Error:', msg);
    }
    return { success: false, error: msg };
  }
}

module.exports = {
  checkAndFetchEmails,
  processKiwiMisBuffer,
  getEmailConfig
};
