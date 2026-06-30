import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, CreditCard, MapPin, Settings as SettingsIcon, ShieldAlert, BarChart3, 
  Trash2, Download, Search, Plus, Edit, Check, X, RefreshCw, AlertCircle,
  QrCode, Smartphone, CheckCircle, Wifi, WifiOff, Eye, MessageSquare, Layers,
  ArrowUp, ArrowDown, MoreVertical, LogOut, Activity
} from 'lucide-react';


export default function AdminDashboard() {
  const [token, setToken] = useState(localStorage.getItem('finmantra_admin_token') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  
  // Navigation Tabs: 'leads' | 'cards' | 'agents' | 'locations' | 'settings'
  const [activeTab, setActiveTab] = useState('leads');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [activeSettingsSubTab, setActiveSettingsSubTab] = useState('general');

  // Master Data States
  const [leads, setLeads] = useState([]);
  const [cards, setCards] = useState([]);
  const [agents, setAgents] = useState([]);
  const [locations, setLocations] = useState([]);
  const [settings, setSettings] = useState({});
  const [csvColumns, setCsvColumns] = useState([]);
  const [baileysStatus, setBaileysStatus] = useState({ status: 'DISCONNECTED', qrCodeDataUrl: '', phone: '' });
  const [loadingBaileys, setLoadingBaileys] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCard, setFilterCard] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [selectedLeads, setSelectedLeads] = useState([]);

  // CRUD Editing Modals/States
  const [editingCard, setEditingCard] = useState(null);
  const [editingAgent, setEditingAgent] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);
  const [selectedLeadDetails, setSelectedLeadDetails] = useState(null);
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [editLeadForm, setEditLeadForm] = useState(null);
  const [customParams, setCustomParams] = useState([]);
  
  const [newCardForm, setNewCardForm] = useState({ name: '', bank: '', category: 'Offline', ad_id: '', description: '', redirect_url_template: '', display_order: 1, active: true, card_locations: [] });
  const [newAgentForm, setNewAgentForm] = useState({ id: '', name: '', phone: '', email: '', username: '', password: '', status: 'active', locations: [] });
  const [newLocName, setNewLocName] = useState('');

  const [message, setMessage] = useState({ text: '', type: 'success' });
  const idleTimerRef = useRef(null);

  const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';

  const apiFetch = async (url, options = {}) => {
    const res = await fetch(url, options);
    let data;
    try {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      }
    } catch (e) {}

    if (!res.ok) {
      const errorMsg = (data && data.error) || `Request failed with status ${res.status}`;
      throw new Error(errorMsg);
    }
    return data;
  };

  // --- Auto Logout Monitor (5 Minutes Idle) ---
  useEffect(() => {
    if (!token) return;

    const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        handleLogout();
        alert('You have been logged out due to 5 minutes of inactivity.');
      }, 5 * 60 * 1000); // 5 mins
    };

    // User activity events
    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetIdleTimer));

    // Initialize timer
    resetIdleTimer();

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      events.forEach(event => window.removeEventListener(event, resetIdleTimer));
    };
  }, [token]);

  // Load Admin Data
  useEffect(() => {
    if (token) {
      loadAllAdminData();
    }
  }, [token]);

  // Real-time synchronization via WebSocket (only after verified auth)
  useEffect(() => {
    if (!isAuthenticated) return;

    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = window.location.hostname === 'localhost' 
      ? `ws://${window.location.hostname}:5000` 
      : `${wsProto}//${window.location.host}/api/ws`;
    let socket;
    let reconnectDelay = 5000;

    const connectWebSocket = () => {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        reconnectDelay = 5000;
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'LEAD_ADDED') {
            showToast(`🎉 New Lead Registered: ${message.data.full_name} (${message.data.urn})`, 'success');
            loadAllAdminData();
          } else if (message.type === 'WA_STATUS_UPDATE') {
            setBaileysStatus(message.data);
          } else if (
            message.type === 'LEADS_UPDATED' || 
            message.type === 'CARDS_UPDATED' || 
            message.type === 'LOCATIONS_UPDATED' || 
            message.type === 'SETTINGS_UPDATED' ||
            message.type === 'AGENTS_UPDATED'
          ) {
            loadAllAdminData();
          }
        } catch (err) {
          // silent
        }
      };

      socket.onclose = () => {
        reconnectDelay = Math.min(reconnectDelay * 2, 300000); // Max 5 minutes backoff
        setTimeout(connectWebSocket, reconnectDelay);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connectWebSocket();

    return () => {
      if (socket) socket.close();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (settings.csv_export_template) {
      try {
        const parsed = typeof settings.csv_export_template === 'string'
          ? JSON.parse(settings.csv_export_template)
          : settings.csv_export_template;
        if (Array.isArray(parsed)) {
          setCsvColumns(parsed);
        }
      } catch (err) {
        console.error('Failed to parse csv_export_template:', err);
      }
    }
  }, [settings.csv_export_template]);

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [leadsRes, cardsRes, agentsRes, locsRes, settingsRes, baileysRes] = await Promise.all([
        fetch(`${API_URL}/leads`, { headers }),
        fetch(`${API_URL}/admin/cards`, { headers }),
        fetch(`${API_URL}/agents`, { headers }),
        fetch(`${API_URL}/locations`),
        fetch(`${API_URL}/settings`),
        fetch(`${API_URL}/whatsapp/status`, { headers })
      ]);

      if (leadsRes.status === 401 || leadsRes.status === 403) {
        handleLogout();
        return;
      }

      // Token is verified - enable WebSocket sync
      setIsAuthenticated(true);

      const leadsData = await leadsRes.json();
      const cardsData = await cardsRes.json();
      const agentsData = await agentsRes.json();
      const locsData = await locsRes.json();
      const settingsData = await settingsRes.json();
      const baileysData = baileysRes.ok ? await baileysRes.json() : { status: 'DISCONNECTED', qrCodeDataUrl: '', phone: '' };

      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setCards(Array.isArray(cardsData) ? cardsData : []);
      setAgents(Array.isArray(agentsData) ? agentsData : []);
      setLocations(Array.isArray(locsData) ? locsData : []);
      setSettings(settingsData);
      setBaileysStatus(baileysData);
    } catch (err) {
      console.error('Error fetching admin dashboard details:', err);
      showToast('Error syncing with database.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: 'success' }), 4000);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPasswordInput })
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('finmantra_admin_token', data.token);
        setToken(data.token);
      } else {
        setAuthError(data.error || 'Access denied');
      }
    } catch (err) {
      setAuthError('Database connection error.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('finmantra_admin_token');
    setToken('');
    setIsAuthenticated(false);
    setAdminPasswordInput('');
  };

  // --- LEADS MANAGEMENT ---
  const handleSingleDeleteLead = async (id) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    try {
      await apiFetch(`${API_URL}/leads/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      showToast('Lead deleted successfully.');
      loadAllAdminData();
    } catch (err) {
      showToast(err.message || 'Deletion failed.', 'error');
    }
  };

  const handleBulkDeleteLeads = async () => {
    if (selectedLeads.length === 0) return;
    if (!window.confirm(`Are you sure you want to bulk-delete ${selectedLeads.length} selected leads?`)) return;

    try {
      await apiFetch(`${API_URL}/leads/delete-bulk`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ ids: selectedLeads })
      });
      showToast('Selected leads deleted.');
      setSelectedLeads([]);
      loadAllAdminData();
    } catch (err) {
      showToast(err.message || 'Bulk deletion failed.', 'error');
    }
  };

  const handleSelectLead = (id) => {
    if (selectedLeads.includes(id)) {
      setSelectedLeads(selectedLeads.filter(x => x !== id));
    } else {
      setSelectedLeads([...selectedLeads, id]);
    }
  };

  const handleSelectAllLeads = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map(l => l.id));
    }
  };

  const handleCsvExport = () => {
    let queryParams = [];
    if (filterStartDate) queryParams.push(`startDate=${filterStartDate}`);
    if (filterEndDate) queryParams.push(`endDate=${filterEndDate}`);
    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

    // Since direct window.open can't pass auth header, we fetch it, create a Blob, and download:
    fetch(`${API_URL}/leads/export${queryString}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finmantra_leads${filterStartDate || filterEndDate ? '_filtered' : ''}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch(err => showToast('Export failed.', 'error'));
  };

  const handleViewLead = (lead) => {
    setSelectedLeadDetails(lead);
    setIsEditingLead(false);
    
    // Initialize edit form
    setEditLeadForm({
      id: lead.id,
      urn: lead.urn,
      full_name: lead.full_name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      city: lead.city || '',
      employment: lead.employment || '',
      income_range: lead.income_range || '',
      card_name: lead.card_name || '',
      card_bank: lead.card_bank || '',
      source: lead.source || '',
      agent_id: lead.agent_id || '',
      agent_name: lead.agent_name || '',
      agent_location: lead.agent_location || '',
      consent: lead.consent ?? true,
      utm_channel: lead.utm_channel || '',
      utm_medium: lead.utm_medium || '',
      utm_source: lead.utm_source || '',
      utm_category: lead.utm_category || '',
      utm_campaign: lead.utm_campaign || '',
      utm_term: lead.utm_term || '',
      utm_content: lead.utm_content || '',
      utm_creative_format: lead.utm_creative_format || '',
      utm_info: lead.utm_info || '',
      utm_id: lead.utm_id || '',
      utm_creative: lead.utm_creative || '',
      utm_keyword: lead.utm_keyword || '',
      utm_matchtype: lead.utm_matchtype || '',
      utm_network: lead.utm_network || '',
      utm_placement: lead.utm_placement || '',
      utm_device: lead.utm_device || '',
      utm_location: lead.utm_location || '',
      gbraid: lead.gbraid || '',
      wbraid: lead.wbraid || '',
      landing_page: lead.landing_page || '',
      first_landing_page: lead.first_landing_page || '',
      referrer: lead.referrer || '',
      fbclid: lead.fbclid || '',
      gclid: lead.gclid || '',
      gclsrc: lead.gclsrc || '',
      dclid: lead.dclid || '',
      msclkid: lead.msclkid || '',
      ttclid: lead.ttclid || '',
      twclid: lead.twclid || '',
      li_fat_id: lead.li_fat_id || '',
      ad_id: lead.ad_id || '',
      redirect_url: lead.redirect_url || ''
    });

    const standardKeys = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 
      'utm_channel', 'utm_category', 'utm_info', 'utm_creative_format', 
      'utm_id', 'utm_creative', 'ad_id', 'utm_keyword', 'utm_matchtype', 'utm_network', 'utm_placement',
      'utm_device', 'utm_location', 'gbraid', 'wbraid', 'landing_page', 'first_landing_page', 'referrer',
      'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id'
    ];
    
    const customList = [];
    if (lead.utm_params && typeof lead.utm_params === 'object') {
      Object.entries(lead.utm_params).forEach(([key, val]) => {
        if (!standardKeys.includes(key)) {
          customList.push({ key, value: String(val) });
        }
      });
    }
    setCustomParams(customList);
  };

  const handleEditLeadFormChange = (field, val) => {
    setEditLeadForm(prev => ({
      ...prev,
      [field]: val
    }));
  };

  const handleCustomParamChange = (index, keyOrValue, value) => {
    const updated = [...customParams];
    updated[index][keyOrValue] = value;
    setCustomParams(updated);
  };

  const handleAddCustomParam = () => {
    setCustomParams([...customParams, { key: '', value: '' }]);
  };

  const handleRemoveCustomParam = (index) => {
    const updated = [...customParams];
    updated.splice(index, 1);
    setCustomParams(updated);
  };

  const handleSaveLeadChanges = async () => {
    if (!editLeadForm.full_name.trim()) {
      showToast('Name is required.', 'error');
      return;
    }
    if (!/^\d{10}$/.test(editLeadForm.phone)) {
      showToast('Mobile number must be exactly 10 digits.', 'error');
      return;
    }

    try {
      const reconstructedUtmParams = {};
      const standardKeys = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 
        'utm_channel', 'utm_category', 'utm_info', 'utm_creative_format', 
        'utm_id', 'utm_creative', 'ad_id', 'utm_keyword', 'utm_matchtype', 'utm_network', 'utm_placement',
        'utm_device', 'utm_location', 'gbraid', 'wbraid', 'landing_page', 'first_landing_page', 'referrer',
        'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id'
      ];
      
      standardKeys.forEach(k => {
        if (editLeadForm[k]) {
          reconstructedUtmParams[k] = editLeadForm[k];
        }
      });

      customParams.forEach(p => {
        const trimmedKey = p.key.trim();
        if (trimmedKey) {
          reconstructedUtmParams[trimmedKey] = p.value.trim();
        }
      });

      const payload = {
        ...editLeadForm,
        utm_params: reconstructedUtmParams
      };

      const updated = await apiFetch(`${API_URL}/leads/${editLeadForm.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      setLeads(prevLeads => prevLeads.map(l => l.id === editLeadForm.id ? { ...l, ...updated } : l));
      setSelectedLeadDetails(updated);
      setIsEditingLead(false);
      showToast('Lead details updated successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update lead.', 'error');
    }
  };

  // --- CARDS MANAGEMENT ---

  const handleCreateCard = async (e) => {
    e.preventDefault();
    
    // Client-side validations
    const cardName = newCardForm.name.trim();
    const bankName = newCardForm.bank.trim();
    const redirectUrl = newCardForm.redirect_url_template.trim();

    if (!cardName || !bankName || !redirectUrl) {
      showToast('Please fill in all required card details.', 'error');
      return;
    }

    if (!/^https?:\/\//i.test(redirectUrl)) {
      showToast('Redirect URL Template must start with http:// or https://', 'error');
      return;
    }

    if (cards.some(c => c.name.toLowerCase() === cardName.toLowerCase() && c.bank.toLowerCase() === bankName.toLowerCase())) {
      showToast('A card with this name already exists for this bank.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch(`${API_URL}/cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newCardForm,
          name: cardName,
          bank: bankName,
          redirect_url_template: redirectUrl,
          description: newCardForm.description.trim()
        })
      });
      showToast('Credit card added successfully.');
      setNewCardForm({ name: '', bank: '', category: 'Offline', description: '', redirect_url_template: '', display_order: 1, active: true, card_locations: [] });
      loadAllAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to add card.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCard = async (e) => {
    e.preventDefault();
    
    const cardName = editingCard.name.trim();
    const bankName = editingCard.bank.trim();
    const redirectUrl = editingCard.redirect_url_template.trim();

    if (!cardName || !bankName || !redirectUrl) {
      showToast('Please fill in all required card details.', 'error');
      return;
    }

    if (!/^https?:\/\//i.test(redirectUrl)) {
      showToast('Redirect URL Template must start with http:// or https://', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch(`${API_URL}/cards/${editingCard.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...editingCard,
          name: cardName,
          bank: bankName,
          redirect_url_template: redirectUrl,
          description: editingCard.description.trim()
        })
      });
      showToast('Card updated.');
      setEditingCard(null);
      loadAllAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to update.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCard = async (id) => {
    if (!window.confirm('Delete this card permanently?')) return;
    setIsSubmitting(true);
    try {
      await apiFetch(`${API_URL}/cards/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      showToast('Card deleted.');
      loadAllAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to delete.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- AGENTS MANAGEMENT ---
  const handleCreateAgent = async (e) => {
    e.preventDefault();

    const agId = newAgentForm.id.trim();
    const agName = newAgentForm.name.trim();
    const agUsername = newAgentForm.username.trim();
    const agPhone = newAgentForm.phone ? newAgentForm.phone.trim() : '';
    const agEmail = newAgentForm.email ? newAgentForm.email.trim() : '';

    if (!agId || !agName || !agUsername || !newAgentForm.password) {
      showToast('Please fill in all required agent details.', 'error');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(agId)) {
      showToast('Agent Code/ID must contain only letters, numbers, hyphens or underscores (no spaces).', 'error');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(agUsername)) {
      showToast('Username must contain only letters, numbers, hyphens or underscores (no spaces).', 'error');
      return;
    }

    if (agPhone && (agPhone.length !== 10 || !/^\d+$/.test(agPhone))) {
      showToast('Agent phone number must be exactly 10 digits.', 'error');
      return;
    }

    if (agEmail && !/\S+@\S+\.\S+/.test(agEmail)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    if (agents.some(a => a.id.toLowerCase() === agId.toLowerCase())) {
      showToast('Agent Code/ID already exists.', 'error');
      return;
    }

    if (agents.some(a => a.username.toLowerCase() === agUsername.toLowerCase())) {
      showToast('Agent Username already exists.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch(`${API_URL}/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newAgentForm,
          id: agId,
          name: agName,
          username: agUsername,
          phone: agPhone,
          email: agEmail
        })
      });
      showToast('Agent created successfully.');
      setNewAgentForm({ id: '', name: '', phone: '', email: '', username: '', password: '', status: 'active', locations: [] });
      loadAllAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to create agent.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAgent = async (e) => {
    e.preventDefault();

    const agName = editingAgent.name.trim();
    const agUsername = editingAgent.username.trim();
    const agPhone = editingAgent.phone ? editingAgent.phone.trim() : '';
    const agEmail = editingAgent.email ? editingAgent.email.trim() : '';

    if (!agName || !agUsername) {
      showToast('Name and Username are required.', 'error');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(agUsername)) {
      showToast('Username must contain only letters, numbers, hyphens or underscores (no spaces).', 'error');
      return;
    }

    if (agPhone && (agPhone.length !== 10 || !/^\d+$/.test(agPhone))) {
      showToast('Agent phone number must be exactly 10 digits.', 'error');
      return;
    }

    if (agEmail && !/\S+@\S+\.\S+/.test(agEmail)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    // Check unique username among other agents
    if (agents.some(a => a.id !== editingAgent.id && a.username.toLowerCase() === agUsername.toLowerCase())) {
      showToast('Agent Username is already taken by another agent.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch(`${API_URL}/agents/${editingAgent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...editingAgent,
          name: agName,
          username: agUsername,
          phone: agPhone,
          email: agEmail
        })
      });
      showToast('Agent details updated.');
      setEditingAgent(null);
      loadAllAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to update.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAgent = async (id) => {
    if (!window.confirm('Delete agent permanently?')) return;
    setIsSubmitting(true);
    try {
      await apiFetch(`${API_URL}/agents/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      showToast('Agent removed.');
      loadAllAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to delete.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAgentFormLocToggle = (locName, formType = 'new') => {
    if (formType === 'new') {
      const current = newAgentForm.locations;
      const updated = current.includes(locName) 
        ? current.filter(l => l !== locName)
        : [...current, locName];
      setNewAgentForm({ ...newAgentForm, locations: updated });
    } else {
      const current = editingAgent.locations;
      const updated = current.includes(locName)
        ? current.filter(l => l !== locName)
        : [...current, locName];
      setEditingAgent({ ...editingAgent, locations: updated });
    }
  };



  // --- LOCATIONS MANAGEMENT ---
  const handleCreateLocation = async (e) => {
    e.preventDefault();
    const trimmedLoc = newLocName.trim();
    if (!trimmedLoc) return;

    if (locations.some(loc => loc.name.toLowerCase() === trimmedLoc.toLowerCase())) {
      showToast('Location name already exists.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch(`${API_URL}/locations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: trimmedLoc, active: true })
      });
      showToast('Location created.');
      setNewLocName('');
      loadAllAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to add location.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLocActive = async (loc) => {
    setIsSubmitting(true);
    try {
      await apiFetch(`${API_URL}/locations/${loc.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ active: !loc.active })
      });
      showToast('Location status updated.');
      loadAllAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to update status.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLoc = async (id) => {
    if (!window.confirm('Delete location from records?')) return;
    setIsSubmitting(true);
    try {
      await apiFetch(`${API_URL}/locations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      showToast('Location deleted.');
      loadAllAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to delete.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const STANDARD_FIELD_OPTIONS = [
    { value: 'urn', label: 'URN' },
    { value: 'created_at', label: 'Creation Date/Time' },
    { value: 'full_name', label: 'Full Name' },
    { value: 'phone', label: 'Phone Number' },
    { value: 'email', label: 'Email' },
    { value: 'city', label: 'City' },
    { value: 'employment', label: 'Employment Status' },
    { value: 'income_range', label: 'Monthly Income' },
    { value: 'card_name', label: 'Selected Card Name' },
    { value: 'card_bank', label: 'Card Bank' },
    { value: 'source', label: 'Lead Source (e.g. public/agent)' },
    { value: 'agent_name', label: 'Agent Name' },
    { value: 'agent_location', label: 'Agent Location/Kiosk' },
    { value: 'redirect_url', label: 'Redirect URL' },
    { value: 'utm_source', label: 'UTM Source' },
    { value: 'utm_medium', label: 'UTM Medium' },
    { value: 'utm_campaign', label: 'UTM Campaign' },
    { value: 'utm_term', label: 'UTM Term' },
    { value: 'utm_content', label: 'UTM Content' },
    { value: 'utm_channel', label: 'UTM Channel' },
    { value: 'utm_category', label: 'UTM Category' },
    { value: 'utm_id', label: 'UTM Campaign ID (utm_id)' },
    { value: 'utm_creative', label: 'UTM Ad ID (utm_creative)' },
    { value: 'ad_id', label: 'Ad ID (ad_id)' },
    { value: 'utm_keyword', label: 'UTM Keyword (utm_keyword)' },
    { value: 'utm_matchtype', label: 'UTM Matchtype' },
    { value: 'utm_network', label: 'UTM Network' },
    { value: 'utm_placement', label: 'UTM Placement' },
    { value: 'utm_device', label: 'UTM Device' },
    { value: 'utm_location', label: 'UTM Location' },
    { value: 'gbraid', label: 'GBRAID' },
    { value: 'wbraid', label: 'WBRAID' },
    { value: 'landing_page', label: 'Landing Page URL' },
    { value: 'first_landing_page', label: 'First Landing Page URL' },
    { value: 'referrer', label: 'Referrer' },
    { value: 'fbclid', label: 'FBCLID (Facebook)' },
    { value: 'gclid', label: 'GCLID (Google)' },
    { value: 'gclsrc', label: 'GCLSRC (Google Click Source)' },
    { value: 'dclid', label: 'DCLID' },
    { value: 'msclkid', label: 'MSCLKID' },
    { value: 'ttclid', label: 'TTCLID' },
    { value: 'twclid', label: 'TWCLID' },
    { value: 'li_fat_id', label: 'LI_FAT_ID' },
    { value: 'utm_params', label: 'All Tracking Parameters (JSON)' }
  ];

  const handleMoveColumnUp = (index) => {
    if (index === 0) return;
    const updated = [...csvColumns];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setCsvColumns(updated);
  };

  const handleMoveColumnDown = (index) => {
    if (index === csvColumns.length - 1) return;
    const updated = [...csvColumns];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setCsvColumns(updated);
  };

  const handleAddColumn = () => {
    const newCol = {
      id: 'col_' + Math.random().toString(36).substr(2, 9),
      header: 'New Column',
      source: 'urn'
    };
    setCsvColumns([...csvColumns, newCol]);
  };

  const handleDeleteColumn = (index) => {
    const updated = csvColumns.filter((_, idx) => idx !== index);
    setCsvColumns(updated);
  };

  const handleResetCsvTemplate = () => {
    if (!window.confirm('Are you sure you want to reset the CSV template to the default layout with all 46 tracking parameters?')) return;
    const defaultCols = [
      { id: "urn", header: "URN", source: "urn" },
      { id: "created_at", header: "Creation Date/Time", source: "created_at" },
      { id: "full_name", header: "Full Name", source: "full_name" },
      { id: "phone", header: "Phone", source: "phone" },
      { id: "email", header: "Email", source: "email" },
      { id: "city", header: "City", source: "city" },
      { id: "employment", header: "Employment", source: "employment" },
      { id: "income_range", header: "Monthly Income", source: "income_range" },
      { id: "card_name", header: "Selected Card", source: "card_name" },
      { id: "card_bank", header: "Card Bank", source: "card_bank" },
      { id: "source", header: "Source", source: "source" },
      { id: "utm_source", header: "UTM Source", source: "utm_source" },
      { id: "utm_info", header: "UTM Info", source: "utm_info" },
      { id: "utm_creative_format", header: "UTM Creative Format", source: "utm_creative_format" },
      { id: "utm_medium", header: "UTM Medium", source: "utm_medium" },
      { id: "utm_campaign", header: "UTM Campaign", source: "utm_campaign" },
      { id: "utm_term", header: "UTM Term", source: "utm_term" },
      { id: "utm_content", header: "UTM Content", source: "utm_content" },
      { id: "utm_channel", header: "UTM Channel", source: "utm_channel" },
      { id: "utm_category", header: "UTM Category", source: "utm_category" },
      { id: "utm_id", header: "UTM Campaign ID (utm_id)", source: "utm_id" },
      { id: "utm_creative", header: "UTM Ad ID (utm_creative)", source: "utm_creative" },
      { id: "ad_id", header: "Ad ID (ad_id)", source: "ad_id" },
      { id: "utm_keyword", header: "UTM Keyword (utm_keyword)", source: "utm_keyword" },
      { id: "utm_matchtype", header: "UTM Matchtype (utm_matchtype)", source: "utm_matchtype" },
      { id: "utm_network", header: "UTM Network (utm_network)", source: "utm_network" },
      { id: "utm_placement", header: "UTM Placement (utm_placement)", source: "utm_placement" },
      { id: "utm_device", header: "UTM Device (utm_device)", source: "utm_device" },
      { id: "utm_location", header: "UTM Location (utm_location)", source: "utm_location" },
      { id: "gbraid", header: "GBRAID (gbraid)", source: "gbraid" },
      { id: "wbraid", header: "WBRAID (wbraid)", source: "wbraid" },
      { id: "landing_page", header: "Landing Page (landing_page)", source: "landing_page" },
      { id: "first_landing_page", header: "First Landing Page (first_landing_page)", source: "first_landing_page" },
      { id: "referrer", header: "Referrer (referrer)", source: "referrer" },
      { id: "fbclid", header: "FBCLID", source: "fbclid" },
      { id: "gclid", header: "GCLID", source: "gclid" },
      { id: "gclsrc", header: "GCLSRC", source: "gclsrc" },
      { id: "dclid", header: "DCLID", source: "dclid" },
      { id: "msclkid", header: "MSCLKID", source: "msclkid" },
      { id: "ttclid", header: "TTCLID", source: "ttclid" },
      { id: "twclid", header: "TWCLID", source: "twclid" },
      { id: "li_fat_id", header: "LI_FAT_ID", source: "li_fat_id" },
      { id: "utm_params", header: "All Tracking Parameters (JSON)", source: "utm_params" },
      { id: "agent_name", header: "Agent Name", source: "agent_name" },
      { id: "agent_location", header: "Agent Location", source: "agent_location" },
      { id: "redirect_url", header: "Redirect URL", source: "redirect_url" }
    ];
    setCsvColumns(defaultCols);
  };

  const handleSaveCsvTemplate = async () => {
    for (const col of csvColumns) {
      if (!col.header.trim()) {
        showToast('All columns must have a Header Label.', 'error');
        return;
      }
      if (!col.source.trim()) {
        showToast('All columns must have a Mapped Source Field.', 'error');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await apiFetch(`${API_URL}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...settings,
          csv_export_template: JSON.stringify(csvColumns)
        })
      });
      showToast('CSV export template saved successfully!', 'success');
      loadAllAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to save CSV template.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();

    const publicUrl = settings.public_redirect_url ? settings.public_redirect_url.trim() : '';
    if (publicUrl && !/^https?:\/\//i.test(publicUrl)) {
      showToast('Global Public Redirect URL must start with http:// or https://', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch(`${API_URL}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(Object.fromEntries(
          Object.entries({
            ...settings,
            public_redirect_url: publicUrl,
            public_site_url: settings.public_site_url ? settings.public_site_url.trim() : undefined,
            wa_referral_link_type: settings.wa_referral_link_type || undefined,
            terms_link: settings.terms_link ? settings.terms_link.trim() : undefined,
            privacy_link: settings.privacy_link ? settings.privacy_link.trim() : undefined,
            wa_api_key: settings.wa_api_key ? settings.wa_api_key.trim() : undefined,
            wa_phone_number_id: settings.wa_phone_number_id ? settings.wa_phone_number_id.trim() : undefined,
            wa_business_account_id: settings.wa_business_account_id ? settings.wa_business_account_id.trim() : undefined,
            wa_otp_template_name: settings.wa_otp_template_name ? settings.wa_otp_template_name.trim() : undefined,
            wa_referral_template_name: settings.wa_referral_template_name ? settings.wa_referral_template_name.trim() : undefined,
            wa_template_language: settings.wa_template_language ? settings.wa_template_language.trim() : undefined,
            wa_api_version: settings.wa_api_version ? settings.wa_api_version.trim() : undefined,
            wa_otp_is_auth_template: settings.wa_otp_is_auth_template !== undefined ? settings.wa_otp_is_auth_template : undefined,
            whatsapp_gateway: settings.whatsapp_gateway || undefined
          }).filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '')
        ))
      });
      showToast('System settings updated successfully.');

      loadAllAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to save settings.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestWhatsAppMeta = async (testType, targetPhone) => {
    try {
      showToast(`Sending test ${testType.toUpperCase()} to ${targetPhone} via Meta API...`, 'info');
      const res = await fetch(`${API_URL}/whatsapp/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: targetPhone, type: testType })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message, 'success');
      } else {
        showToast(`Meta API Test Failed: ${data.error || data.details || 'Unknown Error'}`, 'error');
      }
    } catch (err) {
      showToast(`Network error testing Meta API: ${err.message}`, 'error');
    }
  };

  const handleDisconnectBaileys = async () => {
    if (!window.confirm('Are you sure you want to disconnect this WhatsApp linked device? You will need to scan the QR code again.')) return;
    setLoadingBaileys(true);
    try {
      await apiFetch(`${API_URL}/whatsapp/disconnect`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      showToast('WhatsApp session terminated successfully.');
    } catch (err) {
      showToast(err.message || 'Failed to disconnect WhatsApp.', 'error');
    } finally {
      setLoadingBaileys(false);
    }
  };

  // Filtering Logic
  const filteredLeads = leads.filter(l => {
    const matchesSearch = 
      (l.full_name && l.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.phone && l.phone.includes(searchTerm)) ||
      (l.urn && l.urn.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCard = filterCard ? l.card_id === filterCard : true;
    const matchesSource = filterSource ? l.source === filterSource : true;

    // Date range filter
    let matchesDate = true;
    if (l.created_at) {
      const leadDate = typeof l.created_at === 'string' 
        ? l.created_at.slice(0, 10) 
        : new Date(l.created_at).toISOString().slice(0, 10);
      if (filterStartDate && leadDate < filterStartDate) matchesDate = false;
      if (filterEndDate && leadDate > filterEndDate) matchesDate = false;
    } else if (filterStartDate || filterEndDate) {
      matchesDate = false;
    }

    return matchesSearch && matchesCard && matchesSource && matchesDate;
  });

  // Calculate Metrics
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysLeads = leads.filter(l => l.created_at && l.created_at.startsWith(todayStr));
  const activeCards = cards.filter(c => c.active);
  const activeAgents = agents.filter(a => a.status === 'active');

  if (!token) {
    return (
      <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '2rem' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', borderLeft: '3px solid var(--gold)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ width: '60px', height: '60px', background: 'rgba(224, 168, 46, 0.15)', color: 'var(--gold-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto', borderRadius: '50%' }}>
              <ShieldAlert size={30} />
            </div>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>Admin Dashboard</h2>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Secure administrative gatekeeper portal</p>
          </div>

          <form onSubmit={handleAdminLogin}>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Admin Security Password</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="Enter password" 
                value={adminPasswordInput} 
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                required 
              />
            </div>

            {authError && (
              <div style={{ background: 'rgba(209, 67, 67, 0.1)', border: '1px solid rgba(209, 67, 67, 0.2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', color: 'var(--err)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                {authError}
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Validating credentials...' : 'Enter Admin Room'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <a href="/" style={{ fontSize: '0.85rem', color: 'var(--gold-deep)', textDecoration: 'none', fontWeight: 600 }}>← Back to home</a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="admin-container">
      
      {/* Toast Notifications */}
      {message.text && (
        <div style={{ 
          position: 'fixed', 
          top: '80px', 
          right: '20px', 
          background: message.type === 'error' ? 'var(--err)' : 'var(--mint)',
          color: 'var(--white)',
          padding: '0.8rem 1.4rem',
          borderRadius: 'var(--radius-md)',
          zIndex: 2000,
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          border: '1px solid rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          backdropFilter: 'blur(8px)'
        }}>
          <AlertCircle size={18} style={{ color: 'var(--white)' }} />
          <span style={{ fontWeight: 600 }}>{message.text}</span>
        </div>
      )}

      {/* Sticky Premium Top Navigation Bar */}
      <div className="admin-navbar glass-panel" style={{ 
        position: 'sticky', 
        top: '0.75rem', 
        zIndex: 1000, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '0.9rem 1.75rem', 
        minHeight: '70px',
        marginBottom: '2rem',
        backdropFilter: 'blur(12px)',
        background: 'rgba(255, 255, 255, 0.88)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 32px 0 rgba(17, 19, 43, 0.08)'
      }}>
        {/* Brand/Title */}
        <div className="admin-nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src="/logo.jpg" alt="FinMantra Logo" style={{ height: '40px', width: '40px', borderRadius: '9px', objectFit: 'cover', boxShadow: '0 3px 10px rgba(224, 168, 46, 0.28)' }} />
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.35rem', letterSpacing: '-0.03em', color: 'var(--ink)' }}>
            FinMantra <span style={{ color: 'var(--gold-deep)', fontWeight: 500, fontSize: '0.9rem' }}>Admin</span>
          </span>
        </div>

        {/* Central Navigation Tabs (Desktop Only) */}
        <div className="admin-nav-tabs desktop-only" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            className={`nav-link ${activeTab === 'leads' ? 'active' : ''}`} 
            onClick={() => setActiveTab('leads')}
            style={{ 
              padding: '0.5rem 0.85rem', 
              fontSize: '0.85rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              border: activeTab === 'leads' ? '1px solid var(--line)' : '1px solid transparent', 
              background: activeTab === 'leads' ? 'var(--paper-2)' : 'transparent', 
              color: activeTab === 'leads' ? 'var(--ink)' : 'var(--muted)', 
              cursor: 'pointer', 
              transition: 'all 0.2s', 
              borderRadius: 'var(--radius-sm)' 
            }}
          >
            <BarChart3 size={14} /> Leads Repository
          </button>
          <button 
            className={`nav-link ${activeTab === 'cards' ? 'active' : ''}`} 
            onClick={() => setActiveTab('cards')}
            style={{ 
              padding: '0.5rem 0.85rem', 
              fontSize: '0.85rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              border: activeTab === 'cards' ? '1px solid var(--line)' : '1px solid transparent', 
              background: activeTab === 'cards' ? 'var(--paper-2)' : 'transparent', 
              color: activeTab === 'cards' ? 'var(--ink)' : 'var(--muted)', 
              cursor: 'pointer', 
              transition: 'all 0.2s', 
              borderRadius: 'var(--radius-sm)' 
            }}
          >
            <CreditCard size={14} /> Cards Manager
          </button>
          <button 
            className={`nav-link ${activeTab === 'agents' ? 'active' : ''}`} 
            onClick={() => setActiveTab('agents')}
            style={{ 
              padding: '0.5rem 0.85rem', 
              fontSize: '0.85rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              border: activeTab === 'agents' ? '1px solid var(--line)' : '1px solid transparent', 
              background: activeTab === 'agents' ? 'var(--paper-2)' : 'transparent', 
              color: activeTab === 'agents' ? 'var(--ink)' : 'var(--muted)', 
              cursor: 'pointer', 
              transition: 'all 0.2s', 
              borderRadius: 'var(--radius-sm)' 
            }}
          >
            <Users size={14} /> Agents Controller
          </button>
          <button 
            className={`nav-link ${activeTab === 'locations' ? 'active' : ''}`} 
            onClick={() => setActiveTab('locations')}
            style={{ 
              padding: '0.5rem 0.85rem', 
              fontSize: '0.85rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              border: activeTab === 'locations' ? '1px solid var(--line)' : '1px solid transparent', 
              background: activeTab === 'locations' ? 'var(--paper-2)' : 'transparent', 
              color: activeTab === 'locations' ? 'var(--ink)' : 'var(--muted)', 
              cursor: 'pointer', 
              transition: 'all 0.2s', 
              borderRadius: 'var(--radius-sm)' 
            }}
          >
            <MapPin size={14} /> Kiosks & Cities
          </button>
          <button 
            className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`} 
            onClick={() => setActiveTab('settings')}
            style={{ 
              padding: '0.5rem 0.85rem', 
              fontSize: '0.85rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              border: activeTab === 'settings' ? '1px solid var(--line)' : '1px solid transparent', 
              background: activeTab === 'settings' ? 'var(--paper-2)' : 'transparent', 
              color: activeTab === 'settings' ? 'var(--ink)' : 'var(--muted)', 
              cursor: 'pointer', 
              transition: 'all 0.2s', 
              borderRadius: 'var(--radius-sm)' 
            }}
          >
            <SettingsIcon size={14} /> Settings & API
          </button>
        </div>

        {/* Right side controls (Desktop Only) */}
        <div className="admin-nav-actions desktop-only" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            onClick={loadAllAdminData} 
            className="btn-secondary" 
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem', height: '34px', cursor: 'pointer' }}
            title="Refresh Data"
          >
            <RefreshCw size={14} /> Sync
          </button>
          <button 
            onClick={handleLogout} 
            className="btn-secondary" 
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem', height: '34px', background: 'rgba(209, 67, 67, 0.1)', color: 'var(--err)', borderColor: 'rgba(209, 67, 67, 0.2)', cursor: 'pointer' }}
          >
            Exit
          </button>
        </div>

        {/* Mobile Menu Toggle Button (3-Dot Icon) */}
        <button 
          className="mobile-only-btn" 
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          style={{
            background: 'none',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.45rem',
            cursor: 'pointer',
            color: 'var(--muted)',
            display: 'none' /* Toggle visiblity using media queries */
          }}
        >
          <MoreVertical size={20} />
        </button>

        {/* Mobile Dropdown Overlay Menu */}
        {showMobileMenu && (
          <div className="mobile-dropdown-menu">
            <button 
              className={`nav-link ${activeTab === 'leads' ? 'active' : ''}`} 
              onClick={() => { setActiveTab('leads'); setShowMobileMenu(false); }}
            >
              <BarChart3 size={14} /> Leads Repository
            </button>
            <button 
              className={`nav-link ${activeTab === 'cards' ? 'active' : ''}`} 
              onClick={() => { setActiveTab('cards'); setShowMobileMenu(false); }}
            >
              <CreditCard size={14} /> Cards Manager
            </button>
            <button 
              className={`nav-link ${activeTab === 'agents' ? 'active' : ''}`} 
              onClick={() => { setActiveTab('agents'); setShowMobileMenu(false); }}
            >
              <Users size={14} /> Agents Controller
            </button>
            <button 
              className={`nav-link ${activeTab === 'locations' ? 'active' : ''}`} 
              onClick={() => { setActiveTab('locations'); setShowMobileMenu(false); }}
            >
              <MapPin size={14} /> Kiosks & Cities
            </button>
            <button 
              className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`} 
              onClick={() => { setActiveTab('settings'); setShowMobileMenu(false); }}
            >
              <SettingsIcon size={14} /> Settings & API
            </button>
            <div style={{ height: '1px', background: 'var(--line)', margin: '0.4rem 0' }} />
            <button 
              onClick={() => { loadAllAdminData(); setShowMobileMenu(false); }} 
              className="btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', padding: '0.5rem 0.85rem' }}
            >
              <RefreshCw size={14} /> Sync Data
            </button>
            <button 
              onClick={() => { handleLogout(); setShowMobileMenu(false); }} 
              className="btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', padding: '0.5rem 0.85rem', background: 'rgba(209, 67, 67, 0.1)', color: 'var(--err)', borderColor: 'rgba(209, 67, 67, 0.2)' }}
            >
              <LogOut size={14} /> Exit
            </button>
          </div>
        )}
      </div>

      {/* Welcome Title Block */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem', color: 'var(--text-light)' }}>Admin Control Room</h2>
        <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Configure credit cards catalog, dynamic destination links, agents, kiosks and monitor client logs.</p>
      </div>

      {/* Metrics Strips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '3px solid hsl(var(--primary))' }}>
          <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Total Leads</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0.25rem 0' }}>{leads.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Registered in Database</div>
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '3px solid hsl(var(--secondary))' }}>
          <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Leads Today</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0.25rem 0', color: 'hsl(var(--secondary))' }}>{todaysLeads.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Captured since 12:00 AM</div>
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '3px solid var(--gold)' }}>
          <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Active Agents</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--gold-deep)' }}>{activeAgents.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Field officers active</div>
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '3px solid hsl(var(--accent-gold))' }}>
          <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Cards Catalog</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0.25rem 0', color: 'hsl(var(--accent-gold))' }}>{activeCards.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Active redirect options</div>
        </div>
      </div>

      {/* TAB CONTENT */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem', color: 'hsl(var(--text-muted))' }}>Syncing database logs...</div>
      ) : (
        <div>
          
          {/* LEADS TAB */}
          {activeTab === 'leads' && (
            <div className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.3rem' }}>Leads Log ({filteredLeads.length})</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {selectedLeads.length > 0 && (
                    <button onClick={handleBulkDeleteLeads} className="btn-secondary" style={{ background: 'rgba(209, 67, 67, 0.15)', color: 'var(--err)', border: '1px solid rgba(209, 67, 67, 0.2)' }}>
                      <Trash2 size={16} /> Delete Selected ({selectedLeads.length})
                    </button>
                  )}
                  <button onClick={handleCsvExport} className="btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}>
                    <Download size={16} /> Export to CSV
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1.2fr 1.2fr', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }} className="filters-strip">
                <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', top: '14px', left: '15px', color: 'hsl(var(--text-muted))' }} />
                  <input 
                    type="text" 
                    placeholder="Search by name, phone, URN..." 
                    className="form-input" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: '45px' }}
                  />
                </div>
                <select className="form-select" value={filterCard} onChange={(e) => setFilterCard(e.target.value)}>
                  <option value="">Filter by Card</option>
                  {cards.map(c => <option key={c.id} value={c.id}>{c.bank} {c.name}</option>)}
                </select>
                <select className="form-select" value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
                  <option value="">Filter by Source</option>
                  <option value="public">Public Website</option>
                  <option value="agent">Agent Walk-in</option>
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%' }}>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>From:</span>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%' }}>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>To:</span>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                  />
                </div>
              </div>

              {/* Data Table */}
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>
                        <input 
                          type="checkbox" 
                          checked={filteredLeads.length > 0 && selectedLeads.length === filteredLeads.length} 
                          onChange={handleSelectAllLeads}
                          style={{ accentColor: 'hsl(var(--primary))' }}
                        />
                      </th>
                      <th>URN No.</th>
                      <th>Date & Time</th>
                      <th>Name</th>
                      <th>WhatsApp No.</th>
                      <th>Card Selection</th>
                      <th>City</th>
                      <th>Agent Location</th>
                      <th>Source</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.length > 0 ? (
                      filteredLeads.map(l => (
                        <tr key={l.id}>
                          <td>
                            <input 
                              type="checkbox" 
                              checked={selectedLeads.includes(l.id)} 
                              onChange={() => handleSelectLead(l.id)}
                              style={{ accentColor: 'hsl(var(--primary))' }}
                            />
                          </td>
                          <td><span className="badge badge-info" style={{ cursor: 'pointer' }} onClick={() => handleViewLead(l)}>{l.urn}</span></td>
                          <td>{l.created_at ? l.created_at.replace('T', ' ').slice(0, 16) : ''}</td>
                          <td style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => handleViewLead(l)}>{l.full_name}</td>
                          <td>{l.phone}</td>
                          <td>{l.card_name} <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>({l.card_bank})</span></td>
                          <td>{l.city}</td>
                          <td>{l.agent_location || '-'}</td>
                          <td>
                            <span 
                              className={`badge ${l.source === 'agent' ? 'badge-warning' : 'badge-success'}`}
                              title={l.utm_params ? Object.entries(l.utm_params).map(([k, v]) => `${k}: ${v}`).join('\n') : ''}
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleViewLead(l)}
                            >
                               {l.source === 'agent' 
                                 ? (l.agent_name || 'Staff') 
                                 : (l.utm_source 
                                     ? `PUBLIC (${l.utm_source.toUpperCase()}${l.utm_info ? ' - ' + l.utm_info.toUpperCase() : ''})` 
                                     : 'PUBLIC')}
                            </span>
                          </td>
                          <td>
                            <button onClick={() => handleViewLead(l)} style={{ color: 'hsl(var(--primary))', background: 'none', border: 'none', cursor: 'pointer', marginRight: '12px' }} title="View details">
                              <Eye size={16} />
                            </button>
                            <button onClick={() => handleSingleDeleteLead(l.id)} style={{ color: 'var(--err)', background: 'none', border: 'none', cursor: 'pointer' }} title="Delete lead">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="10" style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--text-muted))' }}>
                          No leads captured matching current filter query parameters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CARDS TAB */}
          {activeTab === 'cards' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem', alignItems: 'start' }} className="admin-split-grid">
              
              {/* Card Editor / Creator */}
              <div className="glass-panel">
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>
                  {editingCard ? `Edit Card: ${editingCard.name}` : 'Add Credit Card'}
                </h3>
                
                <form onSubmit={editingCard ? handleUpdateCard : handleCreateCard}>
                  <div className="form-group">
                    <label className="form-label">Card Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={editingCard ? editingCard.name : newCardForm.name}
                      onChange={(e) => editingCard ? setEditingCard({ ...editingCard, name: e.target.value }) : setNewCardForm({ ...newCardForm, name: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Bank Name</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={editingCard ? editingCard.bank : newCardForm.bank}
                        onChange={(e) => editingCard ? setEditingCard({ ...editingCard, bank: e.target.value }) : setNewCardForm({ ...newCardForm, bank: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Category</label>
                      <select 
                        className="form-select" 
                        value={editingCard ? editingCard.category : newCardForm.category}
                        onChange={(e) => editingCard ? setEditingCard({ ...editingCard, category: e.target.value }) : setNewCardForm({ ...newCardForm, category: e.target.value })}
                      >
                        <option value="Offline">Offline</option>
                        <option value="Digital">Digital</option>
                      </select>
                    </div>
                  </div>

                  {((editingCard && editingCard.category === 'Offline') || (!editingCard && newCardForm.category === 'Offline')) && (
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <label className="form-label">Location (Kiosks and Cities)</label>
                      <select 
                        className="form-select"
                        value={editingCard 
                          ? (editingCard.card_locations && editingCard.card_locations.length > 0 ? editingCard.card_locations[0] : '')
                          : (newCardForm.card_locations && newCardForm.card_locations.length > 0 ? newCardForm.card_locations[0] : '')
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          const locs = val ? [val] : [];
                          if (editingCard) {
                            setEditingCard({ ...editingCard, card_locations: locs });
                          } else {
                            setNewCardForm({ ...newCardForm, card_locations: locs });
                          }
                        }}
                      >
                        <option value="">All Locations</option>
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.name}>{loc.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {((editingCard && editingCard.category === 'Digital') || (!editingCard && newCardForm.category === 'Digital')) && (
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <label className="form-label">Ad ID(s) (comma-separated for multiple mappings)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. 1202467823, 19720736, 98765432" 
                        value={editingCard ? (editingCard.ad_id || '') : (newCardForm.ad_id || '')}
                        onChange={(e) => editingCard 
                          ? setEditingCard({ ...editingCard, ad_id: e.target.value }) 
                          : setNewCardForm({ ...newCardForm, ad_id: e.target.value })}
                      />
                      <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem' }}>
                        Separate multiple Ad IDs with commas. Associate them with corresponding redirect URLs below in the exact same order.
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Short Description</label>
                    <textarea 
                      className="form-input" 
                      rows="3"
                      value={editingCard ? editingCard.description : newCardForm.description}
                      onChange={(e) => editingCard ? setEditingCard({ ...editingCard, description: e.target.value }) : setNewCardForm({ ...newCardForm, description: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Redirect URL Template(s) (comma-separated if using multiple Ad IDs)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. https://bank.com/apply1?urn={urn}, https://bank.com/apply2?urn={urn}"
                      value={editingCard ? editingCard.redirect_url_template : newCardForm.redirect_url_template}
                      onChange={(e) => editingCard ? setEditingCard({ ...editingCard, redirect_url_template: e.target.value }) : setNewCardForm({ ...newCardForm, redirect_url_template: e.target.value })}
                      required
                    />
                      <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem' }}>
                        If using multiple Ad IDs, map each redirect template 1-to-1 using commas. Allowed wildcards: <code>{`{name}`}</code>, <code>{`{phone}`}</code>, <code>{`{email}`}</code>, <code>{`{urn}`}</code>, <code>{`{agent_id}`}</code>, <code>{`{utm_source}`}</code>, <code>{`{utm_info}`}</code>, <code>{`{utm_creative_format}`}</code>.
                      </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Display Order</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={editingCard ? editingCard.display_order : newCardForm.display_order}
                        onChange={(e) => editingCard ? setEditingCard({ ...editingCard, display_order: parseInt(e.target.value) || 1 }) : setNewCardForm({ ...newCardForm, display_order: parseInt(e.target.value) || 1 })}
                        required
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
                      <input 
                        type="checkbox" 
                        id="card-active" 
                        checked={editingCard ? editingCard.active : newCardForm.active}
                        onChange={(e) => editingCard ? setEditingCard({ ...editingCard, active: e.target.checked }) : setNewCardForm({ ...newCardForm, active: e.target.checked })}
                        style={{ accentColor: 'hsl(var(--primary))' }}
                      />
                      <label htmlFor="card-active" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>Active Status</label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={isSubmitting}>
                      {isSubmitting ? 'Processing...' : (editingCard ? 'Save Changes' : 'Create Card')}
                    </button>
                    {editingCard && (
                      <button type="button" onClick={() => setEditingCard(null)} className="btn-secondary" style={{ flex: 1 }} disabled={isSubmitting}>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Cards Inventory */}
              <div className="glass-panel">
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Cards Catalog ({cards.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {cards.map(card => (
                    <div key={card.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h4 style={{ fontWeight: 700 }}>{card.name}</h4>
                          <span className={`badge ${card.active ? 'badge-success' : 'badge-warning'}`}>
                            {card.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', margin: '0.25rem 0' }}>
                          {card.bank} Bank • Category: {card.category} • Order: {card.display_order}
                        </div>
                        {card.category === 'Offline' && (
                          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', margin: '0.25rem 0' }}>
                            Locations: {card.card_locations && card.card_locations.length > 0 ? card.card_locations.join(', ') : 'All Locations'}
                          </div>
                        )}
                        {card.category === 'Digital' && card.ad_id && (
                          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', margin: '0.25rem 0' }}>
                            Campaign Ad ID: <span style={{ color: 'var(--gold-deep)', fontWeight: 600 }}>{card.ad_id}</span>
                          </div>
                        )}
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', maxWidth: '350px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {card.redirect_url_template}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => setEditingCard({ ...card, card_locations: card.card_locations || [] })} className="btn-secondary" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDeleteCard(card.id)} className="btn-secondary" style={{ padding: '0.5rem', background: 'rgba(209, 67, 67, 0.1)', color: 'var(--err)', borderColor: 'rgba(209, 67, 67, 0.15)' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* AGENTS TAB */}
          {activeTab === 'agents' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', alignItems: 'start' }} className="admin-split-grid">
              
              {/* Agent Form */}
              <div className="glass-panel">
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>
                  {editingAgent ? `Edit Agent: ${editingAgent.name}` : 'Register Field Agent'}
                </h3>
                
                <form onSubmit={editingAgent ? handleUpdateAgent : handleCreateAgent}>
                  <div className="form-group">
                    <label className="form-label">Agent Code / ID {editingAgent && '(Read-only)'}</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. FIDR30, agent_1"
                      value={editingAgent ? editingAgent.id : (newAgentForm.id || '')}
                      onChange={(e) => editingAgent ? null : setNewAgentForm({ ...newAgentForm, id: e.target.value })}
                      required
                      disabled={!!editingAgent}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={editingAgent ? editingAgent.name : newAgentForm.name}
                        onChange={(e) => editingAgent ? setEditingAgent({ ...editingAgent, name: e.target.value }) : setNewAgentForm({ ...newAgentForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone Number</label>
                      <input 
                        type="tel" 
                        className="form-input" 
                        value={editingAgent ? editingAgent.phone : newAgentForm.phone}
                        onChange={(e) => editingAgent ? setEditingAgent({ ...editingAgent, phone: e.target.value }) : setNewAgentForm({ ...newAgentForm, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      value={editingAgent ? editingAgent.email : newAgentForm.email}
                      onChange={(e) => editingAgent ? setEditingAgent({ ...editingAgent, email: e.target.value }) : setNewAgentForm({ ...newAgentForm, email: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Username</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={editingAgent ? editingAgent.username : newAgentForm.username}
                        onChange={(e) => editingAgent ? setEditingAgent({ ...editingAgent, username: e.target.value }) : setNewAgentForm({ ...newAgentForm, username: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{editingAgent ? 'New Password (Optional)' : 'Password'}</label>
                      <input 
                        type="password" 
                        className="form-input" 
                        placeholder={editingAgent ? 'Leave blank to keep same' : 'Enter password'}
                        value={editingAgent ? (editingAgent.password || '') : newAgentForm.password}
                        onChange={(e) => editingAgent ? setEditingAgent({ ...editingAgent, password: e.target.value }) : setNewAgentForm({ ...newAgentForm, password: e.target.value })}
                        required={!editingAgent}
                      />
                    </div>
                  </div>

                  {/* Assigned Locations checkboxes */}
                  <div className="form-group">
                    <label className="form-label">Assign Locations</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'var(--paper-2)', border: '1px solid var(--line)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', maxHeight: '120px', overflowY: 'auto' }}>
                      {locations.map(loc => {
                        const isChecked = editingAgent 
                          ? editingAgent.locations.includes(loc.name)
                          : newAgentForm.locations.includes(loc.name);
                        return (
                          <div key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <input 
                              type="checkbox" 
                              id={`loc-${loc.id}`} 
                              checked={isChecked}
                              onChange={() => handleAgentFormLocToggle(loc.name, editingAgent ? 'edit' : 'new')}
                              style={{ accentColor: 'var(--gold)' }}
                            />
                            <label htmlFor={`loc-${loc.id}`} style={{ fontSize: '0.8rem', color: 'var(--ink)', cursor: 'pointer' }}>{loc.name}</label>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select 
                      className="form-select" 
                      value={editingAgent ? editingAgent.status : newAgentForm.status}
                      onChange={(e) => editingAgent ? setEditingAgent({ ...editingAgent, status: e.target.value }) : setNewAgentForm({ ...newAgentForm, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={isSubmitting}>
                      {isSubmitting ? 'Processing...' : (editingAgent ? 'Update Agent' : 'Register Agent')}
                    </button>
                    {editingAgent && (
                      <button type="button" onClick={() => setEditingAgent(null)} className="btn-secondary" style={{ flex: 1 }} disabled={isSubmitting}>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Agent Roster */}
              <div className="glass-panel">
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Registered Agents ({agents.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                  {agents.map(ag => (
                    <div key={ag.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h4 style={{ fontWeight: 700 }}>{ag.name}</h4>
                          <span className={`badge ${ag.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                            {ag.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', margin: '0.25rem 0' }}>
                          Username: <code>{ag.username}</code> • WhatsApp: {ag.phone || 'N/A'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--secondary))', fontWeight: 500 }}>
                          Locations: {ag.locations && ag.locations.length > 0 ? ag.locations.join(', ') : 'None assigned'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => setEditingAgent(ag)} className="btn-secondary" style={{ padding: '0.5rem' }}>
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDeleteAgent(ag.id)} className="btn-secondary" style={{ padding: '0.5rem', background: 'rgba(209, 67, 67, 0.1)', color: 'var(--err)', borderColor: 'rgba(209, 67, 67, 0.15)' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* LOCATIONS TAB */}
          {activeTab === 'locations' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem', alignItems: 'start' }} className="admin-split-grid">
              
              {/* Location Creator */}
              <div className="glass-panel">
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Create Location / Kiosk</h3>
                <form onSubmit={handleCreateLocation}>
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label className="form-label">Location Identifier Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Mumbai Airport Kiosk" 
                      value={newLocName}
                      onChange={(e) => setNewLocName(e.target.value)}
                      required 
                    />
                  </div>
                   <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={isSubmitting}>
                     {isSubmitting ? 'Creating...' : 'Add Location Master Entry'}
                   </button>
                </form>
              </div>

              {/* Location Catalog */}
              <div className="glass-panel">
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Locations Catalog ({locations.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {locations.map(loc => (
                    <div key={loc.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '1rem' }}>{loc.name}</span>
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem' }}>
                          Registered: {loc.created_at ? loc.created_at.slice(0, 10) : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button 
                          onClick={() => handleToggleLocActive(loc)} 
                          className="btn-secondary" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', borderColor: loc.active ? 'hsla(145, 80%, 45%, 0.3)' : 'hsla(42, 95%, 55%, 0.3)', color: loc.active ? 'hsl(var(--accent-green))' : 'hsl(var(--accent-gold))' }}
                        >
                          {loc.active ? 'Active' : 'Inactive'}
                        </button>
                        <button onClick={() => handleDeleteLoc(loc.id)} style={{ color: 'var(--err)', background: 'none', border: 'none', cursor: 'pointer' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="settings-split-grid" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '2rem', alignItems: 'start', minHeight: '600px' }}>
              {/* Sidebar Menu */}
              <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gold-deep)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <SettingsIcon size={18} />
                    <span>Settings & API</span>
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Configure your system</span>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSettingsSubTab('general')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: activeSettingsSubTab === 'general' ? 'rgba(224, 168, 46, 0.15)' : 'transparent',
                    color: activeSettingsSubTab === 'general' ? 'var(--gold)' : 'hsl(var(--text-secondary))',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    fontWeight: activeSettingsSubTab === 'general' ? 600 : 400
                  }}
                  className="settings-menu-item"
                >
                  <SettingsIcon size={16} />
                  <span>General & Legal</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSettingsSubTab('whatsapp_gateway')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: activeSettingsSubTab === 'whatsapp_gateway' ? 'rgba(224, 168, 46, 0.15)' : 'transparent',
                    color: activeSettingsSubTab === 'whatsapp_gateway' ? 'var(--gold)' : 'hsl(var(--text-secondary))',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    fontWeight: activeSettingsSubTab === 'whatsapp_gateway' ? 600 : 400
                  }}
                  className="settings-menu-item"
                >
                  <Layers size={16} />
                  <span>WhatsApp Gateway</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSettingsSubTab('meta_api')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: activeSettingsSubTab === 'meta_api' ? 'rgba(224, 168, 46, 0.15)' : 'transparent',
                    color: activeSettingsSubTab === 'meta_api' ? 'var(--gold)' : 'hsl(var(--text-secondary))',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    fontWeight: activeSettingsSubTab === 'meta_api' ? 600 : 400
                  }}
                  className="settings-menu-item"
                >
                  <MessageSquare size={16} />
                  <span>Meta Cloud API</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSettingsSubTab('baileys')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: activeSettingsSubTab === 'baileys' ? 'rgba(224, 168, 46, 0.15)' : 'transparent',
                    color: activeSettingsSubTab === 'baileys' ? 'var(--gold)' : 'hsl(var(--text-secondary))',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    fontWeight: activeSettingsSubTab === 'baileys' ? 600 : 400
                  }}
                  className="settings-menu-item"
                >
                  <Smartphone size={16} />
                  <span>Baileys Device</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSettingsSubTab('csv_export')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: activeSettingsSubTab === 'csv_export' ? 'rgba(224, 168, 46, 0.15)' : 'transparent',
                    color: activeSettingsSubTab === 'csv_export' ? 'var(--gold)' : 'hsl(var(--text-secondary))',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    fontWeight: activeSettingsSubTab === 'csv_export' ? 600 : 400
                  }}
                  className="settings-menu-item"
                >
                  <Download size={16} />
                  <span>CSV Export Mapper</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSettingsSubTab('tracking_api')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: activeSettingsSubTab === 'tracking_api' ? 'rgba(224, 168, 46, 0.15)' : 'transparent',
                    color: activeSettingsSubTab === 'tracking_api' ? 'var(--gold)' : 'hsl(var(--text-secondary))',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    fontWeight: activeSettingsSubTab === 'tracking_api' ? 600 : 400
                  }}
                  className="settings-menu-item"
                >
                  <Activity size={16} />
                  <span>Meta CAPI & GTM</span>
                </button>
              </div>


              {/* Settings Sub-Tab Contents */}
              <div className="glass-panel" style={{ flex: 1, padding: '2rem', minWidth: 0 }}>
                {activeSettingsSubTab === 'general' && (
                  <form onSubmit={handleUpdateSettings}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', color: 'var(--gold-deep)' }}>
                      <SettingsIcon size={20} />
                      <span>General & Legal Settings</span>
                    </h3>

                    <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Global Public Redirect URL Template</label>
                        <input 
                          type="url" 
                          className="form-input" 
                          placeholder="https://bank.com/apply?name={name}&phone={phone}&urn={urn}"
                          value={settings.public_redirect_url || ''}
                          onChange={(e) => setSettings({ ...settings, public_redirect_url: e.target.value })}
                          required 
                        />
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.5rem', lineHeight: '1.3' }}>
                          Allowed wildcards: <code>{`{name}`}</code>, <code>{`{phone}`}</code>, <code>{`{urn}`}</code>. Redirects here after OTP verification.
                        </div>
                      </div>
                      
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Public Base Site URL (For WhatsApp Links)</label>
                        <input 
                          type="url" 
                          className="form-input" 
                          placeholder="https://finmantra.org"
                          value={settings.public_site_url || ''}
                          onChange={(e) => setSettings({ ...settings, public_site_url: e.target.value })}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.5rem', lineHeight: '1.3' }}>
                          Domain/IP used for generated WhatsApp redirection links. Falls back to current host if left blank.
                        </div>
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                      <label className="form-label">WhatsApp OTP Template Text</label>
                      <textarea 
                        className="form-input" 
                        rows="3" 
                        value={settings.otp_message_template || ''}
                        onChange={(e) => setSettings({ ...settings, otp_message_template: e.target.value })}
                        required 
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                      />
                      <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.5rem' }}>
                        Must include <code>{`{otp}`}</code>. Sent to customers on OTP verification requests.
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                      <label className="form-label">Aadhaar Legal Consent Text</label>
                      <textarea 
                        className="form-input" 
                        rows="3" 
                        value={settings.consent_text || ''}
                        onChange={(e) => setSettings({ ...settings, consent_text: e.target.value })}
                        required 
                      />
                      <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.5rem' }}>
                        The official disclaimer shown to clients when confirming their Aadhaar consent.
                      </div>
                    </div>

                    <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Terms & Conditions URL Link</label>
                        <input 
                          type="url" 
                          className="form-input" 
                          value={settings.terms_link || ''}
                          onChange={(e) => setSettings({ ...settings, terms_link: e.target.value })}
                          required 
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Privacy Policy URL Link</label>
                        <input 
                          type="url" 
                          className="form-input" 
                          value={settings.privacy_link || ''}
                          onChange={(e) => setSettings({ ...settings, privacy_link: e.target.value })}
                          required 
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn-primary" style={{ padding: '0.75rem 2rem' }} disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save General & Legal Settings'}
                      </button>
                    </div>
                  </form>
                )}

                {activeSettingsSubTab === 'whatsapp_gateway' && (
                  <form onSubmit={handleUpdateSettings}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', color: 'var(--gold-deep)' }}>
                      <Layers size={20} />
                      <span>WhatsApp Gateway Selector</span>
                    </h3>

                    <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', marginBottom: '2rem', lineHeight: '1.5' }}>
                      Select the primary active channel for routing client OTP codes, transactional referral messages, and notifications.
                    </p>

                    <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
                      <div
                        onClick={() => setSettings({ ...settings, whatsapp_gateway: 'meta' })}
                        style={{
                          padding: '2rem 1.5rem',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '1rem',
                          height: 'auto',
                          borderWidth: '2px',
                          borderStyle: 'solid',
                          borderColor: (settings.whatsapp_gateway === 'meta') ? 'var(--gold-deep)' : 'var(--border-light)',
                          background: (settings.whatsapp_gateway === 'meta') ? 'rgba(224, 168, 46, 0.08)' : 'rgba(255, 255, 255, 0.01)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          textAlign: 'center',
                          boxShadow: (settings.whatsapp_gateway === 'meta') ? '0 8px 32px 0 rgba(224, 168, 46, 0.1)' : 'none'
                        }}
                        className="gateway-select-card"
                      >
                        <div style={{
                          width: '50px',
                          height: '50px',
                          borderRadius: '50%',
                          background: (settings.whatsapp_gateway === 'meta') ? 'rgba(224, 168, 46, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: (settings.whatsapp_gateway === 'meta') ? 'var(--gold)' : 'hsl(var(--text-muted))'
                        }}>
                          <Layers size={26} />
                        </div>
                        <div>
                          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-light)', display: 'block', marginBottom: '0.25rem' }}>Meta Cloud API (Official)</span>
                          <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', lineHeight: '1.4', display: 'block' }}>
                            Uses official pre-approved Meta message templates. Highly stable, scalable, and recommended for high-volume production delivery.
                          </span>
                        </div>
                      </div>

                      <div
                        onClick={() => setSettings({ ...settings, whatsapp_gateway: 'baileys' })}
                        style={{
                          padding: '2rem 1.5rem',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '1rem',
                          height: 'auto',
                          borderWidth: '2px',
                          borderStyle: 'solid',
                          borderColor: (settings.whatsapp_gateway === 'baileys' || !settings.whatsapp_gateway) ? 'var(--gold-deep)' : 'var(--border-light)',
                          background: (settings.whatsapp_gateway === 'baileys' || !settings.whatsapp_gateway) ? 'rgba(224, 168, 46, 0.08)' : 'rgba(255, 255, 255, 0.01)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          textAlign: 'center',
                          boxShadow: (settings.whatsapp_gateway === 'baileys' || !settings.whatsapp_gateway) ? '0 8px 32px 0 rgba(224, 168, 46, 0.1)' : 'none'
                        }}
                        className="gateway-select-card"
                      >
                        <div style={{
                          width: '50px',
                          height: '50px',
                          borderRadius: '50%',
                          background: (settings.whatsapp_gateway === 'baileys' || !settings.whatsapp_gateway) ? 'rgba(224, 168, 46, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: (settings.whatsapp_gateway === 'baileys' || !settings.whatsapp_gateway) ? 'var(--gold)' : 'hsl(var(--text-muted))'
                        }}>
                          <Smartphone size={26} />
                        </div>
                        <div>
                          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-light)', display: 'block', marginBottom: '0.25rem' }}>Baileys Linked Device</span>
                          <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', lineHeight: '1.4', display: 'block' }}>
                            Routes messages through an active WhatsApp Web session linked to your phone. Zero setup fees or template approvals required.
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn-primary" style={{ padding: '0.75rem 2rem' }} disabled={isSubmitting}>
                        {isSubmitting ? 'Saving Gateway Selector...' : 'Save Gateway Selection'}
                      </button>
                    </div>
                  </form>
                )}

                {activeSettingsSubTab === 'meta_api' && (
                  <form onSubmit={handleUpdateSettings}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', color: 'var(--gold-deep)' }}>
                      <MessageSquare size={20} />
                      <span>Meta WhatsApp Cloud API Configuration</span>
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                      Input your official Meta credentials to authorize access. If left empty, system runs on local configuration or mock simulation mode.
                    </p>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                      <label className="form-label">System User Access Token (WA_API_KEY)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="EAAPJ..."
                        value={settings.wa_api_key || ''}
                        onChange={(e) => setSettings({ ...settings, wa_api_key: e.target.value })}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Phone Number ID</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. 102938475610293"
                          value={settings.wa_phone_number_id || ''}
                          onChange={(e) => setSettings({ ...settings, wa_phone_number_id: e.target.value })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Business Account ID (Optional)</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. 928374650192837"
                          value={settings.wa_business_account_id || ''}
                          onChange={(e) => setSettings({ ...settings, wa_business_account_id: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">OTP Template Name</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="auth_otp"
                          value={settings.wa_otp_template_name || ''}
                          onChange={(e) => setSettings({ ...settings, wa_otp_template_name: e.target.value })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Referral Template Name</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="transactional_link"
                          value={settings.wa_referral_template_name || ''}
                          onChange={(e) => setSettings({ ...settings, wa_referral_template_name: e.target.value })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Template Language</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="en"
                          value={settings.wa_template_language || ''}
                          onChange={(e) => setSettings({ ...settings, wa_template_language: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">WhatsApp Referral Link Type</label>
                        <select 
                          className="form-input" 
                          value={settings.wa_referral_link_type || 'body'}
                          onChange={(e) => setSettings({ ...settings, wa_referral_link_type: e.target.value })}
                          style={{ height: 'auto', padding: '0.6rem 0.8rem' }}
                        >
                          <option value="body">Text Link (Send URL in Message Body)</option>
                          <option value="button">Button Link (Dynamic Link Button)</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Meta API Version</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. v20.0"
                          value={settings.wa_api_version || ''}
                          onChange={(e) => setSettings({ ...settings, wa_api_version: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={settings.wa_otp_is_auth_template === 'true' || settings.wa_otp_is_auth_template === true}
                          onChange={(e) => setSettings({ ...settings, wa_otp_is_auth_template: e.target.checked })}
                          style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer', accentColor: 'var(--gold)' }}
                        />
                        <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-light)' }}>
                          OTP uses Authentication Template (with Copy Code Button format)
                        </span>
                      </label>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button 
                          type="button" 
                          className="btn-secondary" 
                          onClick={() => handleTestWhatsAppMeta('otp', '8295886832')}
                          style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
                        >
                          Send Test OTP (8295886832)
                        </button>
                        <button 
                          type="button" 
                          className="btn-secondary" 
                          onClick={() => handleTestWhatsAppMeta('url', '8295886832')}
                          style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
                        >
                          Send Test URL (8295886832)
                        </button>
                      </div>
                      <button type="submit" className="btn-primary" style={{ padding: '0.75rem 2rem' }} disabled={isSubmitting}>
                        {isSubmitting ? 'Saving API Credentials...' : 'Save Meta Credentials'}
                      </button>
                    </div>
                  </form>
                )}

                {activeSettingsSubTab === 'baileys' && (
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', color: 'var(--gold-deep)' }}>
                      <Smartphone size={20} />
                      <span>WhatsApp Linked Device (Baileys Session)</span>
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                      Scan the QR code below using your phone's WhatsApp application (Linked Devices) to authorize this portal to send notifications using your active number.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'rgba(0, 0, 0, 0.2)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <div style={{
                          width: '50px',
                          height: '50px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: settings.whatsapp_gateway === 'meta' ? 'rgba(255, 255, 255, 0.05)' : baileysStatus.status === 'CONNECTED' ? 'rgba(34, 197, 94, 0.15)' : baileysStatus.status === 'QR_READY' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: settings.whatsapp_gateway === 'meta' ? 'hsl(var(--text-muted))' : baileysStatus.status === 'CONNECTED' ? '#22c55e' : baileysStatus.status === 'QR_READY' ? '#eab308' : '#ef4444'
                        }}>
                          {settings.whatsapp_gateway === 'meta' ? <WifiOff size={24} /> : baileysStatus.status === 'CONNECTED' ? <Wifi size={24} /> : <WifiOff size={24} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>Connection Status:</span>
                            <span style={{ 
                              color: settings.whatsapp_gateway === 'meta' ? 'hsl(var(--text-muted))' : baileysStatus.status === 'CONNECTED' ? '#22c55e' : baileysStatus.status === 'QR_READY' ? '#eab308' : '#ef4444',
                              fontWeight: 700 
                            }}>
                              {settings.whatsapp_gateway === 'meta' ? 'INACTIVE (GATEWAY SET TO META)' : baileysStatus.status === 'CONNECTED' ? 'CONNECTED' : baileysStatus.status === 'QR_READY' ? 'SCAN QR CODE' : baileysStatus.status === 'CONNECTING' ? 'INITIALIZING...' : 'DISCONNECTED'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginTop: '0.25rem' }}>
                            {settings.whatsapp_gateway === 'meta'
                              ? 'Switch your active gateway to "Baileys Linked Device" to scan and link your phone session.'
                              : baileysStatus.status === 'CONNECTED' 
                              ? `Active Session Number: +${baileysStatus.phone}` 
                              : baileysStatus.status === 'QR_READY' 
                              ? 'Open WhatsApp on your mobile phone > Settings > Linked Devices > Link a Device.' 
                              : 'Please wait, checking or starting the browser web session...'
                            }
                          </div>
                        </div>
                      </div>

                      {settings.whatsapp_gateway !== 'meta' && baileysStatus.status === 'CONNECTED' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                          <button 
                            type="button" 
                            onClick={handleDisconnectBaileys} 
                            className="btn-secondary" 
                            style={{ padding: '0.6rem 1.5rem', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.2)', cursor: 'pointer' }}
                            disabled={loadingBaileys}
                          >
                            {loadingBaileys ? 'Disconnecting...' : 'Disconnect WhatsApp Account'}
                          </button>
                        </div>
                      )}
                    </div>

                    {settings.whatsapp_gateway !== 'meta' && baileysStatus.status === 'QR_READY' && baileysStatus.qrCodeDataUrl && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '2rem', padding: '1.5rem', background: '#fff', borderRadius: 'var(--radius-md)', maxWidth: '280px', margin: '2rem auto 0 auto', border: '2px solid var(--gold-deep)', boxShadow: '0 8px 32px 0 rgba(0,0,0,0.5)' }}>
                        <img 
                          src={baileysStatus.qrCodeDataUrl} 
                          alt="WhatsApp Linked Device QR" 
                          style={{ width: '220px', height: '220px', display: 'block' }}
                        />
                        <div style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 700, marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <QrCode size={16} style={{ color: 'var(--gold-deep)' }} />
                          <span>Scan QR Code to Link</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeSettingsSubTab === 'csv_export' && (
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', color: 'var(--gold-deep)' }}>
                      <Download size={20} />
                      <span>CSV Export Column Mapper</span>
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem' }}>
                      Reorder, rename, delete, or create columns dynamically. Map to standard model properties or bind to custom query parameter keys.
                    </p>

                    <div style={{ 
                      maxHeight: '420px', 
                      overflowY: 'auto', 
                      border: '1px solid var(--border-light)', 
                      borderRadius: 'var(--radius-md)', 
                      background: 'rgba(0,0,0,0.2)',
                      marginBottom: '1.5rem',
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      {csvColumns.map((col, index) => {
                        const isCustom = !STANDARD_FIELD_OPTIONS.some(opt => opt.value === col.source);
                        return (
                          <div key={col.id || index} style={{ 
                            display: 'flex', 
                            gap: '0.75rem', 
                            alignItems: 'center', 
                            padding: '0.75rem', 
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-light)',
                            minWidth: '600px'
                          }}>
                            {/* Reordering Controls */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <button 
                                type="button" 
                                onClick={() => handleMoveColumnUp(index)} 
                                disabled={index === 0}
                                style={{ background: 'none', border: 'none', color: 'hsl(var(--text-primary))', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.3 : 1, padding: 0 }}
                                title="Move Up"
                              >
                                <ArrowUp size={16} />
                              </button>
                              <button 
                                type="button" 
                                onClick={() => handleMoveColumnDown(index)} 
                                disabled={index === csvColumns.length - 1}
                                style={{ background: 'none', border: 'none', color: 'hsl(var(--text-primary))', cursor: index === csvColumns.length - 1 ? 'not-allowed' : 'pointer', opacity: index === csvColumns.length - 1 ? 0.3 : 1, padding: 0 }}
                                title="Move Down"
                              >
                                <ArrowDown size={16} />
                              </button>
                            </div>

                            <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', minWidth: '24px', fontWeight: 600, textAlign: 'center' }}>
                              #{index + 1}
                            </span>

                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ flex: 2, padding: '0.5rem 0.75rem', fontSize: '0.85rem', margin: 0 }} 
                              placeholder="CSV Column Header Label" 
                              value={col.header} 
                              onChange={(e) => {
                                const updated = [...csvColumns];
                                updated[index].header = e.target.value;
                                setCsvColumns(updated);
                              }}
                            />

                            <select
                              className="form-input"
                              style={{ flex: 2, padding: '0.5rem 0.75rem', fontSize: '0.85rem', margin: 0, height: 'auto' }}
                              value={isCustom ? '__custom__' : col.source}
                              onChange={(e) => {
                                const val = e.target.value;
                                const updated = [...csvColumns];
                                if (val === '__custom__') {
                                  updated[index].source = '';
                                } else {
                                  updated[index].source = val;
                                }
                                setCsvColumns(updated);
                              }}
                            >
                              {STANDARD_FIELD_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                              <option value="__custom__">Custom Parameter / Key...</option>
                            </select>

                            {isCustom && (
                              <input 
                                type="text" 
                                className="form-input" 
                                style={{ flex: 1.5, padding: '0.5rem 0.75rem', fontSize: '0.85rem', margin: 0, fontFamily: 'var(--font-mono)', borderColor: 'var(--gold-deep)' }} 
                                placeholder="custom_param_key" 
                                value={col.source} 
                                onChange={(e) => {
                                  const updated = [...csvColumns];
                                  updated[index].source = e.target.value.trim();
                                  setCsvColumns(updated);
                                }}
                              />
                            )}

                            <button 
                              type="button" 
                              onClick={() => handleDeleteColumn(index)} 
                              style={{ color: 'var(--err)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}
                              title="Delete Column"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button 
                          type="button" 
                          onClick={handleAddColumn} 
                          className="btn-secondary" 
                          style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', cursor: 'pointer' }}
                        >
                          + Add New Column
                        </button>
                        <button 
                          type="button" 
                          onClick={handleResetCsvTemplate} 
                          className="btn-secondary" 
                          style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', borderColor: 'rgba(224, 168, 46, 0.2)', cursor: 'pointer' }}
                        >
                          Reset to Defaults
                        </button>
                      </div>
                      <button 
                        type="button" 
                        onClick={handleSaveCsvTemplate} 
                        className="btn-primary" 
                        style={{ padding: '0.6rem 1.5rem', fontSize: '0.85rem', cursor: 'pointer' }}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Saving Template...' : 'Save Export Layout'}
                      </button>
                    </div>
                  </div>
                )}

                {activeSettingsSubTab === 'tracking_api' && (
                  <form onSubmit={handleUpdateSettings}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', color: 'var(--gold-deep)' }}>
                      <Activity size={20} />
                      <span>Meta Conversions API (CAPI) & GTM Settings</span>
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem' }}>
                      Configure your Meta Pixel ID, CAPI Access Token, and Google Tag Manager Container ID to enable real-time hybrid conversion tracking & analytics.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>Google Tag Manager (GTM) Container ID</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="GTM-XXXXXXX"
                          value={settings.gtm_container_id || settings.gtm_id || ''}
                          onChange={(e) => setSettings({ ...settings, gtm_container_id: e.target.value.trim(), gtm_id: e.target.value.trim() })}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.35rem' }}>
                          Example: <code>GTM-5N9Z4LX7</code>. Automatically injects the container script and pushes <code>lead_submitted</code> events to <code>window.dataLayer</code>.
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>Meta Pixel ID</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="1015546961540665"
                          value={settings.meta_pixel_id || ''}
                          onChange={(e) => setSettings({ ...settings, meta_pixel_id: e.target.value.trim() })}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.35rem' }}>
                          Your Meta Pixel ID used for client-side browser tracking (<code>fbq</code>) and server-side CAPI events.
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>Meta CAPI Access Token</label>
                        <textarea 
                          className="form-input" 
                          rows="3"
                          placeholder="EAAdY08snSiUB..."
                          value={settings.meta_access_token || ''}
                          onChange={(e) => setSettings({ ...settings, meta_access_token: e.target.value.trim() })}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.35rem' }}>
                          System user access token for Graph API v20.0 server-to-server event dispatching.
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>Meta Test Event Code (Optional)</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="TEST12345"
                          value={settings.meta_test_event_code || ''}
                          onChange={(e) => setSettings({ ...settings, meta_test_event_code: e.target.value.trim() })}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.35rem' }}>
                          Use this code to test real-time server events directly inside Meta Events Manager Test Console.
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn-primary" disabled={isSubmitting}>
                        {isSubmitting ? 'Saving Settings...' : 'Save Analytics & CAPI Configuration'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}


        </div>
      )}

      {/* Lead Details Modal */}
      {selectedLeadDetails && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(8px)' }}>
          <div className="glass-panel admin-dialog-panel" style={{ width: '90%', maxWidth: '650px', position: 'relative', borderTop: '4px solid var(--gold)', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
            <button onClick={() => { setSelectedLeadDetails(null); setIsEditingLead(false); }} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.2rem', color: 'hsl(var(--text-primary))' }}>Lead Details</h3>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--gold-deep)', marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
              <span>URN: {selectedLeadDetails.urn}</span>
              <span>•</span>
              <span>Date: {selectedLeadDetails.created_at ? selectedLeadDetails.created_at.replace('T', ' ').slice(0, 16) : ''}</span>
            </div>

            {!isEditingLead ? (
              <>
                {/* VIEW MODE */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem', textAlign: 'left' }} className="admin-split-grid">
                  <div>
                    <h4 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '0.8rem', color: 'hsl(var(--primary))' }}>Customer Details</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                      <div><strong>Name:</strong> {selectedLeadDetails.full_name}</div>
                      <div><strong>Phone:</strong> +91 {selectedLeadDetails.phone}</div>
                      <div><strong>Email:</strong> {selectedLeadDetails.email}</div>
                      <div>
                        <strong>Consent:</strong>{' '}
                        <span style={{ color: selectedLeadDetails.consent ? 'var(--mint)' : 'var(--err)', fontWeight: 600 }}>
                          {selectedLeadDetails.consent ? 'Accepted' : 'No Consent'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '0.8rem', color: 'hsl(var(--primary))' }}>Registration Info</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                      <div><strong>Selected Card:</strong> {selectedLeadDetails.card_name || 'N/A'}</div>
                      <div><strong>Bank:</strong> {selectedLeadDetails.card_bank || 'N/A'}</div>
                      <div><strong>Source:</strong> <span className="badge badge-info">{selectedLeadDetails.source}</span></div>
                      {selectedLeadDetails.source === 'agent' && (
                        <>
                          <div><strong>Agent:</strong> {selectedLeadDetails.agent_name || 'Staff'} ({selectedLeadDetails.agent_id || 'N/A'})</div>
                          <div><strong>Kiosk Location:</strong> {selectedLeadDetails.agent_location || 'N/A'}</div>
                        </>
                      )}
                      <div><strong>Redirect URL:</strong> {selectedLeadDetails.redirect_url ? <a href={selectedLeadDetails.redirect_url} target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline', wordBreak: 'break-all' }}>Open Link</a> : 'N/A'}</div>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'left' }}>
                  <h4 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '0.8rem', color: 'hsl(var(--primary))' }}>Marketing & Tracking Parameters</h4>
                  
                  <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem 1.5rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                    <div><strong>UTM Channel:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_channel || 'N/A'}</span></div>
                    <div><strong>UTM Medium:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_medium || 'N/A'}</span></div>
                    <div><strong>UTM Source:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_source || 'N/A'}</span></div>
                    <div><strong>UTM Category:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_category || 'N/A'}</span></div>
                    <div><strong>UTM Campaign:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_campaign || 'N/A'}</span></div>
                    <div><strong>UTM Term:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_term || 'N/A'}</span></div>
                    <div><strong>UTM Content:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_content || 'N/A'}</span></div>
                    <div><strong>UTM Creative Format:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_creative_format || 'N/A'}</span></div>
                    <div><strong>UTM Info:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_info || 'N/A'}</span></div>
                    <div><strong>UTM Campaign ID (utm_id):</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_id || 'N/A'}</span></div>
                    <div><strong>UTM Ad ID (utm_creative):</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_creative || 'N/A'}</span></div>
                    <div><strong>Ad ID (ad_id):</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.ad_id || 'N/A'}</span></div>
                    <div><strong>UTM Keyword (utm_keyword):</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_keyword || 'N/A'}</span></div>
                    <div><strong>UTM Matchtype (utm_matchtype):</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_matchtype || 'N/A'}</span></div>
                    <div><strong>UTM Network (utm_network):</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_network || 'N/A'}</span></div>
                    <div><strong>UTM Placement (utm_placement):</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_placement || 'N/A'}</span></div>
                    <div><strong>UTM Device (utm_device):</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_device || 'N/A'}</span></div>
                    <div><strong>UTM Location (utm_location):</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_location || 'N/A'}</span></div>
                  </div>

                  <h5 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'hsl(var(--text-primary))', marginTop: '1rem' }}>Session & Entry Attribution</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', marginBottom: '1.5rem' }}>
                    <div><strong>Landing Page URL:</strong> <span style={{ color: 'var(--gold-deep)', wordBreak: 'break-all' }}>{selectedLeadDetails.landing_page || 'N/A'}</span></div>
                    <div><strong>First Landing Page:</strong> <span style={{ color: 'var(--gold-deep)', wordBreak: 'break-all' }}>{selectedLeadDetails.first_landing_page || 'N/A'}</span></div>
                    <div><strong>Referrer Source:</strong> <span style={{ color: 'var(--gold-deep)', wordBreak: 'break-all' }}>{selectedLeadDetails.referrer || 'N/A'}</span></div>
                  </div>

                  <h5 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'hsl(var(--text-primary))' }}>Ad Network Click Identifiers</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', marginBottom: '1.5rem' }}>
                    <div><strong>FBCLID (Facebook):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.fbclid || 'None'}</span></div>
                    <div><strong>GCLID (Google):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.gclid || 'None'}</span></div>
                    <div><strong>GBRAID (Google App iOS):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.gbraid || 'None'}</span></div>
                    <div><strong>WBRAID (Google App Web):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.wbraid || 'None'}</span></div>
                    <div><strong>GCLSRC (Google Click Source):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.gclsrc || 'None'}</span></div>
                    <div><strong>DCLID (Google Display):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.dclid || 'None'}</span></div>
                    <div><strong>MSCLKID (Bing):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.msclkid || 'None'}</span></div>
                    <div><strong>TTCLID (TikTok):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.ttclid || 'None'}</span></div>
                    <div><strong>TWCLID (Twitter):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.twclid || 'None'}</span></div>
                    <div><strong>LI_FAT_ID (LinkedIn):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.li_fat_id || 'None'}</span></div>
                  </div>

                  {/* Display other custom query parameters if any */}
                  {selectedLeadDetails.utm_params && Object.keys(selectedLeadDetails.utm_params).some(k => ![
                    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 
                    'utm_channel', 'utm_category', 'utm_info', 'utm_creative_format', 
                    'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id'
                  ].includes(k)) && (
                    <>
                      <h5 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'hsl(var(--text-primary))' }}>Custom / Other Query Parameters</h5>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {Object.entries(selectedLeadDetails.utm_params)
                          .filter(([k]) => ![
                            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 
                            'utm_channel', 'utm_category', 'utm_info', 'utm_creative_format', 
                            'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id'
                          ].includes(k))
                          .map(([k, v]) => (
                            <div key={k}>
                              <strong>{k}:</strong> <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--gold-deep)' }}>{String(v)}</span>
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button onClick={() => setIsEditingLead(true)} className="btn-primary" style={{ padding: '0.6rem 1.5rem' }}>
                    Edit Details
                  </button>
                  <button onClick={() => { setSelectedLeadDetails(null); setIsEditingLead(false); }} className="btn-secondary" style={{ padding: '0.6rem 1.5rem' }}>
                    Close Details
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* EDIT MODE */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem', textAlign: 'left' }} className="admin-split-grid">
                  <div>
                    <h4 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '0.8rem', color: 'hsl(var(--primary))' }}>Customer Details</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Name</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                          value={editLeadForm.full_name} 
                          onChange={(e) => handleEditLeadFormChange('full_name', e.target.value)} 
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Phone</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                          value={editLeadForm.phone} 
                          onChange={(e) => handleEditLeadFormChange('phone', e.target.value)} 
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Email</label>
                        <input 
                          type="email" 
                          className="form-input" 
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                          value={editLeadForm.email} 
                          onChange={(e) => handleEditLeadFormChange('email', e.target.value)} 
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Consent</label>
                        <select 
                          className="form-select" 
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                          value={editLeadForm.consent ? 'true' : 'false'} 
                          onChange={(e) => handleEditLeadFormChange('consent', e.target.value === 'true')}
                        >
                          <option value="true">Accepted</option>
                          <option value="false">No Consent</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '0.8rem', color: 'hsl(var(--primary))' }}>Registration Info</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Selected Card</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                          value={editLeadForm.card_name} 
                          onChange={(e) => handleEditLeadFormChange('card_name', e.target.value)} 
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Bank</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                          value={editLeadForm.card_bank} 
                          onChange={(e) => handleEditLeadFormChange('card_bank', e.target.value)} 
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Source</label>
                        <select 
                          className="form-select" 
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                          value={editLeadForm.source} 
                          onChange={(e) => handleEditLeadFormChange('source', e.target.value)}
                        >
                          <option value="public">Public</option>
                          <option value="agent">Agent</option>
                          <option value="kiosk">Kiosk</option>
                        </select>
                      </div>
                      {editLeadForm.source === 'agent' && (
                        <>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Agent Name</label>
                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                              value={editLeadForm.agent_name} 
                              onChange={(e) => handleEditLeadFormChange('agent_name', e.target.value)} 
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Kiosk Location</label>
                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                              value={editLeadForm.agent_location} 
                              onChange={(e) => handleEditLeadFormChange('agent_location', e.target.value)} 
                            />
                          </div>
                        </>
                      )}
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Redirect URL</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                          value={editLeadForm.redirect_url} 
                          onChange={(e) => handleEditLeadFormChange('redirect_url', e.target.value)} 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'left' }}>
                  <h4 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '0.8rem', color: 'hsl(var(--primary))' }}>Marketing & Tracking Parameters</h4>
                  
                  <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem 1.5rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>UTM Channel</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.utm_channel} 
                        onChange={(e) => handleEditLeadFormChange('utm_channel', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>UTM Medium</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.utm_medium} 
                        onChange={(e) => handleEditLeadFormChange('utm_medium', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>UTM Source</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.utm_source} 
                        onChange={(e) => handleEditLeadFormChange('utm_source', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>UTM Category</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.utm_category} 
                        onChange={(e) => handleEditLeadFormChange('utm_category', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>UTM Campaign</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.utm_campaign} 
                        onChange={(e) => handleEditLeadFormChange('utm_campaign', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>UTM Term</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.utm_term} 
                        onChange={(e) => handleEditLeadFormChange('utm_term', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>UTM Content</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.utm_content} 
                        onChange={(e) => handleEditLeadFormChange('utm_content', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>UTM Creative Format</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.utm_creative_format} 
                        onChange={(e) => handleEditLeadFormChange('utm_creative_format', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>UTM Info</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.utm_info} 
                        onChange={(e) => handleEditLeadFormChange('utm_info', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>UTM Campaign ID (utm_id)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.utm_id} 
                        onChange={(e) => handleEditLeadFormChange('utm_id', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>UTM Ad ID (utm_creative)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.utm_creative} 
                        onChange={(e) => handleEditLeadFormChange('utm_creative', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Ad ID (ad_id)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.ad_id || ''} 
                        onChange={(e) => handleEditLeadFormChange('ad_id', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>UTM Keyword (utm_keyword)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.utm_keyword} 
                        onChange={(e) => handleEditLeadFormChange('utm_keyword', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>UTM Matchtype (utm_matchtype)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.utm_matchtype} 
                        onChange={(e) => handleEditLeadFormChange('utm_matchtype', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>UTM Network (utm_network)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.utm_network} 
                        onChange={(e) => handleEditLeadFormChange('utm_network', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>UTM Placement (utm_placement)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.utm_placement} 
                        onChange={(e) => handleEditLeadFormChange('utm_placement', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>UTM Device (utm_device)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.utm_device} 
                        onChange={(e) => handleEditLeadFormChange('utm_device', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>UTM Location (utm_location)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.utm_location} 
                        onChange={(e) => handleEditLeadFormChange('utm_location', e.target.value)} 
                      />
                    </div>
                  </div>

                  <h5 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'hsl(var(--text-primary))' }}>Ad Network Click Identifiers</h5>
                  <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem 1.5rem', fontSize: '0.85rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>FBCLID (Facebook)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }} 
                        value={editLeadForm.fbclid} 
                        onChange={(e) => handleEditLeadFormChange('fbclid', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>GCLID (Google)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }} 
                        value={editLeadForm.gclid} 
                        onChange={(e) => handleEditLeadFormChange('gclid', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>GBRAID (Google App iOS)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }} 
                        value={editLeadForm.gbraid} 
                        onChange={(e) => handleEditLeadFormChange('gbraid', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>WBRAID (Google App Web)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }} 
                        value={editLeadForm.wbraid} 
                        onChange={(e) => handleEditLeadFormChange('wbraid', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>GCLSRC (Google Source)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }} 
                        value={editLeadForm.gclsrc} 
                        onChange={(e) => handleEditLeadFormChange('gclsrc', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>DCLID (Google Display)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }} 
                        value={editLeadForm.dclid} 
                        onChange={(e) => handleEditLeadFormChange('dclid', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>MSCLKID (Bing)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }} 
                        value={editLeadForm.msclkid} 
                        onChange={(e) => handleEditLeadFormChange('msclkid', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>TTCLID (TikTok)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }} 
                        value={editLeadForm.ttclid} 
                        onChange={(e) => handleEditLeadFormChange('ttclid', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>TWCLID (Twitter)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }} 
                        value={editLeadForm.twclid} 
                        onChange={(e) => handleEditLeadFormChange('twclid', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>LI_FAT_ID (LinkedIn)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }} 
                        value={editLeadForm.li_fat_id} 
                        onChange={(e) => handleEditLeadFormChange('li_fat_id', e.target.value)} 
                      />
                    </div>
                  </div>

                  <h5 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'hsl(var(--text-primary))', marginTop: '1.2rem' }}>Session & Entry Attribution</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.8rem', fontSize: '0.85rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Landing Page URL</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.landing_page} 
                        onChange={(e) => handleEditLeadFormChange('landing_page', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>First Landing Page</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.first_landing_page} 
                        onChange={(e) => handleEditLeadFormChange('first_landing_page', e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Referrer Source</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.referrer} 
                        onChange={(e) => handleEditLeadFormChange('referrer', e.target.value)} 
                      />
                    </div>
                  </div>

                  <h5 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'hsl(var(--text-primary))' }}>Custom / Other Query Parameters</h5>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {customParams.map((param, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} 
                          placeholder="Param Name" 
                          value={param.key} 
                          onChange={(e) => handleCustomParamChange(idx, 'key', e.target.value)} 
                        />
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ flex: 2, padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} 
                          placeholder="Value" 
                          value={param.value} 
                          onChange={(e) => handleCustomParamChange(idx, 'value', e.target.value)} 
                        />
                        <button 
                          type="button" 
                          onClick={() => handleRemoveCustomParam(idx)} 
                          style={{ color: 'var(--err)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem' }}
                          title="Remove Parameter"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button 
                      type="button" 
                      className="btn-secondary" 
                      style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', alignSelf: 'flex-start', marginTop: '0.5rem' }} 
                      onClick={handleAddCustomParam}
                    >
                      + Add Parameter
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button onClick={handleSaveLeadChanges} className="btn-primary" style={{ padding: '0.6rem 1.5rem' }}>
                    Save Changes
                  </button>
                  <button onClick={() => setIsEditingLead(false)} className="btn-secondary" style={{ padding: '0.6rem 1.5rem' }}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

