import React, { useEffect } from 'react';

export default function ContactPage({ navigateTo }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const contactCards = [
    {
      icon: '📧',
      title: 'Email',
      detail: 'support@finmantra.org',
      sub: 'We typically respond within 24 hours',
    },
    {
      icon: '📞',
      title: 'Phone',
      detail: '+91-XXXXXXXXXX',
      sub: 'Available during business hours (update number)',
    },
    {
      icon: '📍',
      title: 'Registered Office',
      detail: 'Chaos Design Pvt. Ltd.',
      sub: '[Address placeholder — please update with registered address]',
    },
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
          position: 'absolute', top: '-100px', left: '-60px', width: '280px', height: '280px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(22,163,123,0.06) 0%, transparent 70%)',
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
        }}>CONTACT US</span>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          color: 'var(--ink)',
          marginBottom: '1rem',
        }}>Get In Touch</h1>
        <div style={{
          width: '48px', height: '4px', borderRadius: '2px',
          background: 'linear-gradient(90deg, var(--gold), var(--gold-deep))',
          margin: '0 auto 1.5rem auto',
        }} />
        <p style={{
          fontSize: '1.1rem',
          lineHeight: 1.7,
          color: 'var(--muted)',
          maxWidth: '560px',
          margin: '0 auto',
        }}>
          Have questions, feedback, or need support? We'd love to hear from you.
        </p>
      </section>

      {/* Contact Cards */}
      <section style={{ padding: '3rem 8% 4rem 8%' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
          maxWidth: '1000px',
          margin: '0 auto',
        }}>
          {contactCards.map((c, i) => (
            <div key={i} style={{
              background: 'var(--white)',
              borderRadius: 'var(--radius-lg)',
              padding: '2.2rem 1.8rem',
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--line)',
              textAlign: 'center',
              transition: 'var(--transition-smooth)',
            }}>
              <div style={{
                fontSize: '2.6rem',
                marginBottom: '1rem',
                width: '64px', height: '64px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem auto',
                background: 'var(--paper-2)',
                borderRadius: 'var(--radius-md)',
              }}>{c.icon}</div>
              <h3 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.15rem',
                fontWeight: 700,
                color: 'var(--ink)',
                marginBottom: '0.5rem',
                letterSpacing: '-0.01em',
              }}>{c.title}</h3>
              <p style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--gold-deep)',
                marginBottom: '0.4rem',
              }}>{c.detail}</p>
              <p style={{
                fontSize: '0.85rem',
                lineHeight: 1.6,
                color: 'var(--muted)',
                margin: 0,
              }}>{c.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Business Hours */}
      <section style={{ padding: '3rem 8% 4rem 8%', background: 'var(--paper-2)' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.8rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
            marginBottom: '1.2rem',
          }}>Business Hours</h2>
          <div style={{
            width: '36px', height: '3px', borderRadius: '2px',
            background: 'var(--gold)',
            margin: '0 auto 2rem auto',
          }} />
          <div style={{
            background: 'var(--white)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem 2.5rem',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--line)',
            display: 'inline-block',
            minWidth: '340px',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.8rem 0', borderBottom: '1px solid var(--line)',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--muted)',
                letterSpacing: '0.02em',
              }}>Monday – Saturday</span>
              <span style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: 'var(--mint)',
              }}>10:00 AM – 6:00 PM IST</span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.8rem 0',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--muted)',
                letterSpacing: '0.02em',
              }}>Sunday</span>
              <span style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: 'var(--err)',
              }}>Closed</span>
            </div>
          </div>
        </div>
      </section>

      {/* Business Inquiries */}
      <section style={{ padding: '4rem 8%', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.8rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
            marginBottom: '1rem',
          }}>For Business Inquiries</h2>
          <div style={{
            width: '36px', height: '3px', borderRadius: '2px',
            background: 'var(--gold)',
            margin: '0 auto 1.5rem auto',
          }} />
          <p style={{
            fontSize: '1rem',
            lineHeight: 1.7,
            color: 'var(--muted)',
            marginBottom: '1rem',
          }}>
            Interested in partnering with us or exploring business opportunities? Reach out to our partnerships team.
          </p>
          <p style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: 'var(--gold-deep)',
          }}>
            partnerships@finmantra.org
          </p>
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
