import React, { useState, useEffect } from 'react';
import { LogIn, User, MapPin, CheckCircle, BarChart3, Plus, LogOut } from 'lucide-react';

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

export default function AgentPortal() {
  const [token, setToken] = useState(getCookie('finmantra_agent_token') || '');
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
  
  // Login form
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  // Lead form
  const [cards, setCards] = useState([]);
  const [locations, setLocations] = useState([]);
  const [leadForm, setLeadForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    city: '',
    employment: 'Salaried',
    income: 'Below ₹25,000',
    selectedCard: ''
  });
  
  const [leadError, setLeadError] = useState('');
  const [leadSuccess, setLeadSuccess] = useState('');

  // Performance stats
  const [agentLeads, setAgentLeads] = useState([]);
  
  const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';

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

  // Sync lead form city with agentLocation
  useEffect(() => {
    if (agentLocation) {
      setLeadForm(prev => ({ ...prev, city: agentLocation }));
    }
  }, [agentLocation]);

  // Fetch data if logged in
  useEffect(() => {
    if (token) {
      fetchMasterData();
    }
  }, [token]);

  // Real-time synchronization via WebSocket for agent portal
  useEffect(() => {
    if (!token) return;

    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = window.location.hostname === 'localhost' 
      ? `ws://${window.location.hostname}:5000` 
      : `${wsProto}//${window.location.host}`;
    let socket;

    const connectWebSocket = () => {
      socket = new WebSocket(wsUrl);

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
          console.error('[WebSocket Client] Agent Sync error:', err);
        }
      };

      socket.onclose = () => {
        setTimeout(connectWebSocket, 5000);
      };

      socket.onerror = (err) => {
        socket.close();
      };
    };

    connectWebSocket();

    return () => {
      if (socket) socket.close();
    };
  }, [token, agent]);

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
      
      setCards(cardsData);
      setLocations(locsData.filter(l => l.active));
      
      if (cardsData.length > 0) {
        setLeadForm(prev => ({ 
          ...prev, 
          selectedCard: cardsData[0].id,
          city: agentLocation || agent?.locations?.[0] || '' 
        }));
      }

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        // Filter leads submitted by this agent
        const filtered = leadsData.filter(l => l.agent_id === agent?.id);
        setAgentLeads(filtered);
      }
    } catch (err) {
      console.error('Error fetching agent data:', err);
    }
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
      } else {
        setAuthError(data.error || 'Invalid credentials');
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
    setAgent(null);
    setAgentLocation('');
    setLoginForm({ username: '', password: '' });
  };

  const handleLeadChange = (e) => {
    const { name, value } = e.target;
    setLeadForm(prev => ({ ...prev, [name]: value }));
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    setLeadError('');
    setLeadSuccess('');

    const { fullName, phone, email, city, selectedCard } = leadForm;

    if (!fullName || !phone || !email || !city || !selectedCard) {
      setLeadError('Please fill in all details.');
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
          city,
          employment: leadForm.employment,
          income_range: leadForm.income,
          card_id: selectedCard,
          source: 'agent',
          agent_id: agent?.id,
          agent_name: agent?.name,
          agent_location: agentLocation,
          consent: true
        })
      });
      const data = await res.json();

      if (res.ok) {
        setLeadSuccess(`Lead registered successfully! Generated URM: ${data.urm}. Redirecting to bank portal...`);
        // Reset lead form but keep city & card selected
        setLeadForm(prev => ({
          ...prev,
          fullName: '',
          phone: '',
          email: '',
        }));
        // Reload agent performance leads
        fetchMasterData();

        // Automatically redirect agent to bank portal after 1.5s delay
        setTimeout(() => {
          window.location.href = data.redirectUrl;
        }, 1500);
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

            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Authenticating...' : 'Access Terminal'} <LogIn size={18} />
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <div style={{ padding: '3rem 8%', position: 'relative', zIndex: 1 }}>
      
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

      {/* Dashboard Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '0.25rem' }}>Welcome, {agent?.name}</h1>
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
        <button onClick={handleLogout} className="btn-secondary" style={{ padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
          <LogOut size={16} /> Logout
        </button>
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
                <label className="form-label">Full Name (Aadhaar)</label>
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
                <label className="form-label">WhatsApp Number</label>
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

            <div className="form-group">
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">City/Location {agentLocation && '(Locked to Daily Kiosk)'}</label>
                <select 
                  name="city" 
                  className="form-select" 
                  value={leadForm.city} 
                  onChange={handleLeadChange} 
                  required
                  disabled={isSubmitting || !!agentLocation}
                >
                  <option value="">Select Location</option>
                  {agent?.locations && agent.locations.length > 0 ? (
                    agent.locations.map((loc, idx) => (
                      <option key={idx} value={loc}>{loc}</option>
                    ))
                  ) : locations.length > 0 ? (
                    locations.map(loc => (
                      <option key={loc.id} value={loc.name}>{loc.name}</option>
                    ))
                  ) : (
                    <>
                      <option value="Mumbai Airport Kiosk">Mumbai Airport Kiosk</option>
                      <option value="Delhi Kiosk">Delhi Kiosk</option>
                    </>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Employment</label>
                <select name="employment" className="form-select" value={leadForm.employment} onChange={handleLeadChange} disabled={isSubmitting}>
                  <option value="Salaried">Salaried</option>
                  <option value="Self-employed">Self-employed</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">Monthly Income</label>
                <select name="income" className="form-select" value={leadForm.income} onChange={handleLeadChange} disabled={isSubmitting}>
                  <option value="Below ₹25,000">Below ₹25,000</option>
                  <option value="₹25,000 – ₹50,000">₹25,000 – ₹50,000</option>
                  <option value="₹50,000 – ₹1,00,000">₹50,000 – ₹1,00,000</option>
                  <option value="Above ₹1,00,000">Above ₹1,00,000</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Credit Card Option</label>
                <select name="selectedCard" className="form-select" value={leadForm.selectedCard} onChange={handleLeadChange} required disabled={isSubmitting}>
                  {cards.length > 0 ? (
                    cards.map(card => (
                      <option key={card.id} value={card.id}>{card.bank} {card.name}</option>
                    ))
                  ) : (
                    <option value="">No active cards</option>
                  )}
                </select>
              </div>
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
              {isSubmitting ? 'Registering Lead...' : 'Submit Lead Directly'}
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
                    <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                      {lead.card_name} • {lead.city}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>{lead.urm}</span>
                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem' }}>
                      {lead.created_at ? lead.created_at.slice(11, 16) : ''}
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
