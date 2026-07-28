import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { LogIn, User, MapPin, CheckCircle, BarChart3, Plus, LogOut, Sun, Moon, Copy, Briefcase, Home, Calendar, Phone, ArrowRight, RefreshCw, Mail, ChevronDown, FileSpreadsheet, Download, X, FileText, CheckCircle2, UserPlus, Search, Filter } from 'lucide-react';
import { trackLeadSubmission } from '../utils/analytics';

const COMMON_DESIGNATIONS = [
  "Software Engineer",
  "Manager",
  "Associate",
  "Analyst",
  "Consultant",
  "Director",
  "Executive",
  "Officer",
  "Engineer",
  "Architect",
  "Teacher / Professor",
  "Doctor",
  "Chartered Accountant (CA)",
  "Sales Representative",
  "HR Specialist",
  "Proprietor / Owner",
  "Student",
  "Retired",
  "Housewife",
  "Other"
];

// Offline fallback helper to resolve Indian pincodes to State/Region
const getStateFromPincode = (pin) => {
  if (!pin || pin.length < 2) return null;
  const prefix2 = pin.substring(0, 2);
  
  const mapping = {
    '11': 'Delhi',
    '12': 'Haryana',
    '13': 'Haryana',
    '14': 'Punjab',
    '15': 'Punjab',
    '16': 'Chandigarh',
    '17': 'Himachal Pradesh',
    '18': 'Jammu & Kashmir',
    '19': 'Jammu & Kashmir',
    '20': 'Uttar Pradesh',
    '21': 'Uttar Pradesh',
    '22': 'Uttar Pradesh',
    '23': 'Uttar Pradesh',
    '24': 'Uttar Pradesh',
    '25': 'Uttar Pradesh',
    '26': 'Uttar Pradesh',
    '27': 'Uttar Pradesh',
    '28': 'Uttar Pradesh',
    '30': 'Rajasthan',
    '31': 'Rajasthan',
    '32': 'Rajasthan',
    '33': 'Rajasthan',
    '34': 'Rajasthan',
    '36': 'Gujarat',
    '37': 'Gujarat',
    '38': 'Gujarat',
    '39': 'Gujarat',
    '40': 'Maharashtra',
    '41': 'Maharashtra',
    '42': 'Maharashtra',
    '43': 'Maharashtra',
    '44': 'Maharashtra',
    '45': 'Madhya Pradesh',
    '46': 'Madhya Pradesh',
    '47': 'Madhya Pradesh',
    '48': 'Madhya Pradesh',
    '49': 'Chhattisgarh',
    '50': 'Telangana',
    '51': 'Andhra Pradesh',
    '52': 'Andhra Pradesh',
    '53': 'Andhra Pradesh',
    '56': 'Karnataka',
    '57': 'Karnataka',
    '58': 'Karnataka',
    '59': 'Karnataka',
    '60': 'Tamil Nadu',
    '61': 'Tamil Nadu',
    '62': 'Tamil Nadu',
    '63': 'Tamil Nadu',
    '64': 'Tamil Nadu',
    '67': 'Kerala',
    '68': 'Kerala',
    '69': 'Kerala',
    '70': 'West Bengal',
    '71': 'West Bengal',
    '72': 'West Bengal',
    '73': 'West Bengal',
    '74': 'West Bengal',
    '75': 'Odisha',
    '76': 'Odisha',
    '77': 'Odisha',
    '78': 'Assam',
    '79': 'North Eastern States',
    '80': 'Bihar',
    '81': 'Bihar',
    '82': 'Bihar',
    '83': 'Jharkhand',
    '84': 'Bihar',
    '85': 'Bihar',
  };

  return mapping[prefix2] || null;
};

const CopyLinkButton = ({ url }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  if (!url) return null;
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', padding: '0.35rem 0.6rem', borderRadius: '4px', maxWidth: '320px' }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--gold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }} title={url}>
        {url}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        style={{ background: 'none', border: 'none', color: copied ? 'var(--mint)' : 'var(--gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}
        title="Copy Redirect URL"
      >
        <Copy size={12} />
        {copied && <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Copied!</span>}
      </button>
    </div>
  );
};

const formatTimeOnly = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(d);
    const p = {};
    parts.forEach(x => p[x.type] = x.value);
    return `${p.hour}:${p.minute}`;
  } catch (e) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
};

// Helper functions for cookie storage
const setCookie = (name, value, days = 1) => {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = `${name}=${encodeURIComponent(value || "")}${expires}; path=/; SameSite=Lax`;
};

const getCookie = (name) => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return '';
};

const deleteCookie = (name) => {
  document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
};

export default function AgentPortal({ navigateTo, theme, toggleTheme }) {
  const [token, setToken] = useState(getCookie('finmantra_agent_token') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [agent, setAgent] = useState(() => {
    const rawAgent = getCookie('finmantra_agent');
    try {
      return rawAgent ? JSON.parse(rawAgent) : null;
    } catch (e) {
      return null;
    }
  });
  const [agentLocation, setAgentLocation] = useState(() => {
    const cached = localStorage.getItem('finmantra_agent_selected_location');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (new Date().getTime() < parsed.expiresAt) {
          return parsed.location;
        }
      } catch (e) {}
      localStorage.removeItem('finmantra_agent_selected_location');
    }
    return '';
  });
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  
  // Login form
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  // Lead form
  const [cards, setCards] = useState([]);
  const [locations, setLocations] = useState([]);
  const [agentFormStep, setAgentFormStep] = useState(1);
  const [currentLeadUrn, setCurrentLeadUrn] = useState('');
  const [leadForm, setLeadForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    cardId: '',
    pan_no: '',
    dob: '',
    mother_name: '',
    current_address: '',
    employment: '',
    designation: '',
    monthly_income: '',
    pincode: '',
    address_house: '',
    address_street: '',
    address_locality: '',
    address_city: '',
    address_state: ''
  });
  
  const [leadError, setLeadError] = useState('');
  const [leadSuccess, setLeadSuccess] = useState('');
  const [errors, setErrors] = useState({});

  // Pincode Lookup & Serviceability States
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeLocationText, setPincodeLocationText] = useState('');
  const [pincodeError, setPincodeError] = useState('');
  const [pincodeLocalities, setPincodeLocalities] = useState([]);
  const [settings, setSettings] = useState({});
  const [designationDropdownOpen, setDesignationDropdownOpen] = useState(false);
  const [employmentDropdownOpen, setEmploymentDropdownOpen] = useState(false);
  const [cardDropdownOpen, setCardDropdownOpen] = useState(false);
  const designationDropdownRef = useRef(null);
  const employmentDropdownRef = useRef(null);
  const cardDropdownRef = useRef(null);

  // Performance stats & Agent Leads Repository
  const [agentLeads, setAgentLeads] = useState([]);
  const [agentSearch, setAgentSearch] = useState('');
  const [agentCardFilter, setAgentCardFilter] = useState('');
  const [agentCurrentPage, setAgentCurrentPage] = useState(1);
  const [showCreateLeadModal, setShowCreateLeadModal] = useState(false);
  const AGENT_PAGE_SIZE = 50;

  const filteredAgentLeads = useMemo(() => {
    return (agentLeads || []).filter(l => {
      if (agentCardFilter && String(l.card_id) !== String(agentCardFilter) && l.card_name !== agentCardFilter) {
        return false;
      }
      if (agentSearch.trim()) {
        const s = agentSearch.trim().toLowerCase();
        const matchName = (l.full_name || '').toLowerCase().includes(s);
        const matchPhone = (l.phone || '').includes(s);
        const matchUrn = (l.urn || '').toLowerCase().includes(s);
        const matchPan = (l.pan_no || '').toLowerCase().includes(s);
        const matchEmail = (l.email || '').toLowerCase().includes(s);
        const matchAppId = (l.application_id || '').toLowerCase().includes(s);
        if (!matchName && !matchPhone && !matchUrn && !matchPan && !matchEmail && !matchAppId) {
          return false;
        }
      }
      return true;
    });
  }, [agentLeads, agentSearch, agentCardFilter]);

  const paginatedAgentLeads = useMemo(() => {
    const start = (agentCurrentPage - 1) * AGENT_PAGE_SIZE;
    return filteredAgentLeads.slice(start, start + AGENT_PAGE_SIZE);
  }, [filteredAgentLeads, agentCurrentPage]);

  const totalAgentPages = Math.ceil(filteredAgentLeads.length / AGENT_PAGE_SIZE) || 1;
  
  // Bulk Lead Upload States for Agents
  const [showAgentUploadModal, setShowAgentUploadModal] = useState(false);
  const [agentUploadFile, setAgentUploadFile] = useState(null);
  const [isUploadingAgentLeads, setIsUploadingAgentLeads] = useState(false);
  const [agentUploadResult, setAgentUploadResult] = useState(null);
  const [showAgentUploadResultModal, setShowAgentUploadResultModal] = useState(false);

  // Bank MIS Agent States
  const [showBankMisUploadModal, setShowBankMisUploadModal] = useState(false);
  const [bankMisUploadFile, setBankMisUploadFile] = useState(null);
  const [bankMisUploadBank, setBankMisUploadBank] = useState('');
  const [isUploadingBankMis, setIsUploadingBankMis] = useState(false);
  const [bankMisUploadResult, setBankMisUploadResult] = useState(null);
  const [showBankMisResultModal, setShowBankMisResultModal] = useState(false);
  const [bankMisSearch, setBankMisSearch] = useState('');
  const [bankMisStatusFilter, setBankMisStatusFilter] = useState('');
  const [bankMisCurrentPage, setBankMisCurrentPage] = useState(1);

  const isBankMisAgent = agent?.can_upload_mis || agent?.agent_mode === 'bank_mis_agent';

  const getMatchingBankValue = useCallback((rawBank) => {
    if (!rawBank) return 'HDFC Bank';
    const b = String(rawBank).trim();
    const bLower = b.toLowerCase();
    
    if (bLower.includes('hdfc')) return 'HDFC Bank';
    if (bLower.includes('sbi') || bLower.includes('state bank')) return 'SBI';
    if (bLower.includes('axis')) return 'Axis Bank';
    if (bLower.includes('icici')) return 'ICICI Bank';
    if (bLower.includes('tata')) return 'TATA Capital';
    if (bLower.includes('kotak')) return 'Kotak Mahindra Bank';
    if (bLower.includes('indusind')) return 'IndusInd Bank';
    if (bLower.includes('au small') || bLower.includes('au bank')) return 'AU Small Finance Bank';
    if (bLower.includes('idfc')) return 'IDFC FIRST Bank';
    if (bLower.includes('kiwi')) return 'KIWI';
    return b;
  }, []);

  const availableBankOptions = useMemo(() => {
    const list = [
      'HDFC Bank',
      'SBI',
      'Axis Bank',
      'ICICI Bank',
      'TATA Capital',
      'Kotak Mahindra Bank',
      'IndusInd Bank',
      'AU Small Finance Bank',
      'IDFC FIRST Bank',
      'KIWI'
    ];
    if (agent && agent.assigned_bank) {
      const assigned = getMatchingBankValue(agent.assigned_bank);
      if (!list.includes(assigned)) {
        list.unshift(assigned);
      }
    }
    (cards || []).forEach(c => {
      if (c.bank) {
        const b = getMatchingBankValue(c.bank);
        if (!list.includes(b)) list.push(b);
      }
    });
    return list;
  }, [agent, cards, getMatchingBankValue]);

  useEffect(() => {
    if (agent && agent.assigned_bank && !bankMisUploadBank) {
      setBankMisUploadBank(getMatchingBankValue(agent.assigned_bank));
    }
  }, [agent, bankMisUploadBank, getMatchingBankValue]);

  const filteredBankMisLeads = useMemo(() => {
    return (agentLeads || []).filter(l => {
      // Filter to agent's assigned bank if present
      if (agent && agent.assigned_bank) {
        const assigned = String(agent.assigned_bank).toLowerCase().trim();
        const leadBank = String(l.card_bank || l.bank || '').toLowerCase().trim();
        const leadCard = String(l.card_name || '').toLowerCase().trim();
        if (assigned && !leadBank.includes(assigned) && !leadCard.includes(assigned) && l.agent_id !== agent.id) {
          return false;
        }
      }
      if (bankMisStatusFilter) {
        const st = String(l.mis_status || 'Pending').toLowerCase();
        if (bankMisStatusFilter === 'approved' && !st.includes('approved') && !st.includes('issued') && !st.includes('sanctioned') && !st.includes('success')) return false;
        if (bankMisStatusFilter === 'pending' && !st.includes('pending') && !st.includes('process') && !st.includes('wip')) return false;
        if (bankMisStatusFilter === 'declined' && !st.includes('declined') && !st.includes('rejected') && !st.includes('dropped')) return false;
      }
      if (bankMisSearch.trim()) {
        const s = bankMisSearch.trim().toLowerCase();
        const matchName = (l.full_name || '').toLowerCase().includes(s);
        const matchPhone = (l.phone || '').includes(s);
        const matchUrn = (l.urn || '').toLowerCase().includes(s);
        const matchPan = (l.pan_no || '').toLowerCase().includes(s);
        const matchAppId = (l.application_id || '').toLowerCase().includes(s);
        if (!matchName && !matchPhone && !matchUrn && !matchPan && !matchAppId) {
          return false;
        }
      }
      return true;
    });
  }, [agentLeads, agent, bankMisSearch, bankMisStatusFilter]);

  const paginatedBankMisLeads = useMemo(() => {
    const start = (bankMisCurrentPage - 1) * AGENT_PAGE_SIZE;
    return filteredBankMisLeads.slice(start, start + AGENT_PAGE_SIZE);
  }, [filteredBankMisLeads, bankMisCurrentPage]);

  const totalBankMisPages = Math.ceil(filteredBankMisLeads.length / AGENT_PAGE_SIZE) || 1;

  const bankMisStats = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let declined = 0;
    filteredBankMisLeads.forEach(l => {
      const st = String(l.mis_status || 'Pending').toLowerCase();
      if (st.includes('approved') || st.includes('issued') || st.includes('success') || st.includes('sanctioned')) {
        approved++;
      } else if (st.includes('declined') || st.includes('rejected') || st.includes('dropped')) {
        declined++;
      } else {
        pending++;
      }
    });
    return { total: filteredBankMisLeads.length, approved, pending, declined };
  }, [filteredBankMisLeads]);

  const handleUploadBankMis = async (e) => {
    e.preventDefault();
    if (!bankMisUploadFile) {
      alert('Please select an Excel or CSV file to upload.');
      return;
    }

    setIsUploadingBankMis(true);
    const formData = new FormData();
    const targetBank = getMatchingBankValue(agent?.assigned_bank) || agent?.assigned_bank || 'HDFC Bank';
    formData.append('file', bankMisUploadFile);
    formData.append('bank', targetBank);

    try {
      const res = await fetch(`${API_URL}/leads/upload-mis`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload Bank MIS file.');
      }

      setBankMisUploadResult(data);
      setShowBankMisUploadModal(false);
      setShowBankMisResultModal(true);
      setBankMisUploadFile(null);
      fetchMasterData();
    } catch (err) {
      alert(err.message || 'Bank MIS Upload failed.');
    } finally {
      setIsUploadingBankMis(false);
    }
  };

  const handleDownloadBankMisTemplate = () => {
    const csvContent = `URN,Application ID,PAN Number,Customer Name,Phone,Bank Name,IPA Status,Final Decision,Remark
FM2026G2800080,APP10001,ABCDE1234F,Harsh Deep,8708569574,HDFC Bank,APPROVED,Approved,Card issued successfully
FM2026G2800079,APP10002,DVRPA5807A,IMTIYAZ AHMED,9785197812,SBI,DECLINE,Declined,Low CIBIL score`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${(agent?.assigned_bank || 'Bank').replace(/\s+/g, '_')}_MIS_Upload_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'Application ID', 'Full Name', 'Phone', 'Email', 'PAN Number', 'Date of Birth',
      'Mother Name', 'Current Address', 'Pincode', 'Employment', 'Designation',
      'Company Name', 'Already Has Credit Card', 'Net Monthly Income', 'Income Range',
      'Card Name', 'Card Bank', 'Consent', 'Landing Page URL', 'Redirect URL'
    ];
    const sampleRow = [
      'APP10099', 'Anil Sharma', '9876543210', 'anil.sharma@example.com', 'ABCDE1234F', '1995-05-15',
      'Sunita Sharma', '123 Main Street, Sector 15', '110001', 'Salaried', 'Software Engineer',
      'TCS Tech', 'No', '65000', '6-9 LPA',
      'Kiwi Credit Card', 'Kiwi', 'Yes', 'https://finmantra.org/kiwi', 'https://finmantra.org/'
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), sampleRow.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'FinMantra_Lead_Upload_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadAgentLeads = async (e) => {
    e.preventDefault();
    if (!agentUploadFile) {
      alert('Please select an Excel or CSV file to upload.');
      return;
    }

    setIsUploadingAgentLeads(true);
    const formData = new FormData();
    formData.append('file', agentUploadFile);

    try {
      const res = await fetch(`${API_URL}/leads/upload-manual`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload leads.');
      }

      setAgentUploadResult(data);
      setShowAgentUploadModal(false);
      setShowAgentUploadResultModal(true);
      setAgentUploadFile(null);
      fetchMasterData();
    } catch (err) {
      alert(err.message || 'Upload failed.');
    } finally {
      setIsUploadingAgentLeads(false);
    }
  };
  
  const filteredCards = useMemo(() => {
    return cards.filter(c => {
      // Hide 'digital' category cards from agents (already filtered, but let's be safe)
      if (c.category?.toLowerCase() === 'digital') return false;
      
      // If agent has an assigned bank, only show cards from that bank (case-insensitive)
      if (agent && agent.assigned_bank) {
        const agentBank = String(agent.assigned_bank).trim().toLowerCase();
        const cardBank = String(c.bank).trim().toLowerCase();
        if (cardBank !== agentBank) return false;
      }

      // If it's an offline card with specific locations assigned,
      // only show it if the agent is logged in to one of those locations.
      if (c.category?.toLowerCase() === 'offline') {
        if (c.card_locations && c.card_locations.length > 0) {
          return c.card_locations.includes(agentLocation);
        }
      }
      return true;
    });
  }, [cards, agentLocation, agent]);
  
  const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173') ? 'http://localhost:5000/api' : '/api';

  // Check and enforce location selection
  useEffect(() => {
    if (token && agent) {
      const cached = localStorage.getItem('finmantra_agent_selected_location');
      let validLocation = '';
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (new Date().getTime() < parsed.expiresAt) {
            validLocation = parsed.location;
          }
        } catch (e) {}
      }

      if (validLocation) {
        setAgentLocation(validLocation);
      } else {
        const locs = agent.locations || [];
        if (locs.length > 1) {
          setShowLocationModal(true);
        } else if (locs.length === 1) {
          const midnight = new Date();
          midnight.setHours(23, 59, 59, 999);
          const cacheObj = { location: locs[0], expiresAt: midnight.getTime() };
          localStorage.setItem('finmantra_agent_selected_location', JSON.stringify(cacheObj));
          setAgentLocation(locs[0]);
        } else {
          setAgentLocation('');
        }
      }
    } else {
      setAgentLocation('');
      setShowLocationModal(false);
    }
  }, [token, agent]);

  // Fetch data if logged in
  useEffect(() => {
    if (token) {
      fetchMasterData();
    }
  }, [token]);

  // Real-time synchronization via WebSocket for agent portal (only after verified auth)
  useEffect(() => {
    if (!isAuthenticated) return;

    let isCleaningUp = false;
    let reconnectTimer;
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = window.location.hostname === 'localhost' 
      ? `ws://${window.location.hostname}:5000` 
      : `${wsProto}//${window.location.host}/api/ws`;
    let socket;
    let reconnectDelay = 5000;

    const connectWebSocket = () => {
      if (isCleaningUp) return;
      try {
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          reconnectDelay = 5000;
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            if (
              message.type === 'CARDS_UPDATED' || 
              message.type === 'LOCATIONS_UPDATED' || 
              message.type === 'LEAD_ADDED' || 
              message.type === 'LEADS_UPDATED' ||
              message.type === 'AGENTS_UPDATED'
            ) {
              fetchMasterData();
            }
          } catch (err) {
            // silent
          }
        };

        socket.onclose = () => {
          if (isCleaningUp) return;
          reconnectTimer = setTimeout(() => {
            if (!isCleaningUp) {
              reconnectDelay = Math.min(reconnectDelay * 2, 300000); // Max 5 minutes backoff
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
  }, [isAuthenticated]);

  const fetchMasterData = async () => {
    try {
      const [cardsRes, locsRes, leadsRes, settingsRes] = await Promise.all([
        fetch(`${API_URL}/cards`),
        fetch(`${API_URL}/locations`),
        fetch(`${API_URL}/leads`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/settings`)
      ]);

      const cardsData = await cardsRes.json();
      const locsData = await locsRes.json();
      
      const cardsList = Array.isArray(cardsData) ? cardsData : [];
      const locsList = Array.isArray(locsData) ? locsData : [];

      setCards(cardsList.filter(c => c.category?.toLowerCase() !== 'digital'));
      setLocations(locsList.filter(l => l.active));
      
      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        setSettings(sData || {});
      }

      if (leadsRes.status === 401 || leadsRes.status === 403) {
        handleLogout();
        return;
      }

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        const leadsList = Array.isArray(leadsData) ? leadsData : (leadsData.leads || []);
        setAgentLeads(leadsList);
        setIsAuthenticated(true);
      }
    } catch (err) {
      console.error('Error fetching agent data:', err);
    }
  };

  // Auto-Lookup Pincode API for Agent Lead Form
  useEffect(() => {
    const lookupAgentPincode = async () => {
      const pin = (leadForm.pincode || '').trim();
      if (pin.length !== 6 || !/^\d+$/.test(pin)) {
        setPincodeLocationText('');
        setPincodeError('');
        return;
      }

      setPincodeLoading(true);
      setPincodeError('');
      setPincodeLocationText('');

      try {
        const res = await fetch(`${API_URL}/pincode/lookup/${pin}`);
        if (res.ok) {
          const data = await res.json();
          setPincodeLocationText(`${data.city}, ${data.state}`);
          setPincodeLocalities(data.localities);
          
          setLeadForm(prev => ({ 
            ...prev, 
            address_city: data.city,
            address_state: data.state,
            address_locality: data.localities[0] || ''
          }));
        } else {
          throw new Error('Not found');
        }
      } catch (e) {
        setPincodeLocalities([]);
        const fallbackState = getStateFromPincode(pin);
        if (fallbackState) {
          setPincodeLocationText(`${fallbackState} (Estimated)`);
          setLeadForm(prev => ({ 
            ...prev, 
            address_city: fallbackState,
            address_state: fallbackState,
            address_locality: ''
          }));
        } else {
          setPincodeError('Pincode not found');
        }
      } finally {
        if (pin.length === 6 && /^\d+$/.test(pin)) {
          const selectedCardDetails = cards.find(c => c.id === parseInt(leadForm.cardId, 10));
          if (selectedCardDetails && selectedCardDetails.bank) {
            let bankRules = {};
            try {
              if (settings.bank_pincode_rules) {
                bankRules = typeof settings.bank_pincode_rules === 'string'
                  ? JSON.parse(settings.bank_pincode_rules)
                  : settings.bank_pincode_rules;
              }
            } catch (err) {
              console.error('Error parsing bank pincode rules:', err);
            }
            
            const serviceablePins = bankRules[selectedCardDetails.bank];
            if (Array.isArray(serviceablePins) && serviceablePins.length > 0) {
              const isServiceable = serviceablePins.includes(pin);
              if (!isServiceable) {
                setPincodeError(`${selectedCardDetails.bank} cards facilities are currently not available for your location.`);
              }
            }
          }
        }
        setPincodeLoading(false);
      }
    };

    lookupAgentPincode();
  }, [leadForm.pincode, leadForm.cardId]);

  // Close custom dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (designationDropdownRef.current && !designationDropdownRef.current.contains(e.target)) {
        setDesignationDropdownOpen(false);
      }
      if (employmentDropdownRef.current && !employmentDropdownRef.current.contains(e.target)) {
        setEmploymentDropdownOpen(false);
      }
      if (cardDropdownRef.current && !cardDropdownRef.current.contains(e.target)) {
        setCardDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginForm(prev => ({ ...prev, [name]: value }));
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/agents/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();

      if (res.ok) {
        setCookie('finmantra_agent_token', data.token, 1);
        setCookie('finmantra_agent', JSON.stringify(data.agent), 1);
        setToken(data.token);
        setAgent(data.agent);
        setTimeLeft(0);
      } else {
        setAuthError(data.error || 'Invalid credentials');
        if (data.timeLeft) {
          setTimeLeft(data.timeLeft);
        }
      }
    } catch (err) {
      setAuthError('Connection error. Server is offline.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    deleteCookie('finmantra_agent_token');
    deleteCookie('finmantra_agent');
    localStorage.removeItem('finmantra_agent_selected_location');
    setToken('');
    setIsAuthenticated(false);
    setAgent(null);
    setAgentLocation('');
    setLoginForm({ username: '', password: '' });
  };

  const validateField = (name, value) => {
    let errorText = '';
    
    if (name === 'fullName') {
      const trimmed = value.trim();
      if (trimmed) {
        if (!/^[a-zA-Z\s]+$/.test(trimmed)) {
          errorText = 'Enter your Name as per PAN card';
        } else {
          const words = trimmed.split(/\s+/).filter(Boolean);
          if (words.length < 2) {
            errorText = 'Please enter your Last Name / Father Name';
          }
        }
      } else {
        errorText = 'This field is required';
      }
    }
    
    if (name === 'phone') {
      if (value) {
        const allowedStr = '6,7,8,9';
        const startChars = allowedStr.split(',').map(s => s.trim()).filter(Boolean);
        const isValidStart = startChars.some(char => value.startsWith(char));
        if (!isValidStart) {
          errorText = `Mobile number should start with ${startChars.join(',')} only`;
        } else if (value.length !== 10) {
          errorText = 'Mobile number must be exactly 10 digits.';
        }
      } else {
        errorText = 'This field is required';
      }
    }
    
    if (name === 'email') {
      if (value) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errorText = 'Please enter valid Email';
        }
      } else {
        errorText = 'This field is required';
      }
    }
    
    if (name === 'pan_no') {
      if (value) {
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value)) {
          errorText = 'Invalid PAN card format (e.g. ABCDE1234F).';
        }
      } else {
        errorText = 'This field is required';
      }
    }

    if (name === 'dob') {
      if (value) {
        const birthDate = new Date(value);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        if (age < 18) {
          errorText = 'Minimum age required is 18 years.';
        }
      } else {
        errorText = 'This field is required';
      }
    }

    if (name === 'mother_name') {
      if (!value.trim()) {
        errorText = 'This field is required';
      }
    }

    if (name === 'employment') {
      if (!value) {
        errorText = 'This field is required';
      }
    }

    if (name === 'designation') {
      if (!value) {
        errorText = 'This field is required';
      }
    }

    if (name === 'address_house') {
      if (!value.trim()) {
        errorText = 'This field is required';
      }
    }

    if (name === 'address_street') {
      if (!value.trim()) {
        errorText = 'This field is required';
      }
    }

    if (name === 'pincode') {
      if (value) {
        if (value.length !== 6 || !/^\d+$/.test(value)) {
          errorText = 'Pincode must be exactly 6 digits.';
        } else {
          // Check global pincode serviceability
          const pinMode = settings.pincode_serviceability_mode || 'all';
          const pinListRaw = settings.pincode_serviceability_list || '';
          if (pinMode !== 'all') {
            const pinArray = pinListRaw.split(',').map(p => p.trim()).filter(Boolean);
            const isInList = pinArray.includes(value);
            if (pinMode === 'whitelist' && !isInList) {
              errorText = 'Credit card services are not available at your pincode currently.';
            }
            if (pinMode === 'blacklist' && isInList) {
              errorText = 'Credit card services are not available at your pincode currently.';
            }
          }

          // Check bank-specific pincode serviceability
          if (!errorText && leadForm.cardId) {
            const selectedCardDetails = cards.find(c => c.id === leadForm.cardId);
            if (selectedCardDetails && selectedCardDetails.bank) {
              let bankRules = {};
              try {
                if (settings.bank_pincode_rules) {
                  bankRules = typeof settings.bank_pincode_rules === 'string'
                    ? JSON.parse(settings.bank_pincode_rules)
                    : settings.bank_pincode_rules;
                }
              } catch (err) {}

              const rule = bankRules[selectedCardDetails.bank];
              if (rule && rule.mode === 'list') {
                const pinArray = String(rule.list || '').split(',').map(p => p.trim()).filter(Boolean);
                if (!pinArray.includes(value)) {
                  errorText = `${selectedCardDetails.bank} cards facilities are currently not available for your location.`;
                }
              }
            }
          }
        }
      } else {
        errorText = 'This field is required';
      }
    }

    if (name === 'address_locality') {
      if (!value) {
        errorText = 'This field is required';
      }
    }

    if (name === 'address_city') {
      if (!value) {
        errorText = 'This field is required';
      }
    }

    if (name === 'address_state') {
      if (!value) {
        errorText = 'This field is required';
      }
    }

    if (name === 'monthly_income') {
      if (value) {
        const incomeNum = parseInt(value, 10);
        if (isNaN(incomeNum) || incomeNum <= 0) {
          errorText = 'Please enter a valid monthly income.';
        }
      }
    }

    setErrors(prev => {
      const updated = { ...prev };
      if (errorText) {
        updated[name] = errorText;
      } else {
        delete updated[name];
      }
      return updated;
    });
  };

  const handleLeadChange = (e) => {
    const { name, value } = e.target;
    let finalVal = value;
    if (name === 'phone') {
      finalVal = value.replace(/\D/g, '').slice(0, 10);
      setLeadForm(prev => ({ ...prev, [name]: finalVal }));
      validateField(name, finalVal);
      return;
    }
    if (name === 'pan_no') {
      finalVal = value.toUpperCase().slice(0, 10);
      setLeadForm(prev => ({ ...prev, [name]: finalVal }));
      validateField(name, finalVal);
      return;
    }
    if (name === 'pincode' || name === 'monthly_income') {
      finalVal = value.replace(/\D/g, '');
      setLeadForm(prev => ({ ...prev, [name]: finalVal }));
      validateField(name, finalVal);
      return;
    }
    setLeadForm(prev => ({ ...prev, [name]: finalVal }));
    validateField(name, finalVal);
  };

  const validateAgentStep = (stepNum) => {
    setLeadError('');
    let stepFields = [];
    if (stepNum === 1) {
      stepFields = ['fullName', 'phone', 'email', 'pan_no', 'dob', 'mother_name'];
    } else {
      stepFields = ['employment', 'designation', 'cardId', 'pincode', 'address_house', 'address_street', 'address_locality', 'address_city', 'address_state', 'monthly_income'];
    }

    let isValid = true;
    const currentErrors = { ...errors };

    stepFields.forEach(field => {
      let errorText = '';
      const value = leadForm[field] || '';

      if (field === 'fullName') {
        const trimmed = value.trim();
        if (trimmed) {
          if (!/^[a-zA-Z\s]+$/.test(trimmed)) {
            errorText = 'Enter your Name as per PAN card';
          } else {
            const words = trimmed.split(/\s+/).filter(Boolean);
            if (words.length < 2) {
              errorText = 'Please enter your Last Name / Father Name';
            }
          }
        } else {
          errorText = 'This field is required';
        }
      }
      
      if (field === 'phone') {
        if (value) {
          const allowedStr = '6,7,8,9';
          const startChars = allowedStr.split(',').map(s => s.trim()).filter(Boolean);
          const isValidStart = startChars.some(char => value.startsWith(char));
          if (!isValidStart) {
            errorText = `Mobile number should start with ${startChars.join(',')} only`;
          } else if (value.length !== 10) {
            errorText = 'Mobile number must be exactly 10 digits.';
          }
        } else {
          errorText = 'This field is required';
        }
      }
      
      if (field === 'email') {
        if (value) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errorText = 'Please enter valid Email';
          }
        } else {
          errorText = 'This field is required';
        }
      }
      
      if (field === 'pan_no') {
        if (value) {
          if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value)) {
            errorText = 'Invalid PAN card format (e.g. ABCDE1234F).';
          }
        } else {
          errorText = 'This field is required';
        }
      }

      if (field === 'dob') {
        if (value) {
          const birthDate = new Date(value);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          if (age < 18) {
            errorText = 'Minimum age required is 18 years.';
          }
        } else {
          errorText = 'This field is required';
        }
      }

      if (field === 'mother_name') {
        if (!value.trim()) {
          errorText = 'This field is required';
        }
      }

      if (field === 'employment') {
        if (!value) {
          errorText = 'This field is required';
        }
      }

      if (field === 'designation') {
        if (!value) {
          errorText = 'This field is required';
        }
      }

      if (field === 'cardId') {
        if (!value) {
          errorText = 'Please select a card to apply';
        }
      }

      if (field === 'address_house') {
        if (!value.trim()) {
          errorText = 'This field is required';
        }
      }

      if (field === 'address_street') {
        if (!value.trim()) {
          errorText = 'This field is required';
        }
      }

      if (field === 'pincode') {
        if (value) {
          if (value.length !== 6 || !/^\d+$/.test(value)) {
            errorText = 'Pincode must be exactly 6 digits.';
          } else {
            // Check global pincode serviceability
            const pinMode = settings.pincode_serviceability_mode || 'all';
            const pinListRaw = settings.pincode_serviceability_list || '';
            if (pinMode !== 'all') {
              const pinArray = pinListRaw.split(',').map(p => p.trim()).filter(Boolean);
              const isInList = pinArray.includes(value);
              if (pinMode === 'whitelist' && !isInList) {
                errorText = 'Credit card services are not available at your pincode currently.';
              }
              if (pinMode === 'blacklist' && isInList) {
                errorText = 'Credit card services are not available at your pincode currently.';
              }
            }

            // Check bank-specific pincode serviceability
            if (!errorText && leadForm.cardId) {
              const selectedCardDetails = cards.find(c => c.id === leadForm.cardId);
              if (selectedCardDetails && selectedCardDetails.bank) {
                let bankRules = {};
                try {
                  if (settings.bank_pincode_rules) {
                    bankRules = typeof settings.bank_pincode_rules === 'string'
                      ? JSON.parse(settings.bank_pincode_rules)
                      : settings.bank_pincode_rules;
                  }
                } catch (err) {}

                const rule = bankRules[selectedCardDetails.bank];
                if (rule && rule.mode === 'list') {
                  const pinArray = String(rule.list || '').split(',').map(p => p.trim()).filter(Boolean);
                  if (!pinArray.includes(value)) {
                    errorText = `${selectedCardDetails.bank} cards facilities are currently not available for your location.`;
                  }
                }
              }
            }
          }
        } else {
          errorText = 'This field is required';
        }
      }

      if (field === 'address_locality') {
        if (!value) {
          errorText = 'This field is required';
        }
      }

      if (field === 'address_city') {
        if (!value) {
          errorText = 'This field is required';
        }
      }

      if (field === 'address_state') {
        if (!value) {
          errorText = 'This field is required';
        }
      }

      if (field === 'monthly_income') {
        if (value) {
          const incomeNum = parseInt(value, 10);
          if (isNaN(incomeNum) || incomeNum <= 0) {
            errorText = 'Please enter a valid monthly income.';
          }
        }
      }

      if (errorText) {
        currentErrors[field] = errorText;
        isValid = false;
      } else {
        delete currentErrors[field];
      }
    });

    setErrors(currentErrors);
    if (!isValid) {
      setLeadError('Please correct the validation errors in the form.');
    }
    return isValid;
  };

  const handleAgentContinueToStep2 = () => {
    if (validateAgentStep(1)) {
      setAgentFormStep(2);
    }
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    setLeadError('');
    setLeadSuccess('');

    if (!validateAgentStep(1) || !validateAgentStep(2)) {
      return;
    }

    const { fullName, phone, email, cardId, pan_no, dob, mother_name, employment, designation, monthly_income } = leadForm;
    const cleanPan = pan_no.trim().toUpperCase();
    const compiledAddress = `${leadForm.address_house.trim()}, ${leadForm.address_street.trim()}${leadForm.address_locality ? ', ' + leadForm.address_locality.trim() : ''}, ${leadForm.address_city.trim()}, ${leadForm.address_state.trim()} - ${leadForm.pincode.trim()}`;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          card_id: cardId,
          source: 'agent',
          agent_id: agent?.id,
          agent_name: agent?.name,
          agent_location: agentLocation,
          consent: true,
          pan_no: cleanPan,
          dob: dob || null,
          mother_name: mother_name || null,
          current_address: compiledAddress,
          pincode: leadForm.pincode || null,
          employment: employment || null,
          designation: designation || null,
          monthly_income: monthly_income || null,
          income_range: monthly_income ? `₹${parseInt(monthly_income, 10).toLocaleString('en-IN')}` : null
        })
      });
      const data = await res.json();

      if (res.ok) {
        setLeadSuccess(`Lead registered successfully! Generated URN: ${data.urn}. The application link has been sent to the client's WhatsApp number.`);
        
        // Trigger browser events (Meta Pixel & GTM)
        trackLeadSubmission({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          eventId: data.urn || data.id,
          contentName: 'Agent Lead Submitted',
          status: 'submitted'
        });

        // Reset lead form and step
        setLeadForm({
          fullName: '',
          phone: '',
          email: '',
          cardId: '',
          pan_no: '',
          dob: '',
          mother_name: '',
          current_address: '',
          employment: '',
          designation: '',
          monthly_income: '',
          pincode: '',
          address_house: '',
          address_street: '',
          address_locality: '',
          address_city: '',
          address_state: ''
        });
        setPincodeLocationText('');
        setPincodeError('');
        setPincodeLocalities([]);
        setCurrentLeadUrn('');
        setAgentFormStep(1);
        setErrors({});

        // Reload agent performance leads
        fetchMasterData();
        setIsSubmitting(false);
      } else {
        setLeadError(data.error || 'Failed to submit lead.');
        setIsSubmitting(false);
      }
    } catch (err) {
      setLeadError('Network error. Unable to register lead.');
      setIsSubmitting(false);
    }
  };

  // Stats computation
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysLeads = agentLeads.filter(l => l.created_at && l.created_at.startsWith(todayStr));

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
              <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '0.35rem' }}>Agent Terminal</h2>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>Access your lead generation control console</p>
            </div>

            <form onSubmit={handleLoginSubmit}>
              <div className="interactive-input-group">
                <label>Username</label>
                <input 
                  type="text" 
                  name="username" 
                  className="interactive-input-field" 
                  placeholder="Enter username" 
                  value={loginForm.username} 
                  onChange={handleLoginChange}
                  autoComplete="username"
                  required 
                />
              </div>

              <div className="interactive-input-group" style={{ marginBottom: '1.75rem' }}>
                <label>Password</label>
                <input 
                  type="password" 
                  name="password" 
                  className="interactive-input-field" 
                  placeholder="Enter password" 
                  value={loginForm.password} 
                  onChange={handleLoginChange}
                  autoComplete="current-password"
                  required 
                />
              </div>

              {authError && (
                <div style={{ background: 'rgba(209, 67, 67, 0.08)', border: '1px solid rgba(209, 67, 67, 0.15)', padding: '0.75rem 1rem', borderRadius: '8px', color: 'var(--err)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
                  {authError}
                </div>
              )}

              <button type="submit" className="btn-primary login-btn-interactive" disabled={loading || timeLeft > 0}>
                <span>{timeLeft > 0 ? `Blocked (Try in ${formatTime(timeLeft)})` : (loading ? 'Authenticating...' : 'Access Terminal')}</span>
                <LogIn size={18} />
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

  return (
    <div className="agent-container">
      
      {/* Daily Location Selector Modal */}
      {showLocationModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(15, 23, 42, 0.40)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(8px)',
          padding: '1.5rem'
        }}>
          <div className="glass-panel" style={{ 
            width: '100%', 
            maxWidth: '440px', 
            borderLeft: '4px solid hsl(var(--primary))', 
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.1)',
            background: '#ffffff',
            color: 'hsl(var(--text-primary))'
          }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(var(--text-primary))' }}>
              <MapPin size={22} className="text-gradient-purple-cyan" /> Kiosk Login Location
            </h2>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              Welcome back! Please select the active kiosk location where you are stationed today. This preference persists for the entire day.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {agent?.locations?.map((loc, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    const midnight = new Date();
                    midnight.setHours(23, 59, 59, 999);
                    const cacheObj = { location: loc, expiresAt: midnight.getTime() };
                    localStorage.setItem('finmantra_agent_selected_location', JSON.stringify(cacheObj));
                    setAgentLocation(loc);
                    setShowLocationModal(false);
                  }}
                  className="btn-secondary"
                  style={{ 
                    padding: '1rem 1.25rem', 
                    textAlign: 'left', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    background: 'var(--paper-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-md)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    color: 'var(--ink)',
                    fontWeight: 600
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(224, 168, 46, 0.05)';
                    e.currentTarget.style.borderColor = 'var(--gold)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--paper-2)';
                    e.currentTarget.style.borderColor = 'var(--line)';
                  }}
                >
                  <span>{loc}</span>
                  <CheckCircle size={16} style={{ color: 'hsl(var(--primary))' }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sticky Premium Top Navigation Bar */}
      <div className="admin-navbar glass-panel" style={{ 
        position: 'sticky', 
        top: '1rem', 
        zIndex: 1000, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '0.9rem 1.75rem', 
        minHeight: '70px',
        marginBottom: '1rem',
        backdropFilter: 'blur(12px)',
        background: 'var(--glass-bg)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 32px 0 rgba(17, 19, 43, 0.08)'
      }}>
        {/* Brand/Logo */}
        <div className="admin-nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src="/logo.jpg" alt="FinMantra Logo" style={{ height: '40px', width: '40px', borderRadius: '9px', objectFit: 'cover', boxShadow: '0 3px 10px rgba(224, 168, 46, 0.28)' }} />
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.35rem', letterSpacing: '-0.03em', color: 'var(--ink)' }}>
            FinMantra <span style={{ color: 'var(--gold-deep)', fontWeight: 500, fontSize: '0.9rem' }}>Agent</span>
          </span>
        </div>


      </div>

      {/* Dedicated View for Bank MIS Agents vs Field Sales Agents */}
      {isBankMisAgent ? (
        <>
          {/* Bank MIS Agent Top Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Welcome, {agent?.name}</h1>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <User size={16} /> ID: Agent-{agent?.id || 'Active'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--gold-deep)', fontWeight: 700 }}>
                  🏦 Mapped Bank: {agent?.assigned_bank || 'All Partner Banks'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'hsl(var(--secondary))', fontWeight: 600 }}>
                  <CheckCircle size={16} /> Working Today At: {agentLocation || 'Bank Desk'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button 
                type="button"
                onClick={() => {
                  setBankMisUploadBank(getMatchingBankValue(agent?.assigned_bank));
                  setShowBankMisUploadModal(true);
                }} 
                className="btn-primary" 
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', borderRadius: '6px', background: 'var(--gold-deep)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(224, 168, 46, 0.3)' }}
              >
                <FileSpreadsheet size={18} /> Upload Bank MIS (Excel / CSV)
              </button>
            </div>
          </div>

          {/* Bank MIS Metrics Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid var(--gold-deep)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Total Bank MIS Leads</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.2rem' }}>{bankMisStats.total}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem' }}>Mapped for {agent?.assigned_bank || 'Bank'}</div>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid var(--success)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>Approved / Issued</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.2rem' }}>{bankMisStats.approved}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem' }}>Card issued or approved</div>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid var(--warning)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--warning)', fontWeight: 600 }}>Pending Verification</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--warning)', marginTop: '0.2rem' }}>{bankMisStats.pending}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem' }}>In process / under review</div>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid var(--err)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--err)', fontWeight: 600 }}>Declined / Rejected</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--err)', marginTop: '0.2rem' }}>{bankMisStats.declined}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem' }}>Dropped or declined</div>
            </div>
          </div>

          {/* Bank MIS Repository Table */}
          <div className="glass-panel" style={{ width: '100%', boxSizing: 'border-box', padding: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h2 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700 }}>My Bank MIS & Leads Repository</h2>
                <span className="badge badge-success" style={{ fontSize: '0.8rem', padding: '0.25rem 0.65rem' }}>
                  {filteredBankMisLeads.length} Bank Records
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {/* Search Input */}
                <div style={{ position: 'relative', minWidth: '280px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Search name, phone, URN, PAN, App ID..."
                    value={bankMisSearch}
                    onChange={(e) => { setBankMisSearch(e.target.value); setBankMisCurrentPage(1); }}
                    style={{ paddingLeft: '2.2rem', height: '38px', fontSize: '0.85rem' }}
                  />
                </div>

                {/* Status Filter */}
                <div style={{ minWidth: '180px' }}>
                  <select 
                    className="form-select"
                    value={bankMisStatusFilter}
                    onChange={(e) => { setBankMisStatusFilter(e.target.value); setBankMisCurrentPage(1); }}
                    style={{ height: '38px', fontSize: '0.85rem' }}
                  >
                    <option value="">All MIS Statuses</option>
                    <option value="approved">Approved / Issued</option>
                    <option value="pending">Pending Verification</option>
                    <option value="declined">Declined / Rejected</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table View */}
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--line)' }}>
              <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>URN No.</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Date & Time</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Customer Name</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Contact Info</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Application ID</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Bank / Scheme</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>MIS Status</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Stage / Remarks</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'center' }}>Link / Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBankMisLeads.length > 0 ? (
                    paginatedBankMisLeads.map(lead => {
                      const st = String(lead.mis_status || 'Pending').toLowerCase();
                      const isApp = st.includes('approved') || st.includes('issued') || st.includes('success') || st.includes('sanctioned');
                      const isDec = st.includes('declined') || st.includes('rejected') || st.includes('dropped');
                      const badgeClass = isApp ? 'badge-success' : (isDec ? 'badge-warning' : 'badge-info');

                      return (
                        <tr key={lead.id} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className="badge badge-success" style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem' }}>
                              {lead.urn || 'N/A'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: '0.8rem' }}>
                            {lead.created_at ? new Date(lead.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                            {lead.full_name || 'N/A'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div>📱 {lead.phone || 'N/A'}</div>
                            {lead.email && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>✉️ {lead.email}</div>}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {lead.application_id ? (
                              <code style={{ background: 'rgba(224, 168, 46, 0.1)', color: 'var(--gold-deep)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                                {lead.application_id}
                              </code>
                            ) : (
                              <span style={{ color: 'var(--muted)' }}>N/A</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>
                            {lead.card_bank || lead.card_name || agent?.assigned_bank || 'Bank Partner'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className={`badge ${badgeClass}`} style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                              {lead.mis_status || 'Pending'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)', fontSize: '0.8rem' }}>
                            {lead.utm_params?.decline_description || lead.utm_params?.current_stage || lead.utm_params?.remark || 'No Remarks'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            {lead.redirect_url ? (
                              <CopyLinkButton url={lead.redirect_url} />
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>MIS Record</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted)' }}>
                        No Bank MIS records found for {agent?.assigned_bank || 'your bank'}. Click "Upload Bank MIS" to upload Excel/CSV MIS files!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            {totalBankMisPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--line)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  Showing {((bankMisCurrentPage - 1) * AGENT_PAGE_SIZE) + 1} - {Math.min(bankMisCurrentPage * AGENT_PAGE_SIZE, filteredBankMisLeads.length)} of {filteredBankMisLeads.length} bank records
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    disabled={bankMisCurrentPage <= 1} 
                    onClick={() => setBankMisCurrentPage(p => Math.max(p - 1, 1))} 
                    className="btn-secondary" 
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                  >
                    Previous
                  </button>
                  <span style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 600 }}>
                    Page {bankMisCurrentPage} of {totalBankMisPages}
                  </span>
                  <button 
                    disabled={bankMisCurrentPage >= totalBankMisPages} 
                    onClick={() => setBankMisCurrentPage(p => Math.min(p + 1, totalBankMisPages))} 
                    className="btn-secondary" 
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Field Sales Agent Mode */
        <>
          {/* Dashboard Top Header & Action Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Welcome, {agent?.name}</h1>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <User size={16} /> ID: Agent-{agent?.id || 'Active'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <MapPin size={16} /> Assigned Locations: {agent?.locations?.join(', ') || 'General'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'hsl(var(--secondary))', fontWeight: 600 }}>
                  <CheckCircle size={16} /> Working Today At: {agentLocation || 'General'}
                  {agent?.locations && agent.locations.length > 1 && (
                    <button 
                      onClick={() => setShowLocationModal(true)} 
                      style={{ background: 'none', border: 'none', color: 'hsl(var(--primary))', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8rem', marginLeft: '0.5rem', padding: 0 }}
                    >
                      Change
                    </button>
                  )}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {agent?.can_create_leads !== false && (
                <>
                  <button 
                    type="button"
                    onClick={() => setShowCreateLeadModal(true)} 
                    className="btn-secondary" 
                    style={{ padding: '0.55rem 1.1rem', fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    <UserPlus size={16} /> Create Single Lead
                  </button>

                  <button 
                    type="button"
                    onClick={() => setShowAgentUploadModal(true)} 
                    className="btn-primary" 
                    style={{ padding: '0.55rem 1.1rem', fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', borderRadius: '6px', background: 'var(--gold-deep)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(224, 168, 46, 0.25)' }}
                  >
                    <FileSpreadsheet size={16} /> Upload Leads (Excel / CSV)
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Agent Leads Repository Section */}
          <div className="glass-panel" style={{ width: '100%', boxSizing: 'border-box', padding: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h2 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700 }}>My Uploaded Leads Repository</h2>
                <span className="badge badge-success" style={{ fontSize: '0.8rem', padding: '0.25rem 0.65rem' }}>
                  {filteredAgentLeads.length} Total Leads
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {/* Search Input */}
                <div style={{ position: 'relative', minWidth: '280px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Search name, phone, URN, PAN, App ID..."
                    value={agentSearch}
                    onChange={(e) => { setAgentSearch(e.target.value); setAgentCurrentPage(1); }}
                    style={{ paddingLeft: '2.2rem', height: '38px', fontSize: '0.85rem' }}
                  />
                </div>

                {/* Card Filter */}
                <div style={{ minWidth: '180px' }}>
                  <select 
                    className="form-select"
                    value={agentCardFilter}
                    onChange={(e) => { setAgentCardFilter(e.target.value); setAgentCurrentPage(1); }}
                    style={{ height: '38px', fontSize: '0.85rem' }}
                  >
                    <option value="">All Credit Cards</option>
                    {cards.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Table View */}
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--line)' }}>
              <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>URN No.</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Date & Time</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Customer Name</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Contact Info</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>PAN No.</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Application ID</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Card Name</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>City / Location</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'center' }}>Link / Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAgentLeads.length > 0 ? (
                    paginatedAgentLeads.map(lead => (
                      <tr key={lead.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span className="badge badge-success" style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem' }}>
                            {lead.urn || 'N/A'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: '0.8rem' }}>
                          {lead.created_at ? new Date(lead.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                          {lead.full_name || 'N/A'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div>📱 {lead.phone || 'N/A'}</div>
                          {lead.email && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>✉️ {lead.email}</div>}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                          {lead.pan_no || 'N/A'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {lead.application_id ? (
                            <code style={{ background: 'rgba(224, 168, 46, 0.1)', color: 'var(--gold-deep)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                              {lead.application_id}
                            </code>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}>N/A</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>
                          {lead.card_name || 'General Card'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)' }}>
                          {lead.city || lead.location || 'Walk-in'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          {lead.redirect_url ? (
                            <CopyLinkButton url={lead.redirect_url} />
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Uploaded</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted)' }}>
                        No leads found in your repository. Click "Upload Leads (Excel / CSV)" to upload bulk leads directly!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            {totalAgentPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--line)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  Showing {((agentCurrentPage - 1) * AGENT_PAGE_SIZE) + 1} - {Math.min(agentCurrentPage * AGENT_PAGE_SIZE, filteredAgentLeads.length)} of {filteredAgentLeads.length} leads
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    disabled={agentCurrentPage <= 1} 
                    onClick={() => setAgentCurrentPage(p => Math.max(p - 1, 1))} 
                    className="btn-secondary" 
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                  >
                    Previous
                  </button>
                  <span style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 600 }}>
                    Page {agentCurrentPage} of {totalAgentPages}
                  </span>
                  <button 
                    disabled={agentCurrentPage >= totalAgentPages} 
                    onClick={() => setAgentCurrentPage(p => Math.min(p + 1, totalAgentPages))} 
                    className="btn-secondary" 
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Footer Controls */}
      <div style={{ 
        marginTop: '2rem', 
        paddingTop: '1.5rem', 
        borderTop: '1px solid var(--line)', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        paddingBottom: '2.5rem' 
      }}>
        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          width: '100%', 
          maxWidth: '360px' 
        }}>
          <button 
            className="theme-toggle-btn" 
            onClick={toggleTheme} 
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            style={{ 
              flex: 1,
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '0.5rem', 
              height: '42px', 
              borderRadius: 'var(--radius-sm)', 
              border: '1.5px solid var(--line)', 
              background: 'var(--paper)', 
              color: 'var(--ink)', 
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              padding: 0
            }}
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>
          
          <button 
            onClick={handleLogout} 
            className="btn-secondary" 
            style={{ 
              flex: 1,
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '0.5rem', 
              height: '42px', 
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(209, 67, 67, 0.08)', 
              color: 'var(--err)', 
              borderColor: 'rgba(209, 67, 67, 0.18)', 
              cursor: 'pointer', 
              fontSize: '0.85rem',
              fontWeight: 600,
              padding: 0
            }}
          >
            <LogOut size={14} /> <span>Exit Portal</span>
          </button>
        </div>
      </div>

      {/* Agent Excel Upload Modal */}
      {showAgentUploadModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '540px', borderRadius: '16px', background: 'var(--paper)', border: '1px solid var(--line)', padding: '1.75rem', borderTop: '4px solid var(--gold-deep)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <FileSpreadsheet size={22} style={{ color: 'var(--gold-deep)' }} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Upload Leads (Excel / CSV)</h3>
              </div>
              <button onClick={() => setShowAgentUploadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={20} /></button>
            </div>

            <div style={{ background: 'rgba(224, 168, 46, 0.08)', border: '1px solid rgba(224, 168, 46, 0.25)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--gold-deep)' }}>Need a formatted template?</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Includes all headers & sample rows</div>
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

            <form onSubmit={handleUploadAgentLeads}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Select Excel (.xlsx, .xls) or CSV File</label>
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={(e) => setAgentUploadFile(e.target.files[0])} 
                  className="form-input" 
                  required 
                />
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.5rem', marginBottom: '1.25rem', background: 'var(--paper-2)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--line)' }}>
                ℹ️ All valid lead rows will be automatically assigned to your Agent ID (<code>Agent-{agent?.id}</code>). Mandatory fields: Full Name, Phone, Email.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowAgentUploadModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={isUploadingAgentLeads} style={{ background: 'var(--gold-deep)', color: '#fff' }}>
                  {isUploadingAgentLeads ? 'Processing Upload...' : 'Upload & Validate Leads'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Agent Upload Results Modal */}
      {showAgentUploadResultModal && agentUploadResult && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '580px', maxHeight: '85vh', overflowY: 'auto', borderRadius: '16px', background: 'var(--paper)', border: '1px solid var(--line)', padding: '1.75rem', borderTop: '4px solid var(--gold-deep)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Bulk Lead Upload Results</h3>
              <button onClick={() => setShowAgentUploadResultModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'var(--paper-2)', padding: '0.85rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--line)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Total Rows</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{agentUploadResult.total}</div>
              </div>
              <div style={{ background: 'rgba(56, 142, 60, 0.1)', padding: '0.85rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(56, 142, 60, 0.25)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Created</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)' }}>{agentUploadResult.created}</div>
              </div>
              <div style={{ background: 'rgba(209, 67, 67, 0.1)', padding: '0.85rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(209, 67, 67, 0.25)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--err)' }}>Rejected</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--err)' }}>{agentUploadResult.failed}</div>
              </div>
            </div>

            {agentUploadResult.errors && agentUploadResult.errors.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--err)' }}>Validation Error Log ({agentUploadResult.errors.length}):</h4>
                <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', padding: '0.75rem', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto', fontSize: '0.78rem', color: 'var(--ink)' }}>
                  {agentUploadResult.errors.map((err, idx) => (
                    <div key={idx} style={{ marginBottom: '0.35rem' }}>• {err}</div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAgentUploadResultModal(false)} className="btn-primary" style={{ background: 'var(--gold-deep)', color: '#fff' }}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Bank MIS Upload Modal */}
      {showBankMisUploadModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '580px', borderRadius: '16px', background: 'var(--paper)', border: '1px solid var(--line)', padding: '1.75rem', borderTop: '4px solid var(--gold-deep)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet size={22} style={{ color: 'var(--gold-deep)' }} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Upload Bank MIS (Excel / CSV)</h3>
              </div>
              <button onClick={() => setShowBankMisUploadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleUploadBankMis}>
              <div style={{ marginBottom: '1.25rem', background: 'var(--paper-2)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Target Bank Partner</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--gold-deep)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  🏦 {getMatchingBankValue(agent?.assigned_bank) || agent?.assigned_bank || 'HDFC Bank'}
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.85rem' }}>Bank MIS File (.xlsx, .csv) *</label>
                
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={(e) => setBankMisUploadFile(e.target.files[0])}
                  className="form-input"
                  style={{ padding: '0.5rem', height: 'auto', background: 'var(--paper-2)' }}
                  required
                />
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.5rem', marginBottom: '1.25rem', background: 'var(--paper-2)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--line)' }}>
                ℹ️ Bank MIS upload maps URN / Application ID and updates final decision status (`Approved`, `Pending`, `Declined`) directly across the repository.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowBankMisUploadModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={isUploadingBankMis} style={{ background: 'var(--gold-deep)', color: '#fff' }}>
                  {isUploadingBankMis ? 'Processing Upload...' : 'Upload & Process MIS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bank MIS Upload Results Modal */}
      {showBankMisResultModal && bankMisUploadResult && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '580px', maxHeight: '85vh', overflowY: 'auto', borderRadius: '16px', background: 'var(--paper)', border: '1px solid var(--line)', padding: '1.75rem', borderTop: '4px solid var(--gold-deep)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Bank MIS Upload Results</h3>
              <button onClick={() => setShowBankMisResultModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'var(--paper-2)', padding: '0.85rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--line)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Total Processed</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{bankMisUploadResult.processed || bankMisUploadResult.total || 0}</div>
              </div>
              <div style={{ background: 'rgba(56, 142, 60, 0.1)', padding: '0.85rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(56, 142, 60, 0.25)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Mapped Leads</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)' }}>{bankMisUploadResult.updated || bankMisUploadResult.mapped || 0}</div>
              </div>
              <div style={{ background: 'rgba(209, 67, 67, 0.1)', padding: '0.85rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(209, 67, 67, 0.25)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--err)' }}>Unmatched</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--err)' }}>{bankMisUploadResult.unmatched || bankMisUploadResult.failed || 0}</div>
              </div>
            </div>

            {bankMisUploadResult.unmatchedList && bankMisUploadResult.unmatchedList.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--warning)' }}>Unmatched URN / Application IDs ({bankMisUploadResult.unmatchedList.length}):</h4>
                <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', padding: '0.75rem', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto', fontSize: '0.78rem', color: 'var(--ink)' }}>
                  {bankMisUploadResult.unmatchedList.map((item, idx) => (
                    <div key={idx} style={{ marginBottom: '0.35rem' }}>• {typeof item === 'string' ? item : (item.urn || item.appId || JSON.stringify(item))}</div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowBankMisResultModal(false)} className="btn-primary" style={{ background: 'var(--gold-deep)', color: '#fff' }}>Done</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
