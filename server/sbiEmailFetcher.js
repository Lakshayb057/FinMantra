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

// Smart Lead Auto-Mapping Core Engine
async function processSbiMisRows(rows, attachmentName, broadcastFn = null) {
  if (!rows || rows.length === 0) {
    return { total: 0, mapped: 0, warnings: 0, matchedDetails: [] };
  }

  // Fetch all leads from PostgreSQL
  const dbLeads = await db.getAllLeadsUnfiltered();
  let mappedCount = 0;
  let warningCount = 0;
  const updates = [];
  const matchedDetails = [];

  // Group DB leads by normalized Name + Date key for SSAA1 fast lookup
  // Key format: "name_dd/mm/yyyy"
  const nameDateLeadMap = new Map();
  dbLeads.forEach(lead => {
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

  // Group DB leads by Application ID / Reference / URN for SSAR1 fast lookup
  const appIdLeadMap = new Map();
  dbLeads.forEach(lead => {
    const appIds = [
      lead.application_id,
      lead.urn,
      lead.mis_data?.APPLICATION_REFERENCE_NUMBER,
      lead.mis_data?.bank_reference_number,
      lead.mis_data?.app_id
    ].filter(Boolean);

    appIds.forEach(id => {
      const cleanId = String(id).trim().toUpperCase();
      if (cleanId) appIdLeadMap.set(cleanId, lead);
    });
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fields = extract44Fields(row);
    
    const gemId1 = (fields.GEMID_1 || fields.LEAD_GEMID_1 || fields.GEMID_2 || '').toUpperCase();
    const isSSAR1 = gemId1.includes('SSAR1') || gemId1.includes('MANUAL') || gemId1.includes('OFFLINE');
    const isSSAA1 = gemId1.includes('SSAA1') || gemId1.includes('DIGITAL') || gemId1.includes('PUBLIC') || !isSSAR1;

    let matchedLead = null;

    // Case 1: SSAR1 (Agent Manual / Offline Leads) -> Lookup via APPLICATION_NUMBER
    if (isSSAR1) {
      const appNo = (fields.APPLICATION_NUMBER || fields.LRN_NUMBER || '').trim().toUpperCase();
      if (appNo && appIdLeadMap.has(appNo)) {
        matchedLead = appIdLeadMap.get(appNo);
      }
    }

    // Case 2: SSAA1 (Digital / Public Meta Leads) -> Lookup via Name + Creation Date
    if (!matchedLead && isSSAA1) {
      const rowName = normalizeName(fields.FULL_NAME);
      const rowDate = normalizeDateStr(fields.LEAD_CREATION_DATE);

      if (rowName && rowDate) {
        const key = `${rowName}_${rowDate}`;
        const matchingLeads = nameDateLeadMap.get(key) || [];

        if (matchingLeads.length === 1) {
          matchedLead = matchingLeads[0];
        } else if (matchingLeads.length > 1) {
          // Multiple leads found with exact same name on same date!
          matchedLead = matchingLeads[0]; // Map to first/newest lead
          warningCount++;

          const warningMessage = `⚠️ Duplicate Name Conflict on SBI MIS Sync: Found ${matchingLeads.length} leads matching name "${fields.FULL_NAME}" created on ${rowDate}. Auto-mapped to lead ID ${matchedLead.urn || matchedLead.id}.`;
          console.warn(`[SBI MIS Auto-Sync] ${warningMessage}`);

          // Create warning alert notification in Admin Notification Center
          await db.createNotification({
            type: 'warning',
            title: '⚠️ Duplicate Lead Name Warning (SBI MIS)',
            message: warningMessage,
            details: {
              attachment: attachmentName,
              fullName: fields.FULL_NAME,
              creationDate: rowDate,
              mappedLeadId: matchedLead.id,
              urn: matchedLead.urn,
              matchingLeadIds: matchingLeads.map(l => l.id)
            }
          });
        }
      }
    }

    // Fallback: Check if application number matches any lead
    if (!matchedLead && fields.APPLICATION_NUMBER) {
      const appNo = String(fields.APPLICATION_NUMBER).trim().toUpperCase();
      if (appIdLeadMap.has(appNo)) {
        matchedLead = appIdLeadMap.get(appNo);
      }
    }

    // If matched, prepare DB update object with all 44 fields
    if (matchedLead) {
      mappedCount++;
      const derivedStatus = mapMisStatus(fields);

      const updatedMisData = {
        ...(matchedLead.mis_data || {}),
        ...fields,
        mis_bank_name: 'SBI',
        mis_file_name: attachmentName,
        mapped_via: isSSAR1 ? 'SSAR1_APP_ID' : 'SSAA1_NAME_DATE'
      };

      updates.push({
        id: matchedLead.id,
        status: derivedStatus,
        data: updatedMisData,
        agent_id: matchedLead.agent_id,
        agent_name: matchedLead.agent_name
      });

      matchedDetails.push({
        urn: matchedLead.urn,
        name: matchedLead.full_name,
        appId: fields.APPLICATION_NUMBER || matchedLead.application_id,
        status: derivedStatus
      });
    }
  }

  // Execute bulk updates in PostgreSQL
  if (updates.length > 0) {
    await db.bulkUpdateLeadMISStatus(updates);
  }

  return {
    total: rows.length,
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

  let totalMappedInSync = 0;
  let totalWarningsInSync = 0;
  let processedFilesCount = 0;

  try {
    console.log(`[SBI Email Fetcher] Connecting to IMAP server for ${config.receiver_email}...`);
    await client.connect();
    
    const lock = await client.getMailboxLock('INBOX');
    try {
      const processedUids = await db.getProcessedEmailUids();

      // Search INBOX for emails from sstechnologies2017@gmail.com
      const messages = client.fetch({ from: config.sender_email }, { uid: true, envelope: true, source: true });
      
      for await (const message of messages) {
        const uidStr = String(message.uid);
        if (processedUids.has(uidStr)) continue; // Skip already processed email

        const subject = message.envelope?.subject || '';
        const isSubjectMatch = config.subject_keywords.some(kw => 
          subject.toLowerCase().includes(kw.toLowerCase())
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
                sender: config.sender_email,
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
                message: `Successfully fetched and mapped ${result.mapped} leads from "${subject}" (${fname}). Duplicate Warnings: ${result.warnings}.`,
                details: { subject, filename: fname, totalRows: result.total, mappedCount: result.mapped, warningCount: result.warnings }
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
    console.error('[SBI Email Fetcher] IMAP Error:', err.message);
    await db.createNotification({
      type: 'error',
      title: '❌ SBI Email MIS Sync Failed',
      message: `Failed to connect to IMAP or process email attachments: ${err.message}`,
      details: { error: err.message }
    });
    return { success: false, error: err.message };
  }
}

module.exports = {
  getEmailConfig,
  checkAndFetchEmails,
  processSbiMisRows,
  extract44Fields
};
