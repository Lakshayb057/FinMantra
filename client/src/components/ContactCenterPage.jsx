import React, { useState, useEffect } from 'react';
import { ShieldCheck, MessageSquare, Mail, CheckCircle2, AlertCircle, RefreshCw, Send, Lock, ArrowLeft } from 'lucide-react';

export default function ContactCenterPage({ navigateTo }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lead, setLead] = useState(null);
  const [broadcast, setBroadcast] = useState(null);

  const [whatsappOptin, setWhatsappOptin] = useState(true);
  const [emailOptin, setEmailOptin] = useState(true);
  const [reason, setReason] = useState('');
  const [customFeedback, setCustomFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id') || params.get('master_id') || params.get('lead_id') || params.get('utm_id') || params.get('uid');
    const broadcastId = params.get('brodcast_id') || params.get('broadcast_id') || params.get('b') || params.get('utm_brodcast_id') || params.get('utm_broadcast_id') || params.get('bc_id');
    const targetChannel = params.get('channel') || params.get('utm_channel') || params.get('ch') || 'all';

    if (!id) {
      setError('Invalid or missing contact ID in unsubscribe link. Please verify your notification email or message.');
      setLoading(false);
      return;
    }

    const fetchDetails = async () => {
      try {
        const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173') ? 'http://localhost:5000/api' : '/api';
        const res = await fetch(`${API_URL}/contact-center/details?id=${encodeURIComponent(id)}${broadcastId ? `&broadcast_id=${encodeURIComponent(broadcastId)}` : ''}`);
        const data = await res.json();

        if (data.success && data.lead) {
          setLead(data.lead);
          setBroadcast(data.broadcast);

          const shouldAutoOptout = params.get('optout') === '1' || targetChannel === 'whatsapp' || targetChannel === 'email' || targetChannel === 'all';
          if (shouldAutoOptout) {
            const newWa = targetChannel === 'email' ? data.lead.whatsapp_optin : false;
            const newEmail = targetChannel === 'whatsapp' ? data.lead.email_optin : false;
            setWhatsappOptin(newWa);
            setEmailOptin(newEmail);

            // Auto-persist 1-click opt-out
            fetch(`${API_URL}/contact-center/optout`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: data.lead.id || id,
                broadcast_id: broadcastId,
                whatsapp_optin: newWa,
                email_optin: newEmail,
                channel: targetChannel,
                reason: '1-Click Unsubscribe from notification link'
              })
            }).then(() => {
              setSaveSuccess(true);
            }).catch(() => {});
          } else {
            setWhatsappOptin(data.lead.whatsapp_optin);
            setEmailOptin(data.lead.email_optin);
          }
        } else {
          setError(data.error || 'Contact profile not found.');
        }
      } catch (err) {
        setError('Unable to load communication preferences. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, []);

  const handleSavePreferences = async (forceOptoutAll = false) => {
    setSaving(true);
    setSaveSuccess(false);

    const newWa = forceOptoutAll ? false : whatsappOptin;
    const newEmail = forceOptoutAll ? false : emailOptin;

    try {
      const params = new URLSearchParams(window.location.search);
      const id = lead?.id || lead?.finmantra_id || lead?.contact || params.get('id') || params.get('master_id') || params.get('lead_id') || params.get('utm_id') || params.get('uid');
      const broadcastId = broadcast?.id || params.get('brodcast_id') || params.get('broadcast_id') || params.get('b') || params.get('utm_brodcast_id') || params.get('utm_broadcast_id') || params.get('bc_id');
      const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173') ? 'http://localhost:5000/api' : '/api';

      const res = await fetch(`${API_URL}/contact-center/optout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          broadcast_id: broadcastId,
          whatsapp_optin: newWa,
          email_optin: newEmail,
          reason: reason === 'Other' ? (customFeedback || 'Other') : (reason || (forceOptoutAll ? 'Unsubscribed all' : 'Updated preferences'))
        })
      });

      const data = await res.json();
      if (data.success) {
        if (forceOptoutAll) {
          setWhatsappOptin(false);
          setEmailOptin(false);
        }
        setSaveSuccess(true);
      } else {
        alert(data.error || 'Failed to update preferences.');
      }
    } catch (err) {
      alert('Network error while updating preferences.');
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
      padding: '2.5rem 1rem',
      fontFamily: 'var(--font-sans)'
    }}>
      {/* Header */}
      <div style={{ maxWidth: '640px', width: '100%', textAlign: 'center', marginBottom: '2rem' }}>
        <div 
          onClick={() => navigateTo && navigateTo('/')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', marginBottom: '1rem' }}
        >
          <img src="/logo.jpg" alt="FinMantra Logo" style={{ height: '42px', width: '42px', borderRadius: '10px', objectFit: 'cover', boxShadow: '0 4px 12px rgba(224, 168, 46, 0.25)' }} />
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            Fin<span style={{ color: 'var(--gold-deep)' }}>Mantra</span>
          </span>
        </div>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--ink)' }}>
          Communication &amp; Contact Center
        </h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.95rem' }}>
          Manage your notification settings, subscriptions, or opt-out of marketing communications.
        </p>
      </div>

      {/* Content Card */}
      <div style={{
        maxWidth: '640px',
        width: '100%',
        background: 'var(--paper-2)',
        border: '1px solid var(--line)',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
        padding: '2rem',
        boxSizing: 'border-box'
      }}>
        {loading ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
            <RefreshCw size={32} className="spin-slow" style={{ color: 'var(--gold-deep)', marginBottom: '1rem' }} />
            <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>Loading your communication preferences...</div>
          </div>
        ) : error ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
            <AlertCircle size={44} style={{ color: '#ef4444', marginBottom: '1rem' }} />
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 700 }}>Unable to Load Profile</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.92rem', marginBottom: '1.5rem' }}>{error}</p>
            {navigateTo && (
              <button 
                onClick={() => navigateTo('/')}
                style={{
                  padding: '0.65rem 1.4rem',
                  borderRadius: '8px',
                  background: 'var(--gold-deep)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Return to FinMantra Home
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Identity Banner */}
            <div style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              marginBottom: '1.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Contact Profile
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--ink)' }}>
                  {lead?.name || 'Valued Customer'}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                  {lead?.contact && <span>Phone: {lead.contact}</span>}
                  {lead?.contact && lead?.mail && <span> • </span>}
                  {lead?.mail && <span>Email: {lead.mail}</span>}
                </div>
              </div>
              <div style={{
                background: 'rgba(22, 163, 123, 0.1)',
                color: '#16a37b',
                padding: '0.35rem 0.75rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                <ShieldCheck size={14} /> ID: {lead?.finmantra_id || lead?.campaign_data_id || 'FM-Verified'}
              </div>
            </div>

            {/* Broadcast Context if available */}
            {broadcast && (
              <div style={{
                fontSize: '0.84rem',
                color: 'var(--muted)',
                background: 'rgba(224, 168, 46, 0.08)',
                border: '1px solid rgba(224, 168, 46, 0.25)',
                padding: '0.65rem 0.95rem',
                borderRadius: '8px',
                marginBottom: '1.5rem'
              }}>
                Received campaign: <strong>{broadcast.name}</strong> ({broadcast.channel})
              </div>
            )}

            {/* Success Message Banner */}
            {saveSuccess && (
              <div style={{
                background: 'rgba(22, 163, 123, 0.12)',
                border: '1.5px solid #16a37b',
                color: '#16a37b',
                padding: '1rem',
                borderRadius: '10px',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Preferences Successfully Updated</div>
                  <div style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
                    Your communication choices have been recorded in our master records immediately.
                  </div>
                </div>
              </div>
            )}

            {/* Channel Toggles */}
            <div style={{ marginBottom: '1.75rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Channel Notification Preferences</h3>
              
              {/* WhatsApp Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem',
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                marginBottom: '0.85rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    background: 'rgba(37, 211, 102, 0.12)',
                    color: '#25D366',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>WhatsApp Messages &amp; Updates</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Special card offers, application status, and eligibility alerts</div>
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={whatsappOptin}
                    onChange={(e) => setWhatsappOptin(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: whatsappOptin ? 'var(--gold-deep)' : '#ccc',
                    borderRadius: '26px',
                    transition: '0.3s'
                  }}>
                    <span style={{
                      position: 'absolute',
                      content: '""',
                      height: '20px',
                      width: '20px',
                      left: whatsappOptin ? '24px' : '3px',
                      bottom: '3px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      transition: '0.3s'
                    }} />
                  </span>
                </label>
              </div>

              {/* Email Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem',
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                borderRadius: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    background: 'rgba(59, 130, 246, 0.12)',
                    color: '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Mail size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Email Newsletters &amp; Offers</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Important financial tips, monthly digests, and card guides</div>
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={emailOptin}
                    onChange={(e) => setEmailOptin(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: emailOptin ? 'var(--gold-deep)' : '#ccc',
                    borderRadius: '26px',
                    transition: '0.3s'
                  }}>
                    <span style={{
                      position: 'absolute',
                      content: '""',
                      height: '20px',
                      width: '20px',
                      left: emailOptin ? '24px' : '3px',
                      bottom: '3px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      transition: '0.3s'
                    }} />
                  </span>
                </label>
              </div>
            </div>

            {/* Optional Reason Feedback if unsubscribing */}
            {(!whatsappOptin || !emailOptin) && (
              <div style={{
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '1.1rem',
                marginBottom: '1.75rem'
              }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.86rem', marginBottom: '0.5rem' }}>
                  Help us improve (Optional): Why are you updating your preferences?
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--paper-2)',
                    color: 'var(--ink)',
                    fontSize: '0.88rem',
                    marginBottom: reason === 'Other' ? '0.75rem' : 0
                  }}
                >
                  <option value="">Select a reason...</option>
                  <option value="Too many messages">Too many messages / too frequent</option>
                  <option value="Content is no longer relevant">Content is not relevant to me</option>
                  <option value="I never signed up">I did not subscribe or request this</option>
                  <option value="Prefer different communication channel">Prefer another channel</option>
                  <option value="Other">Other reason</option>
                </select>

                {reason === 'Other' && (
                  <textarea
                    placeholder="Tell us what we can do better..."
                    value={customFeedback}
                    onChange={(e) => setCustomFeedback(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--paper-2)',
                      color: 'var(--ink)',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box'
                    }}
                  />
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={() => handleSavePreferences(false)}
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  borderRadius: '10px',
                  background: 'var(--gold-deep)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(224, 168, 46, 0.3)'
                }}
              >
                {saving ? <RefreshCw size={18} className="spin-slow" /> : <CheckCircle2 size={18} />}
                Save My Preferences
              </button>

              {(whatsappOptin || emailOptin) && (
                <button
                  onClick={() => handleSavePreferences(true)}
                  disabled={saving}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    background: 'transparent',
                    color: 'var(--muted)',
                    border: '1px solid var(--line)',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Unsubscribe from All Communications
                </button>
              )}
            </div>

            {/* Privacy & Compliance Guarantee */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              color: 'var(--muted)',
              fontSize: '0.78rem',
              marginTop: '1.75rem',
              textAlign: 'center'
            }}>
              <Lock size={13} /> FinMantra respects your privacy. We never share your contact information with third parties.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
