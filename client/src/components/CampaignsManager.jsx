import React, { useState, useEffect } from 'react';
import { 
  Users, Mail, MessageSquare, Plus, Trash2, Search, Upload, RefreshCw, X, Check,
  AlertCircle, Download, FileSpreadsheet, Play, Settings as SettingsIcon, HelpCircle, Info, Zap, Database, FileText
} from 'lucide-react';

export default function CampaignsManager({ theme, API_URL, token, showToast }) {
  const [activeSubTab, setActiveSubTab] = useState('master_data'); // 'master_data' | 'data_storage' | 'broadcast' | 'automated' | 'settings' | 'guide' | 'templates'
  
  // Templates Manager state
  const [templates, setTemplates] = useState([]);
  const [metaStatuses, setMetaStatuses] = useState({});
  const [metaTemplates, setMetaTemplates] = useState([]);
  const [isSyncingMeta, setIsSyncingMeta] = useState(false);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
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
  const [masterContactsSearch, setMasterContactsSearch] = useState('');
  const [showMasterUploadModal, setShowMasterUploadModal] = useState(false);
  const [masterUploadFile, setMasterUploadFile] = useState(null);
  const [isMasterUploading, setIsMasterUploading] = useState(false);
  const [masterUploadResult, setMasterUploadResult] = useState(null);
  
  // Selection/Importing state
  const [selectedMasterIds, setSelectedMasterIds] = useState(new Set());
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSearch, setImportSearch] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Master Import filters
  const [filterPhone, setFilterPhone] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterAddress, setFilterAddress] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');

  // Master Data Center bulk delete states & filters
  const [selectedMasterDeleteIds, setSelectedMasterDeleteIds] = useState(new Set());
  const [masterFilterPhone, setMasterFilterPhone] = useState('');
  const [masterFilterEmail, setMasterFilterEmail] = useState('');
  const [masterFilterAddress, setMasterFilterAddress] = useState('');
  const [masterFilterFromDate, setMasterFilterFromDate] = useState('');
  const [masterFilterToDate, setMasterFilterToDate] = useState('');
  
  // Campaigns list state
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [newCampaignForm, setNewCampaignForm] = useState({ name: '', description: '' });
  const [showCreateCampaignModal, setShowCreateCampaignModal] = useState(false);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);

  // Leads/Contacts storage state
  const [contacts, setContacts] = useState([]);
  const [contactsSearch, setContactsSearch] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Broadcasts state
  const [broadcasts, setBroadcasts] = useState([]);
  const [showNewBroadcastModal, setShowNewBroadcastModal] = useState(false);
  const [isCreatingBroadcast, setIsCreatingBroadcast] = useState(false);
  const [newBroadcastForm, setNewBroadcastForm] = useState({
    name: '',
    channel: 'whatsapp', // 'whatsapp' | 'email' | 'both'
    whatsappTemplate: '',
    whatsappMessage: '',
    emailSubject: '',
    emailBody: '',
    scheduledAt: '',
    mediaUrl: ''
  });
  const [isLoadingBroadcasts, setIsLoadingBroadcasts] = useState(false);

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

  // Load campaigns on mount
  useEffect(() => {
    fetchCampaigns();
    fetchGlobalSettings();
    fetchMasterLeads();
    fetchTemplates();
  }, []);

  // Load campaign specific data when selected campaign changes
  useEffect(() => {
    if (selectedCampaignId) {
      fetchCampaignLeads(selectedCampaignId);
      fetchCampaignBroadcasts(selectedCampaignId);
    } else {
      setContacts([]);
      setBroadcasts([]);
    }
  }, [selectedCampaignId]);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const fetchCampaigns = async () => {
    try {
      const res = await fetch(`${API_URL}/campaigns`, { headers });
      const data = await res.json();
      if (res.ok && data.success) {
        setCampaigns(data.campaigns || []);
        if (data.campaigns && data.campaigns.length > 0 && !selectedCampaignId) {
          setSelectedCampaignId(data.campaigns[0].id);
        }
      }
    } catch (err) {
      showToast('Error loading campaigns list.', 'error');
    }
  };

  const fetchGlobalSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/settings`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSmtpSettings({
          host: data.campaign_smtp_host || '',
          port: data.campaign_smtp_port || '465',
          user: data.campaign_smtp_user || '',
          pass: data.campaign_smtp_pass || '',
          secure: data.campaign_smtp_secure || 'true',
          fromName: data.campaign_smtp_from_name || 'FinMantra',
          fromEmail: data.campaign_smtp_from_email || ''
        });
      }
    } catch (err) {
      console.warn('Failed to load global SMTP settings:', err.message);
    }
  };

  const fetchCampaignLeads = async (campaignId) => {
    try {
      const res = await fetch(`${API_URL}/campaigns/${campaignId}/leads`, { headers });
      const data = await res.json();
      if (res.ok && data.success) {
        setContacts(data.leads || []);
      }
    } catch (err) {
      showToast('Error fetching campaign contacts.', 'error');
    }
  };

  const fetchCampaignBroadcasts = async (campaignId) => {
    setIsLoadingBroadcasts(true);
    try {
      const res = await fetch(`${API_URL}/campaigns/${campaignId}/broadcasts`, { headers });
      const data = await res.json();
      if (res.ok && data.success) {
        setBroadcasts(data.broadcasts || []);
      }
    } catch (err) {
      showToast('Error fetching campaign broadcasts.', 'error');
    } finally {
      setIsLoadingBroadcasts(false);
    }
  };

  const fetchTemplates = async (skipMetaSync = false) => {
    try {
      const res = await fetch(`${API_URL}/campaigns/templates`, { headers });
      const data = await res.json();
      if (res.ok && data.success) {
        setTemplates(data.templates || []);
        if (!skipMetaSync) {
          // Trigger status sync in the background
          syncMetaStatuses(true);
        }
      }
    } catch (err) {
      showToast('Error fetching campaign templates.', 'error');
    }
  };

  const syncMetaStatuses = async (isBackground = false) => {
    setIsSyncingMeta(true);
    try {
      // Refresh templates list from DB first but skip recursive sync
      await fetchTemplates(true);

      const res = await fetch(`${API_URL}/campaigns/templates/meta-sync`, { headers });
      const data = await res.json();
      if (res.ok && data.success) {
        setMetaStatuses(data.metaStatuses || {});
        setMetaTemplates(data.metaTemplates || []);
        if (!isBackground) {
          showToast('Meta template statuses synced successfully!', 'success');
        }
      } else if (!isBackground) {
        showToast(data.error || 'Failed to sync statuses with Meta.', 'error');
      }
    } catch (err) {
      console.error('Failed to sync Meta template statuses:', err);
      if (!isBackground) {
        showToast('Error syncing with Meta: ' + err.message, 'error');
      }
    } finally {
      setIsSyncingMeta(false);
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!newTemplateForm.name.trim() || !newTemplateForm.body.trim()) {
      showToast('Name and Content/Body are required.', 'error');
      return;
    }
    
    setIsCreatingTemplate(true);
    try {
      const res = await fetch(`${API_URL}/campaigns/templates`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newTemplateForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Template saved and registered with Meta successfully!', 'success');
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
          buttons: {
            buttonType: 'NONE',
            ctaUrlText: '',
            ctaUrlValue: '',
            ctaPhoneText: '',
            ctaPhoneValue: '',
            quickReplies: ['', '', '']
          }
        });
        setEditingTemplateId(null);
        setShowCreateTemplateModal(false);
        fetchTemplates();
      } else {
        showToast(data.error || 'Failed to save template.', 'error');
      }
    } catch (err) {
      showToast('Error saving template: ' + err.message, 'error');
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      const res = await fetch(`${API_URL}/campaigns/templates/${templateId}`, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Template deleted successfully.', 'info');
        fetchTemplates();
      } else {
        showToast(data.error || 'Failed to delete template.', 'error');
      }
    } catch (err) {
      showToast('Error deleting template.', 'error');
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!newCampaignForm.name.trim()) return;

    setIsCreatingCampaign(true);
    try {
      const res = await fetch(`${API_URL}/campaigns`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newCampaignForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('🎉 Campaign created successfully!', 'success');
        setNewCampaignForm({ name: '', description: '' });
        setShowCreateCampaignModal(false);
        fetchCampaigns();
        if (data.campaign) {
          setSelectedCampaignId(data.campaign.id);
        }
      } else {
        showToast(data.error || 'Failed to create campaign', 'error');
      }
    } catch (err) {
      showToast('Connection error while creating campaign.', 'error');
    } finally {
      setIsCreatingCampaign(false);
    }
  };

  const handleDeleteCampaign = async (id) => {
    if (!window.confirm('Are you sure you want to delete this campaign? This will delete all its contacts and broadcasts permanently!')) return;

    try {
      const res = await fetch(`${API_URL}/campaigns/${id}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        showToast('Campaign deleted successfully.', 'info');
        setCampaigns(prev => prev.filter(c => c.id !== id));
        setSelectedCampaignId('');
        fetchCampaigns();
      }
    } catch (err) {
      showToast('Failed to delete campaign.', 'error');
    }
  };

  const handleUploadContacts = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      showToast('Please select a file to upload.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);

    setIsUploading(true);
    try {
      const res = await fetch(`${API_URL}/campaigns/${selectedCampaignId}/leads/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUploadResult(data);
        showToast(`Bulk upload complete! Parsed ${data.created} contacts.`, 'success');
        fetchCampaignLeads(selectedCampaignId);
      } else {
        showToast(data.error || 'Failed to process spreadsheet file.', 'error');
      }
    } catch (err) {
      showToast('Error uploading file: ' + err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteContact = async (leadId) => {
    if (!window.confirm('Delete this contact?')) return;
    try {
      const res = await fetch(`${API_URL}/campaigns/${selectedCampaignId}/leads/${leadId}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        setContacts(prev => prev.filter(c => c.id !== leadId));
        showToast('Contact removed.', 'info');
      }
    } catch (err) {
      showToast('Error removing contact.', 'error');
    }
  };

  const fetchMasterLeads = async () => {
    try {
      const res = await fetch(`${API_URL}/campaigns/master/leads`, { headers });
      const data = await res.json();
      if (res.ok && data.success) {
        setMasterContacts(data.leads || []);
      }
    } catch (err) {
      showToast('Error fetching master contacts.', 'error');
    }
  };

  const handleUploadMasterContacts = async (e) => {
    e.preventDefault();
    if (!masterUploadFile) {
      showToast('Please select a file to upload.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', masterUploadFile);

    setIsMasterUploading(true);
    try {
      const res = await fetch(`${API_URL}/campaigns/master/leads/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMasterUploadResult(data);
        showToast(`Bulk master upload complete! Parsed ${data.insertedCount} contacts.`, 'success');
        setMasterUploadFile(null);
        fetchMasterLeads();
      } else {
        showToast(data.error || 'Failed to process spreadsheet file.', 'error');
      }
    } catch (err) {
      showToast('Error uploading file: ' + err.message, 'error');
    } finally {
      setIsMasterUploading(false);
    }
  };

  const handleDeleteMasterContact = async (leadId) => {
    if (!window.confirm('Delete this contact from the Master Data Center?')) return;
    try {
      const res = await fetch(`${API_URL}/campaigns/master/leads/${leadId}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        setMasterContacts(prev => prev.filter(c => c.id !== leadId));
        showToast('Contact removed from Master Data Center.', 'info');
      }
    } catch (err) {
      showToast('Error removing contact.', 'error');
    }
  };

  const handleImportMasterLeads = async () => {
    if (!selectedCampaignId) {
      showToast('Please select a campaign first.', 'error');
      return;
    }
    const leadIds = Array.from(selectedMasterIds);
    if (leadIds.length === 0) {
      showToast('Please select at least one contact to import.', 'error');
      return;
    }

    setIsImporting(true);
    try {
      const res = await fetch(`${API_URL}/campaigns/${selectedCampaignId}/leads/import-master`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ leadIds })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Successfully imported ${data.importedCount} contacts to campaign!`, 'success');
        setSelectedMasterIds(new Set());
        setShowImportModal(false);
        fetchCampaignLeads(selectedCampaignId);
      } else {
        showToast(data.error || 'Failed to import contacts.', 'error');
      }
    } catch (err) {
      showToast('Error importing contacts: ' + err.message, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteMasterContactsBulk = async () => {
    const leadIds = Array.from(selectedMasterDeleteIds);
    if (leadIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete these ${leadIds.length} contact(s) from the Master Data Center?`)) return;

    try {
      const res = await fetch(`${API_URL}/campaigns/master/leads/delete-bulk`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ leadIds })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Successfully deleted ${data.deletedCount} contacts from Master Data Center.`, 'info');
        setSelectedMasterDeleteIds(new Set());
        fetchMasterLeads();
      } else {
        showToast(data.error || 'Failed to delete contacts.', 'error');
      }
    } catch (err) {
      showToast('Error deleting contacts: ' + err.message, 'error');
    }
  };

  const handleCreateBroadcast = async (e) => {
    e.preventDefault();
    if (!newBroadcastForm.name.trim()) {
      showToast('Broadcast name is required.', 'error');
      return;
    }

    setIsCreatingBroadcast(true);
    try {
      const res = await fetch(`${API_URL}/campaigns/${selectedCampaignId}/broadcasts`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newBroadcastForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Broadcast created successfully!', 'success');
        setShowNewBroadcastModal(false);
        setNewBroadcastForm({
          name: '',
          channel: 'whatsapp',
          whatsappTemplate: '',
          whatsappMessage: '',
          emailSubject: '',
          emailBody: '',
          scheduledAt: ''
        });
        fetchCampaignBroadcasts(selectedCampaignId);
      } else {
        showToast(data.error || 'Failed to create broadcast.', 'error');
      }
    } catch (err) {
      showToast('Error creating broadcast: ' + err.message, 'error');
    } finally {
      setIsCreatingBroadcast(false);
    }
  };

  const handleTriggerBroadcast = async (broadcastId) => {
    if (!window.confirm('Trigger this broadcast campaign now? Messages will be sent immediately.')) return;

    try {
      const res = await fetch(`${API_URL}/campaigns/${selectedCampaignId}/broadcasts/${broadcastId}/trigger`, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Broadcast execution started!', 'success');
        fetchCampaignBroadcasts(selectedCampaignId);
      } else {
        showToast(data.error || 'Failed to trigger broadcast.', 'error');
      }
    } catch (err) {
      showToast('Failed to trigger broadcast.', 'error');
    }
  };

  const handleDeleteBroadcast = async (broadcastId) => {
    if (!window.confirm('Are you sure you want to delete this broadcast?')) return;
    try {
      const res = await fetch(`${API_URL}/campaigns/${selectedCampaignId}/broadcasts/${broadcastId}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        setBroadcasts(prev => prev.filter(b => b.id !== broadcastId));
        showToast('Broadcast deleted.', 'info');
      }
    } catch (err) {
      showToast('Error deleting broadcast.', 'error');
    }
  };

  const handleSaveSMTPSettings = async (e) => {
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
      if (res.ok) {
        showToast('SMTP settings saved successfully!', 'success');
      } else {
        showToast('Failed to save SMTP configurations.', 'error');
      }
    } catch (err) {
      showToast('Connection error while saving settings.', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,Name,Contact,Mail,Address\nJohn Doe,919876543210,john@example.com,Mumbai India\nJane Smith,918888888888,jane@example.com,Delhi India";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "campaign_contacts_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredContacts = contacts.filter(c => {
    const search = contactsSearch.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(search) ||
      (c.contact || '').toLowerCase().includes(search) ||
      (c.mail || '').toLowerCase().includes(search) ||
      (c.address || '').toLowerCase().includes(search)
    );
  });

  const filteredMasterContacts = masterContacts.filter(c => {
    // 1. General search
    const gen = masterContactsSearch.toLowerCase().trim();
    if (gen) {
      const matchGen = (c.name || '').toLowerCase().includes(gen) ||
                       (c.contact || '').toLowerCase().includes(gen) ||
                       (c.mail || '').toLowerCase().includes(gen) ||
                       (c.address || '').toLowerCase().includes(gen);
      if (!matchGen) return false;
    }

    // 2. Phone filter
    const phoneFilterClean = masterFilterPhone.replace(/\D/g, '');
    if (phoneFilterClean) {
      if (!(c.contact || '').includes(phoneFilterClean)) return false;
    }

    // 3. Email filter
    const emailFilterClean = masterFilterEmail.toLowerCase().trim();
    if (emailFilterClean) {
      if (!(c.mail || '').toLowerCase().includes(emailFilterClean)) return false;
    }

    // 4. Address filter
    const addrFilterClean = masterFilterAddress.toLowerCase().trim();
    if (addrFilterClean) {
      if (!(c.address || '').toLowerCase().includes(addrFilterClean)) return false;
    }

    // 5. Date filters
    if (c.created_at) {
      const createdTime = new Date(c.created_at).getTime();
      if (masterFilterFromDate) {
        const fromTime = new Date(masterFilterFromDate + 'T00:00:00').getTime();
        if (createdTime < fromTime) return false;
      }
      if (masterFilterToDate) {
        const toTime = new Date(masterFilterToDate + 'T23:59:59').getTime();
        if (createdTime > toTime) return false;
      }
    } else {
      if (masterFilterFromDate || masterFilterToDate) return false;
    }

    return true;
  });

  const filteredImportContacts = masterContacts.filter(c => {
    // 1. General search
    const gen = importSearch.toLowerCase().trim();
    if (gen) {
      const matchGen = (c.name || '').toLowerCase().includes(gen) ||
                       (c.contact || '').toLowerCase().includes(gen) ||
                       (c.mail || '').toLowerCase().includes(gen) ||
                       (c.address || '').toLowerCase().includes(gen);
      if (!matchGen) return false;
    }

    // 2. Phone filter
    const phoneFilterClean = filterPhone.replace(/\D/g, '');
    if (phoneFilterClean) {
      if (!(c.contact || '').includes(phoneFilterClean)) return false;
    }

    // 3. Email filter
    const emailFilterClean = filterEmail.toLowerCase().trim();
    if (emailFilterClean) {
      if (!(c.mail || '').toLowerCase().includes(emailFilterClean)) return false;
    }

    // 4. Address filter
    const addrFilterClean = filterAddress.toLowerCase().trim();
    if (addrFilterClean) {
      if (!(c.address || '').toLowerCase().includes(addrFilterClean)) return false;
    }

    // 5. Date filters
    if (c.created_at) {
      const createdTime = new Date(c.created_at).getTime();
      if (filterFromDate) {
        const fromTime = new Date(filterFromDate + 'T00:00:00').getTime();
        if (createdTime < fromTime) return false;
      }
      if (filterToDate) {
        const toTime = new Date(filterToDate + 'T23:59:59').getTime();
        if (createdTime > toTime) return false;
      }
    } else {
      if (filterFromDate || filterToDate) return false;
    }

    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
      {/* Tab Navigation Menu */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--line)', paddingBottom: '0.85rem', marginBottom: '1.25rem', overflowX: 'auto', flexShrink: 0 }}>
        <button
          onClick={() => setActiveSubTab('master_data')}
          style={{
            padding: '0.55rem 1.1rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeSubTab === 'master_data' ? 'var(--gold-deep)' : 'transparent',
            color: activeSubTab === 'master_data' ? '#fff' : 'var(--muted)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <Database size={16} style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
          Master Data Center
        </button>
        <button
          onClick={() => setActiveSubTab('data_storage')}
          style={{
            padding: '0.55rem 1.1rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeSubTab === 'data_storage' ? 'var(--gold-deep)' : 'transparent',
            color: activeSubTab === 'data_storage' ? '#fff' : 'var(--muted)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <Users size={16} style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
          Campaign Data (Data Storage)
        </button>
        <button
          onClick={() => setActiveSubTab('broadcast')}
          style={{
            padding: '0.55rem 1.1rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeSubTab === 'broadcast' ? 'var(--gold-deep)' : 'transparent',
            color: activeSubTab === 'broadcast' ? '#fff' : 'var(--muted)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <MessageSquare size={16} style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
          Broadcast Campaigns
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          style={{
            padding: '0.55rem 1.1rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeSubTab === 'settings' ? 'var(--gold-deep)' : 'transparent',
            color: activeSubTab === 'settings' ? '#fff' : 'var(--muted)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <SettingsIcon size={16} style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
          SMTP Gateway Settings
        </button>
        <button
          onClick={() => setActiveSubTab('templates')}
          style={{
            padding: '0.55rem 1.1rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeSubTab === 'templates' ? 'var(--gold-deep)' : 'transparent',
            color: activeSubTab === 'templates' ? '#fff' : 'var(--muted)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <FileText size={16} style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
          Templates Manager
        </button>
        <button
          onClick={() => setActiveSubTab('guide')}
          style={{
            padding: '0.55rem 1.1rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeSubTab === 'guide' ? 'var(--gold-deep)' : 'transparent',
            color: activeSubTab === 'guide' ? '#fff' : 'var(--muted)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <HelpCircle size={16} style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
          Developer Guide
        </button>
      </div>

      {/* Campaigns Selector Header Bar */}
      {activeSubTab !== 'settings' && activeSubTab !== 'guide' && activeSubTab !== 'master_data' && activeSubTab !== 'templates' && (
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.25rem', borderRadius: '12px', border: '1px solid var(--line)', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)' }}>Select Campaign:</span>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              style={{
                background: 'var(--paper-2)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                padding: '0.45rem 1.5rem 0.45rem 0.75rem',
                color: 'var(--ink)',
                fontSize: '0.9rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">-- Choose Campaign --</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {activeSubTab !== 'broadcast' && (
              <button
                onClick={() => setShowCreateCampaignModal(true)}
                className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', fontSize: '0.82rem', height: '34px', background: 'var(--gold-deep)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                <Plus size={14} /> New Campaign
              </button>
            )}
          </div>

          {selectedCampaignId && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  fetchCampaignLeads(selectedCampaignId);
                  fetchCampaignBroadcasts(selectedCampaignId);
                  showToast('Refreshed campaign details.', 'info');
                }}
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '34px', width: '34px', padding: 0, borderRadius: '6px', cursor: 'pointer' }}
                title="Refresh Campaign Data"
              >
                <RefreshCw size={15} />
              </button>
              <button
                onClick={() => handleDeleteCampaign(selectedCampaignId)}
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '34px', width: '34px', padding: 0, borderRadius: '6px', cursor: 'pointer', background: 'rgba(209, 67, 67, 0.1)', color: 'var(--err)', borderColor: 'rgba(209, 67, 67, 0.2)' }}
                title="Delete Selected Campaign"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Sub-Tab Viewport */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        
        {/* TAB 0: MASTER DATA CENTER */}
        {activeSubTab === 'master_data' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)', padding: '1.25rem' }}>
              {/* Search and Action Strip */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap', flexShrink: 0 }}>
                <div style={{ position: 'relative', maxWidth: '320px', width: '100%' }}>
                  <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                  <input
                    type="text"
                    placeholder="Search master data..."
                    value={masterContactsSearch}
                    onChange={(e) => setMasterContactsSearch(e.target.value)}
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

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {selectedMasterDeleteIds.size > 0 && (
                    <button
                      onClick={handleDeleteMasterContactsBulk}
                      className="btn-secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.85rem', background: 'rgba(209, 67, 67, 0.1)', color: 'var(--err)', borderColor: 'rgba(209, 67, 67, 0.2)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                    >
                      <Trash2 size={14} /> Delete Selected ({selectedMasterDeleteIds.size})
                    </button>
                  )}
                  <button
                    onClick={handleDownloadTemplate}
                    className="btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.85rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    <Download size={14} /> Download Template
                  </button>
                  <button
                    onClick={() => {
                      setSelectedMasterDeleteIds(new Set());
                      setShowMasterUploadModal(true);
                    }}
                    className="btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.85rem', background: 'var(--gold-deep)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    <Upload size={14} /> Upload Master Data
                  </button>
                </div>
              </div>

              {/* Advanced Filters Grid for Master Tab */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', background: 'var(--paper-2)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--line)', marginBottom: '1rem', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)' }}>Phone Filter</label>
                  <input
                    type="text"
                    placeholder="e.g. 91987..."
                    value={masterFilterPhone}
                    onChange={(e) => setMasterFilterPhone(e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)' }}>Email/Domain</label>
                  <input
                    type="text"
                    placeholder="e.g. @gmail.com"
                    value={masterFilterEmail}
                    onChange={(e) => setMasterFilterEmail(e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)' }}>Address Keyword</label>
                  <input
                    type="text"
                    placeholder="e.g. Delhi"
                    value={masterFilterAddress}
                    onChange={(e) => setMasterFilterAddress(e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)' }}>Uploaded From</label>
                  <input
                    type="date"
                    value={masterFilterFromDate}
                    onChange={(e) => setMasterFilterFromDate(e.target.value)}
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)' }}>Uploaded To</label>
                  <input
                    type="date"
                    value={masterFilterToDate}
                    onChange={(e) => setMasterFilterToDate(e.target.value)}
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMasterFilterPhone('');
                      setMasterFilterEmail('');
                      setMasterFilterAddress('');
                      setMasterFilterFromDate('');
                      setMasterFilterToDate('');
                      setMasterContactsSearch('');
                      setSelectedMasterDeleteIds(new Set());
                    }}
                    className="btn-secondary"
                    style={{ padding: '0.35rem', fontSize: '0.78rem', width: '100%', height: '28px', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Reset Filters
                  </button>
                </div>
              </div>

              {/* Master Contacts grid list */}
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', minHeight: 0 }}>
                {filteredMasterContacts.length === 0 ? (
                  <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--muted)' }}>
                    <FileSpreadsheet size={36} style={{ color: 'var(--line)', marginBottom: '0.75rem' }} />
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>No contacts found in Master Data Center.</div>
                    <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>Upload an Excel or CSV file containing customer rows to populate the master repository.</div>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--paper-2)', zIndex: 10 }}>
                      <tr style={{ borderBottom: '1px solid var(--line)' }}>
                        <th style={{ padding: '0.75rem 1rem', width: '40px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={filteredMasterContacts.length > 0 && filteredMasterContacts.every(c => selectedMasterDeleteIds.has(c.id))}
                            onChange={(e) => {
                              const newSet = new Set(selectedMasterDeleteIds);
                              if (e.target.checked) {
                                filteredMasterContacts.forEach(c => newSet.add(c.id));
                              } else {
                                filteredMasterContacts.forEach(c => newSet.delete(c.id));
                              }
                              setSelectedMasterDeleteIds(newSet);
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                        </th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Name</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Contact (WhatsApp)</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Email Address</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Address</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Uploaded At</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)', width: '60px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMasterContacts.map(c => {
                        const isChecked = selectedMasterDeleteIds.has(c.id);
                        return (
                          <tr
                            key={c.id}
                            onClick={() => {
                              const newSet = new Set(selectedMasterDeleteIds);
                              if (isChecked) {
                                newSet.delete(c.id);
                              } else {
                                newSet.add(c.id);
                              }
                              setSelectedMasterDeleteIds(newSet);
                            }}
                            style={{ borderBottom: '1px solid var(--line)', transition: 'background 0.15s ease', cursor: 'pointer', background: isChecked ? 'rgba(224, 168, 46, 0.05)' : 'transparent' }}
                            className="table-row-hover"
                          >
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const newSet = new Set(selectedMasterDeleteIds);
                                  if (e.target.checked) {
                                    newSet.add(c.id);
                                  } else {
                                    newSet.delete(c.id);
                                  }
                                  setSelectedMasterDeleteIds(newSet);
                                }}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{c.name}</td>
                            <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)' }}>{c.contact}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>{c.mail}</td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)' }}>{c.address || '—'}</td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)', fontSize: '0.78rem' }}>{c.created_at ? new Date(c.created_at).toLocaleString() : '—'}</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleDeleteMasterContact(c.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--err)', padding: '0.2rem' }}
                                title="Delete Contact"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              
              {/* Counter Footer */}
              <div style={{ marginTop: '0.85rem', fontSize: '0.8rem', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
                <span>Showing {filteredMasterContacts.length} of {masterContacts.length} master entries</span>
                <span>Centralized Pool</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: DATA STORAGE (CONTACTS REPO) */}
        {activeSubTab === 'data_storage' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {!selectedCampaignId ? (
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexShrink: 0 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Operational Campaigns</h3>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>Select a campaign to manage its contacts, or create a new campaign pool.</p>
                  </div>
                  <button
                    onClick={() => setShowCreateCampaignModal(true)}
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', background: 'var(--gold-deep)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    <Plus size={16} /> Create Campaign
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  {campaigns.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3.5rem 1rem', background: 'var(--paper-2)', borderRadius: '12px', border: '1px dashed var(--line)' }}>
                      <Users size={36} style={{ color: 'var(--muted)', marginBottom: '0.75rem' }} />
                      <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '0.95rem' }}>No Campaigns Found</div>
                      <p style={{ color: 'var(--muted)', fontSize: '0.8rem', textAlign: 'center', maxWidth: '360px', margin: '0.25rem 0 1rem 0' }}>Get started by creating your first credit card lead or referral campaign group.</p>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--line)', color: 'var(--muted)', fontWeight: 700 }}>
                          <th style={{ padding: '0.75rem 1rem' }}>Campaign Name</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Description</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>No. of Data (Contacts)</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Created At</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaigns.map(c => (
                          <tr
                            key={c.id}
                            style={{ borderBottom: '1px solid var(--line)', transition: 'background 0.2s ease', cursor: 'pointer' }}
                            className="table-row-hover"
                          >
                            <td
                              onClick={() => setSelectedCampaignId(c.id)}
                              style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--gold-deep)' }}
                            >
                              {c.name}
                            </td>
                            <td
                              onClick={() => setSelectedCampaignId(c.id)}
                              style={{ padding: '0.75rem 1rem', color: 'var(--muted)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {c.description || <em style={{ opacity: 0.6 }}>No description</em>}
                            </td>
                            <td
                              onClick={() => setSelectedCampaignId(c.id)}
                              style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600 }}
                            >
                              <span style={{ background: 'rgba(224, 168, 46, 0.1)', color: 'var(--gold-deep)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                                {c.leads_count || 0} Contacts
                              </span>
                            </td>
                            <td
                              onClick={() => setSelectedCampaignId(c.id)}
                              style={{ padding: '0.75rem 1rem', color: 'var(--muted)', fontSize: '0.8rem' }}
                            >
                              {c.created_at ? new Date(c.created_at).toLocaleDateString() : 'N/A'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCampaign(c.id);
                                }}
                                style={{ background: 'rgba(209, 67, 67, 0.1)', color: 'var(--err)', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '0.35rem 0.6rem' }}
                                title="Delete Campaign"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : (
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)', padding: '1.25rem' }}>
                {/* Search and Action Strip */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap', flexShrink: 0 }}>
                  <div style={{ position: 'relative', maxWidth: '320px', width: '100%' }}>
                    <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                    <input
                      type="text"
                      placeholder="Search name, phone, email, address..."
                      value={contactsSearch}
                      onChange={(e) => setContactsSearch(e.target.value)}
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

                  <button
                    onClick={() => {
                      setSelectedMasterIds(new Set());
                      setFilterPhone('');
                      setFilterEmail('');
                      setFilterAddress('');
                      setFilterFromDate('');
                      setFilterToDate('');
                      setImportSearch('');
                      setShowImportModal(true);
                    }}
                    className="btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1.1rem', fontSize: '0.85rem', background: 'var(--gold-deep)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    <Plus size={14} /> Align from Master Data
                  </button>
                </div>

                {/* Contacts grid list */}
                <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', minHeight: 0 }}>
                  {filteredContacts.length === 0 ? (
                    <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--muted)' }}>
                      <FileSpreadsheet size={36} style={{ color: 'var(--line)', marginBottom: '0.75rem' }} />
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>No contacts found in campaign storage.</div>
                      <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>Upload an Excel or CSV file containing customer rows to get started.</div>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--paper-2)', zIndex: 10 }}>
                        <tr style={{ borderBottom: '1px solid var(--line)' }}>
                          <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Name</th>
                          <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Contact (WhatsApp)</th>
                          <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Email Address</th>
                          <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Address</th>
                          <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)', width: '60px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredContacts.map(c => (
                          <tr key={c.id} style={{ borderBottom: '1px solid var(--line)', transition: 'background 0.15s ease' }} className="table-row-hover">
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{c.name}</td>
                            <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)' }}>{c.contact}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>{c.mail}</td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)' }}>{c.address || '—'}</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                              <button
                                onClick={() => handleDeleteContact(c.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--err)', padding: '0.2rem' }}
                                title="Delete Contact"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                
                {/* Total Counter Footer */}
                <div style={{ marginTop: '0.85rem', fontSize: '0.8rem', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
                  <span>Showing {filteredContacts.length} of {contacts.length} entries</span>
                  <span>Campaign ID: <code>{selectedCampaignId}</code></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BROADCAST CAMPAIGNS (CAMPAIGN CREATOR & STATS) */}
        {activeSubTab === 'broadcast' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {!selectedCampaignId ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--muted)', background: 'var(--paper-2)', borderRadius: '12px', padding: '3rem', textAlign: 'center' }}>
                <MessageSquare size={48} style={{ strokeWidth: 1.25, color: 'var(--muted)', marginBottom: '1rem' }} />
                <h3 style={{ margin: '0 0 0.5rem 0' }}>No Campaign Selected</h3>
                <p style={{ fontSize: '0.85rem', maxWidth: '400px', margin: '0 0 1.25rem 0' }}>Select an operational campaign from the selector above, or create a new campaign to begin scheduling broadcasts.</p>
              </div>
            ) : (
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)', padding: '1.25rem' }}>
                {/* Action Strip */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexShrink: 0 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Broadcast Schedules</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>Outgoing WhatsApp & Email dispatch triggers for this campaign group.</p>
                  </div>
                  <button
                    onClick={() => {
                      if (contacts.length === 0) {
                        showToast('Please upload contacts to your campaign data storage before creating a broadcast.', 'error');
                        return;
                      }
                      setShowNewBroadcastModal(true);
                    }}
                    className="btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.85rem', background: 'var(--gold-deep)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    <Plus size={15} /> New Broadcast Campaign
                  </button>
                </div>

                {/* Broadcasts grid list */}
                <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', minHeight: 0 }}>
                  {isLoadingBroadcasts ? (
                    <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--muted)' }}>
                      <RefreshCw size={24} className="spin" style={{ marginBottom: '0.5rem' }} />
                      <div>Loading scheduled campaigns...</div>
                    </div>
                  ) : broadcasts.length === 0 ? (
                    <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--muted)' }}>
                      <MessageSquare size={36} style={{ color: 'var(--line)', marginBottom: '0.75rem' }} />
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>No broadcasts set up yet.</div>
                      <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>Click "New Broadcast Campaign" to schedule WhatsApp notifications or bulk email.</div>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--paper-2)', zIndex: 10 }}>
                        <tr style={{ borderBottom: '1px solid var(--line)' }}>
                          <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Name</th>
                          <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)', width: '90px' }}>Channel</th>
                          <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)', width: '90px' }}>Type</th>
                          <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)', width: '110px' }}>Status</th>
                          <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)', width: '80px', textAlign: 'center' }}>Targeted</th>
                          <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)', width: '80px', textAlign: 'center' }}>Sent To</th>
                          <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Performance</th>
                          <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)', width: '110px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {broadcasts.map(b => {
                          const deliveryPercent = b.targeted_count > 0 ? Math.round((b.sent_count / b.targeted_count) * 100) : 0;
                          const readPercent = b.status === 'sent' ? Math.round((b.sent_count > 0 ? 0.75 : 0) * 100) : 0;

                          return (
                            <tr key={b.id} style={{ borderBottom: '1px solid var(--line)' }} className="table-row-hover">
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ fontWeight: 600 }}>{b.name}</div>
                                {b.scheduled_at && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                                    Scheduled: {new Date(b.scheduled_at).toLocaleString()}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  {(b.channel === 'whatsapp' || b.channel === 'both') && <MessageSquare size={14} style={{ color: '#22c55e' }} title="WhatsApp" />}
                                  {(b.channel === 'email' || b.channel === 'both') && <Mail size={14} style={{ color: '#3b82f6' }} title="Email" />}
                                  <span style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: 'var(--ink)', fontWeight: 500 }}>{b.channel}</span>
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)', fontSize: '0.78rem' }}>One Way</td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '20px',
                                  textTransform: 'uppercase',
                                  background: 
                                    b.status === 'sent' ? 'rgba(34, 197, 94, 0.15)' : 
                                    b.status === 'scheduled' ? 'rgba(234, 179, 8, 0.15)' : 
                                    b.status === 'processing' ? 'rgba(59, 130, 246, 0.15)' : 
                                    b.status === 'failed' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                                  color: 
                                    b.status === 'sent' ? '#22c55e' : 
                                    b.status === 'scheduled' ? '#eab308' : 
                                    b.status === 'processing' ? '#3b82f6' : 
                                    b.status === 'failed' ? '#ef4444' : 'var(--muted)'
                                }}>
                                  {b.status}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600 }}>{b.targeted_count}</td>
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600 }}>{b.sent_count}</td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxWidth: '140px' }}>
                                  {/* Delivery bar */}
                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--muted)', marginBottom: '0.1rem' }}>
                                      <span>Delivery Rate</span>
                                      <span style={{ fontWeight: 600 }}>{deliveryPercent}%</span>
                                    </div>
                                    <div style={{ height: '5px', background: 'var(--paper-2)', borderRadius: '10px', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${deliveryPercent}%`, background: '#22c55e', borderRadius: '10px' }}></div>
                                    </div>
                                  </div>
                                  
                                  {/* Read bar */}
                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--muted)', marginBottom: '0.1rem' }}>
                                      <span>Read Rate</span>
                                      <span style={{ fontWeight: 600 }}>{readPercent}%</span>
                                    </div>
                                    <div style={{ height: '5px', background: 'var(--paper-2)', borderRadius: '10px', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${readPercent}%`, background: '#3b82f6', borderRadius: '10px' }}></div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                  {(() => {
                                    const isSent = b.status === 'sent';
                                    const isProcessing = b.status === 'processing' || b.status === 'scheduled';
                                    
                                    // Check local client-side 1-hour throttle if status is sent
                                    let isLocked = false;
                                    let minutesLeft = 0;
                                    if (isSent && b.last_triggered_at && b.last_trigger_status === 'sent') {
                                      const lastTriggered = new Date(b.last_triggered_at).getTime();
                                      const diff = Date.now() - lastTriggered;
                                      const oneHour = 60 * 60 * 1000;
                                      if (diff < oneHour) {
                                        isLocked = true;
                                        minutesLeft = Math.ceil((oneHour - diff) / (60 * 1000));
                                      }
                                    }

                                    if (isProcessing) return null;

                                    return (
                                      <button
                                        onClick={() => handleTriggerBroadcast(b.id)}
                                        disabled={isLocked}
                                        className="btn-primary"
                                        style={{ 
                                          display: 'inline-flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'center', 
                                          height: '28px', 
                                          width: '28px', 
                                          padding: 0, 
                                          borderRadius: '4px', 
                                          background: isLocked ? 'var(--muted)' : '#22c55e', 
                                          color: '#fff', 
                                          border: 'none', 
                                          cursor: isLocked ? 'not-allowed' : 'pointer',
                                          opacity: isLocked ? 0.5 : 1
                                        }}
                                        title={isLocked ? `Locked. Ready in ${minutesLeft} mins` : "Trigger Broadcast Now"}
                                      >
                                        <Play size={12} />
                                      </button>
                                    );
                                  })()}
                                  <button
                                    onClick={() => handleDeleteBroadcast(b.id)}
                                    className="btn-secondary"
                                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '28px', width: '28px', padding: 0, borderRadius: '4px', background: 'rgba(209, 67, 67, 0.1)', color: 'var(--err)', borderColor: 'rgba(209, 67, 67, 0.2)' }}
                                    title="Delete Broadcast"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        )}



        {/* TAB 4: SMTP GATEWAY SETTINGS */}
        {activeSubTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div className="glass-panel" style={{ borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)', padding: '1.75rem', maxWidth: '640px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
                <SettingsIcon size={22} style={{ color: 'var(--gold-deep)' }} />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>SMTP Mail Gateway Configuration</h3>
              </div>

              <form onSubmit={handleSaveSMTPSettings}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>SMTP Host / Server</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. smtp.gmail.com"
                      value={smtpSettings.host}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Port</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 465"
                      value={smtpSettings.port}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, port: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Username (Email Address)</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="smtp-user@gmail.com"
                      value={smtpSettings.user}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, user: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Password</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="••••••••••••••••"
                      value={smtpSettings.pass}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, pass: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Sender From Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="FinMantra Notifications"
                      value={smtpSettings.fromName}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, fromName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Sender From Email</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="sender@domain.com"
                      value={smtpSettings.fromEmail}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, fromEmail: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={smtpSettings.secure === 'true'}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, secure: e.target.checked ? 'true' : 'false' })}
                      style={{ height: '16px', width: '16px', accentColor: 'var(--gold-deep)' }}
                    />
                    Use SSL / TLS connection protocol (Required for Gmail port 465)
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: '1.25rem' }}>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isSavingSettings}
                    style={{ background: 'var(--gold-deep)', color: '#fff', padding: '0.55rem 1.25rem' }}
                  >
                    {isSavingSettings ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 5: DEVELOPER / ADMIN GUIDE */}
        {activeSubTab === 'guide' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div className="glass-panel" style={{ borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)', padding: '1.75rem', maxWidth: '800px', overflowY: 'auto' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 700 }}>Campaign Module Setup & Guidelines</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ background: 'rgba(224, 168, 46, 0.08)', border: '1px solid rgba(224, 168, 46, 0.25)', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--gold-deep)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    <Info size={16} /> Spreadsheet Formatting Notice
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0 }}>
                    When importing data into a campaign data storage repository, make sure the CSV or Excel file contains the exact column headers listed below. Order does not matter, but letters must match exactly.
                  </p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(224, 168, 46, 0.2)' }}>
                        <th style={{ padding: '0.4rem', textAlign: 'left', fontWeight: 700 }}>Header Column</th>
                        <th style={{ padding: '0.4rem', textAlign: 'left', fontWeight: 700 }}>Validation Rules</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '0.4rem' }}><code>Name</code> or <code>Full Name</code></td>
                        <td style={{ padding: '0.4rem' }}>Required. Text value mapping customer's identifier.</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '0.4rem' }}><code>Contact</code> or <code>Phone</code></td>
                        <td style={{ padding: '0.4rem' }}>Required. Must contain country code + phone digits (e.g. <code>919876543210</code>). Non-digits are stripped.</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '0.4rem' }}><code>Mail</code> or <code>Email</code></td>
                        <td style={{ padding: '0.4rem' }}>Required. Valid email syntax checklist (e.g. <code>user@gmail.com</code>).</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '0.4rem' }}><code>Address</code></td>
                        <td style={{ padding: '0.4rem' }}>Optional. General location details.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div>
                  <h4 style={{ fontWeight: 700, margin: '0 0 0.5rem 0' }}>Dynamic Message Variables</h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: '0 0 0.75rem 0' }}>
                    You can inject contact details into broadcast subject lines and message templates by writing bracket placeholders:
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                    <div style={{ background: 'var(--paper-2)', padding: '0.65rem', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '0.8rem' }}>
                      <strong>Name Replacement</strong><br/>
                      Use <code>{`{name}`}</code> to dynamically render target full name.
                    </div>
                    <div style={{ background: 'var(--paper-2)', padding: '0.65rem', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '0.8rem' }}>
                      <strong>Phone Replacement</strong><br/>
                      Use <code>{`{contact}`}</code> to print target's contact number.
                    </div>
                    <div style={{ background: 'var(--paper-2)', padding: '0.65rem', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '0.8rem' }}>
                      <strong>Email Replacement</strong><br/>
                      Use <code>{`{mail}`}</code> to print target's email.
                    </div>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontWeight: 700, margin: '0 0 0.5rem 0' }}>Active Gateways Fallback Mechanism</h4>
                  <ul style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: 0, paddingLeft: '1.25rem', lineHeight: 1.6 }}>
                    <li><strong>Email broadcasts</strong> require valid configuration credentials under the Gateway Settings. If left empty, the scheduler will only log delivery outputs in a simulation mode.</li>
                    <li><strong>WhatsApp broadcasts</strong> leverage the system's global gateway. If using the QR-code Baileys setup, confirm the device is CONNECTED in the primary settings page before running campaigns.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: TEMPLATES MANAGER */}
        {activeSubTab === 'templates' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Templates Manager</h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>Manage reusable layouts for Emails & Meta WhatsApp broadcasts.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={syncMetaStatuses}
                  disabled={isSyncingMeta}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', background: 'var(--paper-2)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                >
                  <RefreshCw size={14} className={isSyncingMeta ? 'spin' : ''} /> Sync Meta Status
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
                      buttons: {
                        buttonType: 'NONE',
                        ctaUrlText: '',
                        ctaUrlValue: '',
                        ctaPhoneText: '',
                        ctaPhoneValue: '',
                        quickReplies: ['', '', '']
                      }
                    });
                    setEditingTemplateId(null);
                    setShowCreateTemplateModal(true);
                  }}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', background: 'var(--gold-deep)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                >
                  <Plus size={16} /> Create Template
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {/* SECTION 1: Meta WhatsApp Templates */}
              {metaTemplates.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%', background: '#25D366',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <MessageSquare size={14} style={{ color: '#fff' }} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--ink)' }}>Meta WhatsApp Templates</h4>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--muted)' }}>
                        {metaTemplates.length} template{metaTemplates.length !== 1 ? 's' : ''} registered on your Meta Business Account
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                    {metaTemplates.map(mt => {
                      const bodyComp = mt.components?.find(c => c.type === 'BODY');
                      const headerComp = mt.components?.find(c => c.type === 'HEADER');
                      const buttonsComp = mt.components?.find(c => c.type === 'BUTTONS');
                      const bodyText = bodyComp?.text || '';
                      
                      let statusBadgeBg = '#25D366';
                      let statusBadgeColor = '#fff';
                      if (mt.status === 'REJECTED') { statusBadgeBg = '#ef4444'; statusBadgeColor = '#fff'; }
                      else if (mt.status === 'PENDING' || mt.status === 'IN_APPEAL') { statusBadgeBg = '#f59e0b'; statusBadgeColor = '#fff'; }
                      else if (mt.status === 'PAUSED' || mt.status === 'DISABLED') { statusBadgeBg = '#6b7280'; statusBadgeColor = '#fff'; }

                      return (
                        <div
                          key={mt.id}
                          style={{
                            borderRadius: '14px',
                            overflow: 'hidden',
                            border: '1px solid var(--line)',
                            background: 'var(--paper)',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                            cursor: 'default'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                          {/* Card Header - WhatsApp themed */}
                          <div style={{
                            background: 'linear-gradient(135deg, #075E54 0%, #128C7E 100%)',
                            padding: '0.85rem 1rem',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <svg viewBox="0 0 24 24" width="18" height="18" fill="#25D366">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              <span style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.02em' }}>
                                {mt.name}
                              </span>
                            </div>
                            <span style={{
                              fontSize: '0.62rem', fontWeight: 800, padding: '0.2rem 0.55rem',
                              borderRadius: '10px', background: statusBadgeBg, color: statusBadgeColor,
                              textTransform: 'uppercase', letterSpacing: '0.04em'
                            }}>
                              {mt.status}
                            </span>
                          </div>

                          {/* WhatsApp Chat Preview */}
                          <div style={{
                            background: theme === 'dark' ? '#0b141a' : '#e5ddd5',
                            backgroundImage: theme === 'dark' 
                              ? 'none' 
                              : 'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'p\' width=\'40\' height=\'40\' patternUnits=\'userSpaceOnUse\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'1.2\' fill=\'%23d4cec3\' opacity=\'0.5\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\'200\' height=\'200\' fill=\'url(%23p)\'/%3E%3C/svg%3E")',
                            padding: '1rem 0.85rem',
                            minHeight: '120px'
                          }}>
                            {/* Message Bubble */}
                            <div style={{
                              background: theme === 'dark' ? '#005c4b' : '#dcf8c6',
                              borderRadius: '0 8px 8px 8px',
                              padding: '0.6rem 0.7rem',
                              maxWidth: '95%',
                              position: 'relative',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}>
                              {/* Header preview */}
                              {headerComp && (
                                <div style={{ marginBottom: '0.4rem' }}>
                                  {headerComp.format === 'IMAGE' && (
                                    <div style={{
                                      background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                      borderRadius: '6px', padding: '1.25rem', textAlign: 'center',
                                      marginBottom: '0.35rem', border: `1px dashed ${theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}`
                                    }}>
                                      <span style={{ fontSize: '1.5rem' }}>🖼️</span>
                                      <div style={{ fontSize: '0.68rem', color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)', marginTop: '0.15rem' }}>Image Header</div>
                                    </div>
                                  )}
                                  {headerComp.format === 'VIDEO' && (
                                    <div style={{
                                      background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                      borderRadius: '6px', padding: '1.25rem', textAlign: 'center',
                                      marginBottom: '0.35rem', border: `1px dashed ${theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}`
                                    }}>
                                      <span style={{ fontSize: '1.5rem' }}>🎬</span>
                                      <div style={{ fontSize: '0.68rem', color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)', marginTop: '0.15rem' }}>Video Header</div>
                                    </div>
                                  )}
                                  {headerComp.format === 'DOCUMENT' && (
                                    <div style={{
                                      background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                      borderRadius: '6px', padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                                      marginBottom: '0.35rem', border: `1px dashed ${theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}`
                                    }}>
                                      <span style={{ fontSize: '1.2rem' }}>📄</span>
                                      <span style={{ fontSize: '0.72rem', color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }}>Document Attachment</span>
                                    </div>
                                  )}
                                  {headerComp.format === 'TEXT' && headerComp.text && (
                                    <div style={{
                                      fontWeight: 700,
                                      fontSize: '0.82rem',
                                      color: theme === 'dark' ? '#e9edef' : '#111b21',
                                      marginBottom: '0.25rem'
                                    }}>
                                      {headerComp.text}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Body text */}
                              <div style={{
                                fontSize: '0.78rem',
                                lineHeight: '1.45',
                                color: theme === 'dark' ? '#e9edef' : '#111b21',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                              }}>
                                {bodyText.replace(/\{\{(\d+)\}\}/g, (_, n) => `[Param ${n}]`)}
                              </div>

                              {/* Timestamp */}
                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                                <span style={{ fontSize: '0.62rem', color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)' }}>
                                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  <span style={{ marginLeft: '0.25rem' }}>✓✓</span>
                                </span>
                              </div>
                            </div>

                            {/* Button previews - outside the bubble like real WhatsApp */}
                            {buttonsComp && buttonsComp.buttons && buttonsComp.buttons.length > 0 && (
                              <div style={{ maxWidth: '95%', marginTop: '2px' }}>
                                {buttonsComp.buttons.map((btn, bi) => (
                                  <div
                                    key={bi}
                                    style={{
                                      background: theme === 'dark' ? '#005c4b' : '#dcf8c6',
                                      borderRadius: bi === buttonsComp.buttons.length - 1 ? '0 0 8px 8px' : '0',
                                      padding: '0.5rem 0.7rem',
                                      textAlign: 'center',
                                      borderTop: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem'
                                    }}
                                  >
                                    {btn.type === 'URL' && (
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme === 'dark' ? '#53bdeb' : '#027eb5'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                                      </svg>
                                    )}
                                    {btn.type === 'PHONE_NUMBER' && (
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme === 'dark' ? '#53bdeb' : '#027eb5'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                                      </svg>
                                    )}
                                    {btn.type === 'QUICK_REPLY' && (
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme === 'dark' ? '#53bdeb' : '#027eb5'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 00-4-4H4" />
                                      </svg>
                                    )}
                                    <span style={{
                                      fontSize: '0.76rem', fontWeight: 600,
                                      color: theme === 'dark' ? '#53bdeb' : '#027eb5'
                                    }}>
                                      {btn.text}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Card Footer - Meta info */}
                          <div style={{
                            padding: '0.65rem 1rem',
                            borderTop: '1px solid var(--line)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'var(--paper)'
                          }}>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                              <span style={{
                                fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.4rem',
                                borderRadius: '4px', textTransform: 'uppercase',
                                background: mt.category === 'MARKETING' ? 'rgba(245, 158, 11, 0.12)' : mt.category === 'UTILITY' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                color: mt.category === 'MARKETING' ? '#d97706' : mt.category === 'UTILITY' ? '#2563eb' : '#059669'
                              }}>
                                {mt.category}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>
                                {mt.language || 'en_US'}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.62rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
                              ID: {mt.id}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION 2: Custom/Local Templates */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%', background: 'var(--gold-deep)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <FileText size={14} style={{ color: '#fff' }} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--ink)' }}>Custom Templates</h4>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--muted)' }}>
                      Templates registered in your FinMantra database
                    </p>
                  </div>
                </div>

                {templates.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3.5rem 1rem', background: 'var(--paper-2)', borderRadius: '12px', border: '1px dashed var(--line)' }}>
                    <HelpCircle size={36} style={{ color: 'var(--muted)', marginBottom: '0.75rem' }} />
                    <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '0.95rem' }}>No Custom Templates Found</div>
                    <p style={{ color: 'var(--muted)', fontSize: '0.8rem', textAlign: 'center', maxWidth: '360px', margin: '0.25rem 0 1rem 0' }}>Click "Create Template" to register a new WhatsApp template or Email layout.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                    {templates.map(tpl => {
                      const lookupKey = tpl.meta_template_name?.toLowerCase() || tpl.name?.toLowerCase();
                      const metaInfo = metaStatuses[lookupKey];
                      let statusText = 'Not Registered';
                      let statusBg = 'rgba(107, 114, 128, 0.15)';
                      let statusColor = '#6b7280';
                      
                      if (metaInfo) {
                        statusText = metaInfo.status;
                        if (statusText === 'APPROVED') {
                          statusBg = 'rgba(16, 185, 129, 0.15)';
                          statusColor = '#10b981';
                        } else if (statusText?.includes('PENDING')) {
                          statusBg = 'rgba(245, 158, 11, 0.15)';
                          statusColor = '#f59e0b';
                        } else if (statusText?.includes('REJECTED') || statusText?.includes('LIMIT')) {
                          statusBg = 'rgba(239, 68, 68, 0.15)';
                          statusColor = '#ef4444';
                        }
                      }

                      return (
                        <div
                          key={tpl.id}
                          className="glass-panel"
                          style={{
                            padding: '1.25rem',
                            borderRadius: '12px',
                            border: '1px solid var(--line)',
                            background: 'var(--paper)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            minHeight: '220px',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                background: tpl.type === 'email' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                color: tpl.type === 'email' ? '#3b82f6' : '#10b981'
                              }}>
                                {tpl.type}
                              </span>
                              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                {tpl.type === 'whatsapp' && (
                                  <span style={{
                                    fontSize: '0.62rem',
                                    fontWeight: 800,
                                    padding: '0.15rem 0.4rem',
                                    borderRadius: '4px',
                                    background: statusBg,
                                    color: statusColor,
                                    textTransform: 'uppercase'
                                  }}>
                                    Meta: {statusText}
                                  </span>
                                )}
                                <button
                                  onClick={() => {
                                    let parsedButtons = {
                                      buttonType: 'NONE',
                                      ctaUrlText: '',
                                      ctaUrlValue: '',
                                      ctaPhoneText: '',
                                      ctaPhoneValue: '',
                                      quickReplies: ['', '', '']
                                    };
                                    if (tpl.buttons) {
                                      try {
                                        const parsed = typeof tpl.buttons === 'string' ? JSON.parse(tpl.buttons) : tpl.buttons;
                                        parsedButtons = { ...parsedButtons, ...parsed };
                                      } catch (e) {}
                                    }

                                    setNewTemplateForm({
                                      id: tpl.id,
                                      name: tpl.name,
                                      type: tpl.type,
                                      subject: tpl.subject || '',
                                      body: tpl.body || '',
                                      metaTemplateName: tpl.meta_template_name || '',
                                      mediaUrl: tpl.media_url || '',
                                      category: tpl.category || 'MARKETING',
                                      language: tpl.language || 'en_US',
                                      headerFormat: tpl.header_format || 'NONE',
                                      buttons: parsedButtons
                                    });
                                    setEditingTemplateId(tpl.id);
                                    setShowCreateTemplateModal(true);
                                  }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0 }}
                                  title="Edit Template"
                                >
                                  <FileText size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteTemplate(tpl.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0 }}
                                  title="Delete Template"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--ink)' }}>{tpl.name}</h4>
                            
                            {tpl.type === 'email' && (
                              <div style={{ marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                                <span style={{ fontWeight: 600, color: 'var(--muted)' }}>Subject: </span>
                                <span style={{ color: 'var(--ink)' }}>{tpl.subject}</span>
                              </div>
                            )}
                            {tpl.type === 'whatsapp' && tpl.meta_template_name && (
                              <div style={{ marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                                <span style={{ fontWeight: 600, color: 'var(--muted)' }}>Approved Code: </span>
                                <code style={{ background: 'var(--paper-2)', padding: '0.1rem 0.3rem', borderRadius: '4px', fontSize: '0.75rem' }}>{tpl.meta_template_name}</code>
                              </div>
                            )}
                            {tpl.media_url && (
                              <div style={{ marginBottom: '0.5rem', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                <span style={{ fontWeight: 600, color: 'var(--muted)' }}>Attachment: </span>
                                <a href={tpl.media_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold-deep)', textDecoration: 'underline' }}>View Media Link</a>
                              </div>
                            )}
                            
                            <div style={{ marginTop: '0.5rem' }}>
                              <span style={{ fontWeight: 600, color: 'var(--muted)', fontSize: '0.8rem' }}>Content Body:</span>
                              <div style={{
                                marginTop: '0.25rem',
                                padding: '0.5rem',
                                borderRadius: '6px',
                                background: 'var(--paper-2)',
                                fontSize: '0.78rem',
                                color: 'var(--ink)',
                                maxHeight: '100px',
                                overflowY: 'auto',
                                whiteSpace: 'pre-wrap',
                                border: '1px solid var(--line)'
                              }}>
                                {tpl.body}
                              </div>
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
      </div>

      {/* CREATE CAMPAIGN MODAL */}
      {showCreateCampaignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', borderRadius: '16px', background: 'var(--paper)', border: '1px solid var(--line)', padding: '1.5rem', borderTop: '4px solid var(--gold-deep)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Create New Campaign Group</h3>
              <button onClick={() => setShowCreateCampaignModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateCampaign}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Campaign Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Q3 Credit Card Leads"
                  value={newCampaignForm.name}
                  onChange={(e) => setNewCampaignForm({ ...newCampaignForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Description (Optional)</label>
                <textarea
                  className="form-input"
                  placeholder="Notes on the origin or target criteria of these contacts..."
                  value={newCampaignForm.description}
                  onChange={(e) => setNewCampaignForm({ ...newCampaignForm, description: e.target.value })}
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
                <button type="button" onClick={() => setShowCreateCampaignModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={isCreatingCampaign} style={{ background: 'var(--gold-deep)', color: '#fff' }}>
                  {isCreatingCampaign ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE TEMPLATE MODAL */}
      {showCreateTemplateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '16px', background: 'var(--paper)', border: '1px solid var(--line)', padding: '1.5rem', borderTop: '4px solid var(--gold-deep)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{editingTemplateId ? 'Edit Message Template' : 'Save & Register New Template'}</h3>
              <button onClick={() => { setShowCreateTemplateModal(false); setEditingTemplateId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateTemplate}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Template Reference Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. welcome_offer_v2"
                  value={newTemplateForm.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    const cleanName = val.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                    setNewTemplateForm({ ...newTemplateForm, name: val, metaTemplateName: cleanName });
                  }}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Template Type</label>
                <select
                  value={newTemplateForm.type}
                  onChange={(e) => setNewTemplateForm({ ...newTemplateForm, type: e.target.value })}
                  className="form-input"
                  style={{ background: 'var(--paper-2)', color: 'var(--ink)' }}
                >
                  <option value="whatsapp">WhatsApp Template (Registers with Meta)</option>
                  <option value="email">Email Template (Local Layout)</option>
                </select>
              </div>

              {newTemplateForm.type === 'email' ? (
                <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Email Subject Line</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Hello {name}, your special offer is here!"
                      value={newTemplateForm.subject || ''}
                      onChange={(e) => setNewTemplateForm({ ...newTemplateForm, subject: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Email Body Content (HTML Supported)</label>
                    <textarea
                      className="form-input"
                      placeholder="Enter email layout. Placeholders: {name}, {contact}, {mail}"
                      value={newTemplateForm.body}
                      onChange={(e) => setNewTemplateForm({ ...newTemplateForm, body: e.target.value })}
                      rows={5}
                      required
                    />
                  </div>
                </div>
              ) : (
                <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--gold-deep)', marginBottom: '0.75rem' }}>Meta WABA API Parameters</div>
                  
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Approved Template Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. welcome_offer_v2"
                      value={newTemplateForm.metaTemplateName || ''}
                      onChange={(e) => setNewTemplateForm({ ...newTemplateForm, metaTemplateName: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                      required
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.15rem', display: 'block' }}>
                      Must be unique, lowercase, alphanumeric, and contain underscores only.
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Template Category</label>
                      <select
                        value={newTemplateForm.category || 'MARKETING'}
                        onChange={(e) => setNewTemplateForm({ ...newTemplateForm, category: e.target.value })}
                        className="form-input"
                        style={{ background: 'var(--paper)', color: 'var(--ink)' }}
                      >
                        <option value="MARKETING">MARKETING</option>
                        <option value="UTILITY">UTILITY</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Language Code</label>
                      <input
                        type="text"
                        className="form-input"
                        value={newTemplateForm.language || 'en_US'}
                        onChange={(e) => setNewTemplateForm({ ...newTemplateForm, language: e.target.value })}
                        placeholder="e.g. en_US"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Header Component format</label>
                    <select
                      value={newTemplateForm.headerFormat || 'NONE'}
                      onChange={(e) => setNewTemplateForm({ ...newTemplateForm, headerFormat: e.target.value })}
                      className="form-input"
                      style={{ background: 'var(--paper)', color: 'var(--ink)' }}
                    >
                      <option value="NONE">NONE (No header component)</option>
                      <option value="TEXT">TEXT header</option>
                      <option value="IMAGE">IMAGE header (JPG/PNG)</option>
                      <option value="VIDEO">VIDEO header (MP4)</option>
                      <option value="DOCUMENT">DOCUMENT header (PDF)</option>
                    </select>
                  </div>

                  {newTemplateForm.headerFormat && newTemplateForm.headerFormat !== 'NONE' && newTemplateForm.headerFormat !== 'TEXT' && (
                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Default Send Media URL (Image/Video/PDF Link)</label>
                      <input
                        type="url"
                        className="form-input"
                        placeholder="e.g. https://domain.com/banner.jpg"
                        value={newTemplateForm.mediaUrl || ''}
                        onChange={(e) => setNewTemplateForm({ ...newTemplateForm, mediaUrl: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Template Body Text</label>
                    <textarea
                      className="form-input"
                      placeholder="e.g. Welcome {{1}}, finish your application on: {{2}}"
                      value={newTemplateForm.body}
                      onChange={(e) => setNewTemplateForm({ ...newTemplateForm, body: e.target.value })}
                      rows={4}
                      required
                    />
                    <div style={{ marginTop: '0.45rem', padding: '0.5rem', background: 'rgba(224, 168, 46, 0.08)', border: '1px solid rgba(224, 168, 46, 0.25)', borderRadius: '6px', fontSize: '0.7rem', color: 'var(--gold-deep)' }}>
                      <strong>Template Guidelines:</strong>
                      <ul style={{ margin: '0.2rem 0 0 0', paddingLeft: '1rem', lineHeight: 1.4 }}>
                        <li>Use parameters `{"{{1}}"}` for Name replacement, and `{"{{2}}"}` for dynamic link/message variables.</li>
                        <li>Creating this template will register it <strong>live on your Facebook WhatsApp account</strong>. It will be ready to dispatch immediately once approved by Meta (typically 1-2 minutes).</li>
                      </ul>
                    </div>
                  </div>

                  {/* WhatsApp Buttons Config Section */}
                  <div style={{ marginTop: '1rem', borderTop: '1px dashed var(--line)', paddingTop: '1rem' }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Interactive Buttons (Optional)</label>
                    <select
                      value={newTemplateForm.buttons?.buttonType || 'NONE'}
                      onChange={(e) => {
                        const type = e.target.value;
                        setNewTemplateForm({
                          ...newTemplateForm,
                          buttons: {
                            ...newTemplateForm.buttons,
                            buttonType: type
                          }
                        });
                      }}
                      className="form-input"
                      style={{ background: 'var(--paper)', color: 'var(--ink)', marginBottom: '0.75rem' }}
                    >
                      <option value="NONE">No Buttons</option>
                      <option value="CTA">Call-To-Action (URL & Phone)</option>
                      <option value="QUICK_REPLIES">Quick Replies</option>
                    </select>

                    {newTemplateForm.buttons?.buttonType === 'CTA' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem', background: 'var(--paper)', borderRadius: '6px', border: '1px solid var(--line)' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--gold-deep)' }}>Button 1: Call to Action (URL Website)</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          <input
                            type="text"
                            placeholder="Button Label (e.g. Visit Website)"
                            maxLength={25}
                            value={newTemplateForm.buttons?.ctaUrlText || ''}
                            onChange={(e) => setNewTemplateForm({
                              ...newTemplateForm,
                              buttons: { ...newTemplateForm.buttons, ctaUrlText: e.target.value }
                            })}
                            className="form-input"
                            style={{ fontSize: '0.8rem' }}
                          />
                          <input
                            type="text"
                            placeholder="URL (e.g. https://domain.com/refer/{{1}})"
                            value={newTemplateForm.buttons?.ctaUrlValue || ''}
                            onChange={(e) => setNewTemplateForm({
                              ...newTemplateForm,
                              buttons: { ...newTemplateForm.buttons, ctaUrlValue: e.target.value }
                            })}
                            className="form-input"
                            style={{ fontSize: '0.8rem' }}
                          />
                        </div>

                        <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--gold-deep)', marginTop: '0.35rem' }}>Button 2: Call Support (Phone Call - Optional)</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          <input
                            type="text"
                            placeholder="Button Label (e.g. Call Us)"
                            maxLength={25}
                            value={newTemplateForm.buttons?.ctaPhoneText || ''}
                            onChange={(e) => setNewTemplateForm({
                              ...newTemplateForm,
                              buttons: { ...newTemplateForm.buttons, ctaPhoneText: e.target.value }
                            })}
                            className="form-input"
                            style={{ fontSize: '0.8rem' }}
                          />
                          <input
                            type="text"
                            placeholder="Phone Number (e.g. +919876543210)"
                            value={newTemplateForm.buttons?.ctaPhoneValue || ''}
                            onChange={(e) => setNewTemplateForm({
                              ...newTemplateForm,
                              buttons: { ...newTemplateForm.buttons, ctaPhoneValue: e.target.value }
                            })}
                            className="form-input"
                            style={{ fontSize: '0.8rem' }}
                          />
                        </div>
                      </div>
                    )}

                    {newTemplateForm.buttons?.buttonType === 'QUICK_REPLIES' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: 'var(--paper)', borderRadius: '6px', border: '1px solid var(--line)' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--gold-deep)' }}>Quick Reply Options (Up to 3, max 25 chars each)</div>
                        {[0, 1, 2].map((idx) => (
                          <input
                            key={idx}
                            type="text"
                            placeholder={`Quick Reply Button ${idx + 1} Text`}
                            maxLength={25}
                            value={newTemplateForm.buttons?.quickReplies?.[idx] || ''}
                            onChange={(e) => {
                              const newReplies = [...(newTemplateForm.buttons?.quickReplies || ['', '', ''])];
                              newReplies[idx] = e.target.value;
                              setNewTemplateForm({
                                ...newTemplateForm,
                                buttons: { ...newTemplateForm.buttons, quickReplies: newReplies }
                              });
                            }}
                            className="form-input"
                            style={{ fontSize: '0.8rem' }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem', borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
                <button type="button" onClick={() => setShowCreateTemplateModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isCreatingTemplate} className="btn-primary" style={{ background: 'var(--gold-deep)', color: '#fff' }}>
                  {isCreatingTemplate ? 'Submitting to Meta...' : (editingTemplateId ? 'Update & Save Template' : 'Register & Save Template')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD CONTACTS MODAL */}
      {showUploadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', borderRadius: '16px', background: 'var(--paper)', border: '1px solid var(--line)', padding: '1.5rem', borderTop: '4px solid var(--gold-deep)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet size={20} style={{ color: 'var(--gold-deep)' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Upload Campaign Contacts</h3>
              </div>
              <button onClick={() => { setShowUploadModal(false); setUploadFile(null); setUploadResult(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>

            {!uploadResult ? (
              <form onSubmit={handleUploadContacts}>
                <div style={{ background: 'rgba(224, 168, 46, 0.08)', border: '1px solid rgba(224, 168, 46, 0.2)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--gold-deep)' }}>Need the CSV template?</span><br/>
                    <span style={{ color: 'var(--muted)' }}>Includes all columns: Name, Contact, Mail, Address</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="btn-primary"
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'var(--gold-deep)', color: '#fff' }}
                  >
                    <Download size={12} /> Template
                  </button>
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Select CSV or Excel (.xlsx, .xls) File</label>
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="form-input"
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
                  <button type="button" onClick={() => { setShowUploadModal(false); setUploadFile(null); }} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary" disabled={isUploading} style={{ background: 'var(--gold-deep)', color: '#fff' }}>
                    {isUploading ? 'Processing File...' : 'Upload & Validate'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <Check size={36} style={{ color: '#22c55e', background: 'rgba(34, 197, 94, 0.15)', padding: '0.55rem', borderRadius: '50%', marginBottom: '0.5rem' }} />
                  <h4 style={{ margin: 0, fontWeight: 700 }}>Upload Processed Successfully</h4>
                </div>

                <div style={{ background: 'var(--paper-2)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span>Uploaded Contacts:</span>
                    <span style={{ fontWeight: 700, color: '#22c55e' }}>{uploadResult.created}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span>Rejected Rows:</span>
                    <span style={{ fontWeight: 700, color: uploadResult.failed > 0 ? 'var(--err)' : 'var(--muted)' }}>{uploadResult.failed}</span>
                  </div>
                </div>

                {uploadResult.errors && uploadResult.errors.length > 0 && (
                  <div style={{ maxHeight: '120px', overflowY: 'auto', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: '6px', padding: '0.5rem', fontSize: '0.75rem', color: 'var(--err)', marginBottom: '1.25rem' }}>
                    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Rejection Warnings:</div>
                    {uploadResult.errors.map((err, i) => (
                      <div key={i} style={{ marginBottom: '0.15rem' }}>• {err}</div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadFile(null);
                      setUploadResult(null);
                    }}
                    className="btn-primary"
                    style={{ background: 'var(--gold-deep)', color: '#fff' }}
                  >
                    Close Summary
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* UPLOAD MASTER CONTACTS MODAL */}
      {showMasterUploadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', borderRadius: '16px', background: 'var(--paper)', border: '1px solid var(--line)', padding: '1.5rem', borderTop: '4px solid var(--gold-deep)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet size={20} style={{ color: 'var(--gold-deep)' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Upload Master Contacts</h3>
              </div>
              <button onClick={() => { setShowMasterUploadModal(false); setMasterUploadFile(null); setMasterUploadResult(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>

            {!masterUploadResult ? (
              <form onSubmit={handleUploadMasterContacts}>
                <div style={{ background: 'rgba(224, 168, 46, 0.08)', border: '1px solid rgba(224, 168, 46, 0.2)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--gold-deep)' }}>Need the CSV template?</span><br/>
                    <span style={{ color: 'var(--muted)' }}>Includes all columns: Name, Contact, Mail, Address</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="btn-primary"
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'var(--gold-deep)', color: '#fff' }}
                  >
                    <Download size={12} /> Template
                  </button>
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Select CSV or Excel (.xlsx, .xls) File</label>
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={(e) => setMasterUploadFile(e.target.files[0])}
                    className="form-input"
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
                  <button type="button" onClick={() => { setShowMasterUploadModal(false); setMasterUploadFile(null); }} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary" disabled={isMasterUploading} style={{ background: 'var(--gold-deep)', color: '#fff' }}>
                    {isMasterUploading ? 'Processing File...' : 'Upload Master Pool'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <Check size={36} style={{ color: '#22c55e', background: 'rgba(34, 197, 94, 0.15)', padding: '0.55rem', borderRadius: '50%', marginBottom: '0.5rem' }} />
                  <h4 style={{ margin: 0, fontWeight: 700 }}>Upload Processed Successfully</h4>
                </div>

                <div style={{ background: 'var(--paper-2)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span>Uploaded Master Contacts:</span>
                    <span style={{ fontWeight: 700, color: '#22c55e' }}>{masterUploadResult.insertedCount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span>Rejected Rows:</span>
                    <span style={{ fontWeight: 700, color: masterUploadResult.rejectedCount > 0 ? 'var(--err)' : 'var(--muted)' }}>{masterUploadResult.rejectedCount}</span>
                  </div>
                </div>

                {masterUploadResult.errors && masterUploadResult.errors.length > 0 && (
                  <div style={{ maxHeight: '120px', overflowY: 'auto', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: '6px', padding: '0.5rem', fontSize: '0.75rem', color: 'var(--err)', marginBottom: '1.25rem' }}>
                    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Rejection Warnings:</div>
                    {masterUploadResult.errors.map((err, i) => (
                      <div key={i} style={{ marginBottom: '0.15rem' }}>• {err}</div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
                  <button
                    onClick={() => {
                      setShowMasterUploadModal(false);
                      setMasterUploadFile(null);
                      setMasterUploadResult(null);
                    }}
                    className="btn-primary"
                    style={{ background: 'var(--gold-deep)', color: '#fff' }}
                  >
                    Close Summary
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* IMPORT FROM MASTER DATA MODAL */}
      {showImportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '16px', background: 'var(--paper)', border: '1px solid var(--line)', padding: '1.5rem', display: 'flex', flexDirection: 'column', borderTop: '4px solid var(--gold-deep)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={20} style={{ color: 'var(--gold-deep)' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Add Contacts from Master Data Center</h3>
              </div>
              <button onClick={() => { setShowImportModal(false); setSelectedMasterIds(new Set()); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>

            {/* Search filter in modal */}
            <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                <input
                  type="text"
                  placeholder="General search by name, phone, email, address..."
                  value={importSearch}
                  onChange={(e) => setImportSearch(e.target.value)}
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

              {/* Advanced Filters Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', background: 'var(--paper-2)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)' }}>Phone Filter</label>
                  <input
                    type="text"
                    placeholder="e.g. 91987..."
                    value={filterPhone}
                    onChange={(e) => setFilterPhone(e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)' }}>Email/Domain</label>
                  <input
                    type="text"
                    placeholder="e.g. @gmail.com"
                    value={filterEmail}
                    onChange={(e) => setFilterEmail(e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)' }}>Address Keyword</label>
                  <input
                    type="text"
                    placeholder="e.g. Delhi"
                    value={filterAddress}
                    onChange={(e) => setFilterAddress(e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)' }}>Uploaded From</label>
                  <input
                    type="date"
                    value={filterFromDate}
                    onChange={(e) => setFilterFromDate(e.target.value)}
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)' }}>Uploaded To</label>
                  <input
                    type="date"
                    value={filterToDate}
                    onChange={(e) => setFilterToDate(e.target.value)}
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterPhone('');
                      setFilterEmail('');
                      setFilterAddress('');
                      setFilterFromDate('');
                      setFilterToDate('');
                      setImportSearch('');
                      setSelectedMasterIds(new Set());
                    }}
                    className="btn-secondary"
                    style={{ padding: '0.35rem', fontSize: '0.78rem', width: '100%', height: '28px', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </div>

            {/* List with Checkboxes */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', minHeight: '200px', marginBottom: '1rem' }}>
              {filteredImportContacts.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                  No contacts found matching search in Master Data Center.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', textAlign: 'left' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--paper-2)', zIndex: 10 }}>
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      <th style={{ padding: '0.65rem 0.85rem', width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={filteredImportContacts.length > 0 && filteredImportContacts.every(c => selectedMasterIds.has(c.id))}
                          onChange={(e) => {
                            const newSet = new Set(selectedMasterIds);
                            if (e.target.checked) {
                              filteredImportContacts.forEach(c => newSet.add(c.id));
                            } else {
                              filteredImportContacts.forEach(c => newSet.delete(c.id));
                            }
                            setSelectedMasterIds(newSet);
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                      </th>
                      <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--ink)' }}>Name</th>
                      <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--ink)' }}>Contact (WhatsApp)</th>
                      <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--ink)' }}>Email Address</th>
                      <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--ink)' }}>Address</th>
                      <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--ink)' }}>Uploaded At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredImportContacts.map(c => {
                      const isChecked = selectedMasterIds.has(c.id);
                      return (
                        <tr
                          key={c.id}
                          onClick={() => {
                            const newSet = new Set(selectedMasterIds);
                            if (isChecked) {
                              newSet.delete(c.id);
                            } else {
                              newSet.add(c.id);
                            }
                            setSelectedMasterIds(newSet);
                          }}
                          style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer', background: isChecked ? 'rgba(224, 168, 46, 0.05)' : 'transparent', transition: 'background 0.1s' }}
                          className="table-row-hover"
                        >
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const newSet = new Set(selectedMasterIds);
                                if (e.target.checked) {
                                  newSet.add(c.id);
                                } else {
                                  newSet.delete(c.id);
                                }
                                setSelectedMasterIds(newSet);
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>{c.name}</td>
                          <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'var(--font-mono)' }}>{c.contact}</td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>{c.mail}</td>
                          <td style={{ padding: '0.65rem 0.85rem', color: 'var(--muted)' }}>{c.address || '—'}</td>
                          <td style={{ padding: '0.65rem 0.85rem', color: 'var(--muted)', fontSize: '0.78rem' }}>{c.created_at ? new Date(c.created_at).toLocaleString() : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: '1rem', flexShrink: 0 }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 600 }}>
                {selectedMasterIds.size} contact(s) selected
              </span>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={() => { setShowImportModal(false); setSelectedMasterIds(new Set()); }} className="btn-secondary">Cancel</button>
                <button
                  type="button"
                  onClick={handleImportMasterLeads}
                  disabled={isImporting || selectedMasterIds.size === 0}
                  className="btn-primary"
                  style={{ background: 'var(--gold-deep)', color: '#fff', opacity: selectedMasterIds.size === 0 ? 0.65 : 1, cursor: selectedMasterIds.size === 0 ? 'not-allowed' : 'pointer' }}
                >
                  {isImporting ? 'Importing...' : `Import selected (${selectedMasterIds.size})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW BROADCAST MODAL */}
      {showNewBroadcastModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '16px', background: 'var(--paper)', border: '1px solid var(--line)', padding: '1.5rem', borderTop: '4px solid var(--gold-deep)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Set Outgoing Broadcast</h3>
              <button onClick={() => setShowNewBroadcastModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateBroadcast}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Broadcast Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Festival Credit Card Campaign"
                  value={newBroadcastForm.name}
                  onChange={(e) => setNewBroadcastForm({ ...newBroadcastForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Select Reusable Template (Optional)</label>
                <select
                  onChange={(e) => {
                    const tId = e.target.value;
                    if (!tId) return;
                    const selectedTpl = templates.find(t => t.id === tId);
                    if (selectedTpl) {
                      const updated = { ...newBroadcastForm };
                      if (selectedTpl.type === 'email') {
                        updated.channel = 'email';
                        updated.emailSubject = selectedTpl.subject || '';
                        updated.emailBody = selectedTpl.body || '';
                      } else if (selectedTpl.type === 'whatsapp') {
                        updated.channel = 'whatsapp';
                        updated.whatsappTemplate = selectedTpl.meta_template_name || selectedTpl.name || '';
                        updated.whatsappMessage = selectedTpl.body || '';
                        updated.mediaUrl = selectedTpl.media_url || '';
                      }
                      setNewBroadcastForm(updated);
                    }
                  }}
                  className="form-input"
                  style={{ background: 'var(--paper-2)', color: 'var(--ink)' }}
                >
                  <option value="">-- Choose a Saved Template --</option>
                  <optgroup label="WhatsApp Templates">
                    {templates.filter(t => t.type === 'whatsapp').map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.meta_template_name || 'Free text'})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Email Templates">
                    {templates.filter(t => t.type === 'email').map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Target Channel</label>
                <select
                  value={newBroadcastForm.channel}
                  onChange={(e) => setNewBroadcastForm({ ...newBroadcastForm, channel: e.target.value })}
                  className="form-input"
                  style={{ background: 'var(--paper-2)', color: 'var(--ink)' }}
                >
                  <option value="whatsapp">WhatsApp notifications only</option>
                  <option value="email">Email dispatch only</option>
                  <option value="both">Both (WhatsApp & Email)</option>
                </select>
              </div>

              {/* WHATSAPP OPTIONS */}
              {(newBroadcastForm.channel === 'whatsapp' || newBroadcastForm.channel === 'both') && (
                <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--gold-deep)', marginBottom: '0.75rem' }}>WhatsApp Payload Customization</div>
                  
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Meta Template Name (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. welcome_offer_v2 (Leave blank to send free-text via Baileys)"
                      value={newBroadcastForm.whatsappTemplate}
                      onChange={(e) => setNewBroadcastForm({ ...newBroadcastForm, whatsappTemplate: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Header Media URL (Optional Image/Video/PDF Link)</label>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="e.g. https://domain.com/banner.jpg (For Meta header components)"
                      value={newBroadcastForm.mediaUrl || ''}
                      onChange={(e) => setNewBroadcastForm({ ...newBroadcastForm, mediaUrl: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Message Content / Parameters</label>
                    <textarea
                      className="form-input"
                      placeholder="Write message content. Use {name} for dynamic recipient name substitution."
                      value={newBroadcastForm.whatsappMessage}
                      onChange={(e) => setNewBroadcastForm({ ...newBroadcastForm, whatsappMessage: e.target.value })}
                      rows={3}
                      required={!newBroadcastForm.whatsappTemplate}
                    />
                  </div>
                </div>
              )}

              {/* EMAIL OPTIONS */}
              {(newBroadcastForm.channel === 'email' || newBroadcastForm.channel === 'both') && (
                <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--gold-deep)', marginBottom: '0.75rem' }}>Email Payload Customization</div>
                  
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Email Subject Line</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Hello {name}, check your pre-approved offers!"
                      value={newBroadcastForm.emailSubject}
                      onChange={(e) => setNewBroadcastForm({ ...newBroadcastForm, emailSubject: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Email Body (HTML/Text)</label>
                    <textarea
                      className="form-input"
                      placeholder="Write body text. HTML tags are supported. Placeholders: {name}, {contact}, {mail}."
                      value={newBroadcastForm.emailBody}
                      onChange={(e) => setNewBroadcastForm({ ...newBroadcastForm, emailBody: e.target.value })}
                      rows={4}
                      required
                    />
                  </div>
                </div>
              )}

              {/* SCHEDULER TIME */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Release Schedule (DateTime)</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={newBroadcastForm.scheduledAt}
                  onChange={(e) => setNewBroadcastForm({ ...newBroadcastForm, scheduledAt: e.target.value })}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem', display: 'block' }}>
                  Leave empty to save as a manual trigger draft.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
                <button type="button" onClick={() => setShowNewBroadcastModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={isCreatingBroadcast} style={{ background: 'var(--gold-deep)', color: '#fff' }}>
                  {isCreatingBroadcast ? 'Scheduling...' : 'Set Up Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
