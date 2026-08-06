const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const xlsx = require('xlsx');
const ExcelJS = require('exceljs');
const db = require('./db');

// Default SBI IMAP Email Sync Config
const DEFAULT_CONFIG = {
  receiver_email: 'spikemarketingsolutions25@gmail.com',
  app_password: 'rzoq njtq vpnt difd',
  sender_email: 'sstechnologies2017@gmail.com',
  subject_keywords: ['LG MIS EOD', 'LG MIS 48Hourly', 'LG MIS Hourly'],
  enabled: true
};

async function getEmailConfig() {
  try {
    const configStr = await db.getSetting('email_mis_config');
    if (configStr) {
      const parsed = typeof configStr === 'string' ? JSON.parse(configStr) : configStr;
      return { ...DEFAULT_CONFIG, ...parsed };
    }
    const dbSettings = await db.getSettings();
    if (dbSettings && dbSettings.email_mis_config) {
      const parsed = typeof dbSettings.email_mis_config === 'string' ? JSON.parse(dbSettings.email_mis_config) : dbSettings.email_mis_config;
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (e) {
    console.error('[SBI Email Fetcher] Error loading config from DB:', e.message);
  }
  return DEFAULT_CONFIG;
}

// Normalize strings for matching (e.g., "Lakshay Bansal" -> "lakshay_bansal")
function normalizeName(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_');
}

// Normalize Date to DD/MM/YYYY format
function normalizeDateStr(dateInput) {
  if (!dateInput) return '';
  try {
    let d;
    if (dateInput instanceof Date && !isNaN(dateInput)) {
      d = dateInput;
    } else if (typeof dateInput === 'number') {
      // Excel serial date number
      d = new Date(Math.round((dateInput - 25569) * 86400 * 1000));
    } else {
      const str = String(dateInput).trim();
      // Handle DD/MM/YYYY or YYYY-MM-DD or DD-MM-YYYY
      const parts = str.split(/[/\-\s]/);
      if (parts.length >= 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          // DD/MM/YYYY
          d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      } else {
        d = new Date(str);
      }
    }
    if (!d || isNaN(d.getTime())) return String(dateInput).trim();
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return String(dateInput).trim();
  }
}

// Parse Excel / CSV File Buffer into Objects Array
async function parseAttachmentBuffer(buffer, filename) {
  const rows = [];
  const nameLower = (filename || '').toLowerCase();
  
  if (nameLower.endsWith('.csv') || nameLower.endsWith('.txt')) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    return json;
  } else {
    // Excel file (.xlsx / .xls)
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];
      
      let headers = [];
      worksheet.eachRow((row, rowNumber) => {
        const rowValues = row.values.slice(1).map(val => (val !== null && val !== undefined ? String(val).trim() : ''));
        if (rowNumber === 1) {
          headers = rowValues.map(h => String(h).trim().toUpperCase());
        } else {
          const rowObj = {};
          headers.forEach((h, idx) => {
            if (h) rowObj[h] = rowValues[idx] || '';
          });
          rows.push(rowObj);
        }
      });
      return rows;
    } catch (err) {
      // Fallback to xlsx parser
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      return xlsx.utils.sheet_to_json(sheet, { defval: '' });
    }
  }
}

// Extract the 44 Standard SBI MIS Fields from a Row Object
function extract44Fields(row) {
  const getVal = (...keys) => {
    for (const key of keys) {
      const upperKey = key.toUpperCase();
      for (const rKey in row) {
        if (rKey.toUpperCase() === upperKey) {
          return row[rKey] !== undefined && row[rKey] !== null ? String(row[rKey]).trim() : '';
        }
      }
    }
    return '';
  };

  return {
    SHORT_CODE: getVal('SHORT_CODE', 'SHORTCODE'),
    LG_UID: getVal('LG_UID', 'LGUID', 'LG_ID'),
    FULL_NAME: getVal('FULL_NAME', 'FULLNAME', 'CUSTOMER_NAME', 'NAME'),
    LEAD_CREATION_DATE: getVal('LEAD_CREATION_DATE', 'CREATION_DATE', 'DATE'),
    APPLICATION_NUMBER: getVal('APPLICATION_NUMBER', 'APPLICATION_NO', 'APP_NO', 'APP_ID', 'APPLICATION_ID', 'ARN'),
    LRN_NUMBER: getVal('LRN_NUMBER', 'LRN', 'LRN_NO'),
    CHANNEL_CODE: getVal('CHANNEL_CODE', 'CHANNEL'),
    CARD_TYPE: getVal('CARD_TYPE', 'CARD_NAME', 'CARD_TYPE_NAME'),
    SOURCE_CODE: getVal('SOURCE_CODE', 'SOURCE'),
    APPLICATION_SUBMISSION_DATE: getVal('APPLICATION_SUBMISSION_DATE', 'SUBMISSION_DATE'),
    OCCUPATION_TYPE: getVal('OCCUPATION_TYPE', 'OCCUPATION'),
    COMPANY_CATEGORY: getVal('COMPANY_CATEGORY', 'COMPANY_CAT'),
    SOFT_DECISION_TYPE: getVal('SOFT_DECISION_TYPE', 'SOFT_DECISION'),
    SD_DECISION_CODE: getVal('SD_DECISION_CODE', 'DECISION_CODE'),
    SD_DECISION_DATE: getVal('SD_DECISION_DATE'),
    NO_DOC_FLAG: getVal('NO_DOC_FLAG', 'NODOC_FLAG'),
    STP_FLAG: getVal('STP_FLAG'),
    BLAZE_STP_ELIGIBLE_FLAG: getVal('BLAZE_STP_ELIGIBLE_FLAG', 'BLAZE_STP'),
    KYC_MODE: getVal('KYC_MODE'),
    AML_STATUS: getVal('AML_STATUS'),
    ASSISTED_QUEUE: getVal('ASSISTED_QUEUE'),
    STP_STATUS_SD2: getVal('STP_STATUS_SD2'),
    FINAL_DECISION_DATE: getVal('FINAL_DECISION_DATE'),
    WORK_FLOW_CODE: getVal('WORK_FLOW_CODE'),
    WORK_FLOW_STATUS: getVal('WORK_FLOW_STATUS', 'WORKFLOW_STATUS', 'STATUS'),
    WCP_STAGE: getVal('WCP_STAGE'),
    SALES_STAGE: getVal('SALES_STAGE', 'STAGE'),
    STAGE_IN_WCP: getVal('STAGE_IN_WCP'),
    STAGE_IN_SALES24: getVal('STAGE_IN_SALES24'),
    DECISION_CODE_REASON1_WCP: getVal('DECISION_CODE_REASON1_WCP'),
    DECISION_CODE_REASON1_SALES: getVal('DECISION_CODE_REASON1_SALES'),
    STP_MULTI_FLAG: getVal('STP_MULTI_FLAG'),
    EXISTING_CARD_HOLDER_FLAG: getVal('EXISTING_CARD_HOLDER_FLAG'),
    ACCOUNT_NUMBER_GENERATED: getVal('ACCOUNT_NUMBER_GENERATED'),
    APPL_FILE_SENT_DATE: getVal('APPL_FILE_SENT_DATE'),
    GEMID_1: getVal('GEMID_1', 'GEM_ID_1', 'GEMID1'),
    GEMID_2: getVal('GEMID_2', 'GEM_ID_2', 'GEMID2'),
    LEAD_GEMID_1: getVal('LEAD_GEMID_1', 'LEAD_GEM_ID_1'),
    LEAD_GEMID_2: getVal('LEAD_GEMID_2', 'LEAD_GEM_ID_2'),
    LEAD_SOURCE: getVal('LEAD_SOURCE'),
    PROMO_CODE: getVal('PROMO_CODE'),
    AA_STATUS: getVal('AA_STATUS'),
    REFERENCE_ATTRIBUTES: getVal('REFERENCE_ATTRIBUTES', 'REF_ATTRIBUTES')
  };
}

// Derive Human-readable MIS Status from raw workflow status / sales stage
function mapMisStatus(fields) {
  const rawStatus = (fields.WORK_FLOW_STATUS || fields.SALES_STAGE || fields.SD_DECISION_CODE || fields.WORK_FLOW_CODE || 'Pending').toUpperCase();
  
  if (rawStatus.includes('APPROV') || rawStatus.includes('SANCTION') || rawStatus.includes('ISSUED') || rawStatus.includes('DISBURSED') || rawStatus.includes('SUCCESS')) {
    return 'APPROVED';
  }
  if (rawStatus.includes('REJECT') || rawStatus.includes('DECLIN') || rawStatus.includes('CANCEL') || rawStatus.includes('DROPPED') || rawStatus.includes('FAIL')) {
    return 'REJECTED';
  }
  if (rawStatus.includes('VERIF') || rawStatus.includes('PROCESS') || rawStatus.includes('WIP') || rawStatus.includes('WCP') || rawStatus.includes('STAGE')) {
    return 'IN PROGRESS';
  }
  return fields.WORK_FLOW_STATUS || 'Pending';
}

// Smart Lead Auto-Mapping Core Engine (Sequential 2-Pass Mapping)
async function processSbiMisRows(rows, attachmentName, broadcastFn = null) {
  if (!rows || rows.length === 0) {
    return { total: 0, nonEmptyAppCount: 0, mapped: 0, warnings: 0, matchedDetails: [] };
  }

  // Fetch all leads from PostgreSQL repository
  const dbLeads = await db.getAllLeadsUnfiltered();
  let mappedCount = 0;
  let warningCount = 0;
  const updates = [];
  const matchedDetails = [];

  // Track matched DB lead IDs to prevent double matching
  const matchedLeadIds = new Set();

  // Step 1: Filter MIS rows that have a non-empty APPLICATION_NUMBER or LRN_NUMBER
  const validMisRows = [];
  rows.forEach((row, index) => {
    const fields = extract44Fields(row);
    const appNo = (fields.APPLICATION_NUMBER || fields.LRN_NUMBER || '').trim().toUpperCase();
    if (appNo) {
      validMisRows.push({ rowIndex: index, row, fields, appNo });
    }
  });

  const totalValidRows = validMisRows.length; // Count of non-empty APPLICATION_NUMBER rows (e.g. 591)

  // ==========================================
  // PASS 1: Direct APPLICATION_NUMBER / URN Matching (e.g. 144 mapped)
  // ==========================================
  const unmappedMisRows = [];

  // Index DB leads by application_id, urn, or existing mis_data reference numbers
  const appIdLeadMap = new Map();
  dbLeads.forEach(lead => {
    const ids = [
      lead.application_id,
      lead.urn,
      lead.mis_data?.APPLICATION_NUMBER,
      lead.mis_data?.APPLICATION_REFERENCE_NUMBER,
      lead.mis_data?.bank_reference_number,
      lead.mis_data?.app_id
    ].filter(Boolean);

    ids.forEach(id => {
      const cleanId = String(id).trim().toUpperCase();
      if (cleanId) appIdLeadMap.set(cleanId, lead);
    });
  });

  validMisRows.forEach(item => {
    const { fields, appNo } = item;
    if (appIdLeadMap.has(appNo)) {
      const matchedLead = appIdLeadMap.get(appNo);
      if (!matchedLeadIds.has(matchedLead.id)) {
        matchedLeadIds.add(matchedLead.id);
        mappedCount++;
        const derivedStatus = mapMisStatus(fields);

        const updatedMisData = {
          ...(matchedLead.mis_data || {}),
          ...fields,
          mis_bank_name: 'SBI',
          mis_file_name: attachmentName,
          mapped_via: 'APPLICATION_NUMBER'
        };

        updates.push({
          id: matchedLead.id,
          status: derivedStatus,
          data: updatedMisData,
          agent_id: matchedLead.agent_id,
          agent_name: matchedLead.agent_name,
          application_id: appNo
        });

        matchedDetails.push({
          urn: matchedLead.urn,
          name: matchedLead.full_name,
          appId: appNo,
          status: derivedStatus,
          mappedVia: 'APPLICATION_NUMBER'
        });
      } else {
        unmappedMisRows.push(item);
      }
    } else {
      unmappedMisRows.push(item);
    }
  });

  // ==========================================
  // PASS 2: Fallback Name + Creation Date Matching on Remaining Unmapped Rows (e.g. 591 - 144 = 447 rows)
  // ==========================================
  const unmappedDbLeads = dbLeads.filter(l => !matchedLeadIds.has(l.id));

  // Build Name + Date lookup map for unmapped DB leads
  const nameDateLeadMap = new Map();
  unmappedDbLeads.forEach(lead => {
    const normN = normalizeName(lead.full_name);
    const normD = normalizeDateStr(lead.created_at);
    if (normN && normD) {
      const key = `${normN}_${normD}`;
      if (!nameDateLeadMap.has(key)) {
        nameDateLeadMap.set(key, []);
      }
      nameDateLeadMap.get(key).push(lead);
    }
  });

  for (const item of unmappedMisRows) {
    const { fields, appNo } = item;
    const rowName = normalizeName(fields.FULL_NAME);
    const rowDate = normalizeDateStr(fields.LEAD_CREATION_DATE || fields.SD_DECISION_DATE || fields.APPLICATION_SUBMISSION_DATE);

    let matchedLead = null;
    let mappedVia = '';

    if (rowName) {
      // First attempt: Exact Name + Creation Date match
      if (rowDate) {
        const key = `${rowName}_${rowDate}`;
        const candidates = (nameDateLeadMap.get(key) || []).filter(l => !matchedLeadIds.has(l.id));
        if (candidates.length >= 1) {
          matchedLead = candidates[0];
          mappedVia = 'NAME_DATE_FALLBACK';
          if (candidates.length > 1) {
            warningCount++;
          }
        }
      }

      // Second attempt: Exact Name match among remaining unmapped DB leads if date didn't match
      if (!matchedLead) {
        const candidates = unmappedDbLeads.filter(l => !matchedLeadIds.has(l.id) && normalizeName(l.full_name) === rowName);
        if (candidates.length >= 1) {
          matchedLead = candidates[0];
          mappedVia = 'NAME_FALLBACK';
          if (candidates.length > 1) {
            warningCount++;
          }
        }
      }
    }

    if (matchedLead) {
      matchedLeadIds.add(matchedLead.id);
      mappedCount++;
      const derivedStatus = mapMisStatus(fields);

      const updatedMisData = {
        ...(matchedLead.mis_data || {}),
        ...fields,
        mis_bank_name: 'SBI',
        mis_file_name: attachmentName,
        mapped_via: mappedVia
      };

      // Store Application Number in PostgreSQL repository so it is aligned in DB & Admin Dashboard
      updates.push({
        id: matchedLead.id,
        status: derivedStatus,
        data: updatedMisData,
        agent_id: matchedLead.agent_id,
        agent_name: matchedLead.agent_name,
        application_id: appNo
      });

      matchedDetails.push({
        urn: matchedLead.urn,
        name: matchedLead.full_name,
        appId: appNo,
        status: derivedStatus,
        mappedVia
      });
    }
  }

  // Execute bulk updates in PostgreSQL
  if (updates.length > 0) {
    await db.bulkUpdateLeadMISStatus(updates);
  }

  return {
    total: rows.length,
    nonEmptyAppCount: totalValidRows,
    mapped: mappedCount,
    warnings: warningCount,
    matchedDetails
  };
}

// Check Gmail IMAP and fetch SBI MIS attachments
async function checkAndFetchEmails(broadcastFn = null) {
  const config = await getEmailConfig();
  if (!config.enabled) {
    console.log('[SBI Email Fetcher] Disabled in settings. Skipping IMAP sync.');
    return { success: false, reason: 'Disabled in settings' };
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
    console.error('[SBI Email Fetcher] ImapFlow Client Error:', msg);
  });

  let totalMappedInSync = 0;
  let totalWarningsInSync = 0;
  let processedFilesCount = 0;

  try {
    console.log(`[SBI Email Fetcher] Connecting to IMAP server for ${config.receiver_email}...`);
    await client.connect();
    
    const lock = await client.getMailboxLock('INBOX');
    try {
      const processedUids = await db.getProcessedEmailUids();

      const senderList = (config.sender_email || '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);

      const subjectKeywords = (config.subject_keywords && config.subject_keywords.length > 0)
        ? config.subject_keywords
        : ['LG MIS EOD', 'LG MIS 48Hourly', 'LG MIS Hourly'];

      // Search INBOX for emails from sequence 1 to latest using valid ImapFlow sequence range '1:*'
      const messages = client.fetch('1:*', { uid: true, envelope: true, source: true });
      
      for await (const message of messages) {
        const uidStr = String(message.uid);
        if (processedUids.has(uidStr)) continue; // Skip already processed email

        const senderAddr = (message.envelope?.from?.[0]?.address || '').toLowerCase();
        if (senderList.length > 0) {
          const isSenderAllowed = senderList.some(s => senderAddr.includes(s));
          if (!isSenderAllowed) continue;
        }

        const subject = message.envelope?.subject || '';
        const isSubjectMatch = subjectKeywords.some(kw => 
          subject.toLowerCase().includes(String(kw).toLowerCase())
        );

        if (!isSubjectMatch) continue;

        console.log(`[SBI Email Fetcher] Processing matching email: "${subject}" (UID: ${uidStr})`);

        // Parse full message source for attachments
        const parsed = await simpleParser(message.source);
        if (parsed.attachments && parsed.attachments.length > 0) {
          for (const attachment of parsed.attachments) {
            const fname = attachment.filename || 'sbi_mis.xlsx';
            if (fname.endsWith('.xlsx') || fname.endsWith('.xls') || fname.endsWith('.csv')) {
              console.log(`[SBI Email Fetcher] Extracting attachment: ${fname} (${attachment.size} bytes)`);

              const rows = await parseAttachmentBuffer(attachment.content, fname);
              const result = await processSbiMisRows(rows, fname, broadcastFn);

              totalMappedInSync += result.mapped;
              totalWarningsInSync += result.warnings;
              processedFilesCount++;

              // Record in processed email log
              await db.saveProcessedEmailMis({
                message_uid: uidStr,
                subject,
                sender: senderAddr || config.sender_email,
                attachment_name: fname,
                total_processed: result.total,
                mapped_count: result.mapped,
                warning_count: result.warnings
              });
              
              // Create Per-File Notification
              let reportName = 'SBI MIS';
              const subjectLower = subject.toLowerCase();
              if (subjectLower.includes('48hourly') || subjectLower.includes('48 hourly')) {
                reportName = '48Hourly MIS';
              } else if (subjectLower.includes('hourly')) {
                reportName = 'Hourly MIS';
              } else if (subjectLower.includes('eod')) {
                reportName = 'EOD MIS';
              }
              
              await db.createNotification({
                type: result.warnings > 0 ? 'warning' : 'success',
                title: `🎉 ${reportName} Sync Completed`,
                message: `Successfully fetched and mapped ${result.mapped} leads from "${subject}" (${fname}). Total rows: ${result.total}, Valid App Rows: ${result.nonEmptyAppCount}. Duplicate Warnings: ${result.warnings}.`,
                details: {
                  subject,
                  filename: fname,
                  totalRows: result.total,
                  nonEmptyAppCount: result.nonEmptyAppCount,
                  mappedCount: result.mapped,
                  warningCount: result.warnings
                }
              });
            }
          }
        }

        // Add to processed set in memory
        processedUids.add(uidStr);
      }

    } finally {
      lock.release();
    }

    await client.logout();

    // Broadcast updates if files were processed
    if (processedFilesCount > 0) {
      if (broadcastFn) {
        broadcastFn({ type: 'MIS_UPDATED' });
        broadcastFn({ type: 'LEADS_UPDATED' });
        broadcastFn({ type: 'NOTIFICATION_ADDED' });
      }
    }

    return {
      success: true,
      processedFiles: processedFilesCount,
      mappedLeads: totalMappedInSync,
      warnings: totalWarningsInSync
    };

  } catch (err) {
    const msg = err.message || '';
    if (!msg.includes('Unexpected close') && !msg.includes('Connection not available') && !msg.includes('Socket timeout')) {
      console.error('[SBI Email Fetcher] IMAP Error:', msg);
    }
    return { success: false, error: msg };
  }
}

module.exports = {
  getEmailConfig,
  checkAndFetchEmails,
  processSbiMisRows,
  extract44Fields
};
