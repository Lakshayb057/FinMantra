import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, User, Phone, Mail, Calendar, MapPin, CheckCircle, RefreshCw, X, ShieldAlert, Briefcase, ChevronDown, Lock } from 'lucide-react';
import { trackLeadSubmission, initAnalytics } from '../utils/analytics';

// Offline fallback helper to resolve Indian pincodes to State/Region
const getStateFromPincode = (pin) => {
  const prefix = String(pin).substring(0, 2);
  const mapping = {
    '11': 'Delhi', '12': 'Haryana', '13': 'Haryana', '14': 'Punjab', '15': 'Punjab',
    '16': 'Chandigarh', '17': 'Himachal Pradesh', '18': 'Jammu and Kashmir', '19': 'Jammu and Kashmir',
    '20': 'Uttar Pradesh', '21': 'Uttar Pradesh', '22': 'Uttar Pradesh', '23': 'Uttar Pradesh', '24': 'Uttar Pradesh', '25': 'Uttar Pradesh', '26': 'Uttar Pradesh', '27': 'Uttar Pradesh', '28': 'Uttar Pradesh',
    '30': 'Rajasthan', '31': 'Rajasthan', '32': 'Rajasthan', '33': 'Rajasthan', '34': 'Rajasthan',
    '36': 'Gujarat', '37': 'Gujarat', '38': 'Gujarat', '39': 'Gujarat',
    '40': 'Maharashtra', '41': 'Maharashtra', '42': 'Maharashtra', '43': 'Maharashtra', '44': 'Maharashtra',
    '45': 'Madhya Pradesh', '46': 'Madhya Pradesh', '47': 'Madhya Pradesh', '48': 'Madhya Pradesh',
    '49': 'Chhattisgarh',
    '50': 'Telangana', '51': 'Andhra Pradesh', '52': 'Andhra Pradesh', '53': 'Andhra Pradesh',
    '56': 'Karnataka', '57': 'Karnataka', '58': 'Karnataka', '59': 'Karnataka',
    '60': 'Tamil Nadu', '61': 'Tamil Nadu', '62': 'Tamil Nadu', '63': 'Tamil Nadu', '64': 'Tamil Nadu',
    '67': 'Kerala', '68': 'Kerala', '69': 'Kerala',
    '70': 'West Bengal', '71': 'West Bengal', '72': 'West Bengal', '73': 'West Bengal', '74': 'West Bengal',
    '75': 'Odisha', '76': 'Odisha', '77': 'Odisha',
    '78': 'Assam', '79': 'North Eastern States',
    '80': 'Bihar', '81': 'Bihar', '82': 'Bihar', '83': 'Jharkhand', '84': 'Bihar', '85': 'Bihar',
    '90': 'Army Post Office'
  };
  return mapping[prefix] || 'Other';
};

export default function SimplyClickSbi({ navigateTo, utmParams }) {
  const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173') ? 'http://localhost:5000/api' : '/api';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    pincode: '',
    pan_no: '',
    employment: '',
    monthly_income: '',
    address_locality: '',
    address_city: '',
    address_state: ''
  });

  const [errors, setErrors] = useState({});
  const [settings, setSettings] = useState({});
  const [cards, setCards] = useState([]);

  // Pincode Lookup & Serviceability States
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeLocationText, setPincodeLocationText] = useState('');
  const [pincodeError, setPincodeError] = useState('');
  const [pincodeLocalities, setPincodeLocalities] = useState([]);

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
        setPincodeLocalities([]);
        setPincodeError('');
        return;
      }

      setPincodeLoading(true);
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
              const locText = `${city}, ${state}`;
              setPincodeLocationText(locText);

              // Gather unique localities
              const uniqueLocs = Array.from(new Set(postOffices.map(p => p.Name))).sort();
              setPincodeLocalities(uniqueLocs);

              setFormData(prev => ({
                ...prev,
                address_city: city,
                address_state: state,
                address_locality: uniqueLocs[0] || ''
              }));
              
              // Validate serviceability
              const matchedSbiCard = cards.find(c => String(c.name).toLowerCase().includes('simplyclick') || String(c.id).toLowerCase().includes('sbi'));
              if (matchedSbiCard && matchedSbiCard.bank) {
                const bankRulesRaw = settings.bank_pincode_rules || '';
                if (bankRulesRaw) {
                  try {
                    const bankRules = JSON.parse(bankRulesRaw);
                    const rule = bankRules[matchedSbiCard.bank];
                    if (rule && rule.mode === 'list') {
                      const allowedPins = Array.isArray(rule.pincodes) ? rule.pincodes : [];
                      if (!allowedPins.includes(pin)) {
                        setPincodeError(`Pincode is not serviceable by ${matchedSbiCard.bank} currently.`);
                      }
                    }
                  } catch (e) {
                    console.error('Failed to parse bank pincode rules:', e);
                  }
                }
              }
            }
          } else {
            setPincodeError('Invalid Pincode. No location found.');
          }
        } else {
          setPincodeError('Pincode verification service unavailable.');
        }
      } catch (err) {
        // Fallback to local resolver if API is blocked/down
        const resolvedState = getStateFromPincode(pin);
        if (resolvedState && resolvedState !== 'Other') {
          setPincodeLocationText(resolvedState);
          setFormData(prev => ({
            ...prev,
            address_city: 'City',
            address_state: resolvedState,
            address_locality: 'Locality'
          }));
        } else {
          setPincodeError('Failed to lookup pincode.');
        }
      } finally {
        setPincodeLoading(false);
      }
    };
    lookup();
  }, [formData.pincode, cards, settings]);

  // Input Change handler
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let stateKey = name;

    // Map input names from HTML to React state keys
    if (name === 'full_name') stateKey = 'fullName';
    if (name === 'mobile') stateKey = 'phone';
    if (name === 'pan') stateKey = 'pan_no';

    if (stateKey === 'phone' || stateKey === 'pincode') {
      const cleanVal = value.replace(/\D/g, '').slice(0, stateKey === 'phone' ? 10 : 6);
      setFormData(prev => ({ ...prev, [stateKey]: cleanVal }));
      validateField(stateKey, cleanVal);
      return;
    }

    if (stateKey === 'pan_no') {
      const cleanVal = value.toUpperCase().slice(0, 10);
      setFormData(prev => ({ ...prev, [stateKey]: cleanVal }));
      validateField(stateKey, cleanVal);
      return;
    }

    setFormData(prev => ({ ...prev, [stateKey]: value }));
    validateField(stateKey, value);
  };

  // Validation
  const validateField = (fieldName, value) => {
    const newErrors = { ...errors };

    if (fieldName === 'fullName') {
      if (!value || value.trim().length < 3) {
        newErrors.fullName = 'Full Name must be at least 3 letters.';
      } else {
        const trimmed = value.trim();
        if (!/^[A-Za-z\s]+$/.test(trimmed)) {
          newErrors.fullName = 'Full Name must contain letters and spaces only.';
        } else {
          const words = trimmed.split(/\s+/).filter(Boolean);
          if (words.length < 2) {
            newErrors.fullName = 'Please enter your Last Name / Father Name.';
          } else {
            delete newErrors.fullName;
          }
        }
      }
    }

    if (fieldName === 'phone') {
      if (!value || value.length !== 10 || !/^[6-9]/.test(value)) {
        newErrors.phone = 'Mobile must be a valid 10-digit number starting with 6-9.';
      } else {
        delete newErrors.phone;
      }
    }

    if (fieldName === 'email') {
      if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        newErrors.email = 'Enter a valid email address.';
      } else {
        delete newErrors.email;
      }
    }

    if (fieldName === 'pan_no') {
      if (!value || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value)) {
        newErrors.pan_no = 'Enter a valid 10-character PAN card number.';
      } else {
        delete newErrors.pan_no;
      }
    }

    if (fieldName === 'pincode') {
      if (!value || value.length !== 6) {
        newErrors.pincode = 'Enter a 6-digit pincode.';
      } else {
        delete newErrors.pincode;
      }
    }

    if (fieldName === 'employment') {
      if (!value) {
        newErrors.employment = 'Select your employment status.';
      } else {
        delete newErrors.employment;
      }
    }

    if (fieldName === 'monthly_income') {
      if (!value) {
        newErrors.monthly_income = 'Select your monthly income range.';
      } else {
        delete newErrors.monthly_income;
      }
    }

    setErrors(newErrors);
  };

  // Send Step 1 OTP
  const sendStep1Otp = async () => {
    const { phone } = formData;
    if (phone.length !== 10) return;
    setIsSubmitting(true);
    setFormError('');
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

  // Final Form Submit (Single-Step)
  const handleFormSubmit = async (e) => {
    if (e) e.preventDefault();
    setFormError('');
    setPincodeError('');

    // Strict validation on all 7 fields
    const newErrors = {};
    if (!formData.fullName || formData.fullName.trim().length < 3) {
      newErrors.fullName = 'Please enter your name.';
    } else {
      const trimmed = formData.fullName.trim();
      if (!/^[A-Za-z\s]+$/.test(trimmed)) {
        newErrors.fullName = 'Full Name must contain letters and spaces only.';
      } else {
        const words = trimmed.split(/\s+/).filter(Boolean);
        if (words.length < 2) {
          newErrors.fullName = 'Please enter your Last Name / Father Name';
        }
      }
    }

    if (!formData.phone || formData.phone.length !== 10 || !/^[6-9]/.test(formData.phone)) {
      newErrors.phone = 'Enter a valid 10-digit mobile.';
    }

    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Enter a valid email.';
    }

    if (!formData.pincode || formData.pincode.length !== 6 || !/^\d+$/.test(formData.pincode)) {
      newErrors.pincode = 'Enter a valid 6-digit pincode.';
    } else if (pincodeError) {
      newErrors.pincode = pincodeError;
    }

    if (!formData.pan_no || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan_no)) {
      newErrors.pan_no = 'Enter a valid PAN (e.g. ABCDE1234F).';
    }

    if (!formData.employment) {
      newErrors.employment = 'Please select one.';
    }

    if (!formData.monthly_income) {
      newErrors.monthly_income = 'Please select your income range.';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setFormError('Please correct the highlighted errors before submitting.');
      return;
    }

    // Trigger phone verification modal if not yet verified
    if (!isPhoneVerifiedRef.current) {
      sendStep1Otp();
      return;
    }

    setIsSubmitting(true);
    try {
      const compiledAddress = `${formData.address_locality || 'N/A'}, ${formData.address_city || 'N/A'}, ${formData.address_state || 'N/A'} - ${formData.pincode}`;

      const res = await fetch(`${API_URL}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.fullName,
          phone: formData.phone,
          email: formData.email,
          employment: formData.employment,
          monthly_income: formData.monthly_income,
          pan_no: formData.pan_no ? String(formData.pan_no).trim().toUpperCase() : null,
          pincode: formData.pincode,
          current_address: compiledAddress,
          consent: true,
          source: 'simplyclick_sbi',
          ...utmParams,
          utm_params: utmParams || null
        })
      });

      const data = await res.json();
      if (res.ok) {
        trackLeadSubmission({
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          eventId: data.urn,
          contentName: 'SBI SimplyClick Lead Submitted',
          status: 'submitted'
        });

        const cacheData = {
          name: formData.fullName,
          urn: data.urn,
          redirectUrl: data.redirectUrl,
          cardName: 'SBI SimplyClick Credit Card',
          bank: 'SBI Card',
          timestamp: new Date().getTime()
        };
        sessionStorage.setItem('finmantra_applied_lead', JSON.stringify(cacheData));

        // Singular link resolution for non-Android/desktop environments
        let finalUrl = data.redirectUrl;
        console.log('[SBI Redirect] Raw redirectUrl from server:', finalUrl);

        const isDesktop = /Windows|Macintosh|MacIntel|Linux x86_64/i.test(navigator.userAgent || '') || 
                          /Win32|MacIntel|Win64/i.test(navigator.platform || '');
        const isAndroid = /Android/i.test(navigator.userAgent || '');

        if ((isDesktop || !isAndroid) && finalUrl && finalUrl.includes('sng.link')) {
          try {
            console.log('[SBI Redirect] Non-Android/Desktop platform with Singular link. Resolving server-side...');
            const resolveRes = await fetch(`${API_URL}/resolve-singular?url=${encodeURIComponent(finalUrl)}`);
            const resolveData = await resolveRes.json();
            if (resolveRes.ok && resolveData.resolvedUrl) {
              finalUrl = resolveData.resolvedUrl;
              console.log('[SBI Redirect] Server-side resolved URL:', finalUrl);
            }
          } catch (resolveErr) {
            console.error('[SBI Redirect] Server-side resolution failed:', resolveErr);
          }
        }

        // Fallback intent:// URL resolution
        if (finalUrl && String(finalUrl).startsWith('intent://')) {
          const fbMatch = String(finalUrl).match(/S\.browser_fallback_url=([^;]+)/);
          if (fbMatch && fbMatch[1]) {
            try {
              finalUrl = decodeURIComponent(fbMatch[1]);
              console.log('[SBI Redirect] Resolved intent:// to HTTPS:', finalUrl);
            } catch (decodeErr) {
              console.error('[SBI Redirect] Failed to decode fallback URL:', decodeErr);
            }
          }
        }
        console.log('[SBI Redirect] Final navigation URL:', finalUrl);
        window.location.replace(finalUrl);
      } else {
        setFormError(data.error || 'Failed to submit application. Please try again.');
      }
    } catch (err) {
      setFormError('Network error. Unable to contact servers.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Styles injected dynamically matching premium SBI SimplyClick branding */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --bg: #F4F7FC; 
          --bg2: #EAF0FA; 
          --panel: #FFFFFF; 
          --ink: #0D2340; 
          --mut: #4C6584;
          --sbi-blue: #0A3F83; 
          --sbi-light: #00A3E0; 
          --cta: #0A3F83; 
          --cta-hover: #072B5C;
          --ctatx: #FFFFFF; 
          --orange: #FF8A00;
          --line: rgba(10,63,131,.12);
          --radius-sm: 8px;
          --radius-md: 12px;
          --radius-lg: 18px;
          --shadow-sm: 0 2px 8px rgba(10,63,131,0.04);
          --shadow: 0 8px 24px rgba(10,63,131,0.06);
          --shadow-lg: 0 16px 40px rgba(10,63,131,0.1);
          --transition-smooth: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sbi-body {
          font-family: 'Outfit', sans-serif;
          color: var(--ink);
          background: var(--bg);
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
        }
        .sbi-acc {
          font-family: 'Outfit', sans-serif;
          font-weight: 700;
          color: var(--orange);
        }
        .sbi-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1.5rem;
        }

        /* 1. Responsive Header */
        .sbi-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--line);
          padding: 0.85rem 0;
          transition: var(--transition-smooth);
        }
        .sbi-header-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 48px;
        }
        .sbi-logo-section {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
        }
        .sbi-main-logo {
          height: 38px;
          width: auto;
          object-fit: contain;
          border-radius: var(--radius-sm);
        }
        .sbi-logo-separator {
          width: 1px;
          height: 24px;
          background: var(--line);
        }
        .sbi-logo-title {
          font-size: 0.95rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--sbi-blue);
        }
        .sbi-header-actions {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }
        .sbi-header-compliance {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--mut);
          background: var(--bg2);
          padding: 0.35rem 0.75rem;
          border-radius: 50px;
        }
        .sbi-header-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--cta);
          color: var(--ctatx);
          font-size: 0.85rem;
          font-weight: 700;
          padding: 0.65rem 1.25rem;
          border-radius: 50px;
          border: none;
          cursor: pointer;
          transition: var(--transition-smooth);
          box-shadow: 0 4px 12px rgba(10, 63, 131, 0.15);
        }
        .sbi-header-btn:hover {
          background: var(--cta-hover);
          transform: translateY(-1px);
        }

        /* 2. Hero Section */
        .sbi-hero {
          padding: 3.5rem 0;
          background: radial-gradient(circle at top right, rgba(0, 163, 224, 0.05), transparent 60%);
        }
        .sbi-hero-grid {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 3.5rem;
          align-items: start;
        }
        .sbi-hero-copy {
          padding-top: 1rem;
        }
        .sbi-hero-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: var(--sbi-blue);
          background: rgba(10, 63, 131, 0.08);
          padding: 0.4rem 0.85rem;
          border-radius: 50px;
          margin-bottom: 1.5rem;
          text-transform: uppercase;
        }
        .sbi-hero-title {
          font-size: clamp(2.3rem, 4.5vw, 3.4rem);
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -0.03em;
          color: var(--ink);
          margin-bottom: 1.25rem;
        }
        .sbi-hero-subtitle {
          font-size: 1.05rem;
          font-weight: 500;
          line-height: 1.6;
          color: var(--mut);
          margin-bottom: 2rem;
          max-width: 520px;
        }

        /* Ticks Block */
        .sbi-ticks {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 2.5rem;
        }
        .sbi-tick-item {
          display: flex;
          align-items: flex-start;
          gap: 0.85rem;
        }
        .sbi-tick-icon {
          flex-shrink: 0;
          margin-top: 0.15rem;
          color: var(--sbi-light);
        }
        .sbi-tick-text {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--ink);
        }
        .sbi-tick-subtext {
          display: block;
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--mut);
          margin-top: 0.15rem;
        }

        /* Card Art & Coin Wrapping */
        .sbi-cardart-container {
          margin-top: 2rem;
          text-align: left;
        }
        .sbi-cardart {
          position: relative;
          display: inline-flex;
          border-radius: var(--radius-md);
        }
        .sbi-card-img {
          width: 320px;
          height: auto;
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          transition: var(--transition-smooth);
        }
        .sbi-cardart:hover .sbi-card-img {
          transform: translateY(-4px) rotate(1deg);
        }
        .sbi-coin-badge {
          position: absolute;
          top: -15px;
          right: -15px;
          background: linear-gradient(135deg, #FFB800 0%, #FF8A00 100%);
          color: #FFFFFF;
          font-size: 0.78rem;
          font-weight: 800;
          padding: 0.5rem 0.85rem;
          border-radius: 50px;
          box-shadow: 0 4px 15px rgba(255, 138, 0, 0.4);
          display: flex;
          align-items: center;
          gap: 0.25rem;
          animation: floatCoin 3s ease-in-out infinite;
        }
        @keyframes floatCoin {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        /* 3. Form Card styling */
        .sbi-formcard {
          background: var(--panel);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          border: 1px solid var(--line);
          padding: 2.25rem;
          position: sticky;
          top: 100px;
        }
        .sbi-formcard-hdr {
          margin-bottom: 1.75rem;
        }
        .sbi-formcard-title {
          font-size: 1.35rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--ink);
          margin-bottom: 0.35rem;
        }
        .sbi-formcard-desc {
          font-size: 0.88rem;
          font-weight: 500;
          color: var(--mut);
        }
        .sbi-field-group {
          margin-bottom: 1.25rem;
        }
        .sbi-two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .sbi-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--mut);
          margin-bottom: 0.4rem;
        }
        .sbi-input-wrap {
          position: relative;
        }
        .sbi-input-icon {
          position: absolute;
          left: 0.95rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--mut);
          width: 16px;
          height: 16px;
          pointer-events: none;
        }
        .sbi-input {
          width: 100%;
          padding: 0.85rem 1rem 0.85rem 2.6rem;
          font-size: 0.95rem;
          font-family: inherit;
          font-weight: 600;
          border-radius: var(--radius-sm);
          border: 1px solid var(--line);
          background: var(--bg);
          color: var(--ink);
          transition: var(--transition-smooth);
        }
        .sbi-input:focus {
          outline: none;
          border-color: var(--sbi-blue);
          background: #FFFFFF;
          box-shadow: 0 0 0 4px rgba(10, 63, 131, 0.08);
        }
        .sbi-input-hasvalue {
          border-color: var(--sbi-light);
        }
        .sbi-select {
          padding-right: 2.2rem;
          appearance: none;
          cursor: pointer;
        }
        .sbi-select-chevron {
          position: absolute;
          right: 0.95rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--mut);
          pointer-events: none;
          width: 16px;
          height: 16px;
        }
        .sbi-input-err {
          border-color: #E53E3E;
          background: #FFF5F5;
        }
        .sbi-input-err:focus {
          border-color: #E53E3E;
          box-shadow: 0 0 0 4px rgba(229, 62, 62, 0.08);
        }
        .sbi-err-msg {
          font-size: 0.75rem;
          font-weight: 600;
          color: #E53E3E;
          margin-top: 0.35rem;
          display: block;
        }

        /* Location Lookup indicators */
        .sbi-loc-indicator {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--sbi-blue);
          margin-top: 0.4rem;
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }
        .sbi-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Submit Actions */
        .sbi-submit-btn {
          width: 100%;
          background: var(--cta);
          color: var(--ctatx);
          font-size: 1rem;
          font-weight: 800;
          padding: 1rem;
          border-radius: var(--radius-sm);
          border: none;
          cursor: pointer;
          transition: var(--transition-smooth);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          box-shadow: 0 4px 15px rgba(10, 63, 131, 0.2);
        }
        .sbi-submit-btn:hover:not(:disabled) {
          background: var(--cta-hover);
          transform: translateY(-1px);
        }
        .sbi-submit-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .sbi-consent-strip {
          font-size: 0.72rem;
          font-weight: 500;
          line-height: 1.4;
          color: var(--mut);
          text-align: center;
          margin-top: 1rem;
        }
        .sbi-form-general-err {
          background: #FFF5F5;
          border: 1px solid #FED7D7;
          border-radius: var(--radius-sm);
          padding: 0.75rem 1rem;
          color: #C53030;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 1.25rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        /* 4. Trust Strip */
        .sbi-trust {
          background: var(--bg2);
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          padding: 1.5rem 0;
          margin-top: 1.5rem;
        }
        .sbi-trust-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
        }
        .sbi-trust-item {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.85rem;
          text-align: left;
        }
        .sbi-trust-icon {
          color: var(--sbi-blue);
          flex-shrink: 0;
        }
        .sbi-trust-text {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--ink);
          line-height: 1.35;
        }
        .sbi-trust-text span {
          display: block;
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--mut);
          margin-top: 0.15rem;
        }

        /* 5. Features Grid */
        .sbi-section {
          padding: 5rem 0;
        }
        .sbi-sec-hdr {
          text-align: center;
          max-width: 600px;
          margin: 0 auto 3.5rem auto;
        }
        .sbi-sec-title {
          font-size: clamp(1.8rem, 3.5vw, 2.4rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--ink);
          margin-bottom: 0.85rem;
        }
        .sbi-sec-subtitle {
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--mut);
        }
        .sbi-feat-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
        }
        .sbi-feat-card {
          background: #FFFFFF;
          border: 1px solid var(--line);
          border-radius: var(--radius-md);
          padding: 2rem 1.75rem;
          box-shadow: var(--shadow-sm);
          transition: var(--transition-smooth);
        }
        .sbi-feat-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
          border-color: var(--sbi-light);
        }
        .sbi-feat-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: var(--radius-sm);
          background: rgba(0, 163, 224, 0.1);
          color: var(--sbi-light);
          font-size: 1.5rem;
          margin-bottom: 1.25rem;
        }
        .sbi-feat-name {
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--ink);
          margin-bottom: 0.65rem;
        }
        .sbi-feat-desc {
          font-size: 0.88rem;
          font-weight: 500;
          color: var(--mut);
          line-height: 1.6;
        }

        /* 6. Milestones Section */
        .sbi-milestones {
          background: #061B35;
          color: #FFFFFF;
          padding: 5rem 0;
        }
        .sbi-milestones .sbi-sec-title {
          color: #FFFFFF;
        }
        .sbi-milestones .sbi-sec-subtitle {
          color: rgba(255, 255, 255, 0.7);
        }
        .sbi-m-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
          max-width: 1000px;
          margin: 0 auto;
        }
        .sbi-m-card {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-md);
          padding: 2.25rem 1.75rem;
          text-align: center;
          transition: var(--transition-smooth);
        }
        .sbi-m-card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--sbi-light);
        }
        .sbi-m-val {
          font-size: 2.5rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #FFB800;
          margin-bottom: 0.5rem;
        }
        .sbi-m-lbl {
          font-size: 0.95rem;
          font-weight: 700;
          color: #FFFFFF;
          margin-bottom: 0.5rem;
        }
        .sbi-m-desc {
          font-size: 0.82rem;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.5;
        }

        /* 7. Steps Section */
        .sbi-steps-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5rem;
        }
        .sbi-step-card {
          position: relative;
          background: #FFFFFF;
          border: 1px solid var(--line);
          border-radius: var(--radius-md);
          padding: 2rem 1.5rem;
          text-align: center;
        }
        .sbi-step-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 50px;
          background: var(--sbi-blue);
          color: #FFFFFF;
          font-size: 0.88rem;
          font-weight: 800;
          margin-bottom: 1.25rem;
          box-shadow: 0 4px 10px rgba(10, 63, 131, 0.2);
        }
        .sbi-step-title {
          font-size: 0.95rem;
          font-weight: 800;
          color: var(--ink);
          margin-bottom: 0.5rem;
        }
        .sbi-step-desc {
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--mut);
          line-height: 1.5;
        }

        /* 8. FAQ Section */
        .sbi-faq-grid {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .sbi-faq-item {
          background: #FFFFFF;
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
          padding: 1.25rem 1.5rem;
        }
        .sbi-faq-q {
          font-size: 0.98rem;
          font-weight: 800;
          color: var(--ink);
          margin-bottom: 0.5rem;
        }
        .sbi-faq-a {
          font-size: 0.88rem;
          font-weight: 500;
          color: var(--mut);
          line-height: 1.55;
        }

        /* 9. Footer styling */
        .sbi-footer {
          background: #08101C;
          color: rgba(255, 255, 255, 0.7);
          padding: 4.5rem 0 3rem 0;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 0.85rem;
          line-height: 1.6;
        }
        .sbi-footer-top {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 4rem;
          margin-bottom: 3.5rem;
        }
        .sbi-footer-brand {
          max-width: 480px;
        }
        .sbi-footer-logo-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }
        .sbi-footer-logo-title {
          font-size: 1.1rem;
          font-weight: 800;
          color: #FFFFFF;
          letter-spacing: -0.02em;
        }
        .sbi-footer-desc {
          font-size: 0.82rem;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 1.5rem;
        }
        .sbi-footer-links-col {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          text-align: right;
        }
        .sbi-footer-links {
          display: flex;
          justify-content: flex-end;
          gap: 1.5rem;
          flex-wrap: wrap;
        }
        .sbi-footer-link {
          color: rgba(255, 255, 255, 0.6);
          text-decoration: none;
          font-weight: 600;
          font-size: 0.82rem;
          transition: var(--transition-smooth);
          cursor: pointer;
        }
        .sbi-footer-link:hover {
          color: var(--sbi-light);
        }
        .sbi-footer-compliance {
          font-size: 0.72rem;
          color: rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.02);
          padding: 0.75rem 1rem;
          border-radius: var(--radius-sm);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .sbi-footer-bottom {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .sbi-footer-copy {
          font-size: 0.78rem;
          color: rgba(255, 255, 255, 0.4);
        }
        .sbi-footer-seal {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
        }
        .sbi-footer-seal-icon {
          color: #10B981;
        }

        /* 10. OTP Modal Popups */
        .sbi-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(8, 16, 28, 0.6);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1.5rem;
        }
        .sbi-modal-panel {
          background: #FFFFFF;
          border-radius: var(--radius-lg);
          box-shadow: 0 20px 50px rgba(8, 16, 28, 0.3);
          border: 1px solid var(--line);
          width: 100%;
          max-width: 440px;
          padding: 2.25rem 2rem;
          position: relative;
          text-align: center;
          animation: modalSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes modalSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .sbi-modal-close {
          position: absolute;
          top: 1.25rem;
          right: 1.25rem;
          background: transparent;
          border: none;
          color: var(--mut);
          cursor: pointer;
          transition: var(--transition-smooth);
          border-radius: 50%;
          padding: 0.25rem;
        }
        .sbi-modal-close:hover {
          background: var(--bg);
          color: var(--ink);
        }
        .sbi-modal-icon-row {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(0, 163, 224, 0.1);
          color: var(--sbi-light);
          font-size: 1.75rem;
          margin-bottom: 1.25rem;
        }
        .sbi-modal-title {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--ink);
          margin-bottom: 0.5rem;
          letter-spacing: -0.01em;
        }
        .sbi-modal-desc {
          font-size: 0.85rem;
          font-weight: 500;
          line-height: 1.5;
          color: var(--mut);
          margin-bottom: 1.5rem;
        }
        .sbi-otp-input {
          font-size: 1.5rem;
          font-weight: 800;
          text-align: center;
          letter-spacing: 0.5em;
          padding: 0.75rem;
          border-radius: var(--radius-sm);
          border: 2px solid var(--line);
          background: var(--bg);
          width: 100%;
          margin-bottom: 1rem;
          transition: var(--transition-smooth);
        }
        .sbi-otp-input:focus {
          outline: none;
          border-color: var(--sbi-blue);
          background: #FFFFFF;
          box-shadow: 0 0 0 4px rgba(10, 63, 131, 0.08);
        }
        .sbi-otp-status {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--sbi-blue);
          margin-bottom: 1.25rem;
          display: block;
        }
        .sbi-otp-actions {
          display: grid;
          grid-template-columns: 1.3fr 0.7fr;
          gap: 0.85rem;
        }
        .sbi-resend-btn {
          background: transparent;
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--mut);
          cursor: pointer;
          transition: var(--transition-smooth);
        }
        .sbi-resend-btn:hover:not(:disabled) {
          background: var(--bg);
          color: var(--ink);
          border-color: var(--mut);
        }
        .sbi-resend-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        /* Responsive Breakpoints */
        @media (max-width: 991px) {
          .sbi-hero-grid {
            grid-template-columns: 1fr;
            gap: 3rem;
          }
          .sbi-hero-copy {
            text-align: center;
          }
          .sbi-hero-subtitle {
            margin: 0 auto 2rem auto;
          }
          .sbi-ticks {
            max-width: 500px;
            margin: 0 auto 2.5rem auto;
            text-align: left;
          }
          .sbi-cardart-container {
            text-align: center;
          }
          .sbi-formcard {
            max-width: 480px;
            margin: 0 auto;
            position: static;
          }
        }

        @media (max-width: 860px) {
          .sbi-feat-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .sbi-m-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .sbi-steps-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .sbi-header-compliance {
            display: none;
          }
          .sbi-header-logo-separator, .sbi-header-logo-title {
            display: none;
          }
          .sbi-trust-grid {
            grid-template-columns: 1fr;
            gap: 1.25rem;
          }
          .sbi-trust-item {
            justify-content: flex-start;
          }
          .sbi-footer-top {
            grid-template-columns: 1fr;
            gap: 2rem;
          }
          .sbi-footer-links-col {
            text-align: left;
          }
          .sbi-footer-links {
            justify-content: flex-start;
          }
        }

        @media (max-width: 520px) {
          .sbi-feat-grid {
            grid-template-columns: 1fr;
          }
          .sbi-m-grid {
            grid-template-columns: 1fr;
            max-width: 360px;
          }
          .sbi-steps-grid {
            grid-template-columns: 1fr;
            max-width: 360px;
            margin: 0 auto;
          }
          .sbi-two {
            grid-template-columns: 1fr;
            gap: 0;
          }
          .sbi-formcard {
            padding: 1.5rem 1.25rem;
          }
        }

        @media (max-width: 360px) {
          .sbi-otp-actions {
            grid-template-columns: 1fr;
          }
          .sbi-resend-btn {
            padding: 0.85rem;
          }
          .sbi-modal-panel {
            padding: 1.5rem 1rem;
          }
        }
      `}} />

      <div className="sbi-body">
        {/* 1. Header */}
        <header className="sbi-header">
          <div className="sbi-container sbi-header-inner">
            <div className="sbi-logo-section" onClick={() => navigateTo('/')}>
              <img src="/logo.jpg" alt="FinMantra Logo" className="sbi-main-logo" />
              <div className="sbi-logo-separator"></div>
              <span className="sbi-logo-title">FinMantra</span>
            </div>
            <div className="sbi-header-actions">
              <span className="sbi-header-compliance">Authorised referral partner of SBI Card</span>
              <button 
                className="sbi-header-btn"
                onClick={() => {
                  const formEl = document.getElementById('apply-form');
                  if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Apply Now <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* 2. Hero Section */}
        <section className="sbi-hero">
          <div className="sbi-container sbi-hero-grid">
            <div className="sbi-hero-copy">
              <span className="sbi-hero-tag">SBI SimplyClick Credit Card</span>
              <h1 className="sbi-hero-title">
                Your online spends, now <span className="sbi-acc">simply rewarding.</span>
              </h1>
              <p className="sbi-hero-subtitle">
                Make online shopping smarter. Get rewarded on all your digital purchases, enjoy premium brand vouchers, and bypass surcharges seamlessly.
              </p>

              <div className="sbi-ticks">
                <div className="sbi-tick-item">
                  <CheckCircle className="sbi-tick-icon" size={20} />
                  <div>
                    <span className="sbi-tick-text">10X Reward Points on Online Spends</span>
                    <span className="sbi-tick-subtext">On top brands: Amazon, BookMyShow, Cleartrip, Netmeds & more</span>
                  </div>
                </div>
                <div className="sbi-tick-item">
                  <CheckCircle className="sbi-tick-icon" size={20} />
                  <div>
                    <span className="sbi-tick-text">₹500 Welcome Gift Voucher</span>
                    <span className="sbi-tick-subtext">Get an Amazon.in Gift Voucher worth ₹500 on card issuance fee payment</span>
                  </div>
                </div>
                <div className="sbi-tick-item">
                  <CheckCircle className="sbi-tick-icon" size={20} />
                  <div>
                    <span className="sbi-tick-text">₹4,000 Milestone Milestones</span>
                    <span className="sbi-tick-subtext">Earn ₹2,00,000 Milestone spends gets you ₹2,000 e-gift voucher (or similar)</span>
                  </div>
                </div>
              </div>

              <div className="sbi-cardart-container">
                <div className="sbi-cardart">
                  <img src="/sbi_card.png" alt="SBI SimplyClick Card Mockup" className="sbi-card-img" />
                  <span className="sbi-coin-badge">
                    10X Points
                  </span>
                </div>
              </div>
            </div>

            {/* Application Form Card */}
            <div className="sbi-formcard" id="apply-form">
              <div className="sbi-formcard-hdr">
                <h3 className="sbi-formcard-title">Apply in 2 Minutes</h3>
                <p className="sbi-formcard-desc">No physical documents required. 100% digital check.</p>
              </div>

              {formError && (
                <div className="sbi-form-general-err">
                  <ShieldAlert size={18} />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleFormSubmit}>
                {/* Full Name */}
                <div className="sbi-field-group">
                  <label className="sbi-label">Full Name (as on PAN)</label>
                  <div className="sbi-input-wrap">
                    <User className="sbi-input-icon" />
                    <input 
                      type="text" 
                      name="full_name"
                      placeholder="e.g. John Doe"
                      className={`sbi-input ${formData.fullName ? 'sbi-input-hasvalue' : ''} ${errors.fullName ? 'sbi-input-err' : ''}`}
                      value={formData.fullName}
                      onChange={handleInputChange}
                    />
                  </div>
                  {errors.fullName && <span className="sbi-err-msg">{errors.fullName}</span>}
                </div>

                {/* Mobile & Email */}
                <div className="sbi-two">
                  <div className="sbi-field-group">
                    <label className="sbi-label">WhatsApp Mobile Number</label>
                    <div className="sbi-input-wrap">
                      <Phone className="sbi-input-icon" />
                      <input 
                        type="tel" 
                        name="mobile"
                        placeholder="10-digit number"
                        className={`sbi-input ${formData.phone ? 'sbi-input-hasvalue' : ''} ${errors.phone ? 'sbi-input-err' : ''}`}
                        value={formData.phone}
                        onChange={handleInputChange}
                      />
                    </div>
                    {errors.phone && <span className="sbi-err-msg">{errors.phone}</span>}
                  </div>

                  <div className="sbi-field-group">
                    <label className="sbi-label">Email Address</label>
                    <div className="sbi-input-wrap">
                      <Mail className="sbi-input-icon" />
                      <input 
                        type="email" 
                        name="email"
                        placeholder="name@domain.com"
                        className={`sbi-input ${formData.email ? 'sbi-input-hasvalue' : ''} ${errors.email ? 'sbi-input-err' : ''}`}
                        value={formData.email}
                        onChange={handleInputChange}
                      />
                    </div>
                    {errors.email && <span className="sbi-err-msg">{errors.email}</span>}
                  </div>
                </div>

                {/* PAN & Pincode */}
                <div className="sbi-two">
                  <div className="sbi-field-group">
                    <label className="sbi-label">PAN Number</label>
                    <div className="sbi-input-wrap">
                      <Lock className="sbi-input-icon" />
                      <input 
                        type="text" 
                        name="pan"
                        placeholder="ABCDE1234F"
                        className={`sbi-input ${formData.pan_no ? 'sbi-input-hasvalue' : ''} ${errors.pan_no ? 'sbi-input-err' : ''}`}
                        value={formData.pan_no}
                        onChange={handleInputChange}
                      />
                    </div>
                    {errors.pan_no && <span className="sbi-err-msg">{errors.pan_no}</span>}
                  </div>

                  <div className="sbi-field-group">
                    <label className="sbi-label">Residence Pincode</label>
                    <div className="sbi-input-wrap">
                      <MapPin className="sbi-input-icon" />
                      <input 
                        type="text" 
                        name="pincode"
                        placeholder="e.g. 110001"
                        className={`sbi-input ${formData.pincode ? 'sbi-input-hasvalue' : ''} ${errors.pincode ? 'sbi-input-err' : ''}`}
                        value={formData.pincode}
                        onChange={handleInputChange}
                      />
                    </div>
                    {pincodeLoading && (
                      <span className="sbi-loc-indicator">
                        <RefreshCw size={12} className="sbi-spin" /> Fetching location...
                      </span>
                    )}
                    {pincodeLocationText && !pincodeError && (
                      <span className="sbi-loc-indicator">
                        📍 {pincodeLocationText}
                      </span>
                    )}
                    {errors.pincode && <span className="sbi-err-msg">{errors.pincode}</span>}
                  </div>
                </div>

                {/* Localities dropdown */}
                {pincodeLocalities.length > 0 && !pincodeError && (
                  <div className="sbi-field-group">
                    <label className="sbi-label">Area / Locality</label>
                    <div className="sbi-input-wrap">
                      <MapPin className="sbi-input-icon" />
                      <select 
                        name="address_locality" 
                        className="sbi-input sbi-select sbi-input-hasvalue"
                        value={formData.address_locality}
                        onChange={handleInputChange}
                      >
                        {pincodeLocalities.map((loc, index) => (
                          <option key={index} value={loc}>{loc}</option>
                        ))}
                      </select>
                      <ChevronDown className="sbi-select-chevron" />
                    </div>
                  </div>
                )}

                {/* Employment & Monthly Income */}
                <div className="sbi-two">
                  <div className="sbi-field-group">
                    <label className="sbi-label">Employment Type</label>
                    <div className="sbi-input-wrap">
                      <Briefcase className="sbi-input-icon" />
                      <select 
                        name="employment" 
                        className={`sbi-input sbi-select ${formData.employment ? 'sbi-input-hasvalue' : ''} ${errors.employment ? 'sbi-input-err' : ''}`}
                        value={formData.employment}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Status</option>
                        <option value="Salaried">Salaried Employee</option>
                        <option value="Self Employed">Self Employed / Business</option>
                        <option value="Other">Retired / Student / Housewife</option>
                      </select>
                      <ChevronDown className="sbi-select-chevron" />
                    </div>
                    {errors.employment && <span className="sbi-err-msg">{errors.employment}</span>}
                  </div>

                  <div className="sbi-field-group">
                    <label className="sbi-label">Monthly Income</label>
                    <div className="sbi-input-wrap">
                      <Calendar className="sbi-input-icon" />
                      <select 
                        name="monthly_income" 
                        className={`sbi-input sbi-select ${formData.monthly_income ? 'sbi-input-hasvalue' : ''} ${errors.monthly_income ? 'sbi-input-err' : ''}`}
                        value={formData.monthly_income}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Income Range</option>
                        <option value="Under ₹25,000">Under ₹25,000</option>
                        <option value="₹25,000 - ₹50,000">₹25,000 - ₹50,000</option>
                        <option value="₹50,000 - ₹1,00,000">₹50,000 - ₹1,00,000</option>
                        <option value="Above ₹1,00,000">Above ₹1,00,000</option>
                      </select>
                      <ChevronDown className="sbi-select-chevron" />
                    </div>
                    {errors.monthly_income && <span className="sbi-err-msg">{errors.monthly_income}</span>}
                  </div>
                </div>

                {/* Submit button */}
                <button 
                  type="submit" 
                  className="sbi-submit-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={18} className="sbi-spin" /> Verifying...
                    </>
                  ) : (
                    <>
                      Verify Mobile Number <ArrowRight size={18} />
                    </>
                  )}
                </button>

                <p className="sbi-consent-strip">
                  By clicking, you consent to share details with FinMantra (Authorised DSA) and receive verification alerts over WhatsApp/SMS.
                </p>
              </form>
            </div>
          </div>
        </section>

        {/* 3. Trust Strip */}
        <section className="sbi-trust">
          <div className="sbi-container sbi-trust-grid">
            <div className="sbi-trust-item">
              <CheckCircle className="sbi-trust-icon" size={24} />
              <span className="sbi-trust-text">
                10X Rewards
                <span>On Online Partner Spends</span>
              </span>
            </div>
            <div className="sbi-trust-item">
              <CheckCircle className="sbi-trust-icon" size={24} />
              <span className="sbi-trust-text">
                ₹500 Welcome Voucher
                <span>On Amazon.in post card activation</span>
              </span>
            </div>
            <div className="sbi-trust-item">
              <CheckCircle className="sbi-trust-icon" size={24} />
              <span className="sbi-trust-text">
                Zero Physical Paperwork
                <span>Instantly generated application</span>
              </span>
            </div>
          </div>
        </section>

        {/* 4. Why SimplyClick Card */}
        <section className="sbi-section">
          <div className="sbi-container">
            <div className="sbi-sec-hdr">
              <h2 className="sbi-sec-title">SimplyClick Benefits</h2>
              <p className="sbi-sec-subtitle">A card tailored for digital shopaholics and daily online transaction users.</p>
            </div>

            <div className="sbi-feat-grid">
              <div className="sbi-feat-card">
                <span className="sbi-feat-badge">🛍️</span>
                <h3 className="sbi-feat-name">E-Shopping Partners</h3>
                <p className="sbi-feat-desc">
                  Earn 10X reward points on online shopping portals: Amazon, Cleartrip, Netmeds, Lenskart, BookMyShow, and Apollo.
                </p>
              </div>

              <div className="sbi-feat-card">
                <span className="sbi-feat-badge">🌐</span>
                <h3 className="sbi-feat-name">Global Spends</h3>
                <p className="sbi-feat-desc">
                  Earn 5X reward points on all other online spends, domestic or international. 1X points on regular offline purchases.
                </p>
              </div>

              <div className="sbi-feat-card">
                <span className="sbi-feat-badge">⛽</span>
                <h3 className="sbi-feat-name">Fuel Waiver</h3>
                <p className="sbi-feat-desc">
                  Enjoy 1% fuel surcharge waiver on transactions ranging from ₹500 to ₹3,000 across petrol pumps in India.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Milestones */}
        <section className="sbi-milestones">
          <div className="sbi-container">
            <div className="sbi-sec-hdr">
              <h2 className="sbi-sec-title">Spend Milestones & Waived Fees</h2>
              <p className="sbi-sec-subtitle">The more you click and spend online, the more you waive and get rewarded.</p>
            </div>

            <div className="sbi-m-grid">
              <div className="sbi-m-card">
                <div className="sbi-m-val">₹499</div>
                <div className="sbi-m-lbl">Waived Annual Fee</div>
                <p className="sbi-m-desc">Reversal of renewal fee of ₹499 when cumulative annual spends touch ₹1,00,000.</p>
              </div>

              <div className="sbi-m-card">
                <div className="sbi-m-val">₹2,000</div>
                <div className="sbi-m-lbl">Cleartrip Gift Voucher</div>
                <p className="sbi-m-desc">Get an e-gift voucher of ₹2,000 on reaching annual online spends threshold of ₹1,00,000.</p>
              </div>

              <div className="sbi-m-card">
                <div className="sbi-m-val">₹2,000</div>
                <div className="sbi-m-lbl">Cleartrip Gift Voucher</div>
                <p className="sbi-m-desc">Get an additional e-gift voucher of ₹2,000 on reaching annual online spends threshold of ₹2,00,000.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Step Process */}
        <section className="sbi-section">
          <div className="sbi-container">
            <div className="sbi-sec-hdr">
              <h2 className="sbi-sec-title">Application Steps</h2>
              <p className="sbi-sec-subtitle">Get your card approved via our fully-digital referral pipeline in 4 quick phases.</p>
            </div>

            <div className="sbi-steps-grid">
              <div className="sbi-step-card">
                <span className="sbi-step-num">1</span>
                <h4 className="sbi-step-title">Submit Information</h4>
                <p className="sbi-step-desc">Fill out your contact details, PAN, and basic employment criteria above.</p>
              </div>

              <div className="sbi-step-card">
                <span className="sbi-step-num">2</span>
                <h4 className="sbi-step-title">Verify WhatsApp OTP</h4>
                <p className="sbi-step-desc">Enter the authentication code sent to your phone to confirm registration.</p>
              </div>

              <div className="sbi-step-card">
                <span className="sbi-step-num">3</span>
                <h4 className="sbi-step-title">Onward Redirection</h4>
                <p className="sbi-step-desc">Get securely transferred to SBI Card’s official SPRINT verification system.</p>
              </div>

              <div className="sbi-step-card">
                <span className="sbi-step-num">4</span>
                <h4 className="sbi-step-title">Instant Approval</h4>
                <p className="sbi-step-desc">Complete e-KYC on the bank portal to generate your virtual card number.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. FAQs */}
        <section className="sbi-section" style={{ background: 'var(--bg2)' }}>
          <div className="sbi-container">
            <div className="sbi-sec-hdr">
              <h2 className="sbi-sec-title">Frequently Asked Questions</h2>
              <p className="sbi-sec-subtitle">Everything you need to know about the SBI SimplyClick Credit Card.</p>
            </div>

            <div className="sbi-faq-grid">
              <div className="sbi-faq-item">
                <h4 className="sbi-faq-q">What is the annual/joining fee for this card?</h4>
                <p className="sbi-faq-a">
                  The joining and renewal fee is ₹499 + GST. However, on payment of the joining fee, you get an Amazon Gift Voucher worth ₹500. The renewal fee is completely waived if your annual spends exceed ₹1,00,000.
                </p>
              </div>

              <div className="sbi-faq-item">
                <h4 className="sbi-faq-q">How does the 10X reward point structure work?</h4>
                <p className="sbi-faq-a">
                  You earn 10 reward points for every ₹100 spent online with partner brands (Amazon, BookMyShow, Cleartrip, Netmeds, Apollo, Lenskart). For all other online spends, you earn 5 points per ₹100. Offline spends earn 1 point per ₹100.
                </p>
              </div>

              <div className="sbi-faq-item">
                <h4 className="sbi-faq-q">Is physical document verification needed?</h4>
                <p className="sbi-faq-a">
                  No! The application is fully paperless. If your pincode is serviceable, you can complete identity validation via V-KYC (Video-KYC) using your PAN and Aadhaar number instantly.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 8. Footer */}
        <footer className="sbi-footer">
          <div className="sbi-container">
            <div className="sbi-footer-top">
              <div className="sbi-footer-brand">
                <div className="sbi-footer-logo-row">
                  <span className="sbi-footer-logo-title">FinMantra</span>
                </div>
                <p className="sbi-footer-desc">
                  FinMantra is an authorised referral partner of top banks and financial institutions in India. We help consumers review and select premium credit cards without charging any fee.
                </p>
                <div className="sbi-footer-compliance">
                  <strong>Corporate details:</strong> FinMantra is a brand operated by <strong>Chaos Design Pvt. Ltd.</strong> We do not issue credit cards or make loan decisions ourselves. All cards are subject to bank terms and policies.
                </div>
              </div>

              <div className="sbi-footer-links-col">
                <div className="sbi-footer-links">
                  <span className="sbi-footer-link" onClick={() => navigateTo('/about')}>About Us</span>
                  <span className="sbi-footer-link" onClick={() => navigateTo('/contact')}>Contact Support</span>
                  <span className="sbi-footer-link" onClick={() => navigateTo('/privacy-policy')}>Privacy Policy</span>
                  <span className="sbi-footer-link" onClick={() => navigateTo('/terms')}>Terms & Conditions</span>
                </div>
              </div>
            </div>

            <div className="sbi-footer-bottom">
              <span className="sbi-footer-copy">
                &copy; {new Date().getFullYear()} FinMantra (Chaos Design Pvt. Ltd.). All rights reserved.
              </span>
              <span className="sbi-footer-seal">
                🛡️ Secure 256-Bit SSL Connection
              </span>
            </div>
          </div>
        </footer>

        {/* 9. OTP Verification Modal Overlay */}
        {showOtpModal && (
          <div className="sbi-modal-overlay">
            <div className="sbi-modal-panel">
              <button className="sbi-modal-close" onClick={() => setShowOtpModal(false)}>
                <X size={20} />
              </button>

              <div className="sbi-modal-icon-row">
                <Lock size={24} />
              </div>

              <h4 className="sbi-modal-title">Verify Mobile Number</h4>
              <p className="sbi-modal-desc">
                We have sent a verification code to <strong>+91 {formData.phone}</strong>. Enter the OTP code to verify and proceed.
              </p>

              {simulatedOtpText && (
                <div style={{
                  background: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  color: '#B45309',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  padding: '0.6rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '1rem'
                }}>
                  [Simulation OTP]: {simulatedOtpText}
                </div>
              )}

              <input 
                type="text" 
                maxLength="6"
                className="sbi-otp-input"
                placeholder="••••••"
                value={otpVal}
                onChange={(e) => setOtpVal(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />

              {otpStatus && <span className="sbi-otp-status">{otpStatus}</span>}

              <div className="sbi-otp-actions">
                <button 
                  className="sbi-submit-btn"
                  onClick={handleVerifyOtp}
                  disabled={isSubmitting || otpVal.length !== 6}
                >
                  Verify & Submit
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
