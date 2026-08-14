import React, { useState, useEffect } from 'react';
import { 
  Users, Mail, MessageSquare, Plus, Trash2, Search, Upload, RefreshCw, X, Check,
  AlertCircle, Download, FileSpreadsheet, Play, Settings as SettingsIcon, HelpCircle, Info, Zap, Database
} from 'lucide-react';

export default function CampaignsManager({ theme, API_URL, token, showToast }) {
  const [activeSubTab, setActiveSubTab] = useState('master_data'); // 'master_data' | 'data_storage' | 'broadcast' | 'automated' | 'settings' | 'guide'
  
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
    scheduledAt: ''
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
    const search = masterContactsSearch.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(search) ||
      (c.contact || '').toLowerCase().includes(search) ||
      (c.mail || '').toLowerCase().includes(search) ||
      (c.address || '').toLowerCase().includes(search)
    );
  });

  const filteredImportContacts = masterContacts.filter(c => {
    const search = importSearch.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(search) ||
      (c.contact || '').toLowerCase().includes(search) ||
      (c.mail || '').toLowerCase().includes(search) ||
      (c.address || '').toLowerCase().includes(search)
    );
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
          Contacts (Data Storage)
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
          onClick={() => setActiveSubTab('automated')}
          style={{
            padding: '0.55rem 1.1rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeSubTab === 'automated' ? 'var(--gold-deep)' : 'transparent',
            color: activeSubTab === 'automated' ? '#fff' : 'var(--muted)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <Zap size={16} style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
          Automated <span style={{ fontSize: '0.68rem', opacity: 0.85, background: 'rgba(255,255,255,0.2)', padding: '0.1rem 0.35rem', borderRadius: '4px', marginLeft: '0.25rem' }}>Beta</span>
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
      {activeSubTab !== 'settings' && activeSubTab !== 'guide' && activeSubTab !== 'master_data' && (
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

            <button
              onClick={() => setShowCreateCampaignModal(true)}
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', fontSize: '0.82rem', height: '34px', background: 'var(--gold-deep)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              <Plus size={14} /> New Campaign
            </button>
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
                  <button
                    onClick={handleDownloadTemplate}
                    className="btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.85rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    <Download size={14} /> Download Template
                  </button>
                  <button
                    onClick={() => setShowMasterUploadModal(true)}
                    className="btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.85rem', background: 'var(--gold-deep)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    <Upload size={14} /> Upload Master Data
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
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Name</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Contact (WhatsApp)</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Email Address</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Address</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--ink)', width: '60px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMasterContacts.map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--line)', transition: 'background 0.15s ease' }} className="table-row-hover">
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{c.name}</td>
                          <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)' }}>{c.contact}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>{c.mail}</td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)' }}>{c.address || '—'}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <button
                              onClick={() => handleDeleteMasterContact(c.id)}
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--muted)', background: 'var(--paper-2)', borderRadius: '12px', padding: '3rem', textAlign: 'center' }}>
                <Users size={48} style={{ strokeWidth: 1.25, color: 'var(--muted)', marginBottom: '1rem' }} />
                <h3 style={{ margin: '0 0 0.5rem 0' }}>No Campaign Selected</h3>
                <p style={{ fontSize: '0.85rem', maxWidth: '400px', margin: '0 0 1.25rem 0' }}>Select an operational campaign from the selector above, or create a new campaign to begin uploading contacts.</p>
                <button onClick={() => setShowCreateCampaignModal(true)} className="btn-primary" style={{ background: 'var(--gold-deep)', color: '#fff' }}>Create a New Campaign</button>
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

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => {
                        setSelectedMasterIds(new Set());
                        setImportSearch('');
                        setShowImportModal(true);
                      }}
                      className="btn-secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.85rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                    >
                      <Plus size={14} /> Add from Master Data
                    </button>
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="btn-primary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.85rem', background: 'var(--gold-deep)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                    >
                      <Upload size={14} /> Upload Data Sheet
                    </button>
                  </div>
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
                                  {(b.status === 'draft' || b.status === 'failed') && (
                                    <button
                                      onClick={() => handleTriggerBroadcast(b.id)}
                                      className="btn-primary"
                                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '28px', width: '28px', padding: 0, borderRadius: '4px', background: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer' }}
                                      title="Trigger Broadcast Now"
                                    >
                                      <Play size={12} />
                                    </button>
                                  )}
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

        {/* TAB 3: AUTOMATED (RULE-BASED TRIGGERS - BETA) */}
        {activeSubTab === 'automated' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div className="glass-panel" style={{ borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--paper)', padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
                <Zap size={24} style={{ color: 'var(--gold-deep)' }} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Automated Campaigns (Beta)</h3>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
                Design rule-based event triggers that fire notification sequences to contacts automatically without manual administration. Tweak the scenarios below to set auto-responders.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                {/* Rule 1 */}
                <div style={{ border: '1px solid var(--line)', padding: '1.25rem', borderRadius: '8px', background: 'var(--paper-2)', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontWeight: 700 }}>New Lead Welcome Auto-Responder</h4>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>ACTIVE</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '0 0 1rem 0' }}>Trigger a personalized WhatsApp greeting immediately after a contact is successfully imported or mapped.</p>
                  <div style={{ fontSize: '0.75rem', background: 'var(--paper)', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--line)' }}>
                    <code>Trigger: On Import</code><br/>
                    <code>Channel: WhatsApp</code><br/>
                    <code>Template: <code>finmantra_welcome</code></code>
                  </div>
                </div>

                {/* Rule 2 */}
                <div style={{ border: '1px solid var(--line)', padding: '1.25rem', borderRadius: '8px', background: 'var(--paper-2)', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontWeight: 700 }}>24-Hour Follow-Up Reminder</h4>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'var(--line)', color: 'var(--muted)' }}>DISABLED</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '0 0 1rem 0' }}>Send an automated follow-up email 24 hours after registration to prompt users who have not completed verification.</p>
                  <div style={{ fontSize: '0.75rem', background: 'var(--paper)', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--line)' }}>
                    <code>Trigger: 24h After Lead Creation</code><br/>
                    <code>Channel: Email</code><br/>
                    <code>Subject: Finish your application!</code>
                  </div>
                </div>

                {/* Rule 3 */}
                <div style={{ border: '1px solid var(--line)', padding: '1.25rem', borderRadius: '8px', background: 'var(--paper-2)', position: 'relative', opacity: 0.7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontWeight: 700 }}>Periodic Offer Digests</h4>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'var(--line)', color: 'var(--muted)' }}>COMING SOON</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '0 0 1rem 0' }}>Trigger weekly SMS & WhatsApp credit card recommendations matching user state and salary ranges.</p>
                  <div style={{ fontSize: '0.75rem', background: 'var(--paper)', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--line)' }}>
                    <code>Interval: Weekly</code><br/>
                    <code>Channel: Multi-channel</code><br/>
                    <code>Trigger: Smart Segment Match</code>
                  </div>
                </div>
              </div>
            </div>
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
            <div style={{ marginBottom: '1rem', position: 'relative', flexShrink: 0 }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                type="text"
                placeholder="Search master list by name, phone, email, address..."
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
