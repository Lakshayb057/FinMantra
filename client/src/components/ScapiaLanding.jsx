import React, { useState, useEffect, useRef } from 'react';
import { trackLeadSubmission, initAnalytics, resolveRedirectUrl } from '../utils/analytics';
import { RefreshCw, X, ShieldAlert } from 'lucide-react';

export default function ScapiaLanding({ navigateTo, utmParams }) {
  const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173') ? 'http://localhost:5000/api' : '/api';

  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '', // WhatsApp No
    email: '',
    pincode: '',
    address_city: '',
    address_state: '',
    address_locality: '',
    consent: false,
    company: '' // honeypot
  });

  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ type: '', message: '' }); // 'success' or 'error'

  // Phone Verification / OTP states
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpVal, setOtpVal] = useState('');
  const [otpStatus, setOtpStatus] = useState('');
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const isPhoneVerifiedRef = useRef(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [simulatedOtpText, setSimulatedOtpText] = useState('');

  // Pincode Lookup
  const [pincodeLocationText, setPincodeLocationText] = useState('');
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState('');

  useEffect(() => {
    const pin = formData.pincode;
    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      setPincodeLocationText('');
      setPincodeError('');
      return;
    }

    setPincodeLoading(true);
    setPincodeError('');
    setPincodeLocationText('');

    const lookupPin = async () => {
      try {
        const res = await fetch(`${API_URL}/pincode/lookup/${pin}`);
        if (res.ok) {
          const data = await res.json();
          setPincodeLocationText(`${data.city || ''}, ${data.state || ''}`);
          setFormData(prev => ({
            ...prev,
            address_city: data.city || '',
            address_state: data.state || '',
            address_locality: data.localities && data.localities.length > 0 ? data.localities[0] : ''
          }));
        } else {
          setPincodeError('Pincode not found');
          setErrors(prev => ({ ...prev, pincode: 'Pincode not found' }));
        }
      } catch (err) {
        setPincodeError('Error looking up pincode');
      } finally {
        setPincodeLoading(false);
      }
    };
    lookupPin();
  }, [formData.pincode]);

  // OTP Timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
      if (name === 'consent' && !checked) {
        setErrors(prev => ({ ...prev, consent: 'Please accept the consent to continue.' }));
      } else if (name === 'consent') {
        setErrors(prev => ({ ...prev, consent: '' }));
      }
      return;
    }

    if (name === 'phone' || name === 'pincode') {
      const cleanVal = value.replace(/\D/g, '').slice(0, name === 'phone' ? 10 : 6);
      setFormData(prev => ({ ...prev, [name]: cleanVal }));
      validateField(name, cleanVal);
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
    validateField(name, value);
  };

  const validateField = (name, value) => {
    let errorText = '';
    if (name === 'fullName') {
      const parts = value.trim().split(/\s+/);
      if (!value || parts.length < 2 || parts.some(p => p.length === 0)) errorText = 'Enter both first and last name.';
    }
    if (name === 'phone') {
      if (!value || !/^[6-9]\d{9}$/.test(value)) errorText = 'Enter a valid 10-digit whatsapp number.';
    }
    if (name === 'email') {
      if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errorText = 'Enter a valid email address.';
    }
    if (name === 'pincode') {
      if (!value || !/^\d{6}$/.test(value)) errorText = 'Enter a valid 6-digit pincode.';
    }
    setErrors(prev => ({ ...prev, [name]: errorText }));
  };

  const validateForm = () => {
    const newErrors = {};
    const nameParts = formData.fullName ? formData.fullName.trim().split(/\s+/) : [];
    if (!formData.fullName || nameParts.length < 2 || nameParts.some(p => p.length === 0)) newErrors.fullName = 'Enter both first and last name.';
    if (!formData.phone || !/^[6-9]\d{9}$/.test(formData.phone)) newErrors.phone = 'Enter a valid 10-digit whatsapp number.';
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Enter a valid email address.';
    if (!formData.pincode || !/^\d{6}$/.test(formData.pincode)) newErrors.pincode = 'Enter a valid 6-digit pincode.';
    if (!formData.consent) newErrors.consent = 'Please accept the consent to continue.';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Send Step 1 OTP
  const sendStep1Otp = async () => {
    const { phone } = formData;
    if (phone.length !== 10) return;
    setIsSubmitting(true);
    setStatus({ type: '', message: '' });
    
    try {
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
          setSimulatedOtpText(data.simulatedOtp);
        } else {
          setSimulatedOtpText('');
        }
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to send verification code. Please try again.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Network error. Unable to contact verification servers.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verify OTP
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
        setOtpStatus('Verified successfully!');
        isPhoneVerifiedRef.current = true;
        setIsPhoneVerified(true);
        setIsSubmitting(false);
        setTimeout(() => {
          setShowOtpModal(false);
          setOtpVal('');
          // Automatically trigger form submission now that verification is complete
          setTimeout(() => {
            submitLead();
          }, 100);
        }, 1500);
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

  const handleInitialSubmit = (e) => {
    e.preventDefault();
    if (formData.company) return; // honeypot
    if (!validateForm()) return;
    
    if (!isPhoneVerifiedRef.current) {
      sendStep1Otp();
    } else {
      submitLead();
    }
  };

  const submitLead = async () => {
    setIsSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      const savedUtmStr = sessionStorage.getItem('finmantra_utm');
      const savedUtm = savedUtmStr ? JSON.parse(savedUtmStr) : {};
      const mergedUtm = { ...savedUtm, ...(utmParams || {}) };

      const payload = {
        full_name: formData.fullName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim().toLowerCase(),
        pincode: formData.pincode.trim(),
        consent: formData.consent,
        source: 'scapia',
        product: "Scapia Federal Credit Card",
        landingPageUrl: window.location.href,
        referrer: document.referrer,
        ...mergedUtm,
        utm_params: mergedUtm
      };

      const response = await fetch(`${API_URL}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "We could not submit your details right now. Please try again.");
      }

      trackLeadSubmission({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        eventId: data.urn,
        contentName: 'Scapia Lead Submitted',
        status: 'submitted'
      });

      // Redirection logic identical to KiwiLanding
      let finalUrl = data.redirectUrl;
      console.log('[Scapia Redirect] Raw redirectUrl from server:', finalUrl);

      const isDesktop = /Windows|Macintosh|MacIntel|Linux x86_64/i.test(navigator.userAgent || '') || 
                        /Win32|MacIntel|Win64/i.test(navigator.platform || '');
      const isAndroid = /Android/i.test(navigator.userAgent || '');

      if ((isDesktop || !isAndroid) && finalUrl && finalUrl.includes('sng.link')) {
        try {
          const resolveRes = await fetch(`${API_URL}/resolve-singular?url=${encodeURIComponent(finalUrl)}`);
          const resolveData = await resolveRes.json();
          if (resolveRes.ok && resolveData.resolvedUrl) {
            finalUrl = resolveData.resolvedUrl;
          }
        } catch (resolveErr) {
          console.error('[Scapia Redirect] Server-side resolution failed:', resolveErr);
        }
      }

      if (finalUrl && String(finalUrl).startsWith('intent://')) {
        const fbMatch = String(finalUrl).match(/S\.browser_fallback_url=([^;]+)/);
        if (fbMatch && fbMatch[1]) {
          try {
            finalUrl = decodeURIComponent(fbMatch[1]);
          } catch (decodeErr) {}
        }
      }

      if (finalUrl) {
        window.location.replace(finalUrl);
      } else {
        setStatus({ type: 'success', message: 'Thank you. Your details have been received and the FinMantra team will contact you shortly.' });
        setFormData({
          fullName: '',
          phone: '',
          email: '',
          pincode: '',
          consent: false,
          company: ''
        });
      }

    } catch(err) {
      setStatus({ type: 'error', message: err.message || "We could not submit your details right now. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        :root{--ink:#111b2e;--night:#1b123b;--violet:#332166;--coral:#ff5b4d;--salmon:#ff806b;--peach:#ffc591;--cream:#fff7ed;--mist:#eef3f5;--line:#dce4e8;--muted:#647181;--error:#b42318;--success:#137a4a}
        .scapia-body{margin:0;background:var(--mist);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
        .scapia-body button,.scapia-body input{font:inherit}.scapia-body a{color:inherit;text-decoration:none}.scapia-body :focus-visible{outline:3px solid var(--peach);outline-offset:3px}
        .scapia-topbar{align-items:center;background:rgba(23,15,52,.93);border-bottom:1px solid rgba(255,255,255,.1);color:var(--cream);display:grid;grid-template-columns:1fr auto 1fr;min-height:68px;padding:0 clamp(20px,5vw,72px);position:sticky;top:0;z-index:50;backdrop-filter:blur(14px)}
        .scapia-brand{font-size:22px;font-weight:800;letter-spacing:-.055em}.scapia-brand span{color:var(--coral)}.scapia-topbar p{color:#decfe7;font-size:12px;letter-spacing:.05em;margin:0}.scapia-nav-cta{background:var(--coral);border-radius:99px;color:var(--night);font-size:14px;font-weight:800;justify-self:end;padding:11px 18px; display:inline-block; text-align:center;}
        .scapia-hero{background:radial-gradient(circle at 82% 4%,rgba(255,197,145,.3),transparent 30%),linear-gradient(145deg,#171036,#251753 42%,#50306f 72%,#a74461);color:var(--cream);min-height:calc(100vh - 68px);overflow:hidden;position:relative}.scapia-hero:before{background-image:radial-gradient(rgba(255,255,255,.72) .8px,transparent .8px);background-size:92px 92px;content:"";inset:0;opacity:.22;position:absolute}.scapia-hero-inner{align-items:center;display:grid;gap:clamp(44px,6vw,92px);grid-template-columns:minmax(0,1.08fr) minmax(390px,.72fr);margin:auto;max-width:1240px;min-height:calc(100vh - 68px);padding:56px 32px 64px;position:relative;z-index:2}.scapia-hero-copy{max-width:690px}.scapia-eyebrow{color:#ffd9c7;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:.24em;margin:0 0 22px}.scapia-hero h1{font-size:clamp(58px,7.3vw,102px);font-weight:800;letter-spacing:-.075em;line-height:.88;margin:0}.scapia-hero h1 em{color:#ffb66b;font-family:Georgia,serif;font-weight:400;letter-spacing:-.04em}.scapia-hero h1>span{color:var(--salmon)}.scapia-hero h1>span em{color:var(--cream)}.scapia-hero-lead{color:#f0e3df;font-size:clamp(17px,1.5vw,21px);line-height:1.48;margin:28px 0 0;max-width:610px}.scapia-hero-benefits{display:grid;gap:12px;grid-template-columns:repeat(3,1fr);margin-top:30px;max-width:640px}.scapia-hero-benefits div{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:15px;min-height:92px;padding:14px 15px}.scapia-hero-benefits strong{color:var(--peach);display:block;font-size:27px;letter-spacing:-.04em}.scapia-hero-benefits span{color:#f0e3df;display:block;font-size:12px;line-height:1.35;margin-top:7px}.scapia-hero-note{color:#dfd0df;font-size:12px;margin:20px 0 0}.scapia-hero-note span{color:var(--peach)}.scapia-hero sup{font-size:.62em}
        .scapia-flight-path{border-top:2px dashed rgba(255,221,195,.5);border-radius:50%;height:260px;left:-40px;position:absolute;top:55px;transform:rotate(-9deg);width:58%}.scapia-flight-path:before{background:var(--peach);border-radius:50%;content:"";height:10px;left:5%;position:absolute;top:-6px;width:10px}.scapia-flight-path:after{color:var(--peach);content:"✦";font-size:19px;position:absolute;right:3%;top:-12px}
        .scapia-lead-card{background:rgba(255,255,255,.98);border:1px solid rgba(255,255,255,.65);border-radius:24px;box-shadow:0 30px 80px rgba(7,3,24,.38);color:var(--ink);padding:28px;scroll-margin-top:90px}.scapia-form-head{border-bottom:1px solid var(--line);margin-bottom:20px;padding-bottom:18px}.scapia-form-kicker{color:#a33a35;font-family:ui-monospace,monospace;font-size:10px;font-weight:800;letter-spacing:.14em}.scapia-form-head h2{font-size:30px;letter-spacing:-.045em;line-height:1.05;margin:8px 0 7px}.scapia-form-head p{color:var(--muted);font-size:13px;line-height:1.45;margin:0}.scapia-field+.scapia-field,.scapia-field-row+.scapia-field{margin-top:13px}.scapia-field-row{display:grid;gap:12px;grid-template-columns:1.4fr .8fr;margin-top:13px}.scapia-field label{display:block;font-size:12px;font-weight:750;margin-bottom:6px}.scapia-field input{background:#fbfcfd;border:1.5px solid #cfd9df;border-radius:10px;color:var(--ink);min-height:46px;padding:11px 13px;width:100%}.scapia-field input:focus{border-color:var(--violet);outline:2px solid rgba(51,33,102,.12)}.scapia-field input.scapia-err{background:#fff8f7;border-color:var(--error)}.scapia-phone-input{align-items:center;background:#fbfcfd;border:1.5px solid #cfd9df;border-radius:10px;display:flex;min-height:46px; width:100%}.scapia-phone-input:focus-within{border-color:var(--violet);outline:2px solid rgba(51,33,102,.12)}.scapia-phone-input>span{border-right:1px solid #d5dde2;color:#52606d;font-size:13px;padding:0 10px}.scapia-phone-input input{border:0;min-height:43px;outline:0!important;padding-left:10px; flex:1; width:100%; border-radius: 0 10px 10px 0;}.scapia-field-error{color:var(--error);display:block;font-size:10.5px;min-height:14px;padding-top:3px}.scapia-consent{align-items:flex-start;color:#5d6977;cursor:pointer;display:flex;font-size:10.5px;gap:9px;line-height:1.45;margin-top:12px}.scapia-consent input{accent-color:var(--coral);flex:0 0 auto;height:16px;margin-top:1px;width:16px}.scapia-consent-error{padding-left:25px}.scapia-submit{background:var(--coral);border:0;border-radius:99px;color:var(--night);cursor:pointer;font-size:15px;font-weight:800;margin-top:15px;min-height:50px;padding:12px 20px;width:100%}.scapia-submit:disabled{cursor:not-allowed;opacity:.55}.scapia-security-note{color:#75818d;font-size:10px;line-height:1.35;margin:10px 0 0;text-align:center}.scapia-hp{height:1px;left:-9999px;overflow:hidden;position:absolute;width:1px}.scapia-status{align-items:flex-start;border:1px solid;border-radius:13px;display:none;gap:10px;margin:0 0 18px;padding:13px}.scapia-status.show{display:flex}.scapia-status p{font-size:12px;line-height:1.45;margin:0}.scapia-status.ok{background:#effaf4;border-color:#b8e6cd;color:var(--success)}.scapia-status.bad{background:#fff2f0;border-color:#f0c7c1;color:var(--error)}
        .scapia-strip{align-items:center;background:var(--cream);border-bottom:1px solid #eadfd3;display:flex;gap:clamp(24px,5vw,76px);justify-content:center;min-height:68px;padding:14px 32px}.scapia-strip p{color:#443b45;font-size:12px;font-weight:700;margin:0}.scapia-strip span{color:var(--coral);margin-right:7px}
        .scapia-section{padding:96px max(24px,calc((100vw - 1180px)/2));text-align:center}.scapia-kicker{color:#a13f39;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.22em;margin:0}.scapia-section h2,.scapia-steps h2,.scapia-faq h2{font-size:clamp(40px,5vw,64px);letter-spacing:-.06em;line-height:.98;margin:15px 0 18px}.scapia-section h2 em,.scapia-faq h2 em{color:var(--coral);font-family:Georgia,serif;font-weight:400}.scapia-section>.scapia-lead{color:var(--muted);font-size:17px;margin:0 auto;max-width:560px}.scapia-features{display:grid;gap:16px;grid-template-columns:repeat(4,1fr);margin-top:50px;text-align:left}.scapia-features article{background:#fff;border:1px solid var(--line);border-radius:20px;min-height:260px;padding:26px}.scapia-mark{align-items:center;background:#fff0eb;border-radius:12px;color:var(--coral);display:inline-flex;font-family:ui-monospace,monospace;font-weight:800;height:44px;justify-content:center;min-width:44px;padding:0 10px}.scapia-features h3{font-size:20px;letter-spacing:-.03em;line-height:1.15;margin:20px 0 10px}.scapia-features p{color:var(--muted);font-size:14px;line-height:1.55;margin:0}
        .scapia-stories{background:#fff9f3;border-block:1px solid #eadfd4;padding:96px max(24px,calc((100vw - 1180px)/2));text-align:left}.scapia-stories-head{align-items:end;display:grid;gap:50px;grid-template-columns:1.2fr .8fr}.scapia-stories h2{font-size:clamp(40px,5vw,62px);letter-spacing:-.06em;line-height:.98;margin:14px 0 0}.scapia-stories h2 em{color:var(--coral);font-family:Georgia,serif;font-weight:400}.scapia-stories-head>p{color:var(--muted);font-size:16px;line-height:1.6;margin:0}.scapia-story-grid{display:grid;gap:16px;grid-template-columns:repeat(3,1fr);margin-top:40px}.scapia-story{background:linear-gradient(150deg,#201641,#4e2d71 62%,#b84c61);border-radius:20px;color:var(--cream);min-height:300px;overflow:hidden;padding:28px;position:relative}.scapia-story:after{border-top:2px dashed rgba(255,220,194,.65);border-radius:50%;content:"";height:130px;left:-20px;position:absolute;top:88px;transform:rotate(-14deg);width:115%}.scapia-story small{color:#ffd5c0;font-family:ui-monospace,monospace;letter-spacing:.13em}.scapia-story h3{font-size:40px;letter-spacing:-.06em;line-height:.94;margin:80px 0 10px;position:relative;z-index:2}.scapia-story h3 span{color:var(--salmon)}.scapia-story p{color:#eadde4;font-size:13px;margin:0;position:relative;z-index:2}
        .scapia-steps{background:linear-gradient(145deg,#171036,#2d1c5c 65%,#4e2b6b);color:var(--cream);padding:100px max(24px,calc((100vw - 1180px)/2))}.scapia-light{color:#ffc6a8}.scapia-steps-grid{display:grid;gap:16px;grid-template-columns:repeat(3,1fr);margin-top:44px}.scapia-steps-grid article{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.16);border-radius:20px;padding:28px}.scapia-steps-grid article>span{color:var(--peach);font-family:ui-monospace,monospace;font-size:12px;letter-spacing:.15em}.scapia-steps-grid h3{font-size:21px;margin:28px 0 8px}.scapia-steps-grid p{color:#d9cedd;font-size:14px;line-height:1.55;margin:0}.scapia-steps .scapia-button{background:var(--coral);border-radius:99px;color:var(--night);display:inline-flex;font-weight:800;margin-top:34px;padding:15px 23px}
        .scapia-faq{background:#fff;display:grid;gap:80px;grid-template-columns:.72fr 1.28fr;padding:100px max(24px,calc((100vw - 1180px)/2))}.scapia-faq-heading{align-self:start;position:sticky;top:100px}.scapia-faq-list details{border-bottom:1px solid var(--line)}.scapia-faq-list details:first-child{border-top:1px solid var(--line)}.scapia-faq summary{cursor:pointer;font-size:17px;font-weight:750;list-style:none;padding:23px 38px 23px 0;position:relative}.scapia-faq summary::-webkit-details-marker{display:none}.scapia-faq summary:after{color:var(--coral);content:"+";font-size:24px;position:absolute;right:5px;top:17px}.scapia-faq details[open] summary:after{content:"\\2013"}.scapia-faq details p{color:var(--muted);font-size:14px;line-height:1.65;margin:-5px 0 24px;padding-right:25px}
        .scapia-footer{background:#101a2c;color:#c7d0d7;padding:58px max(24px,calc((100vw - 1180px)/2)) 38px}.scapia-footer-top{display:grid;gap:45px;grid-template-columns:.6fr 1.5fr .8fr}.scapia-footer-top p{font-size:13px;line-height:1.65;margin:0}.scapia-footer-links{display:flex;flex-direction:column;gap:9px}.scapia-footer-links a{color:#fff2e9;font-size:13px;text-decoration:underline;text-underline-offset:4px}.scapia-legal{border-top:1px solid rgba(255,255,255,.1);color:#84929e;font-size:10.5px;line-height:1.6;margin-top:38px;padding-top:24px}.scapia-legal p{margin:0 0 10px}.scapia-mobile-sticky{display:none}
        @media(max-width:960px){.scapia-topbar{grid-template-columns:1fr auto}.scapia-topbar p{display:none}.scapia-hero-inner{grid-template-columns:1fr;max-width:720px}.scapia-hero-copy{text-align:center}.scapia-hero-benefits{margin-inline:auto;text-align:left}.scapia-lead-card{margin:auto;max-width:520px;width:100%}.scapia-strip{align-items:flex-start;flex-direction:column;gap:8px}.scapia-features{grid-template-columns:1fr 1fr}.scapia-stories-head,.scapia-faq{grid-template-columns:1fr}.scapia-faq-heading{position:static}.scapia-footer-top{grid-template-columns:1fr 2fr}.scapia-footer-links{grid-column:2}}
        @media(max-width:600px){.scapia-topbar{min-height:60px;padding:0 18px}.scapia-brand{font-size:20px}.scapia-nav-cta{font-size:12px;padding:9px 13px}.scapia-hero{min-height:auto}.scapia-hero-inner{gap:32px;min-height:auto;padding:44px 16px 38px}.scapia-hero-copy{text-align:left}.scapia-eyebrow{font-size:10px;margin-bottom:17px}.scapia-hero h1{font-size:clamp(52px,17vw,74px)}.scapia-hero-lead{font-size:16px;margin-top:22px}.scapia-hero-benefits{gap:8px;grid-template-columns:1fr 1fr;margin-top:24px}.scapia-hero-benefits div{min-height:82px;padding:12px}.scapia-hero-benefits div:last-child{grid-column:1/-1;min-height:70px}.scapia-lead-card{border-radius:20px;padding:22px 18px}.scapia-field-row{grid-template-columns:1fr}.scapia-field-row .scapia-field+.scapia-field{margin-top:0}.scapia-strip{padding:18px 20px}.scapia-section,.scapia-stories,.scapia-steps,.scapia-faq{padding:72px 20px}.scapia-features,.scapia-story-grid,.scapia-steps-grid{grid-template-columns:1fr}.scapia-features article{min-height:0}.scapia-stories-head{align-items:start;gap:18px}.scapia-story{min-height:265px}.scapia-footer-top{grid-template-columns:1fr}.scapia-footer-links{grid-column:auto}.scapia-footer{padding:54px 20px 96px}.scapia-mobile-sticky{background:var(--coral);border-radius:99px;bottom:12px;box-shadow:0 12px 30px rgba(27,18,59,.28);color:var(--night);display:flex;font-size:14px;font-weight:800;justify-content:space-between;left:16px;padding:15px 20px;position:fixed;right:16px;z-index:60}}
        @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
        
        /* Modal Styles matching Kiwi OTP Modal */
        .scapia-modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(17,27,46,0.65); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 20px; animation: scapia-fadein 0.2s ease;
        }
        .scapia-modal {
          background: #fff; width: 100%; max-width: 440px; border-radius: 24px;
          padding: 36px 32px; box-shadow: 0 24px 48px rgba(0,0,0,0.12);
          position: relative; animation: scapia-scalein 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes scapia-fadein { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scapia-scalein { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .scapia-modal-close {
          position: absolute; top: 18px; right: 18px; background: #f3f5f8;
          border: none; width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #647181; cursor: pointer; transition: background 0.15s;
        }
        .scapia-modal-close:hover { background: #e2e8f0; color: #111b2e; }
        .scapia-modal-title { font-size: 22px; font-weight: 800; color: #111b2e; margin-bottom: 8px; letter-spacing:-0.03em; }
        .scapia-modal-subtitle { font-size: 14px; color: #647181; margin-bottom: 24px; line-height: 1.5; }
        .scapia-otp-input {
          width: 100%; font-size: 24px; font-weight: 700; letter-spacing: 0.3em;
          text-align: center; padding: 12px; border: 2px solid #dce4e8;
          border-radius: 12px; background: #fbfcfd; color: #111b2e; margin-bottom: 16px;
        }
        .scapia-otp-input:focus { outline: none; border-color: #ff5b4d; background: #fff; }
        .scapia-modal-btn {
          width: 100%; background: #ff5b4d; color: #1b123b; font-weight: 800;
          font-size: 16px; padding: 14px; border: none; border-radius: 999px;
          cursor: pointer; transition: transform 0.15s;
        }
        .scapia-modal-btn:hover { transform: translateY(-2px); }
        .scapia-modal-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .scapia-resend { font-size: 13px; color: #647181; text-align: center; margin-top: 20px; }
        .scapia-resend-btn {
          background: none; border: none; color: #ff5b4d; font-weight: 700;
          cursor: pointer; padding: 0 4px; display: inline-flex; align-items: center; gap: 4px;
        }
        .scapia-resend-btn:disabled { color: #a0aec0; cursor: not-allowed; }
        .scapia-otp-status { font-size: 13px; text-align: center; margin-top: 12px; font-weight: 600; color: #137a4a; }
        .scapia-sim-otp {
          margin-top: 20px; padding: 12px; background: #f0fdf4; border: 1px dashed #bbf7d0;
          border-radius: 12px; font-size: 12px; color: #166534; display: flex; align-items: flex-start; gap: 8px;
        }
      `}} />

      <div className="scapia-body">
        <header className="scapia-topbar">
          <a className="scapia-brand" href="#top" aria-label="FinMantra home" onClick={(e)=>{e.preventDefault(); navigateTo('/');}}>fin<span>mantra</span></a>
          <p>Application assistance for the Scapia Federal Credit Card</p>
          <a className="scapia-nav-cta" href="#apply">Check eligibility &rarr;</a>
        </header>

        <main>
          <section className="scapia-hero" id="top">
            <div className="scapia-flight-path" aria-hidden="true"></div>
            <div className="scapia-hero-inner">
              <div className="scapia-hero-copy">
                <p className="scapia-eyebrow">SCAPIA FEDERAL CREDIT CARD</p>
                <h1>Spend <em>here.</em><br/><span>Land <em>there.</em></span></h1>
                <p className="scapia-hero-lead">Turn everyday eligible spends into Scapia Coins for travel&mdash;while paying zero forex markup abroad and zero joining or annual fees.</p>
                <div className="scapia-hero-benefits">
                  <div><strong>0%</strong><span>forex markup</span></div>
                  <div><strong>&#x20B9;0</strong><span>joining &amp; annual fee</span></div>
                  <div><strong>10%</strong><span>rewards on eligible Visa spends<sup>*</sup></span></div>
                </div>
                <p className="scapia-hero-note"><span>&#x2713;</span> Fully digital application &middot; Card approval by Federal Bank</p>
              </div>

              <aside className="scapia-lead-card" id="apply">
                <div className="scapia-form-head"><span className="scapia-form-kicker">TAKES ABOUT 30 SECONDS</span><h2>Check your eligibility</h2><p>Share your details to start your Scapia card application with FinMantra.</p></div>
                
                {status.type === 'success' && (
                  <div className="scapia-status ok show" role="status"><p>{status.message}</p></div>
                )}
                {status.type === 'error' && (
                  <div className="scapia-status bad show" role="alert"><p>{status.message}</p></div>
                )}
                
                <form id="leadForm" noValidate onSubmit={handleInitialSubmit}>
                  <div className="scapia-hp" aria-hidden="true">
                    <label>Company<input name="company" tabIndex="-1" autoComplete="off" value={formData.company} onChange={handleInputChange} /></label>
                  </div>
                  
                  <div className="scapia-field">
                    <label htmlFor="fullName">Full name</label>
                    <input id="fullName" name="fullName" autoComplete="name" placeholder="As mentioned on PAN" value={formData.fullName} onChange={handleInputChange} className={errors.fullName ? 'scapia-err' : ''} />
                    <span className="scapia-field-error">{errors.fullName}</span>
                  </div>
                  
                  <div className="scapia-field-row">
                    <div className="scapia-field">
                      <label htmlFor="mobile">WhatsApp number</label>
                      <div className="scapia-phone-input" style={{borderColor: errors.phone ? 'var(--error)' : ''}}>
                        <span>+91</span>
                        <input id="mobile" name="phone" type="tel" inputMode="numeric" maxLength="10" autoComplete="tel-national" placeholder="10-digit number" value={formData.phone} onChange={handleInputChange} />
                      </div>
                      <span className="scapia-field-error">{errors.phone}</span>
                    </div>
                    <div className="scapia-field">
                      <label htmlFor="pincode">Pincode</label>
                      <input id="pincode" name="pincode" inputMode="numeric" maxLength="6" autoComplete="postal-code" placeholder="6 digits" value={formData.pincode} onChange={handleInputChange} className={errors.pincode || pincodeError ? 'scapia-err' : ''} />
                      <span className="scapia-field-error">{errors.pincode || pincodeError}</span>
                      {pincodeLoading && <span style={{fontSize: '11px', color: '#647181', display: 'block', marginTop: '2px'}}>Looking up...</span>}
                      {pincodeLocationText && !pincodeError && <span style={{fontSize: '11px', color: '#137a4a', display: 'block', marginTop: '2px'}}>{pincodeLocationText}</span>}
                    </div>
                  </div>
                  
                  <div className="scapia-field">
                    <label htmlFor="email">Email address</label>
                    <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={formData.email} onChange={handleInputChange} className={errors.email ? 'scapia-err' : ''} />
                    <span className="scapia-field-error">{errors.email}</span>
                  </div>
                  
                  <label className="scapia-consent">
                    <input id="consent" name="consent" type="checkbox" checked={formData.consent} onChange={handleInputChange} />
                    <span>I consent to being contacted by FinMantra, Scapia and/or the issuing bank through call, SMS, email or WhatsApp about this application.</span>
                  </label>
                  <span className="scapia-field-error scapia-consent-error">{errors.consent}</span>
                  
                  <button className="scapia-submit" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting...' : 'Check eligibility \u2192'}
                  </button>
                  <p className="scapia-security-note">&#9679; Your information is encrypted in transit and used only for this application.</p>
                </form>
              </aside>
            </div>
          </section>

          <section className="scapia-strip"><p><span>&#x2726;</span>Airport privileges after meeting monthly spend criteria<sup>*</sup></p><p><span>&#x2726;</span>Scapia Coins redeemable for travel in the Scapia app<sup>*</sup></p><p><span>&#x2726;</span>Visa + RuPay card options<sup>*</sup></p></section>

          <section className="scapia-section" id="benefits">
            <p className="scapia-kicker">WHY SCAPIA</p><h2>Everyday spending.<br/><em>Travel-worthy rewards.</em></h2><p className="scapia-lead">Built for people who would rather turn routine expenses into their next trip.</p>
            <div className="scapia-features">
              <article><span className="scapia-mark">0%</span><h3>Spend abroad without forex markup</h3><p>Pay in foreign currency without the usual card forex markup. Network conversion rates and applicable taxes may still apply.</p></article>
              <article><span className="scapia-mark">&#x20B9;0</span><h3>No joining or annual fee</h3><p>Use a travel-focused card without a joining fee, annual membership fee or spend-based fee waiver target.</p></article>
              <article><span className="scapia-mark">10%</span><h3>Rewards on eligible Visa spends</h3><p>Earn rewards on eligible online and offline spends. Five Scapia Coins are currently worth &#x20B9;1 on eligible redemptions.</p></article>
              <article><span className="scapia-mark">&#x2726;</span><h3>Airport privileges that go further</h3><p>Unlock domestic lounge, dining, shopping or spa privileges after meeting the preceding monthly spend requirement.</p></article>
            </div>
          </section>

          <section className="scapia-stories">
            <div className="scapia-stories-head"><div><p className="scapia-kicker">SPEND HERE. LAND THERE.</p><h2>Your routine can fund<br/><em>your next escape.</em></h2></div><p>Groceries, coffee or your daily commute&mdash;eligible spends add Scapia Coins that can be redeemed for travel in the Scapia app.</p></div>
            <div className="scapia-story-grid"><article className="scapia-story"><small>GROCERIES &rarr; BALI</small><h3>Spend here.<br/><span>Land there.</span></h3><p>Everyday eligible purchases can build toward travel.</p></article><article className="scapia-story"><small>COFFEE &rarr; AIRPORT</small><h3>Sip here.<br/><span>Fly there.</span></h3><p>Small eligible spends can add up over time.</p></article><article className="scapia-story"><small>METRO &rarr; BANGKOK</small><h3>Ride here.<br/><span>Roam there.</span></h3><p>Redeem Scapia Coins through the Scapia app.</p></article></div>
          </section>

          <section className="scapia-steps"><p className="scapia-kicker scapia-light">A SIMPLE START</p><h2>From form to first swipe.</h2><div className="scapia-steps-grid"><article><span>01</span><h3>Share your details</h3><p>Complete the short form. FinMantra will help you begin the application.</p></article><article><span>02</span><h3>Complete digital checks</h3><p>Proceed through the bank and Scapia&rsquo;s eligibility, KYC and approval process.</p></article><article><span>03</span><h3>Start earning</h3><p>Once approved and activated, eligible everyday spends begin earning rewards.</p></article></div><a className="scapia-button" href="#apply">Check eligibility &rarr;</a></section>

          <section className="scapia-faq"><div className="scapia-faq-heading"><p className="scapia-kicker">BEFORE YOU APPLY</p><h2>Clear answers.<br/><em>No fine-print fog.</em></h2></div><div className="scapia-faq-list">
            <details><summary>Is the Scapia Federal Credit Card lifetime free?</summary><p>The card currently has zero joining fee and zero annual membership fee. Other charges such as interest, late fees, cash withdrawal fees and applicable taxes can still apply.</p></details>
            <details><summary>Does zero forex mean there are no charges at all abroad?</summary><p>Scapia currently charges 0% forex markup on eligible international card transactions. Card-network rates, merchant-selected dynamic currency conversion and other transaction-specific charges may still apply.</p></details>
            <details><summary>How do the rewards work?</summary><p>Eligible purchases earn rewards converted into Scapia Coins. The current redemption value is 5 Coins = &#x20B9;1 for eligible services in the Scapia app. Exclusions and minimum transaction values apply.</p></details>
            <details><summary>Is airport lounge access unconditional?</summary><p>No. Domestic airport privileges are unlocked after meeting the required spend in the preceding billing cycle. The current threshold is governed by Scapia and Federal Bank terms.</p></details>
            <details><summary>Does submitting this form guarantee approval?</summary><p>No. FinMantra assists with the application. Federal Bank independently evaluates eligibility, creditworthiness, KYC and documentation.</p></details>
          </div></section>
        </main>

        <footer className="scapia-footer"><div className="scapia-footer-top"><a className="scapia-brand" href="#top" onClick={(e)=>{e.preventDefault(); navigateTo('/');}}>fin<span>mantra</span></a><p>FinMantra provides application assistance and does not issue the card or make credit decisions. The Scapia Federal Credit Card is issued by Federal Bank.</p><div className="scapia-footer-links"><a href="https://www.scapia.cards/" target="_blank" rel="noreferrer">Official Scapia website</a><a href="https://www.scapia.cards/legal/scapia-federal-general-tnc-card-holder-agreement" target="_blank" rel="noreferrer">Card terms</a></div></div><div className="scapia-legal"><p><strong>*Important:</strong> Benefits, reward rates, redemption values, eligible categories, exclusions, airport privileges and thresholds are subject to the issuer&rsquo;s latest terms. At present, domestic airport privileges require &#x20B9;20,000 total monthly spend per user in the preceding billing cycle. Forex markup is 0%; international transactions do not earn Scapia rewards.</p><p>Card approval, credit limit and issuance are at Federal Bank&rsquo;s sole discretion. Terms and conditions apply.</p><p>&copy; {new Date().getFullYear()} FinMantra. Scapia and Federal Bank names and marks belong to their respective owners.</p></div></footer>
        <a className="scapia-mobile-sticky" href="#apply">Check eligibility <span>&rarr;</span></a>

        {/* OTP Modal */}
        {showOtpModal && (
          <div className="scapia-modal-overlay">
            <div className="scapia-modal">
              <button className="scapia-modal-close" onClick={() => setShowOtpModal(false)}><X size={18} /></button>
              <h3 className="scapia-modal-title">Verify WhatsApp Number</h3>
              <p className="scapia-modal-subtitle">We've sent a 6-digit OTP to +91 {formData.phone} via WhatsApp.</p>
              
              <input 
                type="text" 
                className="scapia-otp-input" 
                maxLength="6" 
                placeholder="------"
                value={otpVal}
                onChange={(e) => setOtpVal(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />

              <button 
                className="scapia-modal-btn" 
                onClick={handleVerifyOtp} 
                disabled={otpVal.length !== 6 || isSubmitting}
              >
                {isSubmitting ? 'Verifying...' : 'Verify OTP & Continue'}
              </button>
              
              {otpStatus && (
                <div className="scapia-otp-status" style={{color: otpStatus.includes('failed') || otpStatus.includes('error') ? '#b42318' : '#137a4a'}}>
                  {otpStatus}
                </div>
              )}

              <div className="scapia-resend">
                Didn't receive it? 
                <button 
                  className="scapia-resend-btn" 
                  onClick={handleResendOtp} 
                  disabled={resendTimer > 0 || isSubmitting}
                >
                  <RefreshCw size={14} style={{ animation: isSubmitting ? 'spin 1s linear infinite' : 'none' }} />
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                </button>
              </div>

              {simulatedOtpText && (
                <div className="scapia-sim-otp">
                  <ShieldAlert size={16} />
                  <div>
                    <strong>Test Environment Active</strong><br/>
                    {simulatedOtpText}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
