import React, { useEffect } from 'react';

export default function AboutPage({ navigateTo }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const values = [
    { icon: '🔒', title: 'Security First', desc: 'Your data is encrypted and never shared without consent. We follow industry-best security practices.' },
    { icon: '💯', title: '100% Free Service', desc: 'We never charge customers. Our service is completely free for all users, always.' },
    { icon: '🏦', title: 'Bank-Authorised Partner', desc: 'We are an officially authorised marketing and referral partner of leading Indian banks.' },
    { icon: '⚡', title: 'Instant Processing', desc: 'Applications are routed directly to bank portals in real-time - no delays, no middlemen.' },
  ];

  const companyDetails = [
    { label: 'Legal Entity', value: 'Chaos Design Pvt. Ltd.' },
    { label: 'Brand Name', value: 'FinMantra' },
    { label: 'Website', value: 'finmantra.org' },
    { label: 'Email', value: 'support@finmantra.org' },
    { label: 'Industry', value: 'Financial Services Technology (FinTech)' },
  ];

  return (
    <div style={{ background: 'var(--paper)', minHeight: '100vh', fontFamily: 'var(--font-body)', color: 'var(--ink)' }}>
      {/* Hero Section */}
      <section style={{
        padding: '7rem 8% 4rem 8%',
        background: 'linear-gradient(180deg, var(--paper-2) 0%, var(--paper) 100%)',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '-120px', right: '-80px', width: '300px', height: '300px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(224,168,46,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <span style={{
          display: 'inline-block',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.15em',
          color: 'var(--gold-deep)',
          background: 'rgba(224, 168, 46, 0.1)',
          border: '1px solid rgba(224, 168, 46, 0.2)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.35rem 1rem',
          marginBottom: '1.2rem',
        }}>ABOUT US</span>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          color: 'var(--ink)',
          marginBottom: '1.2rem',
        }}>Who We Are</h1>
        <div style={{
          width: '48px', height: '4px', borderRadius: '2px',
          background: 'linear-gradient(90deg, var(--gold), var(--gold-deep))',
          margin: '0 auto',
        }} />
      </section>

      {/* Introduction */}
      <section style={{ padding: '4rem 8%', maxWidth: '860px', margin: '0 auto' }}>
        <p style={{
          fontSize: '1.15rem',
          lineHeight: 1.85,
          color: 'var(--ink-2)',
          textAlign: 'center',
        }}>
          <strong style={{ color: 'var(--ink)' }}>FinMantra</strong> is a brand owned and operated by{' '}
          <strong style={{ color: 'var(--ink)' }}>Chaos Design Pvt. Ltd.</strong> We are an authorised marketing
          and referral partner of leading Indian banks including HDFC Bank, ICICI Bank, Axis Bank, and more.
          Our mission is to simplify credit card discovery and application for millions of Indians.
        </p>
      </section>

      {/* What We Do */}
      <section style={{ padding: '3rem 8% 4rem 8%', maxWidth: '860px', margin: '0 auto' }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.8rem',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
          marginBottom: '1.2rem',
          textAlign: 'center',
        }}>What We Do</h2>
        <div style={{
          width: '36px', height: '3px', borderRadius: '2px',
          background: 'var(--gold)',
          margin: '0 auto 1.5rem auto',
        }} />
        <p style={{
          fontSize: '1.05rem',
          lineHeight: 1.85,
          color: 'var(--muted)',
          textAlign: 'center',
        }}>
          We help consumers compare, select, and apply for credit cards through our secure digital platform.
          We connect users directly with bank portals - we never handle credit decisions, card issuance,
          or customer funds.
        </p>
      </section>

      {/* Our Values */}
      <section style={{ padding: '3rem 8% 4.5rem 8%', background: 'var(--paper-2)' }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.8rem',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
          marginBottom: '1.2rem',
          textAlign: 'center',
        }}>Our Values</h2>
        <div style={{
          width: '36px', height: '3px', borderRadius: '2px',
          background: 'var(--gold)',
          margin: '0 auto 2.5rem auto',
        }} />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.5rem',
          maxWidth: '1000px',
          margin: '0 auto',
        }}>
          {values.map((v, i) => (
            <div key={i} style={{
              background: 'var(--white)',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem 1.5rem',
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--line)',
              textAlign: 'center',
              transition: 'var(--transition-smooth)',
            }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '1rem' }}>{v.icon}</div>
              <h3 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'var(--ink)',
                marginBottom: '0.6rem',
                letterSpacing: '-0.01em',
              }}>{v.title}</h3>
              <p style={{
                fontSize: '0.9rem',
                lineHeight: 1.7,
                color: 'var(--muted)',
                margin: 0,
              }}>{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Company Details */}
      <section style={{ padding: '4.5rem 8%', maxWidth: '700px', margin: '0 auto' }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.8rem',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
          marginBottom: '1.2rem',
          textAlign: 'center',
        }}>Company Details</h2>
        <div style={{
          width: '36px', height: '3px', borderRadius: '2px',
          background: 'var(--gold)',
          margin: '0 auto 2.5rem auto',
        }} />
        <div style={{
          background: 'var(--white)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem 2.5rem',
          boxShadow: 'var(--shadow)',
          border: '1px solid var(--line)',
        }}>
          {companyDetails.map((d, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem 0',
              borderBottom: i < companyDetails.length - 1 ? '1px solid var(--line)' : 'none',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: 'var(--muted)',
                textTransform: 'uppercase',
              }}>{d.label}</span>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: 'var(--ink)',
              }}>{d.value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: '3rem 8% 4.5rem 8%',
        textAlign: 'center',
      }}>
        <button
          className="btn-primary"
          onClick={() => navigateTo('/')}
          style={{ cursor: 'pointer' }}
        >
          ← Back to Home
        </button>
      </section>

      {/* Footer */}
      <footer style={{ padding: '4.5rem 8% 3rem 8%', background: 'var(--ink)', position: 'relative', zIndex: 1, color: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
          <img src="/logo.jpg" alt="FinMantra Logo" style={{ height: '32px', width: '32px', borderRadius: '8px', objectFit: 'cover', boxShadow: '0 2px 8px rgba(224, 168, 46, 0.3)' }} />
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.03em', color: '#ffffff' }}>FinMantra</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', lineHeight: 1.7, marginBottom: '1rem' }}>
          FinMantra is a brand owned and operated by <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Chaos Design Pvt. Ltd.</strong> - an authorised marketing and referral partner of its partner banks.
        </div>
        <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.35)', lineHeight: 1.7, marginBottom: '2.5rem' }}>
          We are not a bank, lender or card issuer, and we do not charge customers for our services.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.4)' }}>
          <span>© 2026 FinMantra - A brand of Chaos Design Pvt. Ltd.</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.25)' }}>·</span>
          <a href="#" onClick={(e) => { e.preventDefault(); navigateTo('/privacy-policy'); }} style={{ color: 'rgba(255, 255, 255, 0.5)', textDecoration: 'none', fontWeight: 500 }}>Privacy Policy</a>
          <span style={{ color: 'rgba(255, 255, 255, 0.25)' }}>·</span>
          <a href="#" onClick={(e) => { e.preventDefault(); navigateTo('/terms'); }} style={{ color: 'rgba(255, 255, 255, 0.5)', textDecoration: 'none', fontWeight: 500 }}>Terms & Conditions</a>
          <span style={{ color: 'rgba(255, 255, 255, 0.25)' }}>·</span>
          <a href="#" onClick={(e) => { e.preventDefault(); navigateTo('/about'); }} style={{ color: 'rgba(255, 255, 255, 0.5)', textDecoration: 'none', fontWeight: 500 }}>About Us</a>
          <span style={{ color: 'rgba(255, 255, 255, 0.25)' }}>·</span>
          <a href="#" onClick={(e) => { e.preventDefault(); navigateTo('/contact'); }} style={{ color: 'rgba(255, 255, 255, 0.5)', textDecoration: 'none', fontWeight: 500 }}>Contact</a>
        </div>
      </footer>
    </div>
  );
}
