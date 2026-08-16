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
    mediaUrl: '',
    category: 'MARKETING',
    language: 'en_US',
    headerFormat: 'NONE',
    buttons: {
      buttonType: 'NONE',
      ctaUrlText: '',
      ctaUrlValue: '',
      ctaPhoneText: '',
      ctaPhoneValue: '',
      quickReplies: ['', '', '']
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
  const [broadcastWizardStep, setBroadcastWizardStep] = useState(1); // 1: Info, 2: Channel, 3: Template, 4: Data Upload, 5: Preview, 6: Send/Schedule
  const [isSubmittingBroadcast, setIsSubmittingBroadcast] = useState(false);

  const [broadcastForm, setBroadcastForm] = useState({
    name: '',
    channel: 'whatsapp', // 'whatsapp' | 'email' | 'both'
    meta_phone_number_id: '',
    meta_phone_number: '',
    sender_email: '',
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

  // SMTP Settings state
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

  const handleSaveSmtpSettings = async (e) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch(`${API_URL}/settings`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          campaign_smtp_host: smtpSettings.host,
          campaign_smtp_port: smtpSettings.port,
          campaign_smtp_user: smtpSettings.user,
          campaign_smtp_pass: smtpSettings.pass,
          campaign_smtp_secure: smtpSettings.secure,
          campaign_smtp_from_name: smtpSettings.fromName,
          campaign_smtp_from_email: smtpSettings.fromEmail
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('SMTP Gateway configuration updated successfully.', 'success');
      } else {
        showToast(data.error || 'Failed to save SMTP settings.', 'error');
      }
    } catch (err) {
      showToast('Network error saving settings.', 'error');
    } finally {
      setIsSavingSettings(false);
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

  const handleDeleteMasterLead = async (leadId) => {
    if (!window.confirm('Delete this contact permanently from Master Data Center?')) return;
    try {
      const res = await fetch(`${API_URL}/campaigns/master/leads/${leadId}`, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      if (data.success) {
        showToast('Contact removed from Master Data Center.', 'info');
        fetchMasterLeads();
        fetchMasterFilterOptions();
      } else {
        showToast(data.error || 'Failed to delete contact.', 'error');
      }
    } catch (err) {
      showToast('Network error while deleting contact.', 'error');
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

  // Submit Broadcast Dispatch / Schedule
  const handleSubmitDirectBroadcast = async () => {
    if (!broadcastForm.name.trim()) {
      showToast('Please enter a Broadcast Name.', 'error');
      setBroadcastWizardStep(1);
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, color: 'var(--ink)' }}>
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
      <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid var(--line)', paddingBottom: '0.75rem', marginBottom: '1.25rem', overflowX: 'auto', flexShrink: 0 }}>
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
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '0.65rem',
            background: 'var(--paper-2)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem',
            alignItems: 'flex-end'
          }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
              {/* Broadcasts Count */}
              <div className="glass-panel" style={{ padding: '1.1rem', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  <span>Total Broadcasts</span>
                  <Zap size={16} style={{ color: 'var(--gold-deep)' }} />
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--ink)' }}>
                  {dashboardAnalytics.kpis.total_broadcasts || 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                  {dashboardAnalytics.kpis.wa_broadcasts || 0} WA • {dashboardAnalytics.kpis.email_broadcasts || 0} Email • {dashboardAnalytics.kpis.hybrid_broadcasts || 0} Hybrid
                </div>
              </div>

              {/* Total Targeted */}
              <div className="glass-panel" style={{ padding: '1.1rem', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  <span>Targeted Recipients</span>
                  <Users size={16} style={{ color: '#3b82f6' }} />
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--ink)' }}>
                  {(dashboardAnalytics.kpis.total_targeted || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                  {(dashboardAnalytics.masterStats.total_master_contacts || 0).toLocaleString()} Unique Master Leads
                </div>
              </div>

              {/* WhatsApp Delivery Rate */}
              <div className="glass-panel" style={{ padding: '1.1rem', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  <span>WA Delivery Rate</span>
                  <CheckCheck size={16} style={{ color: '#25D366' }} />
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.4rem', color: '#25D366' }}>
                  {dashboardAnalytics.masterStats.sum_wa_sent > 0 
                    ? `${((dashboardAnalytics.masterStats.sum_wa_delivered / dashboardAnalytics.masterStats.sum_wa_sent) * 100).toFixed(1)}%` 
                    : '100%'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                  {dashboardAnalytics.masterStats.sum_wa_delivered} delivered of {dashboardAnalytics.masterStats.sum_wa_sent} sent
                </div>
              </div>

              {/* WhatsApp CTR */}
              <div className="glass-panel" style={{ padding: '1.1rem', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  <span>WhatsApp Unique CTR</span>
                  <TrendingUp size={16} style={{ color: 'var(--gold-deep)' }} />
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--gold-deep)' }}>
                  {dashboardAnalytics.masterStats.sum_wa_delivered > 0 
                    ? `${((dashboardAnalytics.masterStats.sum_wa_clicked / dashboardAnalytics.masterStats.sum_wa_delivered) * 100).toFixed(1)}%` 
                    : '0.0%'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                  {dashboardAnalytics.masterStats.sum_wa_clicked} unique link clicks
                </div>
              </div>

              {/* Email Delivery Rate */}
              <div className="glass-panel" style={{ padding: '1.1rem', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  <span>Email Delivery Rate</span>
                  <Mail size={16} style={{ color: '#8b5cf6' }} />
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.4rem', color: '#8b5cf6' }}>
                  {dashboardAnalytics.masterStats.sum_email_sent > 0 
                    ? `${((dashboardAnalytics.masterStats.sum_email_delivered / dashboardAnalytics.masterStats.sum_email_sent) * 100).toFixed(1)}%` 
                    : '100%'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                  {dashboardAnalytics.masterStats.sum_email_delivered} delivered of {dashboardAnalytics.masterStats.sum_email_sent} sent
                </div>
              </div>

              {/* Unsubscribe / Opt-outs */}
              <div className="glass-panel" style={{ padding: '1.1rem', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  <span>Opt-out Rate</span>
                  <ShieldCheck size={16} style={{ color: '#ef4444' }} />
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.4rem', color: '#ef4444' }}>
                  {(dashboardAnalytics.masterStats.wa_optout_count || 0) + (dashboardAnalytics.masterStats.email_optout_count || 0)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                  {dashboardAnalytics.masterStats.wa_optout_count || 0} WA opt-outs • {dashboardAnalytics.masterStats.email_optout_count || 0} Email opt-outs
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

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
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
                          <span style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: b.status === 'sent' ? 'rgba(22, 163, 123, 0.12)' : b.status === 'processing' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(224, 168, 46, 0.12)',
                            color: b.status === 'sent' ? '#16a37b' : b.status === 'processing' ? '#3b82f6' : 'var(--gold-deep)'
                          }}>
                            {b.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>{b.targeted_count || 0}</td>
                        <td style={{ padding: '0.65rem 0.75rem', color: '#16a37b', fontWeight: 600 }}>{b.delivered_count || b.sent_count || 0}</td>
                        <td style={{ padding: '0.65rem 0.75rem', color: 'var(--gold-deep)', fontWeight: 700 }}>{ctr}%</td>
                        <td style={{ padding: '0.65rem 0.75rem', color: 'var(--muted)', fontSize: '0.78rem' }}>
                          {b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
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
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '0.5rem',
              background: 'var(--paper-2)',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              marginBottom: '1rem',
              flexShrink: 0
            }}>
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
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', minHeight: 0 }}>
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
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
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
                            {c.whatsapp_optin !== false ? (
                              <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(22, 163, 123, 0.12)', color: '#16a37b', fontSize: '0.72rem', fontWeight: 700 }}>Opted-in</span>
                            ) : (
                              <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', fontSize: '0.72rem', fontWeight: 700 }}>Opted-out</span>
                            )}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            {c.email_optin !== false ? (
                              <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(22, 163, 123, 0.12)', color: '#16a37b', fontSize: '0.72rem', fontWeight: 700 }}>Opted-in</span>
                            ) : (
                              <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', fontSize: '0.72rem', fontWeight: 700 }}>Opted-out</span>
                            )}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem' }}>
                            <span style={{ color: '#25D366', fontWeight: 600 }}>Del: {waDel}{waDel !== '—' ? '%' : ''}</span> • <span style={{ color: 'var(--gold-deep)', fontWeight: 600 }}>CTR: {waCtr}%</span>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem' }}>
                            <span style={{ color: '#3b82f6', fontWeight: 600 }}>Del: {emDel}{emDel !== '—' ? '%' : ''}</span> • <span style={{ color: 'var(--gold-deep)', fontWeight: 600 }}>CTR: {emCtr}%</span>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
                            {c.last_broadcast_name || '—'}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
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
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', minHeight: 0 }}>
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
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
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
                            <span style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: b.status === 'sent' ? 'rgba(22, 163, 123, 0.12)' : b.status === 'processing' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(224, 168, 46, 0.12)',
                              color: b.status === 'sent' ? '#16a37b' : b.status === 'processing' ? '#3b82f6' : 'var(--gold-deep)'
                            }}>
                              {b.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem', fontWeight: 600 }}>{b.targeted_count || 0}</td>
                          <td style={{ padding: '0.75rem 0.85rem', color: '#16a37b', fontWeight: 600 }}>{b.delivered_count || b.sent_count || 0}</td>
                          <td style={{ padding: '0.75rem 0.85rem', color: 'var(--gold-deep)', fontWeight: 700 }}>{ctr}%</td>
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
                    buttons: { buttonType: 'NONE', ctaUrlText: '', ctaUrlValue: '', ctaPhoneText: '', ctaPhoneValue: '', quickReplies: ['', '', ''] }
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

            {/* Templates Grid */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', minHeight: 0 }}>
              {templates.map(t => (
                <div key={t.id} style={{ border: '1px solid var(--line)', borderRadius: '10px', background: 'var(--paper-2)', padding: '1.1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t.name}</span>
                      <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, background: t.type === 'whatsapp' ? 'rgba(37, 211, 102, 0.15)' : 'rgba(59, 130, 246, 0.15)', color: t.type === 'whatsapp' ? '#25D366' : '#3b82f6' }}>
                        {t.type}
                      </span>
                    </div>
                    {t.meta_template_name && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem' }}>
                        Meta Name: {t.meta_template_name}
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
      {/* SUBTAB 5: SMTP GATEWAY SETTINGS */}
      {/* ========================================================================= */}
      {activeSubTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div className="glass-panel" style={{ maxWidth: '640px', width: '100%', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)', padding: '1.5rem', boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', fontWeight: 700 }}>SMTP Mail Gateway Configuration</h3>
            <p style={{ margin: '0 0 1.25rem 0', color: 'var(--muted)', fontSize: '0.85rem' }}>Configure your custom SMTP host credentials for high-deliverability email broadcasts.</p>

            <form onSubmit={handleSaveSmtpSettings} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>SMTP Host</label>
                <input
                  type="text"
                  placeholder="e.g. smtp.titan.email or smtp.gmail.com"
                  value={smtpSettings.host}
                  onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>SMTP Port</label>
                  <input
                    type="text"
                    value={smtpSettings.port}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, port: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>Encryption</label>
                  <select
                    value={smtpSettings.secure}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, secure: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)' }}
                  >
                    <option value="true">SSL / TLS (Port 465)</option>
                    <option value="false">STARTTLS / Plain (Port 587)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>SMTP Username / Email</label>
                <input
                  type="text"
                  autoComplete="username"
                  value={smtpSettings.user}
                  onChange={(e) => setSmtpSettings({ ...smtpSettings, user: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>SMTP Password / App Password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={smtpSettings.pass}
                  onChange={(e) => setSmtpSettings({ ...smtpSettings, pass: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>From Name</label>
                  <input
                    type="text"
                    autoComplete="name"
                    value={smtpSettings.fromName}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, fromName: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>From Email Address</label>
                  <input
                    type="email"
                    autoComplete="email"
                    value={smtpSettings.fromEmail}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, fromEmail: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingSettings}
                style={{
                  marginTop: '0.75rem',
                  padding: '0.7rem',
                  borderRadius: '8px',
                  background: 'var(--gold-deep)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: isSavingSettings ? 'not-allowed' : 'pointer'
                }}
              >
                {isSavingSettings ? 'Saving Settings...' : 'Save SMTP Settings'}
              </button>
            </form>
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
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '16px', maxWidth: '680px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Create &amp; Launch Broadcast Campaign</h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Step {broadcastWizardStep} of 6: {
                  broadcastWizardStep === 1 ? 'Broadcast Information' :
                  broadcastWizardStep === 2 ? 'Target Channel & Sender' :
                  broadcastWizardStep === 3 ? 'Template & Content' :
                  broadcastWizardStep === 4 ? 'Download Template & Upload Contacts' :
                  broadcastWizardStep === 5 ? 'Interactive Live Preview' : 'Dispatch / Schedule'
                }</div>
              </div>
              <button onClick={() => setShowNewBroadcastModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
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

                  {/* If Email: Sender Email dropdown */}
                  {(broadcastForm.channel === 'email' || broadcastForm.channel === 'both') && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                        Sender Email Address
                      </label>
                      <input
                        type="email"
                        value={broadcastForm.sender_email}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, sender_email: e.target.value })}
                        placeholder="e.g. offers@thefinmantra.com"
                        style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                      />
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
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, whatsapp_template: e.target.value })}
                        style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                      >
                        <option value="">Select a template...</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.name}>{t.name} {t.meta_template_name ? `(${t.meta_template_name})` : ''}</option>
                        ))}
                      </select>

                      {broadcastForm.whatsapp_template && (
                        <div style={{ marginTop: '0.75rem', padding: '0.85rem', borderRadius: '8px', background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Template Body:</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>
                            {templates.find(t => t.name === broadcastForm.whatsapp_template)?.body}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Email Subject & Body */}
                  {(broadcastForm.channel === 'email' || broadcastForm.channel === 'both') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>Email Subject Line</label>
                        <input
                          type="text"
                          placeholder="e.g. Exclusive Credit Card Eligibility for {name}"
                          value={broadcastForm.email_subject}
                          onChange={(e) => setBroadcastForm({ ...broadcastForm, email_subject: e.target.value })}
                          style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>Email HTML / Text Body</label>
                        <textarea
                          rows={4}
                          placeholder="Dear {name}, here is your customized pre-approved offer..."
                          value={broadcastForm.email_body}
                          onChange={(e) => setBroadcastForm({ ...broadcastForm, email_body: e.target.value })}
                          style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.88rem', boxSizing: 'border-box' }}
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
                      if (broadcastWizardStep === 4 && !broadcastUploadFile && broadcastParsedLeads.length === 0) {
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
                    {isSubmittingBroadcast ? <RefreshCw size={15} className="spin-slow" /> : <Send size={15} />}
                    Launch Broadcast Campaign
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CREATE TEMPLATE MODAL */}
      {/* ========================================================================= */}
      {showCreateTemplateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '16px', maxWidth: '580px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Create New Message Template</h3>
              <button onClick={() => setShowCreateTemplateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Prompt which Meta WhatsApp Number to register under */}
              {newTemplateForm.type === 'whatsapp' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Select Meta WhatsApp Number (WABA Account Target)
                  </label>
                  <select
                    value={templateTargetPhoneId}
                    onChange={(e) => setTemplateTargetPhoneId(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.85rem' }}
                  >
                    {metaPhoneNumbers.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.display_phone_number} ({p.verified_name || 'Business'}) - Quality: {p.quality_rating || 'Standard'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Template Name (e.g. finmantra_welcome_offer)</label>
                <input
                  type="text"
                  placeholder="lowercase_letters_and_underscores_only"
                  value={newTemplateForm.name}
                  onChange={(e) => setNewTemplateForm({ ...newTemplateForm, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Template Body (use {'{{1}}'}, {'{{2}}'} for variables)</label>
                <textarea
                  rows={4}
                  placeholder="Hello {{1}}, congratulations! Your application is ready..."
                  value={newTemplateForm.body}
                  onChange={(e) => setNewTemplateForm({ ...newTemplateForm, body: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', background: 'var(--paper-2)' }}>
              <button
                type="button"
                onClick={() => setShowCreateTemplateModal(false)}
                style={{ padding: '0.55rem 1rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCreatingTemplate}
                onClick={async () => {
                  if (!newTemplateForm.name.trim() || !newTemplateForm.body.trim()) {
                    showToast('Name and Body are required.', 'error');
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
                      showToast('Template created and synced to Meta.', 'success');
                      setShowCreateTemplateModal(false);
                      fetchTemplates();
                    } else {
                      showToast(data.error || 'Failed to create template.', 'error');
                    }
                  } catch (err) {
                    showToast('Network error creating template.', 'error');
                  } finally {
                    setIsCreatingTemplate(false);
                  }
                }}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: '6px',
                  background: 'var(--gold-deep)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  cursor: isCreatingTemplate ? 'not-allowed' : 'pointer'
                }}
              >
                {isCreatingTemplate ? 'Creating & Syncing...' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
