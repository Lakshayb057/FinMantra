import React, { useState, useEffect, useRef } from 'react';
import { trackLeadSubmission, initAnalytics, resolveRedirectUrl } from '../utils/analytics';
import { RefreshCw, X, ShieldAlert } from 'lucide-react';

export default function ScapiaLanding({ navigateTo, utmParams }) {
  const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173') ? 'http://localhost:5000/api' : '/api';

  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    pan_no: '',
    phone: '',
    email: '',
    pincode: '',
    employment: '',
    address_city: '',
    address_state: '',
    address_locality: '',
    consent: false,
    company: '' // honeypot
  });

  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ type: '', message: '' }); // 'success' or 'error'
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);

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

    if (name === 'pan_no') {
      const cleanVal = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      setFormData(prev => ({ ...prev, [name]: cleanVal }));
      validateField(name, cleanVal);
      return;
    }

    if (name === 'phone' || name === 'mobile' || name === 'pincode') {
      const fieldName = name === 'mobile' ? 'phone' : name;
      const cleanVal = value.replace(/\D/g, '').slice(0, fieldName === 'phone' ? 10 : 6);
      setFormData(prev => ({ ...prev, [fieldName]: cleanVal }));
      validateField(fieldName, cleanVal);
      return;
    }

    const fieldName = name === 'name' ? 'fullName' : name;
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    validateField(fieldName, value);
  };

  const validateField = (name, value) => {
    let errorText = '';
    if (name === 'fullName' || name === 'name') {
      const parts = value.trim().split(/\s+/);
      if (!value || parts.length < 2 || parts.some(p => p.length === 0)) errorText = 'Enter both first and last name.';
    }
    if (name === 'pan_no') {
      if (!value || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value)) errorText = 'Enter a valid 10-character PAN number (e.g. ABCDE1234F).';
    }
    if (name === 'phone' || name === 'mobile') {
      if (!value || !/^[6-9]\d{9}$/.test(value)) errorText = 'Enter a valid 10-digit mobile number.';
    }
    if (name === 'email') {
      if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errorText = 'Enter a valid email address.';
    }
    if (name === 'pincode') {
      if (!value || !/^\d{6}$/.test(value)) errorText = 'Enter a valid 6-digit pincode.';
    }
    if (name === 'employment') {
      if (!value) errorText = 'Please select an employment option.';
    }
    setErrors(prev => ({ ...prev, [name]: errorText, [(name === 'fullName' ? 'name' : name)]: errorText }));
  };

  const validateForm = () => {
    const newErrors = {};
    const nameParts = formData.fullName ? formData.fullName.trim().split(/\s+/) : [];
    if (!formData.fullName || nameParts.length < 2 || nameParts.some(p => p.length === 0)) {
      newErrors.fullName = 'Please enter your full name (first and last name).';
      newErrors.name = 'Please enter your full name.';
    }
    if (!formData.pan_no || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan_no)) {
      newErrors.pan_no = 'Enter a valid 10-character PAN number (e.g. ABCDE1234F).';
    }
    if (!formData.phone || !/^[6-9]\d{9}$/.test(formData.phone)) {
      newErrors.phone = 'Enter a valid 10-digit mobile number.';
      newErrors.mobile = 'Enter a valid 10-digit mobile number.';
    }
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Enter a valid email address.';
    }
    if (!formData.pincode || !/^\d{6}$/.test(formData.pincode)) {
      newErrors.pincode = 'Enter a valid 6-digit pincode.';
    }
    if (!formData.employment) {
      newErrors.employment = 'Please choose an option.';
    }
    if (!formData.consent) {
      newErrors.consent = 'Please accept the consent to continue.';
    }
    
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
        pan_no: formData.pan_no.trim().toUpperCase(),
        phone: formData.phone.trim(),
        email: formData.email.trim().toLowerCase(),
        pincode: formData.pincode.trim(),
        employment: formData.employment,
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
        setIsSubmittedSuccess(true);
        setStatus({ type: 'success', message: 'You\'re in — details received. A FinMantra advisor will call you shortly to help you apply.' });
        setFormData({
          fullName: '',
          pan_no: '',
          phone: '',
          email: '',
          pincode: '',
          employment: '',
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
        @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&family=Geist+Mono:wght@400;500;600;700&family=Geist:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
        :root{
          --ink:#070E28; --night:#0E1A46; --indigo:#22306E; --violet:#5B3B86;
          --ember:#FF7A4D; --amber:#FFC163; --glow:#FF9A6B;
          --haze:#EFF2FC; --haze2:rgba(239,242,252,.64); --line:rgba(239,242,252,.14);
          --card-bg:rgba(255,255,255,.035); --form-bg:rgba(9,15,40,.72);
          --display:'Hanken Grotesk', sans-serif; --body:'Geist Sans', sans-serif; --mono:'Geist Mono', monospace; --serif:'Instrument Serif', serif;
          --maxw:1180px;
        }
        *{margin:0;padding:0;box-sizing:border-box}
        html{scroll-behavior:smooth}
        .scapia-app-root{font-family:var(--body);color:var(--haze);background:var(--ink);
          line-height:1.55;-webkit-font-smoothing:antialiased;letter-spacing:-.005em; min-height: 100vh;}
        .scapia-app-root a{color:inherit;text-decoration:none}
        .scapia-app-root .wrap{max-width:var(--maxw);margin:0 auto;padding:0 26px}
        .scapia-app-root .mono{font-family:var(--mono);letter-spacing:.16em;text-transform:uppercase}
        .scapia-app-root .accent{font-family:var(--serif);font-style:italic;font-weight:400;letter-spacing:0}

        /* top bar */
        .scapia-app-root .top{position:sticky;top:0;z-index:50;backdrop-filter:blur(10px);
          background:rgba(7,14,40,.7);border-bottom:1px solid var(--line)}
        .scapia-app-root .top .wrap{display:flex;align-items:center;justify-content:space-between;height:64px;gap:16px}
        .scapia-app-root .logo{font-family:var(--mono);font-weight:700;letter-spacing:.18em;font-size:15px; cursor: pointer;}
        .scapia-app-root .logo b{color:var(--ember)}
        .scapia-app-root .top .dsa{font-family:var(--mono);font-size:11px;letter-spacing:.12em;color:var(--haze2)}
        .scapia-app-root .btn{font-family:var(--body);font-weight:600;font-size:15px;color:#2a0e04;
          background:var(--ember);border-radius:999px;padding:.62em 1.3em;border:0;cursor:pointer;
          white-space:nowrap;transition:transform .15s ease,box-shadow .15s ease; display:inline-block;}
        .scapia-app-root .btn:hover{transform:translateY(-1px);box-shadow:0 12px 28px rgba(255,122,77,.4)}
        .scapia-app-root .btn:focus-visible{outline:3px solid var(--amber);outline-offset:2px}

        /* hero — form first */
        .scapia-app-root .hero{position:relative;overflow:hidden;
          background:
           radial-gradient(120% 95% at 8% 120%, var(--glow) 0%, rgba(255,120,77,.42) 15%, rgba(91,59,134,.26) 38%, rgba(14,26,70,0) 62%),
           linear-gradient(176deg,var(--ink) 0%,var(--night) 46%,var(--indigo) 74%,var(--violet) 96%,#7a4a5f 100%);}
        .scapia-app-root .hero::before{content:"";position:absolute;inset:0;pointer-events:none;
          background:
           radial-gradient(1.5px 1.5px at 14% 22%,rgba(239,242,252,.5),transparent),
           radial-gradient(1.5px 1.5px at 66% 12%,rgba(239,242,252,.4),transparent),
           radial-gradient(1.3px 1.3px at 40% 32%,rgba(239,242,252,.32),transparent),
           radial-gradient(1.3px 1.3px at 84% 26%,rgba(239,242,252,.28),transparent);}
        .scapia-app-root .hero .wrap{position:relative;z-index:2;padding:56px 26px 72px;
          display:grid;grid-template-columns:1.06fr .94fr;gap:52px;align-items:center}
        .scapia-app-root .eyebrow{font-size:12px;color:var(--haze2)}
        .scapia-app-root h1{font-family:var(--display);font-weight:800;letter-spacing:-.03em;line-height:.95;
          font-size:clamp(48px,6.6vw,88px);margin:16px 0 14px}
        .scapia-app-root h1 .em{color:var(--ember)}
        .scapia-app-root .tagline{font-size:clamp(19px,2.4vw,24px);color:var(--amber);margin-bottom:18px}
        .scapia-app-root .lede{font-size:clamp(16px,1.4vw,18px);color:var(--haze2);max-width:44ch;margin-bottom:26px}
        .scapia-app-root .trust{display:flex;gap:10px;flex-wrap:wrap}
        .scapia-app-root .pill{font-family:var(--mono);font-weight:600;letter-spacing:.1em;font-size:12px;
          color:var(--haze);border:1px solid var(--line);border-radius:999px;
          padding:.55em .95em;background:rgba(255,255,255,.03)}
        .scapia-app-root .pill b{color:var(--amber);font-family:var(--display);font-size:14px;letter-spacing:0}

        /* form card */
        .scapia-app-root .formcard{background:var(--form-bg);border:1px solid var(--line);border-radius:22px;
          padding:30px 28px;box-shadow:0 40px 90px rgba(0,0,0,.4);backdrop-filter:blur(6px)}
        .scapia-app-root .formcard .fhead{font-family:var(--display);font-weight:800;font-size:26px;letter-spacing:-.02em}
        .scapia-app-root .formcard .fsub{color:var(--haze2);font-size:14px;margin:6px 0 22px}
        .scapia-app-root .field{margin-bottom:14px}
        .scapia-app-root label{display:block;font-size:12px;font-family:var(--mono);letter-spacing:.1em;
          text-transform:uppercase;color:var(--haze2);margin-bottom:7px}
        .scapia-app-root input,.scapia-app-root select{width:100%;background:rgba(7,14,40,.7);border:1px solid var(--line);
          border-radius:11px;padding:13px 14px;color:var(--haze);font-family:var(--body);
          font-size:16px;transition:border-color .15s ease}
        .scapia-app-root input::placeholder{color:rgba(239,242,252,.3)}
        .scapia-app-root input:focus,.scapia-app-root select:focus{outline:none;border-color:var(--ember)}
        .scapia-app-root .field.err input,.scapia-app-root .field.err select{border-color:#ff5a5a}
        .scapia-app-root .msg{display:none;font-size:11.5px;color:#ff9a9a;margin-top:6px;font-family:var(--mono)}
        .scapia-app-root .field.err .msg{display:block}
        .scapia-app-root .two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .scapia-app-root .consent{display:flex;gap:11px;align-items:flex-start;margin:8px 0 18px;
          font-size:12px;color:var(--haze2);line-height:1.5; cursor:pointer;}
        .scapia-app-root .consent input{width:18px;height:18px;margin-top:1px;flex:0 0 auto;accent-color:var(--ember)}
        .scapia-app-root .consent a{color:var(--amber);text-decoration:underline}
        .scapia-app-root .hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
        .scapia-app-root .submit{width:100%;font-size:16px;padding:15px;font-weight:600}
        .scapia-app-root .formnote{font-size:11px;color:var(--haze2);text-align:center;margin-top:13px;
          font-family:var(--mono);letter-spacing:.06em}
        .scapia-app-root .done{display:none;text-align:center;padding:30px 6px}
        .scapia-app-root .done h3{font-family:var(--display);font-weight:800;font-size:24px;margin-bottom:8px}
        .scapia-app-root .done p{color:var(--haze2);font-size:15px}
        .scapia-app-root .formstate.sent form{display:none}
        .scapia-app-root .formstate.sent .done{display:block}

        /* sections */
        .scapia-app-root section{padding:80px 0;border-top:1px solid var(--line)}
        .scapia-app-root .kicker{font-size:12px;color:var(--ember);margin-bottom:14px}
        .scapia-app-root h2{font-family:var(--display);font-weight:800;letter-spacing:-.02em;
          font-size:clamp(32px,4.4vw,48px);line-height:1.0;max-width:18ch}
        .scapia-app-root h2 .accent{color:var(--amber)}
        .scapia-app-root .section-sub{color:var(--haze2);max-width:54ch;margin-top:16px;font-size:17px}

        .scapia-app-root .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:44px}
        .scapia-app-root .bcard{background:var(--card-bg);border:1px solid var(--line);border-radius:16px;padding:26px; transition: transform 0.2s, border-color 0.2s;}
        .scapia-app-root .bcard:hover{transform: translateY(-4px); border-color: rgba(255,255,255,0.3);}
        .scapia-app-root .bcard .n{font-family:var(--mono);font-size:12px;color:var(--amber);letter-spacing:.16em}
        .scapia-app-root .bcard h3{font-family:var(--display);font-weight:700;font-size:21px;margin:14px 0 8px;letter-spacing:-.01em}
        .scapia-app-root .bcard p{color:var(--haze2);font-size:14.5px}
        .scapia-app-root .bcard .foot{margin-top:12px;font-size:11px;color:var(--haze2);
          font-family:var(--mono);letter-spacing:.06em}

        .scapia-app-root .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:44px}
        .scapia-app-root .step{padding-top:20px;border-top:2px solid var(--ember)}
        .scapia-app-root .step .num{font-family:var(--mono);font-size:12px;color:var(--ember);letter-spacing:.18em}
        .scapia-app-root .step h3{font-family:var(--display);font-weight:700;font-size:23px;margin:12px 0 6px;letter-spacing:-.01em}
        .scapia-app-root .step p{color:var(--haze2);font-size:15px}
        .scapia-app-root .cta-row{margin-top:46px}

        .scapia-app-root footer{padding:52px 0 66px;border-top:1px solid var(--line);color:var(--haze2)}
        .scapia-app-root .foot-top{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:22px}
        .scapia-app-root .legal{font-size:12.5px;line-height:1.75;max-width:82ch}
        .scapia-app-root .legal b{color:var(--haze)}

        @media(max-width:900px){
          .scapia-app-root .hero .wrap{grid-template-columns:1fr;gap:30px;padding:40px 26px 56px}
          .scapia-app-root .grid,.scapia-app-root .steps{grid-template-columns:1fr}
          .scapia-app-root .top .dsa{display:none}
          .scapia-app-root h1{font-size:clamp(42px,11vw,60px)}
        }
        @media(prefers-reduced-motion:reduce){.scapia-app-root *{scroll-behavior:auto}.scapia-app-root .btn{transition:none}}

        /* Modal Styles matching OTP Modal */
        .scapia-modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(7,14,40,0.8); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; animation: scapia-fadein 0.2s ease;
        }
        .scapia-modal {
          background: #0E1A46; width: 100%; max-width: 440px; border-radius: 22px;
          border: 1px solid rgba(239,242,252,.14);
          padding: 36px 32px; box-shadow: 0 24px 48px rgba(0,0,0,0.5);
          position: relative; color: #EFF2FC; animation: scapia-scalein 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes scapia-fadein { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scapia-scalein { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .scapia-modal-close {
          position: absolute; top: 18px; right: 18px; background: rgba(255,255,255,0.08);
          border: none; width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #EFF2FC; cursor: pointer; transition: background 0.15s;
        }
        .scapia-modal-close:hover { background: rgba(255,255,255,0.18); }
        .scapia-modal-title { font-family: var(--display); font-size: 22px; font-weight: 800; color: #EFF2FC; margin-bottom: 8px; letter-spacing:-0.03em; }
        .scapia-modal-subtitle { font-size: 14px; color: rgba(239,242,252,.64); margin-bottom: 24px; line-height: 1.5; }
        .scapia-otp-input {
          width: 100%; font-size: 24px; font-weight: 700; letter-spacing: 0.3em;
          text-align: center; padding: 12px; border: 1px solid rgba(239,242,252,.14);
          border-radius: 12px; background: rgba(7,14,40,.7); color: #EFF2FC; margin-bottom: 16px;
        }
        .scapia-otp-input:focus { outline: none; border-color: #FF7A4D; background: rgba(7,14,40,.9); }
        .scapia-modal-btn {
          width: 100%; background: #FF7A4D; color: #2a0e04; font-weight: 700;
          font-size: 16px; padding: 14px; border: none; border-radius: 999px;
          cursor: pointer; transition: transform 0.15s;
        }
        .scapia-modal-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(255,122,77,0.4); }
        .scapia-modal-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .scapia-resend { font-size: 13px; color: rgba(239,242,252,.64); text-align: center; margin-top: 20px; }
        .scapia-resend-btn {
          background: none; border: none; color: #FF7A4D; font-weight: 700;
          cursor: pointer; padding: 0 4px; display: inline-flex; align-items: center; gap: 4px;
        }
        .scapia-resend-btn:disabled { color: rgba(239,242,252,.3); cursor: not-allowed; }
        .scapia-otp-status { font-size: 13px; text-align: center; margin-top: 12px; font-weight: 600; color: #4ade80; }
        .scapia-sim-otp {
          margin-top: 20px; padding: 12px; background: rgba(74,222,128,0.1); border: 1px dashed rgba(74,222,128,0.3);
          border-radius: 12px; font-size: 12px; color: #4ade80; display: flex; align-items: flex-start; gap: 8px;
        }
      `}} />

      <div className="scapia-app-root">
        <div className="top">
          <div className="wrap">
            <div className="logo" onClick={(e)=>{e.preventDefault(); navigateTo && navigateTo('/');}}>FIN<b>MANTRA</b></div>
            <div className="dsa mono">Authorised DSA of Scapia / Federal Bank</div>
            <a href="#apply" className="btn">Apply now</a>
          </div>
        </div>

        <header className="hero">
          <div className="wrap">
            <div className="pitch">
              <div className="eyebrow mono">Scapia Credit Card</div>
              <h1>Spend like always.<br/><span className="em">Travel like never before.</span></h1>
              <p className="tagline accent">Your next trip is closer than it looks.</p>
              <p className="lede">Every rupee you spend earns Scapia Coins you cash in on travel &mdash; with zero forex abroad and no annual fee, ever.</p>
              <div className="trust">
                <span className="pill"><b>0%</b> Forex</span>
                <span className="pill">Lifetime free</span>
                <span className="pill">Visa + RuPay</span>
              </div>
            </div>

            <div className="formstate" id="formstate">
              <form id="leadform" className="formcard" noValidate onSubmit={handleInitialSubmit}>
                <div className="fhead">Get the card</div>
                <div className="fsub">Two minutes to start. A FinMantra advisor takes it from there.</div>

                {status.type === 'error' && (
                  <div style={{background: 'rgba(255,90,90,0.15)', border: '1px solid #ff5a5a', color: '#ff9a9a', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '16px'}}>
                    {status.message}
                  </div>
                )}

                <div className="hp" aria-hidden="true">
                  <label>Company (leave blank)</label>
                  <input type="text" name="company" tabIndex="-1" autoComplete="off" value={formData.company} onChange={handleInputChange} />
                </div>

                <div className={`field ${errors.fullName || errors.name ? 'err' : ''}`}>
                  <label htmlFor="fullName">Full name</label>
                  <input id="fullName" name="fullName" type="text" placeholder="As on your PAN" autoComplete="name" value={formData.fullName} onChange={handleInputChange} />
                  <span className="msg" style={{display: errors.fullName || errors.name ? 'block' : 'none'}}>{errors.fullName || errors.name}</span>
                </div>

                <div className="two">
                  <div className={`field ${errors.pan_no ? 'err' : ''}`}>
                    <label htmlFor="pan_no">PAN Number</label>
                    <input id="pan_no" name="pan_no" type="text" maxLength="10" autoCapitalize="characters" placeholder="ABCDE1234F" autoComplete="off" value={formData.pan_no} onChange={handleInputChange} />
                    <span className="msg" style={{display: errors.pan_no ? 'block' : 'none'}}>{errors.pan_no}</span>
                  </div>

                  <div className={`field ${errors.phone || errors.mobile ? 'err' : ''}`}>
                    <label htmlFor="mobile">Mobile</label>
                    <input id="mobile" name="phone" type="tel" inputMode="numeric" maxLength="10" placeholder="10-digit number" autoComplete="tel" value={formData.phone} onChange={handleInputChange} />
                    <span className="msg" style={{display: errors.phone || errors.mobile ? 'block' : 'none'}}>{errors.phone || errors.mobile}</span>
                  </div>
                </div>

                <div className="two">
                  <div className={`field ${errors.pincode || pincodeError ? 'err' : ''}`}>
                    <label htmlFor="pincode">Pincode</label>
                    <input id="pincode" name="pincode" type="text" inputMode="numeric" maxLength="6" placeholder="6 digits" autoComplete="postal-code" value={formData.pincode} onChange={handleInputChange} />
                    <span className="msg" style={{display: errors.pincode || pincodeError ? 'block' : 'none'}}>{errors.pincode || pincodeError}</span>
                    {pincodeLoading && <span style={{fontSize: '11px', color: 'var(--haze2)', display: 'block', marginTop: '4px'}}>Looking up...</span>}
                    {pincodeLocationText && !pincodeError && <span style={{fontSize: '11px', color: '#4ade80', display: 'block', marginTop: '4px'}}>{pincodeLocationText}</span>}
                  </div>

                  <div className={`field ${errors.employment ? 'err' : ''}`}>
                    <label htmlFor="employment">You are</label>
                    <select id="employment" name="employment" value={formData.employment} onChange={handleInputChange}>
                      <option value="">Select one</option>
                      <option value="Salaried">Salaried</option>
                      <option value="Self-employed">Self-employed</option>
                      <option value="Student">Student</option>
                      <option value="Other">Other</option>
                    </select>
                    <span className="msg" style={{display: errors.employment ? 'block' : 'none'}}>{errors.employment}</span>
                  </div>
                </div>

                <div className={`field ${errors.email ? 'err' : ''}`}>
                  <label htmlFor="email">Email</label>
                  <input id="email" name="email" type="email" placeholder="you@email.com" autoComplete="email" value={formData.email} onChange={handleInputChange} />
                  <span className="msg" style={{display: errors.email ? 'block' : 'none'}}>{errors.email}</span>
                </div>

                <label className="consent" style={{color: errors.consent ? '#ff9a9a' : ''}}>
                  <input type="checkbox" id="consent" name="consent" checked={formData.consent} onChange={handleInputChange} />
                  <span>I agree to be contacted by FinMantra about the Scapia Credit Card and consent to my details being processed under the <a href="#" target="_blank" rel="noopener noreferrer">Privacy Policy</a> (DPDP Act, 2023). Card issuance is subject to the bank's approval.</span>
                </label>
                {errors.consent && <span className="msg" style={{display: 'block', marginTop: '-12px', marginBottom: '12px'}}>{errors.consent}</span>}

                <button type="submit" className="btn submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting…' : 'Apply now'}
                </button>
                <p className="formnote">Sent over HTTPS &middot; No spam, ever</p>
              </form>

              {isSubmittedSuccess && (
                <div className="done" style={{display: 'block'}}>
                  <h3>You're in &mdash; details received.</h3>
                  <p>A FinMantra advisor will call you shortly to help you apply.</p>
                </div>
              )}
            </div>
          </div>
        </header>

        <section id="apply">
          <div className="wrap">
            <div className="kicker mono">Why this card</div>
            <h2>Built for people who'd rather be <span className="accent">somewhere else.</span></h2>
            <p className="section-sub">Zero forex, rewards that turn into real trips, and none of the fees that hold you back.</p>
            <div className="grid">
              <div className="bcard"><div className="n">01</div><h3>Zero forex mark-up</h3><p>Pay abroad at the exchange rate &mdash; no mark-up added on international spends.</p></div>
              <div className="bcard"><div className="n">02</div><h3>Lifetime free</h3><p>No joining fee, no annual fee. Nothing to earn back before you're ahead.</p></div>
              <div className="bcard"><div className="n">03</div><h3>Coins on every spend</h3><p>Every eligible spend earns Scapia Coins &mdash; cash them in on flights, stays, trains and buses in the app.</p><div className="foot">*Earn &amp; redemption value per Scapia's current terms</div></div>
              <div className="bcard"><div className="n">04</div><h3>Unlimited domestic lounges</h3><p>Wait for your flight in a lounge, not a plastic chair &mdash; on meeting the monthly spend.</p><div className="foot">*Subject to monthly spend conditions</div></div>
              <div className="bcard"><div className="n">05</div><h3>One card, everywhere</h3><p>A Visa for the world and a RuPay for UPI, bundled into one.</p></div>
              <div className="bcard"><div className="n">06</div><h3>No-cost EMI on travel</h3><p>Split eligible travel bookings in the app into no-cost EMIs.</p><div className="foot">*Eligible bookings only; terms apply</div></div>
            </div>
          </div>
        </section>

        <section>
          <div className="wrap">
            <div className="kicker mono">How it works</div>
            <h2>From grocery run to <span className="accent">boarding gate.</span></h2>
            <div className="steps">
              <div className="step"><div className="num">STEP 01</div><h3>Spend on your card</h3><p>Groceries, fuel, shopping, UPI &mdash; the everyday stuff you already pay for.</p></div>
              <div className="step"><div className="num">STEP 02</div><h3>Earn Scapia Coins</h3><p>Every eligible spend earns Coins, credited straight to your account.</p></div>
              <div className="step"><div className="num">STEP 03</div><h3>Redeem on travel</h3><p>Turn your Coins into flights and stays in the Scapia app. Then go.</p></div>
            </div>
            <div className="cta-row"><a href="#formstate" className="btn">Apply for the card</a></div>
          </div>
        </section>

        <footer>
          <div className="wrap">
            <div className="foot-top">
              <div className="logo" onClick={(e)=>{e.preventDefault(); navigateTo && navigateTo('/');}}>FIN<b>MANTRA</b></div>
              <div className="dsa mono" style={{fontSize:'11px', color:'var(--haze2)'}}>Authorised DSA of Scapia / Federal Bank</div>
            </div>
            <p className="legal">
              <b>FinMantra is an authorised Direct Selling Agent (DSA) of Federal Bank.</b> Scapia is a co-branded credit card issued by the partner bank. This is a marketing communication by FinMantra, not by Scapia or the issuing bank. Card issuance is subject to the bank's eligibility criteria, verification and approval &mdash; approval is not guaranteed. Scapia Coins earning and redemption values, lounge access and other benefits follow Scapia's and the issuing bank's current terms, and may change. Lounge access is subject to monthly spend conditions. All trademarks belong to their respective owners. By submitting the form you consent to being contacted under the Digital Personal Data Protection Act, 2023.
            </p>
          </div>
        </footer>

        {/* OTP Modal */}
        {showOtpModal && (
          <div className="scapia-modal-overlay">
            <div className="scapia-modal">
              <button className="scapia-modal-close" onClick={() => setShowOtpModal(false)}><X size={18} /></button>
              <h3 className="scapia-modal-title">Verify Mobile Number</h3>
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
                <div className="scapia-otp-status" style={{color: otpStatus.includes('failed') || otpStatus.includes('error') ? '#ff9a9a' : '#4ade80'}}>
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
