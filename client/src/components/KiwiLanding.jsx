import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, User, Phone, Mail, Calendar, MapPin, CheckCircle, RefreshCw, X, ShieldAlert } from 'lucide-react';

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

  const [formStep, setFormStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [currentUrn, setCurrentUrn] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    city: '',
    employment: '',
    income: '',
    has_credit_card: '',
    pincode: '',
    monthly_income: '',
    pan_no: '',
    dob: '',
    mother_name: '',
    current_address: '',
    designation: '',
    address_house: '',
    address_street: '',
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
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    const loadCards = async () => {
      try {
        const res = await fetch(`${API_URL}/cards/active`);
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

  // Auto-Lookup Pincode API
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
        if (res.ok) {
          const data = await res.json();
          setPincodeLocationText(`${data.city}, ${data.state}`);
          setPincodeLocalities(data.localities || []);
          
          setFormData(prev => ({
            ...prev,
            address_city: data.city || '',
            address_state: data.state || '',
            address_locality: data.localities && data.localities.length > 0 ? data.localities[0] : ''
          }));
        } else {
          setPincodeLocalities([]);
          const fallbackState = getStateFromPincode(pin);
          if (fallbackState !== 'Other') {
            setPincodeLocationText(`${fallbackState} (Estimated)`);
            setFormData(prev => ({
              ...prev,
              address_state: fallbackState
            }));
          } else {
            setPincodeError('Pincode not found');
          }
        }
      } catch (err) {
        console.error('[Pincode Lookup] Error:', err);
        setPincodeError('Error verifying pincode');
      } finally {
        setPincodeLoading(false);
      }
    };

    lookupPincode();
  }, [formData.pincode]);

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
        errorText = 'Full name is required';
      }
    }

    if (name === 'phone') {
      if (value) {
        if (!/^[6-9]/.test(value)) {
          errorText = 'Mobile number should start with 6,7,8,9 only';
        } else if (value.length !== 10) {
          errorText = 'Mobile number must be exactly 10 digits.';
        }
      } else {
        errorText = 'Mobile number is required';
      }
    }

    if (name === 'email') {
      if (value) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errorText = 'Please enter valid Email';
        }
      } else {
        errorText = 'Email is required';
      }
    }

    if (name === 'pan_no') {
      if (value) {
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value)) {
          errorText = 'Invalid PAN card format (e.g. ABCDE1234F).';
        }
      } else {
        errorText = 'PAN Number is required';
      }
    }

    if (name === 'pincode') {
      if (value) {
        if (value.length !== 6 || !/^\d+$/.test(value)) {
          errorText = 'Pincode must be exactly 6 digits.';
        }
      } else {
        errorText = 'Pincode is required';
      }
    }

    if (name === 'dob') {
      if (!value) {
        errorText = 'Date of birth is required';
      }
    }

    if (name === 'mother_name') {
      if (!value || value.trim().length < 3) {
        errorText = "Mother's name is required";
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

    if (name === 'phone' || name === 'pincode') {
      const cleanVal = value.replace(/\D/g, '');
      setFormData(prev => ({ ...prev, [name]: cleanVal }));
      validateField(name, cleanVal);
      return;
    }

    if (name === 'pan_no') {
      const cleanVal = value.toUpperCase().slice(0, 10);
      setFormData(prev => ({ ...prev, [name]: cleanVal }));
      validateField(name, cleanVal);
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
    validateField(name, value);
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!formData.fullName || formData.fullName.trim().length < 3) {
        newErrors.fullName = 'Full Name must be at least 3 characters.';
      }
      if (!formData.phone || formData.phone.length !== 10) {
        newErrors.phone = 'Mobile number must be exactly 10 digits.';
      }
      if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email.';
      }
      if (!formData.dob) {
        newErrors.dob = 'Date of Birth is required';
      }
      if (!formData.mother_name || formData.mother_name.trim().length < 3) {
        newErrors.mother_name = "Mother's Name is required";
      }
    } else {
      if (!formData.employment) {
        newErrors.employment = 'Employment Type is required';
      }
      if (!formData.income) {
        newErrors.income = 'Monthly Income range is required';
      }
      if (!formData.designation || !formData.designation.trim()) {
        newErrors.designation = 'Designation is required';
      }
      if (!formData.pan_no || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan_no)) {
        newErrors.pan_no = 'Invalid PAN card format (e.g. ABCDE1234F)';
      }
      if (!formData.has_credit_card) {
        newErrors.has_credit_card = 'Please select Yes or No';
      }
      if (!formData.pincode || formData.pincode.length !== 6) {
        newErrors.pincode = 'Pincode must be exactly 6 digits.';
      }
      if (!formData.address_house || !formData.address_house.trim()) {
        newErrors.address_house = 'House/Flat No is required';
      }
      if (!formData.address_street || !formData.address_street.trim()) {
        newErrors.address_street = 'Street details are required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
        setIsPhoneVerified(true);
        setIsSubmitting(false);
        setTimeout(() => {
          setShowOtpModal(false);
          setOtpVal('');
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

  // Continue to Step 2
  const handleContinueToStep2 = async () => {
    if (!isPhoneVerified) {
      setFormError('Please verify your contact number with OTP first.');
      return;
    }
    if (!validateStep(1)) return;

    setIsSubmitting(true);
    setFormError('');
    try {
      const leadRes = await fetch(`${API_URL}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.fullName,
          phone: formData.phone,
          email: formData.email,
          dob: formData.dob || null,
          mother_name: formData.mother_name || null,
          source: 'kiwi',
          consent: true,
          ...utmParams,
          utm_params: utmParams || null
        })
      });

      const leadData = await leadRes.json();
      if (leadRes.ok) {
        setCurrentUrn(leadData.urn);
        setFormStep(2);
      } else {
        setFormError(leadData.error || 'Failed to register details. Please try again.');
      }
    } catch (err) {
      setFormError('Network error. Unable to contact registration servers.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Final Form Submit (Step 2)
  const handleFormSubmit = async (e) => {
    if (e) e.preventDefault();
    setFormError('');
    setPincodeError('');

    if (formStep === 1) {
      handleContinueToStep2();
      return;
    }

    if (!validateStep(2)) {
      setFormError('Please correct the highlighted errors before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const compiledAddress = `${formData.address_house.trim()}, ${formData.address_street.trim()}${formData.address_locality ? ', ' + formData.address_locality.trim() : ''}, ${formData.address_city.trim()}, ${formData.address_state.trim()} - ${formData.pincode.trim()}`;
      
      // Map Kiwi dropdown income range to integer monthly_income for validation
      let resolvedIncomeVal = '35000';
      if (formData.income.includes('Below')) resolvedIncomeVal = '15000';
      else if (formData.income.includes('50,000 –')) resolvedIncomeVal = '75000';
      else if (formData.income.includes('Above')) resolvedIncomeVal = '120000';

      // Find Kiwi card if configured
      let matchedKiwiCard = cards.find(c => c.id === 'kiwi' || c.name.toLowerCase().includes('kiwi'));
      const cardIdPayload = matchedKiwiCard ? matchedKiwiCard.id : null;

      const res = await fetch(`${API_URL}/leads/public/urn/${currentUrn}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employment: formData.employment,
          monthly_income: resolvedIncomeVal,
          designation: formData.designation || null,
          pan_no: formData.pan_no ? String(formData.pan_no).trim().toUpperCase() : null,
          has_credit_card: formData.has_credit_card,
          pincode: formData.pincode,
          current_address: compiledAddress,
          card_id: cardIdPayload
        })
      });

      const data = await res.json();
      if (res.ok) {
        const cacheData = {
          name: formData.fullName,
          urn: currentUrn,
          redirectUrl: data.redirectUrl,
          cardName: 'Kiwi Credit Card',
          bank: 'Yes Bank',
          timestamp: new Date().getTime()
        };
        sessionStorage.setItem('finmantra_applied_lead', JSON.stringify(cacheData));
        window.location.replace(data.redirectUrl);
      } else {
        setFormError(data.error || 'Failed to complete application. Please try again.');
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
          height: 58px;
        }
        .kiwi-brand {
          display: flex;
          align-items: center;
          gap: .5em;
          font-weight: 700;
          font-size: 19px;
        }
        .kiwi-brand .kiwi-dot {
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: var(--green);
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
        .kiwi-hero h1 { font-size: clamp(34px, 5vw, 58px); }
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
        .kiwi-formcard .kiwi-fine { color: var(--mut); font-size: 13.5px; margin-bottom: 16px; }
        
        .kiwi-field { margin-bottom: 13px; }
        .kiwi-field label { display: block; font-size: 13.5px; font-weight: 600; margin-bottom: 6px; }
        .kiwi-field input, .kiwi-field select {
          width: 100%;
          padding: 13px 14px;
          border: 1.5px solid var(--line);
          border-radius: 12px;
          font-family: inherit;
          font-size: 16px;
          color: var(--ink);
          background: #fff;
          transition: border-color .15s, box-shadow .15s;
        }
        .kiwi-field input:focus, .kiwi-field select:focus {
          outline: none;
          border-color: var(--green);
          box-shadow: 0 0 0 3px rgba(47,164,59,.15);
        }
        .kiwi-field.invalid input, .kiwi-field.invalid select { border-color: #b3261e; }
        .kiwi-field.invalid .kiwi-err { display: block; }
        .kiwi-err { color: #b3261e; font-size: 12.5px; margin-top: 5px; display: none; }
        
        .kiwi-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .kiwi-consent { display: flex; gap: 10px; align-items: flex-start; font-size: 12.5px; color: var(--mut); margin: 4px 0 15px; cursor: pointer; }
        .kiwi-consent input { margin-top: 3px; }
        .kiwi-formcard .kiwi-btn { width: 100%; font-size: 18px; padding: 16px; margin-top: 10px; }
        .kiwi-formcard .kiwi-reassure { text-align: center; font-size: 12.5px; color: var(--mut); margin-top: 12px; }
        
        .kiwi-strip { background: #0C2E15; color: #CFE7BC; }
        .kiwi-strip .kiwi-wrap { display: flex; flex-wrap: wrap; gap: 10px 28px; justify-content: center; padding: 14px 20px; font-size: 13.5px; }
        .kiwi-strip span { display: inline-flex; align-items: center; gap: 8px; }
        .kiwi-strip b { color: #fff; font-weight: 600; }
        
        .kiwi-section { padding: 58px 0; }
        .kiwi-kicker { font-size: 13px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--green); margin-bottom: 12px; }
        .kiwi-h2 { font-size: clamp(26px, 3.6vw, 40px); }
        .kiwi-lead { color: var(--mut); font-size: 17px; max-width: 60ch; margin-top: 10px; }
        .kiwi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 30px; }
        
        .kiwi-card {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 20px;
          padding: 22px;
          box-shadow: 0 10px 24px rgba(18,60,29,.05);
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
        .kiwi-card h3 { font-size: 18px; margin-bottom: 5px; }
        .kiwi-card p { color: var(--mut); font-size: 14.5px; }
        
        .kiwi-ladder-sec { background: linear-gradient(180deg, var(--bg), #F2F7E6); }
        .kiwi-ladder { display: flex; align-items: flex-end; gap: 14px; margin-top: 32px; }
        .kiwi-rung { flex: 1; display: flex; flex-direction: column; align-items: center; }
        .kiwi-rung .kiwi-pct { font-size: clamp(28px, 4.6vw, 50px); font-weight: 700; margin-bottom: 10px; }
        .kiwi-rung .kiwi-bar {
          width: 78%;
          border-radius: 16px 16px 0 0;
          background: linear-gradient(180deg, var(--green), var(--cta));
          color: var(--ctatx);
          font-weight: 600;
          font-size: 13px;
          padding-top: 12px;
          text-align: center;
        }
        .kiwi-rung .kiwi-sp { font-weight: 700; margin-top: 11px; font-size: 15px; }
        .kiwi-rung .kiwi-lo { color: var(--green); font-weight: 700; font-size: 12.5px; margin-top: 4px; }
        .kiwi-qual { margin-top: 18px; font-size: 13.5px; color: var(--mut); }
        
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
            padding-top: 26px;
            padding-bottom: 36px;
            gap: 22px;
          }
          .kiwi-hero p.kiwi-sub { margin-bottom: 6px; }
          .kiwi-cardart { justify-content: center; margin-top: 18px; }
          .kiwi-cardart img { width: min(78%, 320px); }
          .kiwi-coin.c1 { left: 64%; }
          .kiwi-grid { grid-template-columns: 1fr; }
          .kiwi-steps { grid-template-columns: 1fr 1fr; }
          .kiwi-footer .kiwi-cols { grid-template-columns: 1fr; }
          .kiwi-section { padding: 44px 0; }
          .kiwi-ladder { gap: 8px; }
          .kiwi-nav .kiwi-secure { display: none; }
          .kiwi-hero .kiwi-ticks { display: none; }
          .kiwi-hero h1 { font-size: 30px; }
          .kiwi-hero h1 .kiwi-acc { font-size: 33px; }
          .kiwi-hero p.kiwi-sub { font-size: 15.5px; margin: 12px 0 4px; }
          .kiwi-eyebrow { margin-bottom: 14px; font-size: 12.5px; }
        }
      ` }} />

      <div className="kiwi-body">
        {/* kiwi_landing Header */}
        <header className="kiwi-header">
          <div className="kiwi-wrap kiwi-nav">
            <div className="kiwi-brand">
              <span className="kiwi-dot"></span>kiwi <span className="kiwi-tag">RuPay Credit Card</span>
            </div>
            <div className="kiwi-secure" style={{ fontSize: '13px', color: 'var(--mut)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🔒 Secure application
            </div>
            <a href="#lead" className="kiwi-btn" style={{ padding: '9px 16px', fontSize: '14px' }}>
              Apply now <span className="kiwi-arw">&rarr;</span>
            </a>
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
                
                {/* 2-Step Indicator */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: 'var(--bg2)', padding: '6px 12px', borderRadius: '12px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--cta)' }}>Step {formStep} of 2</span>
                  <span style={{ fontSize: '11px', color: 'var(--cta)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {formStep === 1 ? 'Contact Details' : 'More Information'}
                  </span>
                </div>

                {formError && (
                  <div style={{ background: '#fdeded', border: '1.5px solid #f5c2c2', padding: '0.75rem 1rem', borderRadius: '12px', color: '#b3261e', fontSize: '0.82rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldAlert size={16} /> {formError}
                  </div>
                )}

                <form onSubmit={handleFormSubmit} noValidate>
                  {/* STEP 1 FIELDS */}
                  {formStep === 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div className={`kiwi-field ${errors.fullName ? 'invalid' : ''}`}>
                        <label htmlFor="fullName">Full name *</label>
                        <input 
                          id="fullName" 
                          name="fullName" 
                          type="text" 
                          placeholder="As per PAN"
                          value={formData.fullName}
                          onChange={handleInputChange}
                          disabled={isSubmitting}
                        />
                        <div className="kiwi-err">{errors.fullName}</div>
                      </div>

                      <div className="kiwi-two">
                        <div className={`kiwi-field ${errors.phone ? 'invalid' : ''}`}>
                          <label htmlFor="phone">Mobile number *</label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <input 
                              id="phone" 
                              name="phone" 
                              type="tel" 
                              maxLength="10" 
                              placeholder="10-digit mobile"
                              value={formData.phone}
                              onChange={handleInputChange}
                              disabled={isSubmitting || isPhoneVerified}
                              style={{ flex: 1 }}
                            />
                            {formData.phone.length === 10 && !errors.phone && (
                              <button
                                type="button"
                                onClick={sendStep1Otp}
                                className="kiwi-btn"
                                style={{ 
                                  padding: '0 15px', 
                                  height: '48px', 
                                  fontSize: '12.5px', 
                                  background: isPhoneVerified ? 'var(--green)' : '#ef4444',
                                  boxShadow: 'none',
                                  marginTop: 0,
                                  borderRadius: '12px',
                                  color: 'white'
                                }}
                                disabled={isSubmitting || isPhoneVerified}
                              >
                                {isPhoneVerified ? '✓ Verified' : 'Verify'}
                              </button>
                            )}
                          </div>
                          <div className="kiwi-err">{errors.phone}</div>
                        </div>

                        <div className={`kiwi-field ${errors.email ? 'invalid' : ''}`}>
                          <label htmlFor="email">Email *</label>
                          <input 
                            id="email" 
                            name="email" 
                            type="email" 
                            placeholder="you@email.com"
                            value={formData.email}
                            onChange={handleInputChange}
                            disabled={isSubmitting}
                          />
                          <div className="kiwi-err">{errors.email}</div>
                        </div>
                      </div>

                      <div className="kiwi-two">
                        <div className={`kiwi-field ${errors.dob ? 'invalid' : ''}`}>
                          <label htmlFor="dob">Date of Birth *</label>
                          <input 
                            id="dob" 
                            name="dob" 
                            type="date"
                            value={formData.dob}
                            onChange={handleInputChange}
                            disabled={isSubmitting}
                          />
                          <div className="kiwi-err">{errors.dob}</div>
                        </div>

                        <div className={`kiwi-field ${errors.mother_name ? 'invalid' : ''}`}>
                          <label htmlFor="mother_name">Mother's Name *</label>
                          <input 
                            id="mother_name" 
                            name="mother_name" 
                            type="text" 
                            placeholder="Mother's full name"
                            value={formData.mother_name}
                            onChange={handleInputChange}
                            disabled={isSubmitting}
                          />
                          <div className="kiwi-err">{errors.mother_name}</div>
                        </div>
                      </div>

                      <button 
                        type="button" 
                        onClick={handleContinueToStep2}
                        className="kiwi-btn" 
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Registering...' : 'Continue to Next Step'} <span className="kiwi-arw">&rarr;</span>
                      </button>
                    </div>
                  )}

                  {/* STEP 2 FIELDS */}
                  {formStep === 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                          <div className="kiwi-err">{errors.employment}</div>
                        </div>

                        <div className={`kiwi-field ${errors.income ? 'invalid' : ''}`}>
                          <label htmlFor="income">Monthly income *</label>
                          <select 
                            id="income" 
                            name="income"
                            value={formData.income}
                            onChange={handleInputChange}
                            disabled={isSubmitting}
                          >
                            <option value="">Select</option>
                            <option value="Below ₹25,000">Below ₹25,000</option>
                            <option value="₹25,000 – ₹50,000">₹25,000 – ₹50,000</option>
                            <option value="₹50,000 – ₹1,00,000">₹50,000 – ₹1,00,000</option>
                            <option value="Above ₹1,00,000">Above ₹1,00,000</option>
                          </select>
                          <div className="kiwi-err">{errors.income}</div>
                        </div>
                      </div>

                      <div className="kiwi-two">
                        <div className={`kiwi-field ${errors.designation ? 'invalid' : ''}`}>
                          <label htmlFor="designation">Designation *</label>
                          <input 
                            id="designation" 
                            name="designation" 
                            type="text" 
                            placeholder="Your job role / title"
                            value={formData.designation}
                            onChange={handleInputChange}
                            disabled={isSubmitting}
                          />
                          <div className="kiwi-err">{errors.designation}</div>
                        </div>

                        <div className={`kiwi-field ${errors.pan_no ? 'invalid' : ''}`}>
                          <label htmlFor="pan_no">PAN Card Number *</label>
                          <input 
                            id="pan_no" 
                            name="pan_no" 
                            type="text" 
                            maxLength="10"
                            placeholder="10-digit PAN (e.g. ABCDE1234F)"
                            value={formData.pan_no}
                            onChange={handleInputChange}
                            disabled={isSubmitting}
                          />
                          <div className="kiwi-err">{errors.pan_no}</div>
                        </div>
                      </div>

                      <div className="kiwi-two">
                        <div className={`kiwi-field ${errors.has_credit_card ? 'invalid' : ''}`}>
                          <label htmlFor="has_credit_card">Do you have a credit card? *</label>
                          <select 
                            id="has_credit_card" 
                            name="has_credit_card"
                            value={formData.has_credit_card}
                            onChange={handleInputChange}
                            disabled={isSubmitting}
                          >
                            <option value="">Select Option</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                          <div className="kiwi-err">{errors.has_credit_card}</div>
                        </div>

                        <div className={`kiwi-field ${errors.pincode ? 'invalid' : ''}`}>
                          <label htmlFor="pincode">Residence Pincode *</label>
                          <input 
                            id="pincode" 
                            name="pincode" 
                            type="text" 
                            maxLength="6"
                            placeholder="6-digit pincode"
                            value={formData.pincode}
                            onChange={handleInputChange}
                            disabled={isSubmitting}
                          />
                          {pincodeLoading && <div style={{ fontSize: '11px', color: 'var(--green)', marginTop: '4px' }}>Locating...</div>}
                          {pincodeLocationText && (
                            <div style={{ fontSize: '11.5px', color: 'var(--green)', marginTop: '4px', fontWeight: 600 }}>
                              📍 {pincodeLocationText}
                            </div>
                          )}
                          <div className="kiwi-err">{errors.pincode || pincodeError}</div>
                        </div>
                      </div>

                      {/* Structured address lines */}
                      <div style={{ borderTop: '1px dashed var(--line)', paddingTop: '10px', marginTop: '6px' }}>
                        <div className="kiwi-two">
                          <div className={`kiwi-field ${errors.address_house ? 'invalid' : ''}`}>
                            <label htmlFor="address_house">Flat / House No. *</label>
                            <input 
                              id="address_house" 
                              name="address_house" 
                              type="text" 
                              placeholder="Flat/House No., Bldg"
                              value={formData.address_house}
                              onChange={handleInputChange}
                              disabled={isSubmitting}
                            />
                            <div className="kiwi-err">{errors.address_house}</div>
                          </div>

                          <div className={`kiwi-field ${errors.address_street ? 'invalid' : ''}`}>
                            <label htmlFor="address_street">Road / Street *</label>
                            <input 
                              id="address_street" 
                              name="address_street" 
                              type="text" 
                              placeholder="Road, Street, Area"
                              value={formData.address_street}
                              onChange={handleInputChange}
                              disabled={isSubmitting}
                            />
                            <div className="kiwi-err">{errors.address_street}</div>
                          </div>
                        </div>

                        <div className="kiwi-two">
                          <div className={`kiwi-field ${errors.address_locality ? 'invalid' : ''}`}>
                            <label htmlFor="address_locality">Locality / Landmark</label>
                            {pincodeLocalities.length > 0 ? (
                              <select 
                                id="address_locality" 
                                name="address_locality"
                                value={formData.address_locality}
                                onChange={handleInputChange}
                                disabled={isSubmitting}
                              >
                                {pincodeLocalities.map((loc, idx) => (
                                  <option key={idx} value={loc}>{loc}</option>
                                ))}
                              </select>
                            ) : (
                              <input 
                                id="address_locality" 
                                name="address_locality" 
                                type="text" 
                                placeholder="Locality name"
                                value={formData.address_locality}
                                onChange={handleInputChange}
                                disabled={isSubmitting}
                              />
                            )}
                            <div className="kiwi-err">{errors.address_locality}</div>
                          </div>

                          <div className="kiwi-two">
                            <div className={`kiwi-field ${errors.address_city ? 'invalid' : ''}`}>
                              <label htmlFor="address_city">City</label>
                              <input 
                                id="address_city" 
                                name="address_city" 
                                type="text" 
                                placeholder="City"
                                value={formData.address_city}
                                onChange={handleInputChange}
                                disabled={isSubmitting}
                              />
                              <div className="kiwi-err">{errors.address_city}</div>
                            </div>
                            <div className={`kiwi-field ${errors.address_state ? 'invalid' : ''}`}>
                              <label htmlFor="address_state">State</label>
                              <input 
                                id="address_state" 
                                name="address_state" 
                                type="text" 
                                placeholder="State"
                                value={formData.address_state}
                                onChange={handleInputChange}
                                disabled={isSubmitting}
                              />
                              <div className="kiwi-err">{errors.address_state}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <label className="kiwi-consent" htmlFor="kiwi-consent-box">
                        <input 
                          id="kiwi-consent-box" 
                          type="checkbox" 
                          required 
                          disabled={isSubmitting}
                          defaultChecked={true}
                          style={{ accentColor: 'var(--green)', width: '17px', height: '17px', flexShrink: 0 }}
                        />
                        <span>I authorise FinMantra and its banking partners to contact me about this application via call, SMS, WhatsApp or email, and I agree to the Terms &amp; Privacy Policy. This overrides any DND registration.</span>
                      </label>

                      <button type="submit" className="kiwi-btn" disabled={isSubmitting}>
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
                    </div>
                  )}

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
            <span>🔒 <b>256-bit SSL</b> Encrypted onboarding</span>
            <span>⚡ <b>Instant Virtual Card</b> within 5 minutes</span>
            <span>🏦 <b>Approved by RBI</b> regulated Yes Bank partner</span>
          </div>
        </div>

        {/* sections */}
        <section className="kiwi-section">
          <div className="kiwi-wrap">
            <span className="kiwi-kicker">Why Kiwi Credit Card?</span>
            <h2 className="kiwi-h2">UPI convenience meets credit rewards</h2>
            <p className="kiwi-lead">No more transferring money to wallets. Just link your Kiwi card on GPay, PhonePe, or Kiwi app and spend directly from your credit line while earning cashbacks.</p>
            <div className="kiwi-grid">
              <div className="kiwi-card">
                <div className="kiwi-ic">★</div>
                <h3>Up to 5% Cashback</h3>
                <p>Earn high cashbacks on everyday grocery, food, dining and travel payments via UPI.</p>
              </div>
              <div className="kiwi-card">
                <div className="kiwi-ic">₹0</div>
                <h3>Lifetime Free Card</h3>
                <p>No joining fee, no annual fee. Free forever. Truly a zero-maintenance card.</p>
              </div>
              <div className="kiwi-card">
                <div className="kiwi-ic">⚡</div>
                <h3>Instant Digital Issue</h3>
                <p>Get your virtual credit card details immediately on approval to start spending online.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Ladder section */}
        <section className="kiwi-section kiwi-ladder-sec">
          <div className="kiwi-wrap">
            <span className="kiwi-kicker">Max rewards</span>
            <h2 className="kiwi-h2">Earning cashback is simple</h2>
            <p className="kiwi-lead">Unlike other credit cards with complicated reward catalogs, Kiwi pays you back in direct cash on UPI payments.</p>
            
            <div className="kiwi-ladder">
              <div className="kiwi-rung">
                <span className="kiwi-pct">1%</span>
                <div className="kiwi-bar" style={{ height: '80px' }}>Standard</div>
                <span className="kiwi-sp">UPI spends</span>
                <span className="kiwi-lo">Under ₹5k / mo</span>
              </div>
              <div className="kiwi-rung">
                <span className="kiwi-pct">2%</span>
                <div className="kiwi-bar" style={{ height: '140px' }}>Tier 2</div>
                <span className="kiwi-sp">All spends</span>
                <span className="kiwi-lo">₹5k – ₹15k / mo</span>
              </div>
              <div className="kiwi-rung">
                <span className="kiwi-pct" style={{ color: 'var(--green)' }}>5%</span>
                <div className="kiwi-bar" style={{ height: '220px', background: 'linear-gradient(180deg, var(--lime), var(--cta))' }}>Super</div>
                <span className="kiwi-sp">Milestone</span>
                <span className="kiwi-lo">Above ₹15k / mo</span>
              </div>
            </div>
            
            <p className="kiwi-qual">* Rewards are distributed as Kix coins, instantly redeemable for cash back to your bank account.</p>
          </div>
        </section>

        {/* Steps section */}
        <section className="kiwi-section">
          <div className="kiwi-wrap">
            <span className="kiwi-kicker">How to apply</span>
            <h2 className="kiwi-h2">Get your virtual card in 4 easy steps</h2>
            <div className="kiwi-steps">
              <div className="kiwi-step">
                <div className="kiwi-n">1</div>
                <h3>Enter Details</h3>
                <p>Fill in your basic information in the form above securely.</p>
              </div>
              <div className="kiwi-step">
                <div className="kiwi-n">2</div>
                <h3>Verify Mobile</h3>
                <p>Verify your contact number with WhatsApp OTP instantaneously.</p>
              </div>
              <div className="kiwi-step">
                <div className="kiwi-n">3</div>
                <h3>Bank KYC</h3>
                <p>Complete a quick paperless KYC process via the secure portal.</p>
              </div>
              <div className="kiwi-step">
                <div className="kiwi-n">4</div>
                <h3>Start Scanning</h3>
                <p>Link your card on UPI apps and scan QR codes to pay!</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Band */}
        <section className="kiwi-section kiwi-ctaband">
          <div className="kiwi-wrap">
            <h2>Ready to scan &amp; earn?</h2>
            <p>Apply now and join over 500,000+ smart UPI users earning cashback on every payment.</p>
            <a href="#top" className="kiwi-btn">Apply Now <span className="kiwi-arw">&rarr;</span></a>
          </div>
        </section>

        {/* FAQ section */}
        <section className="kiwi-section">
          <div className="kiwi-wrap">
            <span className="kiwi-kicker">FAQ</span>
            <h2 className="kiwi-h2" style={{ textAlign: 'center', marginBottom: '32px' }}>Frequently Asked Questions</h2>
            
            <div className="kiwi-faq">
              <details className="kiwi-faq-details">
                <summary className="kiwi-faq-summary">Is the card really lifetime free?</summary>
                <p>Yes, the Kiwi Yes Bank credit card has zero joining fee and zero annual/renewal fees for life. There are absolutely no hidden charges.</p>
              </details>
              <details className="kiwi-faq-details">
                <summary className="kiwi-faq-summary">How do I scan and pay using this credit card?</summary>
                <p>Once approved, link the Kiwi credit card on UPI applications like BHIM, Google Pay, PhonePe, or the Kiwi app. Then, simply scan any merchant QR code and select the credit card as the payment source instead of your bank account.</p>
              </details>
              <details className="kiwi-faq-details">
                <summary className="kiwi-faq-summary">What are the eligibility criteria?</summary>
                <p>Any Indian resident aged 21-60 with a stable salaried or self-employed monthly income is eligible to apply. A good credit score increases approval chances.</p>
              </details>
              <details className="kiwi-faq-details">
                <summary className="kiwi-faq-summary">Is PAN number mandatory to apply?</summary>
                <p>Yes, PAN is mandatory to verify your credit profile with the credit bureau and validate your identity for regulatory compliance.</p>
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
                <p style={{ maxWidth: '40ch', marginBottom: '16px' }}>FinMantra is an authorized partner facilitating secure credit card applications for licensed banking partners.</p>
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
                  <strong>Support</strong>
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <a href="/contact" onClick={(e) => { e.preventDefault(); navigateTo('/contact'); }}>Contact Us</a>
                    <a href="/" onClick={(e) => { e.preventDefault(); navigateTo('/'); }}>Home</a>
                  </div>
                </div>
              </div>
            </div>
            <div className="kiwi-disc">
              <p>Disclaimer: Credit card issuance is subject to credit profile checks and sole discretion of banking partners. FinMantra does not charge any application or processing fee.</p>
              <p style={{ marginTop: '12px', color: '#7a9e69' }}>&copy; {new Date().getFullYear()} FinMantra. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(18, 60, 29, 0.45)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="kiwi-formcard" style={{ maxWidth: '420px', width: '90%', padding: '30px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '54px', height: '54px', borderRadius: '50%',
                background: 'var(--bg2)', color: 'var(--green)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '24px', margin: '0 auto 15px auto'
              }}>
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

            <div className="kiwi-field">
              <input
                type="text"
                maxLength="6"
                placeholder="Enter 6-digit OTP"
                value={otpVal}
                onChange={(e) => setOtpVal(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '20px', fontWeight: 800 }}
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
                className="kiwi-btn" 
                style={{ flex: 1, height: '44px', fontSize: '14px', padding: 0 }}
                disabled={isSubmitting || otpVal.length !== 6}
              >
                {isSubmitting ? 'Verifying...' : 'Verify OTP'}
              </button>
              <button
                onClick={handleResendOtp}
                className="kiwi-btn"
                style={{
                  flex: 1, height: '44px', fontSize: '14px', padding: 0,
                  background: 'none', color: 'var(--cta)', border: '1.5px solid var(--line)',
                  boxShadow: 'none'
                }}
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
