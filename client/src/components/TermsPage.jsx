import React, { useEffect } from 'react';

export default function TermsPage({ navigateTo }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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

  const sectionStyle = {
    marginBottom: '2.5rem',
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
          position: 'absolute', top: '-60px', right: '-40px', width: '240px', height: '240px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(224,168,46,0.06) 0%, transparent 70%)',
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
        }}>Terms & Conditions</h1>
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

      {/* Terms Content */}
      <section style={{ padding: '4rem 8%', maxWidth: '820px', margin: '0 auto' }}>
        <div style={{
          background: 'var(--white)',
          borderRadius: 'var(--radius-lg)',
          padding: 'clamp(2rem, 4vw, 3rem)',
          boxShadow: 'var(--shadow)',
          border: '1px solid var(--line)',
        }}>

          {/* 1. Acceptance of Terms */}
          <div style={sectionStyle}>
            <span style={sectionNumberStyle}>SECTION 01</span>
            <h2 style={sectionHeadingStyle}>Acceptance of Terms</h2>
            <p style={paragraphStyle}>
              By accessing and using finmantra.org ("the Website"), you acknowledge that you have read, understood,
              and agree to be bound by these Terms & Conditions. If you do not agree with any part of these terms,
              you must not use our Website.
            </p>
          </div>

          {/* 2. About FinMantra */}
          <div style={sectionStyle}>
            <span style={sectionNumberStyle}>SECTION 02</span>
            <h2 style={sectionHeadingStyle}>About FinMantra</h2>
            <p style={paragraphStyle}>
              FinMantra is a brand owned and operated by <strong style={{ color: 'var(--ink)' }}>Chaos Design Pvt. Ltd.</strong>{' '}
              We operate as an authorised marketing and referral partner for leading Indian banks.
            </p>
            <div style={{
              marginTop: '1rem',
              padding: '0.9rem 1.2rem',
              background: 'rgba(224, 168, 46, 0.06)',
              borderRadius: 'var(--radius-sm)',
              borderLeft: '3px solid var(--gold)',
            }}>
              <p style={{ ...paragraphStyle, color: 'var(--gold-deep)', fontWeight: 600, marginBottom: 0, fontSize: '0.9rem' }}>
                We are not a bank, NBFC, or financial institution. We do not lend money, issue credit cards,
                or make credit decisions.
              </p>
            </div>
          </div>

          {/* 3. Services */}
          <div style={sectionStyle}>
            <span style={sectionNumberStyle}>SECTION 03</span>
            <h2 style={sectionHeadingStyle}>Services</h2>
            <ul style={listStyle}>
              <li style={listItemStyle}>We provide a free platform to compare and apply for credit cards from partner banks.</li>
              <li style={listItemStyle}>We redirect users to official bank portals for final application submission.</li>
              <li style={listItemStyle}>We do not guarantee approval of any credit card application — approval decisions are made solely by the respective banks.</li>
            </ul>
          </div>

          {/* 4. User Obligations */}
          <div style={sectionStyle}>
            <span style={sectionNumberStyle}>SECTION 04</span>
            <h2 style={sectionHeadingStyle}>User Obligations</h2>
            <p style={paragraphStyle}>By using our platform, you agree to:</p>
            <ul style={listStyle}>
              <li style={listItemStyle}>Provide accurate and truthful information in all forms and applications.</li>
              <li style={listItemStyle}>Be at least 18 years of age to use our services.</li>
              <li style={listItemStyle}>Not use our platform for any unlawful, fraudulent, or unauthorised purpose.</li>
              <li style={listItemStyle}>Not attempt to interfere with or disrupt the operation of our Website.</li>
            </ul>
          </div>

          {/* 5. No Financial Advice */}
          <div style={sectionStyle}>
            <span style={sectionNumberStyle}>SECTION 05</span>
            <h2 style={sectionHeadingStyle}>No Financial Advice</h2>
            <p style={paragraphStyle}>
              FinMantra does not provide financial, investment, or credit advice. The information presented on
              our platform — including card features, fees, interest rates, and rewards — is indicative and
              subject to the issuing bank's current terms and conditions.
            </p>
            <p style={paragraphStyle}>
              We recommend that you independently verify all card details on the official bank website
              before making any financial decisions.
            </p>
          </div>

          {/* 6. Intellectual Property */}
          <div style={sectionStyle}>
            <span style={sectionNumberStyle}>SECTION 06</span>
            <h2 style={sectionHeadingStyle}>Intellectual Property</h2>
            <p style={paragraphStyle}>
              All content, logos, designs, text, graphics, and trademarks displayed on finmantra.org are owned by
              Chaos Design Pvt. Ltd. or their respective owners. You may not reproduce, distribute, modify, or
              create derivative works from any content on this Website without prior written permission.
            </p>
          </div>

          {/* 7. Limitation of Liability */}
          <div style={sectionStyle}>
            <span style={sectionNumberStyle}>SECTION 07</span>
            <h2 style={sectionHeadingStyle}>Limitation of Liability</h2>
            <p style={paragraphStyle}>
              To the maximum extent permitted by law, FinMantra and Chaos Design Pvt. Ltd. shall not be liable for:
            </p>
            <ul style={listStyle}>
              <li style={listItemStyle}>Any loss or damage arising from credit card application rejections by partner banks.</li>
              <li style={listItemStyle}>Any discrepancies between card features displayed on our platform and the actual terms offered by the bank.</li>
              <li style={listItemStyle}>Any issues, losses, or damages arising from third-party bank websites or services.</li>
              <li style={listItemStyle}>Any indirect, incidental, or consequential damages arising from the use of our platform.</li>
            </ul>
          </div>

          {/* 8. Privacy */}
          <div style={sectionStyle}>
            <span style={sectionNumberStyle}>SECTION 08</span>
            <h2 style={sectionHeadingStyle}>Privacy</h2>
            <p style={paragraphStyle}>
              Your use of our services is also governed by our{' '}
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); navigateTo('/privacy-policy'); }}
                style={{ color: 'var(--gold-deep)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '3px' }}
              >
                Privacy Policy
              </a>.
              Please review it to understand how we collect, use, and protect your personal information.
            </p>
          </div>

          {/* 9. Modifications */}
          <div style={sectionStyle}>
            <span style={sectionNumberStyle}>SECTION 09</span>
            <h2 style={sectionHeadingStyle}>Modifications</h2>
            <p style={paragraphStyle}>
              We reserve the right to modify, update, or revise these Terms & Conditions at any time without
              prior notice. Changes will be effective immediately upon posting to this page. Your continued use
              of the Website after any modifications constitutes your acceptance of the revised terms.
            </p>
          </div>

          {/* 10. Governing Law */}
          <div style={sectionStyle}>
            <span style={sectionNumberStyle}>SECTION 10</span>
            <h2 style={sectionHeadingStyle}>Governing Law</h2>
            <p style={paragraphStyle}>
              These Terms & Conditions shall be governed by and construed in accordance with the laws of India.
              Any disputes arising out of or in connection with these terms shall be subject to the exclusive
              jurisdiction of the courts in <strong style={{ color: 'var(--ink)' }}>Delhi, India</strong>.
            </p>
          </div>

          {/* 11. Contact */}
          <div style={{ marginBottom: 0 }}>
            <span style={sectionNumberStyle}>SECTION 11</span>
            <h2 style={sectionHeadingStyle}>Contact</h2>
            <p style={paragraphStyle}>
              If you have any questions or concerns about these Terms & Conditions, please contact us:
            </p>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--gold)', boxShadow: '0 0 0 4px rgba(224, 168, 46, 0.22)' }}></span>
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
