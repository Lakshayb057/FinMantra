import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, User, Phone, Mail, Calendar, MapPin, CheckCircle, RefreshCw, X, ShieldAlert, Briefcase, ChevronDown, Lock } from 'lucide-react';
import { trackLeadSubmission, initAnalytics, resolveRedirectUrl } from '../utils/analytics';

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

export default function KiwiLanding({ navigateTo, utmParams }) {
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
      const timer = setTimeout(() => setResendTimer(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Auto-Lookup Pincode API & serviceability checks
  useEffect(() => {
    const lookupPincode = async () => {
      const pin = formData.pincode.trim();
      if (pin.length !== 6 || !/^\d+$/.test(pin)) {
        setPincodeLocationText('');
        setPincodeError('');
        return;
      }

      setPincodeLoading(true);
      setPincodeError('');
      setPincodeLocationText('');

      try {
        const res = await fetch(`${API_URL}/pincode/lookup/${pin}`);
        let city = '';
        let state = '';
        
        if (res.ok) {
          const data = await res.json();
          city = data.city || '';
          state = data.state || '';
          setPincodeLocationText(`${city}, ${state}`);
          setPincodeLocalities(data.localities || []);
          
          setFormData(prev => ({
            ...prev,
            address_city: city,
            address_state: state,
            address_locality: data.localities && data.localities.length > 0 ? data.localities[0] : ''
          }));
        } else {
          setPincodeLocalities([]);
          const fallbackState = getStateFromPincode(pin);
          if (fallbackState !== 'Other') {
            state = fallbackState;
            setPincodeLocationText(`${fallbackState} (Estimated)`);
            setFormData(prev => ({
              ...prev,
              address_state: fallbackState
            }));
          } else {
            setPincodeError('Pincode not found');
            setErrors(prev => ({ ...prev, pincode: 'Pincode not found' }));
            setPincodeLoading(false);
            return;
          }
        }

        // Validate serviceability against whitelist/blacklist settings
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

        // Validate Yes Bank specific rules
        if (!errorText && settings.bank_pincode_rules) {
          let bankRules = {};
          try {
            bankRules = typeof settings.bank_pincode_rules === 'string'
              ? JSON.parse(settings.bank_pincode_rules)
              : settings.bank_pincode_rules;
          } catch (e) {}
          const rule = bankRules['Yes Bank'];
          if (rule && rule.mode === 'list') {
            const pinArray = String(rule.list || '').split(',').map(p => p.trim()).filter(Boolean);
            if (!pinArray.includes(pin)) {
              errorText = 'Yes Bank cards facilities are currently not available for your location.';
            }
          }
        }

        if (errorText) {
          setPincodeError(errorText);
          setErrors(prev => ({ ...prev, pincode: errorText }));
        } else {
          setPincodeError('');
          setErrors(prev => {
            const updated = { ...prev };
            delete updated.pincode;
            return updated;
          });
        }
      } catch (err) {
        console.error('[Pincode Lookup] Error:', err);
        setPincodeError('Error verifying pincode');
      } finally {
        setPincodeLoading(false);
      }
    };

    lookupPincode();
  }, [formData.pincode, settings]);

  // Validate Field function
  const validateField = (name, value) => {
    let errorText = '';

    if (name === 'fullName') {
      if (value) {
        const trimmed = value.trim();
        if (trimmed.length < 3) {
          errorText = 'Full Name must be at least 3 characters.';
        } else if (!/^[A-Za-z\s]+$/.test(trimmed)) {
          errorText = 'Full Name must contain letters and spaces only.';
        } else {
          const words = trimmed.split(/\s+/).filter(Boolean);
          if (words.length < 2) {
            errorText = 'Please enter your Last Name / Father Name';
          }
        }
      } else {
        errorText = 'Please enter your name.';
      }
    }

    if (name === 'phone') {
      if (value) {
        if (!/^[6-9]/.test(value)) {
          errorText = 'Mobile number should start with 6,7,8,9 only';
        } else if (value.length !== 10) {
          errorText = 'Enter a valid 10-digit mobile.';
        }
      } else {
        errorText = 'Enter a valid 10-digit mobile.';
      }
    }

    if (name === 'email') {
      if (value) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errorText = 'Enter a valid email.';
        }
      } else {
        errorText = 'Enter a valid email.';
      }
    }

    if (name === 'pan_no') {
      if (value) {
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value)) {
          errorText = 'Enter a valid PAN (e.g. ABCDE1234F).';
        }
      } else {
        errorText = 'Enter a valid PAN (e.g. ABCDE1234F).';
      }
    }

    if (name === 'pincode') {
      if (value) {
        if (value.length !== 6 || !/^\d+$/.test(value)) {
          errorText = 'Enter a valid 6-digit pincode.';
        } else if (pincodeError) {
          errorText = pincodeError;
        }
      } else {
        errorText = 'Enter a valid 6-digit pincode.';
      }
    }

    if (name === 'employment') {
      if (!value) {
        errorText = 'Please select one.';
      }
    }

    if (name === 'monthly_income') {
      if (!value) {
        errorText = 'Please select your income range.';
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
  };

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
      
      // Find Yes Bank Kiwi Card
      let matchedKiwiCard = cards.find(c => c.id === 'kiwi' || c.name.toLowerCase().includes('kiwi'));
      const cardIdPayload = matchedKiwiCard ? matchedKiwiCard.id : null;

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
          source: 'kiwi',
          card_id: cardIdPayload,
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
          contentName: 'Kiwi Lead Submitted',
          status: 'submitted'
        });

        const cacheData = {
          name: formData.fullName,
          urn: data.urn,
          redirectUrl: data.redirectUrl,
          cardName: 'Kiwi Credit Card',
          bank: 'Yes Bank',
          timestamp: new Date().getTime()
        };
        sessionStorage.setItem('finmantra_applied_lead', JSON.stringify(cacheData));

        // Inline intent:// URL resolution — extract HTTPS fallback from Android intent scheme
        let finalUrl = data.redirectUrl;
        console.log('[Kiwi Redirect] Raw redirectUrl from server:', finalUrl);
        if (finalUrl && String(finalUrl).startsWith('intent://')) {
          const fbMatch = String(finalUrl).match(/S\.browser_fallback_url=([^;]+)/);
          if (fbMatch && fbMatch[1]) {
            try {
              finalUrl = decodeURIComponent(fbMatch[1]);
              console.log('[Kiwi Redirect] Resolved intent:// to HTTPS:', finalUrl);
            } catch (decodeErr) {
              console.error('[Kiwi Redirect] Failed to decode fallback URL:', decodeErr);
            }
          } else {
            console.warn('[Kiwi Redirect] intent:// URL has no S.browser_fallback_url, using as-is');
          }
        }
        console.log('[Kiwi Redirect] Final navigation URL:', finalUrl);
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
      {/* Styles injected dynamically matching Kiwi Landing design system */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --bg: #FCFEF8; 
          --bg2: #EFF5E2; 
          --panel: #FFFFFF; 
          --ink: #123C1D; 
          --mut: #4B6B3A;
          --green: #2FA43B; 
          --lime: #B7F13F; 
          --cta: #0F5A24; 
          --ctatx: #EEFFC6; 
          --line: rgba(18,60,29,.12);
        }
        .kiwi-body {
          font-family: 'Outfit', sans-serif;
          color: var(--ink);
          background: var(--bg);
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
        }
        .kiwi-acc {
          font-family: 'Instrument Serif', Georgia, serif;
          font-style: italic;
          font-weight: 400;
          color: var(--green);
        }
        .kiwi-wrap {
          max-width: 1120px;
          margin: 0 auto;
          padding: 0 20px;
        }
        .kiwi-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: .5em;
          background: var(--cta);
          color: var(--ctatx);
          font-weight: 700;
          border-radius: 999px;
          padding: 15px 26px;
          text-decoration: none;
          border: none;
          cursor: pointer;
          font-size: 17px;
          box-shadow: 0 14px 26px rgba(15,90,36,.28);
          transition: transform .15s ease, box-shadow .15s ease;
        }
        .kiwi-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 32px rgba(15,90,36,.34);
        }
        .kiwi-btn .kiwi-arw {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--lime);
          color: var(--cta);
          width: 26px;
          height: 26px;
          border-radius: 50%;
          font-weight: 800;
        }
        .kiwi-header {
          position: sticky;
          top: 0;
          z-index: 40;
          background: rgba(252,254,248,.9);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--line);
        }
        .kiwi-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 64px;
        }
        .kiwi-brand {
          display: flex;
          align-items: center;
          gap: .5em;
          font-weight: 700;
          font-size: 19px;
        }
        .kiwi-brand .kiwi-tag {
          font-weight: 400;
          color: var(--mut);
          font-size: 13px;
        }
        .kiwi-hero {
          position: relative;
          overflow: hidden;
          background: radial-gradient(120% 80% at 92% -10%, #E7F5C8 0%, var(--bg) 60%);
        }
        .kiwi-hero-grid {
          display: grid;
          gap: 26px 44px;
          grid-template-columns: 1.02fr .98fr;
          grid-template-areas: "copy form" "visual form";
          align-items: start;
          padding-top: 44px;
          padding-bottom: 52px;
        }
        .kiwi-hero-copy { grid-area: copy; }
        .kiwi-hero-form { grid-area: form; align-self: start; }
        .kiwi-hero-visual { grid-area: visual; }
        .kiwi-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: .5em;
          font-size: 13.5px;
          font-weight: 600;
          color: var(--green);
          background: #fff;
          border: 1px solid var(--line);
          padding: 7px 14px;
          border-radius: 999px;
          margin-bottom: 18px;
        }
        .kiwi-hero h1 { font-size: clamp(34px, 5vw, 58px); line-height: 1.15; }
        .kiwi-hero h1 .kiwi-acc { font-size: clamp(37px, 5.3vw, 63px); }
        .kiwi-hero p.kiwi-sub { font-size: clamp(16px, 2vw, 20px); color: var(--mut); margin: 16px 0 20px; max-width: 34ch; }
        .kiwi-ticks { display: grid; gap: 10px; margin-top: 6px; }
        .kiwi-ticks span { display: inline-flex; align-items: center; gap: 9px; font-size: 15.5px; }
        .kiwi-tick {
          width: 21px;
          height: 21px;
          border-radius: 50%;
          background: var(--green);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          flex: none;
        }
        .kiwi-cardart { position: relative; display: flex; align-items: center; justify-content: flex-start; margin-top: 28px; }
        .kiwi-cardart .kiwi-halo {
          position: absolute;
          width: 96%;
          height: 74%;
          border-radius: 50%;
          left: 0;
          background: radial-gradient(closest-side, rgba(183,241,63,.45), transparent);
          filter: blur(24px);
        }
        .kiwi-cardart img {
          position: relative;
          width: min(86%, 360px);
          transform: rotate(-6deg);
          filter: drop-shadow(0 28px 40px rgba(18,60,29,.28)) drop-shadow(0 8px 14px rgba(18,60,29,.16));
        }
        .kiwi-coin {
          position: absolute;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: radial-gradient(circle at 34% 28%, #F2FFC4, #A6E01E 62%, #7FC70E);
          color: var(--cta);
          font-weight: 700;
          border: 3px solid #EEFFB0;
          box-shadow: 0 12px 22px rgba(15,90,36,.30);
        }
        .kiwi-coin.c1 { width: 60px; height: 60px; font-size: 18px; left: 60%; top: -6%; }
        
        .kiwi-formcard {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 24px;
          padding: 26px 26px 24px;
          box-shadow: 0 26px 54px rgba(18,60,29,.14);
          position: relative;
        }
        .kiwi-formcard .ff-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
        .kiwi-formcard h2 { font-size: 23px; }
        .kiwi-formcard .kiwi-pill { font-size: 12px; font-weight: 700; color: var(--cta); background: #EAF6CF; border-radius: 999px; padding: 5px 11px; }
        .kiwi-formcard .kiwi-fine { color: var(--mut); font-size: 13.5px; margin-bottom: 16px; text-align: left; }
        
        .kiwi-field { margin-bottom: 13px; text-align: left; }
        .kiwi-field label { display: block; font-size: 13.5px; font-weight: 600; margin-bottom: 6px; color: var(--ink); }
        .kiwi-field input, .kiwi-field select {
          width: 100%; padding: 13px 14px; border: 1.5px solid var(--line); border-radius: 12px;
          font-family: inherit; font-size: 16px; color: var(--ink); background: #fff; transition: border-color .15s, box-shadow .15s;
        }
        .kiwi-field input:focus, .kiwi-field select:focus {
          outline: none; border-color: var(--green); box-shadow: 0 0 0 3px rgba(47,164,59,.15);
        }
        .kiwi-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .kiwi-consent { display: flex; gap: 10px; align-items: flex-start; font-size: 12.5px; color: var(--mut); margin: 4px 0 15px; text-align: left; cursor: pointer; }
        .kiwi-consent input { margin-top: 3px; accent-color: var(--green); width: 16px; height: 16px; flex-shrink: 0; }
        .kiwi-field.invalid input, .kiwi-field.invalid select { border-color: #b3261e; }
        .kiwi-err { color: #b3261e; font-size: 12.5px; margin-top: 5px; font-weight: 500; display: block; }

        .kiwi-strip { background: #0C2E15; color: #CFE7BC; }
        .kiwi-strip .kiwi-wrap { display: flex; flex-wrap: wrap; gap: 10px 28px; justify-content: center; padding: 14px 20px; font-size: 13.5px; }
        .kiwi-strip span { display: inline-flex; align-items: center; gap: 8px; }
        .kiwi-strip b { color: #fff; font-weight: 600; }
        
        .kiwi-section { padding: 58px 0; }
        .kiwi-kicker { font-size: 13px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--green); margin-bottom: 12px; }
        .kiwi-h2 { font-size: clamp(26px, 3.6vw, 40px); }
        .kiwi-lead { color: var(--mut); font-size: 17px; max-width: 60ch; margin-top: 10px; }
        .kiwi-grid-why { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 30px; }
        
        .kiwi-card {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 10px 24px rgba(18,60,29,.04);
        }
        .kiwi-card .kiwi-ic {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: #EAF6CF;
          color: var(--cta);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 21px;
          margin-bottom: 13px;
          font-weight: 700;
        }
        .kiwi-card h3 { font-size: 18px; margin-bottom: 8px; }
        .kiwi-card p { color: var(--mut); font-size: 14.5px; }
        
        .kiwi-neon-sec { background: linear-gradient(180deg, var(--bg), #F2F7E6); }
        .kiwi-neon-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 32px; }
        .kiwi-neon-card {
          background: #ffffff;
          border: 1px solid var(--line);
          border-radius: 24px;
          padding: 30px 24px;
          text-align: center;
          box-shadow: 0 12px 28px rgba(18,60,29,.05);
          transition: transform 0.2s;
        }
        .kiwi-neon-card:hover { transform: translateY(-4px); }
        .kiwi-neon-rate { font-size: clamp(34px, 4vw, 44px); font-weight: 800; color: var(--green); line-height: 1; }
        .kiwi-neon-spend { font-weight: 700; margin: 10px 0 4px; font-size: 16px; }
        .kiwi-neon-benefit { color: var(--mut); font-size: 14px; }
        .kiwi-qual { margin-top: 22px; font-size: 13.5px; color: var(--mut); line-height: 1.6; }
        
        .kiwi-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 30px; }
        .kiwi-step { background: var(--panel); border: 1px solid var(--line); border-radius: 20px; padding: 20px; }
        .kiwi-step .kiwi-n {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--cta);
          color: var(--ctatx);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          margin-bottom: 11px;
        }
        .kiwi-step h3 { font-size: 16px; margin-bottom: 5px; }
        .kiwi-step p { color: var(--mut); font-size: 13.5px; }
        
        .kiwi-ctaband {
          background: radial-gradient(120% 100% at 15% 0%, #EAF6CF 0%, var(--bg) 60%);
          text-align: center;
        }
        .kiwi-ctaband h2 { font-size: clamp(26px, 3.6vw, 40px); }
        .kiwi-ctaband p { color: var(--mut); font-size: 17px; margin: 10px auto 22px; max-width: 44ch; }
        
        .kiwi-faq { max-width: 760px; margin: 0 auto; }
        .kiwi-faq-details { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 2px 20px; margin-bottom: 12px; }
        .kiwi-faq-summary { cursor: pointer; font-weight: 600; padding: 16px 0; list-style: none; display: flex; justify-content: space-between; align-items: center; }
        .kiwi-faq-summary::after { content: '+'; font-size: 24px; color: var(--green); font-weight: 400; }
        .kiwi-faq-details[open] .kiwi-faq-summary::after { content: '\\2013'; }
        .kiwi-faq-details p { color: var(--mut); padding-bottom: 16px; font-size: 14.5px; }
        
        .kiwi-footer { background: #0C2E15; color: #C7E0B4; padding: 40px 0 28px; font-size: 12.5px; line-height: 1.6; }
        .kiwi-footer .kiwi-cols { display: grid; grid-template-columns: 1.4fr 1fr; gap: 30px; margin-bottom: 22px; }
        .kiwi-footer .kiwi-brand { color: #fff; }
        .kiwi-footer strong { color: #fff; }
        .kiwi-footer .kiwi-disc { border-top: 1px solid rgba(255,255,255,.14); padding-top: 16px; color: #9dbf8b; }
        .kiwi-footer a { color: #DDF3A6; text-decoration: none; }
        
        @media (max-width: 860px) {
          .kiwi-hero-grid {
            grid-template-columns: 1fr;
            grid-template-areas: "copy" "form" "visual";
            padding-top: 22px;
            padding-bottom: 34px;
            gap: 14px;
          }
          .kiwi-hero p.kiwi-sub { margin-bottom: 6px; }
          .kiwi-cardart { justify-content: center; margin: 6px 0 2px; }
          .kiwi-cardart img { width: min(56%, 224px); }
          .kiwi-cardart .kiwi-halo { width: 70%; height: 64%; left: 15%; }
          .kiwi-coin.c1 { left: 62%; width: 46px; height: 46px; font-size: 15px; }
          .kiwi-grid-why { grid-template-columns: 1fr; }
          .kiwi-neon-grid { grid-template-columns: 1fr; }
          .kiwi-steps { grid-template-columns: 1fr 1fr; }
          .kiwi-footer .kiwi-cols { grid-template-columns: 1fr; }
          .kiwi-section { padding: 44px 0; }
          .kiwi-nav .kiwi-secure { display: none; }
          .kiwi-hero .kiwi-ticks { display: none; }
          .kiwi-hero h1 { font-size: 30px; }
          .kiwi-hero h1 .kiwi-acc { font-size: 33px; }
          .kiwi-hero p.kiwi-sub { font-size: 15.5px; margin: 12px 0 4px; }
          .kiwi-eyebrow { margin-bottom: 14px; font-size: 12.5px; }
          .kiwi-two { grid-template-columns: 1fr; gap: 8px; }
        }
        
        .kiwi-otp-modal {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(18, 60, 29, 0.45); backdrop-filter: blur(5px);
          display: flex; align-items: center; justify-content: center; z-index: 9999;
        }
        .kiwi-otp-panel {
          max-width: 420px; width: 90%; padding: 30px;
          background: #fff; border: 1px solid var(--line); border-radius: 24px;
          box-shadow: 0 26px 54px rgba(18,60,29,.14); position: relative; text-align: center;
        }
        .kiwi-otp-icon {
          width: 54px; height: 54px; border-radius: 50%;
          background: var(--bg2); color: var(--green);
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; margin: 0 auto 15px auto;
        }
        .kiwi-otp-btn-verify {
          flex: 1; height: 44px; font-size: 14px; border-radius: 8px; border: none;
          background: var(--cta); color: var(--ctatx); font-weight: 700; cursor: pointer;
          transition: background 0.2s;
        }
        .kiwi-otp-btn-verify:disabled {
          background: var(--line); color: var(--mut); cursor: not-allowed;
        }
        .kiwi-otp-btn-resend {
          flex: 1; height: 44px; font-size: 14px; border-radius: 8px;
          background: transparent; color: var(--cta); border: 1.5px solid var(--line);
          font-weight: 600; cursor: pointer; transition: background 0.2s;
        }
        .kiwi-otp-btn-resend:disabled {
          color: var(--mut); border-color: var(--line); cursor: not-allowed;
        }
        .kiwi-otp-input {
          width: 100%; padding: 10px; border: 1.5px solid var(--line); border-radius: 12px;
          text-align: center; letter-spacing: 8px; font-size: 20px; font-weight: 800;
          color: var(--ink); outline: none; transition: border-color 0.2s;
        }
        .kiwi-otp-input:focus {
          border-color: var(--green);
        }
      ` }} />

      <div className="kiwi-body">
        {/* Header */}
        <header className="kiwi-header">
          <div className="kiwi-wrap kiwi-nav">
            <div className="kiwi-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <img src="/logo.jpg" alt="FinMantra Logo" style={{ height: '36px', width: '36px', borderRadius: '8px', objectFit: 'cover' }} />
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.3rem', color: 'var(--ink)' }}>FinMantra</span>
              <span style={{ height: '14px', width: '1.5px', background: 'var(--line)', margin: '0 4px' }}></span>
              <span className="kiwi-tag" style={{ marginLeft: 0 }}>Kiwi RuPay Credit Card</span>
              <span style={{ color: 'var(--mut)', fontSize: '11px', background: 'var(--bg2)', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>Cards issued by YES BANK</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
              <div className="kiwi-nav-links" style={{ display: 'flex', gap: '20px', fontSize: '14.5px', fontWeight: 600 }}>
                <a href="#benefits" style={{ color: 'var(--cta)', textDecoration: 'none' }}>Benefits</a>
                <a href="#how-it-works" style={{ color: 'var(--cta)', textDecoration: 'none' }}>How it works</a>
                <a href="#lead" style={{ color: 'var(--cta)', textDecoration: 'none' }}>Apply</a>
              </div>
              <a href="#lead" className="kiwi-btn" style={{ padding: '9px 16px', fontSize: '14px' }}>
                Apply now <span className="kiwi-arw">&rarr;</span>
              </a>
            </div>
          </div>
        </header>

        {/* HERO: form first */}
        <div className="kiwi-hero" id="top">
          <div className="kiwi-wrap kiwi-hero-grid">
            <div className="kiwi-hero-copy">
              <span className="kiwi-eyebrow">● Lifetime free · Up to 5% cashback on UPI</span>
              <h1>Your UPI spends,<br />now <span className="kiwi-acc">rewarding.</span></h1>
              <p className="kiwi-sub">A lifetime-free RuPay credit card that pays you back on every Scan &amp; Pay.</p>
              <div className="kiwi-ticks">
                <span><i className="kiwi-tick">✓</i> ₹0 joining &amp; annual fee — forever</span>
                <span><i className="kiwi-tick">✓</i> Instant virtual card, 100% digital</span>
                <span><i className="kiwi-tick">✓</i> Works on any UPI QR — GPay, PhonePe, Paytm</span>
              </div>
            </div>

            {/* FORM CARD */}
            <div className="kiwi-hero-form" id="lead">
              <div className="kiwi-formcard">
                <div className="ff-top">
                  <h2>Apply in 2 minutes</h2>
                  <span className="kiwi-pill">Free to apply</span>
                </div>
                <p className="kiwi-fine">Fill in your details and we'll take you to secure onboarding.</p>
                
                {formError && (
                  <div style={{ background: '#fdeded', border: '1.5px solid #f5c2c2', padding: '0.75rem 1rem', borderRadius: '8px', color: '#b3261e', fontSize: '0.82rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', textAlign: 'left' }}>
                    <ShieldAlert size={16} style={{ flexShrink: 0 }} /> {formError}
                  </div>
                )}

                <form onSubmit={handleFormSubmit} noValidate id="leadForm">
                  <div className={`kiwi-field ${errors.fullName ? 'invalid' : ''}`}>
                    <label htmlFor="name">Full name *</label>
                    <input 
                      id="name" 
                      name="full_name" 
                      type="text" 
                      autoComplete="name" 
                      placeholder="As per PAN" 
                      value={formData.fullName} 
                      onChange={handleInputChange} 
                      disabled={isSubmitting} 
                    />
                    {errors.fullName && <div className="kiwi-err">{errors.fullName}</div>}
                  </div>

                  <div className="kiwi-two">
                    <div className={`kiwi-field ${errors.phone ? 'invalid' : ''}`}>
                      <label htmlFor="mobile">Whatsapp number *</label>
                      <input 
                        id="mobile" 
                        name="mobile" 
                        type="tel" 
                        inputMode="numeric" 
                        maxLength="10" 
                        placeholder="10-digit mobile" 
                        value={formData.phone} 
                        onChange={handleInputChange} 
                        disabled={isSubmitting || isPhoneVerified} 
                      />
                      {errors.phone && <div className="kiwi-err">{errors.phone}</div>}
                    </div>
                    <div className={`kiwi-field ${errors.email ? 'invalid' : ''}`}>
                      <label htmlFor="email">Email *</label>
                      <input 
                        id="email" 
                        name="email" 
                        type="email" 
                        autoComplete="email" 
                        placeholder="you@email.com" 
                        value={formData.email} 
                        onChange={handleInputChange} 
                        disabled={isSubmitting} 
                      />
                      {errors.email && <div className="kiwi-err">{errors.email}</div>}
                    </div>
                  </div>

                  <div className="kiwi-two">
                    <div className={`kiwi-field ${errors.pincode ? 'invalid' : ''}`}>
                      <label htmlFor="pincode">Pincode *</label>
                      <input 
                        id="pincode" 
                        name="pincode" 
                        type="tel" 
                        inputMode="numeric" 
                        maxLength="6" 
                        autoComplete="postal-code" 
                        placeholder="6-digit pincode" 
                        value={formData.pincode} 
                        onChange={handleInputChange} 
                        disabled={isSubmitting} 
                      />
                      {pincodeLoading && <div style={{ fontSize: '0.75rem', color: 'var(--green)', marginTop: '4px' }}>Verifying...</div>}
                      {pincodeLocationText && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--green)', marginTop: '4px', fontWeight: 600 }}>
                          📍 {pincodeLocationText}
                        </div>
                      )}
                      {errors.pincode && <div className="kiwi-err">{errors.pincode}</div>}
                    </div>
                    <div className={`kiwi-field ${errors.pan_no ? 'invalid' : ''}`}>
                      <label htmlFor="pan">PAN *</label>
                      <input 
                        id="pan" 
                        name="pan" 
                        type="text" 
                        maxLength="10" 
                        autoCapitalize="characters" 
                        autoComplete="off" 
                        placeholder="ABCDE1234F" 
                        value={formData.pan_no} 
                        onChange={handleInputChange} 
                        disabled={isSubmitting} 
                      />
                      {errors.pan_no && <div className="kiwi-err">{errors.pan_no}</div>}
                    </div>
                  </div>

                  <div className="kiwi-two">
                    <div className={`kiwi-field ${errors.employment ? 'invalid' : ''}`}>
                      <label htmlFor="employment">Employment *</label>
                      <select 
                        id="employment" 
                        name="employment" 
                        value={formData.employment} 
                        onChange={handleInputChange} 
                        disabled={isSubmitting}
                      >
                        <option value="">Select</option>
                        <option value="Salaried">Salaried</option>
                        <option value="Self Employed (Business)">Self-employed</option>
                      </select>
                      {errors.employment && <div className="kiwi-err">{errors.employment}</div>}
                    </div>
                    <div className={`kiwi-field ${errors.monthly_income ? 'invalid' : ''}`}>
                      <label htmlFor="income">Monthly income *</label>
                      <select 
                        id="income" 
                        name="monthly_income" 
                        value={formData.monthly_income} 
                        onChange={handleInputChange} 
                        disabled={isSubmitting}
                      >
                        <option value="">Select</option>
                        <option value="Below ₹25,000">Below ₹25,000</option>
                        <option value="₹25,000 – ₹50,000">₹25,000 – ₹50,000</option>
                        <option value="₹50,000 – ₹1,00,000">₹50,000 – ₹1,00,000</option>
                        <option value="Above ₹1,0,000">Above ₹1,00,000</option>
                      </select>
                      {errors.monthly_income && <div className="kiwi-err">{errors.monthly_income}</div>}
                    </div>
                  </div>

                  <label className="kiwi-consent">
                    <input id="consent" type="checkbox" defaultChecked={true} required disabled={isSubmitting} />
                    <span>I authorise FinMantra and its banking partners to contact me about this application via call, SMS, WhatsApp or email, and I agree to the Terms &amp; Privacy Policy. This overrides any DND registration.</span>
                  </label>

                  <button type="submit" className="kiwi-btn" disabled={isSubmitting} style={{ width: '100%' }}>
                    {isSubmitting ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Processing... <RefreshCw size={18} className="spin" />
                      </span>
                    ) : (
                      <>
                        Apply now <span className="kiwi-arw">&rarr;</span>
                      </>
                    )}
                  </button>
                  <p className="kiwi-reassure">🔒 Your details are secure · No spam</p>
                </form>
              </div>
            </div>

            <div className="kiwi-hero-visual">
              <div className="kiwi-cardart">
                <div className="kiwi-halo"></div>
                <span className="kiwi-coin c1">+₹5</span>
                <img 
                  src="/kiwi_card.png" 
                  alt="Kiwi Credit Card by Yes Bank" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* trust strip */}
        <div className="kiwi-strip">
          <div className="kiwi-wrap">
            <span>✓ <b>RuPay on UPI</b> Scan &amp; Pay directly</span>
            <span>⚡ <b>Instant virtual card</b> Ready in minutes</span>
            <span>◎ <b>100% digital application</b> No paperwork</span>
          </div>
        </div>

        {/* sections */}
        <section className="kiwi-section" id="benefits">
          <div className="kiwi-wrap">
            <span className="kiwi-kicker">Why this card</span>
            <h2 className="kiwi-h2">Made for the way India pays</h2>
            <p className="kiwi-lead">You already scan to pay dozens of times a week. This card quietly pays you back for it.</p>
            <div className="kiwi-grid-why">
              <div className="kiwi-card">
                <div className="kiwi-ic">₹</div>
                <h3>Lifetime free</h3>
                <p>₹0 joining fee and ₹0 annual fee. No catch, forever.</p>
              </div>
              <div className="kiwi-card">
                <div className="kiwi-ic">↻</div>
                <h3>1.5% on UPI Scan &amp; Pay</h3>
                <p>Earn on everyday QR payments, plus 0.5% on online spends. Cashback lands in your account.</p>
              </div>
              <div className="kiwi-card">
                <div className="kiwi-ic">▲</div>
                <h3>Up to 5% with Kiwi Neon</h3>
                <p>Optional paid add-on that lifts cashback to 3–5% on annual milestone spends, with lounge access.</p>
              </div>
              <div className="kiwi-card">
                <div className="kiwi-ic">⚡</div>
                <h3>Instant virtual card</h3>
                <p>Apply and get a digital card in minutes — start paying right away.</p>
              </div>
              <div className="kiwi-card">
                <div className="kiwi-ic">◎</div>
                <h3>Any UPI app</h3>
                <p>Add it to GPay, PhonePe or Paytm and scan any UPI QR in the country.</p>
              </div>
              <div className="kiwi-card">
                <div className="kiwi-ic">✦</div>
                <h3>RuPay, on your phone</h3>
                <p>A full RuPay credit card built for UPI — no plastic needed to get started.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Neon Milestone Section */}
        <section className="kiwi-section kiwi-neon-sec">
          <div className="kiwi-wrap">
            <span className="kiwi-kicker">Kiwi Neon</span>
            <h2 className="kiwi-h2">Your cashback climbs with you</h2>
            <p className="kiwi-lead">The more you scan through the year, the higher your rate — plus a domestic lounge visit at each milestone.</p>
            
            <div className="kiwi-neon-grid">
              <div className="kiwi-neon-card">
                <div className="kiwi-neon-rate">3%</div>
                <div className="kiwi-neon-spend">₹50K / yr spends</div>
                <div className="kiwi-neon-benefit">+1 lounge visit</div>
              </div>
              <div className="kiwi-neon-card">
                <div className="kiwi-neon-rate">4%</div>
                <div className="kiwi-neon-spend">₹1L / yr spends</div>
                <div className="kiwi-neon-benefit">+1 lounge visit</div>
              </div>
              <div className="kiwi-neon-card" style={{ border: '1.5px solid var(--green)' }}>
                <div className="kiwi-neon-rate">5%</div>
                <div className="kiwi-neon-spend">₹1.5L / yr spends</div>
                <div className="kiwi-neon-benefit">+1 lounge visit</div>
              </div>
            </div>
            
            <p className="kiwi-qual">
              Milestone cashback and lounge access require the optional paid Kiwi Neon membership (₹999 + GST/yr) and apply to eligible annual spends. Base card earns 1.5% on UPI Scan &amp; Pay.
            </p>
          </div>
        </section>

        {/* Steps section */}
        <section className="kiwi-section" id="how-it-works">
          <div className="kiwi-wrap">
            <span className="kiwi-kicker">How it works</span>
            <h2 className="kiwi-h2">From apply to first scan, in minutes</h2>
            <div className="kiwi-steps">
              <div className="kiwi-step">
                <div className="kiwi-n">1</div>
                <h3>Fill the form</h3>
                <p>Share a few basic details — about 2 minutes.</p>
              </div>
              <div className="kiwi-step">
                <div className="kiwi-n">2</div>
                <h3>Complete video KYC</h3>
                <p>A quick video KYC from your phone. Keep PAN &amp; Aadhaar handy.</p>
              </div>
              <div className="kiwi-step">
                <div className="kiwi-n">3</div>
                <h3>Get your virtual card</h3>
                <p>On approval, your virtual card is issued instantly in the Kiwi app.</p>
              </div>
              <div className="kiwi-step">
                <div className="kiwi-n">4</div>
                <h3>Scan &amp; earn</h3>
                <p>Pay any UPI QR and start earning cashback from day one.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Band */}
        <section className="kiwi-section kiwi-ctaband">
          <div className="kiwi-wrap">
            <h2>Ready?</h2>
            <p>Two minutes to a card that pays you back</p>
            <p style={{ fontSize: '15px', color: 'var(--mut)', marginTop: '-12px' }}>
              Lifetime-free, instant virtual card, up to 5% cashback on UPI.
            </p>
            <a href="#top" className="kiwi-btn" style={{ marginTop: '10px' }}>Apply now <span className="kiwi-arw">&rarr;</span></a>
          </div>
        </section>

        {/* FAQ section */}
        <section className="kiwi-section">
          <div className="kiwi-wrap">
            <span className="kiwi-kicker">FAQ</span>
            <h2 className="kiwi-h2" style={{ textAlign: 'center', marginBottom: '32px' }}>Good questions, straight answers</h2>
            
            <div className="kiwi-faq">
              <details className="kiwi-faq-details">
                <summary className="kiwi-faq-summary">Is the card really lifetime free?</summary>
                <p>Yes. The YES BANK Kiwi credit card has ₹0 joining fee and ₹0 annual fee for life. There are absolutely no maintenance charges or hidden conditions.</p>
              </details>
              <details className="kiwi-faq-details">
                <summary className="kiwi-faq-summary">How much cashback do I earn?</summary>
                <p>You earn a base rate of 1.5% cashback on all merchant UPI Scan &amp; Pay transactions, and 0.5% on online payments. Spends of up to 5% can be unlocked via the Kiwi Neon milestone program.</p>
              </details>
              <details className="kiwi-faq-details">
                <summary className="kiwi-faq-summary">How is the card issued?</summary>
                <p>Upon approval of your application, your virtual credit card details are immediately displayed and activated in the Kiwi mobile application. You can link it on UPI apps to start scanning instantly.</p>
              </details>
              <details className="kiwi-faq-details">
                <summary className="kiwi-faq-summary">Who can apply?</summary>
                <p>Indian citizens aged 21 to 60 with a stable salaried or self-employed monthly source of income can apply. Final approval is subject to credit bureau and issuing bank checks.</p>
              </details>
              <details className="kiwi-faq-details">
                <summary className="kiwi-faq-summary">What do I need for KYC?</summary>
                <p>You need your physical PAN card, Aadhaar number, and a smartphone with a stable internet connection for the quick, paperless Video KYC step.</p>
              </details>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="kiwi-footer">
          <div className="kiwi-wrap">
            <div className="kiwi-cols">
              <div>
                <div className="kiwi-brand" style={{ fontSize: '18px', fontWeight: 800, marginBottom: '10px' }}>
                  kiwi <span className="kiwi-tag" style={{ color: '#9dbf8b' }}>RuPay Credit Card</span>
                </div>
                <p style={{ maxWidth: '40ch', marginBottom: '16px' }}>
                  FinMantra is an authorised channel partner facilitating credit card applications. This is a marketing and lead-referral page and is not the card issuer.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '40px' }}>
                <div>
                  <strong>Legals</strong>
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <a href="/privacy-policy" onClick={(e) => { e.preventDefault(); navigateTo('/privacy-policy'); }}>Privacy Policy</a>
                    <a href="/terms" onClick={(e) => { e.preventDefault(); navigateTo('/terms'); }}>Terms &amp; Conditions</a>
                  </div>
                </div>
                <div>
                  <strong>Links</strong>
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <a href="#benefits">Benefits</a>
                    <a href="#how-it-works">How it works</a>
                    <a href="#top">Apply</a>
                  </div>
                </div>
              </div>
            </div>
            <div className="kiwi-disc">
              <p>
                Cards are issued by YES BANK; the Kiwi RuPay Credit Card is a product of Kiwi. Approval of any application is at the sole discretion of the issuing bank and is subject to eligibility, KYC and credit checks — approval is not guaranteed. Cashback of "up to 5%" applies to eligible annual milestone spends under the optional paid Kiwi Neon membership (₹999 + GST/yr); the base card earns 1.5% on UPI Scan & Pay and 0.5% on online spends, and certain categories are excluded. Monthly cashback may be capped as per programme terms. All trademarks and card designs belong to their respective owners. Please read all product terms & conditions before applying.
              </p>
              <p style={{ marginTop: '12px', color: '#7a9e69' }}>&copy; {new Date().getFullYear()} FinMantra. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="kiwi-otp-modal">
          <div className="kiwi-otp-panel">
            <div style={{ textAlign: 'center' }}>
              <div className="kiwi-otp-icon">
                💬
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink)' }}>Confirm Mobile OTP</h3>
              <p style={{ color: 'var(--mut)', fontSize: '0.88rem', margin: '8px 0 16px 0' }}>
                We sent a 6-digit OTP to your WhatsApp number: <b>+91 {formData.phone}</b>
              </p>
            </div>

            {simulatedOtpText && (
              <div style={{ background: '#eaf6cf', border: '1px solid #b7f13f', borderRadius: '12px', padding: '10px', marginBottom: '14px', textAlign: 'center', fontSize: '12.5px', color: 'var(--cta)', fontWeight: 600 }}>
                💡 Simulated WhatsApp OTP: <b>{simulatedOtpText}</b>
              </div>
            )}

            <div className="form-group">
              <input
                type="text"
                className="kiwi-otp-input"
                maxLength="6"
                placeholder="Enter 6-digit OTP"
                value={otpVal}
                onChange={(e) => setOtpVal(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={isSubmitting}
              />
            </div>

            {otpStatus && (
              <div style={{ fontSize: '13px', textAlign: 'center', margin: '8px 0', color: otpStatus.includes('failed') ? '#b3261e' : 'var(--green)', fontWeight: 600 }}>
                {otpStatus}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button 
                onClick={handleVerifyOtp} 
                className="kiwi-otp-btn-verify"
                disabled={isSubmitting || otpVal.length !== 6}
              >
                {isSubmitting ? 'Verifying...' : 'Verify OTP'}
              </button>
              <button
                onClick={handleResendOtp}
                className="kiwi-otp-btn-resend"
                disabled={resendTimer > 0 || isSubmitting}
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
              </button>
            </div>
            
            <button 
              onClick={() => setShowOtpModal(false)}
              style={{
                position: 'absolute', top: '15px', right: '15px',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mut)'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
