import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Mail, MessageSquare, Plus, Trash2, Search, Upload, RefreshCw, X, Check,
  AlertCircle, Download, FileSpreadsheet, Play, Settings as SettingsIcon, HelpCircle, Info, Zap, Database, FileText,
  Clock, Edit2, Lock, BarChart3, TrendingUp, Filter, Eye, CheckCircle2, XCircle, ChevronRight, Calendar, PhoneCall,
  Share2, ArrowUpRight, ShieldCheck, CheckCheck, Send, Smartphone
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
  const [dashRecentSearch, setDashRecentSearch] = useState('');

  // Templates Manager state
  const [templates, setTemplates] = useState([]);
  const [metaStatuses, setMetaStatuses] = useState({});
  const [templateViewMode, setTemplateViewMode] = useState('chat'); // 'chat' | 'table'
  const [templateSearch, setTemplateSearch] = useState('');
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

  const handleSetDefaultSmtp = handleSetDefaultSmtpAccount;
  const handleOpenEditSmtp = handleOpenEditSmtpModal;
  const handleDeleteSmtp = handleDeleteSmtpAccount;

  const handleDeleteTemplate = async (id, name) => {
    if (!window.confirm(`Delete template "${name || id}" permanently?`)) return;
    try {
      const res = await fetch(`${API_URL}/campaigns/templates/${id}`, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Template deleted successfully.', 'success');
        fetchTemplates();
      } else {
        showToast(data.error || 'Failed to delete template.', 'error');
      }
    } catch (err) {
      showToast('Network error deleting template.', 'error');
    }
  };

  const handleEditTemplate = (t) => {
    setEditingTemplateId(t.id);
    let parsedBtns = {
      buttonType: 'NONE',
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
    };

    if (t.buttons) {
      if (typeof t.buttons === 'object' && !Array.isArray(t.buttons)) {
        parsedBtns = { ...parsedBtns, ...t.buttons };
      } else if (typeof t.buttons === 'string') {
        try {
          const parsed = JSON.parse(t.buttons);
          if (Array.isArray(parsed)) {
            parsed.forEach((b, idx) => {
              if (b.type === 'URL' && idx === 0) {
                parsedBtns.buttonType = 'CTA_URL';
                parsedBtns.ctaUrlText = b.text || '';
                parsedBtns.ctaUrlValue = b.url || '';
              } else if (b.type === 'URL' && idx === 1) {
                parsedBtns.ctaUrl2Text = b.text || '';
                parsedBtns.ctaUrl2Value = b.url || '';
              } else if (b.type === 'PHONE_NUMBER' || b.type === 'PHONE') {
                parsedBtns.buttonType = 'CTA_PHONE';
                parsedBtns.ctaPhoneText = b.text || '';
                parsedBtns.ctaPhoneValue = b.phone_number || '';
              } else if (b.type === 'QUICK_REPLY') {
                parsedBtns.buttonType = 'QUICK_REPLIES';
              }
            });
          } else if (typeof parsed === 'object') {
            parsedBtns = { ...parsedBtns, ...parsed };
          }
        } catch (e) {}
      } else if (Array.isArray(t.buttons)) {
        t.buttons.forEach((b, idx) => {
          if (b.type === 'URL' && idx === 0) {
            parsedBtns.buttonType = 'CTA_URL';
            parsedBtns.ctaUrlText = b.text || '';
            parsedBtns.ctaUrlValue = b.url || '';
          } else if (b.type === 'URL' && idx === 1) {
            parsedBtns.ctaUrl2Text = b.text || '';
            parsedBtns.ctaUrl2Value = b.url || '';
          } else if (b.type === 'PHONE_NUMBER' || b.type === 'PHONE') {
            parsedBtns.buttonType = 'CTA_PHONE';
            parsedBtns.ctaPhoneText = b.text || '';
            parsedBtns.ctaPhoneValue = b.phone_number || '';
          } else if (b.type === 'QUICK_REPLY') {
            parsedBtns.buttonType = 'QUICK_REPLIES';
          }
        });
      }
    }

    setNewTemplateForm({
      name: t.name || '',
      type: t.type || 'whatsapp',
      subject: t.subject || '',
      body: t.body || '',
      metaTemplateName: t.meta_template_name || t.name || '',
      category: (t.category || 'UTILITY').toUpperCase(),
      language: t.language || 'en_US',
      headerFormat: t.header_format || 'NONE',
      headerText: t.header_text || '',
      headerSample: t.header_sample || '',
      mediaUrl: t.media_url || '',
      footerText: t.footer_text || '',
      bodySampleValues: t.body_sample_values || {},
      buttons: parsedBtns
    });
    setShowCreateTemplateModal(true);
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

  const handleDeleteMasterSingle = async (leadId, label) => {
    if (!window.confirm(`Delete contact "${label || leadId}" permanently from Master Data Center?`)) return;
    try {
      const res = await fetch(`${API_URL}/campaigns/master/leads/delete-bulk`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ leadIds: [leadId] })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Contact deleted successfully.', 'success');
        fetchMasterLeads();
        fetchMasterFilterOptions();
      } else {
        showToast(data.error || 'Failed to delete contact.', 'error');
      }
    } catch (err) {
      showToast('Network error deleting contact.', 'error');
    }
  };

  const handleDeleteMasterLead = handleDeleteMasterSingle;
  const handleExportMasterCsv = handleExportMasterData;

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
      <div className="campaigns-header">
        <div>
          <h2 className="campaigns-header-title">
            <Zap size={22} style={{ color: 'var(--gold-deep)' }} />
            OmniChannel Campaigns &amp; Broadcast Center
          </h2>
          <p className="campaigns-header-desc">
            Direct Meta WhatsApp &amp; SMTP broadcast dispatch, unified master repository, and real-time delivery analytics.
          </p>
        </div>
      </div>

      {/* Subtab Navigation Bar */}
      <div className="campaigns-subnav">
        <button
          onClick={() => setActiveSubTab('communication_dashboard')}
          className={activeSubTab === 'communication_dashboard' ? 'active' : ''}
        >
          <BarChart3 size={15} />
          Communication Dashboard
        </button>

        <button
          onClick={() => setActiveSubTab('master_data')}
          className={activeSubTab === 'master_data' ? 'active' : ''}
        >
          <Database size={15} />
          Master Data Center
        </button>

        <button
          onClick={() => setActiveSubTab('broadcast')}
          className={activeSubTab === 'broadcast' ? 'active' : ''}
        >
          <MessageSquare size={15} />
          Broadcast Campaigns
        </button>

        <button
          onClick={() => setActiveSubTab('templates')}
          className={activeSubTab === 'templates' ? 'active' : ''}
        >
          <FileText size={15} />
          Templates Manager
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          className={activeSubTab === 'settings' ? 'active' : ''}
        >
          <SettingsIcon size={15} />
          SMTP Gateway Settings
        </button>

        <button
          onClick={() => setActiveSubTab('guide')}
          className={activeSubTab === 'guide' ? 'active' : ''}
        >
          <HelpCircle size={15} />
          Developer Guide
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUBTAB 1: COMMUNICATION DASHBOARD */}
      {/* ========================================================================= */}
      {activeSubTab === 'communication_dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
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
                style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
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
                style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '0.25rem' }}>
                Broadcast Name
              </label>
              <select
                value={dashFilterBroadcastName}
                onChange={(e) => setDashFilterBroadcastName(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
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
                style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
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
                style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
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
                  padding: '0.48rem',
                  fontSize: '0.82rem',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                  background: 'var(--paper)',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Top KPI Metric Cards */}
          {dashboardAnalytics && (
            <div className="campaigns-kpi-grid">
              {/* Broadcasts Count */}
              <div className="campaigns-kpi-card" style={{ borderTop: '3.5px solid var(--gold-deep)' }}>
                <div className="campaigns-kpi-title">
                  <span>Total Broadcasts</span>
                  <div className="campaigns-kpi-icon-pill" style={{ background: 'rgba(224, 168, 46, 0.12)', color: 'var(--gold-deep)' }}>
                    <Zap size={15} />
                  </div>
                </div>
                <div className="campaigns-kpi-value" style={{ color: 'var(--ink)' }}>
                  {dashboardAnalytics.kpis.total_broadcasts || 0}
                </div>
                <div className="campaigns-kpi-subtext">
                  <span style={{ color: '#25D366' }}>{dashboardAnalytics.kpis.wa_broadcasts || 0} WA</span> • <span style={{ color: '#8b5cf6' }}>{dashboardAnalytics.kpis.email_broadcasts || 0} Email</span> • <span style={{ color: 'var(--gold-deep)' }}>{dashboardAnalytics.kpis.hybrid_broadcasts || 0} Hybrid</span>
                </div>
              </div>

              {/* Total Targeted */}
              <div className="campaigns-kpi-card" style={{ borderTop: '3.5px solid #3b82f6' }}>
                <div className="campaigns-kpi-title">
                  <span>Targeted Leads</span>
                  <div className="campaigns-kpi-icon-pill" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
                    <Users size={15} />
                  </div>
                </div>
                <div className="campaigns-kpi-value" style={{ color: '#3b82f6' }}>
                  {(dashboardAnalytics.kpis.total_targeted || 0).toLocaleString()}
                </div>
                <div className="campaigns-kpi-subtext" style={{ color: '#3b82f6', fontWeight: 700 }}>
                  {(dashboardAnalytics.masterStats.total_master_contacts || 0).toLocaleString()} Unique Master Contacts
                </div>
              </div>

              {/* WhatsApp Delivery Rate */}
              <div className="campaigns-kpi-card" style={{ borderTop: '3.5px solid #10b981' }}>
                <div className="campaigns-kpi-title">
                  <span>WA Delivery Rate</span>
                  <div className="campaigns-kpi-icon-pill" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                    <CheckCheck size={15} />
                  </div>
                </div>
                <div className="campaigns-kpi-value" style={{ color: '#10b981' }}>
                  {dashboardAnalytics.masterStats.sum_wa_sent > 0 
                    ? `${((dashboardAnalytics.masterStats.sum_wa_delivered / dashboardAnalytics.masterStats.sum_wa_sent) * 100).toFixed(1)}%` 
                    : '100%'}
                </div>
                <div className="campaigns-kpi-subtext">
                  {dashboardAnalytics.masterStats.sum_wa_delivered} delivered of {dashboardAnalytics.masterStats.sum_wa_sent} sent
                </div>
              </div>

              {/* WhatsApp CTR */}
              <div className="campaigns-kpi-card" style={{ borderTop: '3.5px solid #f59e0b' }}>
                <div className="campaigns-kpi-title">
                  <span>WhatsApp CTR</span>
                  <div className="campaigns-kpi-icon-pill" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                    <TrendingUp size={15} />
                  </div>
                </div>
                <div className="campaigns-kpi-value" style={{ color: '#f59e0b' }}>
                  {dashboardAnalytics.masterStats.sum_wa_delivered > 0 
                    ? `${((dashboardAnalytics.masterStats.sum_wa_clicked / dashboardAnalytics.masterStats.sum_wa_delivered) * 100).toFixed(1)}%` 
                    : '0.0%'}
                </div>
                <div className="campaigns-kpi-subtext" style={{ color: '#f59e0b', fontWeight: 700 }}>
                  {dashboardAnalytics.masterStats.sum_wa_clicked || 0} unique link clicks
                </div>
              </div>

              {/* Email Delivery Rate */}
              <div className="campaigns-kpi-card" style={{ borderTop: '3.5px solid #8b5cf6' }}>
                <div className="campaigns-kpi-title">
                  <span>Email Delivery Rate</span>
                  <div className="campaigns-kpi-icon-pill" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}>
                    <Mail size={15} />
                  </div>
                </div>
                <div className="campaigns-kpi-value" style={{ color: '#8b5cf6' }}>
                  {dashboardAnalytics.masterStats.sum_email_sent > 0 
                    ? `${((dashboardAnalytics.masterStats.sum_email_delivered / dashboardAnalytics.masterStats.sum_email_sent) * 100).toFixed(1)}%` 
                    : '100%'}
                </div>
                <div className="campaigns-kpi-subtext">
                  {dashboardAnalytics.masterStats.sum_email_delivered} delivered of {dashboardAnalytics.masterStats.sum_email_sent} sent
                </div>
              </div>

              {/* Opt-out Rate */}
              <div className="campaigns-kpi-card" style={{ borderTop: '3.5px solid #ef4444' }}>
                <div className="campaigns-kpi-title">
                  <span>Opt-out Rate</span>
                  <div className="campaigns-kpi-icon-pill" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
                    <ShieldCheck size={15} />
                  </div>
                </div>
                <div className="campaigns-kpi-value" style={{ color: '#ef4444' }}>
                  {(dashboardAnalytics.masterStats.wa_optout_count || 0) + (dashboardAnalytics.masterStats.email_optout_count || 0)}
                </div>
                <div className="campaigns-kpi-subtext">
                  <span style={{ color: '#ef4444' }}>{dashboardAnalytics.masterStats.wa_optout_count || 0} WA</span> • <span style={{ color: '#ef4444' }}>{dashboardAnalytics.masterStats.email_optout_count || 0} Email</span> opt-outs
                </div>
              </div>
            </div>
          )}
          {/* Recent Broadcasts Overview Table */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)', display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box', marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <TrendingUp size={17} style={{ color: 'var(--gold-deep)' }} />
                  Recent Broadcast Campaigns &amp; Delivery Stats
                </h3>
                <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(224, 168, 46, 0.12)', color: 'var(--gold-deep)', fontSize: '0.74rem', fontWeight: 800 }}>
                  {broadcasts.length} Total
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ position: 'relative', width: '200px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                  <input
                    type="text"
                    placeholder="Search recent..."
                    value={dashRecentSearch}
                    onChange={(e) => setDashRecentSearch(e.target.value)}
                    style={{ width: '100%', padding: '0.35rem 0.55rem 0.35rem 1.8rem', fontSize: '0.78rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', boxSizing: 'border-box' }}
                  />
                </div>
                <button onClick={() => setActiveSubTab('broadcast')} style={{ background: 'none', border: 'none', color: 'var(--gold-deep)', fontSize: '0.84rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  View All Broadcasts &rarr;
                </button>
              </div>
            </div>

            <div className="campaigns-table-wrapper">
              <table className="campaigns-table">
                <thead>
                  <tr>
                    <th>Broadcast Name</th>
                    <th>Channel</th>
                    <th>Sender</th>
                    <th>Status</th>
                    <th>Targeted</th>
                    <th>Delivered</th>
                    <th>CTR</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {broadcasts
                    .filter(b => !dashRecentSearch || (b.name && b.name.toLowerCase().includes(dashRecentSearch.toLowerCase())) || (b.channel && b.channel.toLowerCase().includes(dashRecentSearch.toLowerCase())))
                    .slice(0, 10).map(b => {
                    const displayDelivered = b.channel === 'both' 
                      ? (b.targeted_count && b.targeted_count <= b.delivered_count ? b.targeted_count : Math.ceil((b.delivered_count || 0) / 2))
                      : (b.delivered_count || b.sent_count || 0);
                    
                    const effDelivered = displayDelivered > 0 ? displayDelivered : (b.delivered_count || 1);
                    const ctr = effDelivered > 0 ? ((Math.min(b.clicked_count || 0, effDelivered) / effDelivered) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={b.id} className="table-row-hover">
                        <td style={{ fontWeight: 800, color: 'var(--ink)' }}>{b.name}</td>
                        <td>
                          <span style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            textTransform: 'capitalize',
                            background: b.channel === 'whatsapp' ? 'rgba(37, 211, 102, 0.12)' : b.channel === 'email' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(224, 168, 46, 0.12)',
                            color: b.channel === 'whatsapp' ? '#25D366' : b.channel === 'email' ? '#8b5cf6' : 'var(--gold-deep)',
                            border: `1px solid ${b.channel === 'whatsapp' ? 'rgba(37, 211, 102, 0.25)' : b.channel === 'email' ? 'rgba(139, 92, 246, 0.25)' : 'rgba(224, 168, 46, 0.25)'}`
                          }}>
                            {b.channel}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                          {b.meta_phone_number || b.sender_email || 'Default'}
                        </td>
                        <td>
                          <span 
                            onClick={() => handleOpenBroadcastLogs(b)}
                            style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              background: b.status === 'sent' ? 'rgba(22, 163, 123, 0.12)' : b.status === 'processing' ? 'rgba(59, 130, 246, 0.12)' : b.status === 'failed' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(224, 168, 46, 0.12)',
                              color: b.status === 'sent' ? '#16a37b' : b.status === 'processing' ? '#3b82f6' : b.status === 'failed' ? '#ef4444' : 'var(--gold-deep)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                            title="Click to view detailed delivery logs"
                          >
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: b.status === 'sent' ? '#16a37b' : b.status === 'processing' ? '#3b82f6' : b.status === 'failed' ? '#ef4444' : 'var(--gold-deep)' }} />
                            {b.status}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--ink)' }}>{b.targeted_count || 0}</td>
                        <td style={{ color: '#16a37b', fontWeight: 800 }}>
                          {displayDelivered}
                          {b.channel === 'both' && <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginLeft: '0.3rem' }}>(WA+Email)</span>}
                        </td>
                        <td>
                          <span style={{
                            padding: '0.18rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            background: Number(ctr) > 0 ? 'rgba(245, 158, 11, 0.15)' : 'var(--paper-2)',
                            color: Number(ctr) > 0 ? '#d97706' : 'var(--muted)',
                            border: `1px solid ${Number(ctr) > 0 ? 'rgba(245, 158, 11, 0.3)' : 'var(--line)'}`
                          }}>
                            {ctr}% ({b.clicked_count || 0})
                          </span>
                        </td>
                        <td style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                          {b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => handleOpenBroadcastLogs(b)}
                            style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '0.3rem', marginRight: '0.3rem' }}
                            title="View Delivery Logs"
                          >
                            <FileText size={15} />
                          </button>
                          <button
                            onClick={() => handleEditBroadcast(b)}
                            style={{ background: 'none', border: 'none', color: 'var(--gold-deep)', cursor: 'pointer', padding: '0.3rem', marginRight: '0.3rem' }}
                            title="Edit Broadcast"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteBroadcast(b.id, b.name)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.3rem' }}
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
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginBottom: '2.5rem' }}>
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', width: '100%', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)', padding: '1.25rem' }}>
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
                    <Trash2 size={15} /> Delete Selected ({selectedMasterDeleteIds.size})
                  </button>
                )}

                <button
                  onClick={handleExportMasterCsv}
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
                  <Download size={15} /> Export Master CSV
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="campaigns-filter-grid">
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '0.25rem' }}>
                  From Broadcast Date
                </label>
                <input
                  type="date"
                  value={masterFilterDateFrom}
                  onChange={(e) => { setMasterFilterDateFrom(e.target.value); setMasterPage(1); }}
                  style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '0.25rem' }}>
                  To Broadcast Date
                </label>
                <input
                  type="date"
                  value={masterFilterDateTo}
                  onChange={(e) => { setMasterFilterDateTo(e.target.value); setMasterPage(1); }}
                  style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '0.25rem' }}>
                  Broadcast Name
                </label>
                <select
                  value={masterFilterBroadcastName}
                  onChange={(e) => { setMasterFilterBroadcastName(e.target.value); setMasterPage(1); }}
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
                  value={masterFilterMetaWaNo}
                  onChange={(e) => { setMasterFilterMetaWaNo(e.target.value); setMasterPage(1); }}
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
                  value={masterFilterSenderEmail}
                  onChange={(e) => { setMasterFilterSenderEmail(e.target.value); setMasterPage(1); }}
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
                    setMasterFilterDateFrom('');
                    setMasterFilterDateTo('');
                    setMasterFilterBroadcastName('');
                    setMasterFilterMetaWaNo('');
                    setMasterFilterSenderEmail('');
                    setMasterPage(1);
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

            {/* Master Contacts Table */}
            <div className="campaigns-table-wrapper">
              {isLoadingMaster ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                  <RefreshCw size={28} className="spin-slow" style={{ color: 'var(--gold-deep)', marginBottom: '0.75rem' }} />
                  <div>Loading master repository...</div>
                </div>
              ) : masterContacts.length === 0 ? (
                <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--muted)' }}>
                  <Database size={36} style={{ color: 'var(--line)', marginBottom: '0.75rem' }} />
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No master records found.</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Contacts will appear here automatically when uploaded via broadcasts.</div>
                </div>
              ) : (
                <table className="campaigns-table">
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--paper-2)', zIndex: 10 }}>
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      <th style={{ width: '40px', padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={masterContacts.length > 0 && masterContacts.every(c => selectedMasterDeleteIds.has(c.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMasterDeleteIds(new Set(masterContacts.map(c => c.id)));
                            } else {
                              setSelectedMasterDeleteIds(new Set());
                            }
                          }}
                        />
                      </th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>FinMantra ID</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Campaign ID</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Name</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Contact / Phone</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Email Address</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Address</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>WA Opt-in</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Email Opt-in</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>WA Rates (Del/CTR)</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Email Rates (Del/CTR)</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>Last Broadcast</th>
                      <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masterContacts.map(c => {
                      const waDel = c.wa_sent_count > 0 ? ((c.wa_delivered_count / c.wa_sent_count) * 100).toFixed(0) : '0';
                      const waCtr = c.wa_delivered_count > 0 ? ((c.wa_clicked_count / c.wa_delivered_count) * 100).toFixed(0) : '0';
                      const emDel = c.email_sent_count > 0 ? ((c.email_delivered_count / c.email_sent_count) * 100).toFixed(0) : '0';
                      const emCtr = c.email_delivered_count > 0 ? ((c.email_clicked_count / c.email_delivered_count) * 100).toFixed(0) : '0';

                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--line)' }} className="table-row-hover">
                          <td style={{ textAlign: 'center', padding: '0.65rem 0.5rem' }}>
                            <input
                              type="checkbox"
                              checked={selectedMasterDeleteIds.has(c.id)}
                              onChange={(e) => {
                                const newSet = new Set(selectedMasterDeleteIds);
                                if (e.target.checked) newSet.add(c.id);
                                else newSet.delete(c.id);
                                setSelectedMasterDeleteIds(newSet);
                              }}
                            />
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--gold-deep)' }}>
                            {c.finmantra_id || c.id}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--muted)' }}>
                            {c.campaign_data_id || '—'}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>{c.name || '—'}</td>
                          <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.82rem' }}>{c.contact || '—'}</td>
                          <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.82rem', color: 'var(--muted)' }}>{c.mail || '—'}</td>
                          <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: 'var(--muted)', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.address || '—'}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`${API_URL}/campaigns/master-leads/${c.id}/toggle-optin`, {
                                    method: 'POST',
                                    headers,
                                    body: JSON.stringify({ channel: 'whatsapp', optin: c.whatsapp_optin === false ? true : false })
                                  });
                                  if (res.ok) {
                                    setMasterContacts(prev => prev.map(m => m.id === c.id ? { ...m, whatsapp_optin: c.whatsapp_optin === false ? true : false } : m));
                                    showToast(`WhatsApp opt-in updated for ${c.name || c.contact}`, 'success');
                                  }
                                } catch (e) {
                                  showToast('Failed to toggle opt-in', 'error');
                                }
                              }}
                              style={{
                                border: 'none',
                                background: c.whatsapp_optin !== false ? 'rgba(22, 163, 123, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                color: c.whatsapp_optin !== false ? '#16a37b' : '#ef4444',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '999px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                              title="Click to toggle WhatsApp Opt-in"
                            >
                              {c.whatsapp_optin !== false ? '✓ Opted In' : '✕ Opted Out'}
                            </button>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`${API_URL}/campaigns/master-leads/${c.id}/toggle-optin`, {
                                    method: 'POST',
                                    headers,
                                    body: JSON.stringify({ channel: 'email', optin: c.email_optin === false ? true : false })
                                  });
                                  if (res.ok) {
                                    setMasterContacts(prev => prev.map(m => m.id === c.id ? { ...m, email_optin: c.email_optin === false ? true : false } : m));
                                    showToast(`Email opt-in updated for ${c.name || c.mail}`, 'success');
                                  }
                                } catch (e) {
                                  showToast('Failed to toggle opt-in', 'error');
                                }
                              }}
                              style={{
                                border: 'none',
                                background: c.email_optin !== false ? 'rgba(22, 163, 123, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                color: c.email_optin !== false ? '#16a37b' : '#ef4444',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '999px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                              title="Click to toggle Email Opt-in"
                            >
                              {c.email_optin !== false ? '✓ Opted In' : '✕ Opted Out'}
                            </button>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <span style={{ fontSize: '0.74rem', padding: '0.18rem 0.45rem', borderRadius: '4px', background: 'var(--paper-2)', border: '1px solid var(--line)', fontWeight: 700, color: Number(waCtr) > 0 ? '#d97706' : 'var(--muted)' }}>
                              Del: {waDel}% | CTR: {waCtr}%
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <span style={{ fontSize: '0.74rem', padding: '0.18rem 0.45rem', borderRadius: '4px', background: 'var(--paper-2)', border: '1px solid var(--line)', fontWeight: 700, color: Number(emCtr) > 0 ? '#d97706' : 'var(--muted)' }}>
                              Del: {emDel}% | CTR: {emCtr}%
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
                            {c.broadcast_name || '—'}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button
                              onClick={() => handleDeleteMasterSingle(c.id, c.name || c.contact)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}
                              title="Delete Contact"
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexShrink: 0, fontSize: '0.82rem', color: 'var(--muted)' }}>
              <div>
                Showing {masterContacts.length} of {masterTotal} master contacts
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  disabled={masterPage <= 1}
                  onClick={() => setMasterPage(p => Math.max(1, p - 1))}
                  style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', cursor: masterPage <= 1 ? 'not-allowed' : 'pointer' }}
                >
                  Previous
                </button>
                <span style={{ padding: '0.35rem 0.6rem', fontWeight: 700 }}>Page {masterPage}</span>
                <button
                  disabled={masterContacts.length < masterLimit}
                  onClick={() => setMasterPage(p => p + 1)}
                  style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', cursor: masterContacts.length < masterLimit ? 'not-allowed' : 'pointer' }}
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
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginBottom: '2.5rem' }}>
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', width: '100%', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)', padding: '1.25rem' }}>
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
                      <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700 }}>Scheduled / Sent Date</th>
                      <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {broadcasts.map(b => {
                      const displayDelivered = b.channel === 'both' 
                        ? (b.targeted_count && b.targeted_count <= b.delivered_count ? b.targeted_count : Math.ceil((b.delivered_count || 0) / 2))
                        : (b.delivered_count || b.sent_count || 0);
                      const effDelivered = displayDelivered > 0 ? displayDelivered : (b.delivered_count || 1);
                      const ctr = effDelivered > 0 ? ((Math.min(b.clicked_count || 0, effDelivered) / effDelivered) * 100).toFixed(1) : '0.0';

                      return (
                        <tr key={b.id} style={{ borderBottom: '1px solid var(--line)' }} className="table-row-hover">
                          <td style={{ padding: '0.75rem 0.85rem', fontWeight: 700 }}>{b.name}</td>
                          <td style={{ padding: '0.75rem 0.85rem', textTransform: 'capitalize' }}>
                            <span style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              background: b.channel === 'whatsapp' ? 'rgba(37, 211, 102, 0.12)' : b.channel === 'email' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(224, 168, 46, 0.12)',
                              color: b.channel === 'whatsapp' ? '#25D366' : b.channel === 'email' ? '#8b5cf6' : 'var(--gold-deep)',
                              border: `1px solid ${b.channel === 'whatsapp' ? 'rgba(37, 211, 102, 0.25)' : b.channel === 'email' ? 'rgba(139, 92, 246, 0.25)' : 'rgba(224, 168, 46, 0.25)'}`
                            }}>
                              {b.channel}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
                            {b.meta_phone_number || b.sender_email || 'Default'}
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem' }}>
                            <span 
                              onClick={() => handleOpenBroadcastLogs(b)}
                              style={{
                                padding: '0.25rem 0.65rem',
                                borderRadius: '999px',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                background: b.status === 'sent' ? 'rgba(22, 163, 123, 0.12)' : b.status === 'processing' ? 'rgba(59, 130, 246, 0.12)' : b.status === 'failed' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(224, 168, 46, 0.12)',
                                color: b.status === 'sent' ? '#16a37b' : b.status === 'processing' ? '#3b82f6' : b.status === 'failed' ? '#ef4444' : 'var(--gold-deep)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                              title="Click to view detailed delivery logs"
                            >
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: b.status === 'sent' ? '#16a37b' : b.status === 'processing' ? '#3b82f6' : b.status === 'failed' ? '#ef4444' : 'var(--gold-deep)' }} />
                              {b.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem', fontWeight: 600 }}>{b.targeted_count || 0}</td>
                          <td style={{ padding: '0.75rem 0.85rem', color: '#16a37b', fontWeight: 700 }}>
                            {displayDelivered}
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem' }}>
                            <span style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              background: Number(ctr) > 0 ? 'rgba(245, 158, 11, 0.15)' : 'var(--paper-2)',
                              color: Number(ctr) > 0 ? '#d97706' : 'var(--muted)',
                              border: `1px solid ${Number(ctr) > 0 ? 'rgba(245, 158, 11, 0.3)' : 'var(--line)'}`
                            }}>
                              {ctr}% ({b.clicked_count || 0})
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem', color: 'var(--muted)', fontSize: '0.8rem' }}>
                            {b.scheduled_at ? `Scheduled: ${new Date(b.scheduled_at).toLocaleString()}` : b.created_at ? new Date(b.created_at).toLocaleString() : '—'}
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button
                              onClick={() => handleOpenBroadcastLogs(b)}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: '#3b82f6',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                marginRight: '0.4rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                              title="View Delivery Logs"
                            >
                              <FileText size={13} /> Logs
                            </button>
                            <button
                              onClick={() => handleEditBroadcast(b)}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                background: 'rgba(224, 168, 46, 0.1)',
                                color: 'var(--gold-deep)',
                                border: '1px solid rgba(224, 168, 46, 0.25)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                marginRight: '0.4rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                              title="Edit Broadcast"
                            >
                              <Edit2 size={13} /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteBroadcast(b.id, b.name)}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
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
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, minHeight: 0, borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)', padding: '1.25rem', overflow: 'hidden' }}>
            {/* Top Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MessageSquare size={20} style={{ color: '#25D366' }} />
                  Meta WhatsApp &amp; Email Template Studio
                </h3>
                <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                  Preview authentic WhatsApp chat bubble designs, manage Cloud API templates, and launch instant broadcasts.
                </div>
              </div>

              {/* View Switcher & Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Search Box */}
                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                  <input
                    type="text"
                    placeholder="Search templates..."
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--paper-2)',
                      border: '1px solid var(--line)',
                      borderRadius: '6px',
                      padding: '0.4rem 0.6rem 0.4rem 2rem',
                      fontSize: '0.82rem',
                      color: 'var(--ink)',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* View Mode Toggle */}
                <div style={{ display: 'inline-flex', background: 'var(--paper-2)', borderRadius: '6px', border: '1px solid var(--line)', padding: '2px' }}>
                  <button
                    type="button"
                    onClick={() => setTemplateViewMode('chat')}
                    style={{
                      padding: '0.35rem 0.7rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      background: templateViewMode === 'chat' ? 'var(--paper)' : 'transparent',
                      color: templateViewMode === 'chat' ? 'var(--gold-deep)' : 'var(--muted)',
                      boxShadow: templateViewMode === 'chat' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    <Smartphone size={13} /> Chat Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateViewMode('table')}
                    style={{
                      padding: '0.35rem 0.7rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      background: templateViewMode === 'table' ? 'var(--paper)' : 'transparent',
                      color: templateViewMode === 'table' ? 'var(--gold-deep)' : 'var(--muted)',
                      boxShadow: templateViewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    <FileText size={13} /> Table View
                  </button>
                </div>

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
                      showToast('Error syncing templates from Meta Cloud API', 'error');
                    } finally {
                      setIsSyncingMetaTemplates(false);
                    }
                  }}
                  disabled={isSyncingMetaTemplates}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.85rem',
                    borderRadius: '6px',
                    background: 'var(--paper-2)',
                    color: 'var(--ink)',
                    border: '1px solid var(--line)',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: isSyncingMetaTemplates ? 'not-allowed' : 'pointer'
                  }}
                >
                  <RefreshCw size={13} className={isSyncingMetaTemplates ? 'spin-slow' : ''} />
                  {isSyncingMetaTemplates ? 'Syncing...' : 'Sync Meta'}
                </button>

                <button
                  onClick={() => {
                    setEditingTemplateId(null);
                    setNewTemplateForm({
                      name: '',
                      type: 'whatsapp',
                      subject: '',
                      body: '',
                      metaTemplateName: '',
                      category: 'UTILITY',
                      language: 'en_US',
                      headerFormat: 'NONE',
                      headerText: '',
                      headerSample: '',
                      mediaUrl: '',
                      footerText: '',
                      bodySampleValues: {},
                      buttons: {
                        buttonType: 'NONE',
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
                    setShowCreateTemplateModal(true);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '6px',
                    background: '#25D366',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  <MessageSquare size={14} /> + Create WhatsApp Template
                </button>

                <button
                  onClick={() => {
                    setEditingTemplateId(null);
                    setNewTemplateForm({
                      name: '',
                      type: 'email',
                      subject: '',
                      body: `Hello {name},\n\nWe have an exclusive financial update tailored for your portfolio at FinMantra.\n\nYour Master Profile ID is: {finmantra_id}\n\nPlease click below to review your personalized benefits and offers:\n{contact_center_url}\n\nBest regards,\nFinMantra Team\n\n<hr style="border:none;border-top:1px solid #e2e8f0;margin:25px 0;"/><div style="font-size:12px;color:#888;text-align:center;">To manage notification preferences, <a href="{contact_center_url}" style="color:#e0a82e;text-decoration:none;font-weight:bold;">visit Contact Center</a> • <a href="{unsubscribe_url}" style="color:#ef4444;text-decoration:none;font-weight:bold;">Unsubscribe from Emails</a></div>`,
                      metaTemplateName: '',
                      category: 'MARKETING',
                      language: 'en_US',
                      headerFormat: 'NONE',
                      headerText: '',
                      headerSample: '',
                      mediaUrl: '',
                      footerText: '',
                      bodySampleValues: {},
                      buttons: {
                        buttonType: 'NONE',
                        ctaUrlText: '',
                        ctaUrlValue: '',
                        ctaUrlSample: '',
                        ctaUrl2Text: '',
                        ctaUrl2Value: '',
                        ctaUrl2Sample: '',
                        ctaPhoneText: '',
                        ctaPhoneValue: '',
                        quickReplies: [],
                        otpType: 'COPY_CODE',
                        otpText: ''
                      }
                    });
                    setShowCreateTemplateModal(true);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '6px',
                    background: '#8b5cf6',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  <Mail size={14} /> + Create Email Template
                </button>
              </div>
            </div>

            {/* Templates Content */}
            {(() => {
              const filteredTemplates = templates.filter(t => {
                if (!templateSearch) return true;
                const q = templateSearch.toLowerCase();
                return (
                  (t.name && t.name.toLowerCase().includes(q)) ||
                  (t.meta_template_name && t.meta_template_name.toLowerCase().includes(q)) ||
                  (t.body && t.body.toLowerCase().includes(q)) ||
                  (t.category && t.category.toLowerCase().includes(q))
                );
              });

              if (filteredTemplates.length === 0) {
                return (
                  <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--muted)' }}>
                    <MessageSquare size={36} style={{ color: 'var(--line)', marginBottom: '0.75rem' }} />
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      {templates.length === 0 ? 'No templates registered yet.' : 'No templates match your search.'}
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      Click "+ Create Template" or "Sync Meta" to import your WhatsApp templates.
                    </div>
                  </div>
                );
              }

              {/* View 1: WhatsApp Chat Theme Grid */}
              if (templateViewMode === 'chat') {
                return (
                  <div className="wa-template-grid">
                    {filteredTemplates.map(t => {
                      const status = metaStatuses[t.meta_template_name || t.name] || 'APPROVED';
                      const isUtility = (t.category || '').toUpperCase() === 'UTILITY';

                      // Extract / Parse Buttons
                      let parsedBtns = [];
                      if (Array.isArray(t.buttons)) {
                        parsedBtns = t.buttons;
                      } else if (typeof t.buttons === 'string') {
                        try { parsedBtns = JSON.parse(t.buttons); } catch(e){}
                      } else if (t.buttons && typeof t.buttons === 'object') {
                        if (t.buttons.ctaUrlText) parsedBtns.push({ text: t.buttons.ctaUrlText, url: t.buttons.ctaUrlValue, type: 'URL' });
                        if (t.buttons.ctaUrl2Text) parsedBtns.push({ text: t.buttons.ctaUrl2Text, url: t.buttons.ctaUrl2Value, type: 'URL' });
                        if (t.buttons.ctaPhoneText) parsedBtns.push({ text: t.buttons.ctaPhoneText, phone_number: t.buttons.ctaPhoneValue, type: 'PHONE' });
                        if (Array.isArray(t.buttons.quickReplies)) {
                          t.buttons.quickReplies.filter(Boolean).forEach(qr => parsedBtns.push({ text: qr, type: 'QUICK_REPLY' }));
                        }
                      }

                      // Default fallbacks for interactive previews
                      if (parsedBtns.length === 0 && t.type === 'whatsapp') {
                        parsedBtns = [
                          { text: '🌐 View Status / Preferences', type: 'URL' },
                          { text: '🛡️ Unsubscribe', type: 'URL' }
                        ];
                      }

                      if (t.type === 'email') {
                        return (
                          <div key={t.id} className="wa-template-card">
                            {/* Email Top App Bar */}
                            <div className="email-card-app-bar">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                  <Mail size={15} />
                                </div>
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>
                                    FinMantra Email Service
                                  </div>
                                  <div style={{ fontSize: '0.7rem', opacity: 0.85, fontFamily: 'var(--font-mono)' }}>
                                    {t.name}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                <span style={{
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  fontSize: '0.66rem',
                                  fontWeight: 800,
                                  background: 'rgba(255, 255, 255, 0.2)',
                                  color: '#ffffff'
                                }}>
                                  {t.category || 'MARKETING'}
                                </span>
                                <span style={{
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '999px',
                                  fontSize: '0.66rem',
                                  fontWeight: 800,
                                  background: '#16a37b',
                                  color: '#ffffff'
                                }}>
                                  READY
                                </span>
                              </div>
                            </div>

                            {/* Email Preview Canvas */}
                            <div className="email-preview-canvas">
                              <div className="email-preview-box">
                                <div className="email-subject-line">
                                  <span style={{ color: 'var(--muted)', fontSize: '0.74rem', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Subject:</span>
                                  {t.subject || '(No Subject Line)'}
                                </div>
                                <div style={{ whiteSpace: 'pre-wrap', maxHeight: '160px', overflowY: 'auto', fontSize: '0.82rem', color: 'var(--ink)' }}>
                                  {(() => {
                                    const text = t.body || '';
                                    const parts = text.split(/(\{[a-zA-Z0-9_]+\})/g);
                                    return parts.map((part, pIdx) => {
                                      if (/^\{[a-zA-Z0-9_]+\}$/.test(part)) {
                                        return <span key={pIdx} className="wa-chat-var-tag">{part}</span>;
                                      }
                                      return part;
                                    });
                                  })()}
                                </div>
                              </div>
                            </div>

                            {/* Card Footer Actions */}
                            <div className="wa-template-card-footer">
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                  type="button"
                                  onClick={() => handleEditTemplate(t)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    padding: '0.4rem 0.75rem',
                                    borderRadius: '6px',
                                    background: 'var(--paper)',
                                    color: 'var(--ink)',
                                    border: '1px solid var(--line)',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                  title="Edit Template"
                                >
                                  <Edit2 size={13} style={{ color: 'var(--gold-deep)' }} /> Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteTemplate(t.id, t.name)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.4rem 0.65rem',
                                    borderRadius: '6px',
                                    background: 'rgba(239, 68, 68, 0.08)',
                                    color: '#ef4444',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                  title="Delete Template"
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setBroadcastForm(prev => ({
                                    ...prev,
                                    channel: 'email',
                                    email_subject: t.subject || '',
                                    email_body: t.body || ''
                                  }));
                                  setBroadcastWizardStep(1);
                                  setShowNewBroadcastModal(true);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.4rem 0.85rem',
                                  borderRadius: '6px',
                                  background: 'rgba(139, 92, 246, 0.12)',
                                  color: '#8b5cf6',
                                  border: '1px solid rgba(139, 92, 246, 0.3)',
                                  fontSize: '0.78rem',
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                <Send size={13} /> Use in Broadcast
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={t.id} className="wa-template-card">
                          {/* WhatsApp Top App Bar */}
                          <div className="wa-card-app-bar">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '0.82rem' }}>
                                FM
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                  FinMantra Official
                                  <span style={{ color: '#53bdeb', fontSize: '0.8rem' }} title="Meta Verified">✓</span>
                                </div>
                                <div style={{ fontSize: '0.7rem', opacity: 0.85, fontFamily: 'var(--font-mono)' }}>
                                  {t.name} • {t.language || 'en_US'}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                              <span style={{
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                background: 'rgba(255, 255, 255, 0.2)',
                                color: '#ffffff'
                              }}>
                                {t.category || 'UTILITY'}
                              </span>
                              <span style={{
                                padding: '0.15rem 0.45rem',
                                borderRadius: '999px',
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                background: status === 'APPROVED' ? '#16a37b' : status === 'PENDING' ? '#d97706' : '#ef4444',
                                color: '#ffffff'
                              }}>
                                {status}
                              </span>
                            </div>
                          </div>

                          {/* WhatsApp Chat Wallpaper Canvas */}
                          <div className="wa-chat-canvas">
                            <div className="wa-chat-bubble">
                              {/* Header (if present) */}
                              {t.header_text && (
                                <div className="wa-chat-header-text">
                                  {t.header_text}
                                </div>
                              )}
                              {t.header_format && t.header_format !== 'NONE' && t.header_format !== 'TEXT' && (
                                <div style={{
                                  background: 'rgba(0,0,0,0.06)',
                                  borderRadius: '6px',
                                  padding: '0.5rem',
                                  textAlign: 'center',
                                  marginBottom: '0.45rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  color: 'var(--muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.35rem'
                                }}>
                                  {t.header_format === 'IMAGE' ? '🖼️ [Header Image / Media]' : t.header_format === 'VIDEO' ? '🎥 [Header Video]' : '📄 [Header Document]'}
                                </div>
                              )}

                              {/* Body with bold, italic, and gold variable badges */}
                              <div className="wa-chat-body-text">
                                {(() => {
                                  const text = t.body || '';
                                  const parts = text.split(/(\{\{\d+\}\}|\{[a-zA-Z0-9_]+\}|\*[^*]+\*|_[^_]+_)/g);
                                  return parts.map((part, pIdx) => {
                                    if (/^\{\{\d+\}\}$|^\{[a-zA-Z0-9_]+\}$/.test(part)) {
                                      return <span key={pIdx} className="wa-chat-var-tag">{part}</span>;
                                    }
                                    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
                                      return <strong key={pIdx}>{part.slice(1, -1)}</strong>;
                                    }
                                    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
                                      return <em key={pIdx}>{part.slice(1, -1)}</em>;
                                    }
                                    return part;
                                  });
                                })()}
                              </div>

                              {/* Footer (if present) */}
                              {t.footer_text && (
                                <div className="wa-chat-footer-text">
                                  {t.footer_text}
                                </div>
                              )}

                              {/* Timestamp & Double Ticks */}
                              <div className="wa-chat-time-stamp">
                                <span>10:45 AM</span>
                                <span style={{ color: '#53bdeb', fontWeight: 900 }}>✓✓</span>
                              </div>

                              {/* Interactive CTA Buttons */}
                              {parsedBtns.length > 0 && (
                                <div className="wa-chat-btn-row">
                                  {parsedBtns.map((btn, bIdx) => (
                                    <div key={bIdx} className="wa-chat-btn-pill">
                                      {btn.type === 'PHONE' || btn.phone_number ? '📞' : btn.type === 'QUICK_REPLY' ? '⚡' : '🔗'}
                                      <span>{btn.text || btn.url || 'Action Link'}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card Footer Actions: Edit, Delete, Use */}
                          <div className="wa-template-card-footer">
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button
                                type="button"
                                onClick={() => handleEditTemplate(t)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.4rem 0.75rem',
                                  borderRadius: '6px',
                                  background: 'var(--paper)',
                                  color: 'var(--ink)',
                                  border: '1px solid var(--line)',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                                title="Edit Template"
                              >
                                <Edit2 size={13} style={{ color: 'var(--gold-deep)' }} /> Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteTemplate(t.id, t.name)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.4rem 0.65rem',
                                  borderRadius: '6px',
                                  background: 'rgba(239, 68, 68, 0.08)',
                                  color: '#ef4444',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                                title="Delete Template"
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setBroadcastForm(prev => ({
                                  ...prev,
                                  whatsapp_template: t.meta_template_name || t.name,
                                  channel: t.type === 'email' ? 'email' : 'whatsapp'
                                }));
                                setBroadcastWizardStep(1);
                                setShowNewBroadcastModal(true);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.4rem 0.85rem',
                                borderRadius: '6px',
                                background: 'rgba(37, 211, 102, 0.12)',
                                color: '#16a37b',
                                border: '1px solid rgba(37, 211, 102, 0.3)',
                                fontSize: '0.78rem',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                            >
                              <Send size={13} /> Use in Broadcast
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              {/* View 2: Table View */}
              return (
                <div className="campaigns-table-wrapper">
                  <table className="campaigns-table">
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--paper-2)', zIndex: 10 }}>
                      <tr style={{ borderBottom: '1px solid var(--line)' }}>
                        <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700 }}>Template Name</th>
                        <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700 }}>Type</th>
                        <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700 }}>Category</th>
                        <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700 }}>Meta Identifier</th>
                        <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700 }}>Language</th>
                        <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700 }}>Status</th>
                        <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700 }}>Body Text</th>
                        <th style={{ padding: '0.7rem 0.85rem', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTemplates.map(t => {
                        const status = metaStatuses[t.meta_template_name || t.name] || 'APPROVED';
                        return (
                          <tr key={t.id} style={{ borderBottom: '1px solid var(--line)' }} className="table-row-hover">
                            <td style={{ padding: '0.75rem 0.85rem', fontWeight: 700 }}>{t.name}</td>
                            <td style={{ padding: '0.75rem 0.85rem', textTransform: 'capitalize' }}>
                              <span style={{
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                background: t.type === 'whatsapp' ? 'rgba(37, 211, 102, 0.12)' : 'rgba(139, 92, 246, 0.12)',
                                color: t.type === 'whatsapp' ? '#25D366' : '#8b5cf6'
                              }}>
                                {t.type}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)' }}>
                              {t.category || 'UTILITY'}
                            </td>
                            <td style={{ padding: '0.75rem 0.85rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--muted)' }}>
                              {t.meta_template_name || t.name}
                            </td>
                            <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
                              {t.language || 'en_US'}
                            </td>
                            <td style={{ padding: '0.75rem 0.85rem' }}>
                              <span style={{
                                padding: '0.2rem 0.55rem',
                                borderRadius: '999px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: status === 'APPROVED' ? 'rgba(22, 163, 123, 0.12)' : status === 'PENDING' ? 'rgba(224, 168, 46, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                color: status === 'APPROVED' ? '#16a37b' : status === 'PENDING' ? 'var(--gold-deep)' : '#ef4444'
                              }}>
                                {status}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.8rem', color: 'var(--muted)', maxWidth: '260px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {t.body || '—'}
                            </td>
                            <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                onClick={() => handleEditTemplate(t)}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '6px',
                                  background: 'var(--paper)',
                                  color: 'var(--ink)',
                                  border: '1px solid var(--line)',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  marginRight: '0.35rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}
                                title="Edit Template"
                              >
                                <Edit2 size={12} style={{ color: 'var(--gold-deep)' }} /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setBroadcastForm(prev => ({
                                    ...prev,
                                    whatsapp_template: t.meta_template_name || t.name,
                                    channel: t.type === 'email' ? 'email' : 'whatsapp'
                                  }));
                                  setBroadcastWizardStep(1);
                                  setShowNewBroadcastModal(true);
                                }}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '6px',
                                  background: 'rgba(37, 211, 102, 0.1)',
                                  color: '#16a37b',
                                  border: '1px solid rgba(37, 211, 102, 0.25)',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  marginRight: '0.35rem'
                                }}
                              >
                                Use
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTemplate(t.id, t.name)}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '6px',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  color: '#ef4444',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}
                                title="Delete Template"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 5: MULTI-SMTP GATEWAY SETTINGS */}
      {/* ========================================================================= */}
      {activeSubTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginBottom: '2.5rem' }}>
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', width: '100%', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Mail size={20} style={{ color: 'var(--gold-deep)' }} />
                  Outbound SMTP Email Gateways &amp; Accounts
                </h3>
              </div>
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

            {/* SMTP Accounts Grid */}
            <div>
              {isLoadingSmtpAccounts ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                  <RefreshCw size={24} className="spin-slow" style={{ color: 'var(--gold-deep)', marginBottom: '0.5rem' }} />
                  <div>Loading configured SMTP accounts...</div>
                </div>
              ) : smtpAccounts.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <Mail size={32} style={{ color: 'var(--muted)', marginBottom: '0.5rem' }} />
                  <div>No SMTP accounts configured. Add one to send email broadcasts.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                  {smtpAccounts.map(account => (
                    <div key={account.id} style={{ border: '1px solid var(--line)', borderRadius: '10px', background: 'var(--paper-2)', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{account.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                            ID: {account.id}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          {account.is_default && (
                            <span style={{ padding: '0.2rem 0.55rem', borderRadius: '999px', background: 'rgba(224, 168, 46, 0.15)', color: 'var(--gold-deep)', fontSize: '0.72rem', fontWeight: 800 }}>
                              ★ DEFAULT SENDER
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Details */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.84rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Host / Server:</span>
                          <span style={{ fontWeight: 600 }}>{account.host}:{account.port}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>From Name:</span>
                          <span style={{ fontWeight: 600 }}>{account.from_name || account.fromName || 'FinMantra'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>From Email:</span>
                          <span style={{ fontWeight: 600, color: 'var(--gold-deep)' }}>{account.from_email || account.fromEmail}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Username:</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{account.username}</span>
                        </div>
                      </div>

                      {/* Buttons */}
                      <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => handleTestSpecificSmtp(account)}
                            style={{
                              padding: '0.4rem 0.65rem',
                              borderRadius: '6px',
                              background: 'var(--paper)',
                              color: 'var(--ink)',
                              border: '1px solid var(--line)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Test Connection
                          </button>
                          {!account.is_default && (
                            <button
                              type="button"
                              onClick={() => handleSetDefaultSmtp(account.id)}
                              style={{
                                padding: '0.4rem 0.65rem',
                                borderRadius: '6px',
                                background: 'rgba(224, 168, 46, 0.1)',
                                color: 'var(--gold-deep)',
                                border: '1px solid rgba(224, 168, 46, 0.25)',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Set as Default
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditSmtp(account)}
                            style={{ padding: '0.4rem', border: 'none', background: 'none', color: '#3b82f6', cursor: 'pointer' }}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSmtp(account.id, account.name)}
                            style={{ padding: '0.4rem', border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
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
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginBottom: '2.5rem' }}>
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
                      {/* Email Template Selector */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                          Load from Saved Email Template (Optional)
                        </label>
                        <select
                          onChange={(e) => {
                            const chosenId = e.target.value;
                            const t = templates.find(item => item.id === chosenId || item.name === chosenId);
                            if (t) {
                              setBroadcastForm(prev => ({
                                ...prev,
                                email_subject: t.subject || prev.email_subject || '',
                                email_body: t.body || prev.email_body || ''
                              }));
                            }
                          }}
                          style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                        >
                          <option value="">-- Choose a pre-made Email Template or compose below --</option>
                          {templates.filter(t => t.type === 'email').map(t => (
                            <option key={t.id} value={t.id}>
                              {t.name} — {t.subject || 'No Subject'}
                            </option>
                          ))}
                        </select>
                      </div>

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
      {/* MODAL 2: WHATSAPP & EMAIL TEMPLATE CREATOR STUDIO */}
      {/* ========================================================================= */}
      {showCreateTemplateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '16px', maxWidth: '1100px', width: '100%', maxHeight: '94vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'var(--paper-2)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {newTemplateForm.type === 'email' ? <Mail size={20} style={{ color: '#8b5cf6' }} /> : <MessageSquare size={20} style={{ color: '#25D366' }} />}
                  {editingTemplateId 
                    ? `Edit ${newTemplateForm.type === 'email' ? 'Email' : 'WhatsApp'} Template: ${newTemplateForm.name || ''}` 
                    : `Create ${newTemplateForm.type === 'email' ? 'Outbound Email' : 'WhatsApp Business'} Template`}
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                  {newTemplateForm.type === 'email'
                    ? 'Design responsive email templates with subject personalization, dynamic tags ({name}, {unsubscribe_url}), and instant SMTP dispatch.'
                    : 'Build and register official WhatsApp templates with media headers, dynamic variables ({{1}}), CTA buttons, and live device preview.'}
                </div>
              </div>
              <button onClick={() => setShowCreateTemplateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Studio Body: Split Screen (Left: Builder Form, Right: Live WhatsApp or Email Preview) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.95fr', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {/* LEFT COLUMN: FORM BUILDER */}
              <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderRight: '1px solid var(--line)' }}>
                
                {/* 0. Channel Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', textTransform: 'uppercase', color: 'var(--muted)' }}>
                    Select Template Channel:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div
                      onClick={() => setNewTemplateForm(p => ({ ...p, type: 'whatsapp' }))}
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        border: newTemplateForm.type === 'whatsapp' ? '2px solid #25D366' : '1px solid var(--line)',
                        background: newTemplateForm.type === 'whatsapp' ? 'rgba(37, 211, 102, 0.12)' : 'var(--paper-2)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <MessageSquare size={18} style={{ color: '#25D366' }} />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>WhatsApp Template</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Meta Cloud API Verification</div>
                      </div>
                    </div>

                    <div
                      onClick={() => setNewTemplateForm(p => ({ ...p, type: 'email' }))}
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        border: newTemplateForm.type === 'email' ? '2px solid #8b5cf6' : '1px solid var(--line)',
                        background: newTemplateForm.type === 'email' ? 'rgba(139, 92, 246, 0.12)' : 'var(--paper-2)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <Mail size={18} style={{ color: '#8b5cf6' }} />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>Email Template</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>HTML / SMTP Gateway</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1. Category & Details */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', textTransform: 'uppercase', color: 'var(--muted)' }}>
                    1. Template Category &amp; Configuration
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {[
                      { id: 'MARKETING', label: 'Marketing', desc: 'Offers & promotions' },
                      { id: 'UTILITY', label: 'Utility', desc: 'Updates & alerts' },
                      { id: 'AUTHENTICATION', label: 'Authentication', desc: 'OTP verification' }
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
                            padding: '0.6rem 0.75rem',
                            borderRadius: '8px',
                            border: isSel ? '2px solid var(--gold-deep)' : '1px solid var(--line)',
                            background: isSel ? 'rgba(224, 168, 46, 0.1)' : 'var(--paper-2)',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{cat.label}</div>
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
                        placeholder={newTemplateForm.type === 'email' ? 'e.g. finmantra_monthly_digest' : 'e.g. finmantra_special_offer_v1'}
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
                      </select>
                    </div>
                  </div>

                  {newTemplateForm.type === 'whatsapp' && metaPhoneNumbers.length > 0 && (
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

                {/* EMAIL ONLY: SUBJECT LINE */}
                {newTemplateForm.type === 'email' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', textTransform: 'uppercase', color: 'var(--muted)' }}>
                      2. Email Subject Line <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Important Update for {name}: Your FinMantra Benefits"
                      value={newTemplateForm.subject}
                      onChange={(e) => setNewTemplateForm({ ...newTemplateForm, subject: e.target.value })}
                      style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                {/* WHATSAPP ONLY: HEADER (OPTIONAL) */}
                {newTemplateForm.type === 'whatsapp' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', textTransform: 'uppercase', color: 'var(--muted)' }}>
                      2. WhatsApp Header (Optional)
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
                              border: isSel ? '2px solid #25D366' : '1px solid var(--line)',
                              background: isSel ? 'rgba(37, 211, 102, 0.12)' : 'var(--paper-2)',
                              fontSize: '0.78rem',
                              fontWeight: isSel ? 700 : 500,
                              cursor: 'pointer',
                              color: isSel ? '#16a37b' : 'var(--ink)'
                            }}
                          >
                            {hf === 'NONE' ? 'None' : hf === 'TEXT' ? '📝 Text' : hf === 'IMAGE' ? '🖼️ Image' : hf === 'VIDEO' ? '🎥 Video' : '📄 Document'}
                          </button>
                        );
                      })}
                    </div>

                    {newTemplateForm.headerFormat === 'TEXT' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <input
                          type="text"
                          maxLength={60}
                          placeholder="Header text (e.g. Hello {{1}}, Welcome)"
                          value={newTemplateForm.headerText}
                          onChange={(e) => setNewTemplateForm({ ...newTemplateForm, headerText: e.target.value })}
                          style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.84rem', boxSizing: 'border-box' }}
                        />
                        {newTemplateForm.headerText.includes('{{1}}') && (
                          <input
                            type="text"
                            placeholder="Sample value for {{1}} (e.g. John)"
                            value={newTemplateForm.headerSample}
                            onChange={(e) => setNewTemplateForm({ ...newTemplateForm, headerSample: e.target.value })}
                            style={{ width: '100%', padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px dashed var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: '0.8rem', boxSizing: 'border-box' }}
                          />
                        )}
                      </div>
                    )}

                    {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(newTemplateForm.headerFormat) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <input
                          type="text"
                          placeholder={`Sample ${newTemplateForm.headerFormat.toLowerCase()} URL`}
                          value={newTemplateForm.mediaUrl}
                          onChange={(e) => setNewTemplateForm({ ...newTemplateForm, mediaUrl: e.target.value })}
                          style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.84rem', boxSizing: 'border-box' }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Body Message Content */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>
                      3. Template Body Content <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                  </div>

                  {/* Dynamic Tag Inserter for Email & WhatsApp */}
                  <div style={{ background: 'var(--paper-2)', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '0.35rem' }}>
                      ⚡ Click to Insert Dynamic Tags:
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {(newTemplateForm.type === 'email' ? [
                        { tag: '{name}', label: '👤 {name}' },
                        { tag: '{finmantra_id}', label: '🆔 {finmantra_id}' },
                        { tag: '{unsubscribe_url}', label: '🛡️ {unsubscribe_url}' },
                        { tag: '{contact_center_url}', label: '🌐 {contact_center_url}' },
                        { tag: '{contact}', label: '📞 {contact}' },
                        { tag: '{mail}', label: '✉️ {mail}' }
                      ] : [
                        { tag: '{{1}}', label: '{{1}} Name' },
                        { tag: '{{2}}', label: '{{2}} Detail' },
                        { tag: '{{3}}', label: '{{3}} Link/Code' },
                        { tag: '*bold*', label: '*Bold*' },
                        { tag: '_italic_', label: '_Italic_' }
                      ]).map(item => (
                        <button
                          key={item.tag}
                          type="button"
                          onClick={() => {
                            setNewTemplateForm(p => ({
                              ...p,
                              body: (p.body || '') + (p.body?.endsWith(' ') || !p.body ? '' : ' ') + item.tag
                            }));
                          }}
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            border: '1px solid var(--line)',
                            background: 'var(--paper)',
                            color: 'var(--ink)',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {item.label}
                        </button>
                      ))}

                      {newTemplateForm.type === 'email' && (
                        <button
                          type="button"
                          onClick={() => {
                            const standardEmailHtml = `Hello {name},\n\nWe have an exclusive financial update tailored for your portfolio at FinMantra.\n\nYour Master Profile ID is: {finmantra_id}\n\nPlease click below to review your personalized benefits and offers:\n{contact_center_url}\n\nBest regards,\nFinMantra Team\n\n<hr style="border:none;border-top:1px solid #e2e8f0;margin:25px 0;"/><div style="font-size:12px;color:#888;text-align:center;">To manage notification preferences, <a href="{contact_center_url}" style="color:#e0a82e;text-decoration:none;font-weight:bold;">visit Contact Center</a> • <a href="{unsubscribe_url}" style="color:#ef4444;text-decoration:none;font-weight:bold;">Unsubscribe from Emails</a></div>`;
                            setNewTemplateForm(p => ({
                              ...p,
                              body: standardEmailHtml,
                              subject: p.subject || 'Exclusive Financial Update for {name}'
                            }));
                          }}
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            border: '1px solid rgba(139, 92, 246, 0.4)',
                            background: 'rgba(139, 92, 246, 0.12)',
                            color: '#8b5cf6',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          📄 Insert Standard Email Template
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    rows={newTemplateForm.type === 'email' ? 8 : 5}
                    placeholder={newTemplateForm.type === 'email' ? 'Enter email body (plain text or HTML with {name}, {unsubscribe_url})...' : 'Enter WhatsApp message body with {{1}}, {{2}}...'}
                    value={newTemplateForm.body}
                    onChange={(e) => setNewTemplateForm({ ...newTemplateForm, body: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.85rem', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>

                {/* WHATSAPP ONLY: FOOTER & BUTTONS */}
                {newTemplateForm.type === 'whatsapp' && (
                  <>
                    {/* 4. Footer */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', textTransform: 'uppercase', color: 'var(--muted)' }}>
                        4. WhatsApp Footer (Optional)
                      </label>
                      <input
                        type="text"
                        maxLength={60}
                        placeholder="e.g. Reply STOP to opt out"
                        value={newTemplateForm.footerText}
                        onChange={(e) => setNewTemplateForm({ ...newTemplateForm, footerText: e.target.value })}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.84rem', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* 5. Buttons */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', textTransform: 'uppercase', color: 'var(--muted)' }}>
                        5. Interactive Buttons
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.4rem', marginBottom: '0.65rem' }}>
                        {[
                          { id: 'NONE', label: 'None' },
                          { id: 'CTA', label: '🔗 CTA Link' },
                          { id: 'QUICK_REPLIES', label: '💬 Replies' },
                          { id: 'OTP', label: '🔑 OTP' }
                        ].map(bt => {
                          const isSel = newTemplateForm.buttons.buttonType === bt.id;
                          return (
                            <button
                              key={bt.id}
                              type="button"
                              onClick={() => setNewTemplateForm(p => ({ ...p, buttons: { ...p.buttons, buttonType: bt.id } }))}
                              style={{
                                padding: '0.45rem 0.5rem',
                                borderRadius: '6px',
                                border: isSel ? '2px solid #25D366' : '1px solid var(--line)',
                                background: isSel ? 'rgba(37, 211, 102, 0.12)' : 'var(--paper-2)',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                color: isSel ? '#16a37b' : 'var(--ink)'
                              }}
                            >
                              {bt.label}
                            </button>
                          );
                        })}
                      </div>

                      {newTemplateForm.buttons.buttonType === 'CTA' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div className="campaigns-grid-2col">
                            <input
                              type="text"
                              placeholder="Button 1 Text (e.g. View Offers)"
                              value={newTemplateForm.buttons.ctaUrlText}
                              onChange={(e) => setNewTemplateForm(p => ({ ...p, buttons: { ...p.buttons, ctaUrlText: e.target.value } }))}
                              style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.82rem', boxSizing: 'border-box' }}
                            />
                            <input
                              type="text"
                              placeholder="Button 1 URL (e.g. https://thefinmantra.com/contact-center)"
                              value={newTemplateForm.buttons.ctaUrlValue}
                              onChange={(e) => setNewTemplateForm(p => ({ ...p, buttons: { ...p.buttons, ctaUrlValue: e.target.value } }))}
                              style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.82rem', boxSizing: 'border-box' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* RIGHT COLUMN: LIVE SIMULATION */}
              <div style={{ background: newTemplateForm.type === 'email' ? 'var(--paper-2)' : '#0c1317', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }}>
                <div style={{ fontSize: '0.78rem', color: newTemplateForm.type === 'email' ? 'var(--muted)' : '#8696a0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.75rem' }}>
                  {newTemplateForm.type === 'email' ? 'Live Outbound Email Client Preview' : 'Live WhatsApp Smartphone Preview'}
                </div>

                {newTemplateForm.type === 'email' ? (
                  /* Live Email Client Preview Card */
                  <div style={{
                    width: '100%',
                    maxWidth: '420px',
                    background: 'var(--paper)',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', padding: '0.75rem 1rem', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '0.86rem' }}>
                        <Mail size={16} /> FinMantra Email Dispatch
                      </div>
                      <span style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.2)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                        HTML / SMTP
                      </span>
                    </div>

                    <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--line)', fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <div><strong style={{ color: 'var(--ink)' }}>From:</strong> FinMantra Official &lt;notifications@thefinmantra.com&gt;</div>
                      <div><strong style={{ color: 'var(--ink)' }}>To:</strong> Rahul Sharma &lt;lead@customer.com&gt;</div>
                      <div><strong style={{ color: 'var(--ink)' }}>Subject:</strong> <span style={{ color: '#4f46e5', fontWeight: 700 }}>{newTemplateForm.subject || '(Subject line)'}</span></div>
                    </div>

                    <div style={{ padding: '1rem', fontSize: '0.84rem', lineHeight: 1.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', maxHeight: '280px', overflowY: 'auto' }}>
                      {newTemplateForm.body || 'Type your email body on the left...'}
                    </div>
                  </div>
                ) : (
                  /* WhatsApp Smartphone Preview Card */
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
                      <div style={{
                        background: '#202c33',
                        borderRadius: '10px 10px 10px 2px',
                        color: '#e9edef',
                        overflow: 'hidden',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                        maxWidth: '92%'
                      }}>
                        {newTemplateForm.headerFormat === 'TEXT' && newTemplateForm.headerText && (
                          <div style={{ padding: '0.65rem 0.75rem 0.25rem 0.75rem', fontWeight: 800, fontSize: '0.92rem', color: '#e9edef' }}>
                            {newTemplateForm.headerText.replace(/\{\{1\}\}/g, newTemplateForm.headerSample || '{{1}}')}
                          </div>
                        )}

                        <div style={{ padding: '0.65rem 0.75rem 0.35rem 0.75rem', fontSize: '0.84rem', lineHeight: 1.45, whiteSpace: 'pre-wrap', color: '#e9edef' }}>
                          {newTemplateForm.body || 'Type your WhatsApp message template body on the left...'}
                        </div>

                        {newTemplateForm.footerText && (
                          <div style={{ padding: '0 0.75rem 0.35rem 0.75rem', fontSize: '0.7rem', color: '#8696a0' }}>
                            {newTemplateForm.footerText}
                          </div>
                        )}

                        <div style={{ padding: '0 0.75rem 0.4rem 0.75rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.2rem', fontSize: '0.65rem', color: '#8696a0' }}>
                          <span>10:45 AM</span>
                          <CheckCheck size={12} style={{ color: '#53bdeb' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--paper-2)', flexShrink: 0 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                {newTemplateForm.type === 'email' ? 'Email template will be saved locally for instant SMTP dispatch.' : 'WhatsApp template will be submitted to Meta for automated verification & approval.'}
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
                    if (newTemplateForm.type === 'email' && !newTemplateForm.subject?.trim()) {
                      showToast('Please enter an Email Subject Line.', 'error');
                      return;
                    }
                    setIsCreatingTemplate(true);
                    try {
                      const res = await fetch(`${API_URL}/campaigns/templates`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                          ...newTemplateForm,
                          id: editingTemplateId || undefined,
                          meta_phone_number_id: templateTargetPhoneId
                        })
                      });
                      const data = await res.json();
                      if (res.ok && data.success) {
                        showToast(editingTemplateId ? `Template "${newTemplateForm.name}" updated successfully!` : `Template "${newTemplateForm.name}" created successfully!`, 'success');
                        setShowCreateTemplateModal(false);
                        fetchTemplates();
                      } else {
                        showToast(data.error || 'Failed to save template.', 'error');
                      }
                    } catch (err) {
                      showToast('Network error saving template.', 'error');
                    } finally {
                      setIsCreatingTemplate(false);
                    }
                  }}
                  style={{
                    padding: '0.55rem 1.35rem',
                    borderRadius: '6px',
                    background: newTemplateForm.type === 'email' ? '#8b5cf6' : '#25D366',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: isCreatingTemplate ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: newTemplateForm.type === 'email' ? '0 4px 12px rgba(139, 92, 246, 0.3)' : '0 4px 12px rgba(37, 211, 102, 0.3)'
                  }}
                >
                  {isCreatingTemplate ? <RefreshCw size={15} className="spin-slow" /> : (newTemplateForm.type === 'email' ? <Mail size={15} /> : <Send size={15} />)}
                  {isCreatingTemplate 
                    ? (newTemplateForm.type === 'email' ? 'Saving Template...' : 'Registering with Meta...') 
                    : (editingTemplateId ? 'Save & Update Template' : (newTemplateForm.type === 'email' ? 'Save Email Template' : 'Submit Template to Meta'))}
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
