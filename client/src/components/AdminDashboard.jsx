import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { INDIA_STATES_SVG, aggregateLeadsByState, getHeatColor, pincodeToState } from '../utils/indiaMap.js';
import { 
  Users, CreditCard, MapPin, Settings as SettingsIcon, ShieldAlert, BarChart3, 
  Trash2, Download, Search, Plus, Edit, Check, X, RefreshCw, AlertCircle,
  QrCode, Smartphone, CheckCircle, Wifi, WifiOff, Eye, EyeOff, MessageSquare, Layers,
  ArrowUp, ArrowDown, MoreVertical, LogOut, Activity, Sun, Moon, LogIn,
  TrendingUp, Upload, CheckCircle2, Filter, Database, UserPlus, FileSpreadsheet, FolderArchive, FolderDown, FileText,
  Bell, Mail, Key, AlertTriangle, Info
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
  const [showSettingsFlyout, setShowSettingsFlyout] = useState(false);

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
  const [filterCampaign, setFilterCampaign] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [filterInfo, setFilterInfo] = useState('');
  const [utmOptions, setUtmOptions] = useState({ campaigns: [], terms: [], infos: [] });

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
  const [selectedBankForMIS, setSelectedBankForMIS] = useState('');
  const [bankMisMappings, setBankMisMappings] = useState({});
  const [selectedBankConfig, setSelectedBankConfig] = useState('SBI');
  const [misFile, setMisFile] = useState(null);
  const [misUploadResult, setMisUploadResult] = useState(null);
  const [showMISResultModal, setShowMISResultModal] = useState(false);
  const [selectedMappedLead, setSelectedMappedLead] = useState(null);

  // Manual Lead Creation & Upload States
  const [canCreateLeads, setCanCreateLeads] = useState(false);
  const [showCreateLeadModal, setShowCreateLeadModal] = useState(false);
  const [showUploadLeadsModal, setShowUploadLeadsModal] = useState(false);
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [isUploadingManualLeads, setIsUploadingManualLeads] = useState(false);

  // ── Database Banks & MIS Auto-Sync States ──
  const [dbBankList, setDbBankList] = useState(['HDFC', 'SBI', 'KIWI']);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [isSyncingEmailMis, setIsSyncingEmailMis] = useState(false);
  const [emailMisConfig, setEmailMisConfig] = useState({
    receiver_email: 'spikemarketingsolutions25@gmail.com',
    app_password: '',
    sender_email: 'sstechnologies2017@gmail.com',
    subject_keywords: ['LG MIS EOD', 'LG MIS 48Hourly', 'LG MIS Hourly'],
    enabled: true
  });
  const [showEmailConfigModal, setShowEmailConfigModal] = useState(false);
  const [emailConfigDevPass, setEmailConfigDevPass] = useState('');
  const [emailConfigForm, setEmailConfigForm] = useState({
    receiver_email: '',
    app_password: '',
    sender_email: '',
    subject_keywords: '',
    enabled: true
  });
  const [emailConfigError, setEmailConfigError] = useState('');
  const [emailConfigSuccess, setEmailConfigSuccess] = useState('');

  // ── KIWI MIS Auto-Sync States ──
  const [isSyncingKiwiEmailMis, setIsSyncingKiwiEmailMis] = useState(false);
  const [kiwiEmailMisConfig, setKiwiEmailMisConfig] = useState({
    receiver_email: 'spikemarketingsolutions25@gmail.com',
    app_password: '',
    sender_email: 'harbans.anand@mymoneymantra.com',
    subject_keywords: ['kiwi mis'],
    enabled: true
  });
  const [showKiwiEmailConfigModal, setShowKiwiEmailConfigModal] = useState(false);
  const [kiwiEmailConfigDevPass, setKiwiEmailConfigDevPass] = useState('');
  const [kiwiEmailConfigForm, setKiwiEmailConfigForm] = useState({
    receiver_email: '',
    app_password: '',
    sender_email: '',
    subject_keywords: '',
    enabled: true
  });
  const [kiwiEmailConfigError, setKiwiEmailConfigError] = useState('');
  const [kiwiEmailConfigSuccess, setKiwiEmailConfigSuccess] = useState('');

  const defaultCreateLeadForm = {
    application_id: '',
    full_name: '',
    phone: '',
    email: '',
    pan_no: '',
    dob: '',
    mother_name: '',
    current_address: '',
    pincode: '',
    employment: 'Salaried',
    designation: '',
    company_name: '',
    has_credit_card: 'No',
    monthly_income: '',
    income_range: '3-6 LPA',
    city: '',
    card_id: '',
    card_name: '',
    card_bank: '',
    agent_id: '',
    source: 'public',
    consent: true,
    redirect_url: '',
    utm_source: 'meta',
    utm_medium: 'paid_social',
    utm_campaign: '',
    utm_term: '',
    utm_content: '',
    utm_info: '',
    utm_id: '',
    utm_creative: '',
    utm_placement: '',
    landing_page: '',
    referrer: '',
    fbclid: ''
  };
  const [createLeadForm, setCreateLeadForm] = useState(defaultCreateLeadForm);
  const [manualUploadFile, setManualUploadFile] = useState(null);
  const [manualUploadResult, setManualUploadResult] = useState(null);
  const [showManualUploadResultModal, setShowManualUploadResultModal] = useState(false);
  
  // Dashboard Filters
  const [dashSelectedBank, setDashSelectedBank] = useState('');
  const [dashCreatedDate, setDashCreatedDate] = useState('');
  const [dashDateTo, setDashDateTo] = useState('');
  const [dashCardType, setDashCardType] = useState('');
  const [dashState, setDashState] = useState('');
  const [dashKycStatus, setDashKycStatus] = useState('');
  const [dashIpaStatus, setDashIpaStatus] = useState('');
  const [dashFinalDecision, setDashFinalDecision] = useState('');
  const [dashCardName, setDashCardName] = useState('');
  const [dashCustomerType, setDashCustomerType] = useState('');
  const [dashCurrentStage, setDashCurrentStage] = useState('');
  const [dashCardActivation, setDashCardActivation] = useState('');
  const [dashVkycStatus, setDashVkycStatus] = useState('');
  const [dashAgent, setDashAgent] = useState('');
  const [dashSourceType, setDashSourceType] = useState('');
  const [dashSoftDecision, setDashSoftDecision] = useState('');
  const [dashSoftDecisionDate, setDashSoftDecisionDate] = useState('');
  const [dashKycType, setDashKycType] = useState('');
  const [dashStpFlag, setDashStpFlag] = useState('');
  const [dashFinalStatus, setDashFinalStatus] = useState('');
  const [dashDecisionReason, setDashDecisionReason] = useState('');
  const [dashChannel, setDashChannel] = useState('');
  const [dashSearch, setDashSearch] = useState('');
  const [debouncedDashSearch, setDebouncedDashSearch] = useState('');
  const [dashFiltersExpanded, setDashFiltersExpanded] = useState(false);
  const [dashPage, setDashPage] = useState(1);
  const DASH_PAGE_SIZE = 50;
  const dashSearchTimer = useRef(null);

  // Debounce search input — only recalculate after 300ms of no typing
  useEffect(() => {
    if (dashSearchTimer.current) clearTimeout(dashSearchTimer.current);
    dashSearchTimer.current = setTimeout(() => {
      setDebouncedDashSearch(dashSearch);
      setDashPage(1);
    }, 300);
    return () => { if (dashSearchTimer.current) clearTimeout(dashSearchTimer.current); };
  }, [dashSearch]);

  // Reset page to 1 whenever any filter changes
  useEffect(() => {
    setDashPage(1);
  }, [dashCreatedDate, dashDateTo, dashCardType, dashState, dashKycStatus, dashIpaStatus, dashFinalDecision, dashCardName, dashCustomerType, dashCurrentStage, dashCardActivation, dashVkycStatus, dashAgent, dashSourceType, dashSelectedBank]);

  const [newBankInput, setNewBankInput] = useState('');
  const [newCardForm, setNewCardForm] = useState({ name: '', bank: '', category: 'Offline', ad_id: '', utm_internal: '', description: '', redirect_url_template: '', display_order: 1, active: true, card_locations: [] });
  const [newAgentForm, setNewAgentForm] = useState({ id: '', name: '', phone: '', email: '', username: '', password: '', status: 'active', locations: [], assigned_bank: '', agent_mode: 'lead_agent', can_create_leads: true, can_upload_mis: false });
  const [uploadedFilesList, setUploadedFilesList] = useState([]);
  const [showUploadedFilesModal, setShowUploadedFilesModal] = useState(false);
  const [isLoadingUploadedFiles, setIsLoadingUploadedFiles] = useState(false);
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

    let isCleaningUp = false;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const wsProto = (window.location.protocol === 'https:' || !isLocal) ? 'wss:' : 'ws:';
    const wsUrl = isLocal
      ? `ws://${window.location.hostname}:5000` 
      : `${wsProto}//${window.location.host}/api/ws`;
    let socket;
    let reconnectTimer;
    let reconnectDelay = 3000;

    const connectWebSocket = () => {
      if (isCleaningUp) return;
      try {
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          reconnectDelay = 3000;
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === 'LEAD_ADDED') {
              showToast(`🎉 New Lead Registered: ${message.data?.full_name || 'Customer'} (${message.data?.urn || 'Lead'})`, 'success');
              fetchLeads(currentPage, leadsPerPage);
              if (activeTab === 'leads_dashboard' || activeTab === 'mis') fetchMISStats();
            } else if (message.type === 'LEAD_UPDATED' || message.type === 'LEADS_UPDATED' || message.type === 'MIS_UPDATED') {
              fetchLeads(currentPage, leadsPerPage);
              if (activeTab === 'leads_dashboard' || activeTab === 'mis') fetchMISStats();
            } else if (message.type === 'NOTIFICATION_ADDED' || message.type === 'NOTIFICATION_UPDATED') {
              fetchNotifications();
            } else if (message.type === 'WA_STATUS_UPDATE') {
              setBaileysStatus(message.data);
            } else if (
              message.type === 'CARDS_UPDATED' || 
              message.type === 'AGENTS_UPDATED' || 
              message.type === 'LOCATIONS_UPDATED' || 
              message.type === 'SETTINGS_UPDATED'
            ) {
              loadAllAdminData();
            }
          } catch (err) {
            // silent
          }
        };

        socket.onclose = () => {
          if (isCleaningUp) return;
          reconnectTimer = setTimeout(() => {
            if (!isCleaningUp) {
              reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
              connectWebSocket();
            }
          }, reconnectDelay);
        };

        socket.onerror = () => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            try { socket.close(); } catch(e) {}
          }
        };
      } catch (err) {}
    };

    const handlePageHide = () => {
      isCleaningUp = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) {
        try { socket.close(); } catch(e) {}
      }
    };

    const handlePageShow = (e) => {
      if (e.persisted) {
        isCleaningUp = false;
        connectWebSocket();
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    connectWebSocket();

    return () => {
      isCleaningUp = true;
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) {
        try { socket.close(); } catch(e) {}
      }
    };
  }, [isAuthenticated, currentPage, leadsPerPage, activeTab]);

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

  useEffect(() => {
    if (settings.bank_mis_mappings) {
      try {
        const parsed = typeof settings.bank_mis_mappings === 'string'
          ? JSON.parse(settings.bank_mis_mappings)
          : settings.bank_mis_mappings;
        if (parsed && typeof parsed === 'object') {
          setBankMisMappings(parsed);
        }
      } catch (err) {
        console.error('Failed to parse bank_mis_mappings:', err);
      }
    }
  }, [settings.bank_mis_mappings]);

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
        endDate: filterEndDate,
        campaign: filterCampaign,
        term: filterTerm,
        info: filterInfo
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

  // ── Notification Center & Email MIS Handlers ──
  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadNotifCount(data.unreadCount || 0);
      }
    } catch (e) {
      console.error('Fetch notifications error:', e);
    }
  }, [token]);

  const markAllNotifsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const clearAllNotifs = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEmailConfig = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/email-mis-config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEmailMisConfig(data);
        setEmailConfigForm({
          receiver_email: data.receiver_email || '',
          app_password: '',
          sender_email: data.sender_email || '',
          subject_keywords: Array.isArray(data.subject_keywords) ? data.subject_keywords.join(', ') : '',
          enabled: data.enabled !== undefined ? data.enabled : true
        });
      }
    } catch (e) {
      console.error('Fetch email config error:', e);
    }
  }, [token]);

  const fetchKiwiEmailConfig = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/kiwi-email-mis-config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setKiwiEmailMisConfig(data);
        setKiwiEmailConfigForm({
          receiver_email: data.receiver_email || '',
          app_password: '',
          sender_email: data.sender_email || '',
          subject_keywords: Array.isArray(data.subject_keywords) ? data.subject_keywords.join(', ') : '',
          enabled: data.enabled !== undefined ? data.enabled : true
        });
      }
    } catch (e) {
      console.error('Fetch kiwi email config error:', e);
    }
  }, [token]);

  const triggerManualEmailSync = async () => {
    setIsSyncingEmailMis(true);
    try {
      const res = await fetch('/api/admin/sync-email-mis', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        alert(`🎉 SBI Email MIS Sync completed!\nProcessed Files: ${data.processedFiles}\nMapped Leads: ${data.mappedLeads}\nDuplicate Name Warnings: ${data.warnings}`);
        fetchNotifications();
        fetchMISStats();
        fetchLeads(1, leadsPerPage);
      } else {
        alert(`❌ Email MIS Sync Info: ${data.error || data.reason || 'No new SBI MIS emails found'}`);
      }
    } catch (e) {
      alert(`❌ Error connecting to server: ${e.message}`);
    } finally {
      setIsSyncingEmailMis(false);
    }
  };

  const triggerManualKiwiEmailSync = async () => {
    setIsSyncingKiwiEmailMis(true);
    try {
      const res = await fetch('/api/admin/sync-kiwi-email-mis', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        alert(`🎉 KIWI Email MIS Sync completed!\nProcessed Files: ${data.processedFiles}\nMapped Leads: ${data.mappedLeads}`);
        fetchNotifications();
        fetchMISStats();
        fetchLeads(1, leadsPerPage);
      } else {
        alert(`❌ KIWI Email MIS Sync Info: ${data.error || data.reason || 'No new KIWI MIS emails found'}`);
      }
    } catch (e) {
      alert(`❌ Error connecting to server: ${e.message}`);
    } finally {
      setIsSyncingKiwiEmailMis(false);
    }
  };

  const triggerRemoveDuplicates = async () => {
    if (!window.confirm('Are you sure you want to run deduplication? This will permanently delete duplicate leads.')) return;
    try {
      const res = await fetch('/api/admin/remove-duplicates', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        alert(`🎉 Deduplication completed! Removed ${data.removedCount} duplicate leads.`);
        fetchLeads(1, leadsPerPage);
      } else {
        alert(`❌ Error: ${data.error || 'Failed to remove duplicates'}`);
      }
    } catch (e) {
      alert(`❌ Error connecting to server: ${e.message}`);
    }
  };

  const handleSaveKiwiEmailConfigSubmit = async (e) => {
    e.preventDefault();
    setKiwiEmailConfigError('');
    setKiwiEmailConfigSuccess('');

    if (!kiwiEmailConfigDevPass) {
      setKiwiEmailConfigError('Developer Authorization Password (Lakshay@123) is required!');
      return;
    }

    try {
      const keywordsArr = kiwiEmailConfigForm.subject_keywords.split(',').map(k => k.trim()).filter(Boolean);
      const res = await fetch('/api/admin/kiwi-email-mis-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          devPassword: kiwiEmailConfigDevPass,
          receiver_email: kiwiEmailConfigForm.receiver_email,
          app_password: kiwiEmailConfigForm.app_password,
          sender_email: kiwiEmailConfigForm.sender_email,
          subject_keywords: keywordsArr,
          enabled: kiwiEmailConfigForm.enabled
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setKiwiEmailConfigSuccess('KIWI IMAP configuration updated successfully!');
        setKiwiEmailMisConfig(data.config);
        setTimeout(() => setShowKiwiEmailConfigModal(false), 1500);
      } else {
        setKiwiEmailConfigError(data.error || 'Failed to save configuration');
      }
    } catch (e) {
      setKiwiEmailConfigError(`Network Error: ${e.message}`);
    }
  };

  const handleSaveEmailConfigSubmit = async (e) => {
    e.preventDefault();
    setEmailConfigError('');
    setEmailConfigSuccess('');

    if (!emailConfigDevPass) {
      setEmailConfigError('Developer Authorization Password (Lakshay@123) is required!');
      return;
    }

    try {
      const keywordsArr = emailConfigForm.subject_keywords.split(',').map(k => k.trim()).filter(Boolean);
      const res = await fetch('/api/admin/email-mis-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          devPassword: emailConfigDevPass,
          receiver_email: emailConfigForm.receiver_email,
          app_password: emailConfigForm.app_password,
          sender_email: emailConfigForm.sender_email,
          subject_keywords: keywordsArr,
          enabled: emailConfigForm.enabled
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setEmailConfigSuccess('IMAP Email Settings saved successfully!');
        fetchEmailConfig();
        setTimeout(() => {
          setShowEmailConfigModal(false);
          setEmailConfigDevPass('');
          setEmailConfigSuccess('');
        }, 1500);
      } else {
        setEmailConfigError(data.error || 'Failed to save configuration');
      }
    } catch (err) {
      setEmailConfigError(err.message || 'Server connection error');
    }
  };

  const fetchDbBanks = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/banks', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.banks && Array.isArray(data.banks)) {
          setDbBankList(data.banks);
        }
      }
    } catch (e) {
      console.error('Fetch DB banks error:', e);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'leads_dashboard' && isAuthenticated && token) {
      fetchMISStats();
    }
  }, [activeTab, isAuthenticated, token]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchNotifications();
      fetchEmailConfig();
      fetchKiwiEmailConfig();
      fetchDbBanks();
    }
  }, [isAuthenticated, token, fetchNotifications, fetchEmailConfig, fetchKiwiEmailConfig, fetchDbBanks]);

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
        endDate: filterEndDate,
        campaign: filterCampaign,
        term: filterTerm,
        info: filterInfo
      });

      // 1. Fetch primary leads table data immediately
      const leadsRes = await fetch(`${API_URL}/leads?${queryParams.toString()}`, { headers });
      if (leadsRes.status === 401 || leadsRes.status === 403) {
        setLoading(false);
        handleLogout();
        return;
      }
      setIsAuthenticated(true);

      const leadsData = await leadsRes.json();
      setLeads(leadsData.leads || []);
      setCurrentPage(leadsData.page || 1);
      setTotalPages(leadsData.totalPages || 1);
      setTotalLeadsCount(leadsData.total || 0);
      setTodaysLeadsCount(leadsData.todaysCount || 0);

      // Turn off loading IMMEDIATELY so UI renders without delay
      setLoading(false);

      // 2. Fetch auxiliary metadata concurrently in background
      Promise.all([
        fetch(`${API_URL}/admin/cards`, { headers }).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/agents`, { headers }).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/locations`).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/settings`).then(r => r.json()).catch(() => ({})),
        fetch(`${API_URL}/whatsapp/status`, { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_URL}/leads/utm-options`, { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_URL}/leads/mis-stats`, { headers }).then(r => r.ok ? r.json() : null).catch(() => null)
      ]).then(([cardsData, agentsData, locsData, settingsData, baileysData, utmData, misData]) => {
        if (Array.isArray(cardsData)) setCards(cardsData);
        if (Array.isArray(agentsData)) setAgents(agentsData);
        if (Array.isArray(locsData)) setLocations(locsData);
        if (settingsData) setSettings(settingsData);
        if (baileysData) setBaileysStatus(baileysData);
        if (utmData) setUtmOptions(utmData);
        if (misData) setMisStats(misData);
      });
    } catch (err) {
      console.error('Error fetching admin dashboard details:', err);
      if (String(err).includes('Failed to fetch')) {
        showToast('Connection blocked by browser due to invalid SSL certificate on finmantra.org. Please renew SSL cert on EC2.', 'error');
      } else {
        showToast('Error syncing with database.', 'error');
      }
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCard, filterSource, filterStartDate, filterEndDate, filterCampaign, filterTerm, filterInfo]);

  // Refetch leads when pagination/filters change (debounced for search)
  useEffect(() => {
    if (!isAuthenticated || !token) return;
    const timer = setTimeout(() => {
      fetchLeads(currentPage, leadsPerPage);
    }, searchTerm ? 400 : 0); // Debounce search, instant for other filters
    return () => clearTimeout(timer);
  }, [currentPage, leadsPerPage, searchTerm, filterCard, filterSource, filterStartDate, filterEndDate, filterCampaign, filterTerm, filterInfo, isAuthenticated, token]);

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
    setLoading(false);
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
    if (filterStartDate) queryParams.push(`startDate=${encodeURIComponent(filterStartDate)}`);
    if (filterEndDate) queryParams.push(`endDate=${encodeURIComponent(filterEndDate)}`);
    if (searchTerm) queryParams.push(`search=${encodeURIComponent(searchTerm)}`);
    if (filterCard) queryParams.push(`card=${encodeURIComponent(filterCard)}`);
    if (filterSource) queryParams.push(`source=${encodeURIComponent(filterSource)}`);
    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

    // Fetch filtered leads, create Blob, and trigger browser download:
    fetch(`${API_URL}/leads/export${queryString}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finmantra_leads${queryParams.length > 0 ? '_filtered' : ''}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch(err => showToast('Export failed.', 'error'));
  };

  const handleDownloadTemplate = () => {
    window.open(`${API_URL}/leads/download-template`, '_blank');
  };

  const handleCreateManualLead = async (e) => {
    e.preventDefault();
    if (!createLeadForm.full_name || !createLeadForm.phone) {
      showToast('Full Name and 10-digit Phone Number are required.', 'error');
      return;
    }
    if (!createLeadForm.agent_id && !canDelete) {
      showToast('Please select a valid Source Agent.', 'error');
      return;
    }

    setIsSubmittingLead(true);
    try {
      const res = await fetch(`${API_URL}/leads/create-manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(createLeadForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Lead record created successfully!');
        setShowCreateLeadModal(false);
        setCreateLeadForm(defaultCreateLeadForm);
        loadAllAdminData();
      } else {
        showToast(data.error || 'Failed to create lead', 'error');
      }
    } catch (err) {
      showToast('Connection error while creating lead.', 'error');
    } finally {
      setIsSubmittingLead(false);
    }
  };

  const handleUploadManualLeads = async (e) => {
    e.preventDefault();
    if (!manualUploadFile) {
      showToast('Please select an Excel or CSV file to upload.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', manualUploadFile);

    setIsUploadingManualLeads(true);
    let isSuccess = false;
    let responseData = null;

    try {
      const res = await fetch(`${API_URL}/leads/upload-manual`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      responseData = await res.json();
      if (res.ok && responseData.success) {
        isSuccess = true;
      } else {
        showToast(responseData?.error || 'Failed to process Excel/CSV lead file.', 'error');
      }
    } catch (err) {
      showToast('Error uploading lead file: ' + (err.message || 'Connection error'), 'error');
    } finally {
      setIsUploadingManualLeads(false);
    }

    if (isSuccess && responseData) {
      setManualUploadResult(responseData);
      setShowManualUploadResultModal(true);
      setShowUploadLeadsModal(false);
      setManualUploadFile(null);
      showToast(`Bulk lead upload complete! Created ${responseData.created} leads (${responseData.failed} rejected).`, responseData.created > 0 ? 'success' : 'info');
      try {
        await loadAllAdminData();
      } catch (refreshErr) {
        console.warn('Dashboard data refresh error after lead upload:', refreshErr);
      }
    }
  };

  const handleToggleAgentLeadAccess = async (agentId, currentStatus) => {
    try {
      const res = await fetch(`${API_URL}/agents/${agentId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ can_create_leads: !currentStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Agent permission updated: ${!currentStatus ? 'Access Granted' : 'Access Revoked'}`);
        loadAllAdminData();
      } else {
        showToast(data.error || 'Failed to update agent permission.', 'error');
      }
    } catch (err) {
      showToast('Error updating permission.', 'error');
    }
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
      pan_no: lead.pan_no || '',
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
      monthly_income: lead.monthly_income || '',
      dob: lead.dob || '',
      mother_name: lead.mother_name || '',
      current_address: lead.current_address || '',
      designation: lead.designation || '',
      company_name: lead.company_name || '',
      application_id: lead.application_id || ''
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
      setNewAgentForm({ id: '', name: '', phone: '', email: '', username: '', password: '', status: 'active', locations: [], assigned_bank: '' });
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

  const handleToggleAgentPermission = async (agentId, permField, currentValue) => {
    try {
      const updates = {};
      if (permField === 'can_create_leads') {
        const nextVal = !currentValue;
        updates.can_create_leads = nextVal;
        if (nextVal) {
          updates.can_upload_mis = false;
          updates.agent_mode = 'lead_agent';
        }
      } else if (permField === 'can_upload_mis') {
        const nextVal = !currentValue;
        updates.can_upload_mis = nextVal;
        if (nextVal) {
          updates.can_create_leads = false;
          updates.agent_mode = 'bank_mis_agent';
        }
      }
      await apiFetch(`${API_URL}/agents/${agentId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      showToast('Agent permission updated successfully.');
      loadAllAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to update agent permission.', 'error');
    }
  };

  const fetchUploadedFilesList = async () => {
    setIsLoadingUploadedFiles(true);
    try {
      const data = await apiFetch(`${API_URL}/admin/uploaded-lead-files`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUploadedFilesList(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast('Failed to load uploaded lead files history.', 'error');
    } finally {
      setIsLoadingUploadedFiles(false);
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
    { value: 'application_id', label: 'Application ID' },
    { value: 'created_at', label: 'Creation Date/Time' },
    { value: 'full_name', label: 'Full Name' },
    { value: 'phone', label: 'Phone Number' },
    { value: 'email', label: 'Email' },
    { value: 'pan_no', label: 'PAN Number' },
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
      { id: "redirect_url", header: "Redirect URL", source: "redirect_url" },
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
      { id: "utm_info", header: "UTM Source", source: "utm_info" },
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

  const cleanBankCode = (val) => {
    if (!val || !val.trim()) return '';
    let str = val.trim().replace(/\s+bank$/i, '').trim();
    if (str.toUpperCase() === 'ALL') return 'ALL';
    if (str.toUpperCase().includes('KIWI')) return 'KIWI';
    if (str.toLowerCase() === 'n/a' || str.toLowerCase() === 'na') return 'N/A';
    return str.toUpperCase();
  };

  const getBankOptions = useCallback(() => {
    if (settings && settings.card_manager_banks !== undefined && settings.card_manager_banks !== null) {
      const list = settings.card_manager_banks.split(',').map(cleanBankCode).filter(Boolean);
      if (!list.includes('OTHER')) list.push('OTHER');
      return list;
    }
    const set = new Set(dbBankList || ['HDFC', 'SBI', 'KIWI', 'SCAPIA']);
    const list = Array.from(set).filter(b => b !== 'OTHER').sort();
    list.push('OTHER');
    return list;
  }, [dbBankList, settings]);

  const getLeadBank = useCallback((lead) => {
    if (!lead) return 'OTHER';
    const md = lead.mis_data || {};
    const bankName = String(md.mis_bank_name || '').toUpperCase().trim();

    // 1. Inspect redirect_url, card_id, card_name, card_bank, landing_page, source, utm_source, utm_campaign
    const textToInspect = [
      lead.redirect_url,
      lead.card_id,
      lead.card_name,
      lead.card_bank,
      lead.landing_page,
      lead.source,
      lead.utm_source,
      lead.utm_campaign
    ].filter(Boolean).join(' ').toLowerCase();

    // Redirect card URL & Card Name take TOP PRIORITY over generic mis_bank_name
    if (textToInspect.includes('hdfc') || textToInspect.includes('pixel') || textToInspect.includes('applyonline.hdfcbank')) return 'HDFC';
    if (textToInspect.includes('sbi') || textToInspect.includes('simplyclick') || textToInspect.includes('sbicard')) return 'SBI';
    if (textToInspect.includes('kiwi') || textToInspect.includes('gokiwi')) return 'KIWI';
    if (textToInspect.includes('scapia')) return 'SCAPIA';
    if (textToInspect.includes('icici')) return 'ICICI';
    if (textToInspect.includes('axis')) return 'AXIS';
    if (textToInspect.includes('pnb')) return 'PNB';
    if (textToInspect.includes('yes')) return 'YES';
    if (textToInspect.includes('au')) return 'AU';

    // 2. Check cards catalog matching by card_id
    if (lead.card_id && cards && cards.length > 0) {
      const matchedCard = cards.find(c => c.id === lead.card_id);
      if (matchedCard && matchedCard.bank) {
        const bUpper = matchedCard.bank.trim().toUpperCase();
        if (bUpper.includes('HDFC') || bUpper.includes('PIXEL')) return 'HDFC';
        if (bUpper.includes('SBI') || bUpper.includes('SIMPLYCLICK')) return 'SBI';
        if (bUpper.includes('KIWI')) return 'KIWI';
        if (bUpper.includes('SCAPIA')) return 'SCAPIA';
        if (bUpper.includes('ICICI')) return 'ICICI';
        if (bUpper.includes('AXIS')) return 'AXIS';
        return bUpper;
      }
    }

    // 3. Fallback to explicit mis_bank_name if not OTHER
    if (bankName && bankName !== 'OTHER') {
      if (bankName.includes('KIWI')) return 'KIWI';
      if (bankName.includes('SBI')) return 'SBI';
      if (bankName.includes('HDFC')) return 'HDFC';
      if (bankName.includes('SCAPIA')) return 'SCAPIA';
      return bankName;
    }

    return 'OTHER';
  }, [cards]);

  const getLeadCardName = useCallback((lead) => {
    if (!lead) return 'Credit Card';
    if (lead.card_name && lead.card_name !== 'Public Redirection' && lead.card_name !== 'Generic' && lead.card_name.trim() !== '') {
      return lead.card_name;
    }
    const textToInspect = [
      lead.redirect_url,
      lead.card_id,
      lead.landing_page,
      lead.source,
      lead.utm_source,
      lead.utm_campaign,
      lead.utm_content
    ].filter(Boolean).join(' ').toLowerCase();

    if (textToInspect.includes('scapia')) return 'Scapia Digital';
    if (textToInspect.includes('gokiwi') || textToInspect.includes('kiwi')) return 'Yes_Kiwi';
    if (textToInspect.includes('simplyclick')) return 'SBI SimplyClick';
    if (textToInspect.includes('sbicard') || textToInspect.includes('sbi')) return 'SBI Online';
    if (textToInspect.includes('pixel')) return 'Pixel';
    if (textToInspect.includes('tdcc') || textToInspect.includes('tata')) return 'TATA';
    if (textToInspect.includes('hdfc')) return 'HDFC Card';
    if (textToInspect.includes('axis')) return 'Axis Card';
    if (textToInspect.includes('icici')) return 'ICICI Card';

    return 'Credit Card';
  }, []);

  // ===== MEMOIZED LEADS DASHBOARD COMPUTATIONS =====

  // 1. Memoize the full leads list reference
  const allMappedLeads = useMemo(() => misStats?.mappedLeadsList || [], [misStats]);

  // 2. Memoize filter dropdown options (computed once when data changes, not on every filter change)
  const filterOptions = useMemo(() => {
    const opts = {};
    const agentSet = new Set();
    const fieldSets = {
      card_type: new Set(), state: new Set(), kyc_status: new Set(),
      ipa_status: new Set(), final_decision: new Set(), card_name: new Set(),
      customer_type: new Set(), current_stage: new Set(), card_activation_status: new Set(),
      vkyc_status: new Set(), source_type: new Set(),
      sd_decision_code: new Set(), kyc_mode: new Set(), stp_flag: new Set(),
      stage_in_sales24: new Set(), decision_code_reason1_wcp: new Set(), channel: new Set()
    };
    for (let i = 0; i < allMappedLeads.length; i++) {
      const l = allMappedLeads[i];
      if (l.agent_name) agentSet.add(l.agent_name);
      const md = l.mis_data;
      if (md) {
        for (const field in fieldSets) {
          const v = md[field] || md[field.toUpperCase()] || 
            (field === 'sd_decision_code' ? (md.SD_DECISION_CODE || md.SOFT_DECISION_TYPE) : null) || 
            (field === 'stage_in_sales24' ? (md.STAGE_IN_SALES24 || md.FINAL_STATUS) : null) || 
            (field === 'kyc_mode' ? (md.KYC_MODE || md.kyc_type) : null) || 
            (field === 'stp_flag' ? (md.STP_FLAG || md.stp_flag) : null) || 
            (field === 'decision_code_reason1_wcp' ? (md.DECISION_CODE_REASON1_WCP || md.reject_reason) : null) || 
            (field === 'channel' ? (md.CHANNEL || md.source_type) : null);
          if (v && String(v).trim()) fieldSets[field].add(String(v).trim());
        }
      }
    }
    for (const field in fieldSets) {
      opts[field] = Array.from(fieldSets[field]).sort();
    }
    opts.agents = Array.from(agentSet).sort();
    return opts;
  }, [allMappedLeads]);

  // Default dashSelectedBank
  useEffect(() => {
    if (!dashSelectedBank || dashSelectedBank === 'All') {
      const opts = getBankOptions();
      if (opts.length > 0) {
        setDashSelectedBank(opts[0]);
      } else {
        setDashSelectedBank('HDFC');
      }
    }
  }, [getBankOptions, dashSelectedBank]);

  // 3. Memoize the filtered list — only recompute when data or filters change
  const filteredMappedLeads = useMemo(() => {
    const searchLower = debouncedDashSearch ? debouncedDashSearch.toLowerCase() : '';
    const normSelectedBank = cleanBankCode(dashSelectedBank);

    return allMappedLeads.filter(lead => {
      if (searchLower) {
        const urn = String(lead.urn || '').toLowerCase();
        const name = String(lead.full_name || '').toLowerCase();
        const bankRef = String(lead.mis_data?.bank_reference_number || '').toLowerCase();
        if (!urn.includes(searchLower) && !name.includes(searchLower) && !bankRef.includes(searchLower)) return false;
      }
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
          } else { return false; }
        } else { return false; }
      }
      if (dashCardType && lead.mis_data?.card_type !== dashCardType) return false;
      if (dashState && lead.mis_data?.state?.toLowerCase() !== dashState.toLowerCase()) return false;
      if (dashKycStatus && lead.mis_data?.kyc_status !== dashKycStatus) return false;
      if (dashIpaStatus && lead.mis_data?.ipa_status !== dashIpaStatus) return false;
      if (dashFinalDecision && lead.mis_data?.final_decision !== dashFinalDecision) return false;
      if (dashCardName && lead.mis_data?.card_name !== dashCardName) return false;
      if (dashCustomerType && lead.mis_data?.customer_type !== dashCustomerType) return false;
      if (dashCurrentStage && lead.mis_data?.current_stage !== dashCurrentStage) return false;
      if (dashCardActivation && lead.mis_data?.card_activation_status !== dashCardActivation) return false;
      if (dashVkycStatus && lead.mis_data?.vkyc_status !== dashVkycStatus) return false;
      if (dashAgent && lead.agent_name !== dashAgent) return false;
      if (dashSourceType && lead.mis_data?.source_type !== dashSourceType) return false;
      if (dashSoftDecision && String(lead.mis_data?.SD_DECISION_CODE || lead.mis_data?.SOFT_DECISION_TYPE || '').toLowerCase() !== dashSoftDecision.toLowerCase()) return false;
      if (dashSoftDecisionDate && String(lead.mis_data?.SD_DECISION_DATE || '').split('T')[0] !== dashSoftDecisionDate) return false;
      if (dashKycType && String(lead.mis_data?.KYC_MODE || lead.mis_data?.kyc_type || '').toLowerCase() !== dashKycType.toLowerCase()) return false;
      if (dashStpFlag && String(lead.mis_data?.STP_FLAG || lead.mis_data?.stp_flag || '').toLowerCase() !== dashStpFlag.toLowerCase()) return false;
      if (dashFinalStatus && String(lead.mis_data?.STAGE_IN_SALES24 || lead.mis_data?.FINAL_STATUS || '').toLowerCase() !== dashFinalStatus.toLowerCase()) return false;
      if (dashDecisionReason && String(lead.mis_data?.DECISION_CODE_REASON1_WCP || lead.mis_data?.reject_reason || '').toLowerCase() !== dashDecisionReason.toLowerCase()) return false;
      if (dashChannel) {
        const gemId = String(lead.mis_data?.GEMID_1 || lead.mis_data?.LEAD_GEMID_1 || lead.mis_data?.gem_id || lead.mis_data?.CHANNEL || lead.mis_data?.source_type || '').toUpperCase();
        if (dashChannel === 'SSAA1' && !gemId.includes('SSAA1')) return false;
        if (dashChannel === 'SSAR1' && !gemId.includes('SSAR1')) return false;
        if (dashChannel !== 'SSAA1' && dashChannel !== 'SSAR1' && !gemId.toLowerCase().includes(dashChannel.toLowerCase())) return false;
      }
      if (normSelectedBank && normSelectedBank !== 'ALL') {
        const leadBank = getLeadBank(lead);
        if (leadBank !== normSelectedBank) return false;
      } else if (!normSelectedBank || normSelectedBank === 'ALL') {
        // Since we removed 'All', if it somehow gets here without a bank selected, we don't return all leads anymore to avoid user confusion
        // But if we want to ensure it works, we should just return false until a bank is selected
        return false;
      }
      return true;
    });
  }, [allMappedLeads, debouncedDashSearch, dashCreatedDate, dashDateTo, dashCardType, dashState, dashKycStatus, dashIpaStatus, dashFinalDecision, dashCardName, dashCustomerType, dashCurrentStage, dashCardActivation, dashVkycStatus, dashAgent, dashSourceType, dashSelectedBank, getLeadBank, dashSoftDecision, dashSoftDecisionDate, dashKycType, dashStpFlag, dashFinalStatus, dashDecisionReason, dashChannel]);

  // 4. Single-pass stats computation — replaces 8 forEach + 6 filter calls
  const dashStats = useMemo(() => {
    let approvedCount = 0, rejectedCount = 0, pendingCount = 0;
    let funnelIpa = 0, funnelKyc = 0, funnelDecision = 0, funnelActive = 0;
    let funnelBankRef = 0, funnelCurrentState = 0, funnelWinningBank = 0;
    let funnelSoftDecision = 0, funnelWorkFlow = 0, funnelFinalStatus = 0, funnelCardGen = 0;
    let ipaApproved = 0, ipaDeclined = 0;
    let kiwiSoftApproved = 0, kiwiVkycApproved = 0, kiwiCardCreated = 0, kiwiFirstTxn = 0;
    let sdApprovedCount = 0, sbiFinalApprovedCount = 0;
    const kycDist = {}, srcDist = {}, cardTypeDist = {}, custTypeDist = {};
    const actDist = {}, pinDist = {}, prodDist = {};
    // SBI-specific distributions
    const sdDecisionDist = {}, kycModeDist = {}, stpFlagDist = {};
    const finalStatusDist = {}, decisionReasonDist = {}, channelDist = {}, leadCreationDist = {};
    // Kiwi-specific distributions
    const kiwiSoftDist = {}, kiwiVkycDist = {}, kiwiCardDist = {}, kiwiBankDist = {};

    for (let i = 0; i < filteredMappedLeads.length; i++) {
      const l = filteredMappedLeads[i];
      const md = l.mis_data || {};

      // Status counts
      if (l.mis_status === 'Approved') approvedCount++;
      else if (l.mis_status === 'Rejected') rejectedCount++;
      else if (l.mis_status === 'Pending') pendingCount++;

      // Funnel counts (Generic / HDFC)
      const ipaLower = String(md.ipa_status || '').toLowerCase();
      if (ipaLower.includes('approve') || ipaLower.includes('pass') || ipaLower.includes('eligible') || ipaLower.includes('success')) { funnelIpa++; ipaApproved++; }
      if (ipaLower.includes('decline') || ipaLower.includes('reject') || ipaLower.includes('cancel')) ipaDeclined++;

      const ksLower = String(md.kyc_status || '').toLowerCase();
      const vsLower = String(md.vkyc_status || '').toLowerCase();
      const ktLower = String(md.kyc_type || '').toLowerCase();
      if (ksLower.includes('success') || ksLower.includes('complete') || vsLower.includes('success') || vsLower.includes('complete') || ksLower.includes('biokyc') || ktLower.includes('biokyc')) funnelKyc++;

      const decLower = String(md.final_decision || '').toLowerCase();
      if (decLower.includes('approve') || decLower.includes('success')) funnelDecision++;

      const actLower = String(md.card_activation_status || '').toLowerCase();
      if (actLower.includes('active') || actLower === 'yes') funnelActive++;

      // Funnel counts (KIWI per Screenshot 2)
      const kiwiIpa = (String(md.ipa || md.ipa_status || md.SOFT_DECISION || md.ipa_state || '') + ' ' + String(md.pnb_state || '') + ' ' + String(md.yes_state || '') + ' ' + String(md.au_state || '')).toLowerCase();
      const isKiwiSoftApprove = kiwiIpa.includes('approve') || kiwiIpa.includes('pass') || kiwiIpa.includes('success') || kiwiIpa.includes('eligible') || kiwiIpa.includes('doc_upload') || kiwiIpa.includes('in_progress') || (md.ipa_date && String(md.ipa_date).trim() !== '');
      if (isKiwiSoftApprove) kiwiSoftApproved++;

      const kiwiKyc = (String(md.VKYC || md.vkyc_status || md.kyc_status || md.vkyc_state || md.kyc_state || '') + ' ' + String(md.pnb_state || '') + ' ' + String(md.yes_state || '') + ' ' + String(md.au_state || '')).toLowerCase();
      const isKiwiVkycApprove = kiwiKyc.includes('approve') || kiwiKyc.includes('complete') || kiwiKyc.includes('success') || kiwiKyc.includes('pass') || kiwiKyc.includes('vkyc') || kiwiKyc.includes('kyc');
      if (isKiwiVkycApprove) kiwiVkycApproved++;

      const kiwiCard = (String(md.Card_Created || md.card_activation_status || md.card_created || md.card_state || md.current_state || md.winning_state || md.mis_status || l.mis_status || '') + ' ' + String(md.pnb_state || '') + ' ' + String(md.yes_state || '') + ' ' + String(md.au_state || '')).toLowerCase();
      const isKiwiCardCreated = kiwiCard.includes('yes') || kiwiCard.includes('approve') || kiwiCard.includes('active') || kiwiCard.includes('created') || kiwiCard.includes('issued') || kiwiCard.includes('disbursed') || kiwiCard.includes('card_created') || kiwiCard === '1';
      if (isKiwiCardCreated) kiwiCardCreated++;

      const kiwiTxn = (String(md.first_txn || md.first_transaction || md.txn_state || md.card_activation_status || '') + ' ' + String(md.pnb_state || '') + ' ' + String(md.yes_state || '') + ' ' + String(md.au_state || '')).toLowerCase();
      const isKiwiTxn = kiwiTxn.includes('yes') || kiwiTxn.includes('complete') || kiwiTxn === '1' || kiwiTxn.includes('active') || kiwiTxn.includes('txn') || kiwiTxn.includes('activated');
      if (isKiwiTxn) kiwiFirstTxn++;

      if (md.bank_reference_number && String(md.bank_reference_number).trim() !== '') funnelBankRef++;
      const kiwiState = String(md.current_state || '').toLowerCase();
      if (kiwiState !== 'not_started' && kiwiState !== '') funnelCurrentState++;
      const winning = String(md.winning_bank || '').toLowerCase();
      if (winning === 'yes' || winning === 'au' || winning === 'pnb') funnelWinningBank++;

      // Funnel counts (SBI - STAGE_IN_SALES24 only for Final Decision)
      const sdType = String(md.SD_DECISION_CODE || md.SOFT_DECISION_TYPE || '').toLowerCase();
      if (sdType.includes('approve') || sdType.includes('pass') || sdType.includes('eligible')) {
        funnelSoftDecision++;
        sdApprovedCount++;
      }
      const stpFlagVal = String(md.STP_FLAG || md.stp_flag || '').toLowerCase();
      if (stpFlagVal === 'yes' || stpFlagVal === 'y' || stpFlagVal === '1' || stpFlagVal === 'true') funnelWorkFlow++;
      
      // SBI Final Decision strictly for STAGE_IN_SALES24 containing "APPL File Generated"
      const stageSalesVal = String(md.STAGE_IN_SALES24 || '').trim().toLowerCase();
      if (stageSalesVal.includes('appl file generated') || stageSalesVal.includes('appl file') || stageSalesVal.includes('appl_file_generated')) {
        funnelFinalStatus++;
        sbiFinalApprovedCount++;
      }

      // Distributions (single pass)
      const kycKey = md.kyc_status || 'Unknown';
      kycDist[kycKey] = (kycDist[kycKey] || 0) + 1;

      let srcKey = String(md.source_type || '').trim();
      if (!srcKey || srcKey === '-') srcKey = 'Blank';
      srcDist[srcKey] = (srcDist[srcKey] || 0) + 1;

      const ctKey = md.card_type || 'Unknown';
      cardTypeDist[ctKey] = (cardTypeDist[ctKey] || 0) + 1;

      const custKey = md.customer_type || 'Unknown';
      custTypeDist[custKey] = (custTypeDist[custKey] || 0) + 1;

      const actKey = md.card_activation_status || 'Inactive/Unknown';
      actDist[actKey] = (actDist[actKey] || 0) + 1;

      const pinKey = md.PIN_CODE || md.pin_code || l.pincode || 'Unknown';
      pinDist[pinKey] = (pinDist[pinKey] || 0) + 1;

      const prodKey = md.card_name || 'Unknown';
      prodDist[prodKey] = (prodDist[prodKey] || 0) + 1;

      // SBI-specific distributions (account for 100% of leads)
      const sdKey = String(md.SD_DECISION_CODE || md.SOFT_DECISION_TYPE || '').trim() || 'Unassigned / Pending';
      sdDecisionDist[sdKey] = (sdDecisionDist[sdKey] || 0) + 1;

      const kmKey = String(md.KYC_MODE || md.kyc_type || '').trim() || 'Unassigned';
      kycModeDist[kmKey] = (kycModeDist[kmKey] || 0) + 1;

      const sfKey = String(md.STP_FLAG || md.stp_flag || '').trim();
      const sfLabel = sfKey ? `STP: ${sfKey}` : 'STP: Unassigned';
      stpFlagDist[sfLabel] = (stpFlagDist[sfLabel] || 0) + 1;

      // Strictly STAGE_IN_SALES24 for SBI final status distribution
      const fsKey = String(md.STAGE_IN_SALES24 || '').trim() || 'Unassigned';
      finalStatusDist[fsKey] = (finalStatusDist[fsKey] || 0) + 1;

      const drKey = String(md.DECISION_CODE_REASON1_WCP || md.reject_reason || '').trim() || 'None / Not Specified';
      decisionReasonDist[drKey] = (decisionReasonDist[drKey] || 0) + 1;

      const chKey = String(md.CHANNEL || '').trim();
      if (chKey) channelDist[chKey] = (channelDist[chKey] || 0) + 1;

      const gemId = String(md.LEAD_GEMID_1 || md.gem_id || '').toUpperCase();
      let creationType = 'Other';
      if (gemId.includes('SSAA1')) creationType = 'Digital (SSAA1)';
      else if (gemId.includes('SSAR1')) creationType = 'Agents (SSAR1)';
      leadCreationDist[creationType] = (leadCreationDist[creationType] || 0) + 1;

      // Kiwi-specific distributions
      const kSoftKey = String(md.ipa || md.ipa_status || md.SOFT_DECISION || '').trim() || 'Unassigned / Pending';
      kiwiSoftDist[kSoftKey] = (kiwiSoftDist[kSoftKey] || 0) + 1;

      const kVkycKey = String(md.VKYC || md.vkyc_status || md.kyc_status || '').trim() || 'Unassigned';
      kiwiVkycDist[kVkycKey] = (kiwiVkycDist[kVkycKey] || 0) + 1;

      const kCardKey = String(md.Card_Created || md.card_activation_status || md.card_created || '').trim() || 'Unassigned';
      kiwiCardDist[kCardKey] = (kiwiCardDist[kCardKey] || 0) + 1;

      const kBankKey = String(md.winning_bank || md.kiwi_winning_bank || md.kiwi_bank || '').trim() || 'YES';
      kiwiBankDist[kBankKey] = (kiwiBankDist[kBankKey] || 0) + 1;
    }

    const totalSubmit = filteredMappedLeads.length;
    const approvalRate = totalSubmit > 0 ? ((approvedCount / totalSubmit) * 100).toFixed(1) : '0';

    const topPincodes = Object.entries(pinDist)
      .map(([pincode, count]) => ({ pincode, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    return {
      totalSubmit, approvedCount, rejectedCount, pendingCount, approvalRate,
      funnelIpa, funnelKyc, funnelDecision, funnelActive,
      funnelBankRef, funnelCurrentState, funnelWinningBank,
      funnelSoftDecision, funnelWorkFlow, funnelFinalStatus, funnelCardGen,
      ipaApproved, ipaDeclined,
      kiwiSoftApproved, kiwiVkycApproved, kiwiCardCreated, kiwiFirstTxn,
      sdApprovedCount, sbiFinalApprovedCount,
      kycDist, srcDist, cardTypeDist, custTypeDist, actDist, prodDist, topPincodes,
      sdDecisionDist, kycModeDist, stpFlagDist, finalStatusDist, decisionReasonDist, channelDist, leadCreationDist,
      kiwiSoftDist, kiwiVkycDist, kiwiCardDist, kiwiBankDist
    };
  }, [filteredMappedLeads]);

  // 5. Memoize geo/map data separately (heavy computation)
  const dashGeoData = useMemo(() => {
    const stateLeadCounts = aggregateLeadsByState(filteredMappedLeads);
    const maxStateLeads = Math.max(1, ...Object.values(stateLeadCounts));
    const topStates = Object.entries(stateLeadCounts)
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
    return { stateLeadCounts, maxStateLeads, topStates };
  }, [filteredMappedLeads]);

  // 6. Paginated table rows
  const paginatedLeads = useMemo(() => {
    const start = (dashPage - 1) * DASH_PAGE_SIZE;
    return filteredMappedLeads.slice(start, start + DASH_PAGE_SIZE);
  }, [filteredMappedLeads, dashPage]);

  const totalDashPages = useMemo(() => Math.max(1, Math.ceil(filteredMappedLeads.length / DASH_PAGE_SIZE)), [filteredMappedLeads.length]);

  // 7. Active filter count
  const activeFilterCount = useMemo(() => {
    return [dashCreatedDate, dashDateTo, dashCardType, dashState, dashKycStatus, dashIpaStatus, dashFinalDecision, dashCardName, dashCustomerType, dashCurrentStage, dashCardActivation, dashVkycStatus, dashAgent, dashSourceType, debouncedDashSearch, dashSoftDecision, dashSoftDecisionDate, dashKycType, dashStpFlag, dashFinalStatus, dashDecisionReason, dashChannel].filter(Boolean).length;
  }, [dashCreatedDate, dashDateTo, dashCardType, dashState, dashKycStatus, dashIpaStatus, dashFinalDecision, dashCardName, dashCustomerType, dashCurrentStage, dashCardActivation, dashVkycStatus, dashAgent, dashSourceType, debouncedDashSearch, dashSelectedBank, dashSoftDecision, dashSoftDecisionDate, dashKycType, dashStpFlag, dashFinalStatus, dashDecisionReason, dashChannel]);

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

  const handleSaveBankMisMappings = async (updatedMappings) => {
    setIsSubmitting(true);
    try {
      await apiFetch(`${API_URL}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bank_mis_mappings: JSON.stringify(updatedMappings)
        })
      });
      setBankMisMappings(updatedMappings);
      setSettings(prev => ({ ...prev, bank_mis_mappings: updatedMappings }));
      showToast('Bank MIS Column Mappings saved successfully!');
    } catch (err) {
      showToast(err.message || 'Failed to save Bank MIS Mappings.', 'error');
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
      { header: 'Redirect URL', getValue: l => {
        if (l.redirect_url) return l.redirect_url;
        const agentCode = l.agent_id || 'public';
        const dateCode = l.created_at ? new Date(l.created_at).toISOString().slice(0, 10).replace(/-/g, '') : '';
        const domain = window.location.hostname.includes('uat') ? 'https://uat.finmantra.org' : 'https://finmantra.org';
        return `${domain}/refer/${agentCode}/${dateCode}/${l.urn || ''}`;
      }},
      { header: 'Application ID', getValue: l => l.application_id || l.mis_data?.application_id || l.mis_data?.APPLICATION_NUMBER || l.mis_data?.application_id_bank_2 || l.mis_data?.user_id || 'N/A' },
      { header: 'Client Name', getValue: l => l.full_name },
      { header: 'Phone', getValue: l => l.phone || 'N/A' },
      { header: 'Email', getValue: l => l.email || 'N/A' },
      { header: 'PAN Number', getValue: l => l.pan_no || 'N/A' },
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
      <div className="split-login-container">
        {/* Background Video */}
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="login-bg-video"
        >
          <source src="/give_me_the_video_by_removing.mp4" type="video/mp4" />
        </video>

        {/* Left Side - Login Form */}
        <div className="login-left-side">
          <div className="login-form-wrapper">
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <img 
                src="/logo.jpg" 
                alt="FinMantra Logo" 
                style={{ 
                  width: '64px', 
                  height: '64px', 
                  borderRadius: '16px', 
                  objectFit: 'cover', 
                  margin: '0 auto 1.25rem auto', 
                  display: 'block', 
                  boxShadow: '0 8px 24px rgba(224, 168, 46, 0.25)',
                  border: '1.5px solid rgba(224, 168, 46, 0.4)'
                }} 
              />
              <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '0.35rem' }}>Admin Dashboard</h2>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>Secure administrative gatekeeper portal</p>
            </div>

            <form onSubmit={handleAdminLogin}>
              <input type="text" name="username" value="admin" autoComplete="username" style={{ display: 'none' }} readOnly />
              <div className="interactive-input-group" style={{ marginBottom: '1.75rem' }}>
                <label>Admin Security Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    className="interactive-input-field" 
                    placeholder="Enter password" 
                    value={adminPasswordInput} 
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    style={{ paddingRight: '45px' }}
                    autoComplete="current-password"
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
                <div style={{ background: 'rgba(209, 67, 67, 0.08)', border: '1px solid rgba(209, 67, 67, 0.15)', padding: '0.75rem 1rem', borderRadius: '8px', color: 'var(--err)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
                  {authError}
                </div>
              )}

              <button type="submit" className="btn-primary login-btn-interactive" disabled={loading || timeLeft > 0}>
                <span>{timeLeft > 0 ? `Blocked (Try in ${formatTime(timeLeft)})` : (loading ? 'Validating credentials...' : 'Enter Admin Room')}</span>
                <LogIn size={18} style={{ marginLeft: '0.25rem' }} />
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <a href="/" style={{ fontSize: '0.85rem', color: 'var(--gold-deep)', textDecoration: 'none', fontWeight: 700 }}>← Back to home</a>
            </div>
          </div>
        </div>

        {/* Right Side Spacer */}
        <div className="login-right-side"></div>
      </div>
    );
  }

  const hasData = (val) => {
    if (val === null || val === undefined) return false;
    const str = String(val).trim().toLowerCase();
    if (str === '' || str === 'n/a' || str === 'none' || str === 'null') return false;
    return true;
  };

  return (
    <div className={`admin-layout ${['leads', 'cards', 'agents', 'locations', 'settings'].includes(activeTab) ? 'desktop-no-scroll-layout' : ''}`} style={{ display: 'flex', width: '100%', background: 'var(--paper)', color: 'var(--ink)', minHeight: '100vh' }}>
      
      {/* Toast Notifications */}
      {message.text && (
        <div style={{ 
          position: 'fixed', 
          top: '20px', 
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

      {/* Mobile Top Navigation Bar (Active on Mobile <= 768px) */}
      <div className="admin-mobile-topbar glass-panel" style={{ 
        position: 'sticky', 
        top: '0.5rem', 
        zIndex: 1000, 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '0.75rem 1.25rem', 
        minHeight: '60px',
        margin: '0.5rem 0.5rem 1rem 0.5rem',
        backdropFilter: 'blur(12px)',
        background: 'var(--glass-bg)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 32px 0 rgba(17, 19, 43, 0.08)'
      }}>
        {/* Brand/Title */}
        <div className="admin-nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <img src="/logo.jpg" alt="FinMantra Logo" style={{ height: '34px', width: '34px', borderRadius: '8px', objectFit: 'cover' }} />
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.03em', color: 'var(--ink)' }}>
            FinMantra <span style={{ color: 'var(--gold-deep)', fontWeight: 500, fontSize: '0.85rem' }}>Admin</span>
          </span>
        </div>

        {/* Right side controls (Theme toggle + 3-Dot Mobile Menu Button) */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            className="theme-toggle-btn" 
            onClick={toggleTheme} 
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            style={{ padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '34px', width: '34px', borderRadius: '8px' }}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          <button
            onClick={() => {
              setShowNotifDrawer(!showNotifDrawer);
              if (!showNotifDrawer) fetchNotifications();
            }}
            title="Notification Center"
            style={{
              background: showNotifDrawer ? 'var(--paper)' : 'transparent',
              border: showNotifDrawer ? '1px solid var(--gold)' : '1px solid transparent',
              borderRadius: '8px',
              padding: '0.4rem',
              cursor: 'pointer',
              color: showNotifDrawer ? 'var(--gold-deep)' : 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '34px',
              width: '34px',
              position: 'relative',
              boxShadow: showNotifDrawer ? '0 4px 12px rgba(224, 168, 46, 0.15)' : 'none'
            }}
          >
            <Bell size={18} />
            {unreadNotifCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '0px',
                right: '0px',
                background: 'var(--err)',
                color: '#fff',
                fontSize: '0.55rem',
                fontWeight: 800,
                borderRadius: '50%',
                width: '14px',
                height: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(209, 67, 67, 0.4)'
              }}>
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </span>
            )}
          </button>

          <button 
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              padding: '0.4rem',
              cursor: 'pointer',
              color: 'var(--ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '34px',
              width: '34px'
            }}
          >
            <MoreVertical size={20} />
          </button>
        </div>

        {/* Mobile Dropdown Overlay Menu */}
        {showMobileMenu && (
          <div className="mobile-dropdown-menu" style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            left: 0,
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 12px 36px rgba(0,0,0,0.15)',
            padding: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            zIndex: 1100
          }}>
            <button 
              className={`nav-link ${activeTab === 'leads' ? 'active' : ''}`} 
              onClick={() => { setActiveTab('leads'); setShowMobileMenu(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.85rem', width: '100%', fontSize: '0.9rem', border: 'none', background: activeTab === 'leads' ? 'var(--paper-2)' : 'transparent', color: activeTab === 'leads' ? 'var(--gold-deep)' : 'var(--ink)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
              <BarChart3 size={16} /> Leads Repository
            </button>
            <button 
              className={`nav-link ${activeTab === 'leads_dashboard' ? 'active' : ''}`} 
              onClick={() => { setActiveTab('leads_dashboard'); setShowMobileMenu(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.85rem', width: '100%', fontSize: '0.9rem', border: 'none', background: activeTab === 'leads_dashboard' ? 'var(--paper-2)' : 'transparent', color: activeTab === 'leads_dashboard' ? 'var(--gold-deep)' : 'var(--ink)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
              <TrendingUp size={16} /> Leads Dashboard
            </button>
            <button 
              className={`nav-link ${activeTab === 'cards' ? 'active' : ''}`} 
              onClick={() => { setActiveTab('cards'); setShowMobileMenu(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.85rem', width: '100%', fontSize: '0.9rem', border: 'none', background: activeTab === 'cards' ? 'var(--paper-2)' : 'transparent', color: activeTab === 'cards' ? 'var(--gold-deep)' : 'var(--ink)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
              <CreditCard size={16} /> Cards Manager
            </button>
            <button 
              className={`nav-link ${activeTab === 'agents' ? 'active' : ''}`} 
              onClick={() => { setActiveTab('agents'); setShowMobileMenu(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.85rem', width: '100%', fontSize: '0.9rem', border: 'none', background: activeTab === 'agents' ? 'var(--paper-2)' : 'transparent', color: activeTab === 'agents' ? 'var(--gold-deep)' : 'var(--ink)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
              <Users size={16} /> Agents Controller
            </button>
            <button 
              className={`nav-link ${activeTab === 'locations' ? 'active' : ''}`} 
              onClick={() => { setActiveTab('locations'); setShowMobileMenu(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.85rem', width: '100%', fontSize: '0.9rem', border: 'none', background: activeTab === 'locations' ? 'var(--paper-2)' : 'transparent', color: activeTab === 'locations' ? 'var(--gold-deep)' : 'var(--ink)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
              <MapPin size={16} /> Kiosks & Cities
            </button>
            <button 
              className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`} 
              onClick={() => { setActiveTab('settings'); setShowMobileMenu(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.85rem', width: '100%', fontSize: '0.9rem', border: 'none', background: activeTab === 'settings' ? 'var(--paper-2)' : 'transparent', color: activeTab === 'settings' ? 'var(--gold-deep)' : 'var(--ink)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
              <SettingsIcon size={16} /> Settings & API
            </button>
            <div style={{ height: '1px', background: 'var(--line)', margin: '0.4rem 0' }} />
            <button 
              onClick={() => { loadAllAdminData(); setShowMobileMenu(false); }} 
              className="btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.9rem' }}
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} /> Sync Data
            </button>
            <button 
              onClick={() => { handleLogout(); setShowMobileMenu(false); }} 
              className="btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.9rem', background: 'rgba(209, 67, 67, 0.1)', color: 'var(--err)', borderColor: 'rgba(209, 67, 67, 0.2)' }}
            >
              <LogOut size={16} /> Exit
            </button>
          </div>
        )}
      </div>

      {/* ICON-ONLY VERTICAL SIDEBAR */}
      <aside className="admin-sidebar" style={{
        width: '68px',
        minWidth: '68px',
        height: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem 0',
        background: 'var(--paper-2)',
        borderRight: '1px solid var(--line)',
        boxShadow: '2px 0 16px rgba(0,0,0,0.04)',
        boxSizing: 'border-box'
      }}>
        {/* Top: FinMantra Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%' }}>
          <div 
            onClick={() => navigateTo && navigateTo('/')} 
            title="FinMantra Admin Portal"
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
          >
            <img src="/logo.jpg" alt="FinMantra Logo" style={{ height: '38px', width: '38px', borderRadius: '10px', objectFit: 'cover', boxShadow: '0 3px 10px rgba(224, 168, 46, 0.3)' }} />
          </div>

          {/* Nav Icons Group (NO LABELS, ONLY ICONS) */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', alignItems: 'center' }}>
            <button
              onClick={() => setActiveTab('leads')}
              title="Leads Repository"
              className={`sidebar-icon-btn ${activeTab === 'leads' ? 'active' : ''}`}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: activeTab === 'leads' ? '1px solid var(--gold)' : '1px solid transparent',
                background: activeTab === 'leads' ? 'var(--paper)' : 'transparent',
                color: activeTab === 'leads' ? 'var(--gold-deep)' : 'var(--muted)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'leads' ? '0 4px 12px rgba(224, 168, 46, 0.15)' : 'none'
              }}
            >
              <BarChart3 size={20} />
            </button>

            <button
              onClick={() => setActiveTab('leads_dashboard')}
              title="Leads Dashboard"
              className={`sidebar-icon-btn ${activeTab === 'leads_dashboard' ? 'active' : ''}`}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: activeTab === 'leads_dashboard' ? '1px solid var(--gold)' : '1px solid transparent',
                background: activeTab === 'leads_dashboard' ? 'var(--paper)' : 'transparent',
                color: activeTab === 'leads_dashboard' ? 'var(--gold-deep)' : 'var(--muted)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'leads_dashboard' ? '0 4px 12px rgba(224, 168, 46, 0.15)' : 'none'
              }}
            >
              <TrendingUp size={20} />
            </button>

            <button
              onClick={() => setActiveTab('cards')}
              title="Cards Manager"
              className={`sidebar-icon-btn ${activeTab === 'cards' ? 'active' : ''}`}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: activeTab === 'cards' ? '1px solid var(--gold)' : '1px solid transparent',
                background: activeTab === 'cards' ? 'var(--paper)' : 'transparent',
                color: activeTab === 'cards' ? 'var(--gold-deep)' : 'var(--muted)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'cards' ? '0 4px 12px rgba(224, 168, 46, 0.15)' : 'none'
              }}
            >
              <CreditCard size={20} />
            </button>

            <button
              onClick={() => setActiveTab('agents')}
              title="Agents Controller"
              className={`sidebar-icon-btn ${activeTab === 'agents' ? 'active' : ''}`}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: activeTab === 'agents' ? '1px solid var(--gold)' : '1px solid transparent',
                background: activeTab === 'agents' ? 'var(--paper)' : 'transparent',
                color: activeTab === 'agents' ? 'var(--gold-deep)' : 'var(--muted)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'agents' ? '0 4px 12px rgba(224, 168, 46, 0.15)' : 'none'
              }}
            >
              <Users size={20} />
            </button>

            <button
              onClick={() => setActiveTab('locations')}
              title="Kiosks & Cities"
              className={`sidebar-icon-btn ${activeTab === 'locations' ? 'active' : ''}`}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: activeTab === 'locations' ? '1px solid var(--gold)' : '1px solid transparent',
                background: activeTab === 'locations' ? 'var(--paper)' : 'transparent',
                color: activeTab === 'locations' ? 'var(--gold-deep)' : 'var(--muted)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'locations' ? '0 4px 12px rgba(224, 168, 46, 0.15)' : 'none'
              }}
            >
              <MapPin size={20} />
            </button>

            {/* Notification Center Bell Icon */}
            <button
              onClick={() => {
                setShowNotifDrawer(!showNotifDrawer);
                if (!showNotifDrawer) fetchNotifications();
              }}
              title="Notification Center"
              className={`sidebar-icon-btn ${showNotifDrawer ? 'active' : ''}`}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                border: showNotifDrawer ? '1px solid var(--gold)' : '1px solid transparent',
                background: showNotifDrawer ? 'var(--paper)' : 'transparent',
                color: showNotifDrawer ? 'var(--gold-deep)' : 'var(--muted)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: showNotifDrawer ? '0 4px 12px rgba(224, 168, 46, 0.15)' : 'none'
              }}
            >
              <Bell size={20} />
              {unreadNotifCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: 'var(--err)',
                  color: '#fff',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  borderRadius: '10px',
                  minWidth: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  boxShadow: '0 2px 6px rgba(209, 67, 67, 0.4)'
                }}>
                  {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                </span>
              )}
            </button>

            <div 
              style={{ position: 'relative' }}
              onMouseEnter={() => setShowSettingsFlyout(true)}
              onMouseLeave={() => setShowSettingsFlyout(false)}
            >
              <button
                onClick={() => { setActiveTab('settings'); }}
                title="Settings & API"
                className={`sidebar-icon-btn ${activeTab === 'settings' ? 'active' : ''}`}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: activeTab === 'settings' ? '1px solid var(--gold)' : '1px solid transparent',
                  background: activeTab === 'settings' ? 'var(--paper)' : 'transparent',
                  color: activeTab === 'settings' ? 'var(--gold-deep)' : 'var(--muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: activeTab === 'settings' ? '0 4px 12px rgba(224, 168, 46, 0.15)' : 'none'
                }}
              >
                <SettingsIcon size={20} />
              </button>

              {showSettingsFlyout && (
                <div style={{
                  position: 'absolute',
                  left: '52px',
                  bottom: '-10px',
                  width: '210px',
                  background: 'var(--paper)',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                  padding: '0.5rem',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.2rem'
                }}>

                  <button 
                    onClick={() => { setActiveTab('settings'); setActiveSettingsSubTab('general'); setShowSettingsFlyout(false); }}
                    className="sidebar-flyout-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.55rem',
                      padding: '0.4rem 0.55rem',
                      borderRadius: '4px',
                      border: 'none',
                      background: activeTab === 'settings' && activeSettingsSubTab === 'general' ? 'rgba(224, 168, 46, 0.15)' : 'transparent',
                      color: activeTab === 'settings' && activeSettingsSubTab === 'general' ? 'var(--gold-deep)' : 'var(--ink)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s'
                    }}
                  >
                    <SettingsIcon size={13} /> General & Legal
                  </button>

                  <button 
                    onClick={() => { setActiveTab('settings'); setActiveSettingsSubTab('whatsapp_gateway'); setShowSettingsFlyout(false); }}
                    className="sidebar-flyout-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.55rem',
                      padding: '0.4rem 0.55rem',
                      borderRadius: '4px',
                      border: 'none',
                      background: activeTab === 'settings' && activeSettingsSubTab === 'whatsapp_gateway' ? 'rgba(224, 168, 46, 0.15)' : 'transparent',
                      color: activeTab === 'settings' && activeSettingsSubTab === 'whatsapp_gateway' ? 'var(--gold-deep)' : 'var(--ink)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s'
                    }}
                  >
                    <Layers size={13} /> WhatsApp Gateway
                  </button>

                  <button 
                    onClick={() => { setActiveTab('settings'); setActiveSettingsSubTab('meta_api'); setShowSettingsFlyout(false); }}
                    className="sidebar-flyout-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.55rem',
                      padding: '0.4rem 0.55rem',
                      borderRadius: '4px',
                      border: 'none',
                      background: activeTab === 'settings' && activeSettingsSubTab === 'meta_api' ? 'rgba(224, 168, 46, 0.15)' : 'transparent',
                      color: activeTab === 'settings' && activeSettingsSubTab === 'meta_api' ? 'var(--gold-deep)' : 'var(--ink)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s'
                    }}
                  >
                    <MessageSquare size={13} /> Meta Cloud API
                  </button>

                  <button 
                    onClick={() => { setActiveTab('settings'); setActiveSettingsSubTab('baileys'); setShowSettingsFlyout(false); }}
                    className="sidebar-flyout-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.55rem',
                      padding: '0.4rem 0.55rem',
                      borderRadius: '4px',
                      border: 'none',
                      background: activeTab === 'settings' && activeSettingsSubTab === 'baileys' ? 'rgba(224, 168, 46, 0.15)' : 'transparent',
                      color: activeTab === 'settings' && activeSettingsSubTab === 'baileys' ? 'var(--gold-deep)' : 'var(--ink)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s'
                    }}
                  >
                    <Smartphone size={13} /> Baileys Device
                  </button>

                  <button 
                    onClick={() => { setActiveTab('settings'); setActiveSettingsSubTab('csv_export'); setShowSettingsFlyout(false); }}
                    className="sidebar-flyout-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.55rem',
                      padding: '0.4rem 0.55rem',
                      borderRadius: '4px',
                      border: 'none',
                      background: activeTab === 'settings' && activeSettingsSubTab === 'csv_export' ? 'rgba(224, 168, 46, 0.15)' : 'transparent',
                      color: activeTab === 'settings' && activeSettingsSubTab === 'csv_export' ? 'var(--gold-deep)' : 'var(--ink)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s'
                    }}
                  >
                    <Download size={13} /> CSV Export Mapper
                  </button>

                  <button 
                    onClick={() => { setActiveTab('settings'); setActiveSettingsSubTab('tracking_api'); setShowSettingsFlyout(false); }}
                    className="sidebar-flyout-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.55rem',
                      padding: '0.4rem 0.55rem',
                      borderRadius: '4px',
                      border: 'none',
                      background: activeTab === 'settings' && activeSettingsSubTab === 'tracking_api' ? 'rgba(224, 168, 46, 0.15)' : 'transparent',
                      color: activeTab === 'settings' && activeSettingsSubTab === 'tracking_api' ? 'var(--gold-deep)' : 'var(--ink)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s'
                    }}
                  >
                    <Activity size={13} /> Meta CAPI & GTM
                  </button>

                  {canDelete && (
                    <button 
                      onClick={() => { setActiveTab('settings'); setActiveSettingsSubTab('mis_mapping'); setShowSettingsFlyout(false); }}
                      className="sidebar-flyout-item"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.55rem',
                        padding: '0.4rem 0.55rem',
                        borderRadius: '4px',
                        border: 'none',
                        background: activeTab === 'settings' && activeSettingsSubTab === 'mis_mapping' ? 'rgba(224, 168, 46, 0.15)' : 'transparent',
                        color: activeTab === 'settings' && activeSettingsSubTab === 'mis_mapping' ? 'var(--gold-deep)' : 'var(--ink)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.15s'
                      }}
                    >
                      <Database size={13} /> Bank MIS Mapping
                    </button>
                  )}
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Bottom Actions Group (NO LABELS, ONLY ICONS) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', alignItems: 'center' }}>
          <button 
            className="sidebar-icon-btn" 
            onClick={toggleTheme} 
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--line)',
              background: 'var(--paper)',
              color: 'var(--ink)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <button 
            onClick={loadAllAdminData} 
            className="sidebar-icon-btn" 
            title="Sync All Data"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--line)',
              background: 'var(--paper)',
              color: 'var(--ink)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
          </button>

          <button 
            onClick={handleLogout} 
            className="sidebar-icon-btn" 
            title="Logout / Exit Session"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(209, 67, 67, 0.2)',
              background: 'rgba(209, 67, 67, 0.08)',
              color: 'var(--err)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className={`admin-main-content ${['leads', 'cards', 'agents', 'locations', 'settings'].includes(activeTab) ? 'desktop-no-scroll-content' : ''}`} style={{ flex: 1, padding: '1rem 1.5rem', minWidth: 0, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        {/* Top Header Strip inside Main Content */}
        <div className="admin-header-bar" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '0.85rem',
          paddingBottom: '0.65rem',
          borderBottom: '1px solid var(--line)',
          flexShrink: 0
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.45rem', color: 'var(--ink)' }}>
                {activeTab === 'leads' && 'Leads Repository'}
                {activeTab === 'leads_dashboard' && 'Leads Mapping & Analytics'}
                {activeTab === 'cards' && 'Cards Catalog Manager'}
                {activeTab === 'agents' && 'Agents Controller'}
                {activeTab === 'locations' && 'Kiosks & City Locations'}
                {activeTab === 'settings' && 'System Settings & API'}
              </span>
              <span style={{ 
                fontSize: '0.7rem', 
                fontWeight: 700, 
                color: 'var(--gold-deep)', 
                background: 'rgba(224, 168, 46, 0.12)', 
                border: '1px solid rgba(224, 168, 46, 0.25)', 
                padding: '0.2rem 0.6rem', 
                borderRadius: '20px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                FinMantra Admin
              </span>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: 0 }}>
              {activeTab === 'leads' && 'View, search, filter, and export all customer leads registered in the database.'}
              {activeTab === 'leads_dashboard' && 'Visual analytics, conversion funnel, and geographical mapping from bank MIS uploads.'}
              {activeTab === 'cards' && 'Configure credit card offers, ad tracking parameters, and dynamic partner redirect templates.'}
              {activeTab === 'agents' && 'Manage field sales agents, login credentials, assigned banks, and kiosk permissions.'}
              {activeTab === 'locations' && 'Manage operational cities, kiosk centers, and serviceability locations.'}
              {activeTab === 'settings' && 'Configure WhatsApp API gateways, export templates, security access rules, and system settings.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginLeft: 'auto', flexShrink: 0 }}>
            {activeTab === 'leads' && (
              <>
                <button 
                  onClick={() => setShowCreateLeadModal(true)} 
                  className="btn-primary" 
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', height: '34px', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap', background: 'var(--gold-deep)', color: '#fff' }}
                >
                  <UserPlus size={14} /> Create Lead
                </button>
                <button 
                  onClick={() => setShowUploadLeadsModal(true)} 
                  className="btn-secondary" 
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', height: '34px', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  <FileSpreadsheet size={14} /> Upload Leads
                </button>
                <button 
                  onClick={() => { setShowUploadedFilesModal(true); fetchUploadedFilesList(); }} 
                  className="btn-secondary" 
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', height: '34px', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  <FolderArchive size={14} /> Uploaded Files
                </button>
                {canDelete && selectedLeads.length > 0 && (
                  <button onClick={handleBulkDeleteLeads} className="btn-secondary" style={{ background: 'rgba(209, 67, 67, 0.15)', color: 'var(--err)', border: '1px solid rgba(209, 67, 67, 0.2)', padding: '0.4rem 0.85rem', fontSize: '0.82rem', height: '34px', borderRadius: '2px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <Trash2 size={14} /> Delete ({selectedLeads.length})
                  </button>
                )}
                <button onClick={handleCsvExport} className="btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', height: '34px', borderRadius: '2px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <Download size={14} /> Export to CSV
                </button>
                <button onClick={() => setShowUploadMISModal(true)} className="btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', height: '34px', borderRadius: '2px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <Upload size={14} /> Upload MIS
                </button>
                <button 
                  onClick={async () => {
                    try {
                      showToast('Aligning leads by redirect card banks...', 'info');
                      const res = await fetch(`${API_URL}/leads/align-banks`, { method: 'POST', headers: getHeaders() });
                      const data = await res.json();
                      if (data.success) {
                        showToast(`🎉 ${data.message}`, 'success');
                        fetchLeads();
                      } else {
                        showToast(data.error || 'Alignment failed.', 'error');
                      }
                    } catch(e) {
                      showToast('Failed to connect to alignment server.', 'error');
                    }
                  }} 
                  className="btn-secondary" 
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', height: '34px', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap', color: 'var(--gold-deep)', borderColor: 'var(--gold-deep)' }}
                  title="Automatically align all lead banks to match their redirect card URLs"
                >
                  ⚡ Align Banks
                </button>
              </>
            )}

            {activeTab === 'leads_dashboard' && (
              <button 
                onClick={fetchMISStats} 
                className="btn-secondary"
                disabled={loadingMISStats}
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.4rem', 
                  padding: '0.4rem 0.9rem', 
                  fontSize: '0.82rem',
                  height: '34px',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <RefreshCw size={14} className={loadingMISStats ? 'spin' : ''} /> Sync Dashboard
              </button>
            )}
          </div>
        </div>

      {/* TAB CONTENT */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem', color: 'hsl(var(--text-muted))' }}>Syncing database logs...</div>
      ) : (
        <div style={{ flex: 1, height: '100%', minHeight: 0, overflow: 'hidden' }}>
          {/* LEADS TAB */}
          {activeTab === 'leads' && (
            <div className="admin-split-leads desktop-split-container" style={{ display: 'flex', gap: '1.25rem' }}>
              
              {/* Left Column: Fixed 4 Square Metric Cards Panel */}
              <div style={{ width: '150px', minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }} className="admin-left-metrics">
                <div className="glass-panel" style={{ width: '150px', height: '150px', borderRadius: 0, padding: '0.85rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', borderTop: '4px solid var(--gold-deep)', borderLeft: 'none', boxSizing: 'border-box' }}>
                  <div style={{ fontSize: '0.72rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Total Leads</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--ink)' }}>{totalLeadsCount}</div>
                  <div style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))' }}>Registered in DB</div>
                </div>

                <div className="glass-panel" style={{ width: '150px', height: '150px', borderRadius: 0, padding: '0.85rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', borderTop: '4px solid var(--gold-deep)', borderLeft: 'none', boxSizing: 'border-box' }}>
                  <div style={{ fontSize: '0.72rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Leads Today</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--gold-deep)' }}>{todaysLeadsCount}</div>
                  <div style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))' }}>Since 12:00 AM (IST)</div>
                </div>

                <div className="glass-panel" style={{ width: '150px', height: '150px', borderRadius: 0, padding: '0.85rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', borderTop: '4px solid var(--gold)', borderLeft: 'none', boxSizing: 'border-box' }}>
                  <div style={{ fontSize: '0.72rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Active Agents</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--gold-deep)' }}>{activeAgents.length}</div>
                  <div style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))' }}>Field officers active</div>
                </div>

                <div className="glass-panel" style={{ width: '150px', height: '150px', borderRadius: 0, padding: '0.85rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', borderTop: '4px solid hsl(var(--accent-gold))', borderLeft: 'none', boxSizing: 'border-box' }}>
                  <div style={{ fontSize: '0.72rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Cards Catalog</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--ink)' }}>{activeCards.length}</div>
                  <div style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))' }}>Active redirect options</div>
                </div>
              </div>

              {/* Right Column: Leads Log & Scrollable Table Panel */}
              <div className="glass-panel desktop-panel-fill" style={{ flex: 1, minWidth: 0, padding: '1.25rem' }}>
                


                {/* Filters */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem', alignItems: 'center', flexShrink: 0 }} className="filters-strip">
                  <div style={{ position: 'relative', flex: '2 1 220px', minWidth: '190px' }}>
                    <Search size={16} style={{ position: 'absolute', top: '10px', left: '12px', color: 'hsl(var(--text-muted))' }} />
                    <input 
                      type="text" 
                      placeholder="Search by name, phone, URN..." 
                      className="form-input" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ paddingLeft: '38px', height: '36px', fontSize: '0.8rem', width: '100%' }}
                    />
                  </div>
                  <select className="form-select" value={filterCard} onChange={(e) => setFilterCard(e.target.value)} style={{ flex: '1 1 140px', minWidth: '125px', height: '36px', fontSize: '0.8rem', textOverflow: 'ellipsis' }}>
                    <option value="">Filter by Card</option>
                    {cards.map(c => <option key={c.id} value={c.id}>{c.bank} {c.name}</option>)}
                  </select>
                  <select className="form-select" value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={{ flex: '1 1 140px', minWidth: '125px', height: '36px', fontSize: '0.8rem', textOverflow: 'ellipsis' }}>
                    <option value="">Filter by Source</option>
                    <option value="public">Public Website</option>
                    <option value="agent">Agent Walk-in</option>
                    <option value="kiwi">Kiwi Page</option>
                    <option value="simplyclick_sbi">SBI SimplyClick</option>
                    <option value="scapia">Scapia Landing Page</option>
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: '1 1 140px', minWidth: '130px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>From:</span>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      style={{ fontSize: '0.75rem', padding: '0.35rem', height: '36px', width: '100%' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: '1 1 140px', minWidth: '130px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>To:</span>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      style={{ fontSize: '0.75rem', padding: '0.35rem', height: '36px', width: '100%' }}
                    />
                  </div>
                  <select className="form-select" value={filterCampaign} onChange={(e) => setFilterCampaign(e.target.value)} style={{ flex: '1 1 140px', minWidth: '125px', height: '36px', fontSize: '0.8rem', textOverflow: 'ellipsis' }}>
                    <option value="">UTM Campaign</option>
                    {utmOptions.campaigns.map((c, i) => <option key={i} value={c}>{c}</option>)}
                  </select>
                  <select className="form-select" value={filterTerm} onChange={(e) => setFilterTerm(e.target.value)} style={{ flex: '1 1 140px', minWidth: '125px', height: '36px', fontSize: '0.8rem', textOverflow: 'ellipsis' }}>
                    <option value="">UTM Term</option>
                    {utmOptions.terms.map((t, i) => <option key={i} value={t}>{t}</option>)}
                  </select>
                  <select className="form-select" value={filterInfo} onChange={(e) => setFilterInfo(e.target.value)} style={{ flex: '1 1 140px', minWidth: '125px', height: '36px', fontSize: '0.8rem', textOverflow: 'ellipsis' }}>
                    <option value="">UTM Source</option>
                    {utmOptions.infos.map((inf, i) => <option key={i} value={inf}>{inf}</option>)}
                  </select>
                  <button 
                    onClick={() => { setSearchTerm(''); setFilterCard(''); setFilterSource(''); setFilterStartDate(''); setFilterEndDate(''); setFilterCampaign(''); setFilterTerm(''); setFilterInfo(''); }}
                    className="btn-secondary"
                    style={{ height: '36px', fontSize: '0.75rem', whiteSpace: 'nowrap', padding: '0 0.85rem', opacity: (searchTerm || filterCard || filterSource || filterStartDate || filterEndDate || filterCampaign || filterTerm || filterInfo) ? 1 : 0.5 }}
                    disabled={!(searchTerm || filterCard || filterSource || filterStartDate || filterEndDate || filterCampaign || filterTerm || filterInfo)}
                  >✕ Clear Filters</button>
                </div>

                {/* Scrollable Table Container */}
                <div className="data-table-container desktop-scroll-panel" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-md)' }}>
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
                        <th>Redirect URL</th>
                        <th>Date & Time</th>
                        <th>Name</th>
                        <th>WhatsApp No.</th>
                        <th>Card Selection</th>
                        <th style={{ width: '130px', maxWidth: '130px' }}>Email</th>
                        <th>PAN No.</th>
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
                            <td>
                              {(() => {
                                const agentCode = l.agent_id || 'public';
                                const dateCode = l.created_at ? new Date(l.created_at).toISOString().slice(0, 10).replace(/-/g, '') : '';
                                const domain = window.location.hostname.includes('uat') ? 'https://uat.finmantra.org' : 'https://finmantra.org';
                                const rUrl = l.redirect_url || `${domain}/refer/${agentCode}/${dateCode}/${l.urn || ''}`;
                                return (
                                  <a 
                                    href={rUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    style={{ fontSize: '0.75rem', color: 'var(--accent)', textDecoration: 'underline', maxWidth: '170px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} 
                                    title={rUrl}
                                  >
                                    {rUrl}
                                  </a>
                                );
                              })()}
                            </td>
                            <td>{formatDateTime(l.created_at)}</td>
                            <td style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => handleViewLead(l)}>{l.full_name}</td>
                            <td>{l.phone}</td>
                             <td>{getLeadCardName(l)} <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>({getLeadBank(l)})</span></td>
                             <td style={{ maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.email}>{l.email || '-'}</td>
                             <td><code style={{ fontSize: '0.8rem', color: 'var(--gold-deep)' }}>{l.pan_no || '-'}</code></td>
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
                          <td colSpan={canDelete ? 14 : 13} style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--text-muted))' }}>
                            No leads captured matching current filter query parameters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls at bottom of Right Panel */}
                <div style={{ 
                  display: 'flex', 
                  justify: 'space-between', 
                  alignItems: 'center', 
                  marginTop: '0.75rem', 
                  padding: '0.6rem 0.85rem', 
                  background: 'var(--paper-2)', 
                  border: '1px solid var(--line)', 
                  borderRadius: 'var(--radius-md)',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  flexShrink: 0
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Per page:</span>
                    <select 
                      className="form-select" 
                      value={leadsPerPage} 
                      onChange={(e) => {
                        setLeadsPerPage(parseInt(e.target.value, 10));
                        setCurrentPage(1);
                      }}
                      style={{ width: '75px', padding: '0.2rem 0.4rem', fontSize: '0.8rem', height: '30px' }}
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                    </select>
                  </div>
                  
                  <div style={{ fontSize: '0.8rem', color: 'var(--ink)', fontWeight: 600 }}>
                    {totalLeadsCount > 0 ? (currentPage - 1) * leadsPerPage + 1 : 0} - {Math.min(currentPage * leadsPerPage, totalLeadsCount)} of {totalLeadsCount}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                      disabled={currentPage === 1}
                      className="btn-secondary"
                      style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem', height: '30px', opacity: currentPage === 1 ? 0.5 : 1 }}
                    >
                      Prev
                    </button>
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{currentPage}/{totalPages}</span>
                    <button 
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                      disabled={currentPage === totalPages}
                      className="btn-secondary"
                      style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem', height: '30px', opacity: currentPage === totalPages ? 0.5 : 1 }}
                    >
                      Next
                    </button>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* LEADS DASHBOARD TAB */}
          {activeTab === 'leads_dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', textAlign: 'left' }}>


              {/* Filters Panel — uses memoized filterOptions & activeFilterCount */}
              <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <Filter size={14} style={{ color: 'var(--gold)' }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink)' }}>Filters (Dynamic Re-calculation)</span>
                        {activeFilterCount > 0 && (
                          <span style={{
                            background: 'var(--gold)', color: '#fff', fontSize: '0.65rem', fontWeight: 800,
                            padding: '0.15rem 0.5rem', borderRadius: '10px', minWidth: '20px', textAlign: 'center'
                          }}>{activeFilterCount}</span>
                        )}

                        <div style={{ display: 'inline-flex', gap: '0.25rem', padding: '2px', background: 'var(--paper-2)', borderRadius: '20px', border: '1px solid var(--line)', marginLeft: '0.5rem', flexWrap: 'wrap' }}>
                          {getBankOptions().map((b, idx) => (
                            <button key={idx} type="button" onClick={() => setDashSelectedBank(b)}
                              style={{
                                padding: '0.25rem 0.65rem', fontSize: '0.7rem', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 600,
                                background: dashSelectedBank === b ? 'var(--gold-deep)' : 'transparent',
                                color: dashSelectedBank === b ? '#fff' : 'var(--ink)', transition: 'all 0.15s'
                              }}
                            >{b}</button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button onClick={() => setDashFiltersExpanded(!dashFiltersExpanded)} className="btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          {dashFiltersExpanded ? 'Less Filters' : 'More Filters'}
                          <span style={{ fontSize: '0.6rem', transform: dashFiltersExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                        </button>
                        <button
                          onClick={() => {
                            setDashCreatedDate(''); setDashDateTo(''); setDashCardType(''); setDashState('');
                            setDashKycStatus(''); setDashIpaStatus(''); setDashFinalDecision(''); setDashCardName('');
                            setDashCustomerType(''); setDashCurrentStage(''); setDashCardActivation('');
                            setDashVkycStatus(''); setDashAgent(''); setDashSourceType(''); setDashSearch('');
                            setDashSoftDecision(''); setDashSoftDecisionDate(''); setDashKycType(''); setDashStpFlag('');
                            setDashFinalStatus(''); setDashDecisionReason(''); setDashChannel('');
                            const opts = getBankOptions();
                            setDashSelectedBank(opts.length > 0 ? opts[0] : 'HDFC');
                          }}
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem', opacity: activeFilterCount > 0 ? 1 : 0.5 }}
                          disabled={activeFilterCount === 0}
                        >Reset All</button>
                      </div>
                    </div>

                    {/* Search bar */}
                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                        <input
                          type="text" className="form-input"
                          placeholder="Search by URN, Name, or Bank Reference..."
                          value={dashSearch}
                          onChange={(e) => setDashSearch(e.target.value)}
                          style={{ paddingLeft: '2rem', padding: '0.45rem 0.6rem 0.45rem 2rem', fontSize: '0.8rem', width: '100%' }}
                        />
                      </div>
                    </div>

                    {/* Row 1: Primary filters */}
                    {(() => {
                      const fls = { padding: '0.4rem 0.6rem', fontSize: '0.78rem' };
                      const fll = { fontSize: '0.72rem', marginBottom: '3px', color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.3px' };
                      const FS = ({ label, value, onChange, options, placeholder }) => (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={fll}>{label}</label>
                          <select className="form-select" style={fls} value={value} onChange={(e) => onChange(e.target.value)}>
                            <option value="">{placeholder}</option>
                            {options.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                          </select>
                        </div>
                      );
                      return (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', alignItems: 'end' }} className="leads-filter-grid">
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={fll}>Date From (MIS)</label>
                              <input type="date" className="form-input" style={fls} value={dashCreatedDate} onChange={(e) => setDashCreatedDate(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={fll}>Date To (MIS)</label>
                              <input type="date" className="form-input" style={fls} value={dashDateTo} onChange={(e) => setDashDateTo(e.target.value)} />
                            </div>
                            <FS label="Card Type" value={dashCardType} onChange={setDashCardType} options={filterOptions.card_type} placeholder="All Card Types" />
                            <FS label="State" value={dashState} onChange={setDashState} options={filterOptions.state} placeholder="All States" />
                            <FS label="IPA Status" value={dashIpaStatus} onChange={setDashIpaStatus} options={filterOptions.ipa_status} placeholder="All IPA" />
                            {dashSelectedBank === 'SBI' ? (
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={fll}>Lead Creation Type</label>
                                <select className="form-select" style={fls} value={dashChannel} onChange={(e) => setDashChannel(e.target.value)}>
                                  <option value="">All Lead Types</option>
                                  <option value="SSAA1">Digital (SSAA1)</option>
                                  <option value="SSAR1">Agents (SSAR1)</option>
                                </select>
                              </div>
                            ) : (
                              <FS label="Final Decision" value={dashFinalDecision} onChange={setDashFinalDecision} options={filterOptions.final_decision} placeholder="All Decisions" />
                            )}
                          </div>

                            {dashFiltersExpanded && (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', alignItems: 'end', marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--line)' }} className="leads-filter-grid">
                                <FS label="Card Name" value={dashCardName} onChange={setDashCardName} options={filterOptions.card_name} placeholder="All Cards" />
                                <FS label="KYC Status" value={dashKycStatus} onChange={setDashKycStatus} options={filterOptions.kyc_status} placeholder="All KYC" />
                                 {dashSelectedBank === 'SBI' && (
                                  <>
                                    <FS label="Soft Decision Filter" value={dashSoftDecision} onChange={setDashSoftDecision} options={filterOptions.sd_decision_code || []} placeholder="All Soft Decisions" />
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                      <label className="form-label" style={fll}>Soft Decision Date</label>
                                      <input type="date" className="form-input" style={fls} value={dashSoftDecisionDate} onChange={(e) => setDashSoftDecisionDate(e.target.value)} />
                                    </div>
                                    <FS label="KYC Type Filter" value={dashKycType} onChange={setDashKycType} options={filterOptions.kyc_mode || []} placeholder="All KYC Modes" />
                                    <FS label="STP Flag" value={dashStpFlag} onChange={setDashStpFlag} options={filterOptions.stp_flag || []} placeholder="All STP Flags" />
                                    <FS label="Final Status" value={dashFinalStatus} onChange={setDashFinalStatus} options={filterOptions.stage_in_sales24 || []} placeholder="All Final Statuses" />
                                    <FS label="Decision Reason" value={dashDecisionReason} onChange={setDashDecisionReason} options={filterOptions.decision_code_reason1_wcp || []} placeholder="All Reasons" />
                                  </>
                                )}
                                {dashSelectedBank === 'KIWI' && (
                                  <>
                                    <FS label="Channel Filter" value={dashChannel} onChange={setDashChannel} options={['Digital', 'Offline']} placeholder="All Channels" />
                                    <FS label="Soft Decision Filter" value={dashSoftDecision} onChange={setDashSoftDecision} options={filterOptions.ipa_status || ['Approve', 'Decline', 'Blank']} placeholder="All Soft Decisions" />
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                      <label className="form-label" style={fll}>Soft Decision Date</label>
                                      <input type="date" className="form-input" style={fls} value={dashSoftDecisionDate} onChange={(e) => setDashSoftDecisionDate(e.target.value)} />
                                    </div>
                                    <FS label="KYC Type Filter" value={dashKycType} onChange={setDashKycType} options={filterOptions.vkyc_status || ['Approve', 'Decline', 'Blank']} placeholder="All KYC Types" />
                                    <FS label="Card Created" value={dashCardActivation} onChange={setDashCardActivation} options={['Approve', 'Decline', 'Blank']} placeholder="All Card Created" />
                                    <FS label="Current Status" value={dashCurrentStage} onChange={setDashCurrentStage} options={filterOptions.current_stage || []} placeholder="All Current Statuses" />
                                    <FS label="Reject Reason" value={dashDecisionReason} onChange={setDashDecisionReason} options={filterOptions.reject_reason || []} placeholder="All Reject Reasons" />
                                    <FS label="Bank Name" value={dashCardName} onChange={setDashCardName} options={['Yes', 'AU', 'PNB']} placeholder="All Banks" />
                                  </>
                                )}
                                <FS label="Customer Type" value={dashCustomerType} onChange={setDashCustomerType} options={filterOptions.customer_type} placeholder="All Customers" />
                                <FS label="Current Stage" value={dashCurrentStage} onChange={setDashCurrentStage} options={filterOptions.current_stage} placeholder="All Stages" />
                                <FS label="Card Activation" value={dashCardActivation} onChange={setDashCardActivation} options={filterOptions.card_activation_status} placeholder="All Status" />
                                <FS label="VKYC Status" value={dashVkycStatus} onChange={setDashVkycStatus} options={filterOptions.vkyc_status} placeholder="All VKYC" />
                                <FS label="Agent" value={dashAgent} onChange={setDashAgent} options={filterOptions.agents} placeholder="All Agents" />
                                {dashSelectedBank !== 'SBI' && (
                                  <FS label="Source Type" value={dashSourceType} onChange={setDashSourceType} options={filterOptions.source_type} placeholder="All Sources" />
                                )}
                              </div>
                            )}
                        </>
                      );
                    })()}
              </div>

              {!misStats && loadingMISStats ? (
                <div style={{ textAlign: 'center', padding: '5rem', color: 'hsl(var(--text-muted))' }} className="glass-panel">
                  Loading dashboard charts...
                </div>
              ) : (() => {
                const { totalSubmit, approvedCount, rejectedCount, pendingCount, approvalRate, funnelIpa, funnelKyc, funnelDecision, funnelActive, funnelBankRef, funnelCurrentState, funnelWinningBank, funnelSoftDecision, funnelWorkFlow, funnelFinalStatus, funnelCardGen, ipaApproved, ipaDeclined, kiwiSoftApproved, kiwiVkycApproved, kiwiCardCreated, kiwiFirstTxn, sdApprovedCount, sbiFinalApprovedCount, kycDist, srcDist, cardTypeDist, custTypeDist, actDist, prodDist, topPincodes, sdDecisionDist, kycModeDist, stpFlagDist, finalStatusDist, decisionReasonDist, channelDist, leadCreationDist, kiwiSoftDist, kiwiVkycDist, kiwiCardDist, kiwiBankDist } = dashStats;
                const { stateLeadCounts, maxStateLeads, topStates } = dashGeoData;
                return (
                  <>
                    {/* KPI SUMMARY CARDS */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                      <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--gold)' }}>
                        <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Total Mapped Applications</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0' }}>{totalSubmit}</div>
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Matched from MIS</div>
                      </div>

                      {dashSelectedBank === 'SBI' ? (
                        <>
                          <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid hsl(var(--primary))' }}>
                            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Soft Approved (SD_DECISION_CODE)</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0', color: 'hsl(var(--primary))' }}>
                              {totalSubmit > 0 ? ((sdApprovedCount / totalSubmit) * 100).toFixed(1) : 0}%
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{sdApprovedCount} of {totalSubmit} soft approved</div>
                          </div>
                          <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--gold-deep)' }}>
                            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Final Decision - APPL File generated</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--gold-deep)' }}>
                              {totalSubmit > 0 ? ((sbiFinalApprovedCount / totalSubmit) * 100).toFixed(1) : 0}%
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{sbiFinalApprovedCount} of {totalSubmit} file generated</div>
                          </div>
                          <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--mint)' }}>
                            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Final approval rate</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--mint)' }}>{approvalRate}%</div>
                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{approvedCount} of {totalSubmit} final approved</div>
                          </div>
                          <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--err)' }}>
                            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Final rejected applications</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--err)' }}>{rejectedCount}</div>
                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Declined by partner bank</div>
                          </div>
                        </>
                      ) : dashSelectedBank === 'KIWI' ? (
                        <>
                          <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid hsl(var(--primary))' }}>
                            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Soft Decision Approved</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0', color: 'hsl(var(--primary))' }}>
                              {totalSubmit > 0 ? ((kiwiSoftApproved / totalSubmit) * 100).toFixed(1) : 0}%
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{kiwiSoftApproved} of {totalSubmit} soft approved</div>
                          </div>
                          <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--gold-deep)' }}>
                            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>VKYC Approved</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--gold-deep)' }}>
                              {totalSubmit > 0 ? ((kiwiVkycApproved / totalSubmit) * 100).toFixed(1) : 0}%
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{kiwiVkycApproved} of {totalSubmit} VKYC approved</div>
                          </div>
                          <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--mint)' }}>
                            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Card Created</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--mint)' }}>{kiwiCardCreated}</div>
                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{totalSubmit > 0 ? ((kiwiCardCreated / totalSubmit) * 100).toFixed(1) : 0}% cards generated</div>
                          </div>
                          <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
                            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>First Transaction</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0', color: '#10b981' }}>{kiwiFirstTxn}</div>
                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Active card transactions</div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* HDFC & Generic */}
                          <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid hsl(var(--primary))' }}>
                            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Soft approval rate</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0', color: 'hsl(var(--primary))' }}>
                              {totalSubmit > 0 ? ((ipaApproved / totalSubmit) * 100).toFixed(1) : 0}%
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{ipaApproved} of {totalSubmit} soft approved</div>
                          </div>
                          <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #94A3B8' }}>
                            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Initial Rejected applications</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0', color: '#64748B' }}>{ipaDeclined}</div>
                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Declined at soft decision</div>
                          </div>
                          <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--mint)' }}>
                            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Final approval rate</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--mint)' }}>{approvalRate}%</div>
                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{approvedCount} of {totalSubmit} final approved</div>
                          </div>
                          <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--err)' }}>
                            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Final rejected applications</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--err)' }}>{rejectedCount}</div>
                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Declined by partner bank</div>
                          </div>
                        </>
                      )}

                      <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #E0A82E' }}>
                        <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Pending status</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--gold-deep)' }}>{pendingCount}</div>
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>In verification stage</div>
                      </div>
                    </div>

                    {/* 9 VISUALS GRID */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }} className="leads-visuals-grid">
                      
                      {/* Visual 1: Funnel Chart */}
                      <div className="glass-panel" style={{ padding: '2rem', gridColumn: 'span 2', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.5rem', width: '100%', textAlign: 'left' }}>Conversion Funnel Stages (%)</h4>
                        <div style={{ width: '100%', maxWidth: '600px', display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
                          <svg width="100%" viewBox="0 0 600 300" style={{ display: 'block', overflow: 'visible' }}>
                            {(() => {
                              let stages = [];
                              const b = dashSelectedBank || '';
                              if (b === 'KIWI') {
                                stages = [
                                  { name: 'Total Applications (content)', count: totalSubmit, pct: 100, color: 'var(--ink)' },
                                  { name: 'Soft Decision Approved (ipa)', count: kiwiSoftApproved, pct: totalSubmit > 0 ? Math.round((kiwiSoftApproved / totalSubmit) * 100) : 0, color: 'hsl(var(--primary))' },
                                  { name: 'VKYC Approved (VKYC)', count: kiwiVkycApproved, pct: totalSubmit > 0 ? Math.round((kiwiVkycApproved / totalSubmit) * 100) : 0, color: 'var(--gold-deep)' },
                                  { name: 'Card Created (Card_Created)', count: kiwiCardCreated, pct: totalSubmit > 0 ? Math.round((kiwiCardCreated / totalSubmit) * 100) : 0, color: 'var(--mint)' },
                                  { name: 'First transaction (first_txn)', count: kiwiFirstTxn, pct: totalSubmit > 0 ? Math.round((kiwiFirstTxn / totalSubmit) * 100) : 0, color: '#10b981' }
                                ];
                              } else if (b === 'SBI') {
                                stages = [
                                  { name: 'Total Application (APPLICATION_NUMBER)', count: totalSubmit, pct: 100, color: 'var(--ink)' },
                                  { name: 'Soft Approved (SD_DECISION_CODE)', count: funnelSoftDecision, pct: totalSubmit > 0 ? Math.round((funnelSoftDecision / totalSubmit) * 100) : 0, color: 'hsl(var(--primary))' },
                                  { name: 'STP flag Yes (STP_FLAG)', count: funnelWorkFlow, pct: totalSubmit > 0 ? Math.round((funnelWorkFlow / totalSubmit) * 100) : 0, color: 'var(--gold-deep)' },
                                  { name: 'Final Decision - APPL File generated (STAGE_IN_SALES24)', count: funnelFinalStatus, pct: totalSubmit > 0 ? Math.round((funnelFinalStatus / totalSubmit) * 100) : 0, color: 'var(--mint)' }
                                ];
                              } else {
                                // HDFC & generic
                                stages = [
                                  { name: 'Total Application Submit', count: totalSubmit, pct: 100, color: 'var(--ink)' },
                                  { name: 'IPA Approved', count: funnelIpa, pct: totalSubmit > 0 ? Math.round((funnelIpa / totalSubmit) * 100) : 0, color: 'hsl(var(--primary))' },
                                  { name: 'KYC Success', count: funnelKyc, pct: totalSubmit > 0 ? Math.round((funnelKyc / totalSubmit) * 100) : 0, color: 'var(--gold-deep)' },
                                  { name: 'Final Decision (Approve)', count: funnelDecision, pct: totalSubmit > 0 ? Math.round((funnelDecision / totalSubmit) * 100) : 0, color: 'var(--mint)' },
                                  { name: 'Card Activation Status (TXN ACTIVE)', count: funnelActive, pct: totalSubmit > 0 ? Math.round((funnelActive / totalSubmit) * 100) : 0, color: '#10b981' }
                                ];
                              }

                              return stages.map((stage, idx) => {
                                const yStart = idx * 60;
                                const yEnd = (idx + 1) * 60;
                                const yCenter = yStart + 30;

                                const pctTop = stage.pct;
                                const pctBottom = (idx < stages.length - 1) ? stages[idx + 1].pct : Math.max(15, stage.pct * 0.7);

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

                      {/* === SBI-SPECIFIC VISUALS === */}
                      {dashSelectedBank === 'SBI' && (
                        <>
                          {/* SBI: Soft Decision (SD_DECISION_CODE) Pie */}
                          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '280px' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Soft Decision Breakdown</h4>
                            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: '1.25rem' }}>
                              {(() => {
                                const entries = Object.entries(sdDecisionDist);
                                const getSdColor = (key) => {
                                  const k = key.toUpperCase();
                                  if (k.includes('APPROVE') || k.includes('PASS') || k.includes('ELIGIBLE')) return 'var(--mint)';
                                  if (k.includes('DECLINE') || k.includes('REJECT')) return 'var(--err)';
                                  if (k.includes('STP') || k.includes('REFER')) return 'var(--gold)';
                                  return '#CBD5E1';
                                };
                                let offset = 25;
                                return (
                                  <>
                                    <svg width="110" height="110" viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
                                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--line)" strokeWidth="4.2" />
                                      {entries.map(([key, val], idx) => {
                                        const pct = totalSubmit > 0 ? (val / totalSubmit) * 100 : 0;
                                        const el = <circle key={idx} cx="18" cy="18" r="15.915" fill="none" stroke={getSdColor(key)} strokeWidth="4.2" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={offset} />;
                                        offset -= pct;
                                        return el;
                                      })}
                                    </svg>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem', width: '100%' }}>
                                      {entries.map(([name, val], idx) => {
                                        const color = getSdColor(name);
                                        return (
                                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                              <span style={{ height: '8px', width: '8px', borderRadius: '50%', background: color }} />
                                              <span style={{ fontWeight: 500 }}>{name}</span>
                                            </div>
                                            <span style={{ fontWeight: 'bold' }}>{val} ({totalSubmit > 0 ? ((val / totalSubmit) * 100).toFixed(1) : 0}%)</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* SBI: STP Flag Pie */}
                          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '280px' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>STP Flag Breakdown</h4>
                            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: '1.25rem' }}>
                              {(() => {
                                const entries = Object.entries(stpFlagDist);
                                const getStpColor = (key) => {
                                  const k = key.toUpperCase();
                                  if (k.includes('N') || k.includes('NO')) return 'var(--mint)';
                                  if (k.includes('Y') || k.includes('YES')) return 'var(--err)';
                                  return '#CBD5E1';
                                };
                                let offset = 25;
                                return (
                                  <>
                                    <svg width="110" height="110" viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
                                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--line)" strokeWidth="4.2" />
                                      {entries.map(([key, val], idx) => {
                                        const pct = totalSubmit > 0 ? (val / totalSubmit) * 100 : 0;
                                        const el = <circle key={idx} cx="18" cy="18" r="15.915" fill="none" stroke={getStpColor(key)} strokeWidth="4.2" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={offset} />;
                                        offset -= pct;
                                        return el;
                                      })}
                                    </svg>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem', width: '100%' }}>
                                      {entries.map(([name, val], idx) => {
                                        const color = getStpColor(name);
                                        return (
                                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                              <span style={{ height: '8px', width: '8px', borderRadius: '50%', background: color }} />
                                              <span style={{ fontWeight: 500 }}>{name}</span>
                                            </div>
                                            <span style={{ fontWeight: 'bold' }}>{val} ({totalSubmit > 0 ? ((val / totalSubmit) * 100).toFixed(1) : 0}%)</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* SBI: KYC Mode (KYC_MODE) Bar */}
                          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '280px' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>KYC Mode Distribution</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', overflowY: 'auto', flex: 1 }}>
                              {Object.entries(kycModeDist).sort((a, b) => b[1] - a[1]).map(([name, val], idx) => {
                                const pct = totalSubmit > 0 ? (val / totalSubmit) * 100 : 0;
                                return (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                                    <div style={{ width: '90px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 600 }} title={name}>{name}</div>
                                    <div style={{ flex: 1, height: '14px', background: 'var(--paper-2)', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, background: 'hsl(var(--primary))', borderRadius: '4px', transition: 'width 0.4s' }} />
                                    </div>
                                    <div style={{ width: '55px', fontWeight: 'bold', fontSize: '0.75rem', textAlign: 'right' }}>{val} ({pct.toFixed(0)}%)</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* SBI: Final Status (STAGE_IN_SALES24) Bar */}
                          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '280px' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Final Status Distribution</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', overflowY: 'auto', flex: 1 }}>
                              {Object.entries(finalStatusDist).sort((a, b) => b[1] - a[1]).map(([name, val], idx) => {
                                const pct = totalSubmit > 0 ? (val / totalSubmit) * 100 : 0;
                                return (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                                    <div style={{ width: '100px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 600 }} title={name}>{name}</div>
                                    <div style={{ flex: 1, height: '14px', background: 'var(--paper-2)', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold-deep)', borderRadius: '4px', transition: 'width 0.4s' }} />
                                    </div>
                                    <div style={{ width: '55px', fontWeight: 'bold', fontSize: '0.75rem', textAlign: 'right' }}>{val} ({pct.toFixed(0)}%)</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* SBI: Decision Reason (DECISION_CODE_REASON1_WCP) Bar */}
                          <div className="glass-panel" style={{ padding: '1.5rem', gridColumn: 'span 2', display: 'flex', flexDirection: 'column', minHeight: '280px' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Decision Reason Breakdown</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '210px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                              {Object.entries(decisionReasonDist).sort((a, b) => b[1] - a[1]).map(([name, val], idx) => {
                                const pct = totalSubmit > 0 ? (val / totalSubmit) * 100 : 0;
                                return (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem', background: 'var(--paper-2)', padding: '0.4rem 0.65rem', borderRadius: '6px' }}>
                                    <div style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--ink)' }} title={name}>{name}</div>
                                    <div style={{ width: '120px', height: '10px', background: 'var(--line)', borderRadius: '3px', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--err)', transition: 'width 0.4s' }} />
                                    </div>
                                    <div style={{ width: '65px', fontWeight: 'bold', fontSize: '0.75rem', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{val} ({pct.toFixed(1)}%)</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* SBI: Summary Comparison Table */}
                          <div className="glass-panel" style={{ padding: '1.5rem', gridColumn: 'span 2', display: 'flex', flexDirection: 'column' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>SBI MIS Summary Table</h4>
                            <div style={{ overflowX: 'auto', flex: 1 }}>
                              <table className="data-table" style={{ fontSize: '0.78rem', width: '100%' }}>
                                <thead>
                                  <tr>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Metric</th>
                                    <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>Count</th>
                                    <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>% of Total</th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[
                                    { label: 'Total Applications', count: totalSubmit, status: '—' },
                                    { label: 'Soft Decision Approved', count: funnelSoftDecision, status: funnelSoftDecision > 0 ? '✅ Active' : '⚪ None' },
                                    { label: 'STP Flag = Yes', count: funnelWorkFlow, status: funnelWorkFlow > 0 ? '✅ Active' : '⚪ None' },
                                    { label: 'Final Status (APPL File Gen)', count: funnelFinalStatus, status: funnelFinalStatus > 0 ? '✅ Active' : '⚪ None' },
                                    { label: 'Approved', count: approvedCount, status: approvedCount > 0 ? '🟢 Processed' : '⚪ None' },
                                    { label: 'Rejected', count: rejectedCount, status: rejectedCount > 0 ? '🔴 Declined' : '⚪ None' },
                                    { label: 'Pending', count: pendingCount, status: pendingCount > 0 ? '🟡 In Progress' : '⚪ None' },
                                  ].map((row, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                                      <td style={{ padding: '0.55rem 0.75rem', fontWeight: 600 }}>{row.label}</td>
                                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', fontWeight: 800, fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{row.count}</td>
                                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>{totalSubmit > 0 ? ((row.count / totalSubmit) * 100).toFixed(1) : 0}%</td>
                                      <td style={{ padding: '0.55rem 0.75rem' }}>{row.status}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      )}

                      {/* === KIWI-SPECIFIC VISUALS === */}
                      {dashSelectedBank === 'KIWI' && (
                        <>
                          {/* Kiwi: Soft Decision Breakdown (IPA) Pie */}
                          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '280px' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Soft Decision Breakdown (IPA)</h4>
                            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: '1.25rem' }}>
                              {(() => {
                                const entries = Object.entries(kiwiSoftDist || {});
                                const getSoftColor = (key) => {
                                  const k = String(key).toLowerCase();
                                  if (k.includes('approve') || k.includes('pass') || k.includes('success') || k.includes('eligible')) return 'hsl(var(--primary))';
                                  if (k.includes('decline') || k.includes('reject')) return 'var(--err)';
                                  return 'var(--gold-deep)';
                                };
                                let cumPct = 0;
                                return (
                                  <>
                                    <svg width="120" height="120" viewBox="0 0 36 36">
                                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--line)" strokeWidth="4.2" />
                                      {totalSubmit > 0 && entries.map(([key, val], i) => {
                                        const pct = (val / totalSubmit) * 100;
                                        if (pct <= 0) return null;
                                        const dashArr = `${pct} ${100 - pct}`;
                                        const offset = 100 - cumPct + 25;
                                        cumPct += pct;
                                        return (
                                          <circle key={i} cx="18" cy="18" r="15.915" fill="none" stroke={getSoftColor(key)} strokeWidth="4.2" strokeDasharray={dashArr} strokeDashoffset={offset} />
                                        );
                                      })}
                                    </svg>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem' }}>
                                      {entries.map(([key, val], i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: getSoftColor(key) }} />
                                          <span style={{ fontWeight: 600 }}>{key}:</span>
                                          <span style={{ color: 'hsl(var(--text-muted))' }}>{val} ({totalSubmit > 0 ? ((val / totalSubmit) * 100).toFixed(0) : 0}%)</span>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Kiwi: Winning Bank Distribution Bar */}
                          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '280px' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Winning Bank Distribution</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', overflowY: 'auto', flex: 1 }}>
                              {Object.entries(kiwiBankDist || {}).sort((a, b) => b[1] - a[1]).map(([name, val], idx) => {
                                const pct = totalSubmit > 0 ? (val / totalSubmit) * 100 : 0;
                                return (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                                    <div style={{ width: '90px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 600 }} title={name}>{name}</div>
                                    <div style={{ flex: 1, height: '14px', background: 'var(--paper-2)', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, background: 'hsl(var(--primary))', borderRadius: '4px', transition: 'width 0.4s' }} />
                                    </div>
                                    <div style={{ width: '55px', fontWeight: 'bold', fontSize: '0.75rem', textAlign: 'right' }}>{val} ({pct.toFixed(0)}%)</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Kiwi: VKYC Status Distribution Bar */}
                          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '280px' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>VKYC Status Distribution</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', overflowY: 'auto', flex: 1 }}>
                              {Object.entries(kiwiVkycDist || {}).sort((a, b) => b[1] - a[1]).map(([name, val], idx) => {
                                const pct = totalSubmit > 0 ? (val / totalSubmit) * 100 : 0;
                                return (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                                    <div style={{ width: '100px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 600 }} title={name}>{name}</div>
                                    <div style={{ flex: 1, height: '14px', background: 'var(--paper-2)', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold-deep)', borderRadius: '4px', transition: 'width 0.4s' }} />
                                    </div>
                                    <div style={{ width: '55px', fontWeight: 'bold', fontSize: '0.75rem', textAlign: 'right' }}>{val} ({pct.toFixed(0)}%)</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Kiwi: Card Created Breakdown Bar */}
                          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '280px' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Card Created Status</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', overflowY: 'auto', flex: 1 }}>
                              {Object.entries(kiwiCardDist || {}).sort((a, b) => b[1] - a[1]).map(([name, val], idx) => {
                                const pct = totalSubmit > 0 ? (val / totalSubmit) * 100 : 0;
                                return (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                                    <div style={{ width: '100px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 600 }} title={name}>{name}</div>
                                    <div style={{ flex: 1, height: '14px', background: 'var(--paper-2)', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--mint)', borderRadius: '4px', transition: 'width 0.4s' }} />
                                    </div>
                                    <div style={{ width: '55px', fontWeight: 'bold', fontSize: '0.75rem', textAlign: 'right' }}>{val} ({pct.toFixed(0)}%)</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Kiwi: Summary Comparison Table */}
                          <div className="glass-panel" style={{ padding: '1.5rem', gridColumn: 'span 2', display: 'flex', flexDirection: 'column' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Kiwi MIS Summary Table</h4>
                            <div style={{ overflowX: 'auto', flex: 1 }}>
                              <table className="data-table" style={{ fontSize: '0.78rem', width: '100%' }}>
                                <thead>
                                  <tr>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Metric</th>
                                    <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>Count</th>
                                    <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>% of Total</th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[
                                    { label: 'Total Mapped Applications', count: totalSubmit, status: '—' },
                                    { label: 'Soft Decision Approved (IPA)', count: kiwiSoftApproved, status: kiwiSoftApproved > 0 ? '✅ Active' : '⚪ None' },
                                    { label: 'VKYC Approved', count: kiwiVkycApproved, status: kiwiVkycApproved > 0 ? '✅ Active' : '⚪ None' },
                                    { label: 'Card Created', count: kiwiCardCreated, status: kiwiCardCreated > 0 ? '🟢 Issued' : '⚪ None' },
                                    { label: 'First Transaction', count: kiwiFirstTxn, status: kiwiFirstTxn > 0 ? '🔥 Active' : '⚪ None' },
                                    { label: 'Approved', count: approvedCount, status: approvedCount > 0 ? '🟢 Processed' : '⚪ None' },
                                    { label: 'Rejected', count: rejectedCount, status: rejectedCount > 0 ? '🔴 Declined' : '⚪ None' },
                                    { label: 'Pending', count: pendingCount, status: pendingCount > 0 ? '🟡 In Progress' : '⚪ None' },
                                  ].map((row, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                                      <td style={{ padding: '0.55rem 0.75rem', fontWeight: 600 }}>{row.label}</td>
                                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', fontWeight: 800, fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{row.count}</td>
                                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>{totalSubmit > 0 ? ((row.count / totalSubmit) * 100).toFixed(1) : 0}%</td>
                                      <td style={{ padding: '0.55rem 0.75rem' }}>{row.status}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      )}

                      {/* === HDFC-SPECIFIC VISUALS === */}
                      {(!dashSelectedBank || dashSelectedBank === 'HDFC') && (
                        <>
                          {/* HDFC: IPA Decision Breakdown */}
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><span style={{ height: '10px', width: '10px', borderRadius: '50%', background: 'var(--mint)' }} /><span>Approved: {ipaApproved}</span></div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><span style={{ height: '10px', width: '10px', borderRadius: '50%', background: 'var(--err)' }} /><span>Declined: {ipaDeclined}</span></div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><span style={{ height: '10px', width: '10px', borderRadius: '50%', background: 'var(--line)' }} /><span>Other/Pending: {totalSubmit - ipaApproved - ipaDeclined}</span></div>
                              </div>
                            </div>
                          </div>

                          {/* HDFC: KYC Status Distribution */}
                          <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>KYC Status Distribution</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                              {Object.entries(kycDist).map(([name, val], idx) => {
                                const pct = totalSubmit > 0 ? (val / totalSubmit) * 100 : 0;
                                return (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                                    <div style={{ width: '80px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'right' }}>{name}</div>
                                    <div style={{ flex: 1, height: '14px', background: 'var(--paper-2)', borderRadius: '4px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)' }} /></div>
                                    <div style={{ width: '40px', fontWeight: 'bold' }}>{val}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* HDFC: Card Type */}
                          <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Card Type</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {Object.entries(cardTypeDist).map(([name, val], idx) => {
                                const pct = totalSubmit > 0 ? (val / totalSubmit) * 100 : 0;
                                return (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                                    <div style={{ width: '80px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'right' }}>{name}</div>
                                    <div style={{ flex: 1, height: '14px', background: 'var(--paper-2)', borderRadius: '4px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: 'var(--ink)' }} /></div>
                                    <div style={{ width: '40px', fontWeight: 'bold' }}>{val}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* HDFC: Customer Type */}
                          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Customer Type</h4>
                            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', textAlign: 'left', width: '100%' }}>
                                {Object.entries(custTypeDist).map(([name, val], idx) => {
                                  const colors = ['#16A37B', '#D14343', '#E0A82E', '#11132B'];
                                  return (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><span style={{ height: '8px', width: '8px', borderRadius: '50%', background: colors[idx % colors.length] }} /><span>{name}</span></div>
                                      <span style={{ fontWeight: 'bold' }}>{val} ({totalSubmit > 0 ? ((val / totalSubmit) * 100).toFixed(1) : 0}%)</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* HDFC: Card Activation Status */}
                          <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Card Activation Status</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {Object.entries(actDist).map(([name, val], idx) => {
                                const pct = totalSubmit > 0 ? (val / totalSubmit) * 100 : 0;
                                return (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                                    <div style={{ width: '100px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'right' }}>{name}</div>
                                    <div style={{ flex: 1, height: '14px', background: 'var(--paper-2)', borderRadius: '4px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: 'var(--mint)' }} /></div>
                                    <div style={{ width: '40px', fontWeight: 'bold' }}>{val}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* HDFC: Product Description */}
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
                        </>
                      )}

                      {/* === UNIVERSAL VISUALS (all banks) === */}
                      {/* Source Type */}
                      {dashSelectedBank !== 'SBI' && (
                        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Source Type</h4>
                          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', textAlign: 'left', width: '100%' }}>
                              {Object.entries(srcDist).map(([name, val], idx) => {
                                const colors = ['#E0A82E', '#16A37B', '#11132B', '#5C6070', '#D14343'];
                                const pct = totalSubmit > 0 ? ((val / totalSubmit) * 100).toFixed(1) : 0;
                                return (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><span style={{ height: '8px', width: '8px', borderRadius: '50%', background: colors[idx % colors.length] }} /><span>{name}</span></div>
                                    <span style={{ fontWeight: 'bold' }}>{val} ({pct}%)</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Visual 8: India Map Pincode Heatmap */}
                      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gridColumn: 'span 2' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.25rem' }}>Geographic Heatmap — India (Pincode & State Mapping)</h4>
                        <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginBottom: '1.5rem' }}>Leads density by Indian state, mapped from residence pincodes and MIS state data.</p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '2rem' }} className="admin-split-grid">
                          {/* India SVG Map */}
                          <div className="india-map-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'var(--paper-2)', borderRadius: '16px', padding: '1.25rem', minHeight: '420px', border: '1px solid var(--line)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)', position: 'relative' }}>
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


                    </div>

                    {/* MAPPED LEADS LOG TABLE */}
                    <div className="glass-panel" style={{ padding: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>MIS Mapped Leads Log</h3>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <button 
                            type="button"
                            onClick={() => handleExportMISLeads(filteredMappedLeads)} 
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
                                  checked={filteredMappedLeads.length > 0 && selectedMappedLeads.length === filteredMappedLeads.length}
                                  onChange={() => handleSelectAllMappedLeads(filteredMappedLeads)}
                                  style={{ cursor: 'pointer' }}
                                />
                              </th>
                              {(() => {
                                const b = dashSelectedBank || '';
                                if (b === 'KIWI') {
                                  return (
                                    <>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>URN</th>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Name</th>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Bank Ref No</th>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Current State</th>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Winning Bank</th>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>IPA Status</th>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Mapping Date</th>
                                    </>
                                  );
                                } else if (b === 'SBI') {
                                  return (
                                    <>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>URN</th>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Name</th>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>App Number</th>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Current Status</th>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Final Status</th>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Card Gen Status</th>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Mapping Date</th>
                                    </>
                                  );
                                } else {
                                  return (
                                    <>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>URN</th>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Name</th>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Bank Ref No</th>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>IPA Status</th>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Submit Date</th>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Final Decision</th>
                                      <th style={{ textAlign: 'left', padding: '0.75rem' }}>Mapping Date</th>
                                    </>
                                  );
                                }
                              })()}
                              <th style={{ textAlign: 'center', padding: '0.75rem' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredMappedLeads.length === 0 ? (
                              <tr>
                                <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--text-muted))' }}>
                                  No mapped leads match the current filters.
                                </td>
                              </tr>
                            ) : (
                              paginatedLeads.map((lead, idx) => (
                                <tr key={lead.id || idx} style={{ borderBottom: '1px solid var(--line)', transition: 'background 0.2s' }}>
                                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                    <input 
                                      type="checkbox"
                                      checked={selectedMappedLeads.includes(lead.id)}
                                      onChange={() => handleSelectMappedLead(lead.id)}
                                      style={{ cursor: 'pointer' }}
                                    />
                                  </td>
                                  {(() => {
                                    const b = dashSelectedBank || '';
                                    const md = lead.mis_data || {};
                                    if (b === 'KIWI') {
                                      return (
                                        <>
                                          <td style={{ padding: '0.75rem', fontFamily: 'var(--font-mono)' }}>{lead.urn}</td>
                                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>{lead.full_name}</td>
                                          <td style={{ padding: '0.75rem', fontFamily: 'var(--font-mono)' }}>{md.bank_reference_number || 'N/A'}</td>
                                          <td style={{ padding: '0.75rem' }}>{md.current_state || 'N/A'}</td>
                                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>{md.winning_bank || 'N/A'}</td>
                                          <td style={{ padding: '0.75rem' }}>{md.ipa_status || 'N/A'}</td>
                                          <td style={{ padding: '0.75rem', fontSize: '0.75rem' }}>{formatDateTime(lead.mis_mapped_at)}</td>
                                        </>
                                      );
                                    } else if (b === 'SBI') {
                                      return (
                                        <>
                                          <td style={{ padding: '0.75rem', fontFamily: 'var(--font-mono)' }}>{lead.urn}</td>
                                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>{lead.full_name}</td>
                                          <td style={{ padding: '0.75rem', fontFamily: 'var(--font-mono)' }}>{md.APPLICATION_NUMBER || md.APP_NO || md.APP_ID || md.ARN || 'N/A'}</td>
                                          <td style={{ padding: '0.75rem' }}>{md.CURRENT_STATUS || md.WORK_FLOW_STATUS || 'N/A'}</td>
                                          <td style={{ padding: '0.75rem' }}>{md.FINAL_STATUS || md.FINAL_DECISION || 'N/A'}</td>
                                          <td style={{ padding: '0.75rem' }}>{md.CARD_GEN_STATUS || 'N/A'}</td>
                                          <td style={{ padding: '0.75rem', fontSize: '0.75rem' }}>{formatDateTime(lead.mis_mapped_at)}</td>
                                        </>
                                      );
                                    } else {
                                      return (
                                        <>
                                          <td style={{ padding: '0.75rem', fontFamily: 'var(--font-mono)' }}>{lead.urn}</td>
                                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>{lead.full_name}</td>
                                          <td style={{ padding: '0.75rem', fontFamily: 'var(--font-mono)' }}>{md.bank_reference_number || 'N/A'}</td>
                                          <td style={{ padding: '0.75rem' }}>
                                            <span className={`badge badge-${(() => {
                                              const status = String(md.ipa_status || '').toLowerCase();
                                              if (status.includes('approve') || status.includes('success') || status.includes('active')) return 'success';
                                              if (status.includes('decline') || status.includes('reject') || status.includes('cancel')) return 'danger';
                                              return 'warning';
                                            })()}`}>
                                              {md.ipa_status || 'N/A'}
                                            </span>
                                          </td>
                                          <td style={{ padding: '0.75rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                                            {formatMISValue(md.application_submit_date_time, 'application_submit_date_time')}
                                          </td>
                                          <td style={{ padding: '0.75rem' }}>
                                            <span className={`badge badge-${lead.mis_status === 'Approved' ? 'success' : lead.mis_status === 'Rejected' ? 'danger' : 'warning'}`}>
                                              {lead.mis_status || (md.final_decision ? md.final_decision : 'N/A')}
                                            </span>
                                          </td>
                                          <td style={{ padding: '0.75rem', fontSize: '0.75rem' }}>{formatDateTime(lead.mis_mapped_at)}</td>
                                        </>
                                      );
                                    }
                                  })()}
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

                      {/* Pagination Controls */}
                      {filteredMappedLeads.length > DASH_PAGE_SIZE && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--line)', flexWrap: 'wrap', gap: '0.75rem' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                            Showing {((dashPage - 1) * DASH_PAGE_SIZE) + 1} to {Math.min(dashPage * DASH_PAGE_SIZE, filteredMappedLeads.length)} of {filteredMappedLeads.length} leads
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setDashPage(p => Math.max(1, p - 1))}
                              disabled={dashPage === 1}
                              className="btn-secondary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', opacity: dashPage === 1 ? 0.5 : 1 }}
                            >
                              Previous
                            </button>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink)', padding: '0 0.5rem' }}>
                              Page {dashPage} of {totalDashPages}
                            </span>
                            <button
                              type="button"
                              onClick={() => setDashPage(p => Math.min(totalDashPages, p + 1))}
                              disabled={dashPage === totalDashPages}
                              className="btn-secondary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', opacity: dashPage === totalDashPages ? 0.5 : 1 }}
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* CARDS TAB */}
          {activeTab === 'cards' && (
            <div className="admin-split-grid desktop-split-container" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.25rem', height: 'calc(100vh - 150px)', minHeight: '520px', alignItems: 'stretch' }}>
              
              {/* Card Editor / Creator */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.25rem', boxSizing: 'border-box', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexShrink: 0 }}>
                  <h3 style={{ fontSize: '1.15rem', margin: 0, color: 'var(--ink)' }}>
                    {editingCard ? 'Edit Credit Card Offer' : 'Add Credit Card Offer'}
                  </h3>
                  {editingCard && (
                    <span className="badge badge-info" style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}>
                      Editing: {editingCard.name}
                    </span>
                  )}
                </div>
                
                <form onSubmit={editingCard ? handleUpdateCard : handleCreateCard} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                  {/* Row 1: Name, Bank, Category */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.25rem' }}>Card Name <span style={{ color: 'var(--err)' }}>*</span></label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. SBI SimplyClick"
                        style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                        value={editingCard ? editingCard.name : newCardForm.name}
                        onChange={(e) => editingCard ? setEditingCard({ ...editingCard, name: e.target.value }) : setNewCardForm({ ...newCardForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.25rem' }}>Bank Name <span style={{ color: 'var(--err)' }}>*</span></label>
                      <select 
                        className="form-select" 
                        style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
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
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.25rem' }}>Category</label>
                      <select 
                        className="form-select" 
                        style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                        value={editingCard ? editingCard.category : newCardForm.category}
                        onChange={(e) => editingCard ? setEditingCard({ ...editingCard, category: e.target.value }) : setNewCardForm({ ...newCardForm, category: e.target.value })}
                      >
                        <option value="Offline">Offline</option>
                        <option value="Digital">Digital</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Campaign Parameters / Location */}
                  {((editingCard && editingCard.category === 'Offline') || (!editingCard && newCardForm.category === 'Offline')) && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.25rem' }}>Kiosk / City Location</label>
                      <select 
                        className="form-select"
                        style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
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
                        <option value="">All Locations (Open Market)</option>
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.name}>{loc.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {((editingCard && editingCard.category === 'Digital') || (!editingCard && newCardForm.category === 'Digital')) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                          UTM Internal (Campaign Tag) <span style={{ color: 'var(--err)' }}>*</span>
                        </label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. sbi_online, kiwi" 
                          style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                          value={editingCard ? (editingCard.utm_internal || '') : (newCardForm.utm_internal || '')}
                          onChange={(e) => editingCard 
                            ? setEditingCard({ ...editingCard, utm_internal: e.target.value }) 
                            : setNewCardForm({ ...newCardForm, utm_internal: e.target.value })}
                          required
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                          Campaign Ad ID(s) (ad_id)
                        </label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. ad_123, ad_456" 
                          style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                          value={editingCard ? (editingCard.ad_id || '') : (newCardForm.ad_id || '')}
                          onChange={(e) => editingCard 
                            ? setEditingCard({ ...editingCard, ad_id: e.target.value }) 
                            : setNewCardForm({ ...newCardForm, ad_id: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Row 3: Short Description */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.25rem' }}>Short Description</label>
                    <input 
                      type="text"
                      className="form-input" 
                      placeholder="e.g. SBI SimplyClick Credit Card offer"
                      style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                      value={editingCard ? editingCard.description : newCardForm.description}
                      onChange={(e) => editingCard ? setEditingCard({ ...editingCard, description: e.target.value }) : setNewCardForm({ ...newCardForm, description: e.target.value })}
                      required
                    />
                  </div>

                  {/* Row 4: Redirect URL Template */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.25rem' }}>Redirect URL Template <span style={{ color: 'var(--err)' }}>*</span></label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="https://bank.com/apply?name={name}&phone={phone}&urn={urn}"
                      style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}
                      value={editingCard ? editingCard.redirect_url_template : newCardForm.redirect_url_template}
                      onChange={(e) => editingCard ? setEditingCard({ ...editingCard, redirect_url_template: e.target.value }) : setNewCardForm({ ...newCardForm, redirect_url_template: e.target.value })}
                      required
                    />
                    <div style={{ fontSize: '0.68rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.4rem', alignItems: 'center' }}>
                      <span>Wildcards:</span>
                      <code>{`{name}`}</code> <code>{`{phone}`}</code> <code>{`{email}`}</code> <code>{`{urn}`}</code> <code>{`{urn_first}`}</code> <code>{`{urn_last}`}</code> <code>{`{agent_id}`}</code> <code>{`{utm_source}`}</code> <code>{`{utm_internal}`}</code>
                    </div>
                  </div>

                  {/* Row 5: Display Order, Active Status & Action Buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '0.75rem', alignItems: 'end', marginTop: '0.25rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.25rem' }}>Display Order</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                        value={editingCard ? editingCard.display_order : newCardForm.display_order}
                        onChange={(e) => editingCard ? setEditingCard({ ...editingCard, display_order: parseInt(e.target.value) || 1 }) : setNewCardForm({ ...newCardForm, display_order: parseInt(e.target.value) || 1 })}
                        required
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', paddingBottom: '0.45rem' }}>
                      <input 
                        type="checkbox" 
                        id="card-active" 
                        checked={editingCard ? editingCard.active : newCardForm.active}
                        onChange={(e) => editingCard ? setEditingCard({ ...editingCard, active: e.target.checked }) : setNewCardForm({ ...newCardForm, active: e.target.checked })}
                        style={{ accentColor: 'hsl(var(--primary))', width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <label htmlFor="card-active" className="form-label" style={{ marginBottom: 0, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>Active Offer</label>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="submit" className="btn-primary" style={{ flex: 1, padding: '0.55rem 0.85rem', fontSize: '0.85rem' }} disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : (editingCard ? 'Update Offer' : 'Create Offer')}
                      </button>
                      {editingCard && (
                        <button type="button" onClick={() => setEditingCard(null)} className="btn-secondary" style={{ padding: '0.55rem 0.85rem', fontSize: '0.85rem' }} disabled={isSubmitting}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </div>

              {/* Cards Inventory */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.25rem', boxSizing: 'border-box', overflow: 'hidden' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '0.85rem', flexShrink: 0, color: 'var(--ink)' }}>Cards Catalog ({cards.length})</h3>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
                  {cards.map(card => (
                    <div key={card.id} className="glass-card admin-card-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h4 style={{ fontWeight: 700, margin: 0, fontSize: '0.95rem' }}>{card.name}</h4>
                          <span className={`badge ${card.active ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.68rem' }}>
                            {card.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'hsl(var(--text-secondary))', margin: '0.2rem 0' }}>
                          {card.bank} Bank • Category: {card.category} • Order: {card.display_order}
                        </div>
                        {card.category === 'Offline' && (
                          <div style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', margin: '0.15rem 0' }}>
                            Locations: {card.card_locations && card.card_locations.length > 0 ? card.card_locations.join(', ') : 'All Locations'}
                          </div>
                        )}
                        {card.category === 'Digital' && (card.utm_internal || card.ad_id) && (
                          <div style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', margin: '0.15rem 0' }}>
                            UTM Internal: <span style={{ color: 'var(--gold-deep)', fontWeight: 600 }}>{card.utm_internal || card.ad_id}</span>
                          </div>
                        )}
                        <div style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', maxWidth: '320px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-mono)' }}>
                          {card.redirect_url_template}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                        <button onClick={() => setEditingCard({ ...card, card_locations: card.card_locations || [] })} className="btn-secondary" title="Edit Card" style={{ padding: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDeleteCard(card.id)} className="btn-secondary" title="Delete Card" style={{ padding: '0.45rem', background: 'rgba(209, 67, 67, 0.1)', color: 'var(--err)', borderColor: 'rgba(209, 67, 67, 0.15)' }}>
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
            <div className="admin-split-grid desktop-split-container" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
              
              {/* Agent Form */}
              <div className="glass-panel" style={{ maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1.25rem' }}>
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

                  <div className="form-group">
                    <label className="form-label">Operational Mode & Role</label>
                    <select 
                      className="form-select"
                      value={editingAgent ? (editingAgent.can_create_leads ? 'lead_agent' : (editingAgent.can_upload_mis ? 'bank_mis_agent' : 'no_permissions')) : (newAgentForm.can_create_leads ? 'lead_agent' : (newAgentForm.can_upload_mis ? 'bank_mis_agent' : 'no_permissions'))}
                      onChange={(e) => {
                        const val = e.target.value;
                        const isLead = val === 'lead_agent';
                        const isMis = val === 'bank_mis_agent';
                        if (editingAgent) {
                          setEditingAgent({ 
                            ...editingAgent, 
                            agent_mode: isMis ? 'bank_mis_agent' : 'lead_agent',
                            can_create_leads: isLead,
                            can_upload_mis: isMis
                          });
                        } else {
                          setNewAgentForm({ 
                            ...newAgentForm, 
                            agent_mode: isMis ? 'bank_mis_agent' : 'lead_agent',
                            can_create_leads: isLead,
                            can_upload_mis: isMis
                          });
                        }
                      }}
                    >
                      <option value="lead_agent">📱 Field Sales Agent (Lead Upload & Capture)</option>
                      <option value="bank_mis_agent">🏦 Bank MIS Agent (Bank Partner Payout)</option>
                      <option value="no_permissions">🚫 No Special Permissions (View Only)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ background: 'var(--paper-2)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--line)' }}>
                    <label className="form-label" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Agent Feature Permissions (At Most 1 Allowed)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox"
                          checked={editingAgent ? !!editingAgent.can_create_leads : !!newAgentForm.can_create_leads}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            if (editingAgent) {
                              setEditingAgent({ 
                                ...editingAgent, 
                                can_create_leads: checked, 
                                can_upload_mis: checked ? false : !!editingAgent.can_upload_mis,
                                agent_mode: checked ? 'lead_agent' : editingAgent.agent_mode
                              });
                            } else {
                              setNewAgentForm({ 
                                ...newAgentForm, 
                                can_create_leads: checked, 
                                can_upload_mis: checked ? false : !!newAgentForm.can_upload_mis,
                                agent_mode: checked ? 'lead_agent' : newAgentForm.agent_mode
                              });
                            }
                          }}
                          style={{ accentColor: 'var(--gold)' }}
                        />
                        <span><strong>Manual Lead Upload & Creation Access</strong> (Leads Repository)</span>
                      </label>
                      <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox"
                          checked={editingAgent ? !!editingAgent.can_upload_mis : !!newAgentForm.can_upload_mis}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            if (editingAgent) {
                              setEditingAgent({ 
                                ...editingAgent, 
                                can_upload_mis: checked, 
                                can_create_leads: checked ? false : !!editingAgent.can_create_leads,
                                agent_mode: checked ? 'bank_mis_agent' : editingAgent.agent_mode
                              });
                            } else {
                              setNewAgentForm({ 
                                ...newAgentForm, 
                                can_upload_mis: checked, 
                                can_create_leads: checked ? false : !!newAgentForm.can_create_leads,
                                agent_mode: checked ? 'bank_mis_agent' : newAgentForm.agent_mode
                              });
                            }
                          }}
                          style={{ accentColor: 'var(--gold)' }}
                        />
                        <span><strong>Bank MIS Upload Access</strong> (Bank Upload & MIS Dashboard)</span>
                      </label>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Assigned Bank (Scheme)</label>
                    <select 
                      className="form-select" 
                      value={editingAgent ? (editingAgent.assigned_bank || '') : (newAgentForm.assigned_bank || '')}
                      onChange={(e) => editingAgent ? setEditingAgent({ ...editingAgent, assigned_bank: e.target.value || null }) : setNewAgentForm({ ...newAgentForm, assigned_bank: e.target.value || '' })}
                    >
                      <option value="">Select Bank (All Cards)</option>
                      {getBankOptions().map((bank, i) => (
                        <option key={i} value={bank}>{bank}</option>
                      ))}
                    </select>
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
                        autoComplete="new-password"
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
              <div className="glass-panel desktop-panel-fill" style={{ maxHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column', padding: '1.25rem', boxSizing: 'border-box' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1.25rem', flexShrink: 0 }}>Registered Agents ({agents.length})</h3>
                <div className="desktop-scroll-panel" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.1rem', paddingRight: '0.35rem' }}>
                  {agents.map(ag => (
                    <div key={ag.id} className="glass-card admin-card-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <h4 style={{ fontWeight: 700 }}>{ag.name}</h4>
                          <span className={`badge ${ag.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                            {ag.status}
                          </span>
                          <span className="badge" style={{ background: 'rgba(224, 168, 46, 0.15)', color: 'var(--gold-deep)', border: '1px solid rgba(224, 168, 46, 0.3)', fontSize: '0.7rem' }}>
                            {ag.agent_mode === 'bank_mis_agent' ? '🏦 Bank MIS Agent' : '📱 Field Sales Agent'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', margin: '0.25rem 0' }}>
                          Username: <code>{ag.username}</code> • WhatsApp: {ag.phone || 'N/A'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--secondary))', fontWeight: 500 }}>
                          Locations: {ag.locations && ag.locations.length > 0 ? ag.locations.join(', ') : 'None assigned'}
                          {ag.assigned_bank && ` • Mapped Bank: ${ag.assigned_bank}`}
                        </div>
                        
                        <div style={{ marginTop: '0.45rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(224, 168, 46, 0.08)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(224, 168, 46, 0.2)', width: 'fit-content' }}>
                            <input 
                              type="checkbox" 
                              id={`perm-lead-${ag.id}`}
                              checked={!!ag.can_create_leads}
                              onChange={() => handleToggleAgentPermission(ag.id, 'can_create_leads', !!ag.can_create_leads)}
                              style={{ accentColor: 'var(--gold)', cursor: 'pointer' }}
                            />
                            <label htmlFor={`perm-lead-${ag.id}`} style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--gold-deep)' }}>
                              Manual Lead Upload Access
                            </label>
                          </div>

                          <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(56, 142, 60, 0.08)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(56, 142, 60, 0.2)', width: 'fit-content' }}>
                            <input 
                              type="checkbox" 
                              id={`perm-mis-${ag.id}`}
                              checked={!!ag.can_upload_mis}
                              onChange={() => handleToggleAgentPermission(ag.id, 'can_upload_mis', !!ag.can_upload_mis)}
                              style={{ accentColor: 'var(--success)', cursor: 'pointer' }}
                            />
                            <label htmlFor={`perm-mis-${ag.id}`} style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--success)' }}>
                              Bank MIS Upload Access
                            </label>
                          </div>
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
            <div className="admin-split-grid desktop-split-container" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr', gap: '1.75rem' }}>
              
              {/* Left Column: Location Creator (Top) & Locations Catalog (Bottom) */}
              <div className="desktop-panel-fill" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Location Creator */}
                <div className="glass-panel" style={{ padding: '1.5rem', flexShrink: 0, borderTop: '3px solid var(--gold-deep)' }}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--ink)', fontWeight: 700 }}>
                    <MapPin size={20} style={{ color: 'var(--gold-deep)' }} />
                    <span>Create Location / Kiosk</span>
                  </h3>
                  <form onSubmit={handleCreateLocation}>
                    <div className="form-group" style={{ marginBottom: '1.15rem' }}>
                      <label className="form-label" style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: '6px' }}>Location Identifier Name</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. Mumbai Airport Kiosk" 
                        value={newLocName}
                        onChange={(e) => setNewLocName(e.target.value)}
                        required 
                        style={{ fontSize: '0.85rem', padding: '0.55rem 0.75rem', borderRadius: '4px' }}
                      />
                    </div>
                    <button type="submit" className="btn-primary" style={{ width: '100%', fontSize: '0.85rem', padding: '0.6rem', borderRadius: '4px', letterSpacing: '0.3px' }} disabled={isSubmitting}>
                      {isSubmitting ? 'Creating...' : 'Add Location Master Entry'}
                    </button>
                  </form>
                </div>

                {/* Locations Catalog */}
                <div className="glass-panel desktop-panel-fill" style={{ flex: 1, padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexShrink: 0 }}>
                    <h3 style={{ fontSize: '1.15rem', color: 'var(--ink)', fontWeight: 700 }}>Locations Catalog</h3>
                    <span style={{ background: 'rgba(224, 168, 46, 0.12)', color: 'var(--gold-deep)', padding: '0.15rem 0.6rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800 }}>
                      {locations.length} ACTIVE
                    </span>
                  </div>
                  <div className="desktop-scroll-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
                    {locations.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--muted)', fontSize: '0.85rem' }}>No locations added yet.</div>
                    ) : (
                      locations.map(loc => (
                        <div key={loc.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.15rem', borderLeft: '4px solid var(--gold)', background: 'var(--paper-2)', transition: 'transform 0.15s ease' }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--ink)' }}>{loc.name}</span>
                            <div style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem' }}>
                              Registered: {loc.created_at ? loc.created_at.slice(0, 10) : 'N/A'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <button 
                              onClick={() => handleToggleLocActive(loc)} 
                              className="btn-secondary" 
                              style={{ 
                                padding: '0.25rem 0.65rem', 
                                fontSize: '0.72rem', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.25rem', 
                                borderRadius: '4px',
                                background: loc.active ? 'rgba(22, 163, 123, 0.08)' : 'rgba(224, 168, 46, 0.08)',
                                borderColor: loc.active ? 'rgba(22, 163, 123, 0.25)' : 'rgba(224, 168, 46, 0.25)', 
                                color: loc.active ? 'var(--mint)' : 'var(--gold-deep)',
                                fontWeight: 700
                              }}
                            >
                              {loc.active ? 'Active' : 'Inactive'}
                            </button>
                            <button 
                              onClick={() => handleDeleteLoc(loc.id)} 
                              style={{ 
                                color: 'var(--err)', 
                                background: 'rgba(209, 67, 67, 0.08)', 
                                border: '1px solid rgba(209, 67, 67, 0.15)', 
                                padding: '0.35rem', 
                                borderRadius: '4px', 
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Delete location"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Bank Manager */}
              <div className="glass-panel desktop-panel-fill" style={{ gap: '1.25rem', padding: '1.5rem', boxSizing: 'border-box', borderTop: '3px solid var(--gold-deep)' }}>
                <div style={{ flexShrink: 0 }}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--gold-deep)', fontWeight: 700 }}>
                    <CreditCard size={20} />
                    <span>Bank Manager</span>
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0 }}>
                    Configure partner bank choices available across credit card catalog dropdowns.
                  </p>
                </div>

                <div className="desktop-split-container admin-split-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '1.5rem', alignItems: 'stretch', marginTop: '0.25rem' }}>
                  {/* Left sub-column: Add Bank Form */}
                  <div style={{ background: 'var(--paper-2)', padding: '1.25rem', borderRadius: '6px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '1rem', alignSelf: 'start' }}>
                    <div>
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--ink)' }}>Add New Bank</h4>
                      <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: 0 }}>Create a new custom partner bank record.</p>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: '5px' }}>Bank Name</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. ICICI, Axis"
                        value={newBankInput}
                        onChange={(e) => setNewBankInput(e.target.value)}
                        style={{ background: 'var(--paper)', fontSize: '0.82rem', padding: '0.5rem 0.65rem', borderRadius: '4px' }}
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
                      style={{ width: '100%', fontSize: '0.8rem', padding: '0.55rem', borderRadius: '4px' }}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Adding...' : 'Add Bank'}
                    </button>
                  </div>

                  {/* Right sub-column: Configured Banks List */}
                  <div className="desktop-panel-fill" style={{ gap: '0.85rem' }}>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>Configured Banks</h4>
                    <div className="desktop-scroll-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingRight: '0.2rem' }}>
                      {getBankOptions().length === 0 ? (
                        <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '2rem 1rem' }}>
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
                              padding: '0.65rem 0.85rem', 
                              background: 'var(--paper-2)', 
                              border: '1px solid var(--line)', 
                              borderLeft: '4px solid var(--gold-deep)',
                              borderRadius: '4px',
                              transition: 'transform 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                width: '26px', 
                                height: '26px', 
                                borderRadius: '50%', 
                                background: 'var(--gold-deep)', 
                                color: '#fff', 
                                fontSize: '0.78rem', 
                                fontWeight: 800 
                              }}>
                                {bank.slice(0, 1).toUpperCase()}
                              </span>
                              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--ink)' }}>{bank}</span>
                            </div>
                            <button 
                              onClick={() => {
                                const current = getBankOptions();
                                const updated = current.filter((_, i) => i !== idx);
                                handleSaveBanks(updated);
                              }}
                              style={{ 
                                padding: '0.25rem 0.55rem', 
                                fontSize: '0.7rem', 
                                color: 'var(--err)', 
                                background: 'rgba(209, 67, 67, 0.08)', 
                                border: '1px solid rgba(209, 67, 67, 0.15)', 
                                borderRadius: '4px', 
                                cursor: 'pointer',
                                fontWeight: 600,
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

            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="desktop-panel-fill" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* Settings sub-tabs bar (scrollable on mobile) */}
              <div className="settings-sub-nav" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', WebkitOverflowScrolling: 'touch' }}>
                <button 
                  onClick={() => setActiveSettingsSubTab('general')} 
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--line)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    background: activeSettingsSubTab === 'general' ? 'var(--gold-deep)' : 'var(--paper-2)',
                    color: activeSettingsSubTab === 'general' ? '#fff' : 'var(--ink)'
                  }}
                >
                  General
                </button>
                <button 
                  onClick={() => setActiveSettingsSubTab('whatsapp_gateway')} 
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--line)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    background: activeSettingsSubTab === 'whatsapp_gateway' ? 'var(--gold-deep)' : 'var(--paper-2)',
                    color: activeSettingsSubTab === 'whatsapp_gateway' ? '#fff' : 'var(--ink)'
                  }}
                >
                  WhatsApp Link
                </button>
                <button 
                  onClick={() => setActiveSettingsSubTab('meta_api')} 
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--line)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    background: activeSettingsSubTab === 'meta_api' ? 'var(--gold-deep)' : 'var(--paper-2)',
                    color: activeSettingsSubTab === 'meta_api' ? '#fff' : 'var(--ink)'
                  }}
                >
                  Meta Cloud API
                </button>
                <button 
                  onClick={() => setActiveSettingsSubTab('baileys')} 
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--line)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    background: activeSettingsSubTab === 'baileys' ? 'var(--gold-deep)' : 'var(--paper-2)',
                    color: activeSettingsSubTab === 'baileys' ? '#fff' : 'var(--ink)'
                  }}
                >
                  Baileys Node API
                </button>
                <button 
                  onClick={() => setActiveSettingsSubTab('csv_export')} 
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--line)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    background: activeSettingsSubTab === 'csv_export' ? 'var(--gold-deep)' : 'var(--paper-2)',
                    color: activeSettingsSubTab === 'csv_export' ? '#fff' : 'var(--ink)'
                  }}
                >
                  Excel Template
                </button>
                <button 
                  onClick={() => setActiveSettingsSubTab('tracking_api')} 
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--line)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    background: activeSettingsSubTab === 'tracking_api' ? 'var(--gold-deep)' : 'var(--paper-2)',
                    color: activeSettingsSubTab === 'tracking_api' ? '#fff' : 'var(--ink)'
                  }}
                >
                  Lead Status API
                </button>
                {canDelete && (
                  <button 
                    onClick={() => setActiveSettingsSubTab('mis_mapping')} 
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid var(--line)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s',
                      background: activeSettingsSubTab === 'mis_mapping' ? 'var(--gold-deep)' : 'var(--paper-2)',
                      color: activeSettingsSubTab === 'mis_mapping' ? '#fff' : 'var(--ink)'
                    }}
                  >
                    Bank MIS Mapping
                  </button>
                )}
              </div>

              {/* Settings Sub-Tab Contents */}
              <div className="glass-panel desktop-scroll-panel" style={{ width: '100%', padding: '2rem', boxSizing: 'border-box' }}>
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

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', margin: '1rem 0 2rem 0' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1.05rem', color: 'hsl(var(--err))' }}>Deduplicate Leads (Database Cleanup)</h4>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Removes duplicate leads based on phone number and bank, keeping the most recently updated and best mapped record.</p>
                      </div>
                      <button type="button" className="btn-secondary" onClick={triggerRemoveDuplicates} style={{ padding: '0.5rem 1.25rem', border: '1px solid hsl(var(--err))', color: 'hsl(var(--err))' }}>
                        Run Deduplication
                      </button>
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

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>LinkedIn Partner / Insight Tag ID</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="9660484"
                          value={settings.linkedin_partner_id || ''}
                          onChange={(e) => setSettings({ ...settings, linkedin_partner_id: e.target.value.trim() })}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.35rem' }}>
                          Enter your 7-8 digit LinkedIn Partner ID (e.g. <code>9660484</code>) to enable LinkedIn Insight Tag tracking, website demographics, retargeting, and lead conversion analytics.
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

                {canDelete && activeSettingsSubTab === 'mis_mapping' && (
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', color: 'var(--gold-deep)' }}>
                      <Database size={20} />
                      <span>Bank MIS Column Mapping Rules & URN Character Settings</span>
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '1.5rem' }}>
                      Configure custom MIS parsing rules, URN character extraction columns (e.g. <code>contant</code> for YES Bank), and field mappings for each partner bank.
                    </p>

                    {/* AUTOMATED SBI & KIWI EMAIL MIS AUTO-SYNC CONTROL CARDS (GRID SIDE-BY-SIDE) */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
                      gap: '1.5rem',
                      marginBottom: '1.75rem'
                    }}>
                      {/* AUTOMATED SBI EMAIL MIS AUTO-SYNC CONTROL CARD */}
                      <div style={{
                        padding: '1.5rem',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, rgba(224, 168, 46, 0.08) 0%, rgba(20, 24, 40, 0.4) 100%)',
                        border: '1px solid rgba(224, 168, 46, 0.3)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        display: 'flex',
                        flexDirection: 'column',
                        justify: 'space-between'
                      }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                            <div style={{ flex: 1, minWidth: '220px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                                <Mail size={22} style={{ color: 'var(--gold-deep)' }} />
                                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--ink)' }}>
                                  Automated SBI Email MIS Fetcher
                                </h4>
                              </div>
                              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)' }}>
                                Connects to Gmail via IMAP SSL, auto-downloads MIS attachments for SBI (from <code>sstechnologies2017@gmail.com</code>), mapping leads in real time.
                              </p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.3rem 0.75rem',
                                borderRadius: '20px',
                                background: emailMisConfig.enabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(209, 67, 67, 0.12)',
                                color: emailMisConfig.enabled ? 'var(--mint)' : 'var(--err)',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                border: `1px solid ${emailMisConfig.enabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(209, 67, 67, 0.3)'}`
                              }}>
                                {emailMisConfig.enabled ? '🟢 Auto-Sync Active' : '🔴 Auto-Sync Disabled'}
                              </span>

                              <button
                                type="button"
                                onClick={triggerManualEmailSync}
                                disabled={isSyncingEmailMis}
                                className="btn-primary"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  padding: '0.45rem 0.9rem',
                                  fontSize: '0.8rem',
                                  background: 'var(--gold-deep)',
                                  color: '#fff',
                                  borderRadius: '8px'
                                }}
                              >
                                <RefreshCw size={14} className={isSyncingEmailMis ? 'spin' : ''} />
                                {isSyncingEmailMis ? 'Syncing...' : 'Sync Email MIS Now'}
                              </button>
                            </div>
                          </div>

                          {/* Active Config Parameters Table */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            gap: '0.75rem',
                            background: 'var(--paper)',
                            padding: '0.85rem',
                            borderRadius: '12px',
                            border: '1px solid var(--line)',
                            marginBottom: '1rem'
                          }}>
                            <div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Receiver Email</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink)', wordBreak: 'break-all' }}>{emailMisConfig.receiver_email}</span>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Sender Filter</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink)', wordBreak: 'break-all' }}>{emailMisConfig.sender_email}</span>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Target Subjects</span>
                              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gold-deep)' }}>
                                {Array.isArray(emailMisConfig.subject_keywords) ? emailMisConfig.subject_keywords.join(', ') : 'LG MIS EOD'}
                              </span>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Gmail App Password</span>
                              <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>••••••••••••••••</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEmailConfigForm({
                                receiver_email: emailMisConfig.receiver_email || 'spikemarketingsolutions25@gmail.com',
                                app_password: '',
                                sender_email: emailMisConfig.sender_email || 'sstechnologies2017@gmail.com',
                                subject_keywords: Array.isArray(emailMisConfig.subject_keywords) ? emailMisConfig.subject_keywords.join(', ') : 'LG MIS EOD, LG MIS 48Hourly, LG MIS Hourly',
                                enabled: emailMisConfig.enabled !== undefined ? emailMisConfig.enabled : true
                              });
                              setEmailConfigDevPass('');
                              setEmailConfigError('');
                              setEmailConfigSuccess('');
                              setShowEmailConfigModal(true);
                            }}
                            className="btn-secondary"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.4rem 0.85rem',
                              fontSize: '0.78rem',
                              borderColor: 'var(--gold)'
                            }}
                          >
                            <Key size={13} style={{ color: 'var(--gold-deep)' }} />
                            Configure Email & Password
                          </button>
                        </div>
                      </div>

                      {/* AUTOMATED KIWI EMAIL MIS AUTO-SYNC CONTROL CARD */}
                      <div style={{
                        padding: '1.5rem',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, rgba(224, 168, 46, 0.08) 0%, rgba(20, 24, 40, 0.4) 100%)',
                        border: '1px solid rgba(224, 168, 46, 0.3)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        display: 'flex',
                        flexDirection: 'column',
                        justify: 'space-between'
                      }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                            <div style={{ flex: 1, minWidth: '220px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                                <Mail size={22} style={{ color: 'var(--gold-deep)' }} />
                                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--ink)' }}>
                                  Automated KIWI Email MIS Fetcher
                                </h4>
                              </div>
                              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)' }}>
                                Connects to Gmail via IMAP SSL, auto-downloads MIS attachments for KIWI (from <code>harbans.anand@mymoneymantra.com</code>), mapping leads in real time.
                              </p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.3rem 0.75rem',
                                borderRadius: '20px',
                                background: kiwiEmailMisConfig.enabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(209, 67, 67, 0.12)',
                                color: kiwiEmailMisConfig.enabled ? 'var(--mint)' : 'var(--err)',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                border: `1px solid ${kiwiEmailMisConfig.enabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(209, 67, 67, 0.3)'}`
                              }}>
                                {kiwiEmailMisConfig.enabled ? '🟢 Auto-Sync Active' : '🔴 Auto-Sync Disabled'}
                              </span>

                              <button
                                type="button"
                                onClick={triggerManualKiwiEmailSync}
                                disabled={isSyncingKiwiEmailMis}
                                className="btn-primary"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  padding: '0.45rem 0.9rem',
                                  fontSize: '0.8rem',
                                  background: 'var(--gold-deep)',
                                  color: '#fff',
                                  borderRadius: '8px'
                                }}
                              >
                                <RefreshCw size={14} className={isSyncingKiwiEmailMis ? 'spin' : ''} />
                                {isSyncingKiwiEmailMis ? 'Syncing...' : 'Sync Email MIS Now'}
                              </button>
                            </div>
                          </div>

                          {/* Active Config Parameters Table */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            gap: '0.75rem',
                            background: 'var(--paper)',
                            padding: '0.85rem',
                            borderRadius: '12px',
                            border: '1px solid var(--line)',
                            marginBottom: '1rem'
                          }}>
                            <div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Receiver Email</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink)', wordBreak: 'break-all' }}>{kiwiEmailMisConfig.receiver_email}</span>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Sender Filter</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink)', wordBreak: 'break-all' }}>{kiwiEmailMisConfig.sender_email}</span>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Target Subjects</span>
                              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gold-deep)' }}>
                                {Array.isArray(kiwiEmailMisConfig.subject_keywords) ? kiwiEmailMisConfig.subject_keywords.join(', ') : 'kiwi mis'}
                              </span>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Gmail App Password</span>
                              <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>••••••••••••••••</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setKiwiEmailConfigForm({
                                receiver_email: kiwiEmailMisConfig.receiver_email || 'spikemarketingsolutions25@gmail.com',
                                app_password: '',
                                sender_email: kiwiEmailMisConfig.sender_email || 'harbans.anand@mymoneymantra.com',
                                subject_keywords: Array.isArray(kiwiEmailMisConfig.subject_keywords) ? kiwiEmailMisConfig.subject_keywords.join(', ') : 'kiwi mis',
                                enabled: kiwiEmailMisConfig.enabled !== undefined ? kiwiEmailMisConfig.enabled : true
                              });
                              setKiwiEmailConfigDevPass('');
                              setKiwiEmailConfigError('');
                              setKiwiEmailConfigSuccess('');
                              setShowKiwiEmailConfigModal(true);
                            }}
                            className="btn-secondary"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.4rem 0.85rem',
                              fontSize: '0.78rem',
                              borderColor: 'var(--gold)'
                            }}
                          >
                            <Key size={13} style={{ color: 'var(--gold-deep)' }} />
                            Configure Email & Password
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div className="glass-card" style={{ padding: '1.25rem' }}>
                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                          <label className="form-label" style={{ fontWeight: 700 }}>Select Bank to Configure</label>
                          <select 
                            className="form-select"
                            value={selectedBankConfig}
                            onChange={(e) => setSelectedBankConfig(e.target.value)}
                            style={{ width: '100%', maxWidth: '320px' }}
                          >
                            {getBankOptions().map((b, i) => (
                              <option key={i} value={b}>{b}</option>
                            ))}
                          </select>
                        </div>

                        {(() => {
                          const bankLower = selectedBankConfig.toLowerCase();
                          const isKiwi = bankLower.includes('kiwi');
                          const isYes = bankLower.includes('yes');
                          const isHdfc = bankLower.includes('hdfc');

                          const defaultUrnCol = isKiwi ? 'content' : (isYes ? 'contant' : (isHdfc ? 'APPLICATION_REFERENCE_NUMBER' : 'URN'));
                          const defaultFieldMappings = isKiwi ? {
                            final_decision: 'current_state',
                            decline_description: 'reject_reason',
                            card_name: 'content',
                            state: 'registration',
                            customer_type: 'user_id',
                            bank_reference_number: 'application_id_bank_2'
                          } : (isYes ? {
                            final_decision: 'FINAL_DECISION',
                            decline_description: 'Decline Descreption',
                            card_name: 'Product Description',
                            state: 'STATE',
                            customer_type: 'CUSTOMER_TYPE',
                            bank_reference_number: 'bank_reference_number'
                          } : (isHdfc ? {
                            final_decision: 'STATUS',
                            decline_description: 'REASON',
                            card_name: 'CARD_NAME',
                            state: 'STATE',
                            customer_type: 'CUSTOMER_TYPE',
                            bank_reference_number: 'APPLICATION_REFERENCE_NUMBER'
                          } : {
                            final_decision: 'STATUS',
                            decline_description: 'REASON',
                            card_name: 'CARD_NAME',
                            state: 'STATE',
                            customer_type: 'CUSTOMER_TYPE',
                            bank_reference_number: 'BANK_REF_NO'
                          }));

                          const currentCfg = bankMisMappings[selectedBankConfig] || {
                            urn_column: defaultUrnCol,
                            extraction_mode: 'extract_urn',
                            regex_pattern: 'FM\\d{4}[A-Z]\\d{7}',
                            field_mappings: defaultFieldMappings
                          };

                          const updateCurrentCfg = (field, val) => {
                            const updated = {
                              ...bankMisMappings,
                              [selectedBankConfig]: {
                                ...currentCfg,
                                [field]: val
                              }
                            };
                            setBankMisMappings(updated);
                          };

                          const updateFieldMapping = (targetKey, colName) => {
                            const updated = {
                              ...bankMisMappings,
                              [selectedBankConfig]: {
                                ...currentCfg,
                                field_mappings: {
                                  ...(currentCfg.field_mappings || {}),
                                  [targetKey]: colName
                                }
                              }
                            };
                            setBankMisMappings(updated);
                          };

                          const addCustomFieldMapping = () => {
                            const customList = [...(currentCfg.custom_fields || []), { label: '', col_name: '' }];
                            const updated = {
                              ...bankMisMappings,
                              [selectedBankConfig]: {
                                ...currentCfg,
                                custom_fields: customList
                              }
                            };
                            setBankMisMappings(updated);
                          };

                          const updateCustomField = (index, prop, val) => {
                            const customList = [...(currentCfg.custom_fields || [])];
                            customList[index] = {
                              ...customList[index],
                              [prop]: val
                            };
                            const updated = {
                              ...bankMisMappings,
                              [selectedBankConfig]: {
                                ...currentCfg,
                                custom_fields: customList
                              }
                            };
                            setBankMisMappings(updated);
                          };

                          const removeCustomField = (index) => {
                            const customList = (currentCfg.custom_fields || []).filter((_, i) => i !== index);
                            const updated = {
                              ...bankMisMappings,
                              [selectedBankConfig]: {
                                ...currentCfg,
                                custom_fields: customList
                              }
                            };
                            setBankMisMappings(updated);
                          };

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="admin-split-grid">
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label">URN Character / Column Name</label>
                                  <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="e.g. contant, LC2_CODE, URN"
                                    value={currentCfg.urn_column || ''}
                                    onChange={(e) => updateCurrentCfg('urn_column', e.target.value)}
                                  />
                                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.35rem' }}>
                                    The row header character/field in uploaded MIS containing URN data for <code>{selectedBankConfig}</code>.
                                  </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label">URN Extraction Mode</label>
                                  <select 
                                    className="form-select"
                                    value={currentCfg.extraction_mode || 'extract_urn'}
                                    onChange={(e) => updateCurrentCfg('extraction_mode', e.target.value)}
                                  >
                                    <option value="extract_urn">Extract URN from String (e.g. ENT_FM2026G2000119_971692 -&gt; FM2026G2000119)</option>
                                    <option value="exact">Exact Column Character Match</option>
                                    <option value="regex">Custom Regex Pattern Match</option>
                                  </select>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.35rem' }}>
                                    How to pull the URN out of raw cell values.
                                  </div>
                                </div>
                              </div>

                              {currentCfg.extraction_mode === 'regex' && (
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label">Custom Regex Pattern</label>
                                  <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="e.g. FM\d{4}[A-Z]\d{7}"
                                    value={currentCfg.regex_pattern || ''}
                                    onChange={(e) => updateCurrentCfg('regex_pattern', e.target.value)}
                                  />
                                </div>
                              )}

                              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--ink)' }}>
                                  Core System Field Mappings for {selectedBankConfig}
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="admin-split-grid">
                                  {[
                                    { key: 'final_decision', label: 'Final Decision / Status Column' },
                                    { key: 'decline_description', label: 'Decline Description / Reason Column' },
                                    { key: 'card_name', label: 'Card Name / Product Column' },
                                    { key: 'state', label: 'Customer State Column' },
                                    { key: 'customer_type', label: 'Customer Type Column' },
                                    { key: 'bank_reference_number', label: 'Bank Ref / Application Number Column' }
                                  ].map(f => (
                                    <div key={f.key} className="form-group" style={{ marginBottom: 0 }}>
                                      <label className="form-label" style={{ fontSize: '0.75rem' }}>{f.label}</label>
                                      <input 
                                        type="text" 
                                        className="form-input" 
                                        placeholder={`e.g. ${f.key}`}
                                        value={currentCfg.field_mappings?.[f.key] || ''}
                                        onChange={(e) => updateFieldMapping(f.key, e.target.value)}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Custom Additional Fields to Extract */}
                              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '1rem', marginTop: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                                  <div>
                                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                                      Custom Extracted Fields from {selectedBankConfig} MIS
                                    </h4>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '0.15rem 0 0 0' }}>
                                      Add any additional columns from the MIS file you want to extract and map with URN (e.g. VKYC Status, Credit Limit, Sub Source).
                                    </p>
                                  </div>
                                  <button 
                                    type="button" 
                                    onClick={addCustomFieldMapping} 
                                    className="btn-secondary"
                                    style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(224, 168, 46, 0.1)', color: 'var(--gold-deep)', border: '1px solid var(--gold)' }}
                                  >
                                    <Plus size={14} /> Add Custom Field
                                  </button>
                                </div>

                                {(!currentCfg.custom_fields || currentCfg.custom_fields.length === 0) ? (
                                  <div style={{ padding: '1.25rem', background: 'var(--paper-2)', borderRadius: '6px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted)', border: '1px dashed var(--line)' }}>
                                    No custom extracted fields added yet. Click <strong>"+ Add Custom Field"</strong> above to extract extra columns from {selectedBankConfig} MIS.
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                    {currentCfg.custom_fields.map((field, idx) => (
                                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: '0.75rem', alignItems: 'center', background: 'var(--paper-2)', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid var(--line)' }}>
                                        <div>
                                          <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '3px' }}>Display Label / Property Name</label>
                                          <input 
                                            type="text" 
                                            className="form-input" 
                                            placeholder="e.g. VKYC Status, Credit Limit"
                                            value={field.label || ''}
                                            onChange={(e) => updateCustomField(idx, 'label', e.target.value)}
                                            style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                                          />
                                        </div>
                                        <div>
                                          <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: '3px' }}>MIS File Column Header Name</label>
                                          <input 
                                            type="text" 
                                            className="form-input" 
                                            placeholder="e.g. vkyc_status, limit, sub_source"
                                            value={field.col_name || ''}
                                            onChange={(e) => updateCustomField(idx, 'col_name', e.target.value)}
                                            style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                                          />
                                        </div>
                                        <button 
                                          type="button" 
                                          onClick={() => removeCustomField(idx)}
                                          style={{ background: 'none', border: 'none', color: 'var(--err)', cursor: 'pointer', padding: '6px', borderRadius: '4px', alignSelf: 'center', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                          title="Remove Field"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Active MIS Extraction Field Schema Overview Table */}
                              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '1rem', marginTop: '1.25rem' }}>
                                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <Database size={16} style={{ color: 'var(--gold-deep)' }} />
                                  <span>Active MIS Extraction Field Schema for {selectedBankConfig}</span>
                                </h4>
                                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.85rem' }}>
                                  Full list of standard columns, data formats, and attributes automatically extracted and mapped to the database for <strong>{selectedBankConfig}</strong> MIS uploads.
                                </p>

                                <div style={{ overflowX: 'auto', background: 'var(--paper-2)', borderRadius: '6px', border: '1px solid var(--line)' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                                    <thead>
                                      <tr style={{ background: 'rgba(224, 168, 46, 0.08)', borderBottom: '1px solid var(--line)' }}>
                                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>Excel Header / Column Name</th>
                                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>Data Format</th>
                                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>Extraction & System Mapping Details</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(isKiwi ? [
                                        { col: 'content', fmt: 'Alpha-numeric', desc: 'Primary URN extracted from string (e.g. ENT_FM2026G2000119_971692 -> FM2026G2000119)' },
                                        { col: 'user_id', fmt: 'Text / UUID', desc: 'Customer User ID linking YES KIWI, AU KIWI, and PNB KIWI sheets' },
                                        { col: 'registration', fmt: 'Date', desc: 'Registration Date' },
                                        { col: 'pan_submit / Pan_Submit', fmt: 'Date', desc: 'PAN Submit Date' },
                                        { col: 'form_fetch / Form_Fetch', fmt: 'Date', desc: 'Form Fetch Date' },
                                        { col: 'form_submit / Form_Submit', fmt: 'Date', desc: 'Form Submit Date' },
                                        { col: 'ipa / IPA', fmt: 'Date', desc: 'IPA Decision Date' },
                                        { col: 'card_created / Card_Created', fmt: 'Date', desc: 'Card Creation Date' },
                                        { col: 'vkyc / VKYC', fmt: 'Date', desc: 'Video KYC Date' },
                                        { col: 'current_state', fmt: 'TEXT', desc: 'Current Bank Status (Ranked 1-13 across PNB, AU, YES sheets)' },
                                        { col: 'reject_reason', fmt: 'TEXT', desc: 'Rejection / Decline Reason' },
                                        { col: 'application_id_bank_2', fmt: 'Alpha-numeric', desc: 'Secondary Bank Application ID' },
                                        { col: 'first_txn / First_txn', fmt: 'Date', desc: 'First Transaction Date' }
                                      ] : isHdfc ? [
                                        { col: 'APPLICATION_REFERENCE_NUMBER / LC2_CODE', fmt: 'Alpha-numeric', desc: 'Primary URN / Application Reference Number' },
                                        { col: 'CREATION_DATE_TIME', fmt: 'Date / Time', desc: 'Application Submit Date/Time' },
                                        { col: 'CUSTOMER_TYPE', fmt: 'Text', desc: 'Customer Type' },
                                        { col: 'STATE', fmt: 'Text', desc: 'Customer State' },
                                        { col: 'IPA_STATUS', fmt: 'Text', desc: 'IPA Decision Status' },
                                        { col: 'DAP_FINAL_FLAG', fmt: 'Text', desc: 'DAP Final Flag' },
                                        { col: 'DROPOFF_REASON', fmt: 'Text', desc: 'Dropoff Reason' },
                                        { col: 'VKYC_STATUS', fmt: 'Text', desc: 'VKYC Status' },
                                        { col: 'VKYC_CONSENT_DATE', fmt: 'Date', desc: 'KYC Type / Consent Date' },
                                        { col: 'FINAL_DECISION / STATUS', fmt: 'Text', desc: 'Final Decision Status' },
                                        { col: 'FINAL_DECISION_DATE', fmt: 'Date', desc: 'Decision Date' },
                                        { col: 'CURRENT_STAGE', fmt: 'Text', desc: 'Current Stage' },
                                        { col: 'Decline Descreption / REMARK', fmt: 'Text', desc: 'Decline Description / Reason' },
                                        { col: 'Product Des / CARD_NAME', fmt: 'Text', desc: 'Card Name / Product Description' },
                                        { col: 'Card Activation Staus', fmt: 'Text', desc: 'Card Activation Status' },
                                        { col: 'KYC Completion date', fmt: 'Date', desc: 'KYC Completion Date' }
                                      ] : [
                                        { col: currentCfg.urn_column || 'URN', fmt: 'Alpha-numeric', desc: 'Primary URN / Customer Reference Column' },
                                        { col: currentCfg.field_mappings?.final_decision || 'STATUS', fmt: 'Text', desc: 'Final Decision / Status' },
                                        { col: currentCfg.field_mappings?.decline_description || 'REASON', fmt: 'Text', desc: 'Decline Description / Reason' },
                                        { col: currentCfg.field_mappings?.card_name || 'CARD_NAME', fmt: 'Text', desc: 'Card Name / Product Description' },
                                        { col: currentCfg.field_mappings?.state || 'STATE', fmt: 'Text', desc: 'Customer State' },
                                        { col: currentCfg.field_mappings?.customer_type || 'CUSTOMER_TYPE', fmt: 'Text', desc: 'Customer Type' },
                                        { col: currentCfg.field_mappings?.bank_reference_number || 'BANK_REF_NO', fmt: 'Text', desc: 'Bank Reference Number' }
                                      ]).map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                                          <td style={{ padding: '0.45rem 0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink)' }}><code>{item.col}</code></td>
                                          <td style={{ padding: '0.45rem 0.75rem', color: 'var(--gold-deep)', fontWeight: 600 }}>{item.fmt}</td>
                                          <td style={{ padding: '0.45rem 0.75rem', color: 'var(--muted)' }}>{item.desc}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                                <button 
                                  type="button"
                                  onClick={() => handleSaveBankMisMappings(bankMisMappings)}
                                  className="btn-primary"
                                  disabled={isSubmitting}
                                >
                                  Save {selectedBankConfig} MIS Rules
                                </button>
                              </div>
                            </div>
                          );
                        })()}
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
        <div 
          className="modal-overlay"
          style={{ 
            backdropFilter: 'blur(6px)', 
            background: 'rgba(0, 0, 0, 0.75)', 
            zIndex: 99999,
            pointerEvents: isSubmitting ? 'all' : 'auto'
          }}
          onClick={(e) => {
            if (!isSubmitting && e.target === e.currentTarget) {
              setShowUploadMISModal(false);
              setMisFile(null);
            }
          }}
        >
          <div className="glass-panel admin-dialog-panel" style={{ width: '90%', maxWidth: '520px', position: 'relative', borderTop: '4px solid var(--gold)', padding: '2.25rem', borderRadius: '12px' }}>
            {!isSubmitting && (
              <button 
                onClick={() => { setShowUploadMISModal(false); setMisFile(null); }} 
                style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            )}

            {isSubmitting ? (
              /* LOCKED PROGRESS VIEW */
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <style>{`
                  @keyframes misSpin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                  @keyframes misPulseBar {
                    0% { width: 10%; margin-left: 0%; }
                    50% { width: 70%; margin-left: 15%; }
                    100% { width: 100%; margin-left: 0%; }
                  }
                `}</style>

                {/* Animated Circular Ring Progress Indicator */}
                <div style={{ position: 'relative', width: '96px', height: '96px', margin: '0 auto 1.5rem auto' }}>
                  <div style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '50%',
                    border: '5px solid rgba(224, 168, 46, 0.15)',
                    borderTopColor: 'var(--gold-deep)',
                    borderRightColor: 'var(--gold)',
                    animation: 'misSpin 1.1s linear infinite',
                    boxShadow: '0 0 15px rgba(224, 168, 46, 0.25)'
                  }} />
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--gold-deep)'
                  }}>
                    <Database size={32} style={{ animation: 'misSpin 4s linear infinite' }} />
                  </div>
                </div>

                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--ink)' }}>
                  Uploading & Processing MIS Report...
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--muted)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                  Parsing sheets, extracting URNs, cross-referencing <strong>13-tier bank status ranks</strong>, and updating PostgreSQL database records.
                </p>

                {/* Animated Linear Progress Bar */}
                <div style={{ width: '100%', height: '8px', background: 'var(--paper-2)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.25rem', border: '1px solid var(--line)' }}>
                  <div style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, #e0a82e 0%, #facc15 50%, #d97706 100%)',
                    borderRadius: '4px',
                    animation: 'misPulseBar 2.2s ease-in-out infinite'
                  }} />
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--gold-deep)', fontWeight: 600, background: 'rgba(224, 168, 46, 0.1)', padding: '0.65rem 1.1rem', borderRadius: '30px', border: '1px solid rgba(224, 168, 46, 0.25)' }}>
                  <ShieldAlert size={16} />
                  <span>Navigation Locked: Please keep this modal open until finished</span>
                </div>
              </div>
            ) : (
              /* UPLOAD FORM */
              <>
                <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: 'hsl(var(--text-primary))' }}>Upload Bank MIS Report</h3>
                <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '1.25rem' }}>
                  Upload an Excel (.xls, .xlsx), CSV (.csv), or PDF (.pdf) file. For <strong>KIWI Bank</strong>, upload an Excel file with <strong>PNB KIWI, YES KIWI, and AU KIWI</strong> sheets for automatic 3-bank status ranking and user_id mapping.
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.4rem', color: 'hsl(var(--text-primary))' }}>Select Target Partner Bank MIS</label>
                    <select 
                      className="form-select"
                      value={selectedBankForMIS}
                      onChange={(e) => setSelectedBankForMIS(e.target.value)}
                      style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
                    >
                      {getBankOptions().map((bank, i) => (
                        <option key={i} value={bank}>{bank}</option>
                      ))}
                    </select>
                  </div>

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
                      formData.append('bank', selectedBankForMIS);
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
                          let errMsg = 'Failed to upload MIS file';
                          if (res.status === 413) {
                            errMsg = 'File size is too large for Nginx server limits (413 Request Entity Too Large). Please run Nginx fix command on EC2.';
                          } else {
                            try {
                              const errData = await res.json();
                              errMsg = errData.error || errMsg;
                            } catch (e) {}
                          }
                          showToast(errMsg, 'error');
                        }
                      } catch (err) {
                        console.error('MIS upload error:', err);
                        if (String(err).includes('Unexpected token')) {
                          showToast('File size exceeded Nginx server limit (413 Request Entity Too Large). Please update Nginx client_max_body_size on EC2.', 'error');
                        } else {
                          showToast('Error uploading file', 'error');
                        }
                      } finally {
                        setIsSubmitting(false);
                      }
                    }} 
                    className="btn-primary"
                    disabled={isSubmitting}
                  >
                    Upload & Process
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MIS Result Modal */}
      {showMISResultModal && misUploadResult && (
        <div className="modal-overlay">
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
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Matched Leads Rank Breakdown ({misUploadResult.matchedDetails.length})</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--gold-deep)', fontWeight: 600 }}>🏆 13-Tier Highest Rank Engine</span>
                </h4>
                <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', padding: '0.5rem' }}>
                  <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--paper-2)' }}>
                        <th style={{ textAlign: 'left', padding: '0.45rem' }}>URN</th>
                        <th style={{ textAlign: 'left', padding: '0.45rem' }}>Name</th>
                        <th style={{ textAlign: 'left', padding: '0.45rem' }}>Winning Bank</th>
                        <th style={{ textAlign: 'center', padding: '0.45rem' }}>Rank</th>
                        <th style={{ textAlign: 'left', padding: '0.45rem' }}>YES State (Rank)</th>
                        <th style={{ textAlign: 'left', padding: '0.45rem' }}>AU State (Rank)</th>
                        <th style={{ textAlign: 'left', padding: '0.45rem' }}>PNB State (Rank)</th>
                        <th style={{ textAlign: 'left', padding: '0.45rem' }}>Final Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {misUploadResult.matchedDetails.map((item, idx) => {
                        const winBank = item.winning_bank || 'YES';
                        const winRank = item.winning_rank || 1;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                            <td style={{ padding: '0.45rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.urn}</td>
                            <td style={{ padding: '0.45rem' }}>{item.name}</td>
                            <td style={{ padding: '0.45rem' }}>
                              <span style={{
                                padding: '0.2rem 0.6rem',
                                borderRadius: '12px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                color: '#fff',
                                background: winBank === 'PNB' ? '#FF6B00' : winBank === 'AU' ? '#0056b3' : '#28a745'
                              }}>
                                🏆 {winBank}
                              </span>
                            </td>
                            <td style={{ padding: '0.45rem', textAlign: 'center', fontWeight: 700, color: 'var(--gold-deep)' }}>
                              {winRank}/13
                            </td>
                            <td style={{ padding: '0.45rem', background: winBank === 'YES' ? 'rgba(40, 167, 69, 0.08)' : 'transparent', fontWeight: winBank === 'YES' ? 700 : 400 }}>
                              {item.yes_state || 'NOT_STARTED'} <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>({item.yes_rank || 0}/13)</span>
                            </td>
                            <td style={{ padding: '0.45rem', background: winBank === 'AU' ? 'rgba(0, 86, 179, 0.08)' : 'transparent', fontWeight: winBank === 'AU' ? 700 : 400 }}>
                              {item.au_state || 'NOT_STARTED'} <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>({item.au_rank || 0}/13)</span>
                            </td>
                            <td style={{ padding: '0.45rem', background: winBank === 'PNB' ? 'rgba(255, 107, 0, 0.08)' : 'transparent', fontWeight: winBank === 'PNB' ? 700 : 400 }}>
                              {item.pnb_state || 'NOT_STARTED'} <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>({item.pnb_rank || 0}/13)</span>
                            </td>
                            <td style={{ padding: '0.45rem' }}>
                              <span className={`badge badge-${item.status === 'Approved' ? 'success' : item.status === 'Rejected' ? 'danger' : 'warning'}`}>{item.status}</span>
                            </td>
                          </tr>
                        );
                      })}
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
        <div className="modal-overlay" style={{ zIndex: 1150 }}>
          <div className="glass-panel admin-dialog-panel" style={{ width: '90%', maxWidth: '400px', position: 'relative', borderTop: '4px solid var(--err)', padding: '2rem', textAlign: 'center' }}>
            <button type="button" onClick={() => { setShowPasswordConfirmModal(false); setPendingDeleteAction(null); }} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '48px', width: '48px', borderRadius: '50%', background: 'rgba(209, 67, 67, 0.1)', color: 'var(--err)', marginBottom: '0.75rem' }}>
              <Trash2 size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', color: 'hsl(var(--text-primary))', marginBottom: '0.5rem' }}>Confirm Admin Password</h3>
            <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '1.25rem' }}>
              Please enter the admin password to authorize unmapping of {pendingDeleteAction?.ids?.length} lead(s) from the dashboard.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleConfirmDeleteMappedLeads(); }}>
              <input 
                type="password"
                placeholder="Enter password 'Lakshay@123'"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-control"
                style={{ width: '100%', marginBottom: '1.5rem', padding: '0.6rem 0.8rem', border: '1px solid var(--line)', borderRadius: '6px', background: 'var(--paper)', color: 'var(--ink)' }}
                autoComplete="current-password"
                autoFocus
              />
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button 
                  type="button"
                  onClick={() => { setShowPasswordConfirmModal(false); setPendingDeleteAction(null); }} 
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: 'var(--err)', borderColor: 'var(--err)' }}
                >
                  Confirm Unmap
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mapped Lead MIS Details Modal */}
      {selectedMappedLead && (
        <div className="modal-overlay">
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
        <div className="modal-overlay">
          <div className="glass-panel admin-dialog-panel" style={{ width: '90%', maxWidth: '650px', position: 'relative', borderTop: '4px solid var(--gold)', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
            <button onClick={() => { setSelectedLeadDetails(null); setIsEditingLead(false); }} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.2rem', color: 'hsl(var(--text-primary))' }}>Lead Details</h3>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--gold-deep)', marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
              <span>URN: {selectedLeadDetails.urn}</span>
              {selectedLeadDetails.application_id && (
                <>
                  <span>•</span>
                  <span style={{ color: 'var(--mint)', fontWeight: 700 }}>App ID: {selectedLeadDetails.application_id}</span>
                </>
              )}
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
                        {hasData(selectedLeadDetails.application_id) && <div><strong>Application ID:</strong> <code style={{ color: 'var(--mint)', fontWeight: 700 }}>{selectedLeadDetails.application_id}</code></div>}
                        {hasData(selectedLeadDetails.full_name) && <div><strong>Name:</strong> {selectedLeadDetails.full_name}</div>}
                        {hasData(selectedLeadDetails.phone) && <div><strong>Phone:</strong> +91 {selectedLeadDetails.phone}</div>}
                        {hasData(selectedLeadDetails.email) && <div><strong>Email:</strong> {selectedLeadDetails.email}</div>}
                        {hasData(selectedLeadDetails.pan_no) && <div><strong>PAN Number:</strong> <code style={{ color: 'var(--gold-deep)', fontWeight: 600 }}>{selectedLeadDetails.pan_no}</code></div>}
                        {hasData(selectedLeadDetails.employment) && <div><strong>Employment Type:</strong> {selectedLeadDetails.employment}</div>}
                        {hasData(selectedLeadDetails.designation) && <div><strong>Designation:</strong> {selectedLeadDetails.designation}</div>}
                        {hasData(selectedLeadDetails.company_name) && <div><strong>Company / Employer:</strong> {selectedLeadDetails.company_name}</div>}
                        {hasData(selectedLeadDetails.has_credit_card) && <div><strong>Already Has Credit Card?</strong> {selectedLeadDetails.has_credit_card}</div>}
                        {hasData(selectedLeadDetails.pincode) && <div><strong>Residence Pincode:</strong> <code>{selectedLeadDetails.pincode}</code></div>}
                        {hasData(selectedLeadDetails.monthly_income) && <div><strong>Net Monthly Income:</strong> ₹{selectedLeadDetails.monthly_income}</div>}
                        {hasData(selectedLeadDetails.dob) && <div><strong>Date of Birth:</strong> {selectedLeadDetails.dob}</div>}
                        {hasData(selectedLeadDetails.mother_name) && <div><strong>Mother's Name:</strong> {selectedLeadDetails.mother_name}</div>}
                        {hasData(selectedLeadDetails.current_address) && <div><strong>Current Address:</strong> {selectedLeadDetails.current_address}</div>}
                        {hasData(selectedLeadDetails.consent) && (
                          <div>
                            <strong>Consent:</strong>{' '}
                            <span style={{ color: 'var(--mint)', fontWeight: 600 }}>Accepted</span>
                          </div>
                        )}
                      </div>
                    </div>
                  
                    <div>
                      <h4 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '0.8rem', color: 'hsl(var(--primary))' }}>Registration Info</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                        <div><strong>Selected Card:</strong> {getLeadCardName(selectedLeadDetails)}</div>
                        {hasData(selectedLeadDetails.card_bank) && <div><strong>Bank:</strong> {selectedLeadDetails.card_bank}</div>}
                        {hasData(selectedLeadDetails.source) && <div><strong>Source:</strong> <span className="badge badge-info">{selectedLeadDetails.source}</span></div>}
                        {selectedLeadDetails.source === 'agent' && (
                          <>
                            {hasData(selectedLeadDetails.agent_name) && <div><strong>Agent:</strong> {selectedLeadDetails.agent_name} ({selectedLeadDetails.agent_id || 'N/A'})</div>}
                            {hasData(selectedLeadDetails.agent_location) && <div><strong>Kiosk Location:</strong> {selectedLeadDetails.agent_location}</div>}
                          </>
                        )}
                        {(() => {
                          const agentCode = selectedLeadDetails.agent_id || 'public';
                          const dateCode = selectedLeadDetails.created_at ? new Date(selectedLeadDetails.created_at).toISOString().slice(0, 10).replace(/-/g, '') : '';
                          const domain = window.location.hostname.includes('uat') ? 'https://uat.finmantra.org' : 'https://finmantra.org';
                          const rUrl = selectedLeadDetails.redirect_url || `${domain}/refer/${agentCode}/${dateCode}/${selectedLeadDetails.urn || ''}`;
                          return (
                            <div style={{ marginTop: '0.4rem', gridColumn: '1 / -1' }}>
                              <strong>Redirect URL:</strong>{' '}
                              <a href={rUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline', wordBreak: 'break-all', fontSize: '0.85rem' }}>
                                {rUrl}
                              </a>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                <div style={{ textAlign: 'left' }}>
                  {(hasData(selectedLeadDetails.utm_channel) || hasData(selectedLeadDetails.utm_medium) || hasData(selectedLeadDetails.utm_source) || hasData(selectedLeadDetails.utm_category) || hasData(selectedLeadDetails.utm_campaign) || hasData(selectedLeadDetails.utm_term) || hasData(selectedLeadDetails.utm_content) || hasData(selectedLeadDetails.utm_creative_format) || hasData(selectedLeadDetails.utm_info) || hasData(selectedLeadDetails.utm_id) || hasData(selectedLeadDetails.utm_creative) || hasData(selectedLeadDetails.utm_internal) || hasData(selectedLeadDetails.utm_keyword) || hasData(selectedLeadDetails.utm_matchtype) || hasData(selectedLeadDetails.utm_network) || hasData(selectedLeadDetails.utm_placement) || hasData(selectedLeadDetails.utm_device) || hasData(selectedLeadDetails.utm_location)) && (
                    <>
                      <h4 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '0.8rem', color: 'hsl(var(--primary))' }}>Marketing & Tracking Parameters</h4>
                      <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem 1.5rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                        {hasData(selectedLeadDetails.utm_channel) && <div><strong>UTM Channel:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_channel}</span></div>}
                        {hasData(selectedLeadDetails.utm_medium) && <div><strong>UTM Medium:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_medium}</span></div>}
                        {hasData(selectedLeadDetails.utm_source) && <div><strong>UTM Source:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_source}</span></div>}
                        {hasData(selectedLeadDetails.utm_category) && <div><strong>UTM Category:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_category}</span></div>}
                        {hasData(selectedLeadDetails.utm_campaign) && <div><strong>UTM Campaign:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_campaign}</span></div>}
                        {hasData(selectedLeadDetails.utm_term) && <div><strong>UTM Term:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_term}</span></div>}
                        {hasData(selectedLeadDetails.utm_content) && <div><strong>UTM Content:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_content}</span></div>}
                        {hasData(selectedLeadDetails.utm_creative_format) && <div><strong>UTM Creative Format:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_creative_format}</span></div>}
                        {hasData(selectedLeadDetails.utm_info) && <div><strong>UTM Source:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_info}</span></div>}
                        {hasData(selectedLeadDetails.utm_id) && <div><strong>UTM Campaign ID (utm_id):</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_id}</span></div>}
                        {hasData(selectedLeadDetails.utm_creative) && <div><strong>UTM Ad ID (utm_creative):</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_creative}</span></div>}
                        {hasData(selectedLeadDetails.utm_internal) && <div><strong>UTM Internal:</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_internal}</span></div>}
                        {hasData(selectedLeadDetails.utm_keyword) && <div><strong>UTM Keyword (utm_keyword):</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_keyword}</span></div>}
                        {hasData(selectedLeadDetails.utm_matchtype) && <div><strong>UTM Matchtype (utm_matchtype):</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_matchtype}</span></div>}
                        {hasData(selectedLeadDetails.utm_network) && <div><strong>UTM Network (utm_network):</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_network}</span></div>}
                        {hasData(selectedLeadDetails.utm_placement) && <div><strong>UTM Placement (utm_placement):</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_placement}</span></div>}
                        {hasData(selectedLeadDetails.utm_device) && <div><strong>UTM Device (utm_device):</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_device}</span></div>}
                        {hasData(selectedLeadDetails.utm_location) && <div><strong>UTM Location (utm_location):</strong> <span style={{ color: 'var(--gold-deep)' }}>{selectedLeadDetails.utm_location}</span></div>}
                      </div>
                    </>
                  )}

                  {(hasData(selectedLeadDetails.landing_page) || hasData(selectedLeadDetails.redirect_url) || hasData(selectedLeadDetails.referrer)) && (
                    <>
                      <h5 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'hsl(var(--text-primary))', marginTop: '1rem' }}>Session & Entry Attribution</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', marginBottom: '1.5rem' }}>
                        {hasData(selectedLeadDetails.landing_page) && <div><strong>Landing Page URL:</strong> <span style={{ color: 'var(--gold-deep)', wordBreak: 'break-all' }}>{selectedLeadDetails.landing_page}</span></div>}
                        {hasData(selectedLeadDetails.redirect_url) && <div><strong>Redirect URL:</strong> <span style={{ color: 'var(--gold-deep)', wordBreak: 'break-all' }}>{selectedLeadDetails.redirect_url}</span></div>}
                        {hasData(selectedLeadDetails.referrer) && <div><strong>Referrer Source:</strong> <span style={{ color: 'var(--gold-deep)', wordBreak: 'break-all' }}>{selectedLeadDetails.referrer}</span></div>}
                      </div>
                    </>
                  )}

                  {(hasData(selectedLeadDetails.fbclid) || hasData(selectedLeadDetails.gclid) || hasData(selectedLeadDetails.gbraid) || hasData(selectedLeadDetails.wbraid) || hasData(selectedLeadDetails.gclsrc) || hasData(selectedLeadDetails.dclid) || hasData(selectedLeadDetails.msclkid) || hasData(selectedLeadDetails.ttclid) || hasData(selectedLeadDetails.twclid) || hasData(selectedLeadDetails.li_fat_id)) && (
                    <>
                      <h5 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'hsl(var(--text-primary))' }}>Ad Network Click Identifiers</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', marginBottom: '1.5rem' }}>
                        {hasData(selectedLeadDetails.fbclid) && <div><strong>FBCLID (Facebook):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.fbclid}</span></div>}
                        {hasData(selectedLeadDetails.gclid) && <div><strong>GCLID (Google):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.gclid}</span></div>}
                        {hasData(selectedLeadDetails.gbraid) && <div><strong>GBRAID (Google App iOS):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.gbraid}</span></div>}
                        {hasData(selectedLeadDetails.wbraid) && <div><strong>WBRAID (Google App Web):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.wbraid}</span></div>}
                        {hasData(selectedLeadDetails.gclsrc) && <div><strong>GCLSRC (Google Click Source):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.gclsrc}</span></div>}
                        {hasData(selectedLeadDetails.dclid) && <div><strong>DCLID (Google Display):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.dclid}</span></div>}
                        {hasData(selectedLeadDetails.msclkid) && <div><strong>MSCLKID (Bing):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.msclkid}</span></div>}
                        {hasData(selectedLeadDetails.ttclid) && <div><strong>TTCLID (TikTok):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.ttclid}</span></div>}
                        {hasData(selectedLeadDetails.twclid) && <div><strong>TWCLID (Twitter):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.twclid}</span></div>}
                        {hasData(selectedLeadDetails.li_fat_id) && <div><strong>LI_FAT_ID (LinkedIn):</strong> <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--gold-deep)' }}>{selectedLeadDetails.li_fat_id}</span></div>}
                      </div>
                    </>
                  )}

                  {/* Display other custom query parameters if any */}
                  {selectedLeadDetails.utm_params && Object.entries(selectedLeadDetails.utm_params).filter(([k, v]) => hasData(v)).some(([k]) => ![
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
                          .filter(([k, v]) => hasData(v) && ![
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

                  {(hasData(selectedLeadDetails.city) || hasData(selectedLeadDetails.income_range) || hasData(selectedLeadDetails.card_id) || hasData(selectedLeadDetails.ad_id) || hasData(selectedLeadDetails.ip_address) || hasData(selectedLeadDetails.user_agent) || hasData(selectedLeadDetails.capi_status) || hasData(selectedLeadDetails.capi_response) || hasData(selectedLeadDetails.mis_status) || hasData(selectedLeadDetails.mis_mapped_at) || hasData(selectedLeadDetails.created_at)) && (
                    <>
                      <h4 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '0.8rem', color: 'hsl(var(--primary))', marginTop: '1.5rem' }}>Additional Technical Metadata</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                        {hasData(selectedLeadDetails.city) && <div><strong>City:</strong> {selectedLeadDetails.city}</div>}
                        {hasData(selectedLeadDetails.income_range) && <div><strong>Income Range:</strong> {selectedLeadDetails.income_range}</div>}
                        {hasData(selectedLeadDetails.card_id) && <div><strong>Card ID:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedLeadDetails.card_id}</span></div>}
                        {hasData(selectedLeadDetails.ad_id) && <div><strong>Ad ID:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedLeadDetails.ad_id}</span></div>}
                        {hasData(selectedLeadDetails.ip_address) && <div><strong>IP Address:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedLeadDetails.ip_address}</span></div>}
                        {hasData(selectedLeadDetails.user_agent) && <div><strong>User Agent:</strong> <span style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{selectedLeadDetails.user_agent}</span></div>}
                        {hasData(selectedLeadDetails.capi_status) && <div><strong>CAPI Status:</strong> {selectedLeadDetails.capi_status}</div>}
                        {hasData(selectedLeadDetails.capi_response) && <div><strong>CAPI Response:</strong> <pre style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.75rem', overflowX: 'auto' }}>{typeof selectedLeadDetails.capi_response === 'object' ? JSON.stringify(selectedLeadDetails.capi_response, null, 2) : selectedLeadDetails.capi_response}</pre></div>}
                        {hasData(selectedLeadDetails.mis_status) && <div><strong>MIS Status:</strong> {selectedLeadDetails.mis_status}</div>}
                        {hasData(selectedLeadDetails.mis_mapped_at) && <div><strong>MIS Mapped At:</strong> {selectedLeadDetails.mis_mapped_at}</div>}
                        {hasData(selectedLeadDetails.mis_data) && <div><strong>Raw MIS Data:</strong> <pre style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.75rem', overflowX: 'auto' }}>{typeof selectedLeadDetails.mis_data === 'object' ? JSON.stringify(selectedLeadDetails.mis_data, null, 2) : selectedLeadDetails.mis_data}</pre></div>}
                        {hasData(selectedLeadDetails.created_at) && <div><strong>Created At:</strong> {selectedLeadDetails.created_at}</div>}
                      </div>
                    </>
                  )}
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button 
                    onClick={() => { 
                      setEditLeadForm({ 
                        ...selectedLeadDetails,
                        application_id: selectedLeadDetails.application_id || '',
                        full_name: selectedLeadDetails.full_name || ''
                      }); 
                      setIsEditingLead(true); 
                    }} 
                    className="btn-primary" 
                    style={{ padding: '0.6rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Edit size={15} /> Edit Lead Details
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
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Application ID</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. APP100293"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }} 
                          value={editLeadForm.application_id || ''} 
                          onChange={(e) => handleEditLeadFormChange('application_id', e.target.value)} 
                        />
                      </div>
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
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>PAN Number</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', textTransform: 'uppercase' }} 
                          value={editLeadForm.pan_no || ''} 
                          onChange={(e) => handleEditLeadFormChange('pan_no', e.target.value.toUpperCase().slice(0, 10))} 
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
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Designation</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                          value={editLeadForm.designation || ''} 
                          onChange={(e) => handleEditLeadFormChange('designation', e.target.value)} 
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Company / Employer</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                          value={editLeadForm.company_name || ''} 
                          onChange={(e) => handleEditLeadFormChange('company_name', e.target.value)} 
                        />
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
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Date of Birth</label>
                        <input 
                          type="date" 
                          className="form-input" 
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                          value={editLeadForm.dob || ''} 
                          onChange={(e) => handleEditLeadFormChange('dob', e.target.value)} 
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Mother's Name</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                          value={editLeadForm.mother_name || ''} 
                          onChange={(e) => handleEditLeadFormChange('mother_name', e.target.value)} 
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Current Address</label>
                        <textarea 
                          className="form-input" 
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', minHeight: '60px', resize: 'vertical' }} 
                          value={editLeadForm.current_address || ''} 
                          onChange={(e) => handleEditLeadFormChange('current_address', e.target.value)} 
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
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>UTM Source</label>
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
      {/* Create Manual Lead Modal */}
      {showCreateLeadModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '16px', background: 'var(--paper)', border: '1px solid var(--line)', padding: '1.75rem', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', borderTop: '4px solid var(--gold-deep)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <UserPlus size={22} style={{ color: 'var(--gold-deep)' }} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink)' }}>Create New Lead (Manual Entry)</h3>
              </div>
              <button onClick={() => setShowCreateLeadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateManualLead}>
              {/* Section 1: Customer Details */}
              <div style={{ marginBottom: '1.25rem', background: 'var(--paper-2)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--line)' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.85rem 0', color: 'var(--gold-deep)', borderBottom: '1px solid var(--line)', paddingBottom: '0.4rem' }}>
                  👤 Customer & Application Details
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Application ID / URN (Optional)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Auto URN generated if left blank"
                      value={createLeadForm.application_id}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, application_id: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Full Name *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Harsh Deep"
                      value={createLeadForm.full_name}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, full_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Phone Number (10 digits) *</label>
                    <input 
                      type="tel" 
                      maxLength="10"
                      className="form-input" 
                      placeholder="e.g. 8708569574"
                      value={createLeadForm.phone}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, phone: e.target.value.replace(/\D/g, '') })}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Email Address</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      placeholder="e.g. harshdeep301@icloud.com"
                      value={createLeadForm.email}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, email: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>PAN Number</label>
                    <input 
                      type="text" 
                      maxLength="10"
                      className="form-input" 
                      placeholder="e.g. BOGPH7116K"
                      value={createLeadForm.pan_no}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, pan_no: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Date of Birth</label>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={createLeadForm.dob}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, dob: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Mother's Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Mother's Full Name"
                      value={createLeadForm.mother_name}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, mother_name: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.85rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Current Address</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="House, Street, City, State"
                      value={createLeadForm.current_address}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, current_address: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Residence Pincode</label>
                    <input 
                      type="text" 
                      maxLength="6"
                      className="form-input" 
                      placeholder="e.g. 126112"
                      value={createLeadForm.pincode}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, pincode: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Employment, Financial & Card Details */}
              <div style={{ marginBottom: '1.25rem', background: 'var(--paper-2)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--line)' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.85rem 0', color: 'var(--gold-deep)', borderBottom: '1px solid var(--line)', paddingBottom: '0.4rem' }}>
                  💼 Employment & Financial Info
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Employment Type</label>
                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.25rem' }}>
                      {['Salaried', 'Self-Employed', 'Business'].map(emp => (
                        <label key={emp} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', cursor: 'pointer' }}>
                          <input 
                            type="radio" 
                            name="manual_emp" 
                            value={emp}
                            checked={createLeadForm.employment === emp}
                            onChange={(e) => setCreateLeadForm({ ...createLeadForm, employment: e.target.value })}
                            style={{ accentColor: 'var(--gold-deep)' }}
                          /> {emp}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Already Has Credit Card?</label>
                    <select 
                      className="form-select"
                      value={createLeadForm.has_credit_card}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, has_credit_card: e.target.value })}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Designation</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Student / Software Engineer"
                      value={createLeadForm.designation}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, designation: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Company / Employer</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. N/A or TCS"
                      value={createLeadForm.company_name}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, company_name: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Net Monthly Income (₹)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. 15000"
                      value={createLeadForm.monthly_income}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, monthly_income: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.85rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>City / Location *</label>
                    <select 
                      className="form-select"
                      value={createLeadForm.city}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, city: e.target.value })}
                    >
                      <option value="">Select City</option>
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.name}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Source Agent *</label>
                    <select 
                      className="form-select"
                      value={createLeadForm.agent_id}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, agent_id: e.target.value })}
                      required
                    >
                      <option value="">Select DB Agent</option>
                      {agents.map(ag => (
                        <option key={ag.id} value={ag.id}>{ag.name} ({ag.username})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Target Credit Card</label>
                    <select 
                      className="form-select"
                      value={createLeadForm.card_id}
                      onChange={(e) => {
                        const selected = cards.find(c => c.id === e.target.value);
                        setCreateLeadForm({ 
                          ...createLeadForm, 
                          card_id: e.target.value,
                          card_name: selected ? selected.name : '',
                          card_bank: selected ? selected.bank : ''
                        });
                      }}
                    >
                      <option value="">Select Card Offer</option>
                      {cards.map(c => (
                        <option key={c.id} value={c.id}>{c.bank} - {c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Marketing & Tracking Parameters */}
              <div style={{ marginBottom: '1.25rem', background: 'var(--paper-2)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--line)' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.85rem 0', color: 'var(--gold-deep)', borderBottom: '1px solid var(--line)', paddingBottom: '0.4rem' }}>
                  🎯 Marketing & Tracking Parameters (UTM & Ad Attribution)
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>UTM Source</label>
                    <input type="text" className="form-input" placeholder="e.g. meta" value={createLeadForm.utm_source} onChange={e => setCreateLeadForm({ ...createLeadForm, utm_source: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>UTM Medium</label>
                    <input type="text" className="form-input" placeholder="e.g. paid_social" value={createLeadForm.utm_medium} onChange={e => setCreateLeadForm({ ...createLeadForm, utm_medium: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>UTM Campaign</label>
                    <input type="text" className="form-input" placeholder="e.g. HDFC_Digitally_Acquired..." value={createLeadForm.utm_campaign} onChange={e => setCreateLeadForm({ ...createLeadForm, utm_campaign: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>UTM Term</label>
                    <input type="text" className="form-input" placeholder="e.g. HDFC_Digitally_Acquired..." value={createLeadForm.utm_term} onChange={e => setCreateLeadForm({ ...createLeadForm, utm_term: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>UTM Content</label>
                    <input type="text" className="form-input" placeholder="e.g. Pixel_Free_plus_fast..." value={createLeadForm.utm_content} onChange={e => setCreateLeadForm({ ...createLeadForm, utm_content: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>UTM Source</label>
                    <input type="text" className="form-input" placeholder="e.g. paid_social" value={createLeadForm.utm_info} onChange={e => setCreateLeadForm({ ...createLeadForm, utm_info: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>UTM Campaign ID (utm_id)</label>
                    <input type="text" className="form-input" placeholder="e.g. 120251645680990319" value={createLeadForm.utm_id} onChange={e => setCreateLeadForm({ ...createLeadForm, utm_id: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>UTM Ad ID (utm_creative)</label>
                    <input type="text" className="form-input" placeholder="e.g. 120251645805950319" value={createLeadForm.utm_creative} onChange={e => setCreateLeadForm({ ...createLeadForm, utm_creative: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>UTM Placement</label>
                    <input type="text" className="form-input" placeholder="e.g. Instagram_Feed" value={createLeadForm.utm_placement} onChange={e => setCreateLeadForm({ ...createLeadForm, utm_placement: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>Landing Page URL</label>
                    <input type="text" className="form-input" placeholder="e.g. https://finmantra.org/apply" value={createLeadForm.landing_page} onChange={e => setCreateLeadForm({ ...createLeadForm, landing_page: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>Redirect URL</label>
                    <input type="text" className="form-input" placeholder="e.g. https://bank.com/redirect" value={createLeadForm.redirect_url} onChange={e => setCreateLeadForm({ ...createLeadForm, redirect_url: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>Referrer Source</label>
                    <input type="text" className="form-input" placeholder="e.g. instagram.com" value={createLeadForm.referrer} onChange={e => setCreateLeadForm({ ...createLeadForm, referrer: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>FBCLID (Facebook Click ID)</label>
                    <input type="text" className="form-input" placeholder="e.g. fb.1.178..." value={createLeadForm.fbclid} onChange={e => setCreateLeadForm({ ...createLeadForm, fbclid: e.target.value })} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowCreateLeadModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSubmittingLead} style={{ background: 'var(--gold-deep)', color: '#fff', padding: '0.6rem 1.5rem', fontWeight: 600 }}>
                  {isSubmittingLead ? 'Creating Lead Record...' : 'Save Lead Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Leads Modal */}
      {showUploadLeadsModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '540px', borderRadius: '16px', background: 'var(--paper)', border: '1px solid var(--line)', padding: '1.75rem', borderTop: '4px solid var(--gold-deep)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <FileSpreadsheet size={22} style={{ color: 'var(--gold-deep)' }} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Upload Leads (Excel / CSV)</h3>
              </div>
              <button onClick={() => setShowUploadLeadsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={20} /></button>
            </div>

            <div style={{ background: 'rgba(224, 168, 46, 0.08)', border: '1px solid rgba(224, 168, 46, 0.25)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--gold-deep)' }}>Need a formatted template?</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Includes all headers, Application ID & sample rows</div>
              </div>
              <button 
                type="button"
                onClick={handleDownloadTemplate} 
                className="btn-primary" 
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap', background: 'var(--gold-deep)', color: '#fff' }}
              >
                <Download size={13} /> Download Template
              </button>
            </div>

            <form onSubmit={handleUploadManualLeads}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Select Excel (.xlsx, .xls) or CSV File</label>
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={(e) => setManualUploadFile(e.target.files[0])} 
                  className="form-input" 
                  required 
                />
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.5rem', marginBottom: '1.25rem', background: 'var(--paper-2)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--line)' }}>
                ⚠️ <strong>Agent Validation Rule</strong>: Every lead row must specify a valid <code>Source Agent</code> (Agent ID, Username, or Name) that exists in the database. Unmatched agent rows will be rejected.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowUploadLeadsModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={isUploadingManualLeads} style={{ background: 'var(--gold-deep)', color: '#fff' }}>
                  {isUploadingManualLeads ? 'Processing Upload...' : 'Upload & Validate Leads'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Uploaded Files History Modal */}
      {showUploadedFilesModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '850px', maxHeight: '85vh', overflowY: 'auto', borderRadius: '16px', background: 'var(--paper)', border: '1px solid var(--line)', padding: '1.75rem', borderTop: '4px solid var(--gold-deep)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <FolderArchive size={22} style={{ color: 'var(--gold-deep)' }} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Uploaded Excel / CSV Files Repository</h3>
              </div>
              <button onClick={() => setShowUploadedFilesModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={20} /></button>
            </div>

            {isLoadingUploadedFiles ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                <RefreshCw size={24} className="spin" style={{ marginBottom: '0.5rem' }} />
                <div>Loading raw file upload history...</div>
              </div>
            ) : uploadedFilesList.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)', background: 'var(--paper-2)', borderRadius: '8px' }}>
                No lead files uploaded yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Upload Time</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Original Filename</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Uploaded By</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Total Rows</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Created Leads</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Failed Rows</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadedFilesList.map(file => (
                      <tr key={file.id}>
                        <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>{formatDateTime(file.created_at)}</td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>
                          <FileText size={13} style={{ marginRight: '0.35rem', verticalAlign: 'middle', color: 'var(--gold-deep)' }} />
                          {file.original_filename}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          {file.agent_name || file.agent_id || 'Admin'}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>{file.total_rows}</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--success)', fontWeight: 700 }}>{file.created_count}</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: file.failed_count > 0 ? 'var(--err)' : 'var(--muted)' }}>{file.failed_count}</td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>
                          <a 
                            href={`${API_URL}/admin/uploaded-lead-files/${file.id}/download`} 
                            download 
                            className="btn-primary" 
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', background: 'var(--gold-deep)', color: '#fff' }}
                          >
                            <FolderDown size={12} /> Download
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Upload Results Summary Modal */}
      {showManualUploadResultModal && manualUploadResult && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto', borderRadius: '16px', background: 'var(--paper)', border: '1px solid var(--line)', padding: '1.75rem', borderTop: '4px solid var(--gold-deep)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Lead Upload Execution Summary</h3>
              <button onClick={() => setShowManualUploadResultModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'var(--paper-2)', padding: '0.85rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--line)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Total Rows</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{manualUploadResult.total}</div>
              </div>
              <div style={{ background: 'rgba(46, 160, 67, 0.12)', padding: '0.85rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(46, 160, 67, 0.25)' }}>
                <div style={{ fontSize: '0.75rem', color: '#2ea043' }}>Created Leads</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2ea043' }}>{manualUploadResult.created}</div>
              </div>
              <div style={{ background: 'rgba(219, 53, 69, 0.12)', padding: '0.85rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(219, 53, 69, 0.25)' }}>
                <div style={{ fontSize: '0.75rem', color: '#dc3545' }}>Rejected Rows</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc3545' }}>{manualUploadResult.failed}</div>
              </div>
            </div>

            {manualUploadResult.errors && manualUploadResult.errors.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.9rem', color: '#dc3545', marginBottom: '0.5rem', fontWeight: 700 }}>Rejected Rows & Validation Log:</h4>
                <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: '8px', padding: '0.75rem', maxHeight: '180px', overflowY: 'auto', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                  {manualUploadResult.errors.map((err, i) => (
                    <div key={i} style={{ marginBottom: '0.35rem', color: '#dc3545' }}>• {err}</div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button onClick={() => setShowManualUploadResultModal(false)} className="btn-primary" style={{ background: 'var(--gold-deep)', color: '#fff' }}>Done</button>
            </div>
          </div>
        </div>
      )}
      </main>

{/* RIGHT SLIDE-OVER NOTIFICATION CENTER DRAWER */}
      {showNotifDrawer && (
        <div 
          onClick={() => setShowNotifDrawer(false)}
          style={{ 
            position: 'fixed', 
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999999, 
            display: 'flex', 
            justifyContent: 'flex-end', 
            background: 'rgba(0, 0, 0, 0.65)', 
            backdropFilter: 'blur(6px)',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              width: '100%', 
              maxWidth: '440px', 
              height: '100vh', 
              background: 'var(--paper)', 
              color: 'var(--ink)',
              borderLeft: '1px solid var(--line)', 
              padding: 'clamp(1rem, 4vw, 1.5rem)', 
              boxSizing: 'border-box', 
              display: 'flex', 
              flexDirection: 'column', 
              boxShadow: '-12px 0 48px rgba(0,0,0,0.7)',
              animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '1.25rem', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(224, 168, 46, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e0a82e' }}>
                <Bell size={20} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 'clamp(1rem, 3.5vw, 1.15rem)', fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Notification Center</h3>
                <span style={{ fontSize: 'clamp(0.65rem, 2.5vw, 0.75rem)', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Real-time MIS Sync & System Notifications</span>
              </div>
            </div>
            <button 
              onClick={() => setShowNotifDrawer(false)} 
              style={{ background: 'var(--paper-2)', border: 'none', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Actions Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 0', borderBottom: '1px solid var(--line)', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--muted)' }}>
              {unreadNotifCount > 0 ? `${unreadNotifCount} unread notification(s)` : 'All notifications read'}
            </span>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={markAllNotifsRead} style={{ background: 'none', border: 'none', color: '#e0a82e', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                ✓ Mark All Read
              </button>
              <button onClick={clearAllNotifs} style={{ background: 'none', border: 'none', color: '#f85149', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                🗑 Clear All
              </button>
            </div>
          </div>

          {/* Notification Items List */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingTop: '1rem', paddingRight: '0.25rem' }}>
            {notifications.length > 0 ? (
              notifications.map(notif => {
                const isWarn = notif.type === 'warning';
                const isErr = notif.type === 'error';
                const isSucc = notif.type === 'success';

                const icon = isWarn ? <AlertTriangle size={18} style={{ color: '#e0a82e' }} /> :
                             isErr ? <AlertCircle size={18} style={{ color: '#f85149' }} /> :
                             isSucc ? <CheckCircle size={18} style={{ color: '#3fb950' }} /> :
                             <Info size={18} style={{ color: '#58a6ff' }} />;

                const borderCol = isWarn ? 'rgba(224, 168, 46, 0.35)' : isErr ? 'rgba(248, 81, 73, 0.35)' : isSucc ? 'rgba(63, 185, 80, 0.35)' : 'var(--line)';
                const bgCol = isWarn ? 'rgba(224, 168, 46, 0.08)' : isErr ? 'rgba(248, 81, 73, 0.08)' : isSucc ? 'rgba(63, 185, 80, 0.08)' : 'var(--paper-2)';

                return (
                  <div 
                    key={notif.id} 
                    style={{ 
                      padding: '1rem', 
                      borderRadius: '12px', 
                      background: bgCol, 
                      border: `1px solid ${borderCol}`, 
                      opacity: notif.is_read ? 0.7 : 1,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <div style={{ marginTop: '2px' }}>{icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--ink)' }}>{notif.title}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                            {notif.created_at ? new Date(notif.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ink)', lineHeight: '1.45' }}>{notif.message}</p>
                        
                        {notif.details && Object.keys(notif.details).length > 0 && (
                          <details style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
                            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#e0a82e' }}>▶ View Details</summary>
                            <pre style={{ margin: '0.4rem 0 0 0', padding: '0.6rem', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '8px', overflowX: 'auto', fontSize: '0.72rem', color: 'var(--ink)' }}>
                              {JSON.stringify(notif.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--muted)', fontSize: '0.88rem' }}>
                <Bell size={32} style={{ color: 'var(--muted)', opacity: 0.5, marginBottom: '0.75rem', display: 'block', margin: '0 auto 0.75rem auto' }} />
                No notifications recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* EMAIL CONFIG DEVELOPER AUTHORIZATION MODAL (Password: Lakshay@123) */}
      {showEmailConfigModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '1rem' }}>
          <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '520px', borderRadius: '16px', background: 'var(--paper)', border: '1px solid var(--line)', padding: '1.75rem', borderTop: '4px solid var(--gold-deep)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={20} style={{ color: 'var(--gold-deep)' }} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Save SBI Email IMAP Config</h3>
              </div>
              <button onClick={() => setShowEmailConfigModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveEmailConfigSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Receiver Gmail Address</label>
                <input type="email" className="form-input" value={emailConfigForm.receiver_email} onChange={(e) => setEmailConfigForm({ ...emailConfigForm, receiver_email: e.target.value })} required />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Gmail App Password (Leave blank to keep existing)</label>
                <input type="password" className="form-input" placeholder="e.g. rzoq njtq vpnt difd" value={emailConfigForm.app_password} onChange={(e) => setEmailConfigForm({ ...emailConfigForm, app_password: e.target.value })} />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Sender Email Filter</label>
                <input type="email" className="form-input" value={emailConfigForm.sender_email} onChange={(e) => setEmailConfigForm({ ...emailConfigForm, sender_email: e.target.value })} required />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Subject Keywords (Comma separated)</label>
                <input type="text" className="form-input" value={emailConfigForm.subject_keywords} onChange={(e) => setEmailConfigForm({ ...emailConfigForm, subject_keywords: e.target.value })} required />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem', background: 'rgba(224, 168, 46, 0.08)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(224, 168, 46, 0.25)' }}>
                <label className="form-label" style={{ color: 'var(--gold-deep)', fontWeight: 800, marginBottom: '0.35rem' }}>
                  🔑 Developer Password Required (Lakshay@123)
                </label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Enter Lakshay@123 password..."
                  value={emailConfigDevPass} 
                  onChange={(e) => setEmailConfigDevPass(e.target.value)} 
                  required 
                />
              </div>

              {emailConfigError && (
                <div style={{ background: 'rgba(209, 67, 67, 0.08)', border: '1px solid rgba(209, 67, 67, 0.2)', padding: '0.75rem', borderRadius: '8px', color: 'var(--err)', fontSize: '0.82rem', marginBottom: '1rem' }}>
                  {emailConfigError}
                </div>
              )}

              {emailConfigSuccess && (
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.75rem', borderRadius: '8px', color: 'var(--mint)', fontSize: '0.82rem', marginBottom: '1rem' }}>
                  {emailConfigSuccess}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowEmailConfigModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" style={{ background: 'var(--gold-deep)', color: '#fff' }}>Confirm & Save Settings</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KIWI EMAIL CONFIG DEVELOPER AUTHORIZATION MODAL (Password: Lakshay@123) */}
      {showKiwiEmailConfigModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '1rem' }}>
          <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '520px', borderRadius: '16px', background: 'var(--paper)', border: '1px solid var(--line)', padding: '1.75rem', borderTop: '4px solid var(--gold-deep)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={20} style={{ color: 'var(--gold-deep)' }} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Save KIWI Email IMAP Config</h3>
              </div>
              <button onClick={() => setShowKiwiEmailConfigModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveKiwiEmailConfigSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Receiver Gmail Address</label>
                <input type="email" className="form-input" value={kiwiEmailConfigForm.receiver_email} onChange={(e) => setKiwiEmailConfigForm({ ...kiwiEmailConfigForm, receiver_email: e.target.value })} required />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Gmail App Password (Leave blank to keep existing)</label>
                <input type="password" className="form-input" placeholder="e.g. rzoq njtq vpnt difd" value={kiwiEmailConfigForm.app_password} onChange={(e) => setKiwiEmailConfigForm({ ...kiwiEmailConfigForm, app_password: e.target.value })} />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Sender Email Filter</label>
                <input type="email" className="form-input" value={kiwiEmailConfigForm.sender_email} onChange={(e) => setKiwiEmailConfigForm({ ...kiwiEmailConfigForm, sender_email: e.target.value })} required />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Subject Keywords (Comma separated)</label>
                <input type="text" className="form-input" value={kiwiEmailConfigForm.subject_keywords} onChange={(e) => setKiwiEmailConfigForm({ ...kiwiEmailConfigForm, subject_keywords: e.target.value })} required />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem', background: 'rgba(224, 168, 46, 0.08)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(224, 168, 46, 0.25)' }}>
                <label className="form-label" style={{ color: 'var(--gold-deep)', fontWeight: 800, marginBottom: '0.35rem' }}>
                  🔑 Developer Password Required (Lakshay@123)
                </label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Enter Lakshay@123 password..."
                  value={kiwiEmailConfigDevPass} 
                  onChange={(e) => setKiwiEmailConfigDevPass(e.target.value)} 
                  required 
                />
              </div>

              {kiwiEmailConfigError && (
                <div style={{ background: 'rgba(209, 67, 67, 0.08)', border: '1px solid rgba(209, 67, 67, 0.2)', padding: '0.75rem', borderRadius: '8px', color: 'var(--err)', fontSize: '0.82rem', marginBottom: '1rem' }}>
                  {kiwiEmailConfigError}
                </div>
              )}

              {kiwiEmailConfigSuccess && (
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.75rem', borderRadius: '8px', color: 'var(--mint)', fontSize: '0.82rem', marginBottom: '1rem' }}>
                  {kiwiEmailConfigSuccess}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowKiwiEmailConfigModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" style={{ background: 'var(--gold-deep)', color: '#fff' }}>Confirm & Save Settings</button>
              </div>
            </form>
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
        pan_no: { visible: true, required: true, label: "PAN Card Number", placeholder: "Enter 10-digit PAN Number" },
        pincode: { visible: true, required: true, label: "Residence Pincode", placeholder: "Residence Pincode" }
      }
    };
  });

  const [newOptionVal, setNewOptionVal] = useState('');
  const [pincodeMode, setPincodeMode] = useState(settings.pincode_serviceability_mode || 'all');
  const [pincodeList, setPincodeList] = useState(settings.pincode_serviceability_list || '');
  const [bankPincodeRules, setBankPincodeRules] = useState(() => {
    try {
      if (settings.bank_pincode_rules) {
        return typeof settings.bank_pincode_rules === 'string'
          ? JSON.parse(settings.bank_pincode_rules)
          : settings.bank_pincode_rules;
      }
    } catch (e) {
      console.error(e);
    }
    return {};
  });

  const getBankOptions = () => {
    if (settings && settings.card_manager_banks) {
      return settings.card_manager_banks.split(',').map(b => b.trim()).filter(Boolean);
    }
    return ['HDFC', 'SBI'];
  };

  const handleFileUpload = async (e, bank) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    showToast(`Uploading and parsing file for ${bank}...`, 'info');

    try {
      const res = await fetch(`${API_URL}/pincodes/parse`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to parse file');
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.pincodes) && data.pincodes.length > 0) {
        setBankPincodeRules(prev => ({
          ...prev,
          [bank]: {
            mode: 'list',
            list: data.pincodes.join(', ')
          }
        }));
        showToast(`Successfully loaded ${data.pincodes.length} unique pincodes for ${bank}!`, 'success');
      } else {
        showToast(`No valid 6-digit pincodes found in ${file.name}.`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      e.target.value = '';
    }
  };

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
          pincode_serviceability_list: pincodeList,
          bank_pincode_rules: JSON.stringify(bankPincodeRules)
        })
      });
      if (res.ok) {
        setSettings(prev => ({
          ...prev,
          landing_form_schema: schema,
          pincode_serviceability_mode: pincodeMode,
          pincode_serviceability_list: pincodeList,
          bank_pincode_rules: bankPincodeRules
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

        {/* Bank-Specific Pincode Serviceability Card */}
        <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gold)', marginBottom: '0.75rem', borderBottom: '1px dashed var(--border-light)', paddingBottom: '0.5rem' }}>
            Bank-Specific Pincode Serviceability
          </h4>
          <p style={{ fontSize: '0.78rem', color: 'hsl(var(--text-secondary))', marginBottom: '1rem' }}>
            Set serviceability rules for each bank individually. This applies if a lead applies for a card from that bank (e.g. resolved via UTM Internal).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {getBankOptions().map(bank => {
              const rule = bankPincodeRules[bank] || { mode: 'all', list: '' };
              return (
                <div key={bank} style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--gold-deep)', display: 'block', marginBottom: '0.5rem' }}>
                    {bank} Serviceability
                  </span>
                  <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Validation Mode</label>
                    <select
                      className="form-select"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                      value={rule.mode}
                      onChange={(e) => setBankPincodeRules(prev => ({
                        ...prev,
                        [bank]: {
                          ...rule,
                          mode: e.target.value
                        }
                      }))}
                    >
                      <option value="all">Serviceable Everywhere (All location)</option>
                      <option value="list">Serviceable only at specific Pincodes</option>
                    </select>
                  </div>

                  {rule.mode === 'list' && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Serviceable Pincodes List</span>
                        {rule.list && (
                          <span style={{ color: 'var(--mint)', fontWeight: 600 }}>
                            {String(rule.list).split(',').filter(Boolean).length} Loaded
                          </span>
                        )}
                      </label>
                      <textarea
                        className="form-input"
                        rows="3"
                        placeholder="Enter comma-separated 6-digit pincodes..."
                        value={rule.list || ''}
                        onChange={(e) => setBankPincodeRules(prev => ({
                          ...prev,
                          [bank]: {
                            ...rule,
                            list: e.target.value
                          }
                        }))}
                        style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', margin: 0 }}
                          onClick={() => document.getElementById(`pincode-upload-${bank}`).click()}
                        >
                          Upload Pincode List (.txt, .csv, .xlsx)
                        </button>
                        <input
                          type="file"
                          id={`pincode-upload-${bank}`}
                          style={{ display: 'none' }}
                          accept=".txt,.csv,.xls,.xlsx"
                          onChange={(e) => handleFileUpload(e, bank)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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

