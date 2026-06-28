import React, { useEffect } from 'react';

export default function PrivacyPolicyPage({ navigateTo }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sectionStyle = {
    marginBottom: '2.5rem',
  };

  const sectionNumberStyle = {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--gold-deep)',
    letterSpacing: '0.08em',
    marginBottom: '0.3rem',
    display: 'block',
  };

  const sectionHeadingStyle = {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.35rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: 'var(--ink)',
    marginBottom: '0.8rem',
    lineHeight: 1.25,
  };

  const paragraphStyle = {
    fontSize: '0.95rem',
    lineHeight: 1.85,
    color: 'var(--muted)',
    marginBottom: '0.6rem',
  };

  const listStyle = {
    paddingLeft: '1.2rem',
    margin: '0.6rem 0',
  };

  const listItemStyle = {
    fontSize: '0.95rem',
    lineHeight: 1.85,
    color: 'var(--muted)',
    marginBottom: '0.3rem',
  };

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
          position: 'absolute', bottom: '-80px', left: '50%', transform: 'translateX(-50%)', width: '400px', height: '200px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(224,168,46,0.05) 0%, transparent 70%)',
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
        }}>LEGAL</span>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          color: 'var(--ink)',
          marginBottom: '1rem',
        }}>Privacy Policy</h1>
        <div style={{
          width: '48px', height: '4px', borderRadius: '2px',
          background: 'linear-gradient(90deg, var(--gold), var(--gold-deep))',
          margin: '0 auto 1.5rem auto',
        }} />
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.82rem',
          color: 'var(--muted)',
          letterSpacing: '0.03em',
        }}>
          Effective Date: June 28, 2026
        </p>
      </section>

      {/* Policy Content */}
      <section style={{ padding: '4rem 8%', maxWidth: '820px', margin: '0 auto' }}>
        <div style={{
          background: 'var(--white)',
          borderRadius: 'var(--radius-lg)',
          padding: 'clamp(2rem, 4vw, 3rem)',
          boxShadow: 'var(--shadow)',
          border: '1px solid var(--line)',
        }}>

          {/* 1. Introduction */}
          <div style={sectionStyle}>
            <span style={sectionNumberStyle}>SECTION 01</span>
            <h2 style={sectionHeadingStyle}>Introduction</h2>
            <p style={paragraphStyle}>
              FinMantra ("we", "us", "our"), a brand of <strong style={{ color: 'var(--ink)' }}>Chaos Design Pvt. Ltd.</strong>,
              is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and
              safeguard your information when you visit our website finmantra.org.
            </p>
          </div>

          {/* 2. Information We Collect */}
          <div style={sectionStyle}>
            <span style={sectionNumberStyle}>SECTION 02</span>
            <h2 style={sectionHeadingStyle}>Information We Collect</h2>
            <p style={paragraphStyle}>We may collect the following types of information:</p>
            <p style={{ ...paragraphStyle, fontWeight: 600, color: 'var(--ink)', marginBottom: '0.2rem' }}>Personal Information</p>
            <ul style={listStyle}>
              <li style={listItemStyle}>Name</li>
              <li style={listItemStyle}>Email address</li>
              <li style={listItemStyle}>Phone number</li>
              <li style={listItemStyle}>City</li>
            </ul>
            <p style={{ ...paragraphStyle, fontWeight: 600, color: 'var(--ink)', marginBottom: '0.2rem', marginTop: '1rem' }}>Usage Data</p>
            <ul style={listStyle}>
              <li style={listItemStyle}>IP address</li>
              <li style={listItemStyle}>Browser type</li>
              <li style={listItemStyle}>Device information</li>
              <li style={listItemStyle}>Pages visited</li>
            </ul>
            <p style={{ ...paragraphStyle, fontWeight: 600, color: 'var(--ink)', marginBottom: '0.2rem', marginTop: '1rem' }}>Cookies & Tracking Technologies</p>
            <ul style={listStyle}>
              <li style={listItemStyle}>Google Analytics</li>
              <li style={listItemStyle}>Meta Pixel</li>
              <li style={listItemStyle}>Conversions API</li>
            </ul>
          </div>

          {/* 3. How We Use Your Information */}
          <div style={sectionStyle}>
            <span style={sectionNumberStyle}>SECTION 03</span>
            <h2 style={sectionHeadingStyle}>How We Use Your Information</h2>
            <ul style={listStyle}>
              <li style={listItemStyle}>To facilitate credit card applications with partner banks</li>
              <li style={listItemStyle}>To verify your identity via WhatsApp OTP</li>
              <li style={listItemStyle}>To improve our website and services</li>
              <li style={listItemStyle}>To communicate with you about your application status</li>
              <li style={listItemStyle}>To comply with legal obligations</li>
            </ul>
          </div>

          {/* 4. Information Sharing */}
          <div style={sectionStyle}>
            <span style={sectionNumberStyle}>SECTION 04</span>
            <h2 style={sectionHeadingStyle}>Information Sharing</h2>
            <p style={paragraphStyle}>We share your information only with:</p>
            <ul style={listStyle}>
              <li style={listItemStyle}><strong style={{ color: 'var(--ink)' }}>Partner banks</strong> — for credit card application processing</li>
              <li style={listItemStyle}><strong style={{ color: 'var(--ink)' }}>Analytics providers</strong> (Google, Meta) — for performance measurement</li>
            </ul>
            <div style={{
              marginTop: '1rem',
              padding: '0.9rem 1.2rem',
              background: 'rgba(22, 163, 123, 0.06)',
              borderRadius: 'var(--radius-sm)',
              borderLeft: '3px solid var(--mint)',
            }}>
              <p style={{ ...paragraphStyle, color: 'var(--mint)', fontWeight: 600, marginBottom: 0, fontSize: '0.9rem' }}>
                We do NOT sell your personal data to third parties.
              </p>
            </div>
          </div>

          {/* 5. Cookies & Tracking */}
          <div style={sectionStyle}>
            <span style={sectionNumberStyle}>SECTION 05</span>
            <h2 style={sectionHeadingStyle}>Cookies & Tracking</h2>
            <p style={paragraphStyle}>
              We use cookies including <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', background: 'var(--paper-2)', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>fbclid</code>,{' '}
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', background: 'var(--paper-2)', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>gclid</code>,{' '}
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', background: 'var(--paper-2)', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>_fbp</code>,{' '}
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', background: 'var(--paper-2)', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>_fbc</code>{' '}
              for ad attribution and conversion tracking.
            </p>
            <p style={paragraphStyle}>
              You can disable cookies in your browser settings, though this may affect your experience on our website.
            </p>
          </div>

          {/* 6. Data Security */}
          <div style={sectionStyle}>
            <span style={sectionNumberStyle}>SECTION 06</span>
            <h2 style={sectionHeadingStyle}>Data Security</h2>
            <p style={paragraphStyle}>
              We implement SSL/TLS encryption, secure database storage, and access controls to protect your data.
              While we strive to use commercially acceptable means to protect your personal information, no method of
              transmission over the Internet is 100% secure.
            </p>
          </div>

          {/* 7. Your Rights */}
          <div style={sectionStyle}>
            <span style={sectionNumberStyle}>SECTION 07</span>
            <h2 style={sectionHeadingStyle}>Your Rights</h2>
            <p style={paragraphStyle}>
              You may request access to, correction of, or deletion of your personal data by contacting us at{' '}
              <strong style={{ color: 'var(--gold-deep)' }}>support@finmantra.org</strong>.
            </p>
          </div>

          {/* 8. Third-Party Links */}
          <div style={sectionStyle}>
            <span style={sectionNumberStyle}>SECTION 08</span>
            <h2 style={sectionHeadingStyle}>Third-Party Links</h2>
            <p style={paragraphStyle}>
              Our website may contain links to partner bank websites and other third-party services.
              We are not responsible for the privacy practices or content of these external sites.
              We encourage you to read the privacy policies of any third-party sites you visit.
            </p>
          </div>

          {/* 9. Changes to This Policy */}
          <div style={sectionStyle}>
            <span style={sectionNumberStyle}>SECTION 09</span>
            <h2 style={sectionHeadingStyle}>Changes to This Policy</h2>
            <p style={paragraphStyle}>
              We may update this Privacy Policy from time to time. Changes will be posted on this page with
              an updated effective date. We encourage you to review this policy periodically for any changes.
            </p>
          </div>

          {/* 10. Contact Us */}
          <div style={{ marginBottom: 0 }}>
            <span style={sectionNumberStyle}>SECTION 10</span>
            <h2 style={sectionHeadingStyle}>Contact Us</h2>
            <p style={paragraphStyle}>If you have any questions about this Privacy Policy, please contact us:</p>
            <div style={{
              marginTop: '1rem',
              padding: '1.2rem 1.5rem',
              background: 'var(--paper)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--line)',
            }}>
              <p style={{ ...paragraphStyle, marginBottom: '0.3rem' }}>
                <strong style={{ color: 'var(--ink)' }}>Chaos Design Pvt. Ltd.</strong>
              </p>
              <p style={{ ...paragraphStyle, marginBottom: 0 }}>
                Email: <strong style={{ color: 'var(--gold-deep)' }}>support@finmantra.org</strong>
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '1rem 8% 4.5rem 8%', textAlign: 'center' }}>
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
          FinMantra is a brand owned and operated by <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Chaos Design Pvt. Ltd.</strong> — an authorised marketing and referral partner of its partner banks.
        </div>
        <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.35)', lineHeight: 1.7, marginBottom: '2.5rem' }}>
          We are not a bank, lender or card issuer, and we do not charge customers for our services.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.4)' }}>
          <span>© 2026 FinMantra — A brand of Chaos Design Pvt. Ltd.</span>
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
