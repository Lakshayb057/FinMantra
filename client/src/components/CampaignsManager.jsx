import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Mail, MessageSquare, Plus, Trash2, Search, Upload, RefreshCw, X, Check,
  AlertCircle, Download, FileSpreadsheet, Play, Settings as SettingsIcon, HelpCircle, Info, Zap, Database, FileText,
  Clock, Edit2, Lock, BarChart3, TrendingUp, Filter, Eye, CheckCircle2, XCircle, ChevronRight, Calendar, PhoneCall,
  Share2, ArrowUpRight, ShieldCheck, CheckCheck, Send
} from 'lucide-react';

export default function CampaignsManager({ theme, API_URL, token, showToast }) {
  const [activeSubTab, setActiveSubTab] = useState('communication_dashboard'); // 'communication_dashboard' | 'master_data' | 'broadcast' | 'templates' | 'settings' | 'guide'
  
  // Meta Phone Numbers (WhatsApp senders with quality ratings)
  const [metaPhoneNumbers, setMetaPhoneNumbers] = useState([]);
  const [isLoadingPhoneNumbers, setIsLoadingPhoneNumbers] = useState(false);

  // Communication Dashboard state
  const [dashboardAnalytics, setDashboardAnalytics] = useState(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [dashFilterDateFrom, setDashFilterDateFrom] = useState('');
  const [dashFilterDateTo, setDashFilterDateTo] = useState('');
  const [dashFilterBroadcastName, setDashFilterBroadcastName] = useState('');
  const [dashFilterMetaWaNo, setDashFilterMetaWaNo] = useState('');
  const [dashFilterSenderEmail, setDashFilterSenderEmail] = useState('');

  // Templates Manager state
  const [templates, setTemplates] = useState([]);
  const [metaStatuses, setMetaStatuses] = useState({});
  const [isSyncingMeta, setIsSyncingMeta] = useState(false);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [templateTargetPhoneId, setTemplateTargetPhoneId] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [newTemplateForm, setNewTemplateForm] = useState({
    name: '',
    type: 'whatsapp',
    subject: '',
    body: '',
    metaTemplateName: '',
    category: 'MARKETING', // 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
    language: 'en_US',
    headerFormat: 'NONE', // 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
    headerText: '',
    headerSample: '',
    mediaUrl: '',
    footerText: '',
    bodySampleValues: {},
    buttons: {
      buttonType: 'NONE', // 'NONE' | 'CTA' | 'QUICK_REPLIES' | 'OTP'
      ctaUrlText: '',
      ctaUrlValue: '',
      ctaUrlSample: '',
      ctaUrl2Text: '',
      ctaUrl2Value: '',
      ctaUrl2Sample: '',
      ctaPhoneText: '',
      ctaPhoneValue: '',
      quickReplies: ['Interested', 'Apply Now', 'Talk to Agent'],
      otpType: 'COPY_CODE',
      otpText: 'Copy Code'
    }
  });
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  // Master Data Center state
  const [masterContacts, setMasterContacts] = useState([]);
  const [masterTotal, setMasterTotal] = useState(0);
  const [masterPage, setMasterPage] = useState(1);
  const [masterLimit, setMasterLimit] = useState(50);
  const [isLoadingMaster, setIsLoadingMaster] = useState(false);
  const [masterSearch, setMasterSearch] = useState('');
  const [masterFilterBroadcastName, setMasterFilterBroadcastName] = useState('');
  const [masterFilterDateFrom, setMasterFilterDateFrom] = useState('');
  const [masterFilterDateTo, setMasterFilterDateTo] = useState('');
  const [masterFilterMetaWaNo, setMasterFilterMetaWaNo] = useState('');
  const [masterFilterSenderEmail, setMasterFilterSenderEmail] = useState('');
  const [masterFilterOptions, setMasterFilterOptions] = useState({ broadcastNames: [], metaWhatsappNos: [], senderEmails: [] });
  const [selectedMasterDeleteIds, setSelectedMasterDeleteIds] = useState(new Set());

  // Broadcasts list & direct creation state
  const [broadcasts, setBroadcasts] = useState([]);
  const [isLoadingBroadcasts, setIsLoadingBroadcasts] = useState(false);
  const [showNewBroadcastModal, setShowNewBroadcastModal] = useState(false);
  const [editingBroadcastId, setEditingBroadcastId] = useState(null);
  const [broadcastWizardStep, setBroadcastWizardStep] = useState(1); // 1: Info, 2: Channel, 3: Template, 4: Data Upload, 5: Preview, 6: Send/Schedule
  const [isSubmittingBroadcast, setIsSubmittingBroadcast] = useState(false);

  const [broadcastForm, setBroadcastForm] = useState({
    name: '',
    channel: 'whatsapp', // 'whatsapp' | 'email' | 'both'
    meta_phone_number_id: '',
    meta_phone_number: '',
    sender_email: '',
    smtp_account_id: '',
    whatsapp_template: '',
    whatsapp_message: '',
    email_subject: '',
    email_body: '',
    scheduled_at: '',
    media_url: ''
  });

  // Uploaded contacts inside the broadcast creation modal
  const [broadcastUploadFile, setBroadcastUploadFile] = useState(null);
  const [broadcastParsedLeads, setBroadcastParsedLeads] = useState([]);
  const [broadcastUploadStats, setBroadcastUploadStats] = useState(null);
  const [broadcastUploadError, setBroadcastUploadError] = useState('');

  // Delivery Logs Modal state
  const [viewingLogsBroadcast, setViewingLogsBroadcast] = useState(null);
  const [broadcastLogs, setBroadcastLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isSyncingMetaTemplates, setIsSyncingMetaTemplates] = useState(false);

  // Multi-SMTP Accounts state
  const [smtpAccounts, setSmtpAccounts] = useState([]);
  const [isLoadingSmtpAccounts, setIsLoadingSmtpAccounts] = useState(false);
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [editingSmtpAccount, setEditingSmtpAccount] = useState(null);
  const [isSavingSmtpAccount, setIsSavingSmtpAccount] = useState(false);
  const [testingSmtpAccountId, setTestingSmtpAccountId] = useState(null);
  const [isTestingModalSmtp, setIsTestingModalSmtp] = useState(false);
  const [smtpAccountForm, setSmtpAccountForm] = useState({
    name: '',
    host: 'smtp.gmail.com',
    port: '465',
    username: '',
    password: '',
    secure: 'true',
    fromName: 'FinMantra',
    fromEmail: '',
    isDefault: false
  });

  // Legacy single SMTP Settings state
  const [smtpSettings, setSmtpSettings] = useState({
    host: '',
    port: '465',
    user: '',
    pass: '',
    secure: 'true',
    fromName: 'FinMantra',
    fromEmail: ''
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [nowTime, setNowTime] = useState(Date.now());

  // 1-second ticker for live reverse countdown timers
  useEffect(() => {
    const timerInterval = setInterval(() => setNowTime(Date.now()), 1000);
    return () => clearInterval(timerInterval);
  }, []);

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }), [token]);

  // Initial load
  useEffect(() => {
    fetchMetaPhoneNumbers();
    fetchCommunicationAnalytics();
    fetchMasterFilterOptions();
    fetchMasterLeads();
    fetchBroadcasts();
    fetchTemplates();
    fetchGlobalSettings();
    fetchSmtpAccounts();
  }, []);

  // Poll active broadcasts
  useEffect(() => {
    const hasActive = broadcasts.some(b => b.status === 'scheduled' || b.status === 'processing');
    if (hasActive) {
      const pollInterval = setInterval(() => {
        fetchBroadcasts(true);
        if (activeSubTab === 'communication_dashboard') {
          fetchCommunicationAnalytics(true);
        }
      }, 4000);
      return () => clearInterval(pollInterval);
    }
  }, [broadcasts, activeSubTab]);

  // Reload master leads when master filters change
  useEffect(() => {
    if (activeSubTab === 'master_data') {
      fetchMasterLeads();
    }
  }, [masterPage, masterFilterBroadcastName, masterFilterDateFrom, masterFilterDateTo, masterFilterMetaWaNo, masterFilterSenderEmail]);

  // Reload communication analytics when dashboard filters change
  useEffect(() => {
    if (activeSubTab === 'communication_dashboard') {
      fetchCommunicationAnalytics();
    }
  }, [dashFilterDateFrom, dashFilterDateTo, dashFilterBroadcastName, dashFilterMetaWaNo, dashFilterSenderEmail]);

  // --- API CALLS ---

  const fetchMetaPhoneNumbers = async () => {
    setIsLoadingPhoneNumbers(true);
    try {
      const res = await fetch(`${API_URL}/whatsapp/meta-phone-numbers`, { headers });
      const data = await res.json();
      if (data.phoneNumbers && Array.isArray(data.phoneNumbers)) {
        setMetaPhoneNumbers(data.phoneNumbers);
        if (data.phoneNumbers.length > 0 && !broadcastForm.meta_phone_number_id) {
          setBroadcastForm(prev => ({
            ...prev,
            meta_phone_number_id: data.phoneNumbers[0].id,
            meta_phone_number: data.phoneNumbers[0].display_phone_number || ''
          }));
          setTemplateTargetPhoneId(data.phoneNumbers[0].id);
        }
      }
    } catch (err) {
      console.warn('[Fetch Meta Phones Error]:', err.message);
    } finally {
      setIsLoadingPhoneNumbers(false);
    }
  };

  const fetchCommunicationAnalytics = async (silent = false) => {
    if (!silent) setIsLoadingAnalytics(true);
    try {
      const query = new URLSearchParams();
      if (dashFilterDateFrom) query.append('date_from', dashFilterDateFrom);
      if (dashFilterDateTo) query.append('date_to', dashFilterDateTo);
      if (dashFilterBroadcastName) query.append('broadcast_name', dashFilterBroadcastName);
      if (dashFilterMetaWaNo) query.append('meta_whatsapp_no', dashFilterMetaWaNo);
      if (dashFilterSenderEmail) query.append('sender_email', dashFilterSenderEmail);

      const res = await fetch(`${API_URL}/campaigns/analytics/dashboard?${query.toString()}`, { headers });
      const data = await res.json();
      if (data.success && data.analytics) {
        setDashboardAnalytics(data.analytics);
      }
    } catch (err) {
      console.error('[Dashboard Analytics Error]:', err.message);
    } finally {
      if (!silent) setIsLoadingAnalytics(false);
    }
  };

  const fetchMasterFilterOptions = async () => {
    try {
      const res = await fetch(`${API_URL}/campaigns/master/filter-options`, { headers });
      const data = await res.json();
      if (data.success && data.options) {
        setMasterFilterOptions(data.options);
      }
    } catch (err) {
      console.warn('[Filter options error]:', err.message);
    }
  };

  const fetchMasterLeads = async () => {
    setIsLoadingMaster(true);
    try {
      const query = new URLSearchParams();
      if (masterSearch) query.append('search', masterSearch);
      if (masterFilterBroadcastName) query.append('broadcast_name', masterFilterBroadcastName);
      if (masterFilterDateFrom) query.append('broadcast_date_from', masterFilterDateFrom);
      if (masterFilterDateTo) query.append('broadcast_date_to', masterFilterDateTo);
      if (masterFilterMetaWaNo) query.append('meta_whatsapp_no', masterFilterMetaWaNo);
      if (masterFilterSenderEmail) query.append('sender_email', masterFilterSenderEmail);
      query.append('page', masterPage);
      query.append('limit', masterLimit);

      const res = await fetch(`${API_URL}/campaigns/master/leads?${query.toString()}`, { headers });
      const data = await res.json();
      if (data.success) {
        setMasterContacts(data.leads || []);
        setMasterTotal(data.total || 0);
      }
    } catch (err) {
      console.error('[Fetch Master Leads Error]:', err.message);
      showToast('Failed to load master records.', 'error');
    } finally {
      setIsLoadingMaster(false);
    }
  };

  const fetchBroadcasts = async (silent = false) => {
    if (!silent) setIsLoadingBroadcasts(true);
    try {
      const res = await fetch(`${API_URL}/campaigns/broadcasts/all`, { headers });
      const data = await res.json();
      if (data.success) {
        setBroadcasts(data.broadcasts || []);
      }
    } catch (err) {
      console.warn('[Fetch Broadcasts Error]:', err.message);
    } finally {
      if (!silent) setIsLoadingBroadcasts(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${API_URL}/campaigns/templates`, { headers });
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.warn('[Fetch Templates Error]:', err.message);
    }
  };

  const fetchGlobalSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/settings`, { headers });
      const data = await res.json();
      const s = data.settings || data || {};
      setSmtpSettings({
        host: s.campaign_smtp_host || '',
        port: s.campaign_smtp_port || '465',
        user: s.campaign_smtp_user || '',
        pass: s.campaign_smtp_pass || '',
        secure: s.campaign_smtp_secure !== undefined ? String(s.campaign_smtp_secure) : 'true',
        fromName: s.campaign_smtp_from_name || 'FinMantra',
        fromEmail: s.campaign_smtp_from_email || 'no-reply@finmantra.com'
      });
      if (!broadcastForm.sender_email && s.campaign_smtp_from_email) {
        setBroadcastForm(prev => ({ ...prev, sender_email: s.campaign_smtp_from_email }));
      }
    } catch (err) {
      console.warn('[Fetch Settings Error]:', err.message);
    }
  };

  // Multi-SMTP Account Handlers
  const fetchSmtpAccounts = async () => {
    setIsLoadingSmtpAccounts(true);
    try {
      const res = await fetch(`${API_URL}/settings/smtp-accounts`, { headers });
      const data = await res.json();
      if (data.success) {
        setSmtpAccounts(data.accounts || []);
        const defaultAcc = data.accounts.find(a => a.is_default) || data.accounts[0];
        if (defaultAcc && !broadcastForm.smtp_account_id) {
          setBroadcastForm(prev => ({
            ...prev,
            smtp_account_id: defaultAcc.id,
            sender_email: prev.sender_email || defaultAcc.from_email
          }));
        }
      }
    } catch (err) {
      console.warn('[Fetch SMTP Accounts Error]:', err.message);
    } finally {
      setIsLoadingSmtpAccounts(false);
    }
  };

  const handleOpenAddSmtpModal = () => {
    setEditingSmtpAccount(null);
    setSmtpAccountForm({
      name: '',
      host: 'smtp.gmail.com',
      port: '465',
      username: '',
      password: '',
      secure: 'true',
      fromName: 'FinMantra',
      fromEmail: '',
      isDefault: smtpAccounts.length === 0
    });
    setShowSmtpModal(true);
  };

  const handleOpenEditSmtpModal = (account) => {
    setEditingSmtpAccount(account);
    setSmtpAccountForm({
      name: account.name || '',
      host: account.host || '',
      port: String(account.port || '465'),
      username: account.username || '',
      password: '', // blank to preserve
      secure: String(account.secure ?? 'true'),
      fromName: account.from_name || 'FinMantra',
      fromEmail: account.from_email || '',
      isDefault: !!account.is_default
    });
    setShowSmtpModal(true);
  };

  const handleSaveSmtpAccountModal = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!smtpAccountForm.name.trim() || !smtpAccountForm.host.trim() || !smtpAccountForm.username.trim() || !smtpAccountForm.fromEmail.trim()) {
      showToast('Please fill all mandatory fields (Name, Host, Username, From Email).', 'error');
      return;
    }
    if (!editingSmtpAccount && !smtpAccountForm.password.trim()) {
      showToast('Password is required for new SMTP account.', 'error');
      return;
    }

    setIsSavingSmtpAccount(true);
    try {
      const url = editingSmtpAccount 
        ? `${API_URL}/settings/smtp-accounts/${editingSmtpAccount.id}`
        : `${API_URL}/settings/smtp-accounts`;
      const method = editingSmtpAccount ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(smtpAccountForm)
      });
      const data = await res.json();
      if (data.success) {
        showToast(`SMTP account "${smtpAccountForm.name}" saved successfully!`, 'success');
        setShowSmtpModal(false);
        fetchSmtpAccounts();
      } else {
        showToast(data.error || 'Failed to save SMTP account.', 'error');
      }
    } catch (err) {
      showToast('Network error saving SMTP account.', 'error');
    } finally {
      setIsSavingSmtpAccount(false);
    }
  };

  const handleDeleteSmtpAccount = async (id, name) => {
    if (!window.confirm(`Delete SMTP account "${name}"? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_URL}/settings/smtp-accounts/${id}`, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      if (data.success) {
        showToast(`SMTP account "${name}" deleted.`, 'info');
        fetchSmtpAccounts();
      } else {
        showToast(data.error || 'Failed to delete SMTP account.', 'error');
      }
    } catch (err) {
      showToast('Network error deleting SMTP account.', 'error');
    }
  };

  const handleSetDefaultSmtpAccount = async (id, name) => {
    try {
      const res = await fetch(`${API_URL}/settings/smtp-accounts/${id}/set-default`, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (data.success) {
        showToast(`"${name}" is now the default primary outbound SMTP account.`, 'success');
        fetchSmtpAccounts();
      } else {
        showToast(data.error || 'Failed to set default.', 'error');
      }
    } catch (err) {
      showToast('Network error setting default SMTP.', 'error');
    }
  };

  const handleTestSpecificSmtp = async (account) => {
    setTestingSmtpAccountId(account.id);
    try {
      const res = await fetch(`${API_URL}/settings/test-smtp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ accountId: account.id })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'SMTP Connection Verified Successfully!', 'success');
      } else {
        showToast(data.error || 'SMTP Connection Test Failed.', 'error');
      }
    } catch (err) {
      showToast('Network error while testing SMTP connection.', 'error');
    } finally {
      setTestingSmtpAccountId(null);
    }
  };

  const handleTestModalSmtp = async () => {
    setIsTestingModalSmtp(true);
    try {
      const res = await fetch(`${API_URL}/settings/test-smtp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          accountId: editingSmtpAccount && !smtpAccountForm.password ? editingSmtpAccount.id : undefined,
          host: smtpAccountForm.host,
          port: smtpAccountForm.port,
          user: smtpAccountForm.username,
          pass: smtpAccountForm.password,
          secure: smtpAccountForm.secure,
          fromName: smtpAccountForm.fromName,
          fromEmail: smtpAccountForm.fromEmail,
          testRecipient: smtpAccountForm.fromEmail || smtpAccountForm.username
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'SMTP Connection Verified Successfully!', 'success');
      } else {
        showToast(data.error || 'SMTP Connection Test Failed.', 'error');
      }
    } catch (err) {
      showToast('Network error while testing SMTP connection.', 'error');
    } finally {
      setIsTestingModalSmtp(false);
    }
  };

  const handleExportMasterData = () => {
    const query = new URLSearchParams();
    if (masterSearch) query.append('search', masterSearch);
    if (masterFilterBroadcastName) query.append('broadcast_name', masterFilterBroadcastName);
    if (masterFilterDateFrom) query.append('broadcast_date_from', masterFilterDateFrom);
    if (masterFilterDateTo) query.append('broadcast_date_to', masterFilterDateTo);
    if (masterFilterMetaWaNo) query.append('meta_whatsapp_no', masterFilterMetaWaNo);
    if (masterFilterSenderEmail) query.append('sender_email', masterFilterSenderEmail);

    const exportUrl = `${API_URL}/campaigns/master/leads/export?${query.toString()}`;
    window.open(exportUrl, '_blank');
    showToast('Exporting master data with delivery rates & CTR...', 'info');
  };

  const handleToggleMasterLeadOptin = async (leadId, channel, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      const res = await fetch(`${API_URL}/campaigns/master-leads/${leadId}/toggle-optin`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ channel, optin: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        setMasterContacts(prev => prev.map(c => {
          if (c.id === leadId) {
            return {
              ...c,
              [channel === 'whatsapp' ? 'whatsapp_optin' : 'email_optin']: newStatus
            };
          }
          return c;
        }));
        showToast(`${channel === 'whatsapp' ? 'WhatsApp' : 'Email'} status updated to ${newStatus ? 'Opted-In' : 'Opted-Out'}.`, 'success');
      }
    } catch (err) {
      showToast('Failed to update opt-in status.', 'error');
    }
  };

  const handleDeleteMasterBulk = async () => {
    const ids = Array.from(selectedMasterDeleteIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete these ${ids.length} contacts permanently from Master Data Center?`)) return;

    try {
      const res = await fetch(`${API_URL}/campaigns/master/leads/delete-bulk`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ leadIds: ids })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Successfully deleted ${data.deletedCount} contacts.`, 'success');
        setSelectedMasterDeleteIds(new Set());
        fetchMasterLeads();
        fetchMasterFilterOptions();
      } else {
        showToast(data.error || 'Bulk delete failed.', 'error');
      }
    } catch (err) {
      showToast('Network error during bulk delete.', 'error');
    }
  };

  // Download Sample Broadcast Template with FMCB00001 ID column
  const handleDownloadSampleTemplate = () => {
    // Detect custom template variables
    let extraCols = [];
    if (broadcastForm.whatsapp_template) {
      const t = templates.find(item => item.name === broadcastForm.whatsapp_template || item.meta_template_name === broadcastForm.whatsapp_template);
      if (t) {
        const matches = [...t.body.matchAll(/\{\{(\d+)\}\}/g)];
        const nums = matches.map(m => parseInt(m[1], 10));
        const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
        for (let i = 1; i <= maxNum; i++) {
          extraCols.push(`var${i}`);
        }
      }
    }

    const headersList = ['id', 'name', 'contact', 'mail', 'address', ...extraCols];
    const sampleRow = ['FMCB00001', 'Rahul Sharma', '919876543210', 'rahul.sharma@example.com', 'Mumbai, Maharashtra', ...extraCols.map((_, i) => `Value ${i + 1}`)];
    const sampleRow2 = ['FMCB00002', 'Priya Patel', '919812345678', 'priya.patel@example.com', 'Ahmedabad, Gujarat', ...extraCols.map((_, i) => `Value ${i + 1}`)];

    const csvContent = [
      headersList.map(h => `"${h}"`).join(','),
      sampleRow.map(v => `"${v}"`).join(','),
      sampleRow2.map(v => `"${v}"`).join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `finmantra_broadcast_template_${broadcastForm.whatsapp_template || 'sample'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse Uploaded CSV / Excel for Broadcast
  const handleBroadcastFileUpload = (file) => {
    if (!file) return;
    setBroadcastUploadFile(file);
    setBroadcastUploadError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        // Simple CSV parser for client preview
        const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) {
          setBroadcastUploadError('The uploaded file contains no data rows.');
          return;
        }

        const rawHeaders = lines[0].split(',').map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
        const idIdx = rawHeaders.findIndex(h => h === 'id' || h === 'campaign id' || h === 'campaign_id');
        const nameIdx = rawHeaders.findIndex(h => h === 'name' || h === 'full name' || h === 'full_name');
        const contactIdx = rawHeaders.findIndex(h => h === 'contact' || h === 'phone' || h === 'mobile' || h === 'number');
        const mailIdx = rawHeaders.findIndex(h => h === 'mail' || h === 'email');
        const addressIdx = rawHeaders.findIndex(h => h === 'address' || h === 'city' || h === 'location');

        const parsed = [];
        let autoIdCounter = 1;

        for (let i = 1; i < lines.length; i++) {
          const rowVals = lines[i].split(',').map(v => v.replace(/^["']|["']$/g, '').trim());
          let rawId = idIdx !== -1 ? rowVals[idIdx] : '';
          
          // ID Logic: If empty, give it id as "FMCB00001" and so on
          if (!rawId || !rawId.startsWith('FMCB')) {
            rawId = `FMCB${String(autoIdCounter).padStart(5, '0')}`;
          }
          autoIdCounter++;

          const name = nameIdx !== -1 ? rowVals[nameIdx] : 'Customer';
          const rawContact = contactIdx !== -1 ? rowVals[contactIdx] : '';
          const contact = rawContact.replace(/\D/g, '');
          const mail = mailIdx !== -1 ? rowVals[mailIdx] : '';
          const address = addressIdx !== -1 ? rowVals[addressIdx] : '';

          parsed.push({ id: rawId, name, contact, mail, address, rawRow: rowVals });
        }

        setBroadcastParsedLeads(parsed);
        setBroadcastUploadStats({
          totalRows: parsed.length,
          validContacts: parsed.filter(p => p.contact && p.contact.length >= 10).length,
          validEmails: parsed.filter(p => p.mail && p.mail.includes('@')).length
        });
      } catch (err) {
        setBroadcastUploadError('Failed to parse file. Please upload a standard CSV format.');
      }
    };
    reader.readAsText(file);
  };

  // Open Edit Broadcast Modal
  const handleEditBroadcast = (b) => {
    setEditingBroadcastId(b.id);
    setBroadcastForm({
      name: b.name || '',
      channel: b.channel || 'whatsapp',
      meta_phone_number_id: b.meta_phone_number_id || '',
      meta_phone_number: b.meta_phone_number || '',
      sender_email: b.sender_email || '',
      smtp_account_id: b.smtp_account_id || '',
      whatsapp_template: b.whatsapp_template || '',
      whatsapp_message: b.whatsapp_message || '',
      email_subject: b.email_subject || '',
      email_body: b.email_body || '',
      scheduled_at: b.scheduled_at ? new Date(b.scheduled_at).toISOString().slice(0, 16) : '',
      media_url: b.media_url || ''
    });
    setBroadcastUploadFile(null);
    setBroadcastParsedLeads([]);
    setBroadcastWizardStep(1);
    setShowNewBroadcastModal(true);
  };

  // Submit Broadcast Dispatch / Edit / Schedule
  const handleSubmitDirectBroadcast = async () => {
    if (!broadcastForm.name.trim()) {
      showToast('Please enter a Broadcast Name.', 'error');
      setBroadcastWizardStep(1);
      return;
    }

    if (editingBroadcastId) {
      // Handle Edit Update
      setIsSubmittingBroadcast(true);
      try {
        const res = await fetch(`${API_URL}/campaigns/broadcasts/${editingBroadcastId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(broadcastForm)
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Broadcast "${broadcastForm.name}" updated successfully!`, 'success');
          setShowNewBroadcastModal(false);
          setEditingBroadcastId(null);
          setBroadcastWizardStep(1);
          fetchBroadcasts();
          fetchCommunicationAnalytics();
        } else {
          showToast(data.error || 'Failed to update broadcast.', 'error');
        }
      } catch (err) {
        showToast('Network error while updating broadcast.', 'error');
      } finally {
        setIsSubmittingBroadcast(false);
      }
      return;
    }

    if (!broadcastUploadFile && broadcastParsedLeads.length === 0) {
      showToast('Please upload customer contacts data.', 'error');
      setBroadcastWizardStep(4);
      return;
    }

    setIsSubmittingBroadcast(true);
    try {
      const formData = new FormData();
      formData.append('name', broadcastForm.name.trim());
      formData.append('channel', broadcastForm.channel);
      formData.append('meta_phone_number_id', broadcastForm.meta_phone_number_id);
      formData.append('meta_phone_number', broadcastForm.meta_phone_number);
      formData.append('sender_email', broadcastForm.sender_email);
      formData.append('whatsapp_template', broadcastForm.whatsapp_template);
      formData.append('whatsapp_message', broadcastForm.whatsapp_message);
      formData.append('email_subject', broadcastForm.email_subject);
      formData.append('email_body', broadcastForm.email_body);
      formData.append('media_url', broadcastForm.media_url);
      if (broadcastForm.scheduled_at) {
        formData.append('scheduled_at', broadcastForm.scheduled_at);
      }

      if (broadcastUploadFile) {
        formData.append('file', broadcastUploadFile);
      } else {
        formData.append('leads', JSON.stringify(broadcastParsedLeads));
      }

      const res = await fetch(`${API_URL}/campaigns/broadcasts/direct`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const stats = data.masterStats || {};
        showToast(`Broadcast "${broadcastForm.name}" created! ${stats.totalProcessed || broadcastParsedLeads.length} contacts merged to Master Data without duplicates.`, 'success');
        setShowNewBroadcastModal(false);
        setBroadcastWizardStep(1);
        setBroadcastUploadFile(null);
        setBroadcastParsedLeads([]);
        fetchBroadcasts();
        fetchMasterLeads();
        fetchMasterFilterOptions();
        fetchCommunicationAnalytics();
      } else {
        showToast(data.error || 'Failed to dispatch broadcast.', 'error');
      }
    } catch (err) {
      showToast('Network error while dispatching broadcast.', 'error');
    } finally {
      setIsSubmittingBroadcast(false);
    }
  };

  // Trigger manual immediate send
  const handleTriggerBroadcastNow = async (broadcastId) => {
    if (!window.confirm('Trigger this broadcast immediately to all targeted contacts?')) return;
    try {
      const res = await fetch(`${API_URL}/campaigns/id/broadcasts/${broadcastId}/trigger`, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (data.success) {
        showToast('Broadcast triggered! Processing in background.', 'success');
        fetchBroadcasts();
      } else {
        showToast(data.error || 'Failed to trigger broadcast.', 'error');
      }
    } catch (err) {
      showToast('Network error triggering broadcast.', 'error');
    }
  };

  // Delete broadcast
  const handleDeleteBroadcast = async (broadcastId, broadcastName = 'Broadcast') => {
    if (!window.confirm(`Are you sure you want to permanently delete the broadcast "${broadcastName}"?`)) return;
    try {
      const res = await fetch(`${API_URL}/campaigns/broadcasts/${broadcastId}`, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      if (data.success) {
        showToast('Broadcast deleted successfully.', 'info');
        fetchBroadcasts();
        fetchCommunicationAnalytics();
      } else {
        showToast(data.error || 'Failed to delete broadcast.', 'error');
      }
    } catch (err) {
      showToast('Network error while deleting broadcast.', 'error');
    }
  };

  // View detailed broadcast delivery logs
  const handleOpenBroadcastLogs = async (b) => {
    setViewingLogsBroadcast(b);
    setIsLoadingLogs(true);
    setBroadcastLogs([]);
    try {
      const res = await fetch(`${API_URL}/campaigns/broadcasts/${b.id}/logs`, { headers });
      const data = await res.json();
      if (data.success) {
        setBroadcastLogs(data.logs || []);
      } else {
        showToast(data.error || 'Failed to load delivery logs.', 'error');
      }
    } catch (err) {
      showToast('Network error fetching logs.', 'error');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Helper for Quality Rating badge colors
  const getQualityRatingBadge = (rating) => {
    const r = String(rating || '').toUpperCase();
    if (r === 'GREEN' || r === 'HIGH') {
      return <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(22, 163, 123, 0.15)', color: '#16a37b', fontSize: '0.72rem', fontWeight: 700 }}>Quality: High (Green)</span>;
    }
    if (r === 'YELLOW' || r === 'MEDIUM') {
      return <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(224, 168, 46, 0.15)', color: 'var(--gold-deep)', fontSize: '0.72rem', fontWeight: 700 }}>Quality: Medium (Yellow)</span>;
    }
    if (r === 'RED' || r === 'LOW') {
      return <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.72rem', fontWeight: 700 }}>Quality: Low (Red)</span>;
    }
    return <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(150, 150, 150, 0.15)', color: 'var(--muted)', fontSize: '0.72rem', fontWeight: 700 }}>Quality: {rating || 'Standard'}</span>;
  };

  // Helper for Template Variable Preview replacement
  const getRenderedTemplatePreview = () => {
    if (!broadcastForm.whatsapp_template) return 'Please select a template to preview message.';
    const t = templates.find(item => item.name === broadcastForm.whatsapp_template || item.meta_template_name === broadcastForm.whatsapp_template);
    if (!t) return broadcastForm.whatsapp_message || 'Template selected';

    let text = t.body || '';
    const sampleLead = broadcastParsedLeads[0] || { name: 'Rahul Sharma', contact: '919876543210', mail: 'rahul@example.com' };
    text = text.replace(/\{\{1\}\}/g, sampleLead.name || 'Rahul Sharma')
               .replace(/\{\{2\}\}/g, broadcastForm.whatsapp_message || 'FinMantra Offer')
               .replace(/\{name\}/gi, sampleLead.name || 'Rahul Sharma')
               .replace(/\{contact\}/gi, sampleLead.contact || '919876543210');
    return text;
  };

  return (
    <div className="campaigns-container">
      {/* Top Header / Actions Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem', flexShrink: 0 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={22} style={{ color: 'var(--gold-deep)' }} />
            OmniChannel Campaigns &amp; Broadcast Center
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
            Direct Meta WhatsApp &amp; SMTP broadcast dispatch, unified master repository, and real-time delivery analytics.
          </p>
        </div>
      </div>

      {/* Subtab Navigation Bar */}
      <div className="campaigns-subnav">
        <button
          onClick={() => setActiveSubTab('communication_dashboard')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.86rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeSubTab === 'communication_dashboard' ? 'var(--gold-deep)' : 'transparent',
            color: activeSubTab === 'communication_dashboard' ? '#fff' : 'var(--muted)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <BarChart3 size={15} style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
          Communication Dashboard
        </button>

        <button
          onClick={() => setActiveSubTab('master_data')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.86rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeSubTab === 'master_data' ? 'var(--gold-deep)' : 'transparent',
            color: activeSubTab === 'master_data' ? '#fff' : 'var(--muted)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <Database size={15} style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
          Master Data Center
        </button>

        <button
          onClick={() => setActiveSubTab('broadcast')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.86rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeSubTab === 'broadcast' ? 'var(--gold-deep)' : 'transparent',
            color: activeSubTab === 'broadcast' ? '#fff' : 'var(--muted)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <MessageSquare size={15} style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
          Broadcast Campaigns
        </button>

        <button
          onClick={() => setActiveSubTab('templates')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.86rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeSubTab === 'templates' ? 'var(--gold-deep)' : 'transparent',
            color: activeSubTab === 'templates' ? '#fff' : 'var(--muted)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <FileText size={15} style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
          Templates Manager
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.86rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeSubTab === 'settings' ? 'var(--gold-deep)' : 'transparent',
            color: activeSubTab === 'settings' ? '#fff' : 'var(--muted)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <SettingsIcon size={15} style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
          SMTP Gateway Settings
        </button>

        <button
          onClick={() => setActiveSubTab('guide')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.86rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeSubTab === 'guide' ? 'var(--gold-deep)' : 'transparent',
            color: activeSubTab === 'guide' ? '#fff' : 'var(--muted)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <HelpCircle size={15} style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
          Developer Guide
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUBTAB 1: COMMUNICATION DASHBOARD */}
      {/* ========================================================================= */}
      {activeSubTab === 'communication_dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '0.25rem' }}>
          {/* Dashboard Filter Bar */}
          <div className="campaigns-filter-grid">
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '0.25rem' }}>
                From Broadcast Date
              </label>
              <input
                type="date"
                value={dashFilterDateFrom}
                onChange={(e) => setDashFilterDateFrom(e.target.value)}
                style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '0.25rem' }}>
                To Broadcast Date
              </label>
              <input
                type="date"
                value={dashFilterDateTo}
                onChange={(e) => setDashFilterDateTo(e.target.value)}
                style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '0.25rem' }}>
                Broadcast Name
              </label>
              <select
                value={dashFilterBroadcastName}
                onChange={(e) => setDashFilterBroadcastName(e.target.value)}
                style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
              >
                <option value="">All Broadcasts</option>
                {masterFilterOptions.broadcastNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '0.25rem' }}>
                Meta WhatsApp Sender
              </label>
              <select
                value={dashFilterMetaWaNo}
                onChange={(e) => setDashFilterMetaWaNo(e.target.value)}
                style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
              >
                <option value="">All WhatsApp Numbers</option>
                {masterFilterOptions.metaWhatsappNos.map(no => (
                  <option key={no} value={no}>{no}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '0.25rem' }}>
                Sender Email
              </label>
              <select
                value={dashFilterSenderEmail}
                onChange={(e) => setDashFilterSenderEmail(e.target.value)}
                style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
              >
                <option value="">All Sender Emails</option>
                {masterFilterOptions.senderEmails.map(em => (
                  <option key={em} value={em}>{em}</option>
                ))}
              </select>
            </div>

            <div>
              <button
                onClick={() => {
                  setDashFilterDateFrom('');
                  setDashFilterDateTo('');
                  setDashFilterBroadcastName('');
                  setDashFilterMetaWaNo('');
                  setDashFilterSenderEmail('');
                }}
                style={{
                  width: '100%',
                  padding: '0.45rem',
                  fontSize: '0.82rem',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                  background: 'var(--paper)',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Top KPI Metric Cards */}
          {dashboardAnalytics && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
              {/* Broadcasts Count */}
              <div className="glass-panel" style={{ padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid var(--line)', borderTop: '3.5px solid var(--gold-deep)', background: 'var(--paper)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--muted)', fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <span>Total Broadcasts</span>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(224, 168, 46, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Zap size={15} style={{ color: 'var(--gold-deep)' }} />
                  </div>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.45rem', color: 'var(--ink)', fontFamily: 'var(--font-heading)' }}>
                  {dashboardAnalytics.kpis.total_broadcasts || 0}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '0.35rem', fontWeight: 600 }}>
                  <span style={{ color: '#25D366' }}>{dashboardAnalytics.kpis.wa_broadcasts || 0} WA</span> • <span style={{ color: '#8b5cf6' }}>{dashboardAnalytics.kpis.email_broadcasts || 0} Email</span> • <span style={{ color: 'var(--gold-deep)' }}>{dashboardAnalytics.kpis.hybrid_broadcasts || 0} Hybrid</span>
                </div>
              </div>

              {/* Total Targeted */}
              <div className="glass-panel" style={{ padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid var(--line)', borderTop: '3.5px solid #3b82f6', background: 'var(--paper)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--muted)', fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <span>Targeted Leads</span>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={15} style={{ color: '#3b82f6' }} />
                  </div>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.45rem', color: 'var(--ink)', fontFamily: 'var(--font-heading)' }}>
                  {(dashboardAnalytics.kpis.total_targeted || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#3b82f6', marginTop: '0.35rem', fontWeight: 700 }}>
                  {(dashboardAnalytics.masterStats.total_master_contacts || 0).toLocaleString()} Unique Master Contacts
                </div>
              </div>

              {/* WhatsApp Delivery Rate */}
              <div className="glass-panel" style={{ padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid var(--line)', borderTop: '3.5px solid #10b981', background: 'var(--paper)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--muted)', fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <span>WA Delivery Rate</span>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCheck size={15} style={{ color: '#10b981' }} />
                  </div>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.45rem', color: '#10b981', fontFamily: 'var(--font-heading)' }}>
                  {dashboardAnalytics.masterStats.sum_wa_sent > 0 
                    ? `${((dashboardAnalytics.masterStats.sum_wa_delivered / dashboardAnalytics.masterStats.sum_wa_sent) * 100).toFixed(1)}%` 
                    : '100%'}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '0.35rem', fontWeight: 600 }}>
                  {dashboardAnalytics.masterStats.sum_wa_delivered} delivered of {dashboardAnalytics.masterStats.sum_wa_sent} sent
                </div>
              </div>

              {/* WhatsApp CTR */}
              <div className="glass-panel" style={{ padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid var(--line)', borderTop: '3.5px solid #f59e0b', background: 'var(--paper)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--muted)', fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <span>WhatsApp CTR</span>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp size={15} style={{ color: '#f59e0b' }} />
                  </div>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.45rem', color: '#f59e0b', fontFamily: 'var(--font-heading)' }}>
                  {dashboardAnalytics.masterStats.sum_wa_delivered > 0 
                    ? `${((dashboardAnalytics.masterStats.sum_wa_clicked / dashboardAnalytics.masterStats.sum_wa_delivered) * 100).toFixed(1)}%` 
                    : '0.0%'}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#f59e0b', marginTop: '0.35rem', fontWeight: 700 }}>
                  {dashboardAnalytics.masterStats.sum_wa_clicked || 0} unique link clicks
                </div>
              </div>

              {/* Email Delivery Rate */}
              <div className="glass-panel" style={{ padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid var(--line)', borderTop: '3.5px solid #8b5cf6', background: 'var(--paper)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--muted)', fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <span>Email Delivery Rate</span>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(139, 92, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Mail size={15} style={{ color: '#8b5cf6' }} />
                  </div>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.45rem', color: '#8b5cf6', fontFamily: 'var(--font-heading)' }}>
                  {dashboardAnalytics.masterStats.sum_email_sent > 0 
                    ? `${((dashboardAnalytics.masterStats.sum_email_delivered / dashboardAnalytics.masterStats.sum_email_sent) * 100).toFixed(1)}%` 
                    : '100%'}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '0.35rem', fontWeight: 600 }}>
                  {dashboardAnalytics.masterStats.sum_email_delivered} delivered of {dashboardAnalytics.masterStats.sum_email_sent} sent
                </div>
              </div>

              {/* Opt-out Rate */}
              <div className="glass-panel" style={{ padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid var(--line)', borderTop: '3.5px solid #ef4444', background: 'var(--paper)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--muted)', fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <span>Opt-out Rate</span>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldCheck size={15} style={{ color: '#ef4444' }} />
                  </div>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.45rem', color: '#ef4444', fontFamily: 'var(--font-heading)' }}>
                  {(dashboardAnalytics.masterStats.wa_optout_count || 0) + (dashboardAnalytics.masterStats.email_optout_count || 0)}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '0.35rem', fontWeight: 600 }}>
                  <span style={{ color: '#ef4444' }}>{dashboardAnalytics.masterStats.wa_optout_count || 0} WA</span> • <span style={{ color: '#ef4444' }}>{dashboardAnalytics.masterStats.email_optout_count || 0} Email</span> opt-outs
                </div>
              </div>
            </div>
          )}

          {/* Active Sender Health and Status */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {/* Meta WhatsApp Phone Numbers with Quality Ratings */}
            <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <MessageSquare size={16} style={{ color: '#25D366' }} /> Meta WhatsApp Sender Health
                </h3>
                <button onClick={fetchMetaPhoneNumbers} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }} title="Refresh Phone Numbers">
                  <RefreshCw size={14} className={isLoadingPhoneNumbers ? 'spin-slow' : ''} />
                </button>
              </div>

              {metaPhoneNumbers.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '0.84rem', padding: '1rem 0' }}>
                  No Meta WhatsApp business numbers loaded. Check WA_API_KEY in settings.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {metaPhoneNumbers.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', borderRadius: '8px', background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{p.display_phone_number} ({p.verified_name || 'Business'})</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>Phone ID: {p.id}</div>
                      </div>
                      <div>
                        {getQualityRatingBadge(p.quality_rating)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Email Gateway Sender Info */}
            <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Mail size={16} style={{ color: '#3b82f6' }} /> SMTP Sender Gateway
                </h3>
                <button onClick={() => setActiveSubTab('settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold-deep)', fontSize: '0.78rem', fontWeight: 600 }}>
                  Configure
                </button>
              </div>

              <div style={{ background: 'var(--paper-2)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '0.85rem' }}>
                <div style={{ marginBottom: '0.4rem' }}>
                  <strong>Host:</strong> {smtpSettings.host || 'smtp.titan.email (Configured)'}
                </div>
                <div style={{ marginBottom: '0.4rem' }}>
                  <strong>From Name:</strong> {smtpSettings.fromName || 'FinMantra'}
                </div>
                <div>
                  <strong>From Email:</strong> {smtpSettings.fromEmail || 'no-reply@finmantra.com'}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Broadcasts Overview Table */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)', flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Recent Broadcast Campaigns &amp; Delivery Stats</h3>
              <button onClick={() => setActiveSubTab('broadcast')} style={{ background: 'none', border: 'none', color: 'var(--gold-deep)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                View All Broadcasts &rarr;
              </button>
            </div>

            <div className="campaigns-table-wrapper">
              <table className="campaigns-table">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Broadcast Name</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Channel</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Sender</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Status</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Targeted</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Delivered</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>CTR</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Date</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {broadcasts.slice(0, 10).map(b => {
                    const ctr = b.delivered_count > 0 ? ((b.clicked_count / b.delivered_count) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--line)' }} className="table-row-hover">
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>{b.name}</td>
                        <td style={{ padding: '0.65rem 0.75rem', textTransform: 'capitalize' }}>{b.channel}</td>
                        <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
                          {b.meta_phone_number || b.sender_email || 'Default'}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          <span 
                            onClick={() => handleOpenBroadcastLogs(b)}
                            style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: b.status === 'sent' ? 'rgba(22, 163, 123, 0.12)' : b.status === 'processing' ? 'rgba(59, 130, 246, 0.12)' : b.status === 'failed' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(224, 168, 46, 0.12)',
                              color: b.status === 'sent' ? '#16a37b' : b.status === 'processing' ? '#3b82f6' : b.status === 'failed' ? '#ef4444' : 'var(--gold-deep)',
                              cursor: 'pointer'
                            }}
                            title="Click to view detailed delivery logs"
                          >
                            {b.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>{b.targeted_count || 0}</td>
                        <td style={{ padding: '0.65rem 0.75rem', color: '#16a37b', fontWeight: 700 }}>{b.delivered_count || b.sent_count || 0}</td>
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          <span style={{
                            padding: '0.18rem 0.48rem',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            background: Number(ctr) > 0 ? 'rgba(245, 158, 11, 0.15)' : 'var(--paper-2)',
                            color: Number(ctr) > 0 ? '#d97706' : 'var(--muted)',
                            border: '1px solid var(--line)'
                          }}>
                            {ctr}% ({b.clicked_count || 0})
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', color: 'var(--muted)', fontSize: '0.78rem' }}>
                          {b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => handleOpenBroadcastLogs(b)}
                            style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '0.2rem', marginRight: '0.4rem' }}
                            title="View Delivery Logs"
                          >
                            <FileText size={15} />
                          </button>
                          <button
                            onClick={() => handleEditBroadcast(b)}
                            style={{ background: 'none', border: 'none', color: 'var(--gold-deep)', cursor: 'pointer', padding: '0.2rem', marginRight: '0.4rem' }}
                            title="Edit Broadcast"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteBroadcast(b.id, b.name)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}
                            title="Delete Broadcast"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: MASTER DATA CENTER */}
      {/* ========================================================================= */}
      {activeSubTab === 'master_data' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)', padding: '1.25rem' }}>
            {/* Top Filter Controls & Export */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap', flexShrink: 0 }}>
              {/* Search Box */}
              <div style={{ position: 'relative', maxWidth: '340px', width: '100%' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                <input
                  type="text"
                  placeholder="Search FinMantra ID, Name, Phone, Email..."
                  value={masterSearch}
                  onChange={(e) => setMasterSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchMasterLeads()}
                  style={{
                    width: '100%',
                    background: 'var(--paper-2)',
                    border: '1px solid var(--line)',
                    borderRadius: '8px',
                    padding: '0.45rem 0.75rem 0.45rem 2.25rem',
                    fontSize: '0.85rem',
                    color: 'var(--ink)',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {selectedMasterDeleteIds.size > 0 && (
                  <button
                    onClick={handleDeleteMasterBulk}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.45rem 1rem',
                      fontSize: '0.85rem',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    <Trash2 size={14} /> Delete Selected ({selectedMasterDeleteIds.size})
                  </button>
                )}

                <button
                  onClick={handleExportMasterData}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 1rem',
                    fontSize: '0.85rem',
                    background: 'var(--paper-2)',
                    color: 'var(--ink)',
                    border: '1px solid var(--line)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  <Download size={14} /> Export Filtered Data (CSV)
                </button>
              </div>
            </div>

            {/* Filter Bar based on broadcast date, broadcast name, meta whatsapp no, sender email */}
            <div className="campaigns-filter-grid">
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)' }}>Broadcast Date From</label>
                <input
                  type="date"
                  value={masterFilterDateFrom}
                  onChange={(e) => setMasterFilterDateFrom(e.target.value)}
                  style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)' }}>Broadcast Date To</label>
                <input
                  type="date"
                  value={masterFilterDateTo}
                  onChange={(e) => setMasterFilterDateTo(e.target.value)}
                  style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)' }}>Broadcast Name</label>
                <select
                  value={masterFilterBroadcastName}
                  onChange={(e) => setMasterFilterBroadcastName(e.target.value)}
                  style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', boxSizing: 'border-box' }}
                >
                  <option value="">All Broadcasts</option>
                  {masterFilterOptions.broadcastNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)' }}>Meta WhatsApp No</label>
                <select
                  value={masterFilterMetaWaNo}
                  onChange={(e) => setMasterFilterMetaWaNo(e.target.value)}
                  style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', boxSizing: 'border-box' }}
                >
                  <option value="">All WhatsApp Numbers</option>
                  {masterFilterOptions.metaWhatsappNos.map(no => (
                    <option key={no} value={no}>{no}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)' }}>Sender Email</label>
                <select
                  value={masterFilterSenderEmail}
                  onChange={(e) => setMasterFilterSenderEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', boxSizing: 'border-box' }}
                >
                  <option value="">All Sender Emails</option>
                  {masterFilterOptions.senderEmails.map(em => (
                    <option key={em} value={em}>{em}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMasterSearch('');
                    setMasterFilterBroadcastName('');
                    setMasterFilterDateFrom('');
                    setMasterFilterDateTo('');
                    setMasterFilterMetaWaNo('');
                    setMasterFilterSenderEmail('');
                  }}
                  style={{ padding: '0.35rem', fontSize: '0.78rem', width: '100%', height: '28px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--paper)', cursor: 'pointer' }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={fetchMasterLeads}
                  style={{ padding: '0.35rem', fontSize: '0.78rem', width: '100%', height: '28px', borderRadius: '4px', border: 'none', background: 'var(--gold-deep)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Master Contacts Grid Table */}
            <div className="campaigns-table-wrapper">
              {isLoadingMaster ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                  <RefreshCw size={28} className="spin-slow" style={{ color: 'var(--gold-deep)', marginBottom: '0.75rem' }} />
                  <div>Loading master data records...</div>
                </div>
              ) : masterContacts.length === 0 ? (
                <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--muted)' }}>
                  <Database size={36} style={{ color: 'var(--line)', marginBottom: '0.75rem' }} />
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No contacts found in Master Data Center.</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Contacts are automatically merged and deduplicated whenever a Broadcast Campaign is launched.</div>
                </div>
              ) : (
                <table className="campaigns-table">
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--paper-2)', zIndex: 10 }}>
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      <th style={{ padding: '0.65rem 0.75rem', width: '36px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={masterContacts.length > 0 && masterContacts.every(c => selectedMasterDeleteIds.has(c.id))}
                          onChange={(e) => {
                            const newSet = new Set(selectedMasterDeleteIds);
                            if (e.target.checked) {
                              masterContacts.forEach(c => newSet.add(c.id));
                            } else {
                              masterContacts.forEach(c => newSet.delete(c.id));
                            }
                            setSelectedMasterDeleteIds(newSet);
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                      </th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>FinMantra ID</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Campaign ID</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Name</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Contact (Phone)</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Email</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>WA Opt-in</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Email Opt-in</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>WA Rates (Del/CTR)</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Email Rates (Del/CTR)</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Last Broadcast</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masterContacts.map(c => {
                      const isChecked = selectedMasterDeleteIds.has(c.id);
                      const waDel = c.wa_sent_count > 0 ? ((c.wa_delivered_count / c.wa_sent_count) * 100).toFixed(0) : '—';
                      const waCtr = c.wa_delivered_count > 0 ? ((c.wa_clicked_count / c.wa_delivered_count) * 100).toFixed(0) : '0';
                      const emDel = c.email_sent_count > 0 ? ((c.email_delivered_count / c.email_sent_count) * 100).toFixed(0) : '—';
                      const emCtr = c.email_delivered_count > 0 ? ((c.email_clicked_count / c.email_delivered_count) * 100).toFixed(0) : '0';

                      return (
                        <tr
                          key={c.id}
                          style={{ borderBottom: '1px solid var(--line)', background: isChecked ? 'rgba(224, 168, 46, 0.05)' : 'transparent' }}
                          className="table-row-hover"
                        >
                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const newSet = new Set(selectedMasterDeleteIds);
                                if (e.target.checked) newSet.add(c.id);
                                else newSet.delete(c.id);
                                setSelectedMasterDeleteIds(newSet);
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--gold-deep)' }}>
                            {c.finmantra_id || 'FM00001'}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--muted)' }}>
                            {c.campaign_data_id || 'FMCB00001'}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>{c.name}</td>
                          <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)' }}>{c.contact}</td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>{c.mail || '—'}</td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <button
                              type="button"
                              onClick={() => handleToggleMasterLeadOptin(c.id, 'whatsapp', c.whatsapp_optin !== false)}
                              style={{
                                border: 'none',
                                cursor: 'pointer',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                background: c.whatsapp_optin !== false ? 'rgba(22, 163, 123, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                color: c.whatsapp_optin !== false ? '#16a37b' : '#ef4444',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                              title="Click to toggle WhatsApp Opt-in status"
                            >
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.whatsapp_optin !== false ? '#16a37b' : '#ef4444' }} />
                              {c.whatsapp_optin !== false ? 'Opted-in' : 'Opted-out'}
                            </button>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <button
                              type="button"
                              onClick={() => handleToggleMasterLeadOptin(c.id, 'email', c.email_optin !== false)}
                              style={{
                                border: 'none',
                                cursor: 'pointer',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                background: c.email_optin !== false ? 'rgba(22, 163, 123, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                color: c.email_optin !== false ? '#16a37b' : '#ef4444',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                              title="Click to toggle Email Opt-in status"
                            >
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.email_optin !== false ? '#16a37b' : '#ef4444' }} />
                              {c.email_optin !== false ? 'Opted-in' : 'Opted-out'}
                            </button>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem' }}>
                            <span style={{ color: '#25D366', fontWeight: 700 }}>Del: {waDel}{waDel !== '—' ? '%' : ''}</span> • <span style={{ color: 'var(--gold-deep)', fontWeight: 700 }}>CTR: {waCtr}%</span>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem' }}>
                            <span style={{ color: '#3b82f6', fontWeight: 700 }}>Del: {emDel}{emDel !== '—' ? '%' : ''}</span> • <span style={{ color: 'var(--gold-deep)', fontWeight: 700 }}>CTR: {emCtr}%</span>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
                            {c.last_broadcast_name || '—'}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <a
                              href={`/unsubscribe?id=${encodeURIComponent(c.finmantra_id || c.id)}&channel=whatsapp`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--gold-deep)', textDecoration: 'none', marginRight: '0.6rem', fontSize: '0.75rem', fontWeight: 600 }}
                              title="Open 1-Click Unsubscribe Page"
                            >
                              Unsub Link
                            </a>
                            <button
                              onClick={() => handleDeleteMasterLead(c.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}
                              title="Delete Lead"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.85rem', flexShrink: 0, fontSize: '0.82rem', color: 'var(--muted)' }}>
              <div>
                Showing {masterContacts.length} of {masterTotal} master contacts
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  disabled={masterPage <= 1}
                  onClick={() => setMasterPage(p => Math.max(1, p - 1))}
                  style={{ padding: '0.3rem 0.75rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--paper)', cursor: masterPage <= 1 ? 'not-allowed' : 'pointer' }}
                >
                  Previous
                </button>
                <span style={{ padding: '0.3rem 0.6rem', fontWeight: 700, color: 'var(--ink)' }}>Page {masterPage}</span>
                <button
                  disabled={masterContacts.length < masterLimit}
                  onClick={() => setMasterPage(p => p + 1)}
                  style={{ padding: '0.3rem 0.75rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--paper)', cursor: masterContacts.length < masterLimit ? 'not-allowed' : 'pointer' }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: BROADCAST CAMPAIGNS */}
      {/* ========================================================================= */}
      {activeSubTab === 'broadcast' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>All Broadcast Campaigns</h3>
                <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Manage scheduled dispatches, track deliverability, and trigger immediate sends.</div>
              </div>
              <button
                onClick={() => {
                  setBroadcastWizardStep(1);
                  setShowNewBroadcastModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 1.1rem',
                  borderRadius: '6px',
                  background: 'var(--gold-deep)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  cursor: 'pointer'
                }}
              >
                <Plus size={15} /> Create Broadcast
              </button>
            </div>

            {/* Broadcasts List */}
            <div className="campaigns-table-wrapper">
              {isLoadingBroadcasts ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                  <RefreshCw size={28} className="spin-slow" style={{ color: 'var(--gold-deep)', marginBottom: '0.75rem' }} />
                  <div>Loading broadcasts...</div>
                </div>
              ) : broadcasts.length === 0 ? (
                <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--muted)' }}>
                  <MessageSquare size={36} style={{ color: 'var(--line)', marginBottom: '0.75rem' }} />
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No broadcasts created yet.</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Click "+ Create Broadcast" to launch a direct Meta WhatsApp or SMTP campaign.</div>
                </div>
              ) : (
                <table className="campaigns-table">
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--paper-2)', zIndex: 10 }}>
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700 }}>Broadcast Name</th>
                      <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700 }}>Channel</th>
                      <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700 }}>Sender / Phone</th>
                      <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700 }}>Status</th>
                      <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700 }}>Targeted</th>
                      <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700 }}>Delivered</th>
                      <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700 }}>CTR</th>
                      <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700 }}>Schedule Time</th>
                      <th style={{ padding: '0.7rem 0.85rem', textAlign: 'right', fontWeight: 700 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {broadcasts.map(b => {
                      const ctr = b.delivered_count > 0 ? ((b.clicked_count / b.delivered_count) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={b.id} style={{ borderBottom: '1px solid var(--line)' }} className="table-row-hover">
                          <td style={{ padding: '0.75rem 0.85rem', fontWeight: 700 }}>{b.name}</td>
                          <td style={{ padding: '0.75rem 0.85rem', textTransform: 'capitalize' }}>{b.channel}</td>
                          <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
                            {b.meta_phone_number || b.sender_email || 'Default Sender'}
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem' }}>
                            <span 
                              onClick={() => handleOpenBroadcastLogs(b)}
                              style={{
                                padding: '0.2rem 0.55rem',
                                borderRadius: '999px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: b.status === 'sent' ? 'rgba(22, 163, 123, 0.12)' : b.status === 'processing' ? 'rgba(59, 130, 246, 0.12)' : b.status === 'failed' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(224, 168, 46, 0.12)',
                                color: b.status === 'sent' ? '#16a37b' : b.status === 'processing' ? '#3b82f6' : b.status === 'failed' ? '#ef4444' : 'var(--gold-deep)',
                                cursor: 'pointer'
                              }}
                              title="Click to view detailed delivery logs"
                            >
                              {b.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem', fontWeight: 600 }}>{b.targeted_count || 0}</td>
                          <td style={{ padding: '0.75rem 0.85rem', color: '#16a37b', fontWeight: 700 }}>{b.delivered_count || b.sent_count || 0}</td>
                          <td style={{ padding: '0.75rem 0.85rem' }}>
                            <span style={{
                              padding: '0.18rem 0.48rem',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              background: Number(ctr) > 0 ? 'rgba(245, 158, 11, 0.15)' : 'var(--paper-2)',
                              color: Number(ctr) > 0 ? '#d97706' : 'var(--muted)',
                              border: '1px solid var(--line)'
                            }}>
                              {ctr}% ({b.clicked_count || 0})
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
                            {b.scheduled_at ? new Date(b.scheduled_at).toLocaleString() : 'Direct / Immediate'}
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {b.status !== 'sent' && b.status !== 'processing' && (
                              <button
                                onClick={() => handleTriggerBroadcastNow(b.id)}
                                style={{
                                  padding: '0.3rem 0.65rem',
                                  borderRadius: '4px',
                                  background: 'var(--gold-deep)',
                                  color: '#fff',
                                  border: 'none',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  marginRight: '0.4rem'
                                }}
                                title="Send broadcast now"
                              >
                                <Send size={12} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} /> Send Now
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenBroadcastLogs(b)}
                              style={{
                                padding: '0.3rem 0.55rem',
                                borderRadius: '4px',
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: '#3b82f6',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                marginRight: '0.4rem'
                              }}
                              title="View Delivery Logs"
                            >
                              <FileText size={13} /> Logs
                            </button>
                            <button
                              onClick={() => handleEditBroadcast(b)}
                              style={{
                                padding: '0.3rem 0.55rem',
                                borderRadius: '4px',
                                background: 'var(--paper-2)',
                                color: 'var(--ink)',
                                border: '1px solid var(--line)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                marginRight: '0.4rem'
                              }}
                              title="Edit Broadcast"
                            >
                              <Edit2 size={13} /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteBroadcast(b.id, b.name)}
                              style={{
                                padding: '0.3rem 0.55rem',
                                borderRadius: '4px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                              title="Delete Broadcast"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4: TEMPLATES MANAGER */}
      {/* ========================================================================= */}
      {activeSubTab === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Meta WhatsApp &amp; Email Template Manager</h3>
                <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Templates registered with Meta Cloud API and verified under business accounts.</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={async () => {
                    setIsSyncingMetaTemplates(true);
                    try {
                      const res = await fetch(`${API_URL}/campaigns/templates/sync-from-meta`, {
                        method: 'POST',
                        headers
                      });
                      const data = await res.json();
                      if (res.ok && data.success) {
                        showToast(data.message || 'Synced templates from Meta successfully!', 'success');
                        fetchTemplates();
                      } else {
                        showToast(data.error || 'Failed to sync templates from Meta.', 'error');
                      }
                    } catch (err) {
                      showToast('Network error syncing templates from Meta.', 'error');
                    } finally {
                      setIsSyncingMetaTemplates(false);
                    }
                  }}
                  disabled={isSyncingMetaTemplates}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 1.1rem',
                    borderRadius: '6px',
                    background: 'var(--paper-2)',
                    color: 'var(--ink)',
                    border: '1px solid var(--line)',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: isSyncingMetaTemplates ? 'not-allowed' : 'pointer'
                  }}
                >
                  <RefreshCw size={14} className={isSyncingMetaTemplates ? 'spin-slow' : ''} />
                  {isSyncingMetaTemplates ? 'Syncing with Meta...' : 'Sync Meta Templates'}
                </button>
                <button
                  onClick={() => {
                    setNewTemplateForm({
                      name: '',
                      type: 'whatsapp',
                      subject: '',
                      body: '',
                      metaTemplateName: '',
                      mediaUrl: '',
                      category: 'MARKETING',
                      language: 'en_US',
                      headerFormat: 'NONE',
                      headerText: '',
                      headerSample: '',
                      footerText: '',
                      bodySampleValues: {},
                      buttons: {
                        buttonType: 'NONE',
                        ctaUrlText: '',
                        ctaUrlValue: '',
                        ctaUrlSample: '',
                        ctaPhoneText: '',
                        ctaPhoneValue: '',
                        quickReplies: ['Interested', 'Apply Now', 'Talk to Agent'],
                        otpType: 'COPY_CODE',
                        otpText: 'Copy Code'
                      }
                    });
                    setShowCreateTemplateModal(true);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 1.1rem',
                    borderRadius: '6px',
                    background: 'var(--gold-deep)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={15} /> + Create Template
                </button>
              </div>
            </div>

            {/* Templates Grid */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', minHeight: 0 }}>
              {templates.map(t => (
                <div key={t.id} style={{ border: '1px solid var(--line)', borderRadius: '10px', background: 'var(--paper-2)', padding: '1.1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.35rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t.name}</span>
                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        {t.status && (
                          <span style={{
                            padding: '0.12rem 0.45rem',
                            borderRadius: '999px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: t.status === 'APPROVED' ? 'rgba(22, 163, 123, 0.15)' : t.status === 'PENDING' ? 'rgba(224, 168, 46, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: t.status === 'APPROVED' ? '#16a37b' : t.status === 'PENDING' ? 'var(--gold-deep)' : '#ef4444'
                          }}>
                            {t.status}
                          </span>
                        )}
                        <span style={{ padding: '0.12rem 0.45rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, background: t.type === 'whatsapp' ? 'rgba(37, 211, 102, 0.15)' : 'rgba(59, 130, 246, 0.15)', color: t.type === 'whatsapp' ? '#25D366' : '#3b82f6' }}>
                          {t.type}
                        </span>
                      </div>
                    </div>
                    {t.meta_template_name && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Meta: {t.meta_template_name}</span>
                        {t.language && <span>Lang: {t.language}</span>}
                      </div>
                    )}
                    <div style={{ fontSize: '0.82rem', background: 'var(--paper)', padding: '0.65rem', borderRadius: '6px', border: '1px solid var(--line)', maxHeight: '110px', overflowY: 'auto', whiteSpace: 'pre-wrap', color: 'var(--ink)' }}>
                      {t.body}
                    </div>
                  </div>
                  <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                      {t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}
                    </span>
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Delete template "${t.name}"?`)) return;
                        const res = await fetch(`${API_URL}/campaigns/templates/${t.id}`, { method: 'DELETE', headers });
                        const data = await res.json();
                        if (data.success) {
                          showToast('Template deleted.', 'info');
                          fetchTemplates();
                        }
                      }}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 5: MULTI-SMTP GATEWAY SETTINGS */}
      {/* ========================================================================= */}
      {activeSubTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Mail size={20} style={{ color: 'var(--gold-deep)' }} />
                  Outbound SMTP Email Gateways &amp; Accounts
                </h3>
                <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                  Manage multiple SMTP host credentials with complete create, edit, test, delete, and default routing controls.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={fetchSmtpAccounts}
                  disabled={isLoadingSmtpAccounts}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 0.9rem',
                    borderRadius: '6px',
                    background: 'var(--paper-2)',
                    color: 'var(--ink)',
                    border: '1px solid var(--line)',
                    fontWeight: 600,
                    fontSize: '0.84rem',
                    cursor: isLoadingSmtpAccounts ? 'not-allowed' : 'pointer'
                  }}
                >
                  <RefreshCw size={14} className={isLoadingSmtpAccounts ? 'spin-slow' : ''} />
                  Refresh
                </button>
                <button
                  onClick={handleOpenAddSmtpModal}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 1.1rem',
                    borderRadius: '6px',
                    background: 'var(--gold-deep)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={15} /> + Add SMTP Account
                </button>
              </div>
            </div>

            {/* SMTP Accounts Grid */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {isLoadingSmtpAccounts ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                  <RefreshCw size={24} className="spin-slow" style={{ color: 'var(--gold-deep)', marginBottom: '0.5rem' }} />
                  <div>Loading configured SMTP accounts...</div>
                </div>
              ) : smtpAccounts.length === 0 ? (
                <div style={{ padding: '3.5rem', textAlign: 'center', background: 'var(--paper-2)', borderRadius: '12px', border: '1px dashed var(--line)' }}>
                  <Mail size={36} style={{ color: 'var(--muted)', marginBottom: '0.75rem', opacity: 0.7 }} />
                  <h4 style={{ margin: '0 0 0.4rem 0', fontWeight: 700 }}>No Outbound SMTP Accounts Configured</h4>
                  <p style={{ margin: '0 0 1.25rem 0', color: 'var(--muted)', fontSize: '0.85rem' }}>Add your first SMTP email gateway (e.g. Gmail, Titan, Outlook, AWS SES) to send broadcasts.</p>
                  <button
                    onClick={handleOpenAddSmtpModal}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.6rem 1.25rem',
                      borderRadius: '8px',
                      background: 'var(--gold-deep)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={16} /> + Add SMTP Account
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                  {smtpAccounts.map(account => {
                    const isTestingThis = testingSmtpAccountId === account.id;
                    return (
                      <div
                        key={account.id}
                        style={{
                          border: account.is_default ? '2px solid var(--gold-deep)' : '1px solid var(--line)',
                          borderRadius: '12px',
                          background: 'var(--paper-2)',
                          padding: '1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: account.is_default ? '0 4px 15px rgba(224, 168, 46, 0.12)' : 'none'
                        }}
                      >
                        <div>
                          {/* Account Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '1.02rem', color: 'var(--ink)' }}>{account.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                                ID: {account.id}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                              {account.is_default && (
                                <span style={{
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: '999px',
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  background: 'rgba(224, 168, 46, 0.18)',
                                  color: 'var(--gold-deep)',
                                  border: '1px solid rgba(224, 168, 46, 0.4)'
                                }}>
                                  ★ DEFAULT
                                </span>
                              )}
                              <span style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: '999px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                background: account.secure ? 'rgba(22, 163, 123, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                                color: account.secure ? '#16a37b' : '#3b82f6'
                              }}>
                                {account.secure ? 'SSL (465)' : 'TLS (587)'}
                              </span>
                            </div>
                          </div>

                          {/* Account Details Box */}
                          <div style={{ background: 'var(--paper)', borderRadius: '8px', border: '1px solid var(--line)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--muted)' }}>From Name:</span>
                              <strong>{account.from_name || 'FinMantra'}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--muted)' }}>From Email:</span>
                              <strong style={{ color: 'var(--ink)' }}>{account.from_email}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--muted)' }}>Host / Server:</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{account.host}:{account.port}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--muted)' }}>Username:</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{account.username}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              type="button"
                              onClick={() => handleTestSpecificSmtp(account)}
                              disabled={isTestingThis}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.4rem 0.75rem',
                                borderRadius: '6px',
                                background: 'var(--paper)',
                                color: 'var(--ink)',
                                border: '1px solid var(--line)',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: isTestingThis ? 'not-allowed' : 'pointer'
                              }}
                            >
                              {isTestingThis ? <RefreshCw size={13} className="spin-slow" /> : <Zap size={13} style={{ color: 'var(--gold-deep)' }} />}
                              {isTestingThis ? 'Testing...' : 'Test Connection'}
                            </button>
                            {!account.is_default && (
                              <button
                                type="button"
                                onClick={() => handleSetDefaultSmtpAccount(account.id, account.name)}
                                style={{
                                  padding: '0.4rem 0.65rem',
                                  borderRadius: '6px',
                                  background: 'var(--paper)',
                                  color: 'var(--muted)',
                                  border: '1px solid var(--line)',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                Set Default
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditSmtpModal(account)}
                              style={{
                                padding: '0.4rem 0.65rem',
                                borderRadius: '6px',
                                background: 'var(--paper)',
                                color: 'var(--ink)',
                                border: '1px solid var(--line)',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              <Edit2 size={13} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSmtpAccount(account.id, account.name)}
                              style={{
                                padding: '0.4rem 0.65rem',
                                borderRadius: '6px',
                                background: 'rgba(239, 68, 68, 0.08)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 6: DEVELOPER GUIDE */}
      {/* ========================================================================= */}
      {activeSubTab === 'guide' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div className="glass-panel" style={{ maxWidth: '720px', width: '100%', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)', padding: '1.5rem', boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.2rem', fontWeight: 700 }}>FinMantra Campaign Architecture Guide</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
              FinMantra provides an integrated direct-dispatch broadcast pipeline connected with Meta WhatsApp Cloud API and SMTP Gateways.
            </p>

            <h4 style={{ margin: '1.25rem 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 700 }}>1. Direct Upload &amp; Zero Duplicate Master Data Center</h4>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              Whenever you launch a Broadcast Campaign, contacts are directly validated and merged into the Master Data Center. If a contact phone or email already exists, the record is updated with new metrics without creating duplicates.
            </p>

            <h4 style={{ margin: '1.25rem 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 700 }}>2. Sequential FinMantra IDs (FMCB00001)</h4>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              The download template includes an ID column pre-filled with <code>FMCB00001</code>. If any uploaded row has an empty ID, FinMantra automatically assigns consecutive IDs in the format <code>FMCB00001</code>, <code>FMCB00002</code>, etc.
            </p>

            <h4 style={{ margin: '1.25rem 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 700 }}>3. Public Unsubscribe &amp; Contact Center</h4>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              Recipients can manage communication preferences or unsubscribe anytime at:
              <br />
              <code>https://thefinmantra.com/contact-center?id=master_id&amp;brodcast_id=example</code>
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: + BROADCAST CAMPAIGN 6-STEP WIZARD */}
      {/* ========================================================================= */}
      {showNewBroadcastModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div className="campaigns-wizard-modal">
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                  {editingBroadcastId ? `Edit Broadcast: ${broadcastForm.name || 'Campaign'}` : 'Create & Launch Broadcast Campaign'}
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Step {broadcastWizardStep} of 6: {
                  broadcastWizardStep === 1 ? 'Broadcast Information' :
                  broadcastWizardStep === 2 ? 'Target Channel & Sender' :
                  broadcastWizardStep === 3 ? 'Template & Content' :
                  broadcastWizardStep === 4 ? (editingBroadcastId ? 'Recipient Data / Optional Upload' : 'Download Template & Upload Contacts') :
                  broadcastWizardStep === 5 ? 'Interactive Live Preview' : (editingBroadcastId ? 'Save / Update Schedule' : 'Dispatch / Schedule')
                }</div>
              </div>
              <button onClick={() => { setShowNewBroadcastModal(false); setEditingBroadcastId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Step Progress Bar */}
            <div style={{ height: '4px', background: 'var(--paper-2)', width: '100%', flexShrink: 0 }}>
              <div style={{ height: '100%', background: 'var(--gold-deep)', width: `${(broadcastWizardStep / 6) * 100}%`, transition: 'width 0.3s ease' }} />
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {/* STEP 1: BROADCAST NAME */}
              {broadcastWizardStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                      Broadcast Campaign Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Credit Card Special Diwali Offer 2026"
                      value={broadcastForm.name}
                      onChange={(e) => setBroadcastForm({ ...broadcastForm, name: e.target.value })}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    />
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.35rem' }}>
                      A descriptive identifier for analytics, logs, and master data indexing.
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: TARGET CHANNEL & SENDER SELECTION */}
              {broadcastWizardStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                      Select Target Channel
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
                      {['whatsapp', 'email', 'both'].map(ch => (
                        <div
                          key={ch}
                          onClick={() => setBroadcastForm({ ...broadcastForm, channel: ch })}
                          style={{
                            padding: '0.85rem',
                            borderRadius: '10px',
                            border: broadcastForm.channel === ch ? '2px solid var(--gold-deep)' : '1px solid var(--line)',
                            background: broadcastForm.channel === ch ? 'rgba(224, 168, 46, 0.08)' : 'var(--paper-2)',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', textTransform: 'capitalize' }}>{ch}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                            {ch === 'whatsapp' ? 'WhatsApp Direct' : ch === 'email' ? 'SMTP Mail' : 'WhatsApp + Email'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* If WhatsApp: Choose WhatsApp Number with Quality Rating */}
                  {(broadcastForm.channel === 'whatsapp' || broadcastForm.channel === 'both') && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                        Choose Meta WhatsApp Number (Sender Account)
                      </label>
                      {metaPhoneNumbers.length === 0 ? (
                        <div style={{ padding: '0.75rem', background: 'rgba(224, 168, 46, 0.1)', border: '1px solid rgba(224, 168, 46, 0.3)', borderRadius: '8px', fontSize: '0.82rem' }}>
                          Using system default WhatsApp Cloud API Phone Number ID.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {metaPhoneNumbers.map(phone => {
                            const isSelected = broadcastForm.meta_phone_number_id === phone.id;
                            return (
                              <div
                                key={phone.id}
                                onClick={() => setBroadcastForm({
                                  ...broadcastForm,
                                  meta_phone_number_id: phone.id,
                                  meta_phone_number: phone.display_phone_number || ''
                                })}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '0.75rem 1rem',
                                  borderRadius: '8px',
                                  border: isSelected ? '2px solid var(--gold-deep)' : '1px solid var(--line)',
                                  background: isSelected ? 'rgba(224, 168, 46, 0.08)' : 'var(--paper-2)',
                                  cursor: 'pointer'
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                                    {phone.display_phone_number} ({phone.verified_name || 'FinMantra Verified'})
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                                    ID: {phone.id}
                                  </div>
                                </div>
                                <div>
                                  {getQualityRatingBadge(phone.quality_rating)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* If Email: Outbound SMTP Account & Sender Email */}
                  {(broadcastForm.channel === 'email' || broadcastForm.channel === 'both') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                          Outbound SMTP Gateway Account (Sender Email)
                        </label>
                        {smtpAccounts.length > 0 ? (
                          <select
                            value={broadcastForm.smtp_account_id}
                            onChange={(e) => {
                              const aid = e.target.value;
                              const acc = smtpAccounts.find(a => a.id === aid);
                              setBroadcastForm({
                                ...broadcastForm,
                                smtp_account_id: aid,
                                sender_email: acc ? acc.from_email : broadcastForm.sender_email
                              });
                            }}
                            style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                          >
                            <option value="">System Default SMTP</option>
                            {smtpAccounts.map(acc => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name} ({acc.from_email}) {acc.is_default ? '★ [DEFAULT]' : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div style={{ padding: '0.75rem', background: 'rgba(224, 168, 46, 0.1)', border: '1px solid rgba(224, 168, 46, 0.3)', borderRadius: '8px', fontSize: '0.82rem' }}>
                            Using default SMTP settings. Configure additional accounts in the SMTP Gateway Settings tab.
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                          Custom From Email Override (Optional)
                        </label>
                        <input
                          type="email"
                          value={broadcastForm.sender_email}
                          onChange={(e) => setBroadcastForm({ ...broadcastForm, sender_email: e.target.value })}
                          placeholder="e.g. offers@thefinmantra.com"
                          style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: TEMPLATE & CONTENT SELECTION */}
              {broadcastWizardStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* WhatsApp Template Selector */}
                  {(broadcastForm.channel === 'whatsapp' || broadcastForm.channel === 'both') && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                        Select WhatsApp Template as per Meta WhatsApp Number
                      </label>
                      <select
                        value={broadcastForm.whatsapp_template}
                        onChange={(e) => {
                          const chosen = e.target.value;
                          const t = templates.find(item => item.name === chosen || item.meta_template_name === chosen);
                          setBroadcastForm({
                            ...broadcastForm,
                            whatsapp_template: chosen,
                            meta_phone_number_id: t?.meta_phone_number_id || broadcastForm.meta_phone_number_id
                          });
                        }}
                        style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                      >
                        <option value="">Select a template...</option>
                        {templates.filter(t => t.type === 'whatsapp').map(t => (
                          <option key={t.id} value={t.meta_template_name || t.name}>
                            {t.name}{t.meta_template_name && t.meta_template_name !== t.name ? ` (${t.meta_template_name})` : ''} - [{t.language || 'en_US'}]
                          </option>
                        ))}
                      </select>

                      {broadcastForm.whatsapp_template && (
                        <div style={{ marginTop: '0.75rem', padding: '0.85rem', borderRadius: '8px', background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Template Body:</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>
                            {templates.find(t => t.name === broadcastForm.whatsapp_template || t.meta_template_name === broadcastForm.whatsapp_template)?.body}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Email Subject & Body */}
                  {(broadcastForm.channel === 'email' || broadcastForm.channel === 'both') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {/* Dynamic Tag Quick Inserter */}
                      <div style={{ background: 'var(--paper-2)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--line)' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                          ⚡ Click to Insert Dynamic Lead Data / Tracking URLs:
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          {[
                            { tag: '{name}', label: '👤 Name' },
                            { tag: '{finmantra_id}', label: '🆔 Master ID' },
                            { tag: '{unsubscribe_url}', label: '🛡️ {unsubscribe_url}' },
                            { tag: '{contact_center_url}', label: '🌐 {contact_center_url}' },
                            { tag: '{contact}', label: '📞 Contact' },
                            { tag: '{mail}', label: '✉️ Email' }
                          ].map(item => (
                            <button
                              key={item.tag}
                              type="button"
                              onClick={() => {
                                setBroadcastForm(p => ({
                                  ...p,
                                  email_body: (p.email_body || '') + (p.email_body?.endsWith(' ') || !p.email_body ? '' : ' ') + item.tag
                                }));
                              }}
                              style={{
                                padding: '0.25rem 0.6rem',
                                borderRadius: '5px',
                                border: '1px solid var(--line)',
                                background: 'var(--paper)',
                                color: 'var(--ink)',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem'
                              }}
                            >
                              {item.label}
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={() => {
                              const footerHtml = `\n\n<hr style="border:none;border-top:1px solid #e2e8f0;margin:25px 0;"/><div style="font-size:12px;color:#888;text-align:center;line-height:1.5;">To manage notification preferences, <a href="{contact_center_url}" style="color:#e0a82e;text-decoration:none;font-weight:bold;">visit Contact Center</a> • <a href="{unsubscribe_url}" style="color:#ef4444;text-decoration:none;font-weight:bold;">Unsubscribe from Emails</a></div>`;
                              setBroadcastForm(p => ({
                                ...p,
                                email_body: (p.email_body || '') + footerHtml
                              }));
                            }}
                            style={{
                              padding: '0.25rem 0.65rem',
                              borderRadius: '5px',
                              border: '1px solid #ef4444',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            + Attach Unsubscribe Footer
                          </button>
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>Email Subject Line</label>
                        <input
                          type="text"
                          placeholder="e.g. Exclusive Credit Card Eligibility for {name} (Ref: {finmantra_id})"
                          value={broadcastForm.email_subject}
                          onChange={(e) => setBroadcastForm({ ...broadcastForm, email_subject: e.target.value })}
                          style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>Email HTML / Text Body</label>
                        <textarea
                          rows={6}
                          placeholder="Dear {name}, here is your customized pre-approved offer. Click here to review: {contact_center_url}"
                          value={broadcastForm.email_body}
                          onChange={(e) => setBroadcastForm({ ...broadcastForm, email_body: e.target.value })}
                          style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', boxSizing: 'border-box', fontFamily: 'monospace' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: DOWNLOAD TEMPLATE & UPLOAD DATA */}
              {broadcastWizardStep === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Download Template Action */}
                  <div style={{ background: 'rgba(224, 168, 46, 0.08)', border: '1px solid rgba(224, 168, 46, 0.3)', borderRadius: '10px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Download Pre-configured CSV Template</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Includes 'id' column initialized as 'FMCB00001' plus required parameters.</div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadSampleTemplate}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        background: 'var(--gold-deep)',
                        color: '#fff',
                        border: 'none',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Download size={14} /> Download Template
                    </button>
                  </div>

                  {/* Upload Contact Data Drag & Drop */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                      Upload Contact Data <span style={{ color: '#ef4444' }}>*</span> (Mandatory for Contact)
                    </label>
                    <div style={{
                      border: '2px dashed var(--line)',
                      borderRadius: '10px',
                      padding: '1.5rem',
                      textAlign: 'center',
                      background: 'var(--paper-2)',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="file"
                        accept=".csv, .xlsx, .xls"
                        onChange={(e) => handleBroadcastFileUpload(e.target.files[0])}
                        style={{ display: 'none' }}
                        id="broadcast-file-input"
                      />
                      <label htmlFor="broadcast-file-input" style={{ cursor: 'pointer' }}>
                        <Upload size={28} style={{ color: 'var(--gold-deep)', marginBottom: '0.5rem' }} />
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                          {broadcastUploadFile ? broadcastUploadFile.name : 'Click or Drag & Drop CSV / Excel contact file'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                          Mandatory columns: contact phone numbers (WhatsApp) or email addresses.
                        </div>
                      </label>
                    </div>

                    {broadcastUploadError && (
                      <div style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: '0.5rem' }}>
                        {broadcastUploadError}
                      </div>
                    )}

                    {broadcastUploadStats && (
                      <div style={{ marginTop: '0.85rem', padding: '0.75rem 1rem', background: 'rgba(22, 163, 123, 0.1)', border: '1px solid #16a37b', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.85rem', color: '#16a37b', fontWeight: 700 }}>
                          Parsed {broadcastUploadStats.totalRows} customer contacts ready for broadcast.
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Zero duplicate merge enabled</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 5: INTERACTIVE LIVE PREVIEW */}
              {broadcastWizardStep === 5 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Summary Card */}
                  <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: '10px', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Campaign Name</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{broadcastForm.name}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Target Channel</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', textTransform: 'capitalize' }}>{broadcastForm.channel}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Recipients Count</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--gold-deep)' }}>{broadcastParsedLeads.length} Leads</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Sender</div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{broadcastForm.meta_phone_number || broadcastForm.sender_email || 'Default'}</div>
                    </div>
                  </div>

                  {/* Message Visual Preview */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                      Simulated Message Preview (Substituted with Row 1 Data)
                    </label>
                    <div style={{
                      background: 'var(--paper-2)',
                      border: '1px solid var(--line)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.88rem',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap'
                    }}>
                      {getRenderedTemplatePreview()}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 6: DISPATCH / SCHEDULE */}
              {broadcastWizardStep === 6 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                      Dispatch Execution Mode
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div
                        onClick={() => setBroadcastForm({ ...broadcastForm, scheduled_at: '' })}
                        style={{
                          padding: '1rem',
                          borderRadius: '10px',
                          border: !broadcastForm.scheduled_at ? '2px solid var(--gold-deep)' : '1px solid var(--line)',
                          background: !broadcastForm.scheduled_at ? 'rgba(224, 168, 46, 0.08)' : 'var(--paper-2)',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Send size={16} /> Direct Send (Immediate)
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.35rem' }}>
                          Start dispatching messages instantly via background runner.
                        </div>
                      </div>

                      <div
                        onClick={() => setBroadcastForm({ ...broadcastForm, scheduled_at: new Date(Date.now() + 3600000).toISOString().slice(0, 16) })}
                        style={{
                          padding: '1rem',
                          borderRadius: '10px',
                          border: broadcastForm.scheduled_at ? '2px solid var(--gold-deep)' : '1px solid var(--line)',
                          background: broadcastForm.scheduled_at ? 'rgba(224, 168, 46, 0.08)' : 'var(--paper-2)',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Clock size={16} /> Schedule for Later
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.35rem' }}>
                          Specify exact date &amp; time for automatic broadcast trigger.
                        </div>
                      </div>
                    </div>
                  </div>

                  {broadcastForm.scheduled_at && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                        Select Broadcast Schedule Date &amp; Time
                      </label>
                      <input
                        type="datetime-local"
                        value={broadcastForm.scheduled_at}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, scheduled_at: e.target.value })}
                        style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}

                  <div style={{ padding: '0.85rem', borderRadius: '8px', background: 'rgba(22, 163, 123, 0.1)', border: '1px solid #16a37b', fontSize: '0.82rem', color: '#16a37b' }}>
                    <ShieldCheck size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
                    Uploaded customer data will be synchronized to Master Data Center with auto-assigned consecutive FMCB IDs and duplicate protection.
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--paper-2)', flexShrink: 0 }}>
              <button
                type="button"
                disabled={broadcastWizardStep === 1}
                onClick={() => setBroadcastWizardStep(s => Math.max(1, s - 1))}
                style={{
                  padding: '0.55rem 1.1rem',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                  background: 'var(--paper)',
                  color: 'var(--ink)',
                  cursor: broadcastWizardStep === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                Back
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {broadcastWizardStep < 6 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (broadcastWizardStep === 1 && !broadcastForm.name.trim()) {
                        showToast('Please enter a broadcast name.', 'error');
                        return;
                      }
                      if (broadcastWizardStep === 4 && !editingBroadcastId && !broadcastUploadFile && broadcastParsedLeads.length === 0) {
                        showToast('Please upload contact data.', 'error');
                        return;
                      }
                      setBroadcastWizardStep(s => Math.min(6, s + 1));
                    }}
                    style={{
                      padding: '0.55rem 1.25rem',
                      borderRadius: '6px',
                      background: 'var(--gold-deep)',
                      color: '#fff',
                      border: 'none',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Next &rarr;
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmittingBroadcast}
                    onClick={handleSubmitDirectBroadcast}
                    style={{
                      padding: '0.6rem 1.4rem',
                      borderRadius: '6px',
                      background: 'var(--gold-deep)',
                      color: '#fff',
                      border: 'none',
                      fontSize: '0.88rem',
                      fontWeight: 800,
                      cursor: isSubmittingBroadcast ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 4px 12px rgba(224, 168, 46, 0.3)'
                    }}
                  >
                    {isSubmittingBroadcast ? <RefreshCw size={15} className="spin-slow" /> : (editingBroadcastId ? <Check size={16} /> : <Send size={15} />)}
                    {editingBroadcastId ? 'Save & Update Broadcast' : 'Launch Broadcast Campaign'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: META-STYLE WHATSAPP BUSINESS TEMPLATE CREATOR STUDIO */}
      {/* ========================================================================= */}
      {showCreateTemplateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '16px', maxWidth: '1080px', width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'var(--paper-2)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MessageSquare size={20} style={{ color: '#25D366' }} />
                  WhatsApp Business Template Studio (Meta Cloud API)
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                  Build, test, and register official WhatsApp templates with media headers, dynamic variables, CTA buttons, and live device preview.
                </div>
              </div>
              <button onClick={() => setShowCreateTemplateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Studio Body: Split Screen (Left: Builder Form, Right: Live WhatsApp Device Preview) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.95fr', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {/* LEFT COLUMN: FORM BUILDER */}
              <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderRight: '1px solid var(--line)' }}>
                {/* 1. Category & Account */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem', textTransform: 'uppercase', color: 'var(--muted)' }}>
                    1. Template Category &amp; Destination
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {[
                      { id: 'MARKETING', label: 'Marketing', desc: 'Promotions, discounts & offers' },
                      { id: 'UTILITY', label: 'Utility', desc: 'Order alerts & account updates' },
                      { id: 'AUTHENTICATION', label: 'Authentication', desc: 'OTP verification codes' }
                    ].map(cat => {
                      const isSel = newTemplateForm.category === cat.id;
                      return (
                        <div
                          key={cat.id}
                          onClick={() => {
                            setNewTemplateForm(prev => ({
                              ...prev,
                              category: cat.id,
                              buttons: cat.id === 'AUTHENTICATION' ? { ...prev.buttons, buttonType: 'OTP' } : prev.buttons
                            }));
                          }}
                          style={{
                            padding: '0.65rem 0.75rem',
                            borderRadius: '8px',
                            border: isSel ? '2px solid var(--gold-deep)' : '1px solid var(--line)',
                            background: isSel ? 'rgba(224, 168, 46, 0.1)' : 'var(--paper-2)',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{cat.label}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{cat.desc}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="campaigns-grid-2col">
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                        Template Name <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. finmantra_special_offer_v1"
                        value={newTemplateForm.name}
                        onChange={(e) => setNewTemplateForm({ ...newTemplateForm, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.85rem', fontFamily: 'var(--font-mono)', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                        Language
                      </label>
                      <select
                        value={newTemplateForm.language}
                        onChange={(e) => setNewTemplateForm({ ...newTemplateForm, language: e.target.value })}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.85rem' }}
                      >
                        <option value="en_US">English (US) [en_US]</option>
                        <option value="en">English (UK/Global) [en]</option>
                        <option value="hi">Hindi (हिन्दी) [hi]</option>
                        <option value="es">Spanish [es]</option>
                        <option value="fr">French [fr]</option>
                        <option value="ar">Arabic [ar]</option>
                        <option value="mr">Marathi (मराठी) [mr]</option>
                        <option value="gu">Gujarati (ગુજરાતી) [gu]</option>
                        <option value="ta">Tamil (தமிழ்) [ta]</option>
                        <option value="te">Telugu (తెలుగు) [te]</option>
                        <option value="bn">Bengali (বাংলা) [bn]</option>
                      </select>
                    </div>
                  </div>

                  {metaPhoneNumbers.length > 0 && (
                    <div style={{ marginTop: '0.65rem' }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                        Target Meta WhatsApp Sender Account
                      </label>
                      <select
                        value={templateTargetPhoneId}
                        onChange={(e) => setTemplateTargetPhoneId(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.82rem' }}
                      >
                        {metaPhoneNumbers.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.display_phone_number} ({p.verified_name || 'Business'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* 2. Header (Optional) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem', textTransform: 'uppercase', color: 'var(--muted)' }}>
                    2. Header (Optional)
                  </label>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
                    {['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].map(hf => {
                      const isSel = newTemplateForm.headerFormat === hf;
                      return (
                        <button
                          key={hf}
                          type="button"
                          onClick={() => setNewTemplateForm({ ...newTemplateForm, headerFormat: hf })}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            border: isSel ? '2px solid var(--gold-deep)' : '1px solid var(--line)',
                            background: isSel ? 'rgba(224, 168, 46, 0.12)' : 'var(--paper-2)',
                            fontWeight: isSel ? 700 : 500,
                            fontSize: '0.8rem',
                            color: 'var(--ink)',
                            cursor: 'pointer'
                          }}
                        >
                          {hf === 'NONE' ? 'None' : hf === 'TEXT' ? '📝 Text' : hf === 'IMAGE' ? '🖼️ Image' : hf === 'VIDEO' ? '🎥 Video' : '📄 Document'}
                        </button>
                      );
                    })}
                  </div>

                  {newTemplateForm.headerFormat === 'TEXT' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <input
                        type="text"
                        maxLength={60}
                        placeholder="Header text (e.g. Exclusive Offer for {{1}})"
                        value={newTemplateForm.headerText}
                        onChange={(e) => setNewTemplateForm({ ...newTemplateForm, headerText: e.target.value })}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.85rem', boxSizing: 'border-box' }}
                      />
                      {newTemplateForm.headerText.includes('{{1}}') && (
                        <input
                          type="text"
                          placeholder="Header {{1}} Sample Value (e.g. Rahul)"
                          value={newTemplateForm.headerSample}
                          onChange={(e) => setNewTemplateForm({ ...newTemplateForm, headerSample: e.target.value })}
                          style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.82rem', boxSizing: 'border-box' }}
                        />
                      )}
                    </div>
                  )}

                  {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(newTemplateForm.headerFormat) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <input
                        type="text"
                        placeholder={`Sample ${newTemplateForm.headerFormat.toLowerCase()} URL or upload from PC below`}
                        value={newTemplateForm.mediaUrl}
                        onChange={(e) => setNewTemplateForm({ ...newTemplateForm, mediaUrl: e.target.value })}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.85rem', boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.7rem',
                          borderRadius: '6px',
                          border: '1px dashed var(--gold-deep)',
                          background: 'rgba(224, 168, 46, 0.08)',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          fontWeight: 600,
                          color: 'var(--ink)'
                        }}>
                          📁 Choose {newTemplateForm.headerFormat.toLowerCase()} file from PC
                          <input
                            type="file"
                            accept={newTemplateForm.headerFormat === 'IMAGE' ? 'image/*' : newTemplateForm.headerFormat === 'VIDEO' ? 'video/*' : '.pdf,.doc,.docx'}
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = () => {
                                  setNewTemplateForm(prev => ({ ...prev, mediaUrl: reader.result }));
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        {newTemplateForm.mediaUrl && (
                          <button
                            type="button"
                            onClick={() => setNewTemplateForm(prev => ({ ...prev, mediaUrl: '' }))}
                            style={{ fontSize: '0.75rem', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Remove file
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Body (Required) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>
                      3. Template Body <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <span style={{ fontSize: '0.75rem', color: (newTemplateForm.body?.length || 0) > 1024 ? '#ef4444' : 'var(--muted)' }}>
                      {newTemplateForm.body?.length || 0} / 1024
                    </span>
                  </div>

                  {/* Body Toolbar */}
                  <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const matches = [...(newTemplateForm.body || '').matchAll(/\{\{(\d+)\}\}/g)];
                        const highest = matches.length > 0 ? Math.max(...matches.map(m => parseInt(m[1], 10))) : 0;
                        const nextNum = highest + 1;
                        const nextTag = `{{${nextNum}}}`;
                        setNewTemplateForm(prev => ({
                          ...prev,
                          body: (prev.body || '') + (prev.body?.endsWith(' ') || !prev.body ? '' : ' ') + nextTag,
                          bodySampleValues: {
                            ...prev.bodySampleValues,
                            [nextNum]: prev.bodySampleValues[nextNum] || (nextNum === 1 ? 'Rahul' : nextNum === 2 ? 'FinMantra' : `Sample ${nextNum}`)
                          }
                        }));
                      }}
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '5px',
                        border: '1px solid var(--gold-deep)',
                        background: 'rgba(224, 168, 46, 0.15)',
                        color: 'var(--gold-deep)',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <Plus size={13} /> Add Variable {'{{n}}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTemplateForm(p => ({ ...p, body: p.body + '*bold text*' }))}
                      style={{ padding: '0.3rem 0.55rem', borderRadius: '5px', border: '1px solid var(--line)', background: 'var(--paper-2)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      *B*
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTemplateForm(p => ({ ...p, body: p.body + '_italic text_' }))}
                      style={{ padding: '0.3rem 0.55rem', borderRadius: '5px', border: '1px solid var(--line)', background: 'var(--paper-2)', fontSize: '0.78rem', fontStyle: 'italic', cursor: 'pointer' }}
                    >
                      _I_
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTemplateForm(p => ({ ...p, body: p.body + '~strikethrough~' }))}
                      style={{ padding: '0.3rem 0.55rem', borderRadius: '5px', border: '1px solid var(--line)', background: 'var(--paper-2)', fontSize: '0.78rem', textDecoration: 'line-through', cursor: 'pointer' }}
                    >
                      ~S~
                    </button>
                  </div>

                  <textarea
                    rows={5}
                    maxLength={1024}
                    placeholder="Hello {{1}}, congratulations! Your application with {{2}} is approved. Click below to continue."
                    value={newTemplateForm.body}
                    onChange={(e) => setNewTemplateForm({ ...newTemplateForm, body: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', lineHeight: 1.5, boxSizing: 'border-box' }}
                  />

                  {/* Dynamic Body Sample Values Form (Meta Requirement) */}
                  {(() => {
                    const matches = [...(newTemplateForm.body || '').matchAll(/\{\{(\d+)\}\}/g)];
                    const uniqueVars = Array.from(new Set(matches.map(m => parseInt(m[1], 10)))).sort((a, b) => a - b);
                    if (uniqueVars.length === 0) return null;
                    return (
                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '8px', background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--ink)' }}>
                          Meta Variable Samples (Required for Approval):
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
                          {uniqueVars.map(vNum => (
                            <div key={vNum}>
                              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.15rem' }}>
                                Variable {'{{' + vNum + '}}'}
                              </label>
                              <input
                                type="text"
                                placeholder={`e.g. ${vNum === 1 ? 'Rahul' : vNum === 2 ? 'FinMantra' : 'Sample'}`}
                                value={(newTemplateForm.bodySampleValues || {})[vNum] || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setNewTemplateForm(prev => ({
                                    ...prev,
                                    bodySampleValues: {
                                      ...(prev.bodySampleValues || {}),
                                      [vNum]: val
                                    }
                                  }));
                                }}
                                style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '5px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: '0.8rem', boxSizing: 'border-box' }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 4. Footer (Optional) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>
                      4. Footer Text (Optional)
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {newTemplateForm.footerText?.length || 0} / 60
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={60}
                    placeholder="e.g. Reply STOP to unsubscribe • FinMantra Advisory"
                    value={newTemplateForm.footerText}
                    onChange={(e) => setNewTemplateForm({ ...newTemplateForm, footerText: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                </div>

                {/* 5. Buttons (Optional) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem', textTransform: 'uppercase', color: 'var(--muted)' }}>
                    5. Interactive Buttons
                  </label>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    {[
                      { id: 'NONE', label: 'None' },
                      { id: 'CTA', label: '🔗 Call To Action (CTA)' },
                      { id: 'QUICK_REPLIES', label: '💬 Quick Replies' },
                      { id: 'OTP', label: '🔑 Authentication (OTP)' }
                    ].map(bt => {
                      const isSel = newTemplateForm.buttons.buttonType === bt.id;
                      return (
                        <button
                          key={bt.id}
                          type="button"
                          onClick={() => setNewTemplateForm(p => ({
                            ...p,
                            buttons: { ...p.buttons, buttonType: bt.id }
                          }))}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            border: isSel ? '2px solid var(--gold-deep)' : '1px solid var(--line)',
                            background: isSel ? 'rgba(224, 168, 46, 0.12)' : 'var(--paper-2)',
                            fontWeight: isSel ? 700 : 500,
                            fontSize: '0.8rem',
                            color: 'var(--ink)',
                            cursor: 'pointer'
                          }}
                        >
                          {bt.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* CTA Buttons Config */}
                  {newTemplateForm.buttons.buttonType === 'CTA' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', padding: '0.75rem', borderRadius: '8px', background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                      {/* URL Button */}
                      {/* URL Button 1 */}
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--ink)' }}>
                          Website URL Button 1:
                        </div>
                        <div className="campaigns-grid-2col">
                          <input
                            type="text"
                            maxLength={25}
                            placeholder="Button Text (e.g. Track Status)"
                            value={newTemplateForm.buttons.ctaUrlText}
                            onChange={(e) => setNewTemplateForm(p => ({
                              ...p,
                              buttons: { ...p.buttons, ctaUrlText: e.target.value }
                            }))}
                            style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: '0.82rem', boxSizing: 'border-box' }}
                          />
                          <input
                            type="text"
                            placeholder="URL (e.g. https://thefinmantra.com/contact-center)"
                            value={newTemplateForm.buttons.ctaUrlValue}
                            onChange={(e) => setNewTemplateForm(p => ({
                              ...p,
                              buttons: { ...p.buttons, ctaUrlValue: e.target.value }
                            }))}
                            style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: '0.82rem', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>

                      {/* URL Button 2 (Unsubscribe / Direct Link) */}
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--ink)' }}>
                          Website URL Button 2 (Unsubscribe / Custom URL):
                        </div>
                        <div className="campaigns-grid-2col">
                          <input
                            type="text"
                            maxLength={25}
                            placeholder="Button Text (e.g. Unsubscribe)"
                            value={newTemplateForm.buttons.ctaUrl2Text}
                            onChange={(e) => setNewTemplateForm(p => ({
                              ...p,
                              buttons: { ...p.buttons, ctaUrl2Text: e.target.value }
                            }))}
                            style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: '0.82rem', boxSizing: 'border-box' }}
                          />
                          <input
                            type="text"
                            placeholder="URL (e.g. https://thefinmantra.com/unsubscribe?utm_channel=whatsapp&id={{1}})"
                            value={newTemplateForm.buttons.ctaUrl2Value}
                            onChange={(e) => setNewTemplateForm(p => ({
                              ...p,
                              buttons: { ...p.buttons, ctaUrl2Value: e.target.value }
                            }))}
                            style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: '0.82rem', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>

                      {/* Phone Call Button */}
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--ink)' }}>
                          Call Phone Number Button (Optional):
                        </div>
                        <div className="campaigns-grid-2col">
                          <input
                            type="text"
                            maxLength={25}
                            placeholder="Button Text (e.g. Call Support)"
                            value={newTemplateForm.buttons.ctaPhoneText}
                            onChange={(e) => setNewTemplateForm(p => ({
                              ...p,
                              buttons: { ...p.buttons, ctaPhoneText: e.target.value }
                            }))}
                            style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: '0.82rem', boxSizing: 'border-box' }}
                          />
                          <input
                            type="text"
                            placeholder="Phone with country code (+918796736100)"
                            value={newTemplateForm.buttons.ctaPhoneValue}
                            onChange={(e) => setNewTemplateForm(p => ({
                              ...p,
                              buttons: { ...p.buttons, ctaPhoneValue: e.target.value }
                            }))}
                            style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: '0.82rem', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Replies Config */}
                  {newTemplateForm.buttons.buttonType === 'QUICK_REPLIES' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', borderRadius: '8px', background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink)' }}>Quick Reply Button Labels (up to 3):</div>
                      {(newTemplateForm.buttons.quickReplies || []).map((qr, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--muted)', width: '20px' }}>{idx + 1}.</span>
                          <input
                            type="text"
                            maxLength={25}
                            placeholder={`Button ${idx + 1} text (e.g. Interested)`}
                            value={qr}
                            onChange={(e) => {
                              const updated = [...(newTemplateForm.buttons.quickReplies || [])];
                              updated[idx] = e.target.value;
                              setNewTemplateForm(p => ({
                                ...p,
                                buttons: { ...p.buttons, quickReplies: updated }
                              }));
                            }}
                            style={{ flex: 1, padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: '0.82rem' }}
                          />
                          {(newTemplateForm.buttons.quickReplies || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = newTemplateForm.buttons.quickReplies.filter((_, i) => i !== idx);
                                setNewTemplateForm(p => ({
                                  ...p,
                                  buttons: { ...p.buttons, quickReplies: updated }
                                }));
                              }}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}
                            >
                              <X size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                      {(newTemplateForm.buttons.quickReplies || []).length < 3 && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewTemplateForm(p => ({
                              ...p,
                              buttons: {
                                ...p.buttons,
                                quickReplies: [...(p.buttons.quickReplies || []), '']
                              }
                            }));
                          }}
                          style={{
                            alignSelf: 'flex-start',
                            padding: '0.3rem 0.6rem',
                            borderRadius: '5px',
                            border: '1px dashed var(--line)',
                            background: 'var(--paper)',
                            color: 'var(--ink)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            marginTop: '0.2rem'
                          }}
                        >
                          + Add Quick Reply Button
                        </button>
                      )}
                    </div>
                  )}

                  {/* OTP Button Config */}
                  {newTemplateForm.buttons.buttonType === 'OTP' && (
                    <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(22, 163, 123, 0.08)', border: '1px solid rgba(22, 163, 123, 0.3)', fontSize: '0.82rem' }}>
                      <div style={{ fontWeight: 700, color: '#16a37b', marginBottom: '0.2rem' }}>
                        🔑 Authentication OTP Button
                      </div>
                      <div style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                        Meta will automatically add a native <strong>Copy Code</strong> button with one-tap clipboard copy for OTP verification.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: LIVE WHATSAPP DEVICE SIMULATION */}
              <div style={{ background: '#0c1317', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }}>
                <div style={{ fontSize: '0.78rem', color: '#8696a0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.75rem' }}>
                  Live WhatsApp Preview
                </div>

                {/* Smartphone Card */}
                <div style={{
                  width: '100%',
                  maxWidth: '340px',
                  background: '#0b141a',
                  borderRadius: '24px',
                  border: '8px solid #1f2c34',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {/* WhatsApp Top Header Bar */}
                  <div style={{ background: '#202c33', padding: '0.65rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#e9edef' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.85rem' }}>
                      FM
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        FinMantra Official
                        <CheckCircle2 size={13} style={{ color: '#25D366' }} />
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#8696a0' }}>Official Business Account</div>
                    </div>
                  </div>

                  {/* WhatsApp Chat Canvas */}
                  <div style={{
                    padding: '1rem 0.75rem',
                    background: '#0b141a',
                    backgroundImage: 'radial-gradient(#1f2c34 1px, transparent 1px)',
                    backgroundSize: '16px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    {/* WhatsApp Message Bubble */}
                    <div style={{
                      background: '#202c33',
                      borderRadius: '10px 10px 10px 2px',
                      color: '#e9edef',
                      overflow: 'hidden',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                      maxWidth: '92%'
                    }}>
                      {/* Media Header Preview */}
                      {newTemplateForm.headerFormat === 'IMAGE' && (
                        <div style={{ background: '#111b21', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8696a0', fontSize: '0.8rem', overflow: 'hidden' }}>
                          {newTemplateForm.mediaUrl ? (
                            <img src={newTemplateForm.mediaUrl} alt="Header" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                          ) : (
                            <span>🖼️ [Image Header Preview]</span>
                          )}
                        </div>
                      )}

                      {newTemplateForm.headerFormat === 'VIDEO' && (
                        <div style={{ background: '#111b21', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8696a0', fontSize: '0.8rem' }}>
                          🎥 [Video Header Preview]
                        </div>
                      )}

                      {newTemplateForm.headerFormat === 'DOCUMENT' && (
                        <div style={{ background: '#111b21', padding: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #2a3942', color: '#e9edef', fontSize: '0.8rem' }}>
                          <FileText size={20} style={{ color: '#25D366' }} />
                          <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Document_Attachment.pdf</div>
                        </div>
                      )}

                      {newTemplateForm.headerFormat === 'TEXT' && newTemplateForm.headerText && (
                        <div style={{ padding: '0.65rem 0.75rem 0.25rem 0.75rem', fontWeight: 800, fontSize: '0.92rem', color: '#e9edef' }}>
                          {newTemplateForm.headerText.replace(/\{\{1\}\}/g, newTemplateForm.headerSample || '{{1}}')}
                        </div>
                      )}

                      {/* Body Content */}
                      <div style={{ padding: '0.65rem 0.75rem 0.35rem 0.75rem', fontSize: '0.84rem', lineHeight: 1.45, whiteSpace: 'pre-wrap', color: '#e9edef' }}>
                        {(() => {
                          let text = newTemplateForm.body || 'Type your message template body on the left...';
                          text = text.replace(/\{\{(\d+)\}\}/g, (match, p1) => {
                            const val = (newTemplateForm.bodySampleValues || {})[p1];
                            return val && val.trim() ? val : match;
                          });
                          return text;
                        })()}
                      </div>

                      {/* Footer Content */}
                      {newTemplateForm.footerText && (
                        <div style={{ padding: '0 0.75rem 0.35rem 0.75rem', fontSize: '0.7rem', color: '#8696a0' }}>
                          {newTemplateForm.footerText}
                        </div>
                      )}

                      {/* Time & Read Receipts */}
                      <div style={{ padding: '0 0.75rem 0.4rem 0.75rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.2rem', fontSize: '0.65rem', color: '#8696a0' }}>
                        <span>10:45 AM</span>
                        <CheckCheck size={12} style={{ color: '#53bdeb' }} />
                      </div>

                      {/* Button Actions in Message Card */}
                      {newTemplateForm.buttons.buttonType === 'CTA' && (
                        <div style={{ borderTop: '1px solid #2a3942', display: 'flex', flexDirection: 'column' }}>
                          {newTemplateForm.buttons.ctaUrlText && (
                            <div style={{ padding: '0.6rem', textAlign: 'center', color: '#53bdeb', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', borderBottom: (newTemplateForm.buttons.ctaUrl2Text || newTemplateForm.buttons.ctaPhoneText) ? '1px solid #2a3942' : 'none' }}>
                              <ArrowUpRight size={14} />
                              {newTemplateForm.buttons.ctaUrlText}
                            </div>
                          )}
                          {newTemplateForm.buttons.ctaUrl2Text && (
                            <div style={{ padding: '0.6rem', textAlign: 'center', color: '#53bdeb', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', borderBottom: newTemplateForm.buttons.ctaPhoneText ? '1px solid #2a3942' : 'none' }}>
                              <ArrowUpRight size={14} />
                              {newTemplateForm.buttons.ctaUrl2Text}
                            </div>
                          )}
                          {newTemplateForm.buttons.ctaPhoneText && (
                            <div style={{ padding: '0.6rem', textAlign: 'center', color: '#53bdeb', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                              <PhoneCall size={14} />
                              {newTemplateForm.buttons.ctaPhoneText}
                            </div>
                          )}
                        </div>
                      )}

                      {newTemplateForm.buttons.buttonType === 'OTP' && (
                        <div style={{ borderTop: '1px solid #2a3942', padding: '0.6rem', textAlign: 'center', color: '#53bdeb', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                          <ShieldCheck size={15} /> Copy Code
                        </div>
                      )}
                    </div>

                    {/* Quick Replies Outside Bubble */}
                    {newTemplateForm.buttons.buttonType === 'QUICK_REPLIES' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxWidth: '92%' }}>
                        {(newTemplateForm.buttons.quickReplies || []).filter(q => q && q.trim()).map((qr, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: '#202c33',
                              borderRadius: '8px',
                              padding: '0.55rem',
                              textAlign: 'center',
                              color: '#53bdeb',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.25)'
                            }}
                          >
                            {qr}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--paper-2)', flexShrink: 0 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                Template will be submitted to Meta for automated verification &amp; approval.
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateTemplateModal(false)}
                  style={{ padding: '0.55rem 1.1rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isCreatingTemplate}
                  onClick={async () => {
                    if (!newTemplateForm.name.trim() || !newTemplateForm.body.trim()) {
                      showToast('Please enter both Template Name and Body.', 'error');
                      return;
                    }
                    setIsCreatingTemplate(true);
                    try {
                      const res = await fetch(`${API_URL}/campaigns/templates`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                          ...newTemplateForm,
                          meta_phone_number_id: templateTargetPhoneId
                        })
                      });
                      const data = await res.json();
                      if (res.ok && data.success) {
                        showToast(`Template "${newTemplateForm.name}" created and synced with Meta!`, 'success');
                        setShowCreateTemplateModal(false);
                        fetchTemplates();
                      } else {
                        showToast(data.error || 'Failed to register template with Meta.', 'error');
                      }
                    } catch (err) {
                      showToast('Network error creating template.', 'error');
                    } finally {
                      setIsCreatingTemplate(false);
                    }
                  }}
                  style={{
                    padding: '0.55rem 1.35rem',
                    borderRadius: '6px',
                    background: '#25D366',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: isCreatingTemplate ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)'
                  }}
                >
                  {isCreatingTemplate ? <RefreshCw size={15} className="spin-slow" /> : <Send size={15} />}
                  {isCreatingTemplate ? 'Registering with Meta...' : 'Submit Template to Meta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: VIEW BROADCAST DELIVERY LOGS */}
      {/* ========================================================================= */}
      {viewingLogsBroadcast && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '16px', maxWidth: '820px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  Delivery Logs: {viewingLogsBroadcast.name}
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                  Channel: <strong style={{ textTransform: 'capitalize' }}>{viewingLogsBroadcast.channel}</strong> • Targeted: <strong>{viewingLogsBroadcast.targeted_count || 0}</strong> • Delivered: <strong style={{ color: '#16a37b' }}>{viewingLogsBroadcast.delivered_count || 0}</strong> • Failed: <strong style={{ color: '#ef4444' }}>{viewingLogsBroadcast.failed_count || 0}</strong>
                </div>
              </div>
              <button onClick={() => setViewingLogsBroadcast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
              {isLoadingLogs ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                  <RefreshCw size={24} className="spin-slow" style={{ color: 'var(--gold-deep)', marginBottom: '0.5rem' }} />
                  <div>Fetching delivery logs...</div>
                </div>
              ) : broadcastLogs.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                  <Info size={32} style={{ color: 'var(--line)', marginBottom: '0.5rem' }} />
                  <div style={{ fontWeight: 600 }}>No delivery log records found for this broadcast yet.</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Logs are recorded in real-time as each recipient contact is contacted.</div>
                </div>
              ) : (
                <div className="campaigns-table-wrapper">
                  <table className="campaigns-table">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Recipient</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Channel</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Details / Error Reason</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {broadcastLogs.map(log => (
                        <tr key={log.id} style={{ borderBottom: '1px solid var(--line)' }} className="table-row-hover">
                          <td style={{ padding: '0.6rem 0.75rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{log.lead_name || 'Recipient'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                              {log.lead_contact || ''} {log.lead_mail ? `• ${log.lead_mail}` : ''}
                            </div>
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textTransform: 'capitalize', fontSize: '0.8rem' }}>
                            {log.channel}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem' }}>
                            <span style={{
                              padding: '0.15rem 0.5rem',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: log.status === 'sent' || log.status === 'delivered' ? 'rgba(22, 163, 123, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                              color: log.status === 'sent' || log.status === 'delivered' ? '#16a37b' : '#ef4444'
                            }}>
                              {log.status === 'sent' || log.status === 'delivered' ? 'Delivered' : 'Failed'}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: log.error_message ? '#ef4444' : '#16a37b', maxWidth: '300px', wordBreak: 'break-word' }}>
                            {log.error_message || 'Sent & delivered successfully.'}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                            {log.sent_at ? new Date(log.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ padding: '0.85rem 1.5rem', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', background: 'var(--paper-2)' }}>
              <button
                type="button"
                onClick={() => setViewingLogsBroadcast(null)}
                style={{ padding: '0.45rem 1.1rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ADD / EDIT SMTP ACCOUNT MODAL */}
      {/* ========================================================================= */}
      {showSmtpModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '16px', maxWidth: '580px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Mail size={18} style={{ color: 'var(--gold-deep)' }} />
                  {editingSmtpAccount ? 'Edit SMTP Gateway Account' : 'Add New SMTP Gateway Account'}
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                  {editingSmtpAccount ? `Editing account ${editingSmtpAccount.name}` : 'Configure custom host credentials for outbound email broadcasts.'}
                </div>
              </div>
              <button onClick={() => setShowSmtpModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSmtpAccountModal} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                    Account Display Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. FinMantra Primary Gmail"
                    value={smtpAccountForm.name}
                    onChange={(e) => setSmtpAccountForm({ ...smtpAccountForm, name: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div className="campaigns-grid-2col">
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                      SMTP Host <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. smtp.gmail.com"
                      value={smtpAccountForm.host}
                      onChange={(e) => setSmtpAccountForm({ ...smtpAccountForm, host: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                      SMTP Port &amp; Encryption
                    </label>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <input
                        type="text"
                        placeholder="465"
                        value={smtpAccountForm.port}
                        onChange={(e) => setSmtpAccountForm({ ...smtpAccountForm, port: e.target.value })}
                        style={{ width: '80px', padding: '0.55rem 0.5rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', textAlign: 'center' }}
                      />
                      <select
                        value={smtpAccountForm.secure}
                        onChange={(e) => setSmtpAccountForm({ ...smtpAccountForm, secure: e.target.value })}
                        style={{ flex: 1, padding: '0.55rem 0.5rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.84rem' }}
                      >
                        <option value="true">SSL (465)</option>
                        <option value="false">TLS / Plain (587)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                    SMTP Username / Login Email <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    autoComplete="username"
                    placeholder="e.g. spikemarketingsolutions25@gmail.com"
                    value={smtpAccountForm.username}
                    onChange={(e) => setSmtpAccountForm({ ...smtpAccountForm, username: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                    SMTP Password / Google App Password {editingSmtpAccount ? '(Leave blank to keep unchanged)' : <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder={editingSmtpAccount ? '•••••••••••• (Unchanged)' : '16-character App Password'}
                    value={smtpAccountForm.password}
                    onChange={(e) => setSmtpAccountForm({ ...smtpAccountForm, password: e.target.value })}
                    required={!editingSmtpAccount}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div className="campaigns-grid-2col">
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                      From Name
                    </label>
                    <input
                      type="text"
                      placeholder="FinMantra"
                      value={smtpAccountForm.fromName}
                      onChange={(e) => setSmtpAccountForm({ ...smtpAccountForm, fromName: e.target.value })}
                      style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                      From Email Address <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="email"
                      placeholder="spikemarketingsolutions25@gmail.com"
                      value={smtpAccountForm.fromEmail}
                      onChange={(e) => setSmtpAccountForm({ ...smtpAccountForm, fromEmail: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="isDefaultSmtp"
                    checked={smtpAccountForm.isDefault}
                    onChange={(e) => setSmtpAccountForm({ ...smtpAccountForm, isDefault: e.target.checked })}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                  <label htmlFor="isDefaultSmtp" style={{ fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}>
                    Set as Primary Default Outbound SMTP Account
                  </label>
                </div>
              </div>

              <div style={{ padding: '0.85rem 1.5rem', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--paper-2)', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={handleTestModalSmtp}
                  disabled={isTestingModalSmtp}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.5rem 0.9rem',
                    borderRadius: '6px',
                    background: 'var(--paper)',
                    color: 'var(--ink)',
                    border: '1px solid var(--line)',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: isTestingModalSmtp ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isTestingModalSmtp ? <RefreshCw size={14} className="spin-slow" /> : <Zap size={14} style={{ color: 'var(--gold-deep)' }} />}
                  {isTestingModalSmtp ? 'Testing...' : 'Test Connection'}
                </button>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowSmtpModal(false)}
                    style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSmtpAccount}
                    style={{
                      padding: '0.5rem 1.25rem',
                      borderRadius: '6px',
                      background: 'var(--gold-deep)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      cursor: isSavingSmtpAccount ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isSavingSmtpAccount ? 'Saving...' : (editingSmtpAccount ? 'Update Account' : 'Save Account')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
