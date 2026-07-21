import React, { useState, useEffect, useRef } from 'react';
import { Camera, Smartphone, Users, CreditCard, Check, Shield } from 'lucide-react';

const phases = [
  {
    phase: "Phase 1",
    title: "Omnichannel Lead Capture",
    description: "FinMantra Lead Capture routes physical airport walk-ins, kiosk entries, and online promo landings smoothly. Instantly aggregates omnichannel data checkpoints with zero latency.",
    stepLabel: "Capture",
    icon: Camera
  },
  {
    phase: "Phase 2",
    title: "2-Factor Verification",
    description: "Instantly verifies active customer mobile numbers via SMS OTP API gateway checkouts to prevent junk leads and ensure real-time verification of phone accessibility.",
    stepLabel: "OTP",
    icon: Smartphone
  },
  {
    phase: "Phase 3",
    title: "Dynamic Routing & Distribution",
    description: "Generates active device-specific links, attaching exact attribution tags like UTM sources and Google Ads Click IDs (gclid) for real-time marketing attribution audits.",
    stepLabel: "Assign",
    icon: Users
  },
  {
    phase: "Phase 4",
    title: "Bank MIS Settlement",
    description: "Parses uploaded bank settlement logs, auto-verifying and matching customer reference codes with payout logs to achieve end-to-end reconciliation.",
    stepLabel: "Apply",
    icon: CreditCard
  }
];

export default function LoginGraphics() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  // Auto-play cycling logic
  useEffect(() => {
    if (!isPaused) {
      timerRef.current = setInterval(() => {
        setActiveStep((prev) => (prev + 1) % phases.length);
      }, 5000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused]);

  const handleStepClick = (index) => {
    setActiveStep(index);
    setIsPaused(true); // Pause auto-play when user manually clicks
  };

  return (
    <div 
      className="login-graphics-panel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* ===== CINEMATIC BACKGROUND DECORATIONS ===== */}

      {/* Animated SVG Constellation/Network Grid */}
      <div className="constellation-bg">
        <svg className="constellation-svg" width="100%" height="100%">
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(224, 168, 46, 0.06)" />
              <stop offset="50%" stopColor="rgba(224, 168, 46, 0.22)" />
              <stop offset="100%" stopColor="rgba(224, 168, 46, 0.03)" />
            </linearGradient>
            <linearGradient id="lineGradBright" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(224, 168, 46, 0.12)" />
              <stop offset="50%" stopColor="rgba(224, 168, 46, 0.35)" />
              <stop offset="100%" stopColor="rgba(224, 168, 46, 0.08)" />
            </linearGradient>
            <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(224, 168, 46, 0.5)" />
              <stop offset="100%" stopColor="rgba(224, 168, 46, 0)" />
            </radialGradient>
          </defs>
          {/* Primary Connecting Lines */}
          <line className="network-line l1" x1="5%" y1="15%" x2="30%" y2="35%" stroke="url(#lineGrad)" strokeWidth="1.2" />
          <line className="network-line l2" x1="30%" y1="35%" x2="70%" y2="18%" stroke="url(#lineGrad)" strokeWidth="1.2" />
          <line className="network-line l3" x1="30%" y1="35%" x2="45%" y2="80%" stroke="url(#lineGrad)" strokeWidth="1.2" />
          <line className="network-line l4" x1="70%" y1="18%" x2="92%" y2="55%" stroke="url(#lineGrad)" strokeWidth="1.2" />
          <line className="network-line l5" x1="45%" y1="80%" x2="92%" y2="55%" stroke="url(#lineGrad)" strokeWidth="1.2" />
          {/* Secondary Fine Lines */}
          <line className="network-line l6" x1="15%" y1="60%" x2="30%" y2="35%" stroke="url(#lineGrad)" strokeWidth="0.8" />
          <line className="network-line l7" x1="70%" y1="18%" x2="85%" y2="8%" stroke="url(#lineGrad)" strokeWidth="0.8" />
          <line className="network-line l8" x1="92%" y1="55%" x2="95%" y2="85%" stroke="url(#lineGrad)" strokeWidth="0.8" />
          <line className="network-line l9" x1="55%" y1="10%" x2="70%" y2="18%" stroke="url(#lineGradBright)" strokeWidth="1" />
          <line className="network-line l10" x1="5%" y1="85%" x2="45%" y2="80%" stroke="url(#lineGrad)" strokeWidth="0.8" />

          {/* Network Nodes with Glow */}
          <circle className="network-node n1" cx="5%" cy="15%" r="3.5" fill="var(--gold)" />
          <circle className="network-node n2" cx="30%" cy="35%" r="5" fill="var(--gold-deep)" />
          <circle className="network-node n3" cx="70%" cy="18%" r="4.5" fill="var(--gold)" />
          <circle className="network-node n4" cx="45%" cy="80%" r="4" fill="var(--gold)" />
          <circle className="network-node n5" cx="92%" cy="55%" r="4" fill="var(--gold-deep)" />
          <circle className="network-node n6" cx="15%" cy="60%" r="3" fill="var(--gold)" />
          <circle className="network-node n7" cx="85%" cy="8%" r="3" fill="var(--gold-deep)" />
          <circle className="network-node n8" cx="95%" cy="85%" r="2.5" fill="var(--gold)" />
          <circle className="network-node n9" cx="55%" cy="10%" r="3" fill="var(--gold)" />
          <circle className="network-node n10" cx="5%" cy="85%" r="2.5" fill="var(--gold)" />

          {/* Glow halos behind key nodes */}
          <circle cx="30%" cy="35%" r="14" fill="url(#nodeGlow)" className="node-halo" />
          <circle cx="70%" cy="18%" r="12" fill="url(#nodeGlow)" className="node-halo" />
          <circle cx="92%" cy="55%" r="10" fill="url(#nodeGlow)" className="node-halo" />
        </svg>
      </div>

      {/* 3D Gold Spheres (Photorealistic Radial Gradients) */}
      <div className="graphics-decorations">
        <div className="gold-sphere sphere-3d-1"></div>
        <div className="gold-sphere sphere-3d-2"></div>
        <div className="gold-sphere sphere-3d-3"></div>
        <div className="gold-sphere sphere-3d-4"></div>
        <div className="gold-sphere sphere-3d-5"></div>
        <div className="gold-sphere sphere-3d-6"></div>
        <div className="gold-sphere sphere-3d-7"></div>
        {/* Silver/Chrome Spheres */}
        <div className="silver-sphere silver-3d-1"></div>
        <div className="silver-sphere silver-3d-2"></div>
        <div className="silver-sphere silver-3d-3"></div>
      </div>

      {/* Sparkle/Diamond Decorations */}
      <div className="sparkles-container">
        <div className="sparkle sparkle-1">✦</div>
        <div className="sparkle sparkle-2">✦</div>
        <div className="sparkle sparkle-3">✦</div>
        <div className="sparkle sparkle-4">✦</div>
        <div className="sparkle sparkle-5">✦</div>
      </div>

      {/* Floating upwards particles */}
      <div className="particles-container">
        <span className="p-dot" style={{ left: '8%', animationDelay: '0s', animationDuration: '6s' }}></span>
        <span className="p-dot" style={{ left: '22%', animationDelay: '1.2s', animationDuration: '8s' }}></span>
        <span className="p-dot" style={{ left: '45%', animationDelay: '0.5s', animationDuration: '7s' }}></span>
        <span className="p-dot" style={{ left: '68%', animationDelay: '2.8s', animationDuration: '9s' }}></span>
        <span className="p-dot" style={{ left: '82%', animationDelay: '1.8s', animationDuration: '6.5s' }}></span>
        <span className="p-dot p-dot-lg" style={{ left: '35%', animationDelay: '3.5s', animationDuration: '10s' }}></span>
        <span className="p-dot p-dot-sm" style={{ left: '90%', animationDelay: '0.3s', animationDuration: '5.5s' }}></span>
      </div>

      {/* ===== STEPPER TIMELINE NAVIGATION ===== */}
      <div className="stepper-timeline-container">
        {/* Curved Arc Track */}
        <svg className="stepper-arc-svg" viewBox="0 0 680 60" preserveAspectRatio="none">
          <path
            className="stepper-arc-path-bg"
            d="M 24 45 Q 340 0 656 45"
            fill="none"
            stroke="rgba(224, 168, 46, 0.15)"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
          <path
            className="stepper-arc-path-fill"
            d="M 24 45 Q 340 0 656 45"
            fill="none"
            stroke="var(--gold)"
            strokeWidth="2.5"
            strokeDasharray="6 4"
            style={{
              clipPath: `inset(0 ${100 - (activeStep / (phases.length - 1)) * 100}% 0 0)`
            }}
          />
        </svg>

        {/* Stepper Nodes */}
        <div className="stepper-nodes-row">
          {phases.map((p, idx) => {
            const Icon = p.icon;
            const isActive = idx === activeStep;
            const isCompleted = idx < activeStep;
            return (
              <button 
                key={p.phase} 
                className={`stepper-button-node ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                onClick={() => handleStepClick(idx)}
                title={`Go to ${p.title}`}
              >
                <div className="stepper-circle-icon">
                  <Icon size={18} />
                  {isActive && <div className="stepper-glow-ring"></div>}
                </div>
                <span className="stepper-node-text">{p.stepLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== MAIN DISPLAY CARD WITH 3D STAGE ===== */}
      <div className="stage-and-card-wrapper">
        {/* Monitor Display Card */}
        <div className="monitor-display-card">
          {phases.map((p, idx) => {
            const isActive = idx === activeStep;
            return (
              <div 
                key={p.phase} 
                className={`monitor-slide-container ${isActive ? 'visible-slide' : 'hidden-slide'}`}
              >
                {/* Left text column */}
                <div className="monitor-slide-text">
                  <span className="phase-badge">{p.phase}</span>
                  <h3 className="phase-title">{p.title}</h3>
                  <p className="phase-description">{p.description}</p>
                </div>

                {/* Right interactive graphic mockup column */}
                <div className="monitor-slide-visual">
                  {idx === 0 && <Phase1Graphic />}
                  {idx === 1 && <Phase2Graphic />}
                  {idx === 2 && <Phase3Graphic />}
                  {idx === 3 && <Phase4Graphic />}
                </div>
              </div>
            );
          })}
          {/* Visual progress bar at bottom of card */}
          <div className="card-auto-loader">
            <div 
              className="card-auto-loader-bar"
              style={{ 
                width: isPaused ? '0%' : '100%',
                transition: isPaused ? 'none' : 'width 5s linear'
              }}
              key={activeStep} /* Triggers re-render/restart animation of the loader */
            ></div>
          </div>
        </div>

        {/* 3D Platform Stage / Podium */}
        <div className="stage-podium">
          <div className="stage-ellipse stage-ellipse-1"></div>
          <div className="stage-ellipse stage-ellipse-2"></div>
          <div className="stage-ellipse stage-ellipse-3"></div>
          <div className="stage-gold-rim"></div>
        </div>
      </div>

      {/* Bottom Branding info */}
      <div className="graphics-branding">
        <div className="branding-logo-row">
          <div className="branding-logo-circle">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L14.5 9H22L16 13.5L18.5 21L12 16.5L5.5 21L8 13.5L2 9H9.5L12 2Z" fill="var(--gold)" />
            </svg>
          </div>
          <div>
            <h4 className="branding-title">FinMantra Platform Flow</h4>
            <p className="branding-subtext">Managed by Chaos Design Private Limited</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Phase 1 Graphic: Browser Lead Capture Form mockup
function Phase1Graphic() {
  return (
    <div className="mockup-container p1-capture-mockup">
      <div className="browser-window-frame">
        <div className="browser-header-bar">
          <span className="dot dot-red"></span>
          <span className="dot dot-yellow"></span>
          <span className="dot dot-green"></span>
          <div className="browser-url-bar">finmantra.com/apply</div>
        </div>
        <div className="browser-body-content">
          <div className="mock-input-row animate-pulse-field">
            <span className="mock-input-label">Full Name</span>
            <div className="mock-input-box">
              <span className="mock-typing-text">Laks</span>
              <span className="cursor-blink">|</span>
            </div>
          </div>
          <div className="mock-input-row">
            <span className="mock-input-label">Mobile Number</span>
            <div className="mock-input-box"></div>
          </div>
          <div className="mock-submit-btn-wrapper">
            <div className="mock-submit-button">Submit Lead</div>
          </div>
          <div className="virtual-cursor-pointer"></div>
        </div>
      </div>
      {/* Floating FinMantra badge */}
      <div className="floating-platform-badge">
        <div className="platform-badge-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L14.5 9H22L16 13.5L18.5 21L12 16.5L5.5 21L8 13.5L2 9H9.5L12 2Z" fill="var(--gold)" />
          </svg>
        </div>
        <span className="platform-badge-text">FinMantra Platform Flow</span>
      </div>
    </div>
  );
}

// Phase 2 Graphic: SMS OTP Verification mockup with bank logos
function Phase2Graphic() {
  return (
    <div className="mockup-container p2-otp-mockup">
      <div className="smartphone-window-frame gold-phone">
        <div className="phone-earpiece"></div>
        <div className="phone-screen">
          <div className="phone-status-bar">
            <span>5G</span>
            <span>12:00 PM</span>
          </div>
          <div className="phone-inner-content">
            <div className="phone-app-header">
              <Shield size={16} className="phone-app-icon" />
              <span>2-Step Verification</span>
            </div>
            
            <div className="sms-otp-dialog">
              <h5 className="sms-otp-title">SMS OTP</h5>
              <div className="sms-otp-code">3545:317</div>
              <div className="sms-verified-badge">
                <Check size={10} className="check-icon" />
                <span>Verified</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Partner Bank Logos with Checkmarks */}
      <div className="floating-bank-logo sbi-floating">
        <span className="bank-logo-symbol sbi-blue"></span>
        <span className="bank-logo-text">SBI</span>
        <span className="bank-check-badge">✓</span>
      </div>
      <div className="floating-bank-logo hdfc-floating">
        <span className="bank-logo-symbol hdfc-blue"></span>
        <span className="bank-logo-text">HDFC</span>
        <span className="bank-check-badge">✓</span>
      </div>
      <div className="floating-bank-logo axis-floating">
        <span className="bank-logo-symbol axis-maroon"></span>
        <span className="bank-logo-text">AXIS</span>
        <span className="bank-check-badge">✓</span>
      </div>
      <div className="floating-bank-logo sms-eu-floating">
        <span className="bank-logo-symbol sms-green"></span>
        <span className="bank-logo-text">SMS GW</span>
      </div>

      {/* Connecting golden energy lines from phone to banks */}
      <svg className="phone-connect-svg" width="100%" height="100%">
        <path className="energy-line el-1" d="M 68 50 Q 100 30 135 20" fill="none" stroke="var(--gold)" strokeWidth="1.2" strokeDasharray="4 3" />
        <path className="energy-line el-2" d="M 68 80 Q 110 80 145 65" fill="none" stroke="var(--gold)" strokeWidth="1.2" strokeDasharray="4 3" />
        <path className="energy-line el-3" d="M 68 110 Q 100 120 140 115" fill="none" stroke="var(--gold)" strokeWidth="1.2" strokeDasharray="4 3" />
      </svg>
    </div>
  );
}

// Phase 3 Graphic: Dynamic Routing & Marketing Attribution
function Phase3Graphic() {
  return (
    <div className="mockup-container p3-routing-mockup">
      {/* Mini Routing Grid mock */}
      <div className="routing-table-card">
        <div className="routing-table-header">
          <span>No.</span>
          <span>Name</span>
          <span>URLs</span>
          <span>URN</span>
        </div>
        <div className="routing-table-body">
          <div className="routing-row active-row">
            <span>1</span>
            <span>Lakshay</span>
            <span className="check-circle-green">✔</span>
            <span className="urn-badge">URN-1029</span>
          </div>
          <div className="routing-row">
            <span>2</span>
            <span>John</span>
            <span className="check-circle-green">✔</span>
            <span className="urn-badge">URN-4822</span>
          </div>
          <div className="routing-row">
            <span>3</span>
            <span>Sarah</span>
            <span className="check-circle-green">✔</span>
            <span className="urn-badge">URN-9041</span>
          </div>
        </div>
      </div>

      {/* Golden Energy Routing Lines to Banks */}
      <svg className="routing-energy-svg" width="100%" height="100%">
        <defs>
          <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(224, 168, 46, 0.6)" />
            <stop offset="100%" stopColor="rgba(224, 168, 46, 0.15)" />
          </linearGradient>
        </defs>
        <path className="route-beam rb-1" d="M 110 40 C 140 30 160 15 200 12" fill="none" stroke="url(#routeGrad)" strokeWidth="1.5" strokeDasharray="5 3" />
        <path className="route-beam rb-2" d="M 110 60 C 140 55 170 45 200 42" fill="none" stroke="url(#routeGrad)" strokeWidth="1.5" strokeDasharray="5 3" />
        <path className="route-beam rb-3" d="M 110 80 C 140 85 170 80 200 72" fill="none" stroke="url(#routeGrad)" strokeWidth="1.5" strokeDasharray="5 3" />
        <path className="route-beam rb-4" d="M 110 95 C 140 105 170 105 200 102" fill="none" stroke="url(#routeGrad)" strokeWidth="1.5" strokeDasharray="5 3" />
      </svg>

      {/* Bank partner destination badges */}
      <div className="routing-bank-badge rb-sbi">
        <span className="rb-dot sbi-blue"></span>SBI
      </div>
      <div className="routing-bank-badge rb-meta">
        <span className="rb-dot meta-blue"></span>Meta
      </div>
      <div className="routing-bank-badge rb-hdfc">
        <span className="rb-dot hdfc-red"></span>HDFC
      </div>
      <div className="routing-bank-badge rb-axis">
        <span className="rb-dot axis-maroon"></span>AXIS
      </div>

      {/* Floating UTM Attribution Tags */}
      <div className="floating-utm-tag utm-source-tag">
        <span className="utm-label">utm_source</span>
        <span className="utm-val">google</span>
      </div>
      <div className="floating-utm-tag gclid-tag">
        <span className="utm-label">gclid</span>
        <span className="utm-val">gcl_726a</span>
      </div>
      <div className="google-ads-network-banner">
        <span className="g-dot-logo">G</span> Google ads network
      </div>
    </div>
  );
}

// Phase 4 Graphic: Bank MIS Settlement & Reconciliation
function Phase4Graphic() {
  return (
    <div className="mockup-container p4-settlement-mockup">
      <div className="reconciliation-panel">
        <div className="panel-header">
          <span className="panel-title">Bank MIS Settlement</span>
          <span className="reconciled-status">100% Synced</span>
        </div>
        <div className="panel-body">
          <div className="settlement-item reconciled">
            <div className="settlement-left">
              <span className="item-urn">URN-4822</span>
              <span className="item-date">21 Jul 2026</span>
            </div>
            <div className="settlement-right">
              <span className="amount-label">+₹1,250</span>
              <span className="settlement-badge approved">Approved</span>
            </div>
          </div>
          <div className="settlement-item reconciled">
            <div className="settlement-left">
              <span className="item-urn">URN-9041</span>
              <span className="item-date">21 Jul 2026</span>
            </div>
            <div className="settlement-right">
              <span className="amount-label">+₹1,250</span>
              <span className="settlement-badge approved">Approved</span>
            </div>
          </div>
          <div className="settlement-item reconciled">
            <div className="settlement-left">
              <span className="item-urn">URN-1029</span>
              <span className="item-date">21 Jul 2026</span>
            </div>
            <div className="settlement-right">
              <span className="amount-label">+₹1,250</span>
              <span className="settlement-badge approved">Approved</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating approval tag */}
      <div className="floating-approval-card">
        <div className="approval-sms-tag">SMS OTP</div>
        <div className="approval-status-row">
          <Check size={12} style={{ color: '#16A37B' }} />
          <span>Approved</span>
        </div>
      </div>
    </div>
  );
}
