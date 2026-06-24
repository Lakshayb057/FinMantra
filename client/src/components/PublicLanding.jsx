import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Zap, HelpCircle, ArrowRight, X, Clock, RefreshCw, Layers } from 'lucide-react';

export default function PublicLanding({ navigateTo, utmParams }) {
  const getCategoryColor = (cat) => {
    switch (cat?.toLowerCase()) {
      case 'premium':
        return '#d4af37'; // Luxury Gold
      case 'rewards':
        return '#3b82f6'; // Trust Blue
      case 'travel':
        return '#8b5cf6'; // Royal Purple
      case 'cashback':
        return '#10b981'; // Emerald Green
      case 'shopping':
        return '#f43f5e'; // Bright Rose/Pink
      case 'digital':
        return '#06b6d4'; // Cyber Cyan
      default:
        return '#6366f1'; // Indigo
    }
  };

  const [cards, setCards] = useState([]);
  const [locations, setLocations] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    city: '',
    employment: 'Salaried',
    income: 'Below ₹25,000',
    selectedCard: ''
  });

  // OTP State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpVal, setOtpVal] = useState('');
  const [otpStatus, setOtpStatus] = useState('');
  const [simulatedOtpText, setSimulatedOtpText] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Resume Session State
  const [resumeSession, setResumeSession] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Canvas Animation Reference
  const canvasRef = useRef(null);

  // API base URL
  const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';

  // Load initial cards, locations, settings
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cardsRes, locsRes, settingsRes] = await Promise.all([
          fetch(`${API_URL}/cards`),
          fetch(`${API_URL}/locations`),
          fetch(`${API_URL}/settings`)
        ]);

        const cardsData = await cardsRes.json();
        const locsData = await locsRes.json();
        const settingsData = await settingsRes.json();

        setCards(cardsData);
        setLocations(locsData.filter(l => l.active));
        setSettings(settingsData);
        
        if (cardsData.length > 0) {
          setFormData(prev => ({ ...prev, selectedCard: cardsData[0].id }));
        }
      } catch (err) {
        console.error('Error fetching landing page data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Check for previous session in sessionStorage to offer resumption
    const lastSession = sessionStorage.getItem('finmantra_applied_lead');
    if (lastSession) {
      setResumeSession(JSON.parse(lastSession));
    }
  }, []);



  // OTP Resend Timer
  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer(t => t - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [resendTimer]);

  // Interactive Particle Canvas in Hero (3D Money & Card Floating)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle Classes
    class Particle {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * -100 - 20;
        this.size = Math.random() * 8 + 4;
        this.speedY = Math.random() * 1.5 + 0.8;
        this.speedX = Math.random() * 0.8 - 0.4;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;
        this.opacity = Math.random() * 0.5 + 0.3;
        // 0: Money Bills, 1: Glowing Sparkles, 2: Credit Card Outlines
        this.type = Math.floor(Math.random() * 3);
        this.color = this.type === 0 ? 'hsla(145, 80%, 45%, ' : 
                     this.type === 1 ? 'hsla(42, 95%, 55%, ' : 'hsla(250, 85%, 65%, ';
      }

      update() {
        this.y += this.speedY;
        this.x += this.speedX;
        this.rotation += this.rotationSpeed;

        if (this.y > height) {
          this.reset();
        }
      }

      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.opacity;

        if (this.type === 0) {
          // Bill Shape
          ctx.fillStyle = hslToRgbStr(145, 80, 45, this.opacity);
          ctx.fillRect(-this.size * 1.5, -this.size * 0.8, this.size * 3, this.size * 1.6);
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.lineWidth = 1;
          ctx.strokeRect(-this.size * 1.5, -this.size * 0.8, this.size * 3, this.size * 1.6);
        } else if (this.type === 1) {
          // Star/Sparkle Shape
          ctx.fillStyle = hslToRgbStr(42, 95, 55, this.opacity);
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            ctx.lineTo(0, -this.size);
            ctx.lineTo(this.size * 0.3, -this.size * 0.3);
            ctx.rotate(Math.PI / 2);
          }
          ctx.closePath();
          ctx.fill();
        } else {
          // Credit Card Shape
          ctx.strokeStyle = hslToRgbStr(250, 85, 65, this.opacity);
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-this.size * 1.8, -this.size * 1.1, this.size * 3.6, this.size * 2.2);
          // Draw small chip
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.fillRect(-this.size * 1.2, -this.size * 0.5, this.size * 0.6, this.size * 0.5);
        }

        ctx.restore();
      }
    }

    // Helper HSL convertor
    function hslToRgbStr(h, s, l, a) {
      return `hsla(${h}, ${s}%, ${l}%, ${a})`;
    }

    const particles = Array.from({ length: 45 }, () => new Particle());

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // 3D Card Hover / Tilt Effect Logic
  const handleMouseMove = (e, cardId) => {
    const cardEl = e.currentTarget;
    const rect = cardEl.getBoundingClientRect();
    const x = e.clientX - rect.left; // x position inside element
    const y = e.clientY - rect.top;  // y position inside element
    
    // Calculate rotation limits (-15 to 15 deg)
    const rx = ((y / rect.height) - 0.5) * -20;
    const ry = ((x / rect.width) - 0.5) * 20;
    
    cardEl.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateY(-8px)`;
  };

  const handleMouseLeave = (e) => {
    const cardEl = e.currentTarget;
    cardEl.style.transform = 'rotateX(0deg) rotateY(0deg) translateY(0px)';
  };

  // Form Input Change Handler
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Pre-fill form when user selects a card from the grid
  const selectCardFromGrid = (cardId) => {
    setFormData(prev => ({ ...prev, selectedCard: cardId }));
    const formElement = document.getElementById('apply-form-section');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Form Submission & Verification
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const { fullName, phone, email } = formData;

    if (!fullName || !phone || !email) {
      setFormError('Please fill in all details before submitting.');
      return;
    }

    if (phone.length !== 10 || !/^\d+$/.test(phone)) {
      setFormError('Please enter a valid 10-digit WhatsApp number.');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setFormError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Trigger WhatsApp OTP
      const res = await fetch(`${API_URL}/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();

      if (res.ok) {
        setShowOtpModal(true);
        setOtpStatus('');
        setResendTimer(30);
        if (data.simulatedOtp) {
          // If simulation mode, tell user the OTP
          setSimulatedOtpText(data.simulatedOtp);
        } else {
          setSimulatedOtpText('');
        }
      } else {
        setFormError(data.error || 'Failed to send verification code. Please try again.');
      }
    } catch (err) {
      setFormError('Network error. Unable to contact verification servers.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verify OTP & Save Lead
  const handleVerifyOtp = async () => {
    setOtpStatus('Verifying...');
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.phone, otp: otpVal })
      });
      const data = await res.json();

      if (res.ok) {
        setOtpStatus('Verified! Registering lead...');
        
        // Save the lead now
        const leadRes = await fetch(`${API_URL}/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: formData.fullName,
            phone: formData.phone,
            email: formData.email,
            source: 'public',
            consent: true,
            utm_source: utmParams?.utm_source || null,
            utm_info: utmParams?.utm_info || null,
            utm_params: utmParams || null
          })
        });

        const leadData = await leadRes.json();
        
        if (leadRes.ok) {
          setOtpStatus('Success! Redirecting to secure bank portal...');
          
          // Cache in session storage for back button resumption
          const cacheData = {
            name: formData.fullName,
            urm: leadData.urm,
            redirectUrl: leadData.redirectUrl,
            cardName: 'FinMantra Card Redirect',
            bank: 'Partner Bank',
            timestamp: new Date().getTime()
          };
          
          sessionStorage.setItem('finmantra_applied_lead', JSON.stringify(cacheData));
          
          setTimeout(() => {
            setShowOtpModal(false);
            window.location.href = leadData.redirectUrl;
          }, 2000);
        } else {
          setOtpStatus(`Registration failed: ${leadData.error}`);
          setIsSubmitting(false);
        }
      } else {
        setOtpStatus(`Verification failed: ${data.error}`);
        setIsSubmitting(false);
      }
    } catch (err) {
      setOtpStatus('Verification error. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendTimer > 0 || isSubmitting) return;
    setOtpStatus('Sending new OTP...');
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.phone })
      });
      const data = await res.json();
      if (res.ok) {
        setOtpStatus('New OTP sent.');
        setResendTimer(30);
        if (data.simulatedOtp) {
          setSimulatedOtpText(data.simulatedOtp);
        }
      } else {
        setOtpStatus(`Resend failed: ${data.error}`);
      }
    } catch (err) {
      setOtpStatus('Resend error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resume Pending Application
  const handleResumeRedirect = () => {
    if (resumeSession) {
      window.location.href = resumeSession.redirectUrl;
    }
  };

  // Cancel Resume Session View
  const handleClearResume = () => {
    sessionStorage.removeItem('finmantra_applied_lead');
    setResumeSession(null);
  };

  return (
    <div style={{ position: 'relative' }}>
      
      {/* 3D Money rain Canvas on Hero Area */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '550px', zIndex: 0, pointerEvents: 'none', opacity: 0.8 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}></canvas>
      </div>

      {/* Hero section */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 440px', gap: '48px', padding: '60px 8% 72px 8%', position: 'relative', zIndex: 1, alignItems: 'start' }} className="hero-section">
        {/* Left Side Pitch */}
        <div style={{ paddingTop: '20px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--gold-deep)', marginBottom: '18px', fontWeight: 700 }}>
            Credit Cards • India
          </div>
          <h1 style={{ fontSize: 'clamp(2.3rem, 4.6vw, 3.5rem)', fontWeight: 800, marginBottom: '18px', color: 'var(--ink)' }}>
            Get the right credit card.<br />
            <span style={{ color: 'var(--gold-deep)' }}>Apply in minutes.</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1.14rem', marginBottom: '28px', maxWidth: '38ch' }}>
            Compare top cards, pick the one that fits how you spend, and apply online — free.
          </p>

          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '30px', padding: 0 }}>
            <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', fontWeight: 600, fontSize: '1.02rem', color: 'var(--ink)' }}>
              <span style={{ flex: '0 0 auto', width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(22, 163, 123, 0.15)', color: 'var(--mint)', display: 'grid', placeItems: 'center', fontSize: '0.8rem', fontWeight: 700, marginTop: '1px' }}>✓</span>
              Top credit cards, all in one place
            </li>
            <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', fontWeight: 600, fontSize: '1.02rem', color: 'var(--ink)' }}>
              <span style={{ flex: '0 0 auto', width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(22, 163, 123, 0.15)', color: 'var(--mint)', display: 'grid', placeItems: 'center', fontSize: '0.8rem', fontWeight: 700, marginTop: '1px' }}>✓</span>
              100% online & paperless
            </li>
            <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', fontWeight: 600, fontSize: '1.02rem', color: 'var(--ink)' }}>
              <span style={{ flex: '0 0 auto', width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(22, 163, 123, 0.15)', color: 'var(--mint)', display: 'grid', placeItems: 'center', fontSize: '0.8rem', fontWeight: 700, marginTop: '1px' }}>✓</span>
              No charges — ever
            </li>
            <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', fontWeight: 600, fontSize: '1.02rem', color: 'var(--ink)' }}>
              <span style={{ flex: '0 0 auto', width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(22, 163, 123, 0.15)', color: 'var(--mint)', display: 'grid', placeItems: 'center', fontSize: '0.8rem', fontWeight: 700, marginTop: '1px' }}>✓</span>
              Quick, secure application
            </li>
          </ul>

          <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', paddingTop: '20px', borderTop: '1px solid var(--line)' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 800, display: 'block', lineHeight: 1, color: 'var(--ink)' }}>8+</span>
              <small style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>cards to choose</small>
            </div>
            <div>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 800, display: 'block', lineHeight: 1, color: 'var(--ink)' }}>5 min</span>
              <small style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>to apply</small>
            </div>
            <div>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 800, display: 'block', lineHeight: 1, color: 'var(--ink)' }}>₹0</span>
              <small style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>to use</small>
            </div>
          </div>
        </div>

        {/* Right Side Form Card */}
        <div id="apply-form-section" className="glass-panel" style={{ position: 'sticky', top: '24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink)' }}>Apply in 2 minutes</h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.94rem', marginTop: '4px' }}>
              Fill in your details and we'll take you to the bank to finish.
            </p>
          </div>

          {resumeSession && (
            <div style={{ background: 'hsla(40, 75%, 52%, 0.08)', border: '1px solid rgba(224, 168, 46, 0.15)', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginBottom: '1rem', position: 'relative' }}>
              <button onClick={handleClearResume} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', color: 'var(--ink)', cursor: 'pointer' }}>
                <X size={14} />
              </button>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 500 }}>
                We detected a previous unfinished session:
              </div>
              <div style={{ fontWeight: 700, margin: '0.15rem 0 0.35rem 0', color: 'var(--gold-deep)' }}>
                {resumeSession.name}'s {resumeSession.cardName} ({resumeSession.urm})
              </div>
              <button onClick={handleResumeRedirect} className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', width: 'auto' }}>
                Resume Application <ArrowRight size={12} />
              </button>
            </div>
          )}
          <form onSubmit={handleFormSubmit}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--ink)' }}>Name as per Govt. ID</label>
              <input 
                type="text" 
                name="fullName" 
                className="form-input" 
                placeholder="As per your ID"
                value={formData.fullName}
                onChange={handleInputChange} 
                required
                disabled={isSubmitting}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--ink)' }}>WhatsApp number</label>
              <input 
                type="tel" 
                name="phone" 
                className="form-input" 
                placeholder="10-digit mobile"
                maxLength="10"
                value={formData.phone}
                onChange={handleInputChange} 
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--ink)' }}>Email address</label>
              <input 
                type="email" 
                name="email" 
                className="form-input" 
                placeholder="e.g. name@example.com"
                value={formData.email}
                onChange={handleInputChange} 
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="consent" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', margin: '6px 0 16px' }}>
              <input type="checkbox" id="consent" required disabled={isSubmitting} style={{ marginTop: '3px', flex: '0 0 auto', width: '18px', height: '18px', accentColor: 'var(--gold)' }} />
              <label htmlFor="consent" style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5, cursor: 'pointer' }}>
                {settings.consent_text || 'I authorise FinMantra and its partner banks to contact me via call, SMS, WhatsApp and email about credit card offers, even if I\'m registered under DND/NDNC.'}{' '}
                I've read the <a href={settings.terms_link || '#'} target="_blank" rel="noreferrer" style={{ color: 'var(--gold-deep)', textDecoration: 'underline' }}>Terms</a> & <a href={settings.privacy_link || '#'} target="_blank" rel="noreferrer" style={{ color: 'var(--gold-deep)', textDecoration: 'underline' }}>Privacy Policy</a>.
              </label>
            </div>

            {formError && (
              <div style={{ background: 'rgba(209, 67, 67, 0.1)', border: '1px solid rgba(209, 67, 67, 0.2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', color: 'var(--err)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {formError}
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={isSubmitting}>
              {isSubmitting ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  Processing... <RefreshCw size={18} className="animate-spin" />
                </span>
              ) : (
                <>
                  Verify & Apply Now <ArrowRight size={18} />
                </>
              )}
            </button>

            <div className="securenote" style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--muted)', marginTop: '12px', display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
              <span>✓ No hidden charges</span>
              <span>•</span>
              <span>✓ 100% paperless & secure</span>
            </div>
          </form>
        </div>
      </section>

      {/* Dark Horizontal Badge Strip */}
      <div style={{ background: 'var(--ink)', padding: '1.2rem 8%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4rem', flexWrap: 'wrap', zIndex: 2, position: 'relative' }}>
        <div style={{ color: '#ffffff', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--gold)' }}>✓</span> Cards from India's leading banks
        </div>
        <div style={{ color: '#ffffff', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--gold)' }}>✓</span> No hidden charges
        </div>
        <div style={{ color: '#ffffff', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--gold)' }}>✓</span> Secure & paperless
        </div>
      </div>

      {/* How it works */}
      <section style={{ padding: '6rem 8% 5rem 8%', position: 'relative', zIndex: 1, backgroundColor: 'var(--paper)' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold-deep)', marginBottom: '0.5rem', fontWeight: 700 }}>
            HOW IT WORKS
          </div>
          <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-heading)' }}>Three steps. That's it.</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2.5rem' }} className="how-it-works-grid">
          {/* Step 1 */}
          <div className="glass-card" style={{ background: 'var(--white)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '3.5rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'var(--transition-smooth)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '3rem', fontWeight: 800, color: 'var(--gold)', marginBottom: '1rem', lineHeight: 1 }}>01</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '0.75rem', fontFamily: 'var(--font-heading)' }}>Fill the form</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.92rem', lineHeight: 1.5 }}>A few quick details — takes about two minutes.</p>
          </div>

          {/* Step 2 */}
          <div className="glass-card" style={{ background: 'var(--white)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '3.5rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'var(--transition-smooth)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '3rem', fontWeight: 800, color: 'var(--gold)', marginBottom: '1rem', lineHeight: 1 }}>02</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '0.75rem', fontFamily: 'var(--font-heading)' }}>Pick your card</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.92rem', lineHeight: 1.5 }}>Choose the card that fits how you spend.</p>
          </div>

          {/* Step 3 */}
          <div className="glass-card" style={{ background: 'var(--white)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '3.5rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'var(--transition-smooth)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '3rem', fontWeight: 800, color: 'var(--gold)', marginBottom: '1rem', lineHeight: 1 }}>03</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '0.75rem', fontFamily: 'var(--font-heading)' }}>Apply online</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.92rem', lineHeight: 1.5 }}>Finish on the bank's secure page. They handle approval.</p>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section style={{ padding: '5rem 8%', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold-deep)', marginBottom: '0.5rem', fontWeight: 700 }}>
            FAQ
          </div>
          <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-heading)' }}>Good to know.</h2>
        </div>

        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
          <FaqItem 
            question="Is this free?" 
            answer="Yes, 100% free! FinMantra is an authorised referral partner of top banks and we do not charge customers for any comparisons, filters, or registration processes. Ever."
          />
          <FaqItem 
            question="Who approves my card?" 
            answer="Final approval, credit limit configuration, and card terms are governed at the sole discretion of the issuing bank (such as HDFC, ICICI, etc.). We help you select and fill the details before securely handing over to the bank."
          />
          <FaqItem 
            question="What happens after I submit?" 
            answer="Upon entering and verifying your details via WhatsApp OTP, we immediately route you to the bank's secure application endpoint, passing your tracking ID so the bank recognizes your referral. They will perform a final review and dispatch the card."
          />
          <FaqItem 
            question="Is my data safe?" 
            answer="Absolutely. We take security extremely seriously. All applications are paperless and transmitted via HTTPS encrypted connections. Your telephone number and details are used solely to facilitate the card application transaction."
          />
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '4.5rem 8% 3rem 8%', background: 'var(--ink)', position: 'relative', zIndex: 1, color: '#ffffff' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--gold)', boxShadow: '0 0 0 4px rgba(224, 168, 46, 0.22)' }}></span>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.03em', color: '#ffffff' }}>FinMantra</span>
        </div>

        {/* Disclaimer text */}
        <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', lineHeight: 1.7, marginBottom: '2.5rem', textAlign: 'justify', maxWidth: '100%' }}>
          FinMantra is an authorised marketing and referral partner of its partner banks. We are not a bank, lender or card issuer, and we do not charge customers for our services. Card features, fees and rewards are indicative and subject to the bank's current terms. Approval, credit limit and final terms are at the sole discretion of the respective bank. Please borrow responsibly.
        </div>

        {/* Links row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.4)' }}>
          <span>© 2026 FinMantra</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.25)' }}>·</span>
          <a href={settings.privacy_link || '#'} style={{ color: 'rgba(255, 255, 255, 0.5)', textDecoration: 'none', fontWeight: 500 }} onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'} onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'}>Privacy Policy</a>
          <span style={{ color: 'rgba(255, 255, 255, 0.25)' }}>·</span>
          <a href={settings.terms_link || '#'} style={{ color: 'rgba(255, 255, 255, 0.5)', textDecoration: 'none', fontWeight: 500 }} onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'} onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'}>Terms & Conditions</a>
          <span style={{ color: 'rgba(255, 255, 255, 0.25)' }}>·</span>
          <a href="#" style={{ color: 'rgba(255, 255, 255, 0.5)', textDecoration: 'none', fontWeight: 500 }} onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'} onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'}>Contact</a>
        </div>
      </footer>

      {/* WhatsApp OTP Verification Modal */}
      {showOtpModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '450px', position: 'relative', textAlign: 'center', borderTop: '4px solid var(--gold)' }}>
            <button onClick={() => setShowOtpModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer' }}>
              <X size={20} />
            </button>

            <div style={{ width: '60px', height: '60px', background: 'rgba(224, 168, 46, 0.15)', color: 'var(--gold-deep)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <Clock size={32} />
            </div>

            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>WhatsApp OTP Verification</h3>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              We've sent a 6-digit OTP verification code to <strong style={{ color: 'hsl(var(--primary))' }}>+91 {formData.phone}</strong> via WhatsApp.
            </p>

            {simulatedOtpText && (
              <div style={{ background: 'hsla(42, 95%, 55%, 0.1)', border: '1px solid hsla(42, 95%, 55%, 0.2)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                <div style={{ color: 'hsl(var(--accent-gold))', fontWeight: 600, marginBottom: '0.25rem' }}>🛠️ Developer Simulation Mode</div>
                <div>Your OTP verification code is: <strong style={{ fontSize: '1.1rem', letterSpacing: '2px', color: 'hsl(var(--text-primary))' }}>{simulatedOtpText}</strong></div>
              </div>
            )}

            <div className="form-group" style={{ maxWidth: '240px', margin: '0 auto 1.5rem auto' }}>
              <input 
                type="text" 
                maxLength="6" 
                placeholder="Enter 6-digit OTP" 
                value={otpVal} 
                onChange={(e) => setOtpVal(e.target.value)}
                style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '1.5rem', fontWeight: 800 }}
                className="form-input" 
                disabled={isSubmitting}
              />
            </div>

            {otpStatus && (
              <div style={{ color: otpStatus.includes('Success') || otpStatus.includes('Verified') ? 'var(--mint)' : 'var(--gold-deep)', fontSize: '0.9rem', marginBottom: '1.5rem', fontWeight: 500 }}>
                {otpStatus}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button onClick={handleVerifyOtp} className="btn-primary" style={{ flex: 1, padding: '0.75rem' }} disabled={isSubmitting}>
                {isSubmitting ? 'Verifying...' : 'Verify OTP'}
              </button>
              <button 
                onClick={handleResendOtp} 
                disabled={resendTimer > 0 || isSubmitting} 
                className="btn-secondary" 
                style={{ flex: 1, padding: '0.75rem', fontSize: '0.9rem', color: (resendTimer > 0 || isSubmitting) ? 'hsl(var(--text-muted))' : 'hsl(var(--text-primary))' }}
              >
                {resendTimer > 0 ? `Resend (${resendTimer}s)` : 'Resend OTP'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Collapsible FAQ item sub-component
function FaqItem({ question, answer }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div 
      onClick={() => setIsOpen(!isOpen)}
      style={{ 
        cursor: 'pointer', 
        transition: 'var(--transition-fast)',
        borderBottom: '1px solid var(--line)',
        padding: '1.4rem 0.5rem'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-heading)' }}>{question}</h4>
        <span style={{ color: 'var(--gold)', fontSize: '1.5rem', fontWeight: 600, transition: 'transform 0.2s', transform: isOpen ? 'rotate(45deg)' : 'none', display: 'inline-block', lineHeight: 1 }}>+</span>
      </div>
      {isOpen && (
        <div style={{ marginTop: '0.9rem', color: 'var(--muted)', fontSize: '0.96rem', lineHeight: 1.6 }}>
          {answer}
        </div>
      )}
    </div>
  );
}
