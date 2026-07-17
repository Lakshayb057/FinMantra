import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import PublicLanding from './components/PublicLanding';
import AgentPortal from './components/AgentPortal';
import AdminDashboard from './components/AdminDashboard';
import AboutPage from './components/AboutPage';
import ContactPage from './components/ContactPage';
import PrivacyPolicyPage from './components/PrivacyPolicyPage';
import TermsPage from './components/TermsPage';
import KiwiLanding from './components/KiwiLanding';
import { resolveRedirectUrl } from './utils/analytics';
// Cookie helper functions
function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + encodeURIComponent(value || "") + expires + "; path=/; SameSite=Lax";
}

function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [theme, setTheme] = useState(localStorage.getItem('finmantra_theme') || 'light');
  
  useEffect(() => {
    if (currentPath.startsWith('/kiwi')) {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('finmantra_theme', theme);
  }, [theme, currentPath]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

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

    // 1. Process Google Click ID (gclid) persistence
    const urlGclid = searchParams.get('gclid');
    if (urlGclid) {
      setCookie('gclid', urlGclid, 90);
      params.gclid = urlGclid;
    } else {
      const cookieGclid = getCookie('gclid');
      if (cookieGclid) {
        params.gclid = cookieGclid;
      }
    }

    // 2. Process Facebook Click ID (_fbc)
    const urlFbclid = searchParams.get('fbclid');
    if (urlFbclid) {
      const fbcVal = `fb.1.${Date.now()}.${urlFbclid}`;
      setCookie('_fbc', fbcVal, 90);
      params.fbclid = urlFbclid;
    } else {
      const cookieFbc = getCookie('_fbc');
      if (cookieFbc) {
        const parts = cookieFbc.split('.');
        const cookieFbclid = parts[parts.length - 1];
        if (cookieFbclid) {
          params.fbclid = cookieFbclid;
        }
      }
    }

    // 3. Process Facebook Browser ID (_fbp)
    let fbpVal = getCookie('_fbp');
    if (!fbpVal) {
      fbpVal = `fb.1.${Date.now()}.${Math.floor(Math.random() * 2000000000)}`;
      setCookie('_fbp', fbpVal, 730); // 2 years
    }
    // Expose _fbp to tracking params if needed
    params._fbp = fbpVal;
    if (params.fbclid) {
      params._fbc = getCookie('_fbc') || `fb.1.${Date.now()}.${params.fbclid}`;
    }

    // Capture landing page, first landing page, and referrer
    params.landing_page = window.location.href;
    
    let firstLanding = sessionStorage.getItem('finmantra_first_landing_page') || localStorage.getItem('finmantra_first_landing_page');
    if (!firstLanding) {
      firstLanding = window.location.href;
      sessionStorage.setItem('finmantra_first_landing_page', firstLanding);
      localStorage.setItem('finmantra_first_landing_page', firstLanding);
    }
    params.first_landing_page = firstLanding;

    let referrerVal = sessionStorage.getItem('finmantra_referrer') || localStorage.getItem('finmantra_referrer');
    if (!referrerVal) {
      referrerVal = document.referrer || 'Direct';
      sessionStorage.setItem('finmantra_referrer', referrerVal);
      localStorage.setItem('finmantra_referrer', referrerVal);
    }
    params.referrer = referrerVal;

    // 4. Parse path-based UTM parameters if present (e.g. /kiwi/utm_source=val&utm_medium=val)
    const path = window.location.pathname;
    if (path.startsWith('/kiwi/')) {
      const rest = path.substring(6); // everything after "/kiwi/"
      if (rest.includes('=')) {
        const pairs = rest.split('&');
        pairs.forEach(pair => {
          const [k, v] = pair.split('=');
          if (k && v) {
            params[k.trim()] = decodeURIComponent(v.trim());
          }
        });
      }
    }

    // Explicitly guarantee utm_source and standard code usage fields exist
    if (!params.utm_source) params.utm_source = searchParams.get('utm_source') || '';
    if (!params.utm_medium) params.utm_medium = searchParams.get('utm_medium') || searchParams.get('utm_medem') || '';
    if (!params.utm_info) params.utm_info = searchParams.get('utm_info') || params.utm_medium || '';
    if (!params.utm_device) params.utm_device = searchParams.get('utm_device') || searchParams.get('device') || '';
    if (!params.utm_location) params.utm_location = searchParams.get('utm_location') || searchParams.get('location') || '';
    if (!params.ad_id) params.ad_id = searchParams.get('utm_creative') || searchParams.get('ad_id') || '';
    if (!params.utm_internal) params.utm_internal = searchParams.get('utm_internal') || '';

    // Merge URL params with cached params if any, prioritizing URL parameters
    const cachedStr = sessionStorage.getItem('finmantra_utm');
    const cachedParams = cachedStr ? JSON.parse(cachedStr) : {};
    
    const mergedParams = {
      ...cachedParams,
      ...params
    };

    setUtmParams(mergedParams);
    sessionStorage.setItem('finmantra_utm', JSON.stringify(mergedParams));
  }, []);

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Route Dispatcher
  const renderView = () => {
    const pathParts = currentPath.split('/');
    if (pathParts[1] === 'refer') {
      const activeParts = pathParts.filter(Boolean);
      const urn = activeParts[activeParts.length - 1];
      return <ReferralRedirect urn={urn} />;
    }
    if (pathParts[1] === 'kiwi') {
      return <KiwiLanding navigateTo={navigateTo} utmParams={utmParams} />;
    }
    if (currentPath === '/agent') {
      return <AgentPortal navigateTo={navigateTo} theme={theme} toggleTheme={toggleTheme} />;
    }
    if (currentPath === '/admin') {
      return <AdminDashboard navigateTo={navigateTo} theme={theme} toggleTheme={toggleTheme} />;
    }
    if (currentPath === '/about') {
      return <AboutPage navigateTo={navigateTo} />;
    }
    if (currentPath === '/contact') {
      return <ContactPage navigateTo={navigateTo} />;
    }
    if (currentPath === '/privacy-policy') {
      return <PrivacyPolicyPage navigateTo={navigateTo} />;
    }
    if (currentPath === '/terms') {
      return <TermsPage navigateTo={navigateTo} />;
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

      {/* Header / Navbar - Hide on admin, agent portals, and kiwi pages to avoid duplicates */}
      {currentPath !== '/admin' && currentPath !== '/agent' && !currentPath.startsWith('/kiwi') && (
        <header className="navbar">
          <div className="nav-logo" onClick={() => navigateTo('/')} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
            <img src="/logo.jpg" alt="FinMantra Logo" style={{ height: '44px', width: '44px', borderRadius: '10px', objectFit: 'cover', boxShadow: '0 3px 10px rgba(224, 168, 46, 0.3)' }} />
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.45rem', letterSpacing: '-0.03em' }}>FinMantra</span>
          </div>
          <nav className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
            <button 
              className="theme-toggle-btn" 
              onClick={toggleTheme} 
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              style={{ padding: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </nav>
        </header>
      )}

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
        const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173') ? 'http://localhost:5000/api' : '/api';
        const res = await fetch(`${API_URL}/leads/urn/${urn}`);
        const data = await res.json();

        if (res.ok) {
          // Singular link resolution for non-Android/desktop environments
          let navUrl = data.redirectUrl;
          const isDesktop = /Windows|Macintosh|MacIntel|Linux x86_64/i.test(navigator.userAgent || '') || 
                            /Win32|MacIntel|Win64/i.test(navigator.platform || '');
          const isAndroid = /Android/i.test(navigator.userAgent || '');

          if ((isDesktop || !isAndroid) && navUrl && navUrl.includes('sng.link')) {
            try {
              const resolveRes = await fetch(`${API_URL}/resolve-singular?url=${encodeURIComponent(navUrl)}`);
              const resolveData = await resolveRes.json();
              if (resolveRes.ok && resolveData.resolvedUrl) {
                navUrl = resolveData.resolvedUrl;
              }
            } catch (resolveErr) {
              console.error('[Referral Redirect] Server-side resolution failed:', resolveErr);
            }
          }

          // Fallback intent:// resolution
          if (navUrl && String(navUrl).startsWith('intent://')) {
            const m = String(navUrl).match(/S\.browser_fallback_url=([^;]+)/);
            if (m && m[1]) { try { navUrl = decodeURIComponent(m[1]); } catch(e){} }
          }
          window.location.replace(navUrl);
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
