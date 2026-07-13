import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LogIn, User, MapPin, CheckCircle, BarChart3, Plus, LogOut, Sun, Moon, Copy, Briefcase, Home, Calendar, Phone, ArrowRight, RefreshCw, Mail, ChevronDown } from 'lucide-react';
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

  // Performance stats
  const [agentLeads, setAgentLeads] = useState([]);
  
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

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        const leadsList = Array.isArray(leadsData) ? leadsData : (leadsData.leads || []);
        // Filter leads submitted by this agent
        const filtered = leadsList.filter(l => l.agent_id === agent?.id);
        setAgentLeads(filtered);
        // Token is verified - enable WebSocket sync
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7500);

        let resolved = false;

        // 1. Try Zippopotam API (highly reliable, globally distributed CDN)
        try {
          const zipRes = await fetch(`https://api.zippopotam.us/in/${pin}`, { signal: controller.signal });
          if (zipRes.ok) {
            const zipData = await zipRes.json();
            if (zipData && zipData.places && zipData.places.length > 0) {
              const state = zipData.places[0].state;
              const rawPlace = zipData.places[0]['place name'];
              const district = rawPlace.split('(')[0].trim();
              
              setPincodeLocationText(`${district}, ${state}`);
              const localities = zipData.places.map(p => p['place name'].split('(')[0].trim()).filter((v, i, a) => v && a.indexOf(v) === i);
              setPincodeLocalities(localities);
              
              setLeadForm(prev => ({ 
                ...prev, 
                address_city: district,
                address_state: state,
                address_locality: localities[0] || ''
              }));
              resolved = true;
            }
          }
        } catch (zipErr) {
          console.warn('Zippopotam API failed/timed out, attempting fallback API:', zipErr.message);
        }

        // 2. Try Postal Pincode API
        if (!resolved) {
          const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: controller.signal });
          if (res.ok) {
            const data = await res.json();
            if (data && data[0] && data[0].Status === 'Success') {
              const postOffices = data[0].PostOffice;
              if (postOffices && postOffices.length > 0) {
                const district = postOffices[0].District;
                const state = postOffices[0].State;
                setPincodeLocationText(`${district}, ${state}`);
                const localities = postOffices.map(po => po.Name).filter(Boolean);
                setPincodeLocalities(localities);
                
                setLeadForm(prev => ({ 
                  ...prev, 
                  address_city: district,
                  address_state: state,
                  address_locality: localities[0] || ''
                }));
                resolved = true;
              }
            }
          }
        }

        clearTimeout(timeoutId);

        if (!resolved) {
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
        }
      } catch (e) {
        setPincodeLocalities([]);
        if (e.name === 'AbortError') {
          console.warn('Pincode lookup timed out (using offline estimation).');
        } else {
          console.error('Failed to look up pincode details', e);
        }
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
          setPincodeError('Invalid Pincode');
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
      <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '2rem' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', borderLeft: '3px solid hsl(var(--primary))' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ width: '60px', height: '60px', background: 'rgba(224, 168, 46, 0.15)', color: 'var(--gold-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto', borderRadius: '50%' }}>
              <User size={30} />
            </div>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>Agent Terminal</h2>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Access your lead generation control console</p>
          </div>

          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input 
                type="text" 
                name="username" 
                className="form-input" 
                placeholder="Enter username" 
                value={loginForm.username} 
                onChange={handleLoginChange}
                required 
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Password</label>
              <input 
                type="password" 
                name="password" 
                className="form-input" 
                placeholder="Enter password" 
                value={loginForm.password} 
                onChange={handleLoginChange}
                required 
              />
            </div>

            {authError && (
              <div style={{ background: 'rgba(209, 67, 67, 0.1)', border: '1px solid rgba(209, 67, 67, 0.2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', color: 'var(--err)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                {authError}
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading || timeLeft > 0}>
              {timeLeft > 0 ? `Blocked (Try again in ${formatTime(timeLeft)})` : (loading ? 'Authenticating...' : 'Access Terminal')} <LogIn size={18} />
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

      {/* Dashboard Top Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
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

      {/* Performance Summary Cards */}
      <div className="agent-stats-grid">
        <div className="glass-panel agent-stat-card" style={{ borderLeft: '3px solid hsl(var(--primary))' }}>
          <div className="agent-stat-header">
            <span className="agent-stat-title">Leads Submitted Today</span>
            <CheckCircle size={20} className="agent-stat-icon" style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <div className="agent-stat-value">{todaysLeads.length}</div>
          <div className="agent-stat-desc">Resetting at midnight</div>
        </div>

        <div className="glass-panel agent-stat-card" style={{ borderLeft: '3px solid hsl(var(--secondary))' }}>
          <div className="agent-stat-header">
            <span className="agent-stat-title">Total Lifetime Leads</span>
            <BarChart3 size={20} className="agent-stat-icon" style={{ color: 'hsl(var(--secondary))' }} />
          </div>
          <div className="agent-stat-value">{agentLeads.length}</div>
          <div className="agent-stat-desc">Leads registered via Agent source</div>
        </div>
      </div>

      {/* Main Grid for entry + list */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2.5rem', alignItems: 'start' }} className="agent-panels-grid">
        
        {/* Walk-in Capture Lead Form */}
        <div className="glass-panel" style={{ borderLeft: '3px solid var(--gold)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Plus size={22} style={{ color: 'var(--gold-deep)' }} />
            <h2 style={{ fontSize: '1.4rem' }}>Walk-in Lead Capture</h2>
          </div>

          <form onSubmit={handleLeadSubmit}>
            {/* Step indicator */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', position: 'relative', padding: '0 8px' }}>
              <div style={{ position: 'absolute', top: '15px', left: '16px', right: '16px', height: '2px', background: 'var(--line)', zIndex: 1 }}>
                <div style={{ width: agentFormStep === 2 ? '100%' : '0%', height: '100%', background: 'var(--gold)', transition: 'width 0.3s ease' }}></div>
              </div>
              <div 
                onClick={() => !isSubmitting && setAgentFormStep(1)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, position: 'relative', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
              >
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '50%', 
                  background: agentFormStep >= 1 ? 'var(--gold)' : 'var(--white)', 
                  border: agentFormStep >= 1 ? '2px solid var(--gold)' : '2px solid var(--line)',
                  color: agentFormStep >= 1 ? 'var(--white)' : 'var(--muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem',
                  transition: 'all 0.3s ease'
                }}>1</div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, marginTop: '6px', color: agentFormStep === 1 ? 'var(--gold-deep)' : 'var(--muted)' }}>Contact & Personal</span>
              </div>
              <div 
                onClick={() => {
                  if (isSubmitting) return;
                  if (agentFormStep === 2) return;
                  if (currentLeadUrn) {
                    setAgentFormStep(2);
                  } else {
                    handleAgentContinueToStep2();
                  }
                }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, position: 'relative', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
              >
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '50%', 
                  background: agentFormStep >= 2 ? 'var(--gold)' : 'var(--white)', 
                  border: agentFormStep >= 2 ? '2px solid var(--gold)' : '2px solid var(--line)',
                  color: agentFormStep >= 2 ? 'var(--white)' : 'var(--muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem',
                  transition: 'all 0.3s ease'
                }}>2</div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, marginTop: '6px', color: agentFormStep === 2 ? 'var(--gold-deep)' : 'var(--muted)' }}>More Info</span>
              </div>
            </div>

            {/* STEP 1 */}
            {agentFormStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Name as per Govt. ID <span style={{ color: 'var(--err)' }}>*</span></label>
                    <input 
                      type="text" 
                      name="fullName" 
                      className="form-input" 
                      placeholder="e.g. Anil Sharma"
                      value={leadForm.fullName}
                      onChange={handleLeadChange} 
                      required
                      disabled={isSubmitting}
                    />
                    {errors.fullName && <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.fullName}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">WhatsApp number <span style={{ color: 'var(--err)' }}>*</span></label>
                    <input 
                      type="tel" 
                      name="phone" 
                      className="form-input" 
                      placeholder="10-digit number"
                      maxLength="10"
                      value={leadForm.phone}
                      onChange={handleLeadChange} 
                      required
                      disabled={isSubmitting}
                    />
                    {errors.phone && <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.phone}</div>}
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Email Address <span style={{ color: 'var(--err)' }}>*</span></label>
                  <input 
                    type="email" 
                    name="email" 
                    className="form-input" 
                    placeholder="anil@gmail.com"
                    value={leadForm.email}
                    onChange={handleLeadChange} 
                    required
                    disabled={isSubmitting}
                  />
                  {errors.email && <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.email}</div>}
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">PAN Number <span style={{ color: 'var(--err)' }}>*</span></label>
                  <input 
                    type="text" 
                    name="pan_no" 
                    className="form-input" 
                    placeholder="e.g. ABCDE1234F"
                    value={leadForm.pan_no}
                    onChange={handleLeadChange} 
                    required
                    disabled={isSubmitting}
                    style={{ textTransform: 'uppercase' }}
                  />
                  {errors.pan_no && <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.pan_no}</div>}
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Date of Birth <span style={{ color: 'var(--err)' }}>*</span></label>
                  <input 
                    type="date" 
                    name="dob" 
                    className="form-input" 
                    value={leadForm.dob}
                    onChange={handleLeadChange} 
                    required
                    disabled={isSubmitting}
                  />
                  {errors.dob && <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.dob}</div>}
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Mother's Full Name <span style={{ color: 'var(--err)' }}>*</span></label>
                  <input 
                    type="text" 
                    name="mother_name" 
                    className="form-input" 
                    placeholder="Enter mother's full name"
                    value={leadForm.mother_name}
                    onChange={handleLeadChange} 
                    required
                    disabled={isSubmitting}
                  />
                  {errors.mother_name && <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.mother_name}</div>}
                </div>



                {leadError && (
                  <div style={{ background: 'rgba(209, 67, 67, 0.1)', border: '1px solid rgba(209, 67, 67, 0.2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', color: 'var(--err)', fontSize: '0.85rem' }}>
                    {leadError}
                  </div>
                )}

                <button 
                  type="button" 
                  onClick={handleAgentContinueToStep2} 
                  className="btn-primary" 
                  style={{ width: '100%', marginTop: '0.5rem' }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving Step 1...' : 'Continue to Next Step'} <ArrowRight size={18} />
                </button>
              </div>
            )}

            {/* STEP 2 */}
            {agentFormStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div ref={employmentDropdownRef} className="form-group" style={{ marginBottom: '1rem', position: 'relative' }}>
                  <label className="form-label">Employment Type <span style={{ color: 'var(--err)' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <div 
                      onClick={() => !isSubmitting && setEmploymentDropdownOpen(!employmentDropdownOpen)}
                      className="form-select-trigger"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        height: '38px',
                        padding: '0 0.9rem',
                        border: '1.5px solid ' + (errors.employment ? 'var(--err)' : employmentDropdownOpen ? 'var(--gold)' : 'var(--line)'),
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--white)',
                        color: leadForm.employment ? 'var(--ink)' : 'var(--muted)',
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        fontSize: '0.95rem',
                        userSelect: 'none',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                        boxShadow: employmentDropdownOpen ? '0 0 0 3px rgba(224, 168, 46, 0.2)' : 'none'
                      }}
                    >
                      <span>{leadForm.employment ? leadForm.employment : '-- Select Employment --'}</span>
                      <ChevronDown size={16} style={{ 
                        transform: employmentDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        color: 'var(--muted)'
                      }} />
                    </div>

                    {employmentDropdownOpen && (
                      <div 
                        className="custom-select-options-list"
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          left: 0,
                          right: 0,
                          zIndex: 9999,
                          background: 'var(--white)',
                          border: '1.5px solid var(--line)',
                          borderRadius: 'var(--radius-sm)',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                          maxHeight: '200px',
                          overflowY: 'auto'
                        }}
                      >
                        {[
                          { label: '-- Select Employment --', value: '' },
                          { label: 'Salaried', value: 'Salaried' },
                          { label: 'Self-Employed', value: 'Self-Employed' },
                          { label: 'Business/Professional', value: 'Business/Professional' },
                          { label: 'Other', value: 'Other' }
                        ].map((opt) => (
                          <div 
                            key={opt.value}
                            onClick={() => {
                              setLeadForm(prev => ({ ...prev, employment: opt.value }));
                              if (errors.employment) {
                                setErrors(prev => {
                                  const newErr = { ...prev };
                                  delete newErr.employment;
                                  return newErr;
                                });
                              }
                              setEmploymentDropdownOpen(false);
                            }}
                            className="custom-select-option"
                            style={{
                              padding: '0.65rem 0.9rem',
                              cursor: 'pointer',
                              fontSize: '0.95rem',
                              background: leadForm.employment === opt.value ? 'rgba(224, 168, 46, 0.08)' : 'transparent',
                              color: leadForm.employment === opt.value ? 'var(--gold-deep)' : 'var(--ink)',
                              fontWeight: leadForm.employment === opt.value ? 600 : 400,
                              borderBottom: '1px solid var(--line-light)'
                            }}
                            onMouseEnter={(e) => {
                              if (leadForm.employment !== opt.value) {
                                e.currentTarget.style.background = 'var(--paper)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (leadForm.employment !== opt.value) {
                                e.currentTarget.style.background = 'transparent';
                              }
                            }}
                          >
                            {opt.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {errors.employment && <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.employment}</div>}
                </div>

                <div ref={designationDropdownRef} className="form-group" style={{ marginBottom: '1rem', position: 'relative' }}>
                  <label className="form-label">Designation <span style={{ color: 'var(--err)' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      name="designation" 
                      className="form-input" 
                      placeholder="Type or select designation"
                      value={leadForm.designation}
                      onChange={handleLeadChange} 
                      onFocus={() => !isSubmitting && setDesignationDropdownOpen(true)}
                      required
                      disabled={isSubmitting}
                      autoComplete="off"
                    />
                    <ChevronDown size={16} style={{
                      position: 'absolute', right: '0.85rem', top: '50%',
                      transform: designationDropdownOpen ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
                      transition: 'transform 0.2s ease',
                      color: 'var(--muted)',
                      pointerEvents: 'none'
                    }} />
                  </div>
                  
                  {designationDropdownOpen && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                      background: 'var(--white)',
                      border: '1.5px solid var(--line)',
                      borderRadius: 'var(--radius-sm)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                      zIndex: 50,
                      maxHeight: '180px',
                      overflowY: 'auto',
                      animation: 'fadeIn 0.15s ease'
                    }}>
                      {COMMON_DESIGNATIONS.filter(des => 
                        des.toLowerCase().includes((leadForm.designation || '').toLowerCase())
                      ).length > 0 ? (
                        COMMON_DESIGNATIONS.filter(des => 
                          des.toLowerCase().includes((leadForm.designation || '').toLowerCase())
                        ).map((opt, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setLeadForm(prev => ({ ...prev, designation: opt }));
                              setDesignationDropdownOpen(false);
                            }}
                            style={{
                              padding: '0.65rem 1rem',
                              fontSize: '0.9rem',
                              cursor: 'pointer',
                              background: leadForm.designation === opt ? 'rgba(224, 168, 46, 0.15)' : 'transparent',
                              color: leadForm.designation === opt ? 'var(--gold-deep)' : 'var(--ink)',
                              fontWeight: leadForm.designation === opt ? 700 : 400,
                              transition: 'background 0.15s ease, color 0.15s ease',
                              borderBottom: '1px solid var(--line)'
                            }}
                            onMouseEnter={e => { 
                              if (leadForm.designation !== opt) { 
                                e.currentTarget.style.background = 'var(--paper-2)'; 
                              } 
                            }}
                            onMouseLeave={e => { 
                              if (leadForm.designation !== opt) { 
                                e.currentTarget.style.background = 'transparent'; 
                              } 
                            }}
                          >
                            {opt}
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '0.65rem 1rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
                          Press enter or continue typing for custom option
                        </div>
                      )}
                    </div>
                  )}
                  {errors.designation && <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.designation}</div>}
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Net Monthly Income</label>
                  <input 
                    type="text" 
                    name="monthly_income" 
                    className="form-input" 
                    placeholder="e.g. 50000 (optional)"
                    value={leadForm.monthly_income}
                    onChange={handleLeadChange} 
                    disabled={isSubmitting}
                  />
                  {errors.monthly_income && <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.monthly_income}</div>}
                </div>

                <div ref={cardDropdownRef} className="form-group" style={{ marginBottom: '1rem', position: 'relative' }}>
                  <label className="form-label">Select Card <span style={{ color: 'var(--err)' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <div 
                      onClick={() => !isSubmitting && setCardDropdownOpen(!cardDropdownOpen)}
                      className="form-select-trigger"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        height: '38px',
                        padding: '0 0.9rem',
                        border: '1.5px solid ' + (errors.cardId ? 'var(--err)' : cardDropdownOpen ? 'var(--gold)' : 'var(--line)'),
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--white)',
                        color: leadForm.cardId ? 'var(--ink)' : 'var(--muted)',
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        fontSize: '0.95rem',
                        userSelect: 'none',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                        boxShadow: cardDropdownOpen ? '0 0 0 3px rgba(224, 168, 46, 0.2)' : 'none'
                      }}
                    >
                      <span>
                        {leadForm.cardId 
                          ? filteredCards.find(c => c.id.toString() === leadForm.cardId)
                            ? `${filteredCards.find(c => c.id.toString() === leadForm.cardId).bank} - ${filteredCards.find(c => c.id.toString() === leadForm.cardId).name}`
                            : '-- Select Card to Apply --'
                          : '-- Select Card to Apply --'}
                      </span>
                      <ChevronDown size={16} style={{ 
                        transform: cardDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        color: 'var(--muted)'
                      }} />
                    </div>

                    {cardDropdownOpen && (
                      <div 
                        className="custom-select-options-list"
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          left: 0,
                          right: 0,
                          zIndex: 9999,
                          background: 'var(--white)',
                          border: '1.5px solid var(--line)',
                          borderRadius: 'var(--radius-sm)',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                          maxHeight: '200px',
                          overflowY: 'auto'
                        }}
                      >
                        <div 
                          onClick={() => {
                            setLeadForm(prev => ({ ...prev, cardId: '' }));
                            setCardDropdownOpen(false);
                          }}
                          className="custom-select-option"
                          style={{
                            padding: '0.65rem 0.9rem',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            background: !leadForm.cardId ? 'rgba(224, 168, 46, 0.08)' : 'transparent',
                            color: !leadForm.cardId ? 'var(--gold-deep)' : 'var(--ink)',
                            fontWeight: !leadForm.cardId ? 600 : 400,
                            borderBottom: '1px solid var(--line-light)'
                          }}
                          onMouseEnter={(e) => {
                            if (leadForm.cardId) {
                              e.currentTarget.style.background = 'var(--paper)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (leadForm.cardId) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
                        >
                          -- Select Card to Apply --
                        </div>
                        {filteredCards.map((c) => (
                          <div 
                            key={c.id}
                            onClick={() => {
                              setLeadForm(prev => ({ ...prev, cardId: c.id.toString() }));
                              if (errors.cardId) {
                                setErrors(prev => {
                                  const newErr = { ...prev };
                                  delete newErr.cardId;
                                  return newErr;
                                });
                              }
                              setCardDropdownOpen(false);
                            }}
                            className="custom-select-option"
                            style={{
                              padding: '0.65rem 0.9rem',
                              cursor: 'pointer',
                              fontSize: '0.95rem',
                              background: leadForm.cardId === c.id.toString() ? 'rgba(224, 168, 46, 0.08)' : 'transparent',
                              color: leadForm.cardId === c.id.toString() ? 'var(--gold-deep)' : 'var(--ink)',
                              fontWeight: leadForm.cardId === c.id.toString() ? 600 : 400,
                              borderBottom: '1px solid var(--line-light)'
                            }}
                            onMouseEnter={(e) => {
                              if (leadForm.cardId !== c.id.toString()) {
                                e.currentTarget.style.background = 'var(--paper)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (leadForm.cardId !== c.id.toString()) {
                                e.currentTarget.style.background = 'transparent';
                              }
                            }}
                          >
                            {c.bank} - {c.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {errors.cardId && <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.cardId}</div>}
                </div>

                {/* Structured Address Fields */}
                <div style={{ borderTop: '1px dashed var(--line)', paddingTop: '1rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--gold-deep)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 0 }}>Current Residence Address</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Flat / House No. / Building <span style={{ color: 'var(--err)' }}>*</span></label>
                      <input 
                        type="text" 
                        name="address_house" 
                        className="form-input" 
                        placeholder="Flat/House No., Bldg"
                        value={leadForm.address_house}
                        onChange={handleLeadChange} 
                        required
                        disabled={isSubmitting}
                      />
                      {errors.address_house && <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.address_house}</div>}
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Road / Street / Landmark <span style={{ color: 'var(--err)' }}>*</span></label>
                      <input 
                        type="text" 
                        name="address_street" 
                        className="form-input" 
                        placeholder="Road, Street, Area"
                        value={leadForm.address_street}
                        onChange={handleLeadChange} 
                        required
                        disabled={isSubmitting}
                      />
                      {errors.address_street && <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.address_street}</div>}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Pincode <span style={{ color: 'var(--err)' }}>*</span></label>
                      <input 
                        type="text" 
                        name="pincode" 
                        className="form-input" 
                        placeholder="6-digit Pincode"
                        maxLength="6"
                        value={leadForm.pincode}
                        onChange={handleLeadChange} 
                        required
                        disabled={isSubmitting}
                      />
                      {pincodeLoading && <div style={{ fontSize: '0.7rem', color: 'var(--gold)', marginTop: '0.25rem' }}>Verifying...</div>}
                      {pincodeLocationText && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--mint)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: 'var(--mint)' }}></span>
                          {pincodeLocationText}
                        </div>
                      )}
                      {(errors.pincode || pincodeError) && <div style={{ fontSize: '0.7rem', color: 'var(--err)', marginTop: '0.25rem' }}>{errors.pincode || pincodeError}</div>}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Locality / Area <span style={{ color: 'var(--err)' }}>*</span></label>
                      {pincodeLocalities.length > 0 ? (
                        <select 
                          name="address_locality" 
                          className="form-select" 
                          value={leadForm.address_locality}
                          onChange={handleLeadChange} 
                          required
                          disabled={isSubmitting}
                          style={{ height: '42px' }}
                        >
                          {pincodeLocalities.map((loc, idx) => (
                            <option key={idx} value={loc}>{loc}</option>
                          ))}
                        </select>
                      ) : (
                        <input 
                          type="text" 
                          name="address_locality" 
                          className="form-input" 
                          placeholder="Locality name"
                          value={leadForm.address_locality}
                          onChange={handleLeadChange} 
                          required
                          disabled={isSubmitting}
                        />
                      )}
                      {errors.address_locality && <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.address_locality}</div>}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">City <span style={{ color: 'var(--err)' }}>*</span></label>
                      <input 
                        type="text" 
                        name="address_city" 
                        className="form-input" 
                        placeholder="City"
                        value={leadForm.address_city}
                        onChange={handleLeadChange} 
                        required
                        disabled={isSubmitting}
                      />
                      {errors.address_city && <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.address_city}</div>}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">State <span style={{ color: 'var(--err)' }}>*</span></label>
                      <select 
                        name="address_state" 
                        className="form-select" 
                        value={leadForm.address_state}
                        onChange={handleLeadChange} 
                        required
                        disabled={isSubmitting}
                        style={{ height: '42px' }}
                      >
                        <option value="">Select State</option>
                        {[
                          "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
                          "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
                          "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
                          "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
                          "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
                          "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
                        ].map((st, idx) => (
                          <option key={idx} value={st}>{st}</option>
                        ))}
                      </select>
                      {errors.address_state && <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.address_state}</div>}
                    </div>
                  </div>
                </div>

                {leadError && (
                  <div style={{ background: 'rgba(209, 67, 67, 0.1)', border: '1px solid rgba(209, 67, 67, 0.2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', color: 'var(--err)', fontSize: '0.85rem' }}>
                    {leadError}
                  </div>
                )}

                {leadSuccess && (
                  <div style={{ background: 'rgba(22, 163, 123, 0.1)', border: '1px solid rgba(22, 163, 123, 0.2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', color: 'var(--mint)', fontSize: '0.85rem' }}>
                    {leadSuccess}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <button 
                    type="button" 
                    onClick={() => setAgentFormStep(1)} 
                    className="btn-secondary" 
                    style={{ flex: 1 }}
                    disabled={isSubmitting}
                  >
                    Back
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary" 
                    style={{ flex: 2 }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Registering Lead...' : 'Register Lead'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Today's submissions list (mini grid) */}
        <div className="glass-panel">
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1.25rem' }}>Submissions History</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '420px', overflowY: 'auto' }}>
            {agentLeads.length > 0 ? (
              [...agentLeads].reverse().slice(0, 15).map(lead => (
                <div key={lead.id} className="glass-card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{lead.full_name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: lead.redirect_url ? '4px' : '0' }}>
                      {lead.card_name} {lead.pan_no ? `• ${lead.pan_no}` : ''} {lead.monthly_income ? `• ₹${lead.monthly_income}` : ''} • {lead.city || 'Walk-in'}
                    </div>
                    {lead.redirect_url && <CopyLinkButton url={lead.redirect_url} />}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>{lead.urn}</span>
                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem' }}>
                      {formatTimeOnly(lead.created_at)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>
                No leads submitted in this session.
              </div>
            )}
          </div>
        </div>

      </div>

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

    </div>
  );
}
