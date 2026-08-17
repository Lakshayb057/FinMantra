import React, { useState, useEffect } from 'react';
import { ShieldCheck, MessageSquare, Mail, CheckCircle2, AlertCircle, RefreshCw, Undo2, Lock, ArrowLeft, HeartHandshake } from 'lucide-react';

export default function UnsubscribePage({ navigateTo }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lead, setLead] = useState(null);
  const [broadcast, setBroadcast] = useState(null);

  const [channel, setChannel] = useState('all'); // 'whatsapp' | 'email' | 'all'
  const [unsubscribedChannels, setUnsubscribedChannels] = useState({ whatsapp: false, email: false });
  const [actionSuccess, setActionSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState('');
  const [customFeedback, setCustomFeedback] = useState('');

  const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173') ? 'http://localhost:5000/api' : '/api';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id') || params.get('master_id') || params.get('lead_id') || params.get('utm_id') || params.get('uid');
    const broadcastId = params.get('b') || params.get('brodcast_id') || params.get('broadcast_id') || params.get('utm_brodcast_id') || params.get('utm_broadcast_id') || params.get('bc_id');
    const targetChannel = (params.get('channel') || params.get('utm_channel') || params.get('ch') || 'all').toLowerCase();
    setChannel(targetChannel);

    if (!id) {
      setError('Missing contact identifier. Please check the link from your email or WhatsApp message.');
      setLoading(false);
      return;
    }

    const initUnsubscribe = async () => {
      try {
        // Fetch lead & log click
        const res = await fetch(`${API_URL}/contact-center/details?id=${encodeURIComponent(id)}${broadcastId ? `&broadcast_id=${encodeURIComponent(broadcastId)}` : ''}`);
        const data = await res.json();

        if (data.success && data.lead) {
          setLead(data.lead);
          setBroadcast(data.broadcast);

          // Perform automatic 1-click unsubscribe for target channel
          const newWa = targetChannel === 'email' ? data.lead.whatsapp_optin : false;
          const newEmail = targetChannel === 'whatsapp' ? data.lead.email_optin : false;

          const optoutRes = await fetch(`${API_URL}/contact-center/optout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: data.lead.id,
              broadcast_id: broadcastId,
              whatsapp_optin: newWa,
              email_optin: newEmail,
              channel: targetChannel,
              reason: 'Direct link 1-click unsubscribe'
            })
          });

          const optoutData = await optoutRes.json();
          if (optoutData.success) {
            setUnsubscribedChannels({
              whatsapp: targetChannel === 'whatsapp' || targetChannel === 'all',
              email: targetChannel === 'email' || targetChannel === 'all'
            });
            setActionSuccess(true);
            
            if (targetChannel === 'whatsapp') {
              setSuccessMessage('You have been successfully unsubscribed from FinMantra WhatsApp notifications & alerts.');
            } else if (targetChannel === 'email') {
              setSuccessMessage('You have been successfully unsubscribed from FinMantra email newsletters & campaign offers.');
            } else {
              setSuccessMessage('You have been successfully unsubscribed from all FinMantra WhatsApp and Email marketing communications.');
            }
          }
        } else {
          setError(data.error || 'Contact profile not found in master records.');
        }
      } catch (err) {
        setError('Unable to process unsubscribe request. Please check your internet connection.');
      } finally {
        setLoading(false);
      }
    };

    initUnsubscribe();
  }, []);

  const handleResubscribe = async (resubChannel) => {
    if (!lead?.id) return;
    setSaving(true);
    try {
      const newWa = (resubChannel === 'whatsapp' || resubChannel === 'all') ? true : !unsubscribedChannels.whatsapp;
      const newEmail = (resubChannel === 'email' || resubChannel === 'all') ? true : !unsubscribedChannels.email;

      const res = await fetch(`${API_URL}/contact-center/optout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lead.id,
          whatsapp_optin: newWa,
          email_optin: newEmail,
          reason: 'User re-subscribed'
        })
      });

      const data = await res.json();
      if (data.success) {
        setUnsubscribedChannels({
          whatsapp: !newWa,
          email: !newEmail
        });
        setSuccessMessage(`Welcome back! You have successfully re-subscribed to FinMantra ${resubChannel === 'all' ? 'communications' : resubChannel}.`);
      }
    } catch (err) {
      alert('Failed to update subscription status.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendFeedback = async () => {
    if (!reason && !customFeedback) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/contact-center/optout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lead.id,
          whatsapp_optin: !unsubscribedChannels.whatsapp,
          email_optin: !unsubscribedChannels.email,
          reason: reason === 'Other' ? (customFeedback || 'Other') : (reason || customFeedback)
        })
      });
      alert('Thank you for your valuable feedback! We appreciate your help in improving FinMantra.');
    } catch (e) {
      // quiet
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--paper)',
      color: 'var(--ink)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '3rem 1rem',
      fontFamily: 'var(--font-sans)',
      boxSizing: 'border-box'
    }}>
      {/* Brand Header */}
      <div style={{ maxWidth: '580px', width: '100%', textAlign: 'center', marginBottom: '2rem' }}>
        <div 
          onClick={() => navigateTo && navigateTo('/')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', marginBottom: '0.8rem' }}
        >
          <img src="/logo.jpg" alt="FinMantra" style={{ height: '44px', width: '44px', borderRadius: '10px', objectFit: 'cover', boxShadow: '0 4px 12px rgba(224, 168, 46, 0.25)' }} />
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.7rem', letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            Fin<span style={{ color: 'var(--gold-deep)' }}>Mantra</span>
          </span>
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.4rem 0', color: 'var(--ink)' }}>
          Communication Preferences &amp; Opt-Out
        </h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.92rem' }}>
          Instant, hassle-free subscription management for your FinMantra notifications.
        </p>
      </div>

      {/* Main Confirmation Card */}
      <div style={{
        maxWidth: '580px',
        width: '100%',
        background: 'var(--paper-2)',
        border: '1px solid var(--line)',
        borderRadius: '16px',
        boxShadow: '0 12px 35px rgba(0,0,0,0.06)',
        padding: '2.25rem 2rem',
        boxSizing: 'border-box'
      }}>
        {loading ? (
          <div style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
            <RefreshCw size={36} className="spin-slow" style={{ color: 'var(--gold-deep)', marginBottom: '1rem' }} />
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)' }}>Processing your unsubscribe request...</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.4rem' }}>Updating master records in real-time.</div>
          </div>
        ) : error ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
            <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: '1rem' }} />
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 700 }}>Unable to Process Request</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.92rem', marginBottom: '1.75rem', lineHeight: '1.5' }}>{error}</p>
            {navigateTo && (
              <button 
                onClick={() => navigateTo('/')}
                style={{
                  padding: '0.75rem 1.6rem',
                  borderRadius: '10px',
                  background: 'var(--gold-deep)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Return to FinMantra Home
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Success Notification Banner */}
            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1.5px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '12px',
              padding: '1.25rem',
              marginBottom: '1.75rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.85rem'
            }}>
              <CheckCircle2 size={24} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#b91c1c' }}>
                  Unsubscribed Successfully
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--ink)', marginTop: '0.35rem', lineHeight: '1.45' }}>
                  {successMessage}
                </div>
              </div>
            </div>

            {/* Recipient Profile Details */}
            <div style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Affected Profile
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--ink)' }}>
                  {lead?.name || 'Valued Customer'}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                  {lead?.contact && <span>Phone: {lead.contact}</span>}
                  {lead?.contact && lead?.mail && <span> • </span>}
                  {lead?.mail && <span>Email: {lead.mail}</span>}
                </div>
              </div>
              <div style={{
                background: 'rgba(224, 168, 46, 0.12)',
                color: 'var(--gold-deep)',
                padding: '0.35rem 0.75rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                <ShieldCheck size={13} /> {lead?.finmantra_id || 'FM-Master'}
              </div>
            </div>

            {/* Re-subscribe Prompt (Mistake recovery) */}
            <div style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              padding: '1.25rem',
              marginBottom: '1.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
                <Undo2 size={18} style={{ color: 'var(--gold-deep)' }} />
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Did you unsubscribe by mistake?</h4>
              </div>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.84rem', color: 'var(--muted)', lineHeight: '1.4' }}>
                If you still wish to receive important card pre-approvals, advisory alerts, or credit updates, you can re-activate your preferences with one click:
              </p>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleResubscribe('whatsapp')}
                  disabled={saving || !unsubscribedChannels.whatsapp}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    background: unsubscribedChannels.whatsapp ? 'rgba(37, 211, 102, 0.12)' : 'var(--paper-2)',
                    color: unsubscribedChannels.whatsapp ? '#25D366' : 'var(--muted)',
                    border: '1px solid var(--line)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: unsubscribedChannels.whatsapp ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <MessageSquare size={15} /> {unsubscribedChannels.whatsapp ? 'Re-subscribe WhatsApp' : 'WhatsApp Active'}
                </button>

                <button
                  onClick={() => handleResubscribe('email')}
                  disabled={saving || !unsubscribedChannels.email}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    background: unsubscribedChannels.email ? 'rgba(59, 130, 246, 0.12)' : 'var(--paper-2)',
                    color: unsubscribedChannels.email ? '#3b82f6' : 'var(--muted)',
                    border: '1px solid var(--line)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: unsubscribedChannels.email ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Mail size={15} /> {unsubscribedChannels.email ? 'Re-subscribe Email' : 'Email Active'}
                </button>
              </div>
            </div>

            {/* Quick Feedback */}
            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.86rem', marginBottom: '0.5rem', color: 'var(--ink)' }}>
                Help us improve: Why did you unsubscribe? (Optional)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.6rem 0.8rem',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--paper)',
                    color: 'var(--ink)',
                    fontSize: '0.86rem'
                  }}
                >
                  <option value="">Select a reason...</option>
                  <option value="Too many messages">Too many messages / too frequent</option>
                  <option value="Content is no longer relevant">Content is no longer relevant</option>
                  <option value="I never signed up">I did not request this communication</option>
                  <option value="Prefer different channel">I prefer another communication channel</option>
                  <option value="Other">Other reason</option>
                </select>
                <button
                  onClick={handleSendFeedback}
                  disabled={saving || !reason}
                  style={{
                    padding: '0.6rem 1.1rem',
                    borderRadius: '8px',
                    background: reason ? 'var(--gold-deep)' : 'var(--line)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    cursor: reason ? 'pointer' : 'not-allowed'
                  }}
                >
                  Submit
                </button>
              </div>
            </div>

            {/* Detailed Contact Center Link */}
            <div style={{ textAlign: 'center', borderTop: '1px solid var(--line)', paddingTop: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
                Need fine-grained control over notification frequency?
              </div>
              <button
                onClick={() => {
                  const query = window.location.search;
                  if (navigateTo) navigateTo(`/contact-center${query}`);
                  else window.location.href = `/contact-center${query}`;
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--gold-deep)',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Go to Full Contact Center Preferences &rarr;
              </button>
            </div>

            {/* Security Guarantee */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              color: 'var(--muted)',
              fontSize: '0.76rem',
              marginTop: '1.5rem',
              textAlign: 'center'
            }}>
              <Lock size={12} /> FinMantra strict compliance. Your opt-out takes effect across all broadcasts immediately.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
