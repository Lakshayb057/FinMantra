import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { LogIn, User, MapPin, CheckCircle, BarChart3, Plus, LogOut, Sun, Moon, Copy, Briefcase, Home, Calendar, Phone, ArrowRight, RefreshCw, Mail, ChevronDown, FileSpreadsheet, Download, X, FileText, CheckCircle2, UserPlus, Search, Filter, PieChart, TrendingUp, Layers, Activity, XCircle, Clock, UserCheck, Smartphone, CreditCard, HelpCircle, ShieldCheck, DollarSign, Award, Info, Eye } from 'lucide-react';
import { INDIA_STATES_SVG, aggregateLeadsByState, getHeatColor, pincodeToState } from '../utils/indiaMap.js';
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

  // Bank MIS Agent States & Upload Modals
  const [showBankMisUploadModal, setShowBankMisUploadModal] = useState(false);
  const [bankMisUploadFile, setBankMisUploadFile] = useState(null);
  const [bankMisUploadBank, setBankMisUploadBank] = useState('');
  const [isUploadingBankMis, setIsUploadingBankMis] = useState(false);
  const [bankMisUploadResult, setBankMisUploadResult] = useState(null);
  const [showBankMisResultModal, setShowBankMisResultModal] = useState(false);
  const [bankMisSearch, setBankMisSearch] = useState('');
  const [bankMisStatusFilter, setBankMisStatusFilter] = useState('');
  const [bankMisCurrentPage, setBankMisCurrentPage] = useState(1);

  // Bank MIS Leads Mapping & Analytics Dashboard States
  const [misStats, setMisStats] = useState(null);
  const [loadingMISStats, setLoadingMISStats] = useState(false);

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
  const [dashSearch, setDashSearch] = useState('');
  const [dashFiltersExpanded, setDashFiltersExpanded] = useState(false);
  const [dashPage, setDashPage] = useState(1);
  const DASH_PAGE_SIZE = 50;

  const isBankMisAgent = agent?.can_upload_mis || agent?.agent_mode === 'bank_mis_agent';

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
    if (isBankMisAgent && isAuthenticated && token) {
      fetchMISStats();
    }
  }, [isBankMisAgent, isAuthenticated, token]);

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
        const assignedClean = String(agent.assigned_bank).toLowerCase().replace(/\s+bank$/i, '').trim();
        const leadBank = String(l.card_bank || l.bank || (l.mis_data && l.mis_data.mis_bank_name) || '').toLowerCase().trim();
        const leadCard = String(l.card_name || '').toLowerCase().trim();
        const isMatch = (assignedClean && (leadBank.includes(assignedClean) || leadCard.includes(assignedClean))) || l.agent_id === agent.id;
        if (!isMatch) {
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

  // Leads Analytics Memoized Computations for Bank MIS Agent
  const allMappedLeads = useMemo(() => {
    if (misStats?.mappedLeadsList && misStats.mappedLeadsList.length > 0) {
      return misStats.mappedLeadsList;
    }
    return (agentLeads || []).filter(l => l.mis_data || l.mis_status);
  }, [misStats, agentLeads]);

  const filterOptions = useMemo(() => {
    const opts = {};
    const agentSet = new Set();
    const fieldSets = {
      card_type: new Set(), state: new Set(), kyc_status: new Set(),
      ipa_status: new Set(), final_decision: new Set(), card_name: new Set(),
      customer_type: new Set(), current_stage: new Set(), card_activation_status: new Set(),
      vkyc_status: new Set(), source_type: new Set()
    };
    for (let i = 0; i < allMappedLeads.length; i++) {
      const l = allMappedLeads[i];
      if (l.agent_name) agentSet.add(l.agent_name);
      const md = l.mis_data;
      if (md) {
        for (const field in fieldSets) {
          const v = md[field];
          if (v && String(v).trim()) fieldSets[field].add(v);
        }
      }
    }
    for (const field in fieldSets) {
      opts[field] = Array.from(fieldSets[field]).sort();
    }
    opts.agents = Array.from(agentSet).sort();
    return opts;
  }, [allMappedLeads]);

  const filteredMappedLeads = useMemo(() => {
    const searchLower = dashSearch ? dashSearch.toLowerCase().trim() : '';
    const normAssignedBank = agent?.assigned_bank ? String(agent.assigned_bank).toLowerCase().replace(/\s+bank$/i, '').trim() : '';

    return allMappedLeads.filter(lead => {
      // Bank lock filter
      if (normAssignedBank) {
        const misBank = String(lead.mis_data?.mis_bank_name || '').toLowerCase();
        const cardBank = String(lead.card_bank || lead.bank || '').toLowerCase();
        const cardName = String(lead.card_name || '').toLowerCase();
        const kiwiBank = String(lead.mis_data?.kiwi_bank || lead.mis_data?.kiwi_winning_bank || lead.mis_data?.winning_bank || '').toLowerCase();

        let isMatch = false;
        if (normAssignedBank === 'kiwi') {
          isMatch = misBank.includes('kiwi') || cardName.includes('kiwi') || cardBank.includes('kiwi') || Boolean(kiwiBank);
        } else {
          isMatch = misBank.includes(normAssignedBank) || cardBank.includes(normAssignedBank) || cardName.includes(normAssignedBank);
        }
        if (!isMatch && lead.agent_id !== agent?.id) return false;
      }

      if (searchLower) {
        const urn = (lead.urn || '').toLowerCase();
        const name = (lead.full_name || '').toLowerCase();
        const ref = (lead.mis_data?.APPLICATION_REFERENCE_NUMBER || lead.mis_data?.bank_reference_number || '').toLowerCase();
        const phone = (lead.phone || '').toLowerCase();
        const pan = (lead.pan_no || '').toLowerCase();
        if (!urn.includes(searchLower) && !name.includes(searchLower) && !ref.includes(searchLower) && !phone.includes(searchLower) && !pan.includes(searchLower)) {
          return false;
        }
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

      return true;
    });
  }, [allMappedLeads, dashSearch, dashCreatedDate, dashDateTo, dashCardType, dashState, dashKycStatus, dashIpaStatus, dashFinalDecision, dashCardName, dashCustomerType, dashCurrentStage, dashCardActivation, dashVkycStatus, dashAgent, dashSourceType, agent]);

  const dashStats = useMemo(() => {
    let approvedCount = 0, rejectedCount = 0, pendingCount = 0;
    let funnelIpa = 0, funnelKyc = 0, funnelDecision = 0, funnelActive = 0;
    let ipaApproved = 0, ipaDeclined = 0;
    const kycDist = {}, srcDist = {}, cardTypeDist = {}, custTypeDist = {};
    const actDist = {}, pinDist = {}, prodDist = {};

    for (let i = 0; i < filteredMappedLeads.length; i++) {
      const l = filteredMappedLeads[i];
      const md = l.mis_data || {};

      if (l.mis_status === 'Approved') approvedCount++;
      else if (l.mis_status === 'Rejected') rejectedCount++;
      else pendingCount++;

      const ipaLower = String(md.ipa_status || '').toLowerCase();
      if (ipaLower.includes('approve') || ipaLower.includes('success')) { funnelIpa++; ipaApproved++; }
      if (ipaLower.includes('decline') || ipaLower.includes('reject') || ipaLower.includes('cancel')) ipaDeclined++;

      const ksLower = String(md.kyc_status || '').toLowerCase();
      const vsLower = String(md.vkyc_status || '').toLowerCase();
      const ktLower = String(md.kyc_type || '').toLowerCase();
      if (ksLower.includes('success') || ksLower.includes('complete') || vsLower.includes('success') || vsLower.includes('complete') || ksLower.includes('biokyc') || ktLower.includes('biokyc')) funnelKyc++;

      const decLower = String(md.final_decision || '').toLowerCase();
      if (decLower.includes('approve') || decLower.includes('success')) funnelDecision++;

      const actLower = String(md.card_activation_status || '').toLowerCase();
      if (actLower.includes('active') || actLower === 'yes') funnelActive++;

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
      ipaApproved, ipaDeclined,
      kycDist, srcDist, cardTypeDist, custTypeDist, actDist, prodDist, topPincodes
    };
  }, [filteredMappedLeads]);

  const dashGeoData = useMemo(() => {
    const stateLeadCounts = aggregateLeadsByState(filteredMappedLeads);
    const maxStateLeads = Math.max(1, ...Object.values(stateLeadCounts));
    const topStates = Object.entries(stateLeadCounts)
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
    return { stateLeadCounts, maxStateLeads, topStates };
  }, [filteredMappedLeads]);

  const paginatedMappedLeads = useMemo(() => {
    const start = (dashPage - 1) * DASH_PAGE_SIZE;
    return filteredMappedLeads.slice(start, start + DASH_PAGE_SIZE);
  }, [filteredMappedLeads, dashPage]);

  const totalMappedPages = useMemo(() => Math.max(1, Math.ceil(filteredMappedLeads.length / DASH_PAGE_SIZE)), [filteredMappedLeads.length]);

  const activeFilterCount = useMemo(() => {
    return [dashCreatedDate, dashDateTo, dashCardType, dashState, dashKycStatus, dashIpaStatus, dashFinalDecision, dashCardName, dashCustomerType, dashCurrentStage, dashCardActivation, dashVkycStatus, dashAgent, dashSourceType, dashSearch].filter(Boolean).length;
  }, [dashCreatedDate, dashDateTo, dashCardType, dashState, dashKycStatus, dashIpaStatus, dashFinalDecision, dashCardName, dashCustomerType, dashCurrentStage, dashCardActivation, dashVkycStatus, dashAgent, dashSourceType, dashSearch]);

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
      if (isBankMisAgent) {
        fetchMISStats();
      }
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

  const fetchPincodeDetails = async (pin) => {
    if (!pin || pin.length !== 6) return;
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      if (data && data[0] && data[0].Status === 'Success') {
        const postOffices = data[0].PostOffice || [];
        if (postOffices.length > 0) {
          const po = postOffices[0];
          setLeadForm(prev => ({
            ...prev,
            address_city: po.District || po.Division || prev.address_city,
            address_state: po.State || prev.address_state,
            address_locality: po.Name || prev.address_locality
          }));
        }
      }
    } catch(e) {}
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
        top: '0.75rem', 
        zIndex: 1000, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '0.85rem 1.75rem', 
        minHeight: '68px',
        marginBottom: '1.25rem',
        backdropFilter: 'blur(16px)',
        background: 'var(--glass-bg)',
        border: '1px solid var(--line)',
        borderRadius: '14px',
        boxShadow: '0 8px 32px 0 rgba(17, 19, 43, 0.08)'
      }}>
        {/* Brand/Logo */}
        <div className="admin-nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src="/logo.jpg" alt="FinMantra Logo" style={{ height: '42px', width: '42px', borderRadius: '10px', objectFit: 'cover', boxShadow: '0 4px 14px rgba(224, 168, 46, 0.3)' }} />
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.03em', color: 'var(--ink)' }}>
            FinMantra <span style={{ color: 'var(--gold-deep)', fontWeight: 600, fontSize: '0.9rem' }}>Agent Terminal</span>
          </span>
        </div>

        {/* User Badge & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--paper-2)', padding: '0.45rem 0.9rem', borderRadius: '20px', border: '1px solid var(--line)', fontSize: '0.82rem', fontWeight: 600 }}>
            <User size={15} style={{ color: 'var(--gold-deep)' }} />
            <span>{agent?.name || 'Agent'}</span>
          </div>
          {agent?.assigned_bank && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(224, 168, 46, 0.12)', color: 'var(--gold-deep)', padding: '0.45rem 0.9rem', borderRadius: '20px', border: '1px solid rgba(224, 168, 46, 0.3)', fontSize: '0.82rem', fontWeight: 700 }}>
              🏦 <span>{agent.assigned_bank}</span>
            </div>
          )}
          <button 
            onClick={handleLogout}
            className="btn-secondary" 
            style={{ padding: '0.45rem 0.95rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px', color: 'var(--err)', borderColor: 'rgba(209, 67, 67, 0.25)', fontWeight: 600 }}
          >
            <LogOut size={15} /> Logout
          </button>
        </div>
      </div>

      {/* Dedicated View for Bank MIS Agents vs Field Sales Agents */}
      {isBankMisAgent ? (
        <>
          {/* Bank MIS Hero Banner Header */}
          <div className="glass-panel" style={{ 
            padding: '1.5rem 1.75rem', 
            borderRadius: '16px', 
            marginBottom: '1.5rem', 
            background: 'linear-gradient(135deg, rgba(224, 168, 46, 0.07) 0%, rgba(255, 255, 255, 0.95) 100%)', 
            border: '1px solid rgba(224, 168, 46, 0.22)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
            flexWrap: 'wrap',
            gap: '1.25rem'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                <h1 style={{ fontSize: '1.8rem', margin: 0, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                  Welcome back, {agent?.name}
                </h1>
                <span className="badge badge-warning" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '20px', fontWeight: 700 }}>
                  Bank MIS Manager
                </span>
              </div>
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', color: 'hsl(var(--text-secondary))', fontSize: '0.85rem', marginTop: '0.5rem', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'var(--paper-2)', padding: '0.25rem 0.65rem', borderRadius: '6px', border: '1px solid var(--line)', fontWeight: 600 }}>
                  <User size={14} style={{ color: 'var(--gold-deep)' }} /> ID: Agent-{agent?.id || 'Active'}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(224, 168, 46, 0.12)', color: 'var(--gold-deep)', padding: '0.25rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(224, 168, 46, 0.3)', fontWeight: 700 }}>
                  🏦 Mapped Bank: {agent?.assigned_bank || 'HDFC Bank'} (Assigned & Locked)
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--mint)', padding: '0.25rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.25)', fontWeight: 600 }}>
                  <CheckCircle size={14} /> Kiosk Location: {agentLocation || 'Main Kiosk'}
                </span>
              </div>
            </div>

            <div>
              <button 
                type="button"
                onClick={() => {
                  setBankMisUploadBank(getMatchingBankValue(agent?.assigned_bank));
                  setShowBankMisUploadModal(true);
                }} 
                className="btn-primary" 
                style={{ 
                  padding: '0.75rem 1.4rem', 
                  fontSize: '0.92rem', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.6rem', 
                  borderRadius: '10px', 
                  background: 'linear-gradient(135deg, #E0A82E 0%, #C68A12 100%)', 
                  color: '#fff', 
                  border: 'none', 
                  fontWeight: 700, 
                  cursor: 'pointer', 
                  boxShadow: '0 6px 18px rgba(224, 168, 46, 0.35)',
                  transition: 'all 0.2s ease'
                }}
              >
                <FileSpreadsheet size={19} /> Upload Bank MIS (Excel / CSV)
              </button>
            </div>
          </div>

          {/* LEADS MAPPING & ANALYTICS DASHBOARD FOR BANK MIS AGENT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', textAlign: 'left', marginBottom: '2.5rem' }}>
            
            {/* Filters Panel */}
            <div className="glass-panel" style={{ padding: '1.35rem 1.6rem', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <Filter size={16} style={{ color: 'var(--gold)' }} />
                  <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--ink)' }}>Leads Analytics Filters ({agent?.assigned_bank || 'Assigned Bank'} Scoped)</span>
                  {activeFilterCount > 0 && (
                    <span style={{
                      background: 'var(--gold-deep)', color: '#fff', fontSize: '0.7rem', fontWeight: 800,
                      padding: '0.15rem 0.55rem', borderRadius: '12px', minWidth: '22px', textAlign: 'center'
                    }}>{activeFilterCount}</span>
                  )}

                  {/* Locked Bank Badge */}
                  <div style={{ display: 'inline-flex', gap: '0.3rem', padding: '4px 0.85rem', background: 'rgba(224, 168, 46, 0.12)', borderRadius: '20px', border: '1px solid rgba(224, 168, 46, 0.3)', color: 'var(--gold-deep)', fontWeight: 700, fontSize: '0.8rem', alignItems: 'center' }}>
                    🏦 Partner: {agent?.assigned_bank || 'HDFC Bank'} (Locked)
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button onClick={() => setDashFiltersExpanded(!dashFiltersExpanded)} className="btn-secondary"
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: '8px', fontWeight: 600 }}>
                    {dashFiltersExpanded ? 'Less Filters' : 'More Filters'}
                    <span style={{ fontSize: '0.65rem', transform: dashFiltersExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                  </button>
                  <button
                    onClick={() => {
                      setDashCreatedDate(''); setDashDateTo(''); setDashCardType(''); setDashState('');
                      setDashKycStatus(''); setDashIpaStatus(''); setDashFinalDecision(''); setDashCardName('');
                      setDashCustomerType(''); setDashCurrentStage(''); setDashCardActivation('');
                      setDashVkycStatus(''); setDashAgent(''); setDashSourceType(''); setDashSearch('');
                    }}
                    className="btn-secondary"
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', opacity: activeFilterCount > 0 ? 1 : 0.5, borderRadius: '8px', fontWeight: 600 }}
                    disabled={activeFilterCount === 0}
                  >Reset All</button>
                </div>
              </div>

              {/* Search bar */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                  <input
                    type="text" className="form-input"
                    placeholder="Search by URN, Customer Name, Phone, App ID or PAN..."
                    value={dashSearch}
                    onChange={(e) => setDashSearch(e.target.value)}
                    style={{ paddingLeft: '2.25rem', padding: '0.5rem 0.75rem 0.5rem 2.25rem', fontSize: '0.85rem', width: '100%', borderRadius: '8px' }}
                  />
                </div>
              </div>

              {/* Filter controls */}
              {(() => {
                const fls = { padding: '0.45rem 0.65rem', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid var(--line)' };
                const fll = { fontSize: '0.75rem', marginBottom: '4px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.3px' };
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.85rem', alignItems: 'end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={fll}>Date From (MIS)</label>
                        <input type="date" className="form-input" style={fls} value={dashCreatedDate} onChange={(e) => setDashCreatedDate(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={fll}>Date To (MIS)</label>
                        <input type="date" className="form-input" style={fls} value={dashDateTo} onChange={(e) => setDashDateTo(e.target.value)} />
                      </div>
                      <FS label="Card Type" value={dashCardType} onChange={setDashCardType} options={filterOptions.card_type || []} placeholder="All Card Types" />
                      <FS label="State" value={dashState} onChange={setDashState} options={filterOptions.state || []} placeholder="All States" />
                      <FS label="IPA Status" value={dashIpaStatus} onChange={setDashIpaStatus} options={filterOptions.ipa_status || []} placeholder="All IPA" />
                      <FS label="Final Decision" value={dashFinalDecision} onChange={setDashFinalDecision} options={filterOptions.final_decision || []} placeholder="All Decisions" />
                    </div>

                    {dashFiltersExpanded && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.85rem', alignItems: 'end', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--line)' }}>
                        <FS label="Card Name" value={dashCardName} onChange={setDashCardName} options={filterOptions.card_name || []} placeholder="All Cards" />
                        <FS label="KYC Status" value={dashKycStatus} onChange={setDashKycStatus} options={filterOptions.kyc_status || []} placeholder="All KYC" />
                        <FS label="Customer Type" value={dashCustomerType} onChange={setDashCustomerType} options={filterOptions.customer_type || []} placeholder="All Customers" />
                        <FS label="Current Stage" value={dashCurrentStage} onChange={setDashCurrentStage} options={filterOptions.current_stage || []} placeholder="All Stages" />
                        <FS label="Card Activation" value={dashCardActivation} onChange={setDashCardActivation} options={filterOptions.card_activation_status || []} placeholder="All Status" />
                        <FS label="VKYC Status" value={dashVkycStatus} onChange={setDashVkycStatus} options={filterOptions.vkyc_status || []} placeholder="All VKYC" />
                        <FS label="Source Type" value={dashSourceType} onChange={setDashSourceType} options={filterOptions.source_type || []} placeholder="All Sources" />
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* KPI SUMMARY CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.25rem' }}>
              <div className="glass-panel" style={{ padding: '1.35rem', borderLeft: '5px solid var(--gold)', borderRadius: '14px' }}>
                <div style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', fontWeight: 700 }}>Total Mapped Applications</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0.3rem 0', color: 'var(--ink)' }}>{dashStats.totalSubmit}</div>
                <div style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>Matched for {agent?.assigned_bank || 'HDFC Bank'}</div>
              </div>
              <div className="glass-panel" style={{ padding: '1.35rem', borderLeft: '5px solid var(--mint)', borderRadius: '14px' }}>
                <div style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', fontWeight: 700 }}>Approved Rate</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0.3rem 0', color: 'var(--mint)' }}>{dashStats.approvalRate}%</div>
                <div style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>{dashStats.approvedCount} of {dashStats.totalSubmit} approved</div>
              </div>
              <div className="glass-panel" style={{ padding: '1.35rem', borderLeft: '5px solid var(--err)', borderRadius: '14px' }}>
                <div style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', fontWeight: 700 }}>Rejected Applications</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0.3rem 0', color: 'var(--err)' }}>{dashStats.rejectedCount}</div>
                <div style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>Declined by partner bank</div>
              </div>
              <div className="glass-panel" style={{ padding: '1.35rem', borderLeft: '5px solid #E0A82E', borderRadius: '14px' }}>
                <div style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', fontWeight: 700 }}>Pending Verification</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0.3rem 0', color: 'var(--gold-deep)' }}>{dashStats.pendingCount}</div>
                <div style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>In verification stage</div>
              </div>
            </div>

            {/* 9 VISUAL ANALYTICS CHARTS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              
              {/* Visual 1: Funnel Chart */}
              <div className="glass-panel" style={{ padding: '1.75rem', gridColumn: 'span 2', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: '16px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1.5rem', width: '100%', textAlign: 'left', color: 'var(--ink)' }}>Conversion Funnel Stages (%) - {agent?.assigned_bank || 'HDFC Bank'}</h4>
                <div style={{ width: '100%', maxWidth: '600px', display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
                  <svg width="100%" viewBox="0 0 600 300" style={{ display: 'block', overflow: 'visible' }}>
                    {(() => {
                      const stages = [
                        { name: 'Total Application Submit', count: dashStats.totalSubmit, pct: 100, color: 'var(--ink)' },
                        { name: 'IPA Approved', count: dashStats.funnelIpa, pct: dashStats.totalSubmit > 0 ? Math.round((dashStats.funnelIpa / dashStats.totalSubmit) * 100) : 0, color: 'hsl(var(--primary))' },
                        { name: 'KYC Success', count: dashStats.funnelKyc, pct: dashStats.totalSubmit > 0 ? Math.round((dashStats.funnelKyc / dashStats.totalSubmit) * 100) : 0, color: 'var(--gold-deep)' },
                        { name: 'Final Decision (Approve)', count: dashStats.funnelDecision, pct: dashStats.totalSubmit > 0 ? Math.round((dashStats.funnelDecision / dashStats.totalSubmit) * 100) : 0, color: 'var(--mint)' },
                        { name: 'Card Activation Status (ACTIVE)', count: dashStats.funnelActive, pct: dashStats.totalSubmit > 0 ? Math.round((dashStats.funnelActive / dashStats.totalSubmit) * 100) : 0, color: '#10b981' }
                      ];

                      return stages.map((stage, idx) => {
                        const yStart = idx * 60;
                        const yEnd = (idx + 1) * 60;
                        const yCenter = yStart + 30;

                        const pctTop = stage.pct;
                        const pctBottom = (idx < 4) ? stages[idx + 1].pct : Math.max(15, stage.pct * 0.7);

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
                            <path 
                              d={pathD} 
                              fill={stage.color} 
                              stroke="var(--paper)" 
                              strokeWidth="1.5" 
                              style={{ transition: 'all 0.5s ease-in-out' }}
                            />
                            <text 
                              x={xCenter} 
                              y={yCenter + 4} 
                              fontSize="11" 
                              fontWeight="bold" 
                              fill="#ffffff" 
                              textAnchor="middle"
                            >
                              {stage.pct}%
                            </text>
                            <text x="20" y={yCenter - 4} fontSize="11" fontWeight="700" fill="var(--ink)">
                              {stage.name}
                            </text>
                            <text x="20" y={yCenter + 12} fontSize="10.5" fontWeight="600" fill="hsl(var(--text-muted))">
                              {stage.count} Leads | {stage.pct}%
                            </text>
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
              <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', borderRadius: '16px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--ink)' }}>IPA Decision Breakdown</h4>
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
                  <svg width="130" height="130" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--line)" strokeWidth="4.2" />
                    {dashStats.totalSubmit > 0 && (() => {
                      const ipaAppPct = (dashStats.ipaApproved / dashStats.totalSubmit) * 100;
                      const ipaDecPct = (dashStats.ipaDeclined / dashStats.totalSubmit) * 100;
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.82rem', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                      <span style={{ height: '10px', width: '10px', borderRadius: '50%', background: 'var(--mint)' }} />
                      <span>Approved: {dashStats.ipaApproved}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                      <span style={{ height: '10px', width: '10px', borderRadius: '50%', background: 'var(--err)' }} />
                      <span>Declined: {dashStats.ipaDeclined}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                      <span style={{ height: '10px', width: '10px', borderRadius: '50%', background: 'var(--line)' }} />
                      <span>Pending: {dashStats.totalSubmit - dashStats.ipaApproved - dashStats.ipaDeclined}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual 3: Bar Chart - KYC Status */}
              <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '16px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--ink)' }}>KYC Status Distribution</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {Object.entries(dashStats.kycDist || {}).map(([name, val], idx) => {
                    const pct = dashStats.totalSubmit > 0 ? (val / dashStats.totalSubmit) * 100 : 0;
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem' }}>
                        <div style={{ width: '85px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 600 }}>{name}</div>
                        <div style={{ flex: 1, height: '16px', background: 'var(--paper-2)', borderRadius: '6px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)' }} />
                        </div>
                        <div style={{ width: '45px', fontWeight: 800 }}>{val}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Visual 4: Customer Type */}
              <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', borderRadius: '16px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--ink)' }}>Customer Type (NTB / ETB)</h4>
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.82rem', textAlign: 'left', width: '100%' }}>
                    {Object.entries(dashStats.custTypeDist || {}).map(([name, val], idx) => {
                      const colors = ['#16A37B', '#D14343', '#E0A82E', '#11132B'];
                      const color = colors[idx % colors.length];
                      const pct = dashStats.totalSubmit > 0 ? ((val / dashStats.totalSubmit) * 100).toFixed(1) : 0;
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                            <span style={{ height: '10px', width: '10px', borderRadius: '50%', background: color }} />
                            <span>{name}</span>
                          </div>
                          <span style={{ fontWeight: 800 }}>{val} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Visual 5: Card Activation Status */}
              <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '16px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--ink)' }}>Card Activation Status</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {Object.entries(dashStats.actDist || {}).map(([name, val], idx) => {
                    const pct = dashStats.totalSubmit > 0 ? (val / dashStats.totalSubmit) * 100 : 0;
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem' }}>
                        <div style={{ width: '105px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 600 }}>{name}</div>
                        <div style={{ flex: 1, height: '16px', background: 'var(--paper-2)', borderRadius: '6px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--mint)' }} />
                        </div>
                        <div style={{ width: '45px', fontWeight: 800 }}>{val}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Visual 6: Geographic Heatmap India */}
              <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gridColumn: 'span 2', borderRadius: '16px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.35rem', color: 'var(--ink)' }}>Geographic Heatmap — India ({agent?.assigned_bank || 'HDFC Bank'})</h4>
                <p style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', marginBottom: '1.5rem' }}>State-wise application volume mapped from pincodes and MIS state entries.</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '2rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'var(--paper-2)', borderRadius: '16px', padding: '1.25rem', minHeight: '400px', border: '1px solid var(--line)' }}>
                    <svg width="100%" height="100%" viewBox="40 0 460 430" style={{ display: 'block', overflow: 'visible', maxHeight: '380px' }} preserveAspectRatio="xMidYMid meet">
                      {Object.entries(INDIA_STATES_SVG).map(([stateName, stateData]) => {
                        const count = dashGeoData.stateLeadCounts[stateName] || 0;
                        const fillColor = getHeatColor(count, dashGeoData.maxStateLeads);
                        return (
                          <path
                            key={stateName}
                            d={stateData.path}
                            fill={fillColor}
                            stroke="var(--line)"
                            strokeWidth="0.8"
                          />
                        );
                      })}
                    </svg>
                  </div>

                  <div>
                    <h5 style={{ fontSize: '0.88rem', fontWeight: 800, marginBottom: '0.85rem', color: 'var(--ink)' }}>Top Active States</h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '360px', overflowY: 'auto' }}>
                      {dashGeoData.topStates.map((st, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0.75rem', background: 'var(--paper-2)', borderRadius: '8px', fontSize: '0.82rem', border: '1px solid var(--line)' }}>
                          <span style={{ fontWeight: 600 }}>{st.state}</span>
                          <span style={{ fontWeight: 800, color: 'var(--gold-deep)' }}>{st.count} Leads</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MY BANK MIS & LEADS REPOSITORY TABLE */}
            <div className="glass-panel" style={{ width: '100%', boxSizing: 'border-box', padding: '1.75rem', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.35rem', paddingBottom: '1.1rem', borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <h2 style={{ fontSize: '1.4rem', margin: 0, fontWeight: 800, color: 'var(--ink)' }}>My Bank MIS & Mapped Leads Repository</h2>
                  <span className="badge badge-success" style={{ fontSize: '0.82rem', padding: '0.3rem 0.75rem', borderRadius: '20px', fontWeight: 800 }}>
                    {filteredMappedLeads.length} Bank Records
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', minWidth: '300px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Search name, phone, URN, PAN, App ID..."
                      value={dashSearch}
                      onChange={(e) => { setDashSearch(e.target.value); setDashPage(1); }}
                      style={{ paddingLeft: '2.35rem', height: '40px', fontSize: '0.85rem', borderRadius: '8px' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--line)' }}>
                <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>URN No.</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Date & Time</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Customer Name</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Contact Info</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Application ID</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Bank / Scheme</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>MIS Status</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>Stage / Remarks</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--ink)', textAlign: 'center' }}>Link / Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMappedLeads.length > 0 ? (
                      paginatedMappedLeads.map(lead => {
                        const st = String(lead.mis_status || 'Pending').toLowerCase();
                        const isApp = st.includes('approved') || st.includes('issued') || st.includes('success') || st.includes('sanctioned');
                        const isDec = st.includes('declined') || st.includes('rejected') || st.includes('dropped');
                        const badgeClass = isApp ? 'badge-success' : (isDec ? 'badge-warning' : 'badge-info');

                        return (
                          <tr key={lead.id} style={{ borderBottom: '1px solid var(--line)' }}>
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <span className="badge badge-success" style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.78rem', background: 'rgba(224, 168, 46, 0.15)', color: 'var(--gold-deep)', border: '1px solid rgba(224, 168, 46, 0.3)', padding: '0.25rem 0.5rem', borderRadius: '6px' }}>
                                {lead.urn || 'N/A'}
                              </span>
                            </td>
                            <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: '0.82rem' }}>
                              {lead.created_at ? new Date(lead.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--ink)' }}>
                              {lead.full_name || 'N/A'}
                            </td>
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <div style={{ fontWeight: 600 }}>📱 {lead.phone || 'N/A'}</div>
                              {lead.email && <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>✉️ {lead.email}</div>}
                            </td>
                            <td style={{ padding: '0.85rem 1rem' }}>
                              {lead.application_id || lead.mis_data?.APPLICATION_REFERENCE_NUMBER || lead.mis_data?.bank_reference_number ? (
                                <code style={{ background: 'rgba(224, 168, 46, 0.12)', color: 'var(--gold-deep)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 800, border: '1px solid rgba(224, 168, 46, 0.25)' }}>
                                  {lead.application_id || lead.mis_data?.APPLICATION_REFERENCE_NUMBER || lead.mis_data?.bank_reference_number}
                                </code>
                              ) : (
                                <span style={{ color: 'var(--muted)' }}>N/A</span>
                              )}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                              {lead.card_bank || lead.card_name || agent?.assigned_bank || 'Bank Partner'}
                            </td>
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <span className={`badge ${badgeClass}`} style={{ fontSize: '0.78rem', fontWeight: 800, padding: '0.25rem 0.6rem', borderRadius: '6px' }}>
                                {lead.mis_status || 'Pending'}
                              </span>
                            </td>
                            <td style={{ padding: '0.85rem 1rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
                              {lead.mis_data?.decline_description || lead.mis_data?.current_stage || lead.mis_data?.remark || 'No Remarks'}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                              {lead.redirect_url ? (
                                <CopyLinkButton url={lead.redirect_url} />
                              ) : (
                                <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>MIS Record</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--muted)', fontWeight: 600 }}>
                          No Bank MIS records found for {agent?.assigned_bank || 'your bank'}. Click "Upload Bank MIS" to upload Excel/CSV MIS files!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalMappedPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.35rem', paddingTop: '0.85rem', borderTop: '1px solid var(--line)' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 600 }}>
                    Showing {((dashPage - 1) * DASH_PAGE_SIZE) + 1} - {Math.min(dashPage * DASH_PAGE_SIZE, filteredMappedLeads.length)} of {filteredMappedLeads.length} bank records
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      disabled={dashPage <= 1} 
                      onClick={() => setDashPage(p => Math.max(p - 1, 1))} 
                      className="btn-secondary" 
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', borderRadius: '8px', fontWeight: 600 }}
                    >
                      Previous
                    </button>
                    <span style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', fontWeight: 700 }}>
                      Page {dashPage} of {totalMappedPages}
                    </span>
                    <button 
                      disabled={dashPage >= totalMappedPages} 
                      onClick={() => setDashPage(p => Math.min(p + 1, totalMappedPages))} 
                      className="btn-secondary" 
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', borderRadius: '8px', fontWeight: 600 }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
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

      {/* Create Single Lead Modal */}
      {showCreateLeadModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '16px', background: 'var(--paper)', border: '1px solid var(--line)', padding: '1.75rem', borderTop: '4px solid var(--gold-deep)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <UserPlus size={22} style={{ color: 'var(--gold-deep)' }} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Create Single Lead (Walk-in / Field Capture)</h3>
              </div>
              <button onClick={() => setShowCreateLeadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={20} /></button>
            </div>

            {/* Step Progress Bar */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <div 
                onClick={() => setAgentFormStep(1)}
                style={{ 
                  flex: 1, 
                  padding: '0.55rem', 
                  borderRadius: '6px', 
                  background: agentFormStep === 1 ? 'var(--gold-deep)' : 'var(--paper-2)', 
                  color: agentFormStep === 1 ? '#fff' : 'var(--muted)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  cursor: 'pointer',
                  border: '1px solid var(--line)'
                }}
              >
                1. Personal & Contact Info
              </div>
              <div 
                onClick={() => { if (validateAgentStep(1)) setAgentFormStep(2); }}
                style={{ 
                  flex: 1, 
                  padding: '0.55rem', 
                  borderRadius: '6px', 
                  background: agentFormStep === 2 ? 'var(--gold-deep)' : 'var(--paper-2)', 
                  color: agentFormStep === 2 ? '#fff' : 'var(--muted)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  cursor: 'pointer',
                  border: '1px solid var(--line)'
                }}
              >
                2. Employment & Address
              </div>
            </div>

            {leadError && (
              <div style={{ background: 'rgba(209, 67, 67, 0.1)', border: '1px solid rgba(209, 67, 67, 0.25)', color: 'var(--err)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                ⚠️ {leadError}
              </div>
            )}

            {leadSuccess && (
              <div style={{ background: 'rgba(56, 142, 60, 0.1)', border: '1px solid rgba(56, 142, 60, 0.25)', color: 'var(--success)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                ✅ {leadSuccess}
              </div>
            )}

            <form onSubmit={handleLeadSubmit}>
              {agentFormStep === 1 ? (
                /* Step 1 Fields */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Name as per Govt ID *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Anil Sharma"
                      value={leadForm.fullName}
                      onChange={(e) => setLeadForm(prev => ({ ...prev, fullName: e.target.value }))}
                      required
                    />
                    {errors.fullName && <div style={{ color: 'var(--err)', fontSize: '0.75rem', marginTop: '0.2rem' }}>{errors.fullName}</div>}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>WhatsApp Number *</label>
                      <input 
                        type="tel" 
                        className="form-input" 
                        placeholder="10-digit number"
                        value={leadForm.phone}
                        onChange={(e) => setLeadForm(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                        required
                      />
                      {errors.phone && <div style={{ color: 'var(--err)', fontSize: '0.75rem', marginTop: '0.2rem' }}>{errors.phone}</div>}
                    </div>

                    <div>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Email Address *</label>
                      <input 
                        type="email" 
                        className="form-input" 
                        placeholder="anil@gmail.com"
                        value={leadForm.email}
                        onChange={(e) => setLeadForm(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                      {errors.email && <div style={{ color: 'var(--err)', fontSize: '0.75rem', marginTop: '0.2rem' }}>{errors.email}</div>}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>PAN Number *</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. ABCDE1234F"
                        value={leadForm.pan_no}
                        onChange={(e) => setLeadForm(prev => ({ ...prev, pan_no: e.target.value.toUpperCase().slice(0, 10) }))}
                        required
                      />
                      {errors.pan_no && <div style={{ color: 'var(--err)', fontSize: '0.75rem', marginTop: '0.2rem' }}>{errors.pan_no}</div>}
                    </div>

                    <div>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Date of Birth *</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={leadForm.dob}
                        onChange={(e) => setLeadForm(prev => ({ ...prev, dob: e.target.value }))}
                        required
                      />
                      {errors.dob && <div style={{ color: 'var(--err)', fontSize: '0.75rem', marginTop: '0.2rem' }}>{errors.dob}</div>}
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Mother's Full Name *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Enter mother's full name"
                      value={leadForm.mother_name}
                      onChange={(e) => setLeadForm(prev => ({ ...prev, mother_name: e.target.value }))}
                      required
                    />
                    {errors.mother_name && <div style={{ color: 'var(--err)', fontSize: '0.75rem', marginTop: '0.2rem' }}>{errors.mother_name}</div>}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button type="button" onClick={handleAgentContinueToStep2} className="btn-primary" style={{ background: 'var(--gold-deep)', color: '#fff' }}>
                      Continue to Next Step →
                    </button>
                  </div>
                </div>
              ) : (
                /* Step 2 Fields */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Target Credit Card *</label>
                      <select 
                        className="form-select"
                        value={leadForm.cardId}
                        onChange={(e) => setLeadForm(prev => ({ ...prev, cardId: e.target.value }))}
                        required
                      >
                        <option value="">Select Credit Card</option>
                        {cards.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.bank || 'Bank'})</option>
                        ))}
                      </select>
                      {errors.cardId && <div style={{ color: 'var(--err)', fontSize: '0.75rem', marginTop: '0.2rem' }}>{errors.cardId}</div>}
                    </div>

                    <div>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Employment Type *</label>
                      <select 
                        className="form-select"
                        value={leadForm.employment}
                        onChange={(e) => setLeadForm(prev => ({ ...prev, employment: e.target.value }))}
                        required
                      >
                        <option value="">Select Employment</option>
                        <option value="Salaried">Salaried</option>
                        <option value="Self-Employed">Self-Employed / Business</option>
                      </select>
                      {errors.employment && <div style={{ color: 'var(--err)', fontSize: '0.75rem', marginTop: '0.2rem' }}>{errors.employment}</div>}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Designation / Profession</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. Software Engineer"
                        value={leadForm.designation}
                        onChange={(e) => setLeadForm(prev => ({ ...prev, designation: e.target.value }))}
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Monthly Net Income (₹) *</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        placeholder="e.g. 45000"
                        value={leadForm.monthly_income}
                        onChange={(e) => setLeadForm(prev => ({ ...prev, monthly_income: e.target.value }))}
                        required
                      />
                      {errors.monthly_income && <div style={{ color: 'var(--err)', fontSize: '0.75rem', marginTop: '0.2rem' }}>{errors.monthly_income}</div>}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Flat / House No. *</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="House No."
                        value={leadForm.address_house}
                        onChange={(e) => setLeadForm(prev => ({ ...prev, address_house: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Street / Area *</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Street Name"
                        value={leadForm.address_street}
                        onChange={(e) => setLeadForm(prev => ({ ...prev, address_street: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Pincode *</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="6-digit Pincode"
                        value={leadForm.pincode}
                        onChange={(e) => {
                          const p = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setLeadForm(prev => ({ ...prev, pincode: p }));
                          if (p.length === 6) fetchPincodeDetails(p);
                        }}
                        required
                      />
                      {errors.pincode && <div style={{ color: 'var(--err)', fontSize: '0.75rem', marginTop: '0.2rem' }}>{errors.pincode}</div>}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>City *</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="City"
                        value={leadForm.address_city}
                        onChange={(e) => setLeadForm(prev => ({ ...prev, address_city: e.target.value }))}
                        required
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>State *</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="State"
                        value={leadForm.address_state}
                        onChange={(e) => setLeadForm(prev => ({ ...prev, address_state: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                    <button type="button" onClick={() => setAgentFormStep(1)} className="btn-secondary">
                      ← Back to Step 1
                    </button>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={() => setShowCreateLeadModal(false)} className="btn-secondary">Cancel</button>
                      <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ background: 'var(--gold-deep)', color: '#fff' }}>
                        {isSubmitting ? 'Registering Lead...' : 'Submit & Register Lead'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

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
      {showBankMisResultModal && bankMisUploadResult && (() => {
        const matchedCount = bankMisUploadResult.totalMatched ?? bankMisUploadResult.updated ?? bankMisUploadResult.mapped ?? 0;
        const unmatchedCount = bankMisUploadResult.totalUnmatched ?? bankMisUploadResult.unmatched ?? bankMisUploadResult.failed ?? 0;
        const processedCount = bankMisUploadResult.totalProcessed ?? bankMisUploadResult.processed ?? bankMisUploadResult.total ?? (matchedCount + unmatchedCount);
        const unmatchedItems = bankMisUploadResult.unmatchedDetails || bankMisUploadResult.unmatchedList || [];

        return (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
            <div className="glass-panel modal-content" style={{ width: '100%', maxWidth: '580px', maxHeight: '85vh', overflowY: 'auto', borderRadius: '16px', background: 'var(--paper)', border: '1px solid var(--line)', padding: '1.75rem', borderTop: '4px solid var(--gold-deep)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--line)' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Bank MIS Upload Results</h3>
                <button onClick={() => setShowBankMisResultModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={20} /></button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ background: 'var(--paper-2)', padding: '0.85rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Total Processed</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{processedCount}</div>
                </div>
                <div style={{ background: 'rgba(56, 142, 60, 0.1)', padding: '0.85rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(56, 142, 60, 0.25)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Mapped Leads</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)' }}>{matchedCount}</div>
                </div>
                <div style={{ background: 'rgba(209, 67, 67, 0.1)', padding: '0.85rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(209, 67, 67, 0.25)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--err)' }}>Unmatched</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--err)' }}>{unmatchedCount}</div>
                </div>
              </div>

              {unmatchedItems && unmatchedItems.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--warning)' }}>Unmatched URN / Application IDs ({unmatchedItems.length}):</h4>
                  <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', padding: '0.75rem', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto', fontSize: '0.78rem', color: 'var(--ink)' }}>
                    {unmatchedItems.map((item, idx) => (
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
        );
      })()}

    </div>
  );
}
