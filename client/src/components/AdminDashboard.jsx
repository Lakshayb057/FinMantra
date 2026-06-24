import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, CreditCard, MapPin, Settings as SettingsIcon, ShieldAlert, BarChart3, 
  Trash2, Download, Search, Plus, Edit, Check, X, RefreshCw, AlertCircle
} from 'lucide-react';

export default function AdminDashboard() {
  const [token, setToken] = useState(localStorage.getItem('finmantra_admin_token') || '');
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  
  // Navigation Tabs: 'leads' | 'cards' | 'agents' | 'locations' | 'settings'
  const [activeTab, setActiveTab] = useState('leads');

  // Master Data States
  const [leads, setLeads] = useState([]);
  const [cards, setCards] = useState([]);
  const [agents, setAgents] = useState([]);
  const [locations, setLocations] = useState([]);
  const [settings, setSettings] = useState({});

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCard, setFilterCard] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [selectedLeads, setSelectedLeads] = useState([]);

  // CRUD Editing Modals/States
  const [editingCard, setEditingCard] = useState(null);
  const [editingAgent, setEditingAgent] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);
  
  const [newCardForm, setNewCardForm] = useState({ name: '', bank: '', category: 'Premium', description: '', redirect_url_template: '', display_order: 1, active: true });
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

  // Real-time synchronization via WebSocket
  useEffect(() => {
    if (!token) return;

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
            showToast(`🎉 New Lead Registered: ${message.data.full_name} (${message.data.urm})`, 'success');
            loadAllAdminData();
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
  }, [token]);

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [leadsRes, cardsRes, agentsRes, locsRes, settingsRes] = await Promise.all([
        fetch(`${API_URL}/leads`, { headers }),
        fetch(`${API_URL}/admin/cards`, { headers }),
        fetch(`${API_URL}/agents`, { headers }),
        fetch(`${API_URL}/locations`),
        fetch(`${API_URL}/settings`)
      ]);

      if (leadsRes.status === 401 || leadsRes.status === 403) {
        handleLogout();
        return;
      }

      const leadsData = await leadsRes.json();
      const cardsData = await cardsRes.json();
      const agentsData = await agentsRes.json();
      const locsData = await locsRes.json();
      const settingsData = await settingsRes.json();

      setLeads(leadsData);
      setCards(cardsData);
      setAgents(agentsData);
      setLocations(locsData);
      setSettings(settingsData);
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
    // Since direct window.open can't pass auth header, we fetch it, create a Blob, and download:
    fetch(`${API_URL}/leads/export`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'finmantra_leads.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch(err => showToast('Export failed.', 'error'));
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
      setNewCardForm({ name: '', bank: '', category: 'Premium', description: '', redirect_url_template: '', display_order: 1, active: true });
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
        body: JSON.stringify({
          ...settings,
          public_redirect_url: publicUrl,
          terms_link: settings.terms_link ? settings.terms_link.trim() : '',
          privacy_link: settings.privacy_link ? settings.privacy_link.trim() : '',
          wa_api_key: settings.wa_api_key ? settings.wa_api_key.trim() : '',
          wa_phone_number_id: settings.wa_phone_number_id ? settings.wa_phone_number_id.trim() : '',
          wa_business_account_id: settings.wa_business_account_id ? settings.wa_business_account_id.trim() : '',
          wa_otp_template_name: settings.wa_otp_template_name ? settings.wa_otp_template_name.trim() : '',
          wa_referral_template_name: settings.wa_referral_template_name ? settings.wa_referral_template_name.trim() : ''
        })
      });
      showToast('System settings updated successfully.');
      loadAllAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to save settings.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtering Logic
  const filteredLeads = leads.filter(l => {
    const matchesSearch = 
      (l.full_name && l.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.phone && l.phone.includes(searchTerm)) ||
      (l.urm && l.urm.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCard = filterCard ? l.card_id === filterCard : true;
    const matchesSource = filterSource ? l.source === filterSource : true;

    return matchesSearch && matchesCard && matchesSource;
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
        </div>
      </section>
    );
  }

  return (
    <div style={{ padding: '2.5rem 5%', position: 'relative', zIndex: 1 }}>
      
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

      {/* Admin header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '0.25rem' }}>Admin Control Center</h1>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Manage cards, dynamic redirection URLs, agents, and track generated leads.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={loadAllAdminData} className="btn-secondary" style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={handleLogout} className="btn-secondary" style={{ padding: '0.6rem 1rem', background: 'rgba(209, 67, 67, 0.1)', color: 'var(--err)', borderColor: 'rgba(209, 67, 67, 0.2)' }}>
            Exit
          </button>
        </div>
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

      {/* Admin Panel Nav tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid var(--border-light)', marginBottom: '2rem', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button className={`nav-link ${activeTab === 'leads' ? 'active' : ''}`} onClick={() => setActiveTab('leads')}>
          <BarChart3 size={16} /> Leads Repository
        </button>
        <button className={`nav-link ${activeTab === 'cards' ? 'active' : ''}`} onClick={() => setActiveTab('cards')}>
          <CreditCard size={16} /> Cards Manager
        </button>
        <button className={`nav-link ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>
          <Users size={16} /> Agents Controller
        </button>
        <button className={`nav-link ${activeTab === 'locations' ? 'active' : ''}`} onClick={() => setActiveTab('locations')}>
          <MapPin size={16} /> Kiosks & Cities
        </button>
        <button className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          <SettingsIcon size={16} /> Settings & API
        </button>
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
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }} className="filters-strip">
                <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', top: '14px', left: '15px', color: 'hsl(var(--text-muted))' }} />
                  <input 
                    type="text" 
                    placeholder="Search by name, phone, URM..." 
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
                      <th>URM No.</th>
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
                          <td><span className="badge badge-info">{l.urm}</span></td>
                          <td>{l.created_at ? l.created_at.replace('T', ' ').slice(0, 16) : ''}</td>
                          <td style={{ fontWeight: 600 }}>{l.full_name}</td>
                          <td>{l.phone}</td>
                          <td>{l.card_name} <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>({l.card_bank})</span></td>
                          <td>{l.city}</td>
                          <td>{l.agent_location || '-'}</td>
                          <td>
                            <span className={`badge ${l.source === 'agent' ? 'badge-warning' : 'badge-success'}`}>
                               {l.source === 'agent' 
                                 ? (l.agent_name || 'Staff') 
                                 : (l.utm_source 
                                     ? `PUBLIC (${l.utm_source.toUpperCase()}${l.utm_info ? ' - ' + l.utm_info.toUpperCase() : ''})` 
                                     : 'PUBLIC')}
                            </span>
                          </td>
                          <td>
                            <button onClick={() => handleSingleDeleteLead(l.id)} style={{ color: 'var(--err)', background: 'none', border: 'none', cursor: 'pointer' }}>
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
                        <option value="Premium">Premium</option>
                        <option value="Rewards">Rewards</option>
                        <option value="Travel">Travel</option>
                        <option value="Cashback">Cashback</option>
                        <option value="Shopping">Shopping</option>
                        <option value="Digital">Digital</option>
                      </select>
                    </div>
                  </div>

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
                    <label className="form-label">Redirect URL Template</label>
                    <input 
                      type="url" 
                      className="form-input" 
                      placeholder="https://bank.com/apply?name={name}&phone={phone}&urm={urm}"
                      value={editingCard ? editingCard.redirect_url_template : newCardForm.redirect_url_template}
                      onChange={(e) => editingCard ? setEditingCard({ ...editingCard, redirect_url_template: e.target.value }) : setNewCardForm({ ...newCardForm, redirect_url_template: e.target.value })}
                      required
                    />
                      <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem' }}>
                        Allowed wildcards: <code>{`{name}`}</code>, <code>{`{phone}`}</code>, <code>{`{email}`}</code>, <code>{`{urm}`}</code>, <code>{`{agent_id}`}</code>, <code>{`{utm_source}`}</code>, <code>{`{utm_info}`}</code>.
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
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', maxWidth: '350px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {card.redirect_url_template}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => setEditingCard(card)} className="btn-secondary" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            <div className="glass-panel" style={{ maxWidth: '720px', margin: '0 auto' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
                System Configurations
              </h3>

              <form onSubmit={handleUpdateSettings}>
                <div className="form-group">
                  <label className="form-label">Global Public Redirect URL Template</label>
                  <input 
                    type="url" 
                    className="form-input" 
                    placeholder="https://bank.com/apply?name={name}&phone={phone}&urm={urm}"
                    value={settings.public_redirect_url || ''}
                    onChange={(e) => setSettings({ ...settings, public_redirect_url: e.target.value })}
                    required 
                  />
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem' }}>
                    Allowed wildcards: <code>{`{name}`}</code>, <code>{`{phone}`}</code>, <code>{`{email}`}</code>, <code>{`{urm}`}</code>, <code>{`{utm_source}`}</code>, <code>{`{utm_info}`}</code>. Public users will be redirected here after OTP verification.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">WhatsApp OTP Template Text</label>
                  <textarea 
                    className="form-input" 
                    rows="3" 
                    value={settings.otp_message_template || ''}
                    onChange={(e) => setSettings({ ...settings, otp_message_template: e.target.value })}
                    required 
                  />
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem' }}>
                    Must include <code>{`{otp}`}</code>. This is sent to customers on OTP request trigger.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Aadhaar Legal Consent Text</label>
                  <textarea 
                    className="form-input" 
                    rows="3" 
                    value={settings.consent_text || ''}
                    onChange={(e) => setSettings({ ...settings, consent_text: e.target.value })}
                    required 
                  />
                </div>

                <div style={{ marginTop: '2rem', marginBottom: '2rem', padding: '1.5rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: 'rgba(232, 168, 56, 0.03)' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--gold-deep)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>Meta WhatsApp Cloud API Configuration</span>
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginBottom: '1.25rem' }}>
                    Configure your live Meta credentials here. If left blank, the system will fall back to using your server's environment variables or Simulation Mode.
                  </p>

                  <div className="form-group">
                    <label className="form-label">System User Access Token (WA_API_KEY)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="EAAPJ..."
                      value={settings.wa_api_key || ''}
                      onChange={(e) => setSettings({ ...settings, wa_api_key: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
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
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                  <div className="form-group">
                    <label className="form-label">Terms & Conditions URL Link</label>
                    <input 
                      type="url" 
                      className="form-input" 
                      value={settings.terms_link || ''}
                      onChange={(e) => setSettings({ ...settings, terms_link: e.target.value })}
                      required 
                    />
                  </div>
                  <div className="form-group">
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

                <button type="submit" className="btn-primary" style={{ width: '100%', padding: '1rem' }} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Global System Configurations'}
                </button>
              </form>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
