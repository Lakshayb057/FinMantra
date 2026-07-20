import React, { useState, useEffect, useRef } from 'react';
import { X, Lock } from 'lucide-react';
import { trackLeadSubmission, initAnalytics } from '../utils/analytics';

export default function SimplyClickSbi({ navigateTo, utmParams }) {
  const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173') ? 'http://localhost:5000/api' : '/api';

  const [settings, setSettings] = useState({});
  const [cards, setCards] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('#');

  // Form State
  const [formData, setFormData] = useState({
    pan: '',
    name: '',
    dob: '',
    mother_name: '',
    mobile: '',
    address: '',
    email: '',
    occupation: '',
    designation: '',
    company: '',
    consent: false,
    pincode: ''
  });

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  // Pincode serviceability states
  const [pincodeError, setPincodeError] = useState('');
  const [pincodeLocationText, setPincodeLocationText] = useState('');

  // Phone Verification / OTP states
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpVal, setOtpVal] = useState('');
  const [otpStatus, setOtpStatus] = useState('');
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const isPhoneVerifiedRef = useRef(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [simulatedOtpText, setSimulatedOtpText] = useState('');

  // Fetch settings & cards
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch(`${API_URL}/settings`);
        if (res.ok) {
          const data = await res.json();
          setSettings(data || {});
          initAnalytics(data || {});
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    const loadCards = async () => {
      try {
        const res = await fetch(`${API_URL}/cards`);
        if (res.ok) {
          const data = await res.json();
          setCards(data || []);
        }
      } catch (err) {
        console.error('Failed to load cards:', err);
      }
    };
    loadSettings();
    loadCards();
  }, []);

  // OTP Timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Real-time lookup of pincode
  useEffect(() => {
    const lookup = async () => {
      const pin = formData.pincode;
      if (pin.length !== 6) {
        setPincodeLocationText('');
        setPincodeError('');
        return;
      }

      setPincodeError('');
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data[0] && data[0].Status === 'Success') {
            const postOffices = data[0].PostOffice || [];
            if (postOffices.length > 0) {
              const po = postOffices[0];
              const city = po.District;
              const state = po.State;
              setPincodeLocationText(`${city}, ${state}`);

              // 1. Validate global pincode serviceability
              const pinMode = settings.pincode_serviceability_mode || 'all';
              const pinListRaw = settings.pincode_serviceability_list || '';
              let errorText = '';
              if (pinMode !== 'all') {
                const pinArray = pinListRaw.split(',').map(p => p.trim()).filter(Boolean);
                const isInList = pinArray.includes(pin);
                if (pinMode === 'whitelist' && !isInList) {
                  errorText = 'Credit card services are not available at your pincode currently.';
                }
                if (pinMode === 'blacklist' && isInList) {
                  errorText = 'Credit card services are not available at your pincode currently.';
                }
              }

              // 2. Validate bank-specific pincode serviceability for SBI Card
              if (!errorText) {
                const matchedSbiCard = cards.find(c => String(c.name).toLowerCase().includes('simplyclick') || String(c.id).toLowerCase().includes('sbi'));
                if (matchedSbiCard && matchedSbiCard.bank) {
                  const bankRulesRaw = settings.bank_pincode_rules || '';
                  if (bankRulesRaw) {
                    try {
                      const bankRules = typeof settings.bank_pincode_rules === 'string'
                        ? JSON.parse(settings.bank_pincode_rules)
                        : settings.bank_pincode_rules;
                      const rule = bankRules[matchedSbiCard.bank];
                      if (rule && rule.mode === 'list') {
                        const allowedPins = String(rule.list || '').split(',').map(p => p.trim()).filter(Boolean);
                        if (!allowedPins.includes(pin)) {
                          errorText = `${matchedSbiCard.bank} cards facilities are currently not available for your location.`;
                        }
                      }
                    } catch (e) {
                      console.error('Failed to parse bank pincode rules:', e);
                    }
                  }
                }
              }

              if (errorText) {
                setPincodeError(errorText);
                setErrors(prev => ({ ...prev, pincode: errorText }));
              } else {
                setErrors(prev => {
                  const next = { ...prev };
                  delete next.pincode;
                  return next;
                });
              }
            }
          } else {
            const errTxt = 'Invalid Pincode. No location found.';
            setPincodeError(errTxt);
            setErrors(prev => ({ ...prev, pincode: errTxt }));
          }
        }
      } catch (err) {
        console.error('Failed to lookup pincode:', err);
      }
    };
    lookup();
  }, [formData.pincode, cards, settings]);

  // Input change cleaner
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let cleanVal = type === 'checkbox' ? checked : value;

    if (name === 'pan') {
      cleanVal = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    } else if (name === 'mobile' || name === 'pincode') {
      cleanVal = value.replace(/[^0-9]/g, '').slice(0, name === 'mobile' ? 10 : 6);
    }

    setFormData(prev => ({ ...prev, [name]: cleanVal }));
    validateField(name, cleanVal);
  };

  // Validate age helper
  const age = (dobString) => {
    const today = new Date();
    const birthDate = new Date(dobString);
    let currentAge = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      currentAge--;
    }
    return currentAge;
  };

  // Field validation matching PublicLanding.jsx
  const validateField = (name, value) => {
    let errorText = '';

    if (name === 'pan') {
      if (!value) {
        errorText = 'This field is required';
      } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value)) {
        errorText = 'Invalid PAN card format (e.g. ABCDE1234F).';
      }
    }

    if (name === 'name') {
      const trimmed = value.trim();
      if (!trimmed) {
        errorText = 'This field is required';
      } else if (!/^[a-zA-Z\s]+$/.test(trimmed)) {
        errorText = 'Enter your Name as per PAN card';
      } else {
        const words = trimmed.split(/\s+/).filter(Boolean);
        if (words.length < 2) {
          errorText = 'Please enter your Last Name / Father Name';
        }
      }
    }

    if (name === 'dob') {
      const currentAge = value ? age(value) : 0;
      if (!value) {
        errorText = 'This field is required';
      } else if (currentAge < 21 || currentAge > 70) {
        errorText = 'You must be 21–70 to apply for this card.';
      }
    }

    if (name === 'mother_name') {
      if (!value || value.trim().length < 2) {
        errorText = "Enter your mother's name.";
      }
    }

    if (name === 'mobile') {
      if (!value) {
        errorText = 'This field is required';
      } else if (!/^[6-9]/.test(value)) {
        errorText = 'WhatsApp number should start with 6,7,8,9 only';
      } else if (value.length !== 10) {
        errorText = 'WhatsApp number must be exactly 10 digits.';
      }
    }

    if (name === 'address') {
      if (!value || value.trim().length < 10) {
        errorText = 'Enter your current address (min 10 characters).';
      }
    }

    if (name === 'pincode') {
      if (!value) {
        errorText = 'This field is required';
      } else if (value.length !== 6 || !/^\d+$/.test(value)) {
        errorText = 'Pincode must be exactly 6 digits.';
      } else if (pincodeError) {
        errorText = pincodeError;
      }
    }

    if (name === 'email') {
      if (!value) {
        errorText = 'This field is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errorText = 'Please enter valid Email';
      }
    }

    if (name === 'occupation') {
      if (!value) {
        errorText = 'Select your occupation.';
      }
    }

    if (name === 'designation') {
      if (!value || value.trim().length < 1) {
        errorText = 'Enter your designation.';
      }
    }

    if (name === 'company') {
      if (!value || value.trim().length < 1) {
        errorText = 'Enter your company name.';
      }
    }

    if (name === 'consent') {
      if (!value) {
        errorText = 'Please tick the box to continue.';
      }
    }

    setErrors(prev => {
      const updated = { ...prev };
      if (errorText) {
        updated[name] = errorText;
      } else {
        delete updated[name];
      }
      return updated;
    });

    return !errorText;
  };

  // Validate entire form before submission
  const validateForm = () => {
    let isValid = true;
    const fieldsToValidate = [
      'pan', 'name', 'dob', 'mother_name', 'mobile',
      'address', 'pincode', 'email', 'occupation',
      'designation', 'company', 'consent'
    ];

    fieldsToValidate.forEach(fieldName => {
      const val = formData[fieldName];
      const fieldValid = validateField(fieldName, val);
      if (!fieldValid) {
        isValid = false;
      }
    });

    return isValid;
  };

  // Send Step 1 OTP
  const sendStep1Otp = async () => {
    setIsSubmitting(true);
    setFormError('');
    try {
      const res = await fetch(`${API_URL}/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.mobile })
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
        setFormError(data.error || 'Failed to send verification code. Please try again.');
      }
    } catch (err) {
      setFormError('Network error. Unable to contact verification servers.');
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
        body: JSON.stringify({ phone: formData.mobile, otp: otpVal })
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
          // Automatically trigger final form submission
          setTimeout(() => {
            handleFormSubmit();
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
        body: JSON.stringify({ phone: formData.mobile })
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

  // Final submit handler
  const handleFormSubmit = async (e) => {
    if (e) e.preventDefault();
    setFormError('');

    if (!validateForm()) {
      const firstInvalid = document.querySelector('.field.invalid');
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Trigger OTP modal if not yet verified
    if (!isPhoneVerifiedRef.current) {
      sendStep1Otp();
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.name.trim(),
          phone: formData.mobile,
          email: formData.email.trim(),
          pan_no: formData.pan.toUpperCase(),
          dob: formData.dob,
          mother_name: formData.mother_name.trim(),
          current_address: `${formData.address.trim()} (Pincode: ${formData.pincode})`,
          pincode: formData.pincode,
          employment: formData.occupation,
          designation: formData.designation.trim(),
          company: formData.company.trim(),
          consent: true,
          source: 'simplyclick_sbi',
          ...utmParams,
          utm_params: utmParams || null
        })
      });

      const data = await res.json();
      if (res.ok) {
        trackLeadSubmission({
          fullName: formData.name,
          email: formData.email,
          phone: formData.mobile,
          eventId: data.urn,
          contentName: 'SBI SimplyClick Lead Submitted',
          status: 'submitted'
        });

        const cacheData = {
          name: formData.name,
          urn: data.urn,
          redirectUrl: data.redirectUrl,
          cardName: 'SBI SimplyClick Credit Card',
          bank: 'SBI Card',
          timestamp: new Date().getTime()
        };
        sessionStorage.setItem('finmantra_applied_lead', JSON.stringify(cacheData));

        // Singular / Intent URL resolution matching App.jsx logic
        let finalUrl = data.redirectUrl;
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
            console.error('[SBI Redirect] Server Singular resolution failed:', resolveErr);
          }
        }

        if (finalUrl && String(finalUrl).startsWith('intent://')) {
          const fbMatch = String(finalUrl).match(/S\.browser_fallback_url=([^;]+)/);
          if (fbMatch && fbMatch[1]) {
            try {
              finalUrl = decodeURIComponent(fbMatch[1]);
            } catch (decodeErr) {
              console.error('[SBI Redirect] Fallback decode failed:', decodeErr);
            }
          }
        }

        window.location.replace(finalUrl);
      } else {
        setFormError(data.error || 'Failed to submit application. Please check details.');
      }
    } catch (err) {
      setFormError('Network error. Unable to contact lead generation server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&display=swap');

        :root{
         --wine:#6E2C3E; --wine2:#8A3A50; --oxblood:#431722;
         --blush:#F3DEDE; --rose:#EAC9CC; --cream:#FBF3EA; --paper:#FCF7F3;
         --gold:#C79A52; --gold-deep:#8A5A20; --ink:#2A0A14; --line:#E3C9CF;
         --ok:#2f7d4f; --err:#b23a48;
        }
        .simplyclick-wrapper {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Outfit', system-ui, sans-serif;
          color: var(--ink);
          background: var(--paper);
          line-height: 1.5;
        }
        .simplyclick-wrapper html {
          scroll-behavior: smooth;
        }
        .simplyclick-wrapper .eyebrow {
          font-family: monospace;
          text-transform: uppercase;
          letter-spacing: 3px;
          font-size: 12px;
        }
        .simplyclick-wrapper h1,
        .simplyclick-wrapper h2,
        .simplyclick-wrapper h3,
        .simplyclick-wrapper h4 {
          font-family: 'Bricolage Grotesque', sans-serif;
          font-weight: 700;
          letter-spacing: -1px;
          line-height: 1.02;
        }
        .simplyclick-wrapper a {
          color: inherit;
        }
        .simplyclick-wrapper .wrap {
          max-width: 1120px;
          margin: 0 auto;
          padding: 0 22px;
        }

        /* top bar */
        .simplyclick-wrapper .topbar {
          position: sticky;
          top: 0;
          z-index: 40;
          background: rgba(252,247,243,0.86);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--line);
        }
        .simplyclick-wrapper .topbar .row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 60px;
        }
        .simplyclick-wrapper .nav-logo {
          transition: transform 0.15s ease;
        }
        .simplyclick-wrapper .nav-logo:hover {
          transform: scale(1.02);
        }
        .simplyclick-wrapper .btn {
          font-family: 'Bricolage Grotesque', sans-serif;
          font-weight: 700;
          border: none;
          cursor: pointer;
          border-radius: 999px;
          padding: 14px 26px;
          font-size: 16px;
          transition: transform .15s ease, box-shadow .15s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .simplyclick-wrapper .btn-primary {
          background: var(--wine);
          color: var(--cream);
          box-shadow: 0 8px 20px rgba(67,23,34,.28);
        }
        .simplyclick-wrapper .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 26px rgba(67,23,34,.34);
        }
        .simplyclick-wrapper .btn-gold {
          background: var(--gold);
          color: var(--oxblood);
        }
        .simplyclick-wrapper .btn-sm {
          padding: 9px 18px;
          font-size: 14px;
        }

        /* hero */
        .simplyclick-wrapper .hero {
          position: relative;
          overflow: hidden;
          background: linear-gradient(160deg, var(--blush), var(--rose));
        }
        .simplyclick-wrapper .hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(var(--oxblood) 1.2px, transparent 1.3px);
          background-size: 34px 34px;
          opacity: .07;
        }
        .simplyclick-wrapper .hero .grid {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 36px;
          align-items: start;
          padding: 40px 0 52px;
        }
        .simplyclick-wrapper .hero .pitch {
          position: sticky;
          top: 78px;
        }
        .simplyclick-wrapper .hero h1 {
          font-size: clamp(34px, 4.4vw, 52px);
          color: var(--oxblood);
          margin: 12px 0 14px;
        }
        .simplyclick-wrapper .hero h1 .g {
          color: var(--gold-deep);
        }
        .simplyclick-wrapper .hero p.lead {
          font-size: clamp(16px, 2vw, 19px);
          max-width: 33ch;
          color: #5a2634;
        }
        .simplyclick-wrapper .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin: 18px 0 4px;
        }
        .simplyclick-wrapper .chip {
          background: var(--wine);
          color: var(--cream);
          font-weight: 700;
          font-size: 14px;
          padding: 9px 15px;
          border-radius: 999px;
        }
        .simplyclick-wrapper .chip.alt {
          background: transparent;
          color: var(--wine);
          border: 1.5px solid var(--wine);
        }
        .simplyclick-wrapper .cardwrap {
          position: relative;
          display: flex;
          justify-content: center;
        }
        .simplyclick-wrapper .cardwrap .glow {
          position: absolute;
          width: 120%;
          height: 120%;
          left: -10%;
          top: -10%;
          background: radial-gradient(circle at 60% 40%, rgba(255,255,255,.6), transparent 62%);
        }
        .simplyclick-wrapper .cardimg {
          position: relative;
          width: min(230px, 60%);
          transform: rotate(-6deg);
          filter: drop-shadow(0 26px 34px rgba(40,8,18,.45));
        }
        .simplyclick-wrapper .spark {
          position: absolute;
          right: 6%;
          top: 4%;
          font-size: 34px;
          color: var(--gold);
        }

        /* benefits */
        .simplyclick-wrapper .benefits {
          padding: 56px 0;
        }
        .simplyclick-wrapper .benefits .eyebrow {
          color: var(--wine);
        }
        .simplyclick-wrapper .benefits h2 {
          font-size: clamp(26px, 3.4vw, 38px);
          color: var(--oxblood);
          margin: 8px 0 26px;
          max-width: 20ch;
        }
        .simplyclick-wrapper .bgrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .simplyclick-wrapper .bcard {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 22px;
        }
        .simplyclick-wrapper .bcard .n {
          font-family: 'Bricolage Grotesque', sans-serif;
          font-weight: 700;
          font-size: 30px;
          color: var(--wine);
        }
        .simplyclick-wrapper .bcard h3 {
          font-size: 18px;
          margin: 6px 0 6px;
          color: var(--oxblood);
        }
        .simplyclick-wrapper .bcard p {
          font-size: 14px;
          color: #6a4c53;
        }

        /* form */
        .simplyclick-wrapper .apply {
          padding: 0;
        }
        .simplyclick-wrapper .formcard {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 22px;
          box-shadow: 0 24px 50px rgba(67,23,34,.16);
          overflow: hidden;
        }
        .simplyclick-wrapper .formhead {
          background: var(--wine);
          color: var(--cream);
          padding: 20px 24px;
        }
        .simplyclick-wrapper .formhead h2 {
          font-size: 22px;
        }
        .simplyclick-wrapper .formhead p {
          opacity: .9;
          font-size: 15px;
          margin-top: 6px;
        }
        .simplyclick-wrapper form {
          padding: 22px 24px 24px;
        }
        .simplyclick-wrapper .fgrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px 16px;
        }
        .simplyclick-wrapper .field {
          display: flex;
          flex-direction: column;
        }
        .simplyclick-wrapper .field.full {
          grid-column: 1 / -1;
        }
        .simplyclick-wrapper label {
          font-family: monospace;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-size: 11px;
          color: var(--wine);
          margin-bottom: 7px;
        }
        .simplyclick-wrapper label .req {
          color: var(--err);
        }
        .simplyclick-wrapper input,
        .simplyclick-wrapper select,
        .simplyclick-wrapper textarea {
          font-family: 'Outfit', sans-serif;
          font-size: 16px;
          color: var(--ink);
          background: var(--paper);
          border: 1.5px solid var(--line);
          border-radius: 12px;
          padding: 13px 14px;
          width: 100%;
          transition: border-color .15s, box-shadow .15s;
        }
        .simplyclick-wrapper textarea {
          resize: vertical;
          min-height: 74px;
        }
        .simplyclick-wrapper input:focus,
        .simplyclick-wrapper select:focus,
        .simplyclick-wrapper textarea:focus {
          outline: none;
          border-color: var(--wine);
          box-shadow: 0 0 0 3px rgba(110,44,62,.12);
        }
        .simplyclick-wrapper .field.invalid input,
        .simplyclick-wrapper .field.invalid select,
        .simplyclick-wrapper .field.invalid textarea {
          border-color: var(--err);
        }
        .simplyclick-wrapper .hint {
          font-size: 12px;
          color: #8a6a70;
          margin-top: 5px;
        }
        .simplyclick-wrapper .err {
          font-size: 12px;
          color: var(--err);
          margin-top: 5px;
          display: none;
        }
        .simplyclick-wrapper .field.invalid .err {
          display: block;
        }
        .simplyclick-wrapper .pan input {
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .simplyclick-wrapper .mob {
          display: flex;
          align-items: stretch;
        }
        .simplyclick-wrapper .mob .pre {
          display: flex;
          align-items: center;
          padding: 0 12px;
          border: 1.5px solid var(--line);
          border-right: none;
          border-radius: 12px 0 0 12px;
          background: #F4E9EB;
          font-size: 16px;
          color: var(--wine);
        }
        .simplyclick-wrapper .mob input {
          border-radius: 0 12px 12px 0;
        }
        .simplyclick-wrapper .consent {
          grid-column: 1/-1;
          display: flex;
          gap: 12px;
          align-items: flex-start;
          background: var(--blush);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 15px;
          margin-top: 4px;
        }
        .simplyclick-wrapper .consent input {
          width: 20px;
          height: 20px;
          margin-top: 2px;
          flex: none;
          accent-color: var(--wine);
        }
        .simplyclick-wrapper .consent label {
          font-family: 'Outfit';
          text-transform: none;
          letter-spacing: 0;
          font-size: 13px;
          color: #5a2634;
          line-height: 1.45;
        }
        .simplyclick-wrapper .formcol {
          align-self: start;
        }
        .simplyclick-wrapper .securenote {
          grid-column: 1/-1;
          font-family: monospace;
          font-size: 11.5px;
          color: #7a5560;
          display: flex;
          gap: 8px;
          align-items: center;
          margin-top: 2px;
        }
        .simplyclick-wrapper .submitrow {
          grid-column: 1/-1;
          margin-top: 8px;
        }
        .simplyclick-wrapper .submitrow .btn {
          width: 100%;
          justify-content: center;
          font-size: 18px;
          padding: 17px;
        }
        .simplyclick-wrapper .hp {
          position: absolute;
          left: -9999px;
        }

        /* success */
        .simplyclick-wrapper .success {
          display: none;
          padding: 40px 30px;
          text-align: center;
        }
        .simplyclick-wrapper .success.show {
          display: block;
        }
        .simplyclick-wrapper .success .tick {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: var(--ok);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 34px;
          margin: 0 auto 16px;
        }
        .simplyclick-wrapper .success h2 {
          color: var(--oxblood);
          font-size: 26px;
        }
        .simplyclick-wrapper .success p {
          color: #6a4c53;
          max-width: 44ch;
          margin: 10px auto 22px;
        }

        /* footer */
        .simplyclick-wrapper footer {
          background: var(--oxblood);
          color: #E9D5D9;
          padding: 40px 0 46px;
        }
        .simplyclick-wrapper footer .disc {
          font-family: monospace;
          font-size: 12px;
          line-height: 1.7;
          opacity: .85;
          max-width: 80ch;
        }
        .simplyclick-wrapper footer .links {
          display: flex;
          gap: 18px;
          flex-wrap: wrap;
          margin: 16px 0;
          font-size: 14px;
        }
        .simplyclick-wrapper footer .links a {
          opacity: .9;
          text-decoration: underline;
        }
        .simplyclick-wrapper footer .note {
          font-size: 12px;
          opacity: .7;
          margin-top: 12px;
        }

        @media (max-width:900px){
         .simplyclick-wrapper .hero .grid{grid-template-columns:1fr;padding:26px 0 40px;gap:24px;}
         .simplyclick-wrapper .hero .pitch{position:static;}
         .simplyclick-wrapper .hero .pitchtop{display:flex;align-items:center;gap:18px;}
         .simplyclick-wrapper .hero .pitchtop .cardwrap{flex:none;width:120px;} .cardimg{width:120px;}
         .simplyclick-wrapper .hero h1{font-size:clamp(30px,7vw,40px);}
         .simplyclick-wrapper .bgrid{grid-template-columns:1fr 1fr;}
         .simplyclick-wrapper .fgrid{grid-template-columns:1fr 1fr;}
        }
        @media (max-width:560px){
         .simplyclick-wrapper .fgrid{grid-template-columns:1fr;}
         .simplyclick-wrapper .hero .grid{padding:16px 0 34px;}
         .simplyclick-wrapper .hero .pitchtop{flex-direction:row;align-items:center;gap:14px;}
         .simplyclick-wrapper .hero .pitchtop .cardwrap{width:84px;} .cardimg{width:84px;}
         .simplyclick-wrapper .hero h1{font-size:26px;margin:6px 0;}
         .simplyclick-wrapper .hero .lead{display:none;}
         .simplyclick-wrapper .chips{margin:12px 0 2px;gap:7px;} .chip{font-size:12.5px;padding:7px 12px;}
        }
        @media (max-width:520px){
         .simplyclick-wrapper .bgrid{grid-template-columns:1fr;}
        }
        @media (max-width:480px){
          .simplyclick-wrapper .wrap {
            padding: 0 12px !important;
          }
          .simplyclick-wrapper .topbar .btn-sm {
            padding: 6px 12px !important;
            font-size: 11px !important;
            box-shadow: 0 4px 10px rgba(67,23,34,.15) !important;
          }
          .simplyclick-wrapper .nav-logo img {
            height: 28px !important;
            width: 28px !important;
            border-radius: 6px !important;
          }
          .simplyclick-wrapper .nav-logo span {
            font-size: 0.95rem !important;
          }
          .simplyclick-wrapper .topbar .row {
            height: 48px !important;
          }
        }
        @media (prefers-reduced-motion:reduce){
          .simplyclick-wrapper *{transition:none!important;scroll-behavior:auto;}
        }

        /* OTP Modal Overlay */
        .sbi-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(42, 10, 20, 0.6);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .sbi-modal-panel {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 22px;
          padding: 30px 24px;
          max-width: 440px;
          width: 100%;
          box-shadow: 0 24px 50px rgba(67,23,34,.25);
          position: relative;
          text-align: center;
        }
        .sbi-modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          border: none;
          background: transparent;
          cursor: pointer;
          color: var(--wine);
          padding: 4px;
          border-radius: 50%;
          transition: background 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sbi-modal-close:hover {
          background: var(--blush);
        }
        .sbi-modal-icon-row {
          display: inline-flex;
          padding: 12px;
          background: var(--blush);
          border-radius: 50%;
          color: var(--wine);
          margin-bottom: 16px;
        }
        .sbi-modal-title {
          font-family: 'Bricolage Grotesque', sans-serif;
          font-size: 22px;
          color: var(--oxblood);
          margin-bottom: 8px;
        }
        .sbi-modal-desc {
          font-size: 14px;
          color: #6a4c53;
          line-height: 1.5;
          margin-bottom: 20px;
        }
        .sbi-otp-input-field {
          text-align: center;
          font-size: 24px;
          letter-spacing: 8px;
          padding: 10px;
          margin-bottom: 12px;
          border-radius: 12px;
          border: 1.5px solid var(--line);
          background: var(--paper);
          width: 100%;
        }
        .sbi-otp-status {
          display: block;
          font-size: 13px;
          color: var(--wine);
          margin-bottom: 14px;
          font-weight: 500;
        }
        .sbi-otp-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .sbi-otp-actions .btn {
          width: 100%;
          justify-content: center;
        }
        .sbi-resend-btn {
          background: transparent;
          border: none;
          color: var(--wine);
          cursor: pointer;
          font-size: 14px;
          text-decoration: underline;
          font-weight: 500;
        }
        .sbi-resend-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          text-decoration: none;
        }
      `}} />

      <div className="simplyclick-wrapper">
        <div className="topbar">
          <div className="wrap row">
            <div className="nav-logo" onClick={() => navigateTo('/')} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <img src="/logo.jpg" alt="FinMantra Logo" style={{ height: '40px', width: '40px', borderRadius: '10px', objectFit: 'cover' }} />
              <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: '1.30rem', letterSpacing: '-0.03em', color: 'var(--wine)' }}>FinMantra</span>
            </div>
            <a href="#apply" className="btn btn-primary btn-sm">Apply now</a>
          </div>
        </div>

        <header className="hero">
          <div className="wrap grid">
            <div className="pitch">
              <div className="pitchtop">
                <div style={{ flex: 1 }}>
                  <span className="eyebrow" style={{ color: 'var(--wine)' }}>SBI SimplyClick Credit Card</span>
                  <h1>Earn <span className="g">10X rewards</span> every time you shop online.</h1>
                </div>
                <div className="cardwrap">
                  <div className="glow"></div>
                  <div className="spark">&#10022;</div>
                  <img className="cardimg" alt="SBI SimplyClick Credit Card" src="/sbi_card.png" />
                </div>
              </div>
              <p className="lead">Get a &#8377;500 Amazon voucher on joining, 10X reward points on top online brands, and a &#8377;499 fee that&#8217;s reversed at &#8377;1 lakh spend.</p>
              <div className="chips">
                <span className="chip">&#8377;500 Amazon voucher</span>
                <span className="chip">10X online rewards</span>
                <span className="chip alt">Fee reversed at &#8377;1L</span>
                <span className="chip alt">&#8377;2,000 milestone vouchers</span>
              </div>
            </div>

            <div className="formcol" id="apply">
              <div className="formcard">
                <div className="formhead">
                  <h2>Apply for your SimplyClick Card</h2>
                  <p>Share your details and our team will help you complete the SBI Card application. Takes about 2 minutes.</p>
                </div>

                {isSubmitted ? (
                  <div className="success show" id="success">
                    <div className="tick">&#10003;</div>
                    <h2>Thanks, <span id="sname">{formData.name.split(' ')[0] || 'there'}</span>!</h2>
                    <p>Your details are with our SimplyClick team &mdash; we&#8217;ll be in touch shortly. You can continue to SBI Card&#8217;s secure application now.</p>
                    <a className="btn btn-gold" id="continuebtn" href={redirectUrl} rel="noopener">Continue to SBI application &rarr;</a>
                  </div>
                ) : (
                  <form id="leadform" onSubmit={handleFormSubmit} noValidate autoComplete="on">
                    <div className="fgrid">
                      <div className={`field pan full ${errors.pan ? 'invalid' : ''}`}>
                        <label htmlFor="pan">PAN number <span className="req">*</span></label>
                        <input
                          id="pan"
                          name="pan"
                          maxLength="10"
                          placeholder="ABCDE1234F"
                          autoComplete="off"
                          inputMode="text"
                          aria-describedby="pan_err"
                          value={formData.pan}
                          onChange={handleInputChange}
                        />
                        <span className="hint">10 characters as printed on your PAN card.</span>
                        <span className="err" id="pan_err">{errors.pan || 'Enter a valid PAN (e.g. ABCDE1234F).'}</span>
                      </div>

                      <div className={`field ${errors.name ? 'invalid' : ''}`}>
                        <label htmlFor="name">Full name (as on PAN) <span className="req">*</span></label>
                        <input
                          id="name"
                          name="name"
                          placeholder="Your full name"
                          autoComplete="name"
                          value={formData.name}
                          onChange={handleInputChange}
                        />
                        <span className="err">{errors.name || 'Enter your full name.'}</span>
                      </div>

                      <div className={`field ${errors.dob ? 'invalid' : ''}`}>
                        <label htmlFor="dob">Date of birth <span className="req">*</span></label>
                        <input
                          id="dob"
                          name="dob"
                          type="date"
                          autoComplete="bday"
                          value={formData.dob}
                          onChange={handleInputChange}
                        />
                        <span className="err" id="dob_err">{errors.dob || 'You must be 21–70 to apply for this card.'}</span>
                      </div>

                      <div className={`field ${errors.mother_name ? 'invalid' : ''}`}>
                        <label htmlFor="mother">Mother&#8217;s name <span className="req">*</span></label>
                        <input
                          id="mother"
                          name="mother_name"
                          placeholder="Mother&#8217;s full name"
                          autoComplete="off"
                          value={formData.mother_name}
                          onChange={handleInputChange}
                        />
                        <span className="err">{errors.mother_name || 'Enter your mother&#8217;s name.'}</span>
                      </div>

                      <div className={`field ${errors.mobile ? 'invalid' : ''}`}>
                        <label htmlFor="mobile">WhatsApp number <span className="req">*</span></label>
                        <div className="mob">
                          <span className="pre">+91</span>
                          <input
                            id="mobile"
                            name="mobile"
                            maxLength="10"
                            placeholder="10-digit WhatsApp no."
                            inputMode="numeric"
                            autoComplete="tel-national"
                            value={formData.mobile}
                            onChange={handleInputChange}
                          />
                        </div>
                        <span className="err" id="mob_err">{errors.mobile || 'Enter a valid 10-digit WhatsApp number.'}</span>
                      </div>

                      <div className="field full">
                        <label htmlFor="address">Current address <span className="req">*</span></label>
                        <textarea
                          id="address"
                          name="address"
                          placeholder="House / flat, street, area, city, state & PIN code"
                          autoComplete="street-address"
                          className={errors.address ? 'invalid' : ''}
                          value={formData.address}
                          onChange={handleInputChange}
                        ></textarea>
                        {errors.address && <span className="err" style={{ display: 'block' }}>{errors.address}</span>}
                      </div>

                      <div className={`field ${errors.email ? 'invalid' : ''}`}>
                        <label htmlFor="email">Email address <span className="req">*</span></label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="you@example.com"
                          autoComplete="email"
                          value={formData.email}
                          onChange={handleInputChange}
                        />
                        <span className="err" id="email_err">{errors.email || 'Enter a valid email address.'}</span>
                      </div>

                      <div className={`field ${errors.pincode ? 'invalid' : ''}`}>
                        <label htmlFor="pincode">Pincode <span className="req">*</span></label>
                        <input
                          id="pincode"
                          name="pincode"
                          maxLength="6"
                          placeholder="6-digit pincode"
                          inputMode="numeric"
                          value={formData.pincode}
                          onChange={handleInputChange}
                        />
                        <span className="err" id="pincode_err">
                          {errors.pincode || pincodeError || 'Enter a serviceable 6-digit pincode.'}
                        </span>
                        {pincodeLocationText && !pincodeError && (
                          <span style={{ fontSize: '11px', color: 'var(--ok)', marginTop: '4px', fontWeight: 600 }}>
                            Location: {pincodeLocationText}
                          </span>
                        )}
                      </div>

                      <div className={`field ${errors.occupation ? 'invalid' : ''}`}>
                        <label htmlFor="occupation">Occupation <span className="req">*</span></label>
                        <select
                          id="occupation"
                          name="occupation"
                          value={formData.occupation}
                          onChange={handleInputChange}
                        >
                          <option value="" disabled>Select&#8230;</option>
                          <option value="Salaried">Salaried</option>
                          <option value="Self-employed professional">Self-employed professional</option>
                          <option value="Self-employed / Business">Self-employed / Business</option>
                          <option value="Other">Other</option>
                        </select>
                        <span className="err">{errors.occupation || 'Select your occupation.'}</span>
                      </div>

                      <div className={`field ${errors.designation ? 'invalid' : ''}`}>
                        <label htmlFor="designation">Designation <span className="req">*</span></label>
                        <input
                          id="designation"
                          name="designation"
                          placeholder="e.g. Manager"
                          autoComplete="organization-title"
                          value={formData.designation}
                          onChange={handleInputChange}
                        />
                        <span className="err">{errors.designation || 'Enter your designation.'}</span>
                      </div>

                      <div className={`field ${errors.company ? 'invalid' : ''}`}>
                        <label htmlFor="company">Company name <span className="req">*</span></label>
                        <input
                          id="company"
                          name="company"
                          placeholder="Your employer / business name"
                          autoComplete="organization"
                          value={formData.company}
                          onChange={handleInputChange}
                        />
                        <span className="err">{errors.company || 'Enter your company name.'}</span>
                      </div>

                      <input className="hp" tabIndex="-1" autoComplete="off" name="website" aria-hidden="true" readOnly />

                      <div className="consent field">
                        <input
                          id="consent"
                          name="consent"
                          type="checkbox"
                          checked={formData.consent}
                          onChange={handleInputChange}
                        />
                        <label htmlFor="consent">
                          I authorise <b>FinMantra</b> (an authorised DSA of SBI Card) to use my details to assist my SBI SimplyClick Credit Card application and to contact me about it. I understand that card issuance and approval are at SBI Card&#8217;s sole discretion, subject to its eligibility criteria. Privacy Policy.
                        </label>
                      </div>
                      <span className="err" id="consent_err" style={{ gridColumn: '1/-1', display: errors.consent ? 'block' : 'none' }}>
                        {errors.consent || 'Please tick the box to continue.'}
                      </span>

                      {formError && (
                        <div style={{ gridColumn: '1/-1', padding: '12px', background: '#FDF2F2', border: '1px solid #FDE8E8', borderRadius: '12px', color: 'var(--err)', fontSize: '14px', fontWeight: 600 }}>
                          {formError}
                        </div>
                      )}

                      <div className="securenote">&#128274; Sent over a secure connection. We only use your details to assist your application.</div>

                      <div className="submitrow">
                        <button type="submit" className="btn btn-primary" id="submitbtn" disabled={isSubmitting}>
                          {isSubmitting ? 'Submitting\u2026' : 'Submit & continue \u2192'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </header>

        <section className="benefits">
          <div className="wrap">
            <span className="eyebrow">Why this card</span>
            <h2>Made for people who shop online.</h2>
            <div className="bgrid">
              <div className="bcard">
                <div className="n">10X</div>
                <h3>Reward points online</h3>
                <p>On top online partners like Myntra, Swiggy, BookMyShow &amp; Cleartrip. 5X on all other online spends.</p>
              </div>
              <div className="bcard">
                <div className="n">&#8377;500</div>
                <h3>Welcome voucher</h3>
                <p>An Amazon gift voucher lands when you join and pay the joining fee.</p>
              </div>
              <div className="bcard">
                <div className="n">&#8377;0*</div>
                <h3>Fee that pays back</h3>
                <p>&#8377;499 annual fee, reversed when your annual spends reach &#8377;1 lakh.</p>
              </div>
              <div className="bcard">
                <div className="n">&#8377;2,000</div>
                <h3>Milestone rewards</h3>
                <p>E-vouchers when your annual online spends cross &#8377;1L and &#8377;2L.</p>
              </div>
            </div>
          </div>
        </section>

        <footer>
          <div className="wrap">
            <div className="links">
              <a href="#">Privacy Policy</a>
              <a href="#">Terms &amp; Conditions</a>
              <a href="#apply">Apply</a>
            </div>
            <p className="disc">FinMantra is an authorised DSA of SBI Card. Annual fee &#8377;499 + GST, reversed on annual spend of &#8377;1,00,000. Reward points, partner brands and offers are subject to SBI Card terms and may change. 1 RP = &#8377;0.25. Card issuance and approval are subject to SBI Card&#8217;s eligibility criteria and sole discretion. T&amp;Cs apply.</p>
            <p className="note">This is a marketing and lead-assistance page operated by FinMantra, an authorised DSA of SBI Card. It is not the official SBI Card website. &ldquo;SBI Card&rdquo;, &ldquo;SimplyClick&rdquo; and related marks belong to SBI Cards &amp; Payment Services Ltd.</p>
          </div>
        </footer>

        {/* OTP Verification Modal Overlay */}
        {showOtpModal && (
          <div className="sbi-modal-overlay">
            <div className="sbi-modal-panel">
              <button className="sbi-modal-close" onClick={() => setShowOtpModal(false)}>
                <X size={20} />
              </button>

              <div className="sbi-modal-icon-row">
                <Lock size={24} />
              </div>

              <h4 className="sbi-modal-title">Verify WhatsApp Number</h4>
              <p className="sbi-modal-desc">
                We have sent a verification code to your WhatsApp number <strong>+91 {formData.mobile}</strong>. Enter the OTP code to verify and proceed.
              </p>

              {simulatedOtpText && (
                <div style={{
                  background: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  color: '#B45309',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  padding: '0.6rem 0.85rem',
                  borderRadius: '8px',
                  marginBottom: '1rem'
                }}>
                  [Simulation OTP]: {simulatedOtpText}
                </div>
              )}

              <input
                type="text"
                maxLength="6"
                className="sbi-otp-input-field"
                placeholder="••••••"
                value={otpVal}
                onChange={(e) => setOtpVal(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />

              {otpStatus && <span className="sbi-otp-status">{otpStatus}</span>}

              <div className="sbi-otp-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleVerifyOtp}
                  disabled={isSubmitting || otpVal.length !== 6}
                >
                  Verify &amp; Submit
                </button>
                <button
                  className="sbi-resend-btn"
                  onClick={handleResendOtp}
                  disabled={resendTimer > 0 || isSubmitting}
                >
                  {resendTimer > 0 ? `Resend (${resendTimer}s)` : 'Resend Code'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
