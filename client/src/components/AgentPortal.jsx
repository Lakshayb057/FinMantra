import React, { useState, useEffect, useMemo } from 'react';
import { LogIn, User, MapPin, CheckCircle, BarChart3, Plus, LogOut, Sun, Moon, Copy } from 'lucide-react';
import { trackLeadSubmission } from '../utils/analytics';

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
  const [leadForm, setLeadForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    cardId: '',
    monthly_income: ''
  });
  
  const [leadError, setLeadError] = useState('');
  const [leadSuccess, setLeadSuccess] = useState('');

  // Performance stats
  const [agentLeads, setAgentLeads] = useState([]);
  
  const filteredCards = useMemo(() => {
    return cards.filter(c => {
      // Hide 'digital' category cards from agents (already filtered, but let's be safe)
      if (c.category?.toLowerCase() === 'digital') return false;
      // If it's an offline card with specific locations assigned,
      // only show it if the agent is logged in to one of those locations.
      if (c.category?.toLowerCase() === 'offline') {
        if (c.card_locations && c.card_locations.length > 0) {
          return c.card_locations.includes(agentLocation);
        }
      }
      return true;
    });
  }, [cards, agentLocation]);
  
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
      const [cardsRes, locsRes, leadsRes] = await Promise.all([
        fetch(`${API_URL}/cards`),
        fetch(`${API_URL}/locations`),
        fetch(`${API_URL}/leads`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const cardsData = await cardsRes.json();
      const locsData = await locsRes.json();
      
      const cardsList = Array.isArray(cardsData) ? cardsData : [];
      const locsList = Array.isArray(locsData) ? locsData : [];

      setCards(cardsList.filter(c => c.category?.toLowerCase() !== 'digital'));
      setLocations(locsList.filter(l => l.active));
      
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

  const handleLeadChange = (e) => {
    const { name, value } = e.target;
    if (name === 'monthly_income' || name === 'phone') {
      const cleanVal = value.replace(/\D/g, '');
      setLeadForm(prev => ({ ...prev, [name]: cleanVal }));
      return;
    }
    setLeadForm(prev => ({ ...prev, [name]: value }));
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    setLeadError('');
    setLeadSuccess('');

    const { fullName, phone, email, cardId, monthly_income } = leadForm;

    if (!fullName || !phone || !email || !cardId || !monthly_income) {
      setLeadError('Please fill in all details, including card selection and monthly income.');
      return;
    }

    if (phone.length !== 10 || !/^\d+$/.test(phone)) {
      setLeadError('WhatsApp number must be exactly 10 digits.');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setLeadError('Please enter a valid email address.');
      return;
    }

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
          monthly_income: monthly_income ? String(monthly_income).trim() : null
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

        // Reset lead form
        setLeadForm({
          fullName: '',
          phone: '',
          email: '',
          cardId: '',
          monthly_income: ''
        });

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
        marginBottom: '2rem',
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

        {/* Right side controls */}
        <div className="admin-nav-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            className="theme-toggle-btn" 
            onClick={toggleTheme} 
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            style={{ padding: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '34px', width: '34px' }}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button 
            onClick={handleLogout} 
            className="btn-secondary" 
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem', height: '34px', background: 'rgba(209, 67, 67, 0.1)', color: 'var(--err)', borderColor: 'rgba(209, 67, 67, 0.2)', cursor: 'pointer' }}
          >
            <LogOut size={14} /> Exit
          </button>
        </div>
      </div>

      {/* Dashboard Top Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1.5rem' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '3px solid hsl(var(--primary))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Leads Submitted Today</span>
            <CheckCircle size={20} style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{todaysLeads.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Resetting at midnight</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '3px solid hsl(var(--secondary))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Total Lifetime Leads</span>
            <BarChart3 size={20} style={{ color: 'hsl(var(--secondary))' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{agentLeads.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Leads registered via Agent source</div>
        </div>
      </div>

      {/* Main Grid for entry + list */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2.5rem', alignItems: 'start' }} className="agent-panels-grid">
        
        {/* Walk-in Capture Lead Form */}
        <div className="glass-panel" style={{ borderLeft: '3px solid var(--gold)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Plus size={22} style={{ color: 'var(--gold-deep)' }} />
            <h2 style={{ fontSize: '1.4rem' }}>Walk-in Lead Capture</h2>
          </div>

          <form onSubmit={handleLeadSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Name as per Govt. ID</label>
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
              </div>
              <div className="form-group">
                <label className="form-label">WhatsApp number</label>
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
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Email Address</label>
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
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Net Monthly Income (₹)</label>
              <input 
                type="text" 
                name="monthly_income" 
                className="form-input" 
                placeholder="e.g. 50000"
                value={leadForm.monthly_income}
                onChange={handleLeadChange} 
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Select Card</label>
              <select 
                name="cardId" 
                className="form-select" 
                value={leadForm.cardId}
                onChange={handleLeadChange} 
                required
                disabled={isSubmitting}
              >
                <option value="">-- Select Card to Apply --</option>
                {filteredCards.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.bank} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            {leadError && (
              <div style={{ background: 'rgba(209, 67, 67, 0.1)', border: '1px solid rgba(209, 67, 67, 0.2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', color: 'var(--err)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                {leadError}
              </div>
            )}

            {leadSuccess && (
              <div style={{ background: 'rgba(22, 163, 123, 0.1)', border: '1px solid rgba(22, 163, 123, 0.2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', color: 'var(--mint)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                {leadSuccess}
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={isSubmitting}>
              {isSubmitting ? 'Registering Lead...' : 'Verify & Apply Now'}
            </button>
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
                      {lead.card_name} {lead.monthly_income ? `• ₹${lead.monthly_income}` : ''} • {lead.city || 'Walk-in'}
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

    </div>
  );
}
