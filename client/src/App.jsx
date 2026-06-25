import React, { useState, useEffect } from 'react';
import PublicLanding from './components/PublicLanding';
import AgentPortal from './components/AgentPortal';
import AdminDashboard from './components/AdminDashboard';


export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [utmParams, setUtmParams] = useState({ utm_source: '', utm_info: '' });
  const [showSplash, setShowSplash] = useState(true);
  const [fadeSplash, setFadeSplash] = useState(false);

  // Splash screen timer logic (fades out at 800ms, unmounts at 1000ms)
  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFadeSplash(true);
    }, 800);

    const removeTimer = setTimeout(() => {
      setShowSplash(false);
    }, 1000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  // Handle URL change detection (simple routing)
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Parse and capture UTM and all URL query parameters on initial load
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const params = {};
    for (const [key, value] of searchParams.entries()) {
      params[key] = value;
    }

    // Explicitly guarantee utm_source and utm_info exist (even if empty) for standard code usage
    if (!params.utm_source) params.utm_source = searchParams.get('utm_source') || '';
    if (!params.utm_medium) params.utm_medium = searchParams.get('utm_medium') || searchParams.get('utm_medem') || '';
    if (!params.utm_info) params.utm_info = searchParams.get('utm_info') || params.utm_medium || '';

    if (Object.keys(params).some(k => params[k])) {
      setUtmParams(params);
      sessionStorage.setItem('finmantra_utm', JSON.stringify(params));
    } else {
      const cached = sessionStorage.getItem('finmantra_utm');
      if (cached) {
        setUtmParams(JSON.parse(cached));
      }
    }
  }, []);

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Route Dispatcher
  const renderView = () => {
    const pathParts = currentPath.split('/');
    if (pathParts[1] === 'refer') {
      const urn = pathParts[4];
      return <ReferralRedirect urn={urn} />;
    }
    if (currentPath === '/agent') {
      return <AgentPortal navigateTo={navigateTo} />;
    }
    if (currentPath === '/admin') {
      return <AdminDashboard navigateTo={navigateTo} />;
    }
    return <PublicLanding navigateTo={navigateTo} utmParams={utmParams} />;
  };

  return (
    <div className="app-container">
      {/* Premium Splash Screen */}
      {showSplash && (
        <div className={`splash-screen ${fadeSplash ? 'fade-out' : ''}`}>
          <div className="splash-content">
            <span style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--gold)', boxShadow: '0 0 0 16px rgba(224, 168, 46, 0.22)', display: 'block', marginBottom: '1.5rem' }}></span>
            <h1 className="splash-title">Fin<span>Mantra</span></h1>
            <div className="splash-loader"></div>
          </div>
        </div>
      )}

      {/* Header / Navbar */}
      <header className="navbar">
        <div className="nav-logo" onClick={() => navigateTo('/')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: 'var(--gold)', boxShadow: '0 0 0 4px rgba(224, 168, 46, 0.22)' }}></span>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-0.03em' }}>FinMantra</span>
        </div>
        <nav className="nav-links">
          {currentPath === '/' && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.05em', color: 'var(--mint)', border: '1.5px solid rgba(22,163,123,0.35)', padding: '0.4em 0.85em', borderRadius: '999px', fontWeight: 700 }}>
              100% FREE • NO CHARGES
            </div>
          )}
          {currentPath === '/agent' && (
            <span className="nav-link active">Agent Terminal</span>
          )}
          {currentPath === '/admin' && (
            <span className="nav-link active">Admin Dashboard</span>
          )}
        </nav>
      </header>

      {/* Main Content */}
      <main>
        {renderView()}
      </main>
    </div>
  );
}

// Sub-component to resolve URN referral link and auto-redirect after splash screen
function ReferralRedirect({ urn }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [leadDetails, setLeadDetails] = useState(null);

  useEffect(() => {
    const fetchLeadAndRedirect = async () => {
      try {
        const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';
        const res = await fetch(`${API_URL}/leads/urn/${urn}`);
        const data = await res.json();

        if (res.ok) {
          setLeadDetails(data);
          // Wait exactly 1 second (1000ms) total (to witness the full FinMantra splash screen) before redirecting to bank
          setTimeout(() => {
            window.location.href = data.redirectUrl;
          }, 1000);
        } else {
          setError(data.error || 'The requested URN reference details do not exist.');
          setLoading(false);
        }
      } catch (err) {
        setError('Network connectivity error. Unable to verify referral data.');
        setLoading(false);
      }
    };

    fetchLeadAndRedirect();
  }, [urn]);

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '2rem' }}>
        <div className="glass-panel" style={{ maxWidth: '450px', textAlign: 'center', borderTop: '4px solid var(--err)' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', color: 'var(--err)' }}>Redirection Error</h2>
          <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{error}</p>
          <a href="/" className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}>Go to Homepage</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
      <div className="glass-panel" style={{ maxWidth: '400px', padding: '2rem' }}>
        <div className="splash-loader" style={{ margin: '0 auto 1.25rem auto' }}></div>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Verifying Application Referral</h3>
        <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.8rem' }}>
          {leadDetails 
            ? `Referral valid. Safely redirecting ${leadDetails.full_name} to HDFC portal...` 
            : 'Locating secure banking endpoint...'}
        </p>
      </div>
    </div>
  );
}
