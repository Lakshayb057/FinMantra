import React, { useState, useEffect, useRef } from 'react';
import { INDIA_STATES_SVG, aggregateLeadsByState, getHeatColor, pincodeToState } from '../utils/indiaMap.js';
import { 
  Users, CreditCard, MapPin, Settings as SettingsIcon, ShieldAlert, BarChart3, 
  Trash2, Download, Search, Plus, Edit, Check, X, RefreshCw, AlertCircle,
  QrCode, Smartphone, CheckCircle, Wifi, WifiOff, Eye, EyeOff, MessageSquare, Layers,
  ArrowUp, ArrowDown, MoreVertical, LogOut, Activity, Sun, Moon,
  TrendingUp, Upload, CheckCircle2, Filter
} from 'lucide-react';

const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(d);
    const p = {};
    parts.forEach(x => p[x.type] = x.value);
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
  } catch (e) {
    return d.toLocaleString();
  }
};

const getLocalDateString = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(d);
  } catch (e) {
    return d.toISOString().slice(0, 10);
  }
};

// Helper: format MIS values — converts Excel serial dates to readable format
const formatMISValue = (value, key) => {
  if (value === '' || value === undefined || value === null) return 'N/A';
  const str = String(value).trim();
  if (str === '') return 'N/A';

  // Check if this is a date/time field and the value is an Excel serial number
  const isDateField = key && (key.toLowerCase().includes('date') || key.toLowerCase().includes('time') || key.toLowerCase().includes('expiry'));
  if (isDateField) {
    const numVal = parseFloat(str);
    if (!isNaN(numVal) && numVal > 30000 && numVal < 60000) {
      // Excel serial date: days since 1900-01-01 (with the 1900 leap year bug)
      const utcMs = Math.round((numVal - 25569) * 86400 * 1000);
      const d = new Date(utcMs);
      if (!isNaN(d.getTime())) {
        try {
          return d.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false
          }) + ' IST';
        } catch (_) {
          return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
        }
      }
    }
    // Try normal date parse
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime()) && str.length > 6) {
      try {
        return parsed.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hour12: false
        }) + ' IST';
      } catch (_) {
        return str;
      }
    }
  }
  return str;
};

const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

export default function AdminDashboard({ navigateTo, theme, toggleTheme }) {
  const [token, setToken] = useState(localStorage.getItem('finmantra_admin_token') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [canDelete, setCanDelete] = useState(() => {
    const savedToken = localStorage.getItem('finmantra_admin_token');
    if (!savedToken) return false;
    const decoded = decodeToken(savedToken);
    return decoded ? !!decoded.canDelete : false;
  });
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
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

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeadsCount, setTotalLeadsCount] = useState(0);
  const [todaysLeadsCount, setTodaysLeadsCount] = useState(0);
  const [leadsPerPage, setLeadsPerPage] = useState(50);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [selectedMappedLeads, setSelectedMappedLeads] = useState([]);
  const [showPasswordConfirmModal, setShowPasswordConfirmModal] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pendingDeleteAction, setPendingDeleteAction] = useState(null);

  // CRUD Editing Modals/States
  const [editingCard, setEditingCard] = useState(null);
  const [editingAgent, setEditingAgent] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);
  const [selectedLeadDetails, setSelectedLeadDetails] = useState(null);
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [editLeadForm, setEditLeadForm] = useState(null);
  const [customParams, setCustomParams] = useState([]);
  
  // MIS & Dashboard States
  const [misStats, setMisStats] = useState(null);
  const [loadingMISStats, setLoadingMISStats] = useState(false);
  const [showUploadMISModal, setShowUploadMISModal] = useState(false);
  const [misFile, setMisFile] = useState(null);
  const [misUploadResult, setMisUploadResult] = useState(null);
  const [showMISResultModal, setShowMISResultModal] = useState(false);
  const [selectedMappedLead, setSelectedMappedLead] = useState(null);
  
  // Dashboard Filters
  const [dashCreatedDate, setDashCreatedDate] = useState('');
  const [dashDateTo, setDashDateTo] = useState('');
  const [dashCardType, setDashCardType] = useState('');
  const [dashState, setDashState] = useState('');
  const [dashKycType, setDashKycType] = useState('');
  const [dashIpaStatus, setDashIpaStatus] = useState('');
  const [dashFinalDecision, setDashFinalDecision] = useState('');
  const [dashCardName, setDashCardName] = useState('');
  const [dashCustomerType, setDashCustomerType] = useState('');
  const [dashCurrentStage, setDashCurrentStage] = useState('');
  const [dashCardActivation, setDashCardActivation] = useState('');
  const [dashVkycStatus, setDashVkycStatus] = useState('');
  const [dashAgent, setDashAgent] = useState('');
  const [dashSourceType, setDashSourceType] = useState('');
  const [dashSearch, setDashSearch] = useState('');
  const [dashFiltersExpanded, setDashFiltersExpanded] = useState(false);
  
  const [newBankInput, setNewBankInput] = useState('');
  const [newCardForm, setNewCardForm] = useState({ name: '', bank: '', category: 'Offline', ad_id: '', utm_internal: '', description: '', redirect_url_template: '', display_order: 1, active: true, card_locations: [] });
  const [newAgentForm, setNewAgentForm] = useState({ id: '', name: '', phone: '', email: '', username: '', password: '', status: 'active', locations: [] });
  const [newLocName, setNewLocName] = useState('');

  const [message, setMessage] = useState({ text: '', type: 'success' });
  const idleTimerRef = useRef(null);

  const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173') ? 'http://localhost:5000/api' : '/api';

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

  const fetchLeads = async (page = 1, limit = 50) => {
    if (!token) return;
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: searchTerm,
        card: filterCard,
        source: filterSource,
        startDate: filterStartDate,
        endDate: filterEndDate
      });
      const res = await fetch(`${API_URL}/leads?${queryParams.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
        setCurrentPage(data.page || 1);
        setTotalPages(data.totalPages || 1);
        setTotalLeadsCount(data.total || 0);
        setTodaysLeadsCount(data.todaysCount || 0);
      }
    } catch (err) {
      console.error('Error fetching leads page:', err);
    }
  };

  const fetchMISStats = async () => {
    if (!token) return;
    setLoadingMISStats(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const res = await fetch(`${API_URL}/leads/mis-stats`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMisStats(data);
      }
    } catch (err) {
      console.error('Error fetching MIS stats:', err);
    } finally {
      setLoadingMISStats(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'leads_dashboard' && isAuthenticated && token) {
      fetchMISStats();
    }
  }, [activeTab, isAuthenticated, token]);

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: leadsPerPage.toString(),
        search: searchTerm,
        card: filterCard,
        source: filterSource,
        startDate: filterStartDate,
        endDate: filterEndDate
      });

      const [leadsRes, cardsRes, agentsRes, locsRes, settingsRes, baileysRes] = await Promise.all([
        fetch(`${API_URL}/leads?${queryParams.toString()}`, { headers }),
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

      setLeads(leadsData.leads || []);
      setCurrentPage(leadsData.page || 1);
      setTotalPages(leadsData.totalPages || 1);
      setTotalLeadsCount(leadsData.total || 0);
      setTodaysLeadsCount(leadsData.todaysCount || 0);

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

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCard, filterSource, filterStartDate, filterEndDate]);

  // Refetch leads when pagination/filters change
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchLeads(currentPage, leadsPerPage);
    }
  }, [currentPage, leadsPerPage, searchTerm, filterCard, filterSource, filterStartDate, filterEndDate, isAuthenticated, token]);

  const showToast = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setAuthError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
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
        const decoded = decodeToken(data.token);
        setCanDelete(decoded ? !!decoded.canDelete : false);
        setTimeLeft(0);
      } else {
        setAuthError(data.error || 'Access denied');
        if (data.timeLeft) {
          setTimeLeft(data.timeLeft);
        }
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
    setCanDelete(false);
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

  const handleSelectMappedLead = (id) => {
    if (selectedMappedLeads.includes(id)) {
      setSelectedMappedLeads(selectedMappedLeads.filter(x => x !== id));
    } else {
      setSelectedMappedLeads([...selectedMappedLeads, id]);
    }
  };

  const handleSelectAllMappedLeads = (filteredList) => {
    if (selectedMappedLeads.length === filteredList.length) {
      setSelectedMappedLeads([]);
    } else {
      setSelectedMappedLeads(filteredList.map(l => l.id));
    }
  };

  const triggerDeleteMappedLeads = (ids, type = 'single') => {
    setPendingDeleteAction({ type, ids });
    setConfirmPassword('');
    setShowPasswordConfirmModal(true);
  };

  const handleConfirmDeleteMappedLeads = async () => {
    if (confirmPassword !== 'Lakshay@123') {
      showToast('Incorrect admin password.', 'error');
      return;
    }

    if (!pendingDeleteAction || !pendingDeleteAction.ids || pendingDeleteAction.ids.length === 0) return;

    try {
      if (pendingDeleteAction.type === 'single') {
        const id = pendingDeleteAction.ids[0];
        await apiFetch(`${API_URL}/leads/${id}/unmap`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'x-admin-password': 'Lakshay@123'
          }
        });
      } else {
        await apiFetch(`${API_URL}/leads/unmap-bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-admin-password': 'Lakshay@123'
          },
          body: JSON.stringify({ ids: pendingDeleteAction.ids })
        });
      }
      
      showToast('Successfully unmapped lead(s) from dashboard.');
      setSelectedMappedLeads([]);
      setShowPasswordConfirmModal(false);
      setPendingDeleteAction(null);
      
      // Refresh both leads data and dashboard stats
      loadAllAdminData();
      fetchMISStats();
    } catch (err) {
      showToast(err.message || 'Unmapping failed.', 'error');
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
      utm_internal: lead.utm_internal || '',
      redirect_url: lead.redirect_url || '',
      has_credit_card: lead.has_credit_card || '',
      pincode: lead.pincode || '',
      monthly_income: lead.monthly_income || ''
    });

    const standardKeys = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 
      'utm_channel', 'utm_category', 'utm_info', 'utm_creative_format', 
      'utm_id', 'utm_creative', 'ad_id', 'utm_internal', 'utm_keyword', 'utm_matchtype', 'utm_network', 'utm_placement',
      'utm_device', 'utm_location', 'gbraid', 'wbraid', 'landing_page', 'first_landing_page', 'referrer',
      'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id',
      '_fbc', '_fbp', 'has_credit_card', 'pincode', 'monthly_income'
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
        'utm_id', 'utm_creative', 'ad_id', 'utm_internal', 'utm_keyword', 'utm_matchtype', 'utm_network', 'utm_placement',
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
      setNewCardForm({ name: '', bank: '', category: 'Offline', ad_id: '', utm_internal: '', description: '', redirect_url_template: '', display_order: 1, active: true, card_locations: [] });
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
    { value: 'utm_internal', label: 'UTM Internal (utm_internal)' },
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
    { value: 'utm_params', label: 'All Tracking Parameters (JSON)' },
    { value: 'has_credit_card', label: 'Already Has Credit Card?' },
    { value: 'pincode', label: 'Residence Pincode' },
    { value: 'monthly_income', label: 'Monthly Income' }
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
      { id: "utm_internal", header: "UTM Internal (utm_internal)", source: "utm_internal" },
      { id: "utm_keyword", header: "UTM Keyword (utm_keyword)", source: "utm_keyword" },
      { id: "utm_matchtype", header: "UTM Matchtype (utm_matchtype)", source: "utm_matchtype" },
      { id: "utm_network", header: "UTM Network (utm_network)", source: "utm_network" },
      { id: "utm_placement", header: "UTM Placement (utm_placement)", source: "utm_placement" },
      { id: "utm_device", header: "UTM Device (utm_device)", source: "utm_device" },
      { id: "utm_location", header: "UTM Location (utm_location)", source: "utm_location" },
      { id: "gbraid", header: "GBRAID (gbraid)", source: "gbraid" },
      { id: "wbraid", header: "WBRAID (wbraid)", source: "wbraid" },
      { id: "landing_page", header: "Landing Page (landing_page)", source: "landing_page" },
      { id: "first_landing_page", header: "Redirect URL (redirect_url)", source: "redirect_url" },
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
      { id: "redirect_url", header: "Redirect URL", source: "redirect_url" },
      { id: "has_credit_card", header: "Already Has Credit Card?", source: "has_credit_card" },
      { id: "pincode", header: "Residence Pincode", source: "pincode" },
      { id: "monthly_income", header: "Monthly Income", source: "monthly_income" }
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

  const getBankOptions = () => {
    if (settings && settings.card_manager_banks) {
      return settings.card_manager_banks.split(',').map(b => b.trim()).filter(Boolean);
    }
    return ['HDFC', 'SBI'];
  };

  const handleSaveBanks = async (updatedBanks) => {
    setIsSubmitting(true);
    try {
      const banksStr = updatedBanks.join(',');
      await apiFetch(`${API_URL}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          card_manager_banks: banksStr
        })
      });
      setSettings(prev => ({ ...prev, card_manager_banks: banksStr }));
      showToast('Bank options updated successfully.');
    } catch (err) {
      showToast(err.message || 'Failed to save bank options.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportMISLeads = (dataToExport) => {
    if (!dataToExport || dataToExport.length === 0) {
      showToast('No data available to export.', 'error');
      return;
    }

    // Define columns to export
    const columns = [
      { header: 'URN', getValue: l => l.urn },
      { header: 'Client Name', getValue: l => l.full_name },
      { header: 'Phone', getValue: l => l.phone || 'N/A' },
      { header: 'Email', getValue: l => l.email || 'N/A' },
      { header: 'Agent Name', getValue: l => l.agent_name || 'Staff' },
      { header: 'Mapping Status', getValue: l => l.mis_status },
      { header: 'Mapping Date', getValue: l => formatDateTime(l.mis_mapped_at) },
      
      // MIS details
      { header: 'Bank Reference Number', getValue: l => l.mis_data?.bank_reference_number || 'N/A' },
      { header: 'Application Submit Date/Time', getValue: l => formatMISValue(l.mis_data?.application_submit_date_time, 'application_submit_date_time') },
      { header: 'Customer Type', getValue: l => l.mis_data?.customer_type || 'N/A' },
      { header: 'State', getValue: l => l.mis_data?.state || 'N/A' },
      { header: 'IPA Status', getValue: l => l.mis_data?.ipa_status || 'N/A' },
      { header: 'DAP Final Flag', getValue: l => l.mis_data?.dap_final_flag || 'N/A' },
      { header: 'Dropoff Reason', getValue: l => l.mis_data?.dropoff_reason || 'N/A' },
      { header: 'VKYC Status', getValue: l => l.mis_data?.vkyc_status || 'N/A' },
      { header: 'KYC Type', getValue: l => l.mis_data?.kyc_type || 'N/A' },
      { header: 'VKYC Expiry Date', getValue: l => l.mis_data?.vkyc_expiry_date || 'N/A' },
      { header: 'Promo Code', getValue: l => l.mis_data?.promo_code || 'N/A' },
      { header: 'Final Decision', getValue: l => l.mis_data?.final_decision || 'N/A' },
      { header: 'Final Decision Date', getValue: l => l.mis_data?.final_decision_date || 'N/A' },
      { header: 'Current Stage', getValue: l => l.mis_data?.current_stage || 'N/A' },
      { header: 'Curable Flag', getValue: l => l.mis_data?.curable_flag || 'N/A' },
      { header: 'Company Name', getValue: l => l.mis_data?.company_name || 'N/A' },
      { header: 'BKYC Status', getValue: l => l.mis_data?.bkyc_status || 'N/A' },
      { header: 'KYC Status', getValue: l => l.mis_data?.kyc_status || 'N/A' },
      { header: 'Decision Month', getValue: l => l.mis_data?.decision_month || 'N/A' },
      { header: 'Decline Description', getValue: l => l.mis_data?.decline_description || 'N/A' },
      { header: 'Decline Type', getValue: l => l.mis_data?.decline_type || 'N/A' },
      { header: 'Card Name', getValue: l => l.mis_data?.card_name || 'N/A' },
      { header: 'Card Type', getValue: l => l.mis_data?.card_type || 'N/A' },
      { header: 'Card Activation Status', getValue: l => l.mis_data?.card_activation_status || 'N/A' },
      { header: 'Source Type', getValue: l => l.mis_data?.source_type || 'N/A' },
      { header: 'KYC Completion Date', getValue: l => l.mis_data?.kyc_completion_date || 'N/A' }
    ];

    // Generate CSV contents
    const headersLine = columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',');
    const rowsLines = dataToExport.map(lead => {
      return columns.map(c => {
        const val = String(c.getValue(lead) || '');
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = [headersLine, ...rowsLines].join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Make filename include date range if present
    let dateRangeSuffix = '';
    if (dashCreatedDate || dashDateTo) {
      const from = dashCreatedDate ? dashCreatedDate : 'start';
      const to = dashDateTo ? dashDateTo : 'end';
      dateRangeSuffix = `_${from}_to_${to}`;
    }
    
    link.href = url;
    link.setAttribute('download', `mis_mapped_leads${dateRangeSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    showToast(`Exported ${dataToExport.length} leads successfully.`, 'success');
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
  const filteredLeads = leads;

  // Calculate Metrics
  const todayStr = getLocalDateString(new Date());
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
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="form-input" 
                  placeholder="Enter password" 
                  value={adminPasswordInput} 
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  style={{ paddingRight: '45px' }}
                  required 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0
                  }}
                  title={showPassword ? "Hide Password" : "Show Password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {authError && (
              <div style={{ background: 'rgba(209, 67, 67, 0.1)', border: '1px solid rgba(209, 67, 67, 0.2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', color: 'var(--err)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                {authError}
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading || timeLeft > 0}>
              {timeLeft > 0 ? `Blocked (Try again in ${formatTime(timeLeft)})` : (loading ? 'Validating credentials...' : 'Enter Admin Room')}
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
        background: 'var(--glass-bg)',
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
            className={`nav-link ${activeTab === 'leads_dashboard' ? 'active' : ''}`} 
            onClick={() => setActiveTab('leads_dashboard')}
            style={{ 
              padding: '0.5rem 0.85rem', 
              fontSize: '0.85rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              border: activeTab === 'leads_dashboard' ? '1px solid var(--line)' : '1px solid transparent', 
              background: activeTab === 'leads_dashboard' ? 'var(--paper-2)' : 'transparent', 
              color: activeTab === 'leads_dashboard' ? 'var(--ink)' : 'var(--muted)', 
              cursor: 'pointer', 
              transition: 'all 0.2s', 
              borderRadius: 'var(--radius-sm)' 
            }}
          >
            <TrendingUp size={14} /> Leads Dashboard
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
            className="theme-toggle-btn" 
            onClick={toggleTheme} 
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            style={{ padding: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '34px', width: '34px' }}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
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
              className={`nav-link ${activeTab === 'leads_dashboard' ? 'active' : ''}`} 
              onClick={() => { setActiveTab('leads_dashboard'); setShowMobileMenu(false); }}
            >
              <TrendingUp size={14} /> Leads Dashboard
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
      {activeTab === 'leads' && (
        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem', color: 'var(--text-light)' }}>Admin Control Room</h2>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Configure credit cards catalog, dynamic destination links, agents, kiosks and monitor client logs.</p>
        </div>
      )}

      {/* Metrics Strips */}
      {activeTab === 'leads' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '3px solid hsl(var(--primary))' }}>
            <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Total Leads</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0.25rem 0' }}>{totalLeadsCount}</div>
            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Registered in Database</div>
          </div>
          <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '3px solid hsl(var(--secondary))' }}>
            <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Leads Today</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0.25rem 0', color: 'hsl(var(--secondary))' }}>{todaysLeadsCount}</div>
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
      )}

      {/* TAB CONTENT */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem', color: 'hsl(var(--text-muted))' }}>Syncing database logs...</div>
      ) : (
        <div>
          
          {/* LEADS TAB */}
          {activeTab === 'leads' && (
            <div className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.3rem' }}>Leads Log ({totalLeadsCount})</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {canDelete && selectedLeads.length > 0 && (
                    <button onClick={handleBulkDeleteLeads} className="btn-secondary" style={{ background: 'rgba(209, 67, 67, 0.15)', color: 'var(--err)', border: '1px solid rgba(209, 67, 67, 0.2)' }}>
                      <Trash2 size={16} /> Delete Selected ({selectedLeads.length})
                    </button>
                  )}
                   <button onClick={handleCsvExport} className="btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}>
                    <Download size={16} /> Export to CSV
                  </button>
                  <button onClick={() => setShowUploadMISModal(true)} className="btn-secondary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Upload size={16} /> Upload MIS
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
                      {canDelete && (
                        <th style={{ width: '40px' }}>
                          <input 
                            type="checkbox" 
                            checked={filteredLeads.length > 0 && selectedLeads.length === filteredLeads.length} 
                            onChange={handleSelectAllLeads}
                            style={{ accentColor: 'hsl(var(--primary))' }}
                          />
                        </th>
                      )}
                      <th>URN No.</th>
                      <th>Date & Time</th>
                      <th>Name</th>
                      <th>WhatsApp No.</th>
                      <th>Card Selection</th>
                      <th>Email</th>
                      <th>Employment</th>
                      <th>Already Has Card?</th>
                      <th>Pincode</th>
                      <th>Monthly Income</th>
                      <th>Source</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.length > 0 ? (
                      filteredLeads.map(l => (
                        <tr key={l.id}>
                          {canDelete && (
                            <td>
                              <input 
                                type="checkbox" 
                                checked={selectedLeads.includes(l.id)} 
                                onChange={() => handleSelectLead(l.id)}
                                style={{ accentColor: 'hsl(var(--primary))' }}
                              />
                            </td>
                          )}
                          <td><span className="badge badge-info" style={{ cursor: 'pointer' }} onClick={() => handleViewLead(l)}>{l.urn}</span></td>
                          <td>{formatDateTime(l.created_at)}</td>
                          <td style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => handleViewLead(l)}>{l.full_name}</td>
                          <td>{l.phone}</td>
                          <td>{l.card_name} <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>({l.card_bank})</span></td>
                          <td>{l.email || '-'}</td>
                          <td>{l.employment || '-'}</td>
                          <td>
                            <span className={`badge ${l.has_credit_card === 'Yes' ? 'badge-success' : 'badge-secondary'}`}>
                              {l.has_credit_card || '-'}
                            </span>
                          </td>
                          <td><code>{l.pincode || '-'}</code></td>
                          <td>{l.monthly_income ? `₹${l.monthly_income}` : '-'}</td>
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
                            {canDelete && (
                              <button onClick={() => handleSingleDeleteLead(l.id)} style={{ color: 'var(--err)', background: 'none', border: 'none', cursor: 'pointer' }} title="Delete lead">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={canDelete ? 13 : 12} style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--text-muted))' }}>
                          No leads captured matching current filter query parameters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginTop: '1.25rem', 
                padding: '1rem', 
                background: 'var(--paper-2)', 
                border: '1px solid var(--line)', 
                borderRadius: 'var(--radius-md)',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Leads per page:</span>
                  <select 
                    className="form-select" 
                    value={leadsPerPage} 
                    onChange={(e) => {
                      setLeadsPerPage(parseInt(e.target.value, 10));
                      setCurrentPage(1);
                    }}
                    style={{ width: '80px', padding: '0.25rem 0.5rem', fontSize: '0.85rem', height: '32px' }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                </div>
                
                <div style={{ fontSize: '0.85rem', color: 'var(--ink)', fontWeight: 600 }}>
                  Showing {totalLeadsCount > 0 ? (currentPage - 1) * leadsPerPage + 1 : 0} - {Math.min(currentPage * leadsPerPage, totalLeadsCount)} of {totalLeadsCount} leads
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                    disabled={currentPage === 1}
                    className="btn-secondary"
                    style={{ 
                      padding: '0.4rem 0.8rem', 
                      fontSize: '0.8rem', 
                      height: '32px', 
                      opacity: currentPage === 1 ? 0.5 : 1,
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Previous
                  </button>
                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0 0.5rem' }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                    disabled={currentPage === totalPages}
                    className="btn-secondary"
                    style={{ 
                      padding: '0.4rem 0.8rem', 
                      fontSize: '0.8rem', 
                      height: '32px', 
                      opacity: currentPage === totalPages ? 0.5 : 1,
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* LEADS DASHBOARD TAB */}
          {activeTab === 'leads_dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', textAlign: 'left' }}>
              {/* Dashboard Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Leads Mapping Analytics</h2>
                  <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>
                    Visual analytics, funnel conversion, and geographical mapping from bank MIS uploads.
                  </p>
                </div>
                <button 
                  onClick={fetchMISStats} 
                  className="btn-secondary"
                  disabled={loadingMISStats}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
                >
                  <RefreshCw size={14} className={loadingMISStats ? 'spin' : ''} /> Sync Dashboard
                </button>
              </div>

              {/* Filters Panel */}
              {(() => {
                const allLeads = misStats?.mappedLeadsList || [];
                const activeFilterCount = [dashCreatedDate, dashDateTo, dashCardType, dashState, dashKycType, dashIpaStatus, dashFinalDecision, dashCardName, dashCustomerType, dashCurrentStage, dashCardActivation, dashVkycStatus, dashAgent, dashSourceType, dashSearch].filter(Boolean).length;

                const mkOpts = (field) => Array.from(new Set(allLeads.map(l => l.mis_data?.[field]).filter(v => v && String(v).trim()))).sort();
                const mkAgentOpts = () => Array.from(new Set(allLeads.map(l => l.agent_name).filter(Boolean))).sort();

                const filterSelectStyle = { padding: '0.4rem 0.6rem', fontSize: '0.78rem' };
                const filterLabelStyle = { fontSize: '0.72rem', marginBottom: '3px', color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.3px' };

                const FilterSelect = ({ label, value, onChange, options, placeholder }) => (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={filterLabelStyle}>{label}</label>
                    <select className="form-select" style={filterSelectStyle} value={value} onChange={(e) => onChange(e.target.value)}>
                      <option value="">{placeholder}</option>
                      {options.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                );

                return (
                  <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Filter size={14} style={{ color: 'var(--gold)' }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink)' }}>Filters (Dynamic Re-calculation)</span>
                        {activeFilterCount > 0 && (
                          <span style={{
                            background: 'var(--gold)', color: '#fff', fontSize: '0.65rem', fontWeight: 800,
                            padding: '0.15rem 0.5rem', borderRadius: '10px', minWidth: '20px', textAlign: 'center'
                          }}>{activeFilterCount}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          onClick={() => setDashFiltersExpanded(!dashFiltersExpanded)}
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          {dashFiltersExpanded ? 'Less Filters' : 'More Filters'}
                          <span style={{ fontSize: '0.6rem', transform: dashFiltersExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                        </button>
                        <button
                          onClick={() => {
                            setDashCreatedDate(''); setDashDateTo(''); setDashCardType(''); setDashState('');
                            setDashKycType(''); setDashIpaStatus(''); setDashFinalDecision(''); setDashCardName('');
                            setDashCustomerType(''); setDashCurrentStage(''); setDashCardActivation('');
                            setDashVkycStatus(''); setDashAgent(''); setDashSourceType(''); setDashSearch('');
                          }}
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem', opacity: activeFilterCount > 0 ? 1 : 0.5 }}
                          disabled={activeFilterCount === 0}
                        >
                          Reset All
                        </button>
                      </div>
                    </div>

                    {/* Search bar */}
                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Search by URN, Name, or Bank Reference..."
                          value={dashSearch}
                          onChange={(e) => setDashSearch(e.target.value)}
                          style={{ paddingLeft: '2rem', padding: '0.45rem 0.6rem 0.45rem 2rem', fontSize: '0.8rem', width: '100%' }}
                        />
                      </div>
                    </div>

                    {/* Row 1: Primary filters (always visible) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={filterLabelStyle}>Date From (MIS)</label>
                        <input type="date" className="form-input" style={filterSelectStyle} value={dashCreatedDate} onChange={(e) => setDashCreatedDate(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={filterLabelStyle}>Date To (MIS)</label>
                        <input type="date" className="form-input" style={filterSelectStyle} value={dashDateTo} onChange={(e) => setDashDateTo(e.target.value)} />
                      </div>
                      <FilterSelect label="Card Type" value={dashCardType} onChange={setDashCardType} options={mkOpts('card_type')} placeholder="All Card Types" />
                      <FilterSelect label="State" value={dashState} onChange={setDashState} options={mkOpts('state')} placeholder="All States" />
                      <FilterSelect label="IPA Status" value={dashIpaStatus} onChange={setDashIpaStatus} options={mkOpts('ipa_status')} placeholder="All IPA" />
                      <FilterSelect label="Final Decision" value={dashFinalDecision} onChange={setDashFinalDecision} options={mkOpts('final_decision')} placeholder="All Decisions" />
                    </div>

                    {/* Row 2: Extended filters (collapsible) */}
                    {dashFiltersExpanded && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', alignItems: 'end', marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--line)' }}>
                        <FilterSelect label="Card Name" value={dashCardName} onChange={setDashCardName} options={mkOpts('card_name')} placeholder="All Cards" />
                        <FilterSelect label="KYC Type" value={dashKycType} onChange={setDashKycType} options={mkOpts('kyc_type')} placeholder="All KYC" />
                        <FilterSelect label="Customer Type" value={dashCustomerType} onChange={setDashCustomerType} options={mkOpts('customer_type')} placeholder="All Customers" />
                        <FilterSelect label="Current Stage" value={dashCurrentStage} onChange={setDashCurrentStage} options={mkOpts('current_stage')} placeholder="All Stages" />
                        <FilterSelect label="Card Activation" value={dashCardActivation} onChange={setDashCardActivation} options={mkOpts('card_activation_status')} placeholder="All Status" />
                        <FilterSelect label="VKYC Status" value={dashVkycStatus} onChange={setDashVkycStatus} options={mkOpts('vkyc_status')} placeholder="All VKYC" />
                        <FilterSelect label="Agent" value={dashAgent} onChange={setDashAgent} options={mkAgentOpts()} placeholder="All Agents" />
                        <FilterSelect label="Source Type" value={dashSourceType} onChange={setDashSourceType} options={mkOpts('source_type')} placeholder="All Sources" />
                      </div>
                    )}
                  </div>
                );
              })()}

              {loadingMISStats || !misStats ? (
                <div style={{ textAlign: 'center', padding: '5rem', color: 'hsl(var(--text-muted))' }} className="glass-panel">
                  Loading dashboard charts...
                </div>
              ) : (() => {
                const list = misStats.mappedLeadsList || [];
                const filtered = list.filter(lead => {
                  // Text search (URN, Name, Bank Ref)
                  if (dashSearch) {
                    const s = dashSearch.toLowerCase();
                    const urn = String(lead.urn || '').toLowerCase();
                    const name = String(lead.full_name || '').toLowerCase();
                    const bankRef = String(lead.mis_data?.bank_reference_number || '').toLowerCase();
                    if (!urn.includes(s) && !name.includes(s) && !bankRef.includes(s)) return false;
                  }

                  // Date range filter
                  if (dashCreatedDate || dashDateTo) {
                    const submitDateVal = lead.mis_data?.application_submit_date_time || '';
                    if (submitDateVal) {
                      let parsedDate = null;
                      const numVal = parseFloat(submitDateVal);
                      if (!isNaN(numVal) && numVal > 30000 && numVal < 60000) {
                        parsedDate = new Date(Math.round((numVal - 25569) * 86400 * 1000));
                      } else {
                        parsedDate = new Date(submitDateVal);
                      }
                      
                      if (parsedDate && !isNaN(parsedDate.getTime())) {
                        const dateStr = parsedDate.toISOString().split('T')[0];
                        if (dashCreatedDate && dateStr < dashCreatedDate) return false;
                        if (dashDateTo && dateStr > dashDateTo) return false;
                      } else {
                        return false;
                      }
                    } else {
                      return false;
                    }
                  }
                  if (dashCardType && lead.mis_data?.card_type !== dashCardType) return false;
                  if (dashState && lead.mis_data?.state?.toLowerCase() !== dashState.toLowerCase()) return false;
                  if (dashKycType && lead.mis_data?.kyc_type !== dashKycType) return false;
                  if (dashIpaStatus && lead.mis_data?.ipa_status !== dashIpaStatus) return false;
                  if (dashFinalDecision && lead.mis_data?.final_decision !== dashFinalDecision) return false;
                  if (dashCardName && lead.mis_data?.card_name !== dashCardName) return false;
                  if (dashCustomerType && lead.mis_data?.customer_type !== dashCustomerType) return false;
                  if (dashCurrentStage && lead.mis_data?.current_stage !== dashCurrentStage) return false;
                  if (dashCardActivation && lead.mis_data?.card_activation_status !== dashCardActivation) return false;
                  if (dashVkycStatus && lead.mis_data?.vkyc_status !== dashVkycStatus) return false;
                  if (dashAgent && lead.agent_name !== dashAgent) return false;
                  if (dashSourceType && lead.mis_data?.source_type !== dashSourceType) return false;
                  return true;
                });

                const totalSubmit = filtered.length;
                const approvedCount = filtered.filter(l => l.mis_status === 'Approved').length;
                const rejectedCount = filtered.filter(l => l.mis_status === 'Rejected').length;
                const pendingCount = filtered.filter(l => l.mis_status === 'Pending').length;
                const approvalRate = totalSubmit > 0 ? ((approvedCount / totalSubmit) * 100).toFixed(1) : '0';

                const funnelIpa = filtered.filter(l => {
                  const ipa = String(l.mis_data?.ipa_status || '').toLowerCase();
                  return ipa.includes('approve') || ipa.includes('success');
                }).length;
                const funnelKyc = filtered.filter(l => {
                  const ks = String(l.mis_data?.kyc_status || '').toLowerCase();
                  const vs = String(l.mis_data?.vkyc_status || '').toLowerCase();
                  const kt = String(l.mis_data?.kyc_type || '').toLowerCase();
                  return ks.includes('success') || ks.includes('complete') || vs.includes('success') || vs.includes('complete') || ks.includes('biokyc') || kt.includes('biokyc');
                }).length;
                const funnelDecision = filtered.filter(l => {
                  const dec = String(l.mis_data?.final_decision || '').toLowerCase();
                  return dec.includes('approve') || dec.includes('success');
                }).length;
                const funnelActive = filtered.filter(l => {
                  const act = String(l.mis_data?.card_activation_status || '').toLowerCase();
                  return act.includes('active') || act === 'yes';
                }).length;

                const ipaApproved = filtered.filter(l => {
                  const ipa = String(l.mis_data?.ipa_status || '').toLowerCase();
                  return ipa.includes('approve') || ipa.includes('success');
                }).length;
                const ipaDeclined = filtered.filter(l => {
                  const ipa = String(l.mis_data?.ipa_status || '').toLowerCase();
                  return ipa.includes('decline') || ipa.includes('reject') || ipa.includes('cancel');
                }).length;

                const kycDist = {};
                filtered.forEach(l => {
                  const k = l.mis_data?.kyc_type || 'Unknown';
                  kycDist[k] = (kycDist[k] || 0) + 1;
                });

                const srcDist = {};
                filtered.forEach(l => {
                  let s = String(l.mis_data?.source_type || '').trim();
                  if (!s || s === '-') s = 'Blank';
                  srcDist[s] = (srcDist[s] || 0) + 1;
                });

                const cardTypeDist = {};
                filtered.forEach(l => {
                  const ct = l.mis_data?.card_type || 'Unknown';
                  cardTypeDist[ct] = (cardTypeDist[ct] || 0) + 1;
                });

                const custTypeDist = {};
                filtered.forEach(l => {
                  const c = l.mis_data?.customer_type || 'Unknown';
                  custTypeDist[c] = (custTypeDist[c] || 0) + 1;
                });

                const actDist = {};
                filtered.forEach(l => {
                  const a = l.mis_data?.card_activation_status || 'Inactive/Unknown';
                  actDist[a] = (actDist[a] || 0) + 1;
                });

                const pinDist = {};
                filtered.forEach(l => {
                  const p = l.mis_data?.PIN_CODE || l.mis_data?.pin_code || l.pincode || 'Unknown';
                  pinDist[p] = (pinDist[p] || 0) + 1;
                });
                const topPincodes = Object.entries(pinDist)
                  .map(([pincode, count]) => ({ pincode, count }))
                  .sort((a,b) => b.count - a.count)
                  .slice(0, 50);

                const prodDist = {};
                filtered.forEach(l => {
                  const n = l.mis_data?.card_name || 'Unknown';
                  prodDist[n] = (prodDist[n] || 0) + 1;
                });

                return (
                  <>
                    {/* KPI SUMMARY CARDS */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                      <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--gold)' }}>
                        <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Total Mapped Applications</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0' }}>{totalSubmit}</div>
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Matched from MIS</div>
                      </div>
                      <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--mint)' }}>
                        <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Approved rate</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--mint)' }}>{approvalRate}%</div>
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{approvedCount} of {totalSubmit} approved</div>
                      </div>
                      <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--err)' }}>
                        <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Rejected applications</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--err)' }}>{rejectedCount}</div>
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Declined by partner bank</div>
                      </div>
                      <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #E0A82E' }}>
                        <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Pending status</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--gold-deep)' }}>{pendingCount}</div>
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>In verification stage</div>
                      </div>
                    </div>

                    {/* 9 VISUALS GRID */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                      
                      {/* Visual 1: Funnel Chart */}
                      <div className="glass-panel" style={{ padding: '2rem', gridColumn: 'span 2', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.5rem', width: '100%', textAlign: 'left' }}>Conversion Funnel Stages (%)</h4>
                        <div style={{ width: '100%', maxWidth: '600px', display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
                          <svg width="600" height="300" viewBox="0 0 600 300" style={{ display: 'block', overflow: 'visible' }}>
                            {(() => {
                              const stages = [
                                { name: 'Total Application Submit', count: totalSubmit, pct: 100, color: 'var(--ink)' },
                                { name: 'IPA Approved', count: funnelIpa, pct: totalSubmit > 0 ? Math.round((funnelIpa / totalSubmit) * 100) : 0, color: 'hsl(var(--primary))' },
                                { name: 'KYC Success', count: funnelKyc, pct: totalSubmit > 0 ? Math.round((funnelKyc / totalSubmit) * 100) : 0, color: 'var(--gold-deep)' },
                                { name: 'Final Decision (Approve)', count: funnelDecision, pct: totalSubmit > 0 ? Math.round((funnelDecision / totalSubmit) * 100) : 0, color: 'var(--mint)' },
                                { name: 'Card Activation Status (TXN ACTIVE)', count: funnelActive, pct: totalSubmit > 0 ? Math.round((funnelActive / totalSubmit) * 100) : 0, color: '#10b981' }
                              ];

                              return stages.map((stage, idx) => {
                                const yStart = idx * 60;
                                const yEnd = (idx + 1) * 60;
                                const yCenter = yStart + 30;

                                const pctTop = stage.pct;
                                const pctBottom = (idx < 4) ? stages[idx + 1].pct : Math.max(15, stage.pct * 0.7);

                                // Map percentage to width: range from 60px to 240px
                                const wTop = (pctTop / 100) * 180 + 60;
                                const wBottom = (pctBottom / 100) * 180 + 60;

                                const xCenter = 450;
                                const xTopLeft = xCenter - wTop / 2;
                                const xTopRight = xCenter + wTop / 2;
                                const xBottomLeft = xCenter - wBottom / 2;
                                const xBottomRight = xCenter + wBottom / 2;

                                const pathD = `M ${xTopLeft} ${yStart} L ${xTopRight} ${yStart} L ${xBottomRight} ${yEnd} L ${xBottomLeft} ${yEnd} Z`;

                                return (
                                  <g key={idx}>
                                    {/* Sloped connected block with glassmorphic strokes */}
                                    <path 
                                      d={pathD} 
                                      fill={stage.color} 
                                      stroke="var(--paper)" 
                                      strokeWidth="1.5" 
                                      style={{ transition: 'all 0.5s ease-in-out' }}
                                    />
                                    
                                    {/* Overlay percentage text */}
                                    <text 
                                      x={xCenter} 
                                      y={yCenter + 4} 
                                      fontSize="11" 
                                      fontWeight="bold" 
                                      fill="#ffffff" 
                                      textAnchor="middle"
                                      style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                                    >
                                      {stage.pct}%
                                    </text>

                                    {/* Left Side description label */}
                                    <text x="20" y={yCenter - 4} fontSize="11" fontWeight="700" fill="var(--ink)">
                                      {stage.name}
                                    </text>
                                    <text x="20" y={yCenter + 12} fontSize="10.5" fontWeight="600" fill="hsl(var(--text-muted))">
                                      {stage.count} Leads | {stage.pct}%
                                    </text>

                                    {/* Dotted connecting guideline */}
                                    <line 
                                      x1="260" 
                                      y1={yCenter} 
                                      x2={xCenter - (wTop + wBottom)/4 - 10} 
                                      y2={yCenter} 
                                      stroke="var(--line)" 
                                      strokeWidth="1" 
                                      strokeDasharray="3,3" 
                                      opacity="0.6"
                                    />
                                  </g>
                                );
                              });
                            })()}
                          </svg>
                        </div>
                      </div>

                      {/* Visual 2: Pie Chart - IPA Approved vs Declined */}
                      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>IPA Decision Breakdown</h4>
                        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
                          <svg width="120" height="120" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--line)" strokeWidth="4.2" />
                            {totalSubmit > 0 && (() => {
                              const ipaAppPct = (ipaApproved / totalSubmit) * 100;
                              const ipaDecPct = (ipaDeclined / totalSubmit) * 100;
                              const ipaOthPct = 100 - ipaAppPct - ipaDecPct;
                              return (
                                <>
                                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--mint)" strokeWidth="4.2" strokeDasharray={`${ipaAppPct} ${100 - ipaAppPct}`} strokeDashoffset="25" />
                                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--err)" strokeWidth="4.2" strokeDasharray={`${ipaDecPct} ${100 - ipaDecPct}`} strokeDashoffset={25 - ipaAppPct} />
                                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--line)" strokeWidth="4.2" strokeDasharray={`${ipaOthPct} ${100 - ipaOthPct}`} strokeDashoffset={25 - ipaAppPct - ipaDecPct} />
                                </>
                              );
                            })()}
                          </svg>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ height: '10px', width: '10px', borderRadius: '50%', background: 'var(--mint)' }} />
                              <span>Approved: {ipaApproved}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ height: '10px', width: '10px', borderRadius: '50%', background: 'var(--err)' }} />
                              <span>Declined: {ipaDeclined}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ height: '10px', width: '10px', borderRadius: '50%', background: 'var(--line)' }} />
                              <span>Other/Pending: {totalSubmit - ipaApproved - ipaDeclined}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Visual 3: Bar Chart - KYC Type */}
                      <div className="glass-panel" style={{ padding: '1.5rem' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>KYC Type Distribution</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                          {Object.entries(kycDist).map(([name, val], idx) => {
                            const pct = totalSubmit > 0 ? (val / totalSubmit) * 100 : 0;
                            return (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                                <div style={{ width: '80px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'right' }}>{name}</div>
                                <div style={{ flex: 1, height: '14px', background: 'var(--paper-2)', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)' }} />
                                </div>
                                <div style={{ width: '40px', fontWeight: 'bold' }}>{val}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Visual 4: Pie Chart - Source Type */}
                      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Source Type</h4>
                        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', textAlign: 'left', width: '100%' }}>
                            {Object.entries(srcDist).map(([name, val], idx) => {
                              const colors = ['#E0A82E', '#16A37B', '#11132B', '#5C6070', '#D14343'];
                              const color = colors[idx % colors.length];
                              const pct = totalSubmit > 0 ? ((val / totalSubmit) * 100).toFixed(1) : 0;
                              return (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ height: '8px', width: '8px', borderRadius: '50%', background: color }} />
                                    <span>{name}</span>
                                  </div>
                                  <span style={{ fontWeight: 'bold' }}>{val} ({pct}%)</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Visual 5: Bar Chart - Card Type */}
                      <div className="glass-panel" style={{ padding: '1.5rem' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Card Type</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {Object.entries(cardTypeDist).map(([name, val], idx) => {
                            const pct = totalSubmit > 0 ? (val / totalSubmit) * 100 : 0;
                            return (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                                <div style={{ width: '80px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'right' }}>{name}</div>
                                <div style={{ flex: 1, height: '14px', background: 'var(--paper-2)', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--ink)' }} />
                                </div>
                                <div style={{ width: '40px', fontWeight: 'bold' }}>{val}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Visual 6: Pie Chart - Customer Type */}
                      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Customer Type</h4>
                        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', textAlign: 'left', width: '100%' }}>
                            {Object.entries(custTypeDist).map(([name, val], idx) => {
                              const colors = ['#16A37B', '#D14343', '#E0A82E', '#11132B'];
                              const color = colors[idx % colors.length];
                              const pct = totalSubmit > 0 ? ((val / totalSubmit) * 100).toFixed(1) : 0;
                              return (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ height: '8px', width: '8px', borderRadius: '50%', background: color }} />
                                    <span>{name}</span>
                                  </div>
                                  <span style={{ fontWeight: 'bold' }}>{val} ({pct}%)</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Visual 7: Bar Chart - Card Activation Status */}
                      <div className="glass-panel" style={{ padding: '1.5rem' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Card Activation Status</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {Object.entries(actDist).map(([name, val], idx) => {
                            const pct = totalSubmit > 0 ? (val / totalSubmit) * 100 : 0;
                            return (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                                <div style={{ width: '100px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'right' }}>{name}</div>
                                <div style={{ flex: 1, height: '14px', background: 'var(--paper-2)', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--mint)' }} />
                                </div>
                                <div style={{ width: '40px', fontWeight: 'bold' }}>{val}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Visual 8: India Map Pincode Heatmap */}
                      {(() => {
                        const stateLeadCounts = aggregateLeadsByState(filtered);
                        const maxStateLeads = Math.max(1, ...Object.values(stateLeadCounts));
                        const topStates = Object.entries(stateLeadCounts)
                          .map(([state, count]) => ({ state, count }))
                          .sort((a, b) => b.count - a.count)
                          .slice(0, 15);

                        return (
                          <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gridColumn: 'span 2' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.25rem' }}>Geographic Heatmap — India (Pincode & State Mapping)</h4>
                            <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginBottom: '1.5rem' }}>Leads density by Indian state, mapped from residence pincodes and MIS state data.</p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '2rem' }} className="admin-split-grid">
                              {/* India SVG Map */}
                              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'var(--paper-2)', borderRadius: '16px', padding: '1.25rem', minHeight: '420px', border: '1px solid var(--line)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)', position: 'relative' }}>
                                <svg width="100%" height="100%" viewBox="40 0 460 430" style={{ display: 'block', overflow: 'visible', maxHeight: '400px' }} preserveAspectRatio="xMidYMid meet">
                                  <defs>
                                    <filter id="india-state-glow">
                                      <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
                                    </filter>
                                    <linearGradient id="indiaHeatGrad" x1="0" y1="0" x2="1" y2="0">
                                      <stop offset="0%" stopColor="rgba(224, 168, 46, 0.06)" />
                                      <stop offset="50%" stopColor="rgba(224, 168, 46, 0.50)" />
                                      <stop offset="100%" stopColor="rgba(198, 138, 18, 0.92)" />
                                    </linearGradient>
                                  </defs>

                                  {/* India country boundary outline */}
                                  <path
                                    d="M168,30 L185,22 L210,18 L225,25 L235,15 L260,10 L280,15 L285,30 L275,45 L262,48 L248,78 L262,85 L258,100 L242,108 L265,112 L290,120 L310,135 L330,130 L350,128 L370,120 L385,125 L392,140 L410,60 L435,52 L460,55 L478,65 L475,80 L470,95 L465,108 L455,112 L452,125 L448,112 L455,100 L445,90 L425,85 L400,88 L380,95 L385,100 L395,105 L395,115 L395,130 L400,142 L398,155 L400,165 L408,172 L415,168 L418,155 L418,145 L428,140 L435,148 L432,160 L425,165 L415,140 L420,115 L435,118 L442,130 L435,122 L445,95 L448,105 L388,158 L382,175 L378,195 L375,215 L368,228 L358,232 L350,220 L342,238 L325,248 L308,250 L292,245 L280,235 L280,262 L295,270 L305,285 L310,305 L298,318 L282,325 L268,320 L255,335 L248,355 L238,370 L225,382 L210,388 L195,392 L178,395 L165,398 L158,385 L150,398 L142,408 L135,400 L130,385 L128,368 L132,350 L138,340 L145,332 L130,320 L120,305 L115,288 L112,275 L105,250 L95,240 L80,235 L68,225 L60,210 L55,195 L62,180 L70,168 L95,160 L98,125 L105,110 L130,105 L155,108 L165,40 Z"
                                    fill="none"
                                    stroke="var(--ink)"
                                    strokeWidth="1.5"
                                    strokeLinejoin="round"
                                    opacity="0.15"
                                  />

                                  {/* Render each state */}
                                  {Object.entries(INDIA_STATES_SVG).map(([stateName, stateData]) => {
                                    const count = stateLeadCounts[stateName] || 0;
                                    const fillColor = getHeatColor(count, maxStateLeads);
                                    const isActive = count > 0;
                                    return (
                                      <g key={stateName} style={{ cursor: isActive ? 'pointer' : 'default' }}>
                                        <path
                                          d={stateData.path}
                                          fill={fillColor}
                                          stroke="var(--line)"
                                          strokeWidth="0.8"
                                          strokeLinejoin="round"
                                          style={{ transition: 'fill 0.3s ease, stroke-width 0.2s ease' }}
                                          onMouseEnter={(e) => {
                                            e.target.style.strokeWidth = '2';
                                            e.target.style.stroke = 'var(--gold)';
                                            const tooltip = document.getElementById('india-map-tooltip');
                                            if (tooltip) {
                                              tooltip.textContent = `${stateName}: ${count} Lead${count !== 1 ? 's' : ''}`;
                                              tooltip.style.opacity = '1';
                                              tooltip.style.transform = 'translateY(0)';
                                            }
                                          }}
                                          onMouseLeave={(e) => {
                                            e.target.style.strokeWidth = '0.8';
                                            e.target.style.stroke = 'var(--line)';
                                            const tooltip = document.getElementById('india-map-tooltip');
                                            if (tooltip) {
                                              tooltip.style.opacity = '0';
                                              tooltip.style.transform = 'translateY(4px)';
                                            }
                                          }}
                                        />
                                        {/* Pulsing dot for active states */}
                                        {isActive && count >= (maxStateLeads * 0.15) && (
                                          <>
                                            <circle cx={stateData.cx} cy={stateData.cy} r="3" fill="var(--gold)" opacity="0.9">
                                              <animate attributeName="r" values="3;7;3" dur="2.5s" repeatCount="indefinite" />
                                              <animate attributeName="opacity" values="0.9;0.15;0.9" dur="2.5s" repeatCount="indefinite" />
                                            </circle>
                                            <circle cx={stateData.cx} cy={stateData.cy} r="2" fill="var(--paper)" stroke="var(--gold-deep)" strokeWidth="0.8" />
                                          </>
                                        )}
                                      </g>
                                    );
                                  })}

                                  {/* Legend bar */}
                                  <rect x="60" y="405" width="160" height="8" rx="4" fill="url(#indiaHeatGrad)" />
                                  <text x="60" y="422" fontSize="7" fill="hsl(var(--text-muted))">0</text>
                                  <text x="136" y="422" fontSize="7" fill="hsl(var(--text-muted))" textAnchor="middle">Leads</text>
                                  <text x="220" y="422" fontSize="7" fill="hsl(var(--text-muted))" textAnchor="end">{maxStateLeads}</text>
                                </svg>

                                {/* Floating tooltip */}
                                <div
                                  id="india-map-tooltip"
                                  style={{
                                    position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%) translateY(4px)',
                                    background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '8px',
                                    padding: '0.4rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink)',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)', opacity: 0, transition: 'opacity 0.2s, transform 0.2s',
                                    pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10
                                  }}
                                />
                              </div>

                              {/* Right panel: Top States + Top Pincodes */}
                              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {/* Top States */}
                                <div>
                                  <h5 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <MapPin size={13} /> Top States
                                  </h5>
                                  <div style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                                    {topStates.length === 0 ? (
                                      <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', padding: '1.5rem 1rem', textAlign: 'center', background: 'var(--paper-2)', borderRadius: '12px' }}>
                                        No state data available
                                      </div>
                                    ) : (
                                      topStates.map((item, idx) => {
                                        const maxCount = Math.max(1, topStates[0]?.count || 1);
                                        const pct = (item.count / maxCount) * 100;
                                        return (
                                          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0.5rem 0.65rem', background: 'var(--paper-2)', borderRadius: '10px', marginBottom: '0.4rem', border: '1px solid var(--line)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', fontWeight: 700 }}>
                                              <span style={{ color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <span style={{ height: '8px', width: '8px', borderRadius: '2px', background: getHeatColor(item.count, maxStateLeads), border: '1px solid var(--gold)' }} />
                                                {item.state}
                                              </span>
                                              <span style={{ color: 'var(--gold-deep)', fontFamily: 'var(--font-mono)' }}>{item.count}</span>
                                            </div>
                                            <div style={{ height: '5px', background: 'var(--line)', borderRadius: '3px', overflow: 'hidden' }}>
                                              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)', borderRadius: '3px', transition: 'width 0.5s ease-out' }} />
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>

                                {/* Top Pincodes */}
                                <div>
                                  <h5 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Activity size={13} /> Top Pincodes
                                  </h5>
                                  <div style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                                    {topPincodes.length === 0 ? (
                                      <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', padding: '1.5rem 1rem', textAlign: 'center', background: 'var(--paper-2)', borderRadius: '12px' }}>
                                        No active pincodes found
                                      </div>
                                    ) : (
                                      topPincodes.slice(0, 20).map((item, idx) => {
                                        const maxCount = Math.max(1, topPincodes[0]?.count || 1);
                                        const pct = (item.count / maxCount) * 100;
                                        const mappedState = pincodeToState(item.pincode);
                                        return (
                                          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0.5rem 0.65rem', background: 'var(--paper-2)', borderRadius: '10px', marginBottom: '0.4rem', border: '1px solid var(--line)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', fontWeight: 700 }}>
                                              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <span style={{ height: '6px', width: '6px', borderRadius: '50%', background: 'var(--gold)' }} />
                                                {item.pincode}
                                                {mappedState && <span style={{ fontFamily: 'inherit', fontSize: '0.65rem', color: 'hsl(var(--text-muted))', fontWeight: 500 }}>({mappedState})</span>}
                                              </span>
                                              <span style={{ color: 'var(--gold-deep)' }}>{item.count}</span>
                                            </div>
                                            <div style={{ height: '5px', background: 'var(--line)', borderRadius: '3px', overflow: 'hidden' }}>
                                              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)', borderRadius: '3px', transition: 'width 0.5s ease-out' }} />
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Visual 9: Product Des / Card Name */}
                      <div className="glass-panel" style={{ padding: '1.5rem', gridColumn: 'span 2' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Product Description (Card Name Distribution)</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                          {Object.entries(prodDist).map(([name, val], idx) => {
                            const pct = totalSubmit > 0 ? (val / totalSubmit) * 100 : 0;
                            return (
                              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem', background: 'var(--paper-2)', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '160px' }}>{name}</span>
                                  <span>{val}</span>
                                </div>
                                <div style={{ height: '8px', background: 'var(--line)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)' }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>

                    {/* MAPPED LEADS LOG TABLE */}
                    <div className="glass-panel" style={{ padding: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>MIS Mapped Leads Log</h3>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <button 
                            type="button"
                            onClick={() => handleExportMISLeads(filtered)} 
                            className="btn-primary" 
                            style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <Download size={14} /> Export to Excel
                          </button>
                          {selectedMappedLeads.length > 0 && (
                            <button 
                              onClick={() => triggerDeleteMappedLeads(selectedMappedLeads, 'bulk')} 
                              className="btn-danger" 
                              style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--err)', borderColor: 'var(--err)' }}
                            >
                              <Trash2 size={14} /> Delete Selected ({selectedMappedLeads.length})
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--line)', color: 'hsl(var(--text-secondary))' }}>
                              <th style={{ width: '40px', padding: '0.75rem', textAlign: 'center' }}>
                                <input 
                                  type="checkbox"
                                  checked={filtered.length > 0 && selectedMappedLeads.length === filtered.length}
                                  onChange={() => handleSelectAllMappedLeads(filtered)}
                                  style={{ cursor: 'pointer' }}
                                />
                              </th>
                              <th style={{ textAlign: 'left', padding: '0.75rem' }}>URN</th>
                              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Name</th>
                              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Bank Ref No</th>
                              <th style={{ textAlign: 'left', padding: '0.75rem' }}>IPA Status</th>
                              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Submit Date</th>
                              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Final Decision</th>
                              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Mapping Date</th>
                              <th style={{ textAlign: 'center', padding: '0.75rem' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.length === 0 ? (
                              <tr>
                                <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--text-muted))' }}>
                                  No mapped leads match the current filters.
                                </td>
                              </tr>
                            ) : (
                              filtered.map((lead, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--line)', transition: 'background 0.2s' }}>
                                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                    <input 
                                      type="checkbox"
                                      checked={selectedMappedLeads.includes(lead.id)}
                                      onChange={() => handleSelectMappedLead(lead.id)}
                                      style={{ cursor: 'pointer' }}
                                    />
                                  </td>
                                  <td style={{ padding: '0.75rem', fontFamily: 'var(--font-mono)' }}>{lead.urn}</td>
                                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>{lead.full_name}</td>
                                  <td style={{ padding: '0.75rem', fontFamily: 'var(--font-mono)' }}>{lead.mis_data?.bank_reference_number || 'N/A'}</td>
                                  <td style={{ padding: '0.75rem' }}>
                                    <span className={`badge badge-${(() => {
                                      const status = String(lead.mis_data?.ipa_status || '').toLowerCase();
                                      if (status.includes('approve') || status.includes('success') || status.includes('active')) return 'success';
                                      if (status.includes('decline') || status.includes('reject') || status.includes('cancel')) return 'danger';
                                      return 'warning';
                                    })()}`}>
                                      {lead.mis_data?.ipa_status || 'N/A'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.75rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                                    {formatMISValue(lead.mis_data?.application_submit_date_time, 'application_submit_date_time')}
                                  </td>
                                  <td style={{ padding: '0.75rem' }}>
                                    <span className={`badge badge-${lead.mis_status === 'Approved' ? 'success' : lead.mis_status === 'Rejected' ? 'danger' : 'warning'}`}>
                                      {lead.mis_status}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.75rem', fontSize: '0.75rem' }}>{formatDateTime(lead.mis_mapped_at)}</td>
                                  <td style={{ padding: '0.75rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                                      <button 
                                        onClick={() => setSelectedMappedLead(lead)} 
                                        className="btn-secondary" 
                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                                      >
                                        Details
                                      </button>
                                      <button 
                                        onClick={() => triggerDeleteMappedLeads([lead.id], 'single')} 
                                        className="btn-danger-outline" 
                                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: 'var(--err)', background: 'none', border: '1px solid var(--err)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        title="Delete Mapped Lead"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}
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
                      <select 
                        className="form-select" 
                        value={editingCard ? editingCard.bank : newCardForm.bank}
                        onChange={(e) => editingCard ? setEditingCard({ ...editingCard, bank: e.target.value }) : setNewCardForm({ ...newCardForm, bank: e.target.value })}
                        required
                      >
                        <option value="">Select Bank</option>
                        {getBankOptions().map((bank, i) => (
                          <option key={i} value={bank}>{bank}</option>
                        ))}
                      </select>
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
                    <>
                      <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label className="form-label">UTM Internal (Unique campaign mapping value) <span style={{ color: 'var(--err)' }}>*</span></label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. regalia_gold" 
                          value={editingCard ? (editingCard.utm_internal || '') : (newCardForm.utm_internal || '')}
                          onChange={(e) => editingCard 
                            ? setEditingCard({ ...editingCard, utm_internal: e.target.value }) 
                            : setNewCardForm({ ...newCardForm, utm_internal: e.target.value })}
                          required
                        />
                        <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem' }}>
                          Enter the unique campaign UTM Internal name. This single value in the URL query parameter "utm_internal" will map to the redirect template below.
                        </div>
                      </div>

                      <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label className="form-label">Campaign Ad ID(s) (ad_id) (comma-separated)</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. ad_123, ad_456" 
                          value={editingCard ? (editingCard.ad_id || '') : (newCardForm.ad_id || '')}
                          onChange={(e) => editingCard 
                            ? setEditingCard({ ...editingCard, ad_id: e.target.value }) 
                            : setNewCardForm({ ...newCardForm, ad_id: e.target.value })}
                        />
                        <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem' }}>
                          Optional. Enter campaign Ad ID values separated by commas. Used as fallback matching.
                        </div>
                      </div>
                    </>
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
                    <label className="form-label">Redirect URL Template</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. https://applyonline.hdfcbank.com/cards/credit-cards.html?CHANNELSOURCE=TDCC&utm_internal={utm_internal}&urn={urn}"
                      value={editingCard ? editingCard.redirect_url_template : newCardForm.redirect_url_template}
                      onChange={(e) => editingCard ? setEditingCard({ ...editingCard, redirect_url_template: e.target.value }) : setNewCardForm({ ...newCardForm, redirect_url_template: e.target.value })}
                      required
                    />
                      <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem' }}>
                        Allowed wildcards: <code>{`{name}`}</code>, <code>{`{phone}`}</code>, <code>{`{email}`}</code>, <code>{`{urn}`}</code>, <code>{`{urn_first}`}</code>, <code>{`{urn_last}`}</code>, <code>{`{agent_id}`}</code>, <code>{`{utm_source}`}</code>, <code>{`{utm_info}`}</code>, <code>{`{utm_internal}`}</code>. The <code>{`{utm_internal}`}</code> wildcard will be replaced by the matching campaign UTM Internal name.
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
                        {card.category === 'Digital' && (card.utm_internal || card.ad_id) && (
                          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', margin: '0.25rem 0' }}>
                            UTM Internal: <span style={{ color: 'var(--gold-deep)', fontWeight: 600 }}>{card.utm_internal || card.ad_id}</span>
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

                {canDelete && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveSettingsSubTab('form_builder')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        background: activeSettingsSubTab === 'form_builder' ? 'rgba(224, 168, 46, 0.15)' : 'transparent',
                        color: activeSettingsSubTab === 'form_builder' ? 'var(--gold)' : 'hsl(var(--text-secondary))',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'left',
                        fontWeight: activeSettingsSubTab === 'form_builder' ? 600 : 400
                      }}
                      className="settings-menu-item"
                    >
                      <QrCode size={16} />
                      <span>Landing Form Builder</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSettingsSubTab('bank_manager')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        background: activeSettingsSubTab === 'bank_manager' ? 'rgba(224, 168, 46, 0.15)' : 'transparent',
                        color: activeSettingsSubTab === 'bank_manager' ? 'var(--gold)' : 'hsl(var(--text-secondary))',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'left',
                        fontWeight: activeSettingsSubTab === 'bank_manager' ? 600 : 400
                      }}
                      className="settings-menu-item"
                    >
                      <CreditCard size={16} />
                      <span>Bank Manager</span>
                    </button>
                  </>
                )}
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
                          Allowed wildcards: <code>{`{name}`}</code>, <code>{`{phone}`}</code>, <code>{`{urn}`}</code>, <code>{`{urn_first}`}</code>, <code>{`{urn_last}`}</code>. Redirects here after OTP verification.
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

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>Microsoft Clarity Project ID</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. n3x7p9q1z"
                          value={settings.clarity_project_id || ''}
                          onChange={(e) => setSettings({ ...settings, clarity_project_id: e.target.value.trim() })}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.35rem' }}>
                          Enter your Microsoft Clarity project ID (normally a 9-10 character alphanumeric code) to enable screen recordings, heatmaps, and session replay.
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

                {activeSettingsSubTab === 'form_builder' && canDelete && (
                  <FormBuilderSettings 
                    settings={settings}
                    setSettings={setSettings}
                    showToast={showToast}
                    token={token}
                    API_URL={API_URL}
                  />
                )}

                {activeSettingsSubTab === 'bank_manager' && canDelete && (
                  <div style={{ textAlign: 'left' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', color: 'var(--gold-deep)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CreditCard size={20} />
                      <span>Bank Manager</span>
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-muted))', marginBottom: '1.5rem' }}>
                      Configure the list of banks available in the Card Manager dropdown list.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr', gap: '2rem' }} className="admin-split-grid">
                      {/* Left: Add Bank form */}
                      <div className="glass-panel" style={{ padding: '1.5rem', alignSelf: 'start', background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                        <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--ink)' }}>Add New Bank</h4>
                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Bank Name</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="e.g. ICICI, Axis"
                            value={newBankInput}
                            onChange={(e) => setNewBankInput(e.target.value)}
                            style={{ background: 'var(--paper)', fontSize: '0.8rem', padding: '0.45rem 0.6rem' }}
                          />
                        </div>
                        <button 
                          onClick={() => {
                            const trimmed = newBankInput.trim();
                            if (!trimmed) {
                              showToast('Please enter a valid bank name.', 'error');
                              return;
                            }
                            const current = getBankOptions();
                            if (current.some(b => b.toLowerCase() === trimmed.toLowerCase())) {
                              showToast('Bank already exists in the list.', 'error');
                              return;
                            }
                            const updated = [...current, trimmed];
                            handleSaveBanks(updated);
                            setNewBankInput('');
                          }}
                          className="btn-primary"
                          style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? 'Adding...' : 'Add Bank'}
                        </button>
                      </div>

                      {/* Right: Existing Banks List */}
                      <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--line)' }}>
                        <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--ink)' }}>Configured Banks</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '350px', overflowY: 'auto' }}>
                          {getBankOptions().length === 0 ? (
                            <div style={{ fontSize: '0.82rem', color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '1.5rem 1rem' }}>
                              No banks configured. Defaulting to HDFC, SBI.
                            </div>
                          ) : (
                            getBankOptions().map((bank, idx) => (
                              <div 
                                key={idx} 
                                style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center', 
                                  padding: '0.6rem 0.85rem', 
                                  background: 'var(--paper-2)', 
                                  border: '1px solid var(--line)', 
                                  borderRadius: 'var(--radius-sm)' 
                                }}
                              >
                                <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--ink)' }}>{bank}</span>
                                <button 
                                  onClick={() => {
                                    const current = getBankOptions();
                                    const updated = current.filter((_, i) => i !== idx);
                                    handleSaveBanks(updated);
                                  }}
                                  className="btn-danger-outline"
                                  style={{ 
                                    padding: '0.25rem 0.55rem', 
                                    fontSize: '0.72rem', 
                                    color: 'var(--err)', 
                                    background: 'none', 
                                    border: '1px solid var(--err)', 
                                    borderRadius: '4px', 
                                    cursor: 'pointer',
                                    transition: 'all 0.15s'
                                  }}
                                  disabled={isSubmitting}
                                  title="Remove Bank"
                                >
                                  Remove
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}


        </div>
      )}

      {/* Upload MIS Modal */}
      {showUploadMISModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(8px)' }}>
          <div className="glass-panel admin-dialog-panel" style={{ width: '90%', maxWidth: '500px', position: 'relative', borderTop: '4px solid var(--gold)', padding: '2rem' }}>
            <button onClick={() => { setShowUploadMISModal(false); setMisFile(null); }} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: 'hsl(var(--text-primary))' }}>Upload Bank MIS Report</h3>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem' }}>
              Upload an Excel (.xls, .xlsx), CSV (.csv), or PDF (.pdf) file. The system will extract URNs (including split urn_first/last parts or LC2_CODE) and automatically map decision statuses.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div 
                style={{ 
                  border: '2px dashed var(--line)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '2.5rem 1.5rem', 
                  textAlign: 'center', 
                  background: 'rgba(224, 168, 46, 0.02)', 
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                <input 
                  type="file" 
                  accept=".csv,.xls,.xlsx,.pdf"
                  onChange={(e) => setMisFile(e.target.files[0])}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                />
                <Upload size={32} style={{ color: 'hsl(var(--primary))', marginBottom: '0.75rem', opacity: 0.8 }} />
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                  {misFile ? misFile.name : 'Choose a file or drag it here'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>
                  Supports CSV, Excel, or PDF
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => { setShowUploadMISModal(false); setMisFile(null); }} 
                className="btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (!misFile) {
                    showToast('Please select a file first', 'error');
                    return;
                  }
                  setIsSubmitting(true);
                  const formData = new FormData();
                  formData.append('file', misFile);
                  try {
                    const res = await fetch(`${API_URL}/leads/upload-mis`, {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}` },
                      body: formData
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setMisUploadResult(data);
                      setShowUploadMISModal(false);
                      setMisFile(null);
                      setShowMISResultModal(true);
                      fetchLeads(currentPage, leadsPerPage);
                      fetchMISStats();
                    } else {
                      const errData = await res.json();
                      showToast(errData.error || 'Failed to upload MIS file', 'error');
                    }
                  } catch (err) {
                    console.error('MIS upload error:', err);
                    showToast('Error uploading file', 'error');
                  } finally {
                    setIsSubmitting(false);
                  }
                }} 
                className="btn-primary"
                disabled={isSubmitting || !misFile}
              >
                {isSubmitting ? 'Uploading & Matching...' : 'Upload & Process'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MIS Result Modal */}
      {showMISResultModal && misUploadResult && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(8px)' }}>
          <div className="glass-panel admin-dialog-panel" style={{ width: '95%', maxWidth: '600px', position: 'relative', borderTop: '4px solid var(--mint)', padding: '2rem', maxHeight: '85vh', overflowY: 'auto' }}>
            <button onClick={() => setShowMISResultModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '56px', width: '56px', borderRadius: '50%', background: 'rgba(22, 163, 123, 0.1)', color: 'var(--mint)', marginBottom: '0.75rem' }}>
                <CheckCircle2 size={32} />
              </div>
              <h3 style={{ fontSize: '1.4rem', color: 'hsl(var(--text-primary))' }}>MIS Processing Complete</h3>
              <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Bank report URNs matched against FinMantra leads database.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', background: 'rgba(22, 163, 123, 0.05)', border: '1px solid rgba(22, 163, 123, 0.15)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--mint)', fontWeight: 600 }}>Matched & Mapped</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--mint)' }}>{misUploadResult.totalMatched}</div>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(209, 67, 67, 0.05)', border: '1px solid rgba(209, 67, 67, 0.15)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--err)', fontWeight: 600 }}>Unmatched (Ignored)</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--err)' }}>{misUploadResult.totalUnmatched}</div>
              </div>
            </div>

            {misUploadResult.matchedDetails.length > 0 && (
              <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 700 }}>Matched Leads Detail ({misUploadResult.matchedDetails.length})</h4>
                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', padding: '0.5rem' }}>
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)' }}>
                        <th style={{ textAlign: 'left', padding: '0.35rem' }}>URN</th>
                        <th style={{ textAlign: 'left', padding: '0.35rem' }}>Name</th>
                        <th style={{ textAlign: 'left', padding: '0.35rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {misUploadResult.matchedDetails.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                          <td style={{ padding: '0.35rem', fontFamily: 'var(--font-mono)' }}>{item.urn}</td>
                          <td style={{ padding: '0.35rem' }}>{item.name}</td>
                          <td style={{ padding: '0.35rem' }}>
                            <span className={`badge badge-${item.status === 'Approved' ? 'success' : item.status === 'Rejected' ? 'danger' : 'warning'}`}>{item.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {misUploadResult.unmatchedDetails.length > 0 && (
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 700, color: 'var(--err)' }}>Unmatched URNs Detail ({misUploadResult.unmatchedDetails.length})</h4>
                <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', padding: '0.5rem' }}>
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)' }}>
                        <th style={{ textAlign: 'left', padding: '0.35rem' }}>URN</th>
                        <th style={{ textAlign: 'left', padding: '0.35rem' }}>Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {misUploadResult.unmatchedDetails.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                          <td style={{ padding: '0.35rem', fontFamily: 'var(--font-mono)' }}>{item.urn}</td>
                          <td style={{ padding: '0.35rem' }}>{item.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button onClick={() => setShowMISResultModal(false)} className="btn-primary">
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Confirmation Modal */}
      {showPasswordConfirmModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1150, backdropFilter: 'blur(8px)' }}>
          <div className="glass-panel admin-dialog-panel" style={{ width: '90%', maxWidth: '400px', position: 'relative', borderTop: '4px solid var(--err)', padding: '2rem', textAlign: 'center' }}>
            <button onClick={() => { setShowPasswordConfirmModal(false); setPendingDeleteAction(null); }} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '48px', width: '48px', borderRadius: '50%', background: 'rgba(209, 67, 67, 0.1)', color: 'var(--err)', marginBottom: '0.75rem' }}>
              <Trash2 size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', color: 'hsl(var(--text-primary))', marginBottom: '0.5rem' }}>Confirm Admin Password</h3>
            <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '1.25rem' }}>
              Please enter the admin password to authorize unmapping of {pendingDeleteAction?.ids?.length} lead(s) from the dashboard.
            </p>
            <input 
              type="password"
              placeholder="Enter password 'Lakshay@123'"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmDeleteMappedLeads(); }}
              className="form-control"
              style={{ width: '100%', marginBottom: '1.5rem', padding: '0.6rem 0.8rem', border: '1px solid var(--line)', borderRadius: '6px', background: 'var(--paper)', color: 'var(--ink)' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button 
                onClick={() => { setShowPasswordConfirmModal(false); setPendingDeleteAction(null); }} 
                className="btn-secondary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDeleteMappedLeads} 
                className="btn-primary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: 'var(--err)', borderColor: 'var(--err)' }}
              >
                Confirm Unmap
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mapped Lead MIS Details Modal */}
      {selectedMappedLead && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(8px)' }}>
          <div className="glass-panel admin-dialog-panel" style={{ width: '90%', maxWidth: '600px', position: 'relative', borderTop: '4px solid var(--mint)', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setSelectedMappedLead(null)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.2rem', color: 'hsl(var(--text-primary))' }}>Bank MIS Details</h3>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--mint)', marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
              <span>Client Name: {selectedMappedLead.full_name}</span>
              <span>•</span>
              <span>URN: {selectedMappedLead.urn}</span>
            </div>

            <div style={{ border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', background: 'var(--paper-2)', padding: '0.65rem 1rem', fontWeight: 'bold', fontSize: '0.8rem', borderBottom: '1px solid var(--line)' }}>
                <div>Bank MIS Parameter</div>
                <div>Mapped Value</div>
              </div>
              <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                {(() => {
                  const standardFields = [
                    { label: 'Bank Reference Number', key: 'bank_reference_number' },
                    { label: 'Application Submit Date/Time', key: 'application_submit_date_time' },
                    { label: 'Customer Type', key: 'customer_type' },
                    { label: 'state', key: 'state' },
                    { label: 'IPA Status', key: 'ipa_status' },
                    { label: 'DAP Final Flag', key: 'dap_final_flag' },
                    { label: 'DROPOFFREASON', key: 'dropoff_reason' },
                    { label: 'VKYC STATUS', key: 'vkyc_status' },
                    { label: 'KYC TYPE', key: 'kyc_type' },
                    { label: 'VKYC EXPIRY DATE', key: 'vkyc_expiry_date' },
                    { label: 'PROMO CODE', key: 'promo_code' },
                    { label: 'FINAL DECISION', key: 'final_decision' },
                    { label: 'FINAL DECISION DATE', key: 'final_decision_date' },
                    { label: 'CURRENT STAGE', key: 'current_stage' },
                    { label: 'CURABLE FLAG', key: 'curable_flag' },
                    { label: 'COMPANY NAME', key: 'company_name' },
                    { label: 'BKYC Status', key: 'bkyc_status' },
                    { label: 'KYC Status', key: 'kyc_status' },
                    { label: 'Decision Month', key: 'decision_month' },
                    { label: 'Decline Descreption', key: 'decline_description' },
                    { label: 'Decline Type', key: 'decline_type' },
                    { label: 'Card Name', key: 'card_name' },
                    { label: 'Card Type', key: 'card_type' },
                    { label: 'Card Activation Staus', key: 'card_activation_status' },
                    { label: 'Source Type', key: 'source_type' },
                    { label: 'KYC Completion date', key: 'kyc_completion_date' }
                  ];

                  const standardKeys = new Set(standardFields.map(f => f.key));
                  const allRows = [];

                  // Add standard rows
                  standardFields.forEach(item => {
                    const rawVal = selectedMappedLead.mis_data?.[item.key];
                    const val = formatMISValue(rawVal, item.key);
                    allRows.push({ label: item.label, value: val, key: item.key });
                  });

                  // Add extra custom rows from the uploaded file
                  if (selectedMappedLead.mis_data) {
                    Object.entries(selectedMappedLead.mis_data).forEach(([k, v]) => {
                      if (!standardKeys.has(k) && v !== '' && v !== null && v !== undefined) {
                        allRows.push({ label: k, value: formatMISValue(v, k), key: k });
                      }
                    });
                  }

                  return allRows.map((item, idx) => {
                    const valStr = String(item.value).toLowerCase();
                    let valColor = 'var(--ink)';
                    let valFontWeight = 'inherit';
                    if (valStr.includes('approve') || valStr.includes('success') || valStr.includes('active') || valStr === 'yes') {
                      valColor = 'var(--mint)';
                      valFontWeight = '600';
                    } else if (valStr.includes('decline') || valStr.includes('reject') || valStr.includes('fail') || valStr === 'no') {
                      valColor = 'var(--err)';
                      valFontWeight = '600';
                    }
                    return (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', padding: '0.65rem 1rem', fontSize: '0.8rem', borderBottom: '1px solid rgba(0,0,0,0.04)', textAlign: 'left' }}>
                        <div style={{ color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>{item.label}</div>
                        <div style={{ color: valColor, fontWeight: valFontWeight, fontFamily: item.key.includes('date') || item.key.includes('number') ? 'var(--font-mono)' : 'inherit', wordBreak: 'break-all' }}>{item.value}</div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button onClick={() => setSelectedMappedLead(null)} className="btn-secondary">
                Close Details
              </button>
            </div>
          </div>
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
              <span>Date: {formatDateTime(selectedLeadDetails.created_at)}</span>
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
                      <div><strong>Employment Type:</strong> {selectedLeadDetails.employment || 'N/A'}</div>
                      <div><strong>Already Has Credit Card?</strong> {selectedLeadDetails.has_credit_card || 'N/A'}</div>
                      <div><strong>Residence Pincode:</strong> <code>{selectedLeadDetails.pincode || 'N/A'}</code></div>
                      <div><strong>Net Monthly Income:</strong> {selectedLeadDetails.monthly_income ? `₹${selectedLeadDetails.monthly_income}` : 'N/A'}</div>
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
                    <div><strong>UTM Internal:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_internal || 'N/A'}</span></div>
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
                    <div><strong>Redirect URL:</strong> <span style={{ color: 'var(--gold-deep)', wordBreak: 'break-all' }}>{selectedLeadDetails.redirect_url || 'N/A'}</span></div>
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
                    'utm_id', 'utm_creative', 'ad_id', 'utm_internal', 'utm_keyword', 'utm_matchtype', 'utm_network', 'utm_placement',
                    'utm_device', 'utm_location', 'gbraid', 'wbraid', 'landing_page', 'first_landing_page', 'referrer',
                    'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id',
                    '_fbc', '_fbp', 'has_credit_card', 'pincode', 'monthly_income'
                  ].includes(k)) && (
                    <>
                      <h5 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'hsl(var(--text-primary))' }}>Custom / Other Query Parameters</h5>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {Object.entries(selectedLeadDetails.utm_params)
                          .filter(([k]) => ![
                            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 
                            'utm_channel', 'utm_category', 'utm_info', 'utm_creative_format', 
                            'utm_id', 'utm_creative', 'ad_id', 'utm_internal', 'utm_keyword', 'utm_matchtype', 'utm_network', 'utm_placement',
                            'utm_device', 'utm_location', 'gbraid', 'wbraid', 'landing_page', 'first_landing_page', 'referrer',
                            'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id',
                            '_fbc', '_fbp', 'has_credit_card', 'pincode', 'monthly_income'
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
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Employment Type</label>
                        <select 
                          className="form-select" 
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                          value={editLeadForm.employment || ''} 
                          onChange={(e) => handleEditLeadFormChange('employment', e.target.value)}
                        >
                          <option value="">Select Employment</option>
                          <option value="Salaried">Salaried</option>
                          <option value="Self Employed (Business)">Self Employed (Business)</option>
                          <option value="Self Employed (Professional)">Self Employed (Professional)</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Already Has Credit Card?</label>
                        <select 
                          className="form-select" 
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                          value={editLeadForm.has_credit_card || ''} 
                          onChange={(e) => handleEditLeadFormChange('has_credit_card', e.target.value)}
                        >
                          <option value="">Select Option</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Residence Pincode</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                          value={editLeadForm.pincode || ''} 
                          onChange={(e) => handleEditLeadFormChange('pincode', e.target.value)} 
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Net Monthly Income</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                          value={editLeadForm.monthly_income || ''} 
                          onChange={(e) => handleEditLeadFormChange('monthly_income', e.target.value)} 
                        />
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
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>UTM Internal</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                        value={editLeadForm.utm_internal || ''} 
                        onChange={(e) => handleEditLeadFormChange('utm_internal', e.target.value)} 
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

function FormBuilderSettings({ settings, setSettings, showToast, token, API_URL }) {
  const [schema, setSchema] = useState(() => {
    try {
      if (settings.landing_form_schema) {
        return typeof settings.landing_form_schema === 'string'
          ? JSON.parse(settings.landing_form_schema)
          : settings.landing_form_schema;
      }
    } catch (e) {
      console.error(e);
    }
    // Fallback default
    return {
      fields: {
        fullName: { visible: true, required: true, label: "Full Name (as per PAN Card)", placeholder: "Enter your full name as per PAN Card" },
        phone: { visible: true, required: true, label: "Mobile Number", placeholder: "Enter your mobile number" },
        email: { visible: true, required: true, label: "Email Id", placeholder: "Enter your email ID" },
        has_credit_card: { visible: true, required: true, label: "Do you already have a credit card?" },
        employment: {
          visible: true,
          required: true,
          label: "Employment Type",
          options: [
            { value: "Salaried", enabled: true },
            { value: "Self Employed (Business)", enabled: false },
            { value: "Self Employed (Professional)", enabled: false }
          ]
        },
        monthly_income: { visible: true, required: true, label: "Net Monthly Income", placeholder: "Net Monthly Income" },
        pincode: { visible: true, required: true, label: "Residence Pincode", placeholder: "Residence Pincode" }
      }
    };
  });

  const [newOptionVal, setNewOptionVal] = useState('');
  const [pincodeMode, setPincodeMode] = useState(settings.pincode_serviceability_mode || 'all');
  const [pincodeList, setPincodeList] = useState(settings.pincode_serviceability_list || '');
  const [saving, setSaving] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const card = e.currentTarget;
    const box = card.getBoundingClientRect();
    const x = e.clientX - box.left - box.width / 2;
    const y = e.clientY - box.top - box.height / 2;
    // Calculate rotation angles
    const rotX = -y / 15;
    const rotY = x / 15;
    setTilt({ x: rotX, y: rotY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const updateField = (fieldName, prop, value) => {
    setSchema(prev => {
      const updatedFields = { ...prev.fields };
      updatedFields[fieldName] = {
        ...updatedFields[fieldName],
        [prop]: value
      };
      return { ...prev, fields: updatedFields };
    });
  };

  const handleAddEmploymentOption = () => {
    if (!newOptionVal.trim()) return;
    setSchema(prev => {
      const emp = prev.fields.employment;
      const opts = [...(emp.options || [])];
      if (opts.some(o => o.value.toLowerCase() === newOptionVal.trim().toLowerCase())) {
        showToast('Option already exists.', 'error');
        return prev;
      }
      opts.push({ value: newOptionVal.trim(), enabled: true });
      return {
        ...prev,
        fields: {
          ...prev.fields,
          employment: { ...emp, options: opts }
        }
      };
    });
    setNewOptionVal('');
  };

  const handleRemoveEmploymentOption = (idx) => {
    setSchema(prev => {
      const emp = prev.fields.employment;
      const opts = emp.options.filter((_, i) => i !== idx);
      return {
        ...prev,
        fields: {
          ...prev.fields,
          employment: { ...emp, options: opts }
        }
      };
    });
  };

  const handleToggleEmploymentOptionEnabled = (idx) => {
    setSchema(prev => {
      const emp = prev.fields.employment;
      const opts = emp.options.map((opt, i) => i === idx ? { ...opt, enabled: !opt.enabled } : opt);
      return {
        ...prev,
        fields: {
          ...prev.fields,
          employment: { ...emp, options: opts }
        }
      };
    });
  };

  const handleSaveSchema = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          landing_form_schema: JSON.stringify(schema),
          pincode_serviceability_mode: pincodeMode,
          pincode_serviceability_list: pincodeList
        })
      });
      if (res.ok) {
        setSettings(prev => ({
          ...prev,
          landing_form_schema: schema,
          pincode_serviceability_mode: pincodeMode,
          pincode_serviceability_list: pincodeList
        }));
        showToast('Form configuration & pincode serviceability rules saved successfully!', 'success');
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save schema');
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', textAlign: 'left' }}>
      {/* Settings Form */}
      <div style={{ flex: '1.2', minWidth: '320px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', color: 'var(--gold-deep)' }}>
          <QrCode size={20} />
          <span>Landing Form Customizer</span>
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem' }}>
          Enable or disable fields, edit labels, placeholders, and manage drop-down options for the public application form.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
          {Object.entries(schema.fields).map(([fieldName, config]) => (
            <div key={fieldName} className="glass-panel" style={{ padding: '1.25rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px dashed var(--border-light)', paddingBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--gold)' }}>
                  {fieldName === 'fullName' ? 'Full Name Field' : fieldName.replace(/_/g, ' ')}
                </span>
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={config.visible} 
                      onChange={(e) => updateField(fieldName, 'visible', e.target.checked)}
                      style={{ accentColor: 'var(--gold)' }}
                    />
                    Visible
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={config.required} 
                      disabled={!config.visible}
                      onChange={(e) => updateField(fieldName, 'required', e.target.checked)}
                      style={{ accentColor: 'var(--gold)' }}
                    />
                    Required
                  </label>
                </div>
              </div>

              {config.visible && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Field Display Label</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      value={config.label}
                      onChange={(e) => updateField(fieldName, 'label', e.target.value)}
                    />
                  </div>

                  {config.placeholder !== undefined && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Input Placeholder Text</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                        value={config.placeholder}
                        onChange={(e) => updateField(fieldName, 'placeholder', e.target.value)}
                      />
                    </div>
                  )}

                  {/* Field Validation Rules Section */}
                  <div style={{ marginTop: '0.75rem', borderTop: '1px dashed var(--border-light)', paddingTop: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gold-deep)', display: 'block', marginBottom: '0.4rem' }}>Validation Rules Settings</span>
                    
                    {fieldName === 'fullName' && (
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={config.validationRules?.alphabeticOnly !== false} 
                            onChange={(e) => {
                              const rules = { ...config.validationRules, alphabeticOnly: e.target.checked };
                              updateField(fieldName, 'validationRules', rules);
                            }}
                            style={{ accentColor: 'var(--gold)' }}
                          />
                          Only Letters & Spaces
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={config.validationRules?.requireSecondWord !== false} 
                            onChange={(e) => {
                              const rules = { ...config.validationRules, requireSecondWord: e.target.checked };
                              updateField(fieldName, 'validationRules', rules);
                            }}
                            style={{ accentColor: 'var(--gold)' }}
                          />
                          Require Last Name / Father Name
                        </label>
                      </div>
                    )}

                    {fieldName === 'phone' && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.7rem' }}>Enforce allowed starting digits (comma separated)</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                          value={config.validationRules?.allowedDigitsStart || '6,7,8,9'}
                          onChange={(e) => {
                            const rules = { ...config.validationRules, allowedDigitsStart: e.target.value };
                            updateField(fieldName, 'validationRules', rules);
                          }}
                        />
                      </div>
                    )}

                    {fieldName === 'monthly_income' && (
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Min Income Range (₹)</label>
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                            value={config.validationRules?.minIncome !== undefined ? config.validationRules.minIncome : 25000}
                            onChange={(e) => {
                              const rules = { ...config.validationRules, minIncome: parseInt(e.target.value, 10) || 0 };
                              updateField(fieldName, 'validationRules', rules);
                            }}
                          />
                        </div>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Max Income Range (₹)</label>
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                            value={config.validationRules?.maxIncome !== undefined ? config.validationRules.maxIncome : 1000000}
                            onChange={(e) => {
                              const rules = { ...config.validationRules, maxIncome: parseInt(e.target.value, 10) || 0 };
                              updateField(fieldName, 'validationRules', rules);
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {fieldName !== 'fullName' && fieldName !== 'phone' && fieldName !== 'monthly_income' && (
                      <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
                        Standard required checks apply to this field.
                      </div>
                    )}
                  </div>

                  {fieldName === 'employment' && (
                    <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Dropdown Choices</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                        {(config.options || []).map((opt, oIdx) => (
                          <div key={oIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                            <span style={{ fontSize: '0.8rem', color: opt.enabled ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))', textDecoration: opt.enabled ? 'none' : 'line-through' }}>{opt.value}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                                <input 
                                  type="checkbox" 
                                  checked={opt.enabled} 
                                  onChange={() => handleToggleEmploymentOptionEnabled(oIdx)}
                                  style={{ accentColor: 'var(--mint)' }}
                                />
                                Enabled
                              </label>
                              <button 
                                type="button" 
                                onClick={() => handleRemoveEmploymentOption(oIdx)} 
                                style={{ color: 'var(--err)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                title="Remove Option"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input 
                          type="text" 
                          placeholder="Add new choice..." 
                          className="form-input" 
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', margin: 0 }}
                          value={newOptionVal}
                          onChange={(e) => setNewOptionVal(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEmploymentOption())}
                        />
                        <button 
                          type="button" 
                          onClick={handleAddEmploymentOption} 
                          className="btn-primary" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                        >
                          <Plus size={14} /> Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pincode Serviceability Card */}
        <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gold)', marginBottom: '0.75rem', borderBottom: '1px dashed var(--border-light)', paddingBottom: '0.5rem' }}>
            Pincode Serviceability Rules
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Validation Mode</label>
              <select 
                className="form-select"
                style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                value={pincodeMode}
                onChange={(e) => setPincodeMode(e.target.value)}
              >
                <option value="all">Allow All Pincodes (No filtering)</option>
                <option value="whitelist">Whitelist Mode (Only allow serviceable list)</option>
                <option value="blacklist">Blacklist Mode (Block restricted list)</option>
              </select>
            </div>

            {pincodeMode !== 'all' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>
                  {pincodeMode === 'whitelist' ? 'Serviceable Pincodes List' : 'Blocked Pincodes List'}
                </label>
                <textarea 
                  className="form-input"
                  rows="4"
                  placeholder="Enter comma-separated pincodes (e.g. 110001, 110002, 400001)"
                  value={pincodeList}
                  onChange={(e) => setPincodeList(e.target.value)}
                  style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
                />
                <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', marginTop: '0.35rem' }}>
                  Separate values with commas. Spaces and carriage returns are automatically cleaned.
                </div>
              </div>
            )}
          </div>
        </div>

        <button 
          type="button" 
          onClick={handleSaveSchema} 
          className="btn-primary" 
          style={{ width: '100%', padding: '0.8rem', fontSize: '1rem', fontWeight: 600 }}
          disabled={saving}
        >
          {saving ? 'Saving Form Settings...' : 'Save Form Schema Configuration'}
        </button>
      </div>

      {/* 3D Mobile Mock-up Preview */}
      <div style={{ flex: '1', minWidth: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: '2.5rem' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Interactive 3D Live Preview
        </span>

        {/* 3D Mobile Container */}
        <div 
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            width: '320px',
            height: '630px',
            background: 'var(--card-bg, #0b1120)',
            border: '8px solid #222d44',
            borderRadius: '40px',
            boxShadow: '0 30px 60px rgba(0,0,0,0.4), inset 0 2px 8px rgba(255,255,255,0.05)',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.1s ease-out, box-shadow 0.3s',
            transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transformStyle: 'preserve-3d',
            cursor: 'grab'
          }}
        >
          {/* Mobile Camera Notch */}
          <div style={{
            position: 'absolute',
            top: '0',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '120px',
            height: '24px',
            background: '#222d44',
            borderBottomLeftRadius: '15px',
            borderBottomRightRadius: '15px',
            zIndex: 10
          }} />

          {/* Screen Content */}
          <div style={{
            height: '100%',
            width: '100%',
            overflowY: 'auto',
            padding: '2rem 1.25rem 1.25rem 1.25rem',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(8, 13, 28, 0.95))',
            color: '#fff',
            scrollbarWidth: 'none',
            textAlign: 'left'
          }} className="mock-screen">
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, background: 'linear-gradient(90deg, #e0a82e, #fff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                FinMantra
              </div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                Check Credit Card Eligibility
              </div>
            </div>

            {/* Simulated Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Full Name */}
              {schema.fields.fullName.visible && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0' }}>
                    {schema.fields.fullName.label} {schema.fields.fullName.required && <span style={{ color: 'var(--err)' }}>*</span>}
                  </label>
                  <input 
                    type="text" 
                    placeholder={schema.fields.fullName.placeholder}
                    disabled
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#94a3b8',
                      fontSize: '0.8rem',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
              )}

              {/* Mobile */}
              {schema.fields.phone.visible && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0' }}>
                    {schema.fields.phone.label} {schema.fields.phone.required && <span style={{ color: 'var(--err)' }}>*</span>}
                  </label>
                  <input 
                    type="text" 
                    placeholder={schema.fields.phone.placeholder}
                    disabled
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#94a3b8',
                      fontSize: '0.8rem',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
              )}

              {/* Email */}
              {schema.fields.email.visible && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0' }}>
                    {schema.fields.email.label} {schema.fields.email.required && <span style={{ color: 'var(--err)' }}>*</span>}
                  </label>
                  <input 
                    type="text" 
                    placeholder={schema.fields.email.placeholder}
                    disabled
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#94a3b8',
                      fontSize: '0.8rem',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
              )}

              {/* Has Credit Card */}
              {schema.fields.has_credit_card.visible && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0' }}>
                    {schema.fields.has_credit_card.label} {schema.fields.has_credit_card.required && <span style={{ color: 'var(--err)' }}>*</span>}
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button 
                      type="button" 
                      disabled
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#cbd5e1',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'not-allowed'
                      }}
                    >
                      Yes
                    </button>
                    <button 
                      type="button" 
                      disabled
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#cbd5e1',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'not-allowed'
                      }}
                    >
                      No
                    </button>
                  </div>
                </div>
              )}

              {/* Employment */}
              {schema.fields.employment.visible && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0' }}>
                    {schema.fields.employment.label} {schema.fields.employment.required && <span style={{ color: 'var(--err)' }}>*</span>}
                  </label>
                  <select 
                    disabled
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#cbd5e1',
                      fontSize: '0.8rem',
                      cursor: 'not-allowed'
                    }}
                  >
                    <option value="">Select Employment</option>
                    {(schema.fields.employment.options || []).map((o, idx) => (
                      <option key={idx} value={o.value} disabled={!o.enabled}>
                        {o.value} {!o.enabled && '(Disabled)'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Monthly Income */}
              {schema.fields.monthly_income && schema.fields.monthly_income.visible && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0' }}>
                    {schema.fields.monthly_income.label} {schema.fields.monthly_income.required && <span style={{ color: 'var(--err)' }}>*</span>}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1', fontSize: '0.8rem' }}>₹</span>
                    <input 
                      type="text" 
                      placeholder={schema.fields.monthly_income.placeholder}
                      disabled
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem 0.5rem 1.5rem',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#94a3b8',
                        fontSize: '0.8rem',
                        cursor: 'not-allowed'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Residence Pincode */}
              {schema.fields.pincode.visible && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0' }}>
                    {schema.fields.pincode.label} {schema.fields.pincode.required && <span style={{ color: 'var(--err)' }}>*</span>}
                  </label>
                  <input 
                    type="text" 
                    placeholder={schema.fields.pincode.placeholder}
                    disabled
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#94a3b8',
                      fontSize: '0.8rem',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
              )}

              {/* T&C Consent */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', marginTop: '0.5rem' }}>
                <input type="checkbox" disabled style={{ marginTop: '0.15rem' }} checked />
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', lineHeight: '1.25' }}>
                  I authorize FinMantra to check credit card eligibility as per policies.
                </span>
              </div>

              {/* Proceed Button */}
              <button 
                type="button" 
                disabled
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '30px',
                  background: 'linear-gradient(135deg, #e0a82e, #cfa024)',
                  border: 'none',
                  color: '#000',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  marginTop: '0.5rem',
                  boxShadow: '0 4px 15px rgba(224, 168, 70, 0.3)',
                  cursor: 'not-allowed'
                }}
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

