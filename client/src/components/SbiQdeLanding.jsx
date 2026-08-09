import React, { useState, useEffect, useRef } from 'react';
import { X, Lock, CheckCircle2, AlertTriangle, ShieldCheck, CreditCard, Gift, ArrowRight, Building, MapPin, User, Calendar, Mail, Phone, Briefcase } from 'lucide-react';
import { trackLeadSubmission, initAnalytics } from '../utils/analytics';

export default function SbiQdeLanding({ navigateTo, utmParams }) {
  const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173') ? 'http://localhost:5000/api' : '/api';

  const [settings, setSettings] = useState({});
  const [cards, setCards] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('#');

  // Form State with all 14 mandatory fields
  const [formData, setFormData] = useState({
    pan: '',
    name: '',
    dob: '',
    mother_name: '',
    current_address: '',
    pincode: '',
    city: '',
    state: '',
    landmark: '',
    mobile: '',
    email: '',
    employment: 'Salaried',
    designation: '',
    company_name: '',
    consent: false
  });

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  // Pincode states
  const [pincodeError, setPincodeError] = useState('');
  const [negativePincodeNotice, setNegativePincodeNotice] = useState('');
  const [pincodeLocationText, setPincodeLocationText] = useState('');
  const [isFetchingPincode, setIsFetchingPincode] = useState(false);

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

  // Pincode lookup & negative list check
  useEffect(() => {
    const lookup = async () => {
      const pin = formData.pincode;
      if (pin.length !== 6) {
        setPincodeLocationText('');
        setPincodeError('');
        setNegativePincodeNotice('');
        return;
      }

      setPincodeError('');
      setNegativePincodeNotice('');
      setIsFetchingPincode(true);

      let fetchedCity = '';
      let fetchedState = '';

      try {
        // 1. First try Backend Pincode Lookup Proxy (fast CDN & Zippopotam)
        try {
          const backendRes = await fetch(`${API_URL}/pincode/lookup/${pin}`);
          if (backendRes.ok) {
            const bData = await backendRes.json();
            if (bData && bData.city && bData.state) {
              fetchedCity = bData.city;
              fetchedState = bData.state;
            }
          }
        } catch (bErr) {
          console.warn('Backend pincode lookup fallback:', bErr);
        }

        // 2. Fallback to direct Postal Pincode API if needed
        if (!fetchedCity || !fetchedState) {
          const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data[0] && data[0].Status === 'Success') {
              const postOffices = data[0].PostOffice || [];
              if (postOffices.length > 0) {
                const po = postOffices[0];
                fetchedCity = po.District || po.Block || po.Circle || '';
                fetchedState = po.State || '';
              }
            }
          }
        }

        if (fetchedCity && fetchedState) {
          setPincodeLocationText(`${fetchedCity}, ${fetchedState}`);
          
          // Auto-fill city and state fields
          setFormData(prev => ({
            ...prev,
            city: fetchedCity,
            state: fetchedState
          }));

          // Clear validation errors for city, state, and pincode
          setErrors(prev => {
            const next = { ...prev };
            delete next.city;
            delete next.state;
            delete next.pincode;
            return next;
          });
        } else {
          setPincodeError('Invalid Pincode. Please enter a valid 6-digit Pincode.');
        }
      } catch (err) {
        console.error('Failed to lookup pincode details:', err);
      } finally {
        setIsFetchingPincode(false);
      }

      // 3. Check if pincode is in OCL & Negative pincode list
      try {
        const negRes = await fetch(`${API_URL}/pincodes/check-negative/${pin}`);
        if (negRes.ok) {
          const negData = await negRes.json();
          if (negData.isNegative) {
            const negMsg = 'This PINCODE is negative for card delivery, please share the alternative address if you have, but we will still try.';
            setNegativePincodeNotice(negMsg);
            setPincodeError(negMsg);
            setErrors(prev => ({ ...prev, pincode: negMsg }));
          } else {
            setNegativePincodeNotice('');
            setPincodeError('');
            setErrors(prev => {
              const next = { ...prev };
              delete next.pincode;
              return next;
            });
          }
        }
      } catch (err) {
        console.error('Failed to check negative pincode list:', err);
      }
    };

    lookup();
  }, [formData.pincode]);

  // Input change handler
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let cleanVal = type === 'checkbox' ? checked : value;

    if (name === 'pan') {
      cleanVal = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    } else if (name === 'mobile' || name === 'pincode') {
      cleanVal = value.replace(/[^0-9]/g, '').slice(0, name === 'mobile' ? 10 : 6);
    }

    const nextFormState = { ...formData, [name]: cleanVal };
    setFormData(nextFormState);
    validateField(name, cleanVal, nextFormState);

    // Cross-field validation: if full name changed, re-validate mother's name immediately
    if (name === 'name' && nextFormState.mother_name) {
      validateField('mother_name', nextFormState.mother_name, nextFormState);
    }
  };

  // Field validation
  const validateField = (name, value, currentFormState = formData) => {
    let errorText = '';

    if (name === 'pan') {
      if (!value) {
        errorText = 'PAN Number is required';
      } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value)) {
        errorText = 'Invalid PAN card format (e.g. ABCDE1234F).';
      }
    }

    if (name === 'name') {
      const trimmed = value ? String(value).trim() : '';
      if (!trimmed) {
        errorText = 'Full Name is required';
      } else if (!/^[a-zA-Z\s.]+$/.test(trimmed)) {
        errorText = 'Full Name should contain only letters and spaces';
      } else {
        const words = trimmed.split(/\s+/).filter(Boolean);
        if (words.length < 2) {
          errorText = 'Please enter your Full Name (First and Last Name)';
        }
      }
    }

    if (name === 'dob') {
      if (!value) {
        errorText = 'Date of Birth is required';
      } else {
        const dobDate = new Date(value);
        const today = new Date();
        let age = today.getFullYear() - dobDate.getFullYear();
        const monthDiff = today.getMonth() - dobDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
          age--;
        }
        if (isNaN(age) || age < 18) {
          errorText = 'You must be at least 18 years old to apply.';
        } else if (age > 75) {
          errorText = 'Age limit for application is 75 years.';
        }
      }
    }

    if (name === 'mother_name') {
      const trimmedMother = value ? String(value).trim().replace(/\s+/g, ' ') : '';
      const trimmedFull = currentFormState.name ? String(currentFormState.name).trim().replace(/\s+/g, ' ') : '';

      if (!trimmedMother) {
        errorText = "Mother's Name is required";
      } else if (!/^[a-zA-Z\s.]+$/.test(trimmedMother)) {
        errorText = "Mother's Name should contain only letters and spaces";
      } else if (trimmedFull) {
        const motherLower = trimmedMother.toLowerCase();
        const fullLower = trimmedFull.toLowerCase();
        const motherWords = motherLower.split(' ').filter(Boolean);
        const fullWords = fullLower.split(' ').filter(Boolean);

        const firstName = fullWords[0] || '';
        const secondName = fullWords.length > 1 ? fullWords[fullWords.length - 1] : '';

        // 1. Full name match
        if (motherLower === fullLower) {
          errorText = "Mother's name cannot be the same as Full Name";
        }
        // 2. First name match
        else if (firstName && (motherLower === firstName || motherWords[0] === firstName || motherWords.includes(firstName))) {
          errorText = "Mother's name cannot be the same as First Name";
        }
        // 3. Second name / Last name match
        else if (secondName && (motherLower === secondName || (motherWords.length === 1 && motherWords[0] === secondName))) {
          errorText = "Mother's name cannot be the same as Second Name";
        }
      }
    }

    if (name === 'current_address') {
      if (!value || String(value).trim().length < 5) {
        errorText = 'Please enter complete current residential address (min 5 characters).';
      }
    }

    if (name === 'pincode') {
      if (!value) {
        errorText = 'Pincode is required';
      } else if (value.length !== 6 || !/^\d+$/.test(value)) {
        errorText = 'Pincode must be exactly 6 digits.';
      } else if (negativePincodeNotice) {
        errorText = negativePincodeNotice;
      } else if (pincodeError) {
        errorText = pincodeError;
      }
    }

    if (name === 'landmark') {
      if (!value || !String(value).trim()) {
        errorText = 'Landmark is required';
      }
    }

    if (name === 'city') {
      if (!value || !String(value).trim()) {
        errorText = 'City is required';
      }
    }

    if (name === 'state') {
      if (!value || !String(value).trim()) {
        errorText = 'State is required';
      }
    }

    if (name === 'mobile') {
      if (!value) {
        errorText = 'Phone number is required';
      } else if (!/^[6-9]/.test(value)) {
        errorText = 'Phone number should start with 6, 7, 8, or 9';
      } else if (value.length !== 10) {
        errorText = 'Phone number must be exactly 10 digits.';
      }
    }

    if (name === 'email') {
      if (!value) {
        errorText = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errorText = 'Please enter a valid email address.';
      }
    }

    if (name === 'designation') {
      if (!value || !String(value).trim()) {
        errorText = 'Designation is required';
      }
    }

    if (name === 'company_name') {
      if (!value || !String(value).trim()) {
        errorText = 'Company Name is required';
      }
    }

    if (name === 'consent') {
      if (!value) {
        errorText = 'Please check the consent checkbox to proceed.';
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

  // Validate entire form strictly before proceeding
  const validateForm = () => {
    let isValid = true;
    const requiredFields = [
      'pan', 'name', 'dob', 'mother_name', 'current_address', 
      'pincode', 'city', 'state', 'landmark', 'mobile', 'email', 
      'employment', 'designation', 'company_name', 'consent'
    ];

    const currentErrors = {};

    requiredFields.forEach(field => {
      const val = formData[field];
      let fieldError = '';

      if (field === 'pan') {
        if (!val) fieldError = 'PAN Number is required';
        else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val)) fieldError = 'Invalid PAN format (e.g. ABCDE1234F).';
      } else if (field === 'name') {
        const trimmed = val ? String(val).trim() : '';
        if (!trimmed) fieldError = 'Full Name is required';
        else if (!/^[a-zA-Z\s.]+$/.test(trimmed)) fieldError = 'Full Name should contain only letters and spaces';
        else if (trimmed.split(/\s+/).filter(Boolean).length < 2) fieldError = 'Please enter your Full Name (First and Last Name)';
      } else if (field === 'dob') {
        if (!val) fieldError = 'Date of Birth is required';
        else {
          const dobDate = new Date(val);
          const today = new Date();
          let age = today.getFullYear() - dobDate.getFullYear();
          const monthDiff = today.getMonth() - dobDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) age--;
          if (isNaN(age) || age < 18) fieldError = 'You must be at least 18 years old to apply.';
          else if (age > 75) fieldError = 'Age limit for application is 75 years.';
        }
      } else if (field === 'mother_name') {
        const trimmedMother = val ? String(val).trim().replace(/\s+/g, ' ') : '';
        const trimmedFull = formData.name ? String(formData.name).trim().replace(/\s+/g, ' ') : '';
        if (!trimmedMother) {
          fieldError = "Mother's Name is required";
        } else if (!/^[a-zA-Z\s.]+$/.test(trimmedMother)) {
          fieldError = "Mother's Name should contain only letters and spaces";
        } else if (trimmedFull) {
          const motherLower = trimmedMother.toLowerCase();
          const fullLower = trimmedFull.toLowerCase();
          const motherWords = motherLower.split(' ').filter(Boolean);
          const fullWords = fullLower.split(' ').filter(Boolean);

          const firstName = fullWords[0] || '';
          const secondName = fullWords.length > 1 ? fullWords[fullWords.length - 1] : '';

          // 1. Full name match
          if (motherLower === fullLower) {
            fieldError = "Mother's name cannot be the same as Full Name";
          }
          // 2. First name match
          else if (firstName && (motherLower === firstName || motherWords[0] === firstName || motherWords.includes(firstName))) {
            fieldError = "Mother's name cannot be the same as First Name";
          }
          // 3. Second name / Last name match
          else if (secondName && (motherLower === secondName || (motherWords.length === 1 && motherWords[0] === secondName))) {
            fieldError = "Mother's name cannot be the same as Second Name";
          }
        }
      } else if (field === 'current_address') {
        if (!val || String(val).trim().length < 5) fieldError = 'Complete residential address is required (min 5 characters).';
      } else if (field === 'pincode') {
        if (!val) fieldError = 'Pincode is required';
        else if (val.length !== 6 || !/^\d+$/.test(val)) fieldError = 'Pincode must be exactly 6 digits.';
        else if (negativePincodeNotice) fieldError = negativePincodeNotice;
        else if (pincodeError) fieldError = pincodeError;
      } else if (field === 'landmark') {
        if (!val || !String(val).trim()) fieldError = 'Landmark is required';
      } else if (field === 'city') {
        if (!val || !String(val).trim()) fieldError = 'City is required';
      } else if (field === 'state') {
        if (!val || !String(val).trim()) fieldError = 'State is required';
      } else if (field === 'mobile') {
        if (!val) fieldError = 'Phone number is required';
        else if (!/^[6-9]/.test(val)) fieldError = 'Phone number must start with 6, 7, 8, or 9';
        else if (val.length !== 10) fieldError = 'Phone number must be exactly 10 digits.';
      } else if (field === 'email') {
        if (!val) fieldError = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) fieldError = 'Please enter a valid email address.';
      } else if (field === 'employment') {
        if (!val || !String(val).trim()) fieldError = 'Employment type is required';
      } else if (field === 'designation') {
        if (!val || !String(val).trim()) fieldError = 'Designation is required';
      } else if (field === 'company_name') {
        if (!val || !String(val).trim()) fieldError = 'Company Name is required';
      } else if (field === 'consent') {
        if (!val) fieldError = 'Please check the consent checkbox to continue.';
      }

      if (fieldError) {
        currentErrors[field] = fieldError;
        isValid = false;
      }
    });

    setErrors(currentErrors);

    if (!isValid) {
      const firstKey = Object.keys(currentErrors)[0];
      setFormError(`Please correct the error: ${currentErrors[firstKey]}`);
    } else {
      setFormError('');
    }

    return isValid;
  };

  // Send Step 1 WhatsApp OTP
  const sendStep1Otp = async () => {
    if (negativePincodeNotice) {
      setFormError('This PINCODE is negative for card delivery. Application cannot proceed.');
      return;
    }
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
    if (negativePincodeNotice) {
      setOtpStatus('This PINCODE is negative for card delivery. Application cannot proceed.');
      return;
    }
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
          // Trigger final submission
          setTimeout(() => {
            handleFormSubmit();
          }, 100);
        }, 1200);
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
        setOtpStatus('New OTP sent to your WhatsApp.');
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

  // Final Form Submission
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

    if (!isPhoneVerifiedRef.current) {
      sendStep1Otp();
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        full_name: formData.name,
        phone: formData.mobile,
        email: formData.email,
        pan_no: formData.pan,
        dob: formData.dob,
        mother_name: formData.mother_name,
        current_address: formData.current_address,
        pincode: formData.pincode,
        city: formData.city,
        state: formData.state,
        landmark: formData.landmark,
        employment: formData.employment,
        designation: formData.designation,
        company_name: formData.company_name,
        consent: formData.consent,
        source: 'SBI (QDE)',
        ...utmParams
      };

      const res = await fetch(`${API_URL}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        setIsSubmitted(true);
        if (data.redirectUrl) {
          setRedirectUrl(data.redirectUrl);
        }
        trackLeadSubmission(data.id || data.urn, 'sbi_qde');
      } else {
        setFormError(data.error || 'Failed to submit application. Please verify your details.');
      }
    } catch (err) {
      setFormError('Network error. Unable to complete registration.');
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
         --wine:#0A3F83; /* SBI Royal Blue */
         --wine2:#0072BC; /* Light Blue Accent */
         --oxblood:#002B5C; /* Deep Corporate Navy */
         --blush:#E6F2FD; /* Soft Light Blue Tint */
         --rose:#D4E8FC; /* Deeper Soft Blue Tint */
         --cream:#FFFFFF; /* White */
         --paper:#F4F8FD; /* Clean Soft Blue-Grey Background */
         --gold:#F58220; /* SBI Card Orange Accent */
         --gold-deep:#D96B00; /* Deep Orange Accent */
         --ink:#092C4C; /* Deep Navy Text */
         --line:#CFE2F3; /* Light Blue-Grey Borders */
         --ok:#2f7d4f; 
         --err:#b23a48;
        }
        
        .simplyclick-wrapper {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: var(--ink);
          background: var(--paper);
          line-height: 1.45;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          -webkit-text-size-adjust: 100%;
          overflow-x: hidden;
          width: 100%;
        }
        
        .simplyclick-wrapper *, 
        .simplyclick-wrapper *::before, 
        .simplyclick-wrapper *::after {
          box-sizing: border-box;
        }

        .simplyclick-wrapper .eyebrow {
          font-family: monospace;
          text-transform: uppercase;
          letter-spacing: 2px;
          font-size: 11px;
          font-weight: 600;
        }
        
        .simplyclick-wrapper h1,
        .simplyclick-wrapper h2,
        .simplyclick-wrapper h3,
        .simplyclick-wrapper h4 {
          font-family: 'Bricolage Grotesque', -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 700;
          letter-spacing: -0.5px;
          line-height: 1.08;
        }
        
        .simplyclick-wrapper a {
          color: inherit;
        }
        
        .simplyclick-wrapper .wrap {
          max-width: 1140px;
          margin: 0 auto;
          padding: 0 clamp(14px, 2.5vw, 24px);
          width: 100%;
        }

        /* top bar */
        .simplyclick-wrapper .topbar {
          position: sticky;
          top: 0;
          z-index: 40;
          background: rgba(244,248,253,0.92);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--line);
        }
        .simplyclick-wrapper .topbar .row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 54px;
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
          padding: 10px 20px;
          font-size: 14px;
          transition: transform .15s ease, box-shadow .15s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          line-height: 1;
        }
        .simplyclick-wrapper .btn-primary {
          background: var(--wine);
          color: var(--cream);
          box-shadow: 0 4px 14px rgba(0,43,92,.22);
        }
        .simplyclick-wrapper .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(0,43,92,.28);
        }
        .simplyclick-wrapper .btn-gold {
          background: var(--gold);
          color: var(--oxblood);
        }
        .simplyclick-wrapper .btn-sm {
          padding: 7px 14px;
          font-size: 13px;
        }

        /* hero */
        .simplyclick-wrapper .hero {
          position: relative;
          overflow: hidden;
          background: linear-gradient(160deg, var(--blush), var(--rose));
          padding: clamp(20px, 3.5vw, 36px) 0 clamp(28px, 4vw, 44px);
        }
        .simplyclick-wrapper .hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(var(--oxblood) 1.2px, transparent 1.3px);
          background-size: 30px 30px;
          opacity: .06;
          pointer-events: none;
        }
        .simplyclick-wrapper .hero .grid {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 1.18fr;
          gap: clamp(20px, 3vw, 36px);
          align-items: start;
        }
        .simplyclick-wrapper .hero .pitch {
          position: sticky;
          top: 70px;
        }
        .simplyclick-wrapper .hero h1 {
          font-size: clamp(24px, 2.6vw, 34px);
          color: var(--oxblood);
          margin: 8px 0 10px;
        }
        .simplyclick-wrapper .hero h1 .g {
          color: var(--gold-deep);
        }
        .simplyclick-wrapper .hero p.lead {
          font-size: clamp(13px, 1.2vw, 14.5px);
          max-width: 38ch;
          color: var(--ink);
          line-height: 1.45;
          margin-bottom: 12px;
        }
        .simplyclick-wrapper .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin: 12px 0 4px;
        }
        .simplyclick-wrapper .chip {
          background: var(--wine);
          color: var(--cream);
          font-weight: 600;
          font-size: 12px;
          padding: 6px 11px;
          border-radius: 999px;
          letter-spacing: 0.1px;
        }
        .simplyclick-wrapper .chip.alt {
          background: transparent;
          color: var(--wine);
          border: 1.2px solid var(--wine);
        }
        .simplyclick-wrapper .cardwrap {
          position: relative;
          display: flex;
          justify-content: center;
          margin: 12px 0;
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
          width: min(190px, 55%);
          transform: rotate(-5deg);
          filter: drop-shadow(0 18px 24px rgba(0,43,92,.35));
        }
        .simplyclick-wrapper .spark {
          position: absolute;
          right: 8%;
          top: 2%;
          font-size: 26px;
          color: var(--gold);
        }

        /* benefits */
        .simplyclick-wrapper .benefits {
          padding: clamp(34px, 4.5vw, 48px) 0;
        }
        .simplyclick-wrapper .benefits .eyebrow {
          color: var(--wine);
        }
        .simplyclick-wrapper .benefits h2 {
          font-size: clamp(20px, 2.4vw, 28px);
          color: var(--oxblood);
          margin: 6px 0 20px;
          max-width: 24ch;
        }
        .simplyclick-wrapper .bgrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }
        .simplyclick-wrapper .bcard {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 16px;
        }
        .simplyclick-wrapper .bcard .n {
          font-family: 'Bricolage Grotesque', sans-serif;
          font-weight: 700;
          font-size: 22px;
          color: var(--wine);
        }
        .simplyclick-wrapper .bcard h3 {
          font-size: 15px;
          margin: 4px 0 4px;
          color: var(--oxblood);
        }
        .simplyclick-wrapper .bcard p {
          font-size: 12.5px;
          color: #4A6882;
          line-height: 1.4;
          margin: 0;
        }

        /* form */
        .simplyclick-wrapper .apply {
          padding: 0;
        }
        .simplyclick-wrapper .formcard {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 18px;
          box-shadow: 0 16px 36px rgba(0,43,92,.12);
          overflow: hidden;
        }
        .simplyclick-wrapper .formhead {
          background: var(--wine);
          color: var(--cream);
          padding: 14px 18px;
        }
        .simplyclick-wrapper .formhead h2 {
          font-size: 17px;
          margin: 0;
          letter-spacing: -0.2px;
        }
        .simplyclick-wrapper .formhead p {
          opacity: .92;
          font-size: 12.5px;
          margin: 4px 0 0;
          line-height: 1.35;
        }
        .simplyclick-wrapper form {
          padding: 16px 18px 20px;
        }
        .simplyclick-wrapper .fgrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 11px 13px;
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
          letter-spacing: 0.8px;
          font-size: 10.5px;
          font-weight: 600;
          color: var(--wine);
          margin-bottom: 5px;
        }
        .simplyclick-wrapper label .req {
          color: var(--err);
        }
        .simplyclick-wrapper input,
        .simplyclick-wrapper select,
        .simplyclick-wrapper textarea {
          font-family: 'Outfit', sans-serif;
          font-size: 13.5px;
          color: var(--ink);
          background: var(--paper);
          border: 1.3px solid var(--line);
          border-radius: 10px;
          padding: 9px 11px;
          width: 100%;
          transition: border-color .15s, box-shadow .15s;
          line-height: 1.3;
        }
        .simplyclick-wrapper textarea {
          resize: vertical;
          min-height: 60px;
        }
        .simplyclick-wrapper input:focus,
        .simplyclick-wrapper select:focus,
        .simplyclick-wrapper textarea:focus {
          outline: none;
          border-color: var(--wine);
          box-shadow: 0 0 0 2.5px rgba(10,63,131,.12);
        }
        .simplyclick-wrapper .field.invalid input,
        .simplyclick-wrapper .field.invalid select,
        .simplyclick-wrapper .field.invalid textarea {
          border-color: var(--err);
        }
        .simplyclick-wrapper .hint {
          font-size: 11px;
          color: #5A7B9A;
          margin-top: 3px;
        }
        .simplyclick-wrapper .err {
          font-size: 11px;
          color: var(--err);
          margin-top: 3px;
          display: none;
        }
        .simplyclick-wrapper .field.invalid .err {
          display: block;
        }
        .simplyclick-wrapper .pan input {
          text-transform: uppercase;
          letter-spacing: 1.5px;
          font-weight: 600;
        }
        .simplyclick-wrapper .mob {
          display: flex;
          align-items: stretch;
        }
        .simplyclick-wrapper .mob .pre {
          display: flex;
          align-items: center;
          padding: 0 10px;
          border: 1.3px solid var(--line);
          border-right: none;
          border-radius: 10px 0 0 10px;
          background: var(--blush);
          font-size: 13.5px;
          font-weight: 600;
          color: var(--wine);
        }
        .simplyclick-wrapper .mob input {
          border-radius: 0 10px 10px 0;
        }
        .simplyclick-wrapper .consent {
          grid-column: 1/-1;
          display: flex;
          gap: 10px;
          align-items: flex-start;
          background: var(--blush);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 11px 13px;
          margin-top: 2px;
        }
        .simplyclick-wrapper .consent input {
          width: 17px;
          height: 17px;
          margin-top: 2px;
          flex: none;
          accent-color: var(--wine);
        }
        .simplyclick-wrapper .consent label {
          font-family: 'Outfit', sans-serif;
          text-transform: none;
          letter-spacing: 0;
          font-size: 11.5px;
          color: var(--ink);
          line-height: 1.4;
          font-weight: 400;
        }
        .simplyclick-wrapper .formcol {
          align-self: start;
        }
        .simplyclick-wrapper .securenote {
          grid-column: 1/-1;
          font-family: monospace;
          font-size: 10.5px;
          color: #4A6882;
          display: flex;
          gap: 6px;
          align-items: center;
          margin-top: 2px;
        }
        .simplyclick-wrapper .submitrow {
          grid-column: 1/-1;
          margin-top: 4px;
        }
        .simplyclick-wrapper .submitrow .btn {
          width: 100%;
          justify-content: center;
          font-size: 15px;
          padding: 12px 18px;
        }

        /* success */
        .simplyclick-wrapper .success {
          display: none;
          padding: 32px 24px;
          text-align: center;
        }
        .simplyclick-wrapper .success.show {
          display: block;
        }
        .simplyclick-wrapper .success .tick {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: var(--ok);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          margin: 0 auto 12px;
        }
        .simplyclick-wrapper .success h2 {
          color: var(--oxblood);
          font-size: 20px;
          margin-bottom: 6px;
        }
        .simplyclick-wrapper .success p {
          color: #4A6882;
          max-width: 46ch;
          margin: 10px auto 18px;
          font-size: 13.5px;
          line-height: 1.5;
        }

        /* footer */
        .simplyclick-wrapper footer {
          background: var(--oxblood);
          color: #D4E3F3;
          padding: 30px 0 36px;
        }
        .simplyclick-wrapper footer .disc {
          font-family: monospace;
          font-size: 10.5px;
          line-height: 1.6;
          opacity: .85;
          max-width: 80ch;
        }
        .simplyclick-wrapper footer .links {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin: 12px 0;
          font-size: 12.5px;
        }
        .simplyclick-wrapper footer .links a {
          opacity: .9;
          text-decoration: underline;
        }
        .simplyclick-wrapper footer .note {
          font-size: 10.5px;
          opacity: .7;
          margin-top: 10px;
        }

        @media (max-width:900px){
         .simplyclick-wrapper .hero .grid{grid-template-columns:1fr;padding:26px 0 40px;gap:24px;}
         .simplyclick-wrapper .hero .pitch{position:static;}
         .simplyclick-wrapper .hero .pitchtop{display:flex;align-items:center;gap:18px;}
         .simplyclick-wrapper .hero .pitchtop .cardwrap{flex:none;width:120px;} .cardimg{width:120px;}
         .simplyclick-wrapper .hero h1{font-size:clamp(22px,5.5vw,28px);}
         .simplyclick-wrapper .bgrid{grid-template-columns:1fr 1fr;}
         .simplyclick-wrapper .fgrid{grid-template-columns:1fr 1fr;}
        }
        @media (max-width:560px){
         .simplyclick-wrapper .fgrid{grid-template-columns:1fr;}
         .simplyclick-wrapper .hero .grid{padding:16px 0 34px;}
         .simplyclick-wrapper .hero .pitchtop{flex-direction:row;align-items:center;gap:14px;}
         .simplyclick-wrapper .hero .pitchtop .cardwrap{width:84px;} .cardimg{width:84px;}
         .simplyclick-wrapper .hero h1{font-size:22px;margin:6px 0;}
         .simplyclick-wrapper .hero .lead{display:none;}
         .simplyclick-wrapper .chips{margin:12px 0 2px;gap:7px;} .chip{font-size:11.5px;padding:6px 11px;}
        }
        @media (max-width:520px){
         .simplyclick-wrapper .bgrid{grid-template-columns:1fr;}
        }
        @media (max-width:480px){
          .simplyclick-wrapper .wrap {
            padding: 0 12px !important;
          }
          .simplyclick-wrapper .topbar .btn-sm {
            padding: 8px 16px !important;
            font-size: 13px !important;
            box-shadow: 0 6px 15px rgba(67,23,34,.20) !important;
            width: auto !important;
            max-width: fit-content !important;
            flex: none !important;
          }
          .simplyclick-wrapper .nav-logo img {
            height: 38px !important;
            width: 38px !important;
            border-radius: 8px !important;
          }
          .simplyclick-wrapper .nav-logo span {
            font-size: 1.25rem !important;
          }
          .simplyclick-wrapper .topbar .row {
            height: 56px !important;
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
          background: rgba(9, 44, 76, 0.6);
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
          box-shadow: 0 24px 50px rgba(0,43,92,.25);
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
        .sbi-modal-title {
          font-family: 'Bricolage Grotesque', sans-serif;
          font-size: 22px;
          color: var(--oxblood);
          margin-bottom: 8px;
        }
        .sbi-modal-desc {
          font-size: 14px;
          color: #4A6882;
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
        
        {/* TOP BAR */}
        <div className="topbar">
          <div className="wrap row">
            <div className="nav-logo" onClick={() => navigateTo('/')} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <img src="/logo.jpg" alt="FinMantra Logo" style={{ height: '40px', width: '40px', borderRadius: '10px', objectFit: 'cover' }} />
              <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: '1.30rem', letterSpacing: '-0.03em', color: 'var(--wine)' }}>FinMantra</span>
            </div>
            <a href="#apply" className="btn btn-primary btn-sm">Apply now</a>
          </div>
        </div>

        {/* HERO HEADER */}
        <header className="hero">
          <div className="wrap grid">
            
            {/* LEFT COLUMN: PITCH & CARD SHOWCASE */}
            <div className="pitch">
              <div className="pitchtop">
                <div style={{ flex: 1 }}>
                  <span className="eyebrow" style={{ color: 'var(--wine)' }}>SBI Credit Card QDE Portal</span>
                  <h1>Apply for your <span className="g">SBI Credit Card</span> online.</h1>
                </div>
                <div className="cardwrap">
                  <div className="glow"></div>
                  <div className="spark">&#10022;</div>
                  <img className="cardimg" alt="SBI SimplyClick Credit Card" src="/sbi_card.png" />
                </div>
              </div>
              <p className="lead">Complete the Quick Data Entry (QDE) form to verify your eligibility instantly with SBI Card partner portal.</p>
              <div className="chips">
                <span className="chip">&#8377;500 Amazon voucher</span>
                <span className="chip">10X online rewards</span>
                <span className="chip alt">Fee reversed at &#8377;1L</span>
                <span className="chip alt">&#8377;2,000 milestone vouchers</span>
              </div>
            </div>

            {/* RIGHT COLUMN: FORM CARD */}
            <div className="formcol" id="apply">
              <div className="formcard">
                <div className="formhead">
                  <h2>Quick Data Entry (QDE) Form</h2>
                  <p>Please enter your exact details as printed on your Official Identity Documents (PAN / Aadhaar).</p>
                </div>

                {isSubmitted ? (
                  <div className="success show" id="success">
                    <div className="tick">&#10003;</div>
                    <h2>Application Submitted!</h2>
                    <p style={{ fontWeight: 600, color: 'var(--oxblood)' }}>
                      "Thank you for submitting this application. We will submit your application with bank and if you’re eligible for any credit card with bank, our representative will call you shortly"
                    </p>
                    {redirectUrl && redirectUrl !== '#' && (
                      <a className="btn btn-gold" id="continuebtn" href={redirectUrl} rel="noopener" style={{ marginTop: '16px' }}>
                        Continue to SBI application &rarr;
                      </a>
                    )}
                  </div>
                ) : (
                  <form id="leadform" onSubmit={handleFormSubmit} noValidate autoComplete="on">
                    <div className="fgrid">

                      {/* 1. PAN Number */}
                      <div className={`field pan ${errors.pan ? 'invalid' : ''}`}>
                        <label htmlFor="pan">PAN Number <span className="req">*</span></label>
                        <input
                          id="pan"
                          name="pan"
                          maxLength="10"
                          placeholder="ABCDE1234F"
                          autoComplete="off"
                          value={formData.pan}
                          onChange={handleInputChange}
                        />
                        <span className="hint">10 characters printed on your PAN card.</span>
                        <span className="err">{errors.pan || 'Enter a valid PAN number.'}</span>
                      </div>

                      {/* 2. Full Name */}
                      <div className={`field ${errors.name ? 'invalid' : ''}`}>
                        <label htmlFor="name">Full Name (as on PAN) <span className="req">*</span></label>
                        <input
                          id="name"
                          name="name"
                          placeholder="First & Last Name"
                          autoComplete="name"
                          value={formData.name}
                          onChange={handleInputChange}
                        />
                        <span className="err">{errors.name || 'Enter your full name.'}</span>
                      </div>

                      {/* 3. Date of Birth */}
                      <div className={`field ${errors.dob ? 'invalid' : ''}`}>
                        <label htmlFor="dob">Date of Birth <span className="req">*</span></label>
                        <input
                          id="dob"
                          name="dob"
                          type="date"
                          value={formData.dob}
                          onChange={handleInputChange}
                        />
                        <span className="err">{errors.dob || 'Valid Date of Birth is required (Age 18+).'}</span>
                      </div>

                      {/* 4. Mother's Name */}
                      <div className={`field ${errors.mother_name ? 'invalid' : ''}`}>
                        <label htmlFor="mother_name">Mother's Name <span className="req">*</span></label>
                        <input
                          id="mother_name"
                          name="mother_name"
                          placeholder="Mother's Full Name"
                          value={formData.mother_name}
                          onChange={handleInputChange}
                        />
                        <span className="err">{errors.mother_name || "Mother's name is required and must not be equal to Full Name."}</span>
                      </div>

                      {/* 5. Current Residence Address */}
                      <div className={`field full ${errors.current_address ? 'invalid' : ''}`}>
                        <label htmlFor="current_address">Current Residence Address <span className="req">*</span></label>
                        <textarea
                          id="current_address"
                          name="current_address"
                          placeholder="House/Flat No., Building Name, Street Name, Locality"
                          rows="2"
                          value={formData.current_address}
                          onChange={handleInputChange}
                        />
                        <span className="err">{errors.current_address || 'Current residential address is required.'}</span>
                      </div>

                      {/* 6. Pincode */}
                      <div className={`field ${errors.pincode ? 'invalid' : ''}`}>
                        <label htmlFor="pincode">Pincode <span className="req">*</span></label>
                        <input
                          id="pincode"
                          name="pincode"
                          maxLength="6"
                          placeholder="6-digit Pincode"
                          inputMode="numeric"
                          value={formData.pincode}
                          onChange={handleInputChange}
                        />
                        {isFetchingPincode && (
                          <span style={{ fontSize: '11px', color: 'var(--wine)', marginTop: '4px' }}>Fetching location...</span>
                        )}
                        {pincodeLocationText && !pincodeError && (
                          <span style={{ fontSize: '11px', color: 'var(--ok)', marginTop: '4px', fontWeight: 600 }}>
                            Location: {pincodeLocationText}
                          </span>
                        )}
                        <span className="err">{errors.pincode || pincodeError || 'Enter a valid 6-digit pincode.'}</span>
                        
                        {negativePincodeNotice && (
                          <div style={{ marginTop: '8px', padding: '10px', background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: '10px', color: '#B78103', fontSize: '12px', fontWeight: 600 }}>
                            ⚠️ {negativePincodeNotice}
                          </div>
                        )}
                      </div>

                      {/* 7. Landmark */}
                      <div className={`field ${errors.landmark ? 'invalid' : ''}`}>
                        <label htmlFor="landmark">Landmark <span className="req">*</span></label>
                        <input
                          id="landmark"
                          name="landmark"
                          placeholder="e.g. Near Metro Station / Park"
                          value={formData.landmark}
                          onChange={handleInputChange}
                        />
                        <span className="err">{errors.landmark || 'Landmark is required.'}</span>
                      </div>

                      {/* 8. City */}
                      <div className={`field ${errors.city ? 'invalid' : ''}`}>
                        <label htmlFor="city">City <span className="req">*</span></label>
                        <input
                          id="city"
                          name="city"
                          placeholder="City Name"
                          value={formData.city}
                          onChange={handleInputChange}
                        />
                        <span className="err">{errors.city || 'City is required.'}</span>
                      </div>

                      {/* 9. State */}
                      <div className={`field ${errors.state ? 'invalid' : ''}`}>
                        <label htmlFor="state">State <span className="req">*</span></label>
                        <input
                          id="state"
                          name="state"
                          placeholder="State Name"
                          value={formData.state}
                          onChange={handleInputChange}
                        />
                        <span className="err">{errors.state || 'State is required.'}</span>
                      </div>

                      {/* 10. Phone / Mobile */}
                      <div className={`field ${errors.mobile ? 'invalid' : ''}`}>
                        <label htmlFor="mobile">WhatsApp Number <span className="req">*</span></label>
                        <div className="mob">
                          <span className="pre">+91</span>
                          <input
                            id="mobile"
                            name="mobile"
                            maxLength="10"
                            placeholder="10-digit mobile"
                            inputMode="numeric"
                            value={formData.mobile}
                            onChange={handleInputChange}
                          />
                        </div>
                        <span className="err">{errors.mobile || 'Enter a valid 10-digit WhatsApp number.'}</span>
                      </div>

                      {/* 11. Email */}
                      <div className={`field ${errors.email ? 'invalid' : ''}`}>
                        <label htmlFor="email">Email Address <span className="req">*</span></label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="name@example.com"
                          value={formData.email}
                          onChange={handleInputChange}
                        />
                        <span className="err">{errors.email || 'Enter a valid email address.'}</span>
                      </div>

                      {/* 12. Employment Type */}
                      <div className="field">
                        <label htmlFor="employment">Employment Type <span className="req">*</span></label>
                        <select
                          id="employment"
                          name="employment"
                          value={formData.employment}
                          onChange={handleInputChange}
                        >
                          <option value="Salaried">Salaried</option>
                          <option value="Self Employed Business">Self Employed Business</option>
                          <option value="Self Employed Professional">Self Employed Professional</option>
                        </select>
                      </div>

                      {/* 13. Designation */}
                      <div className={`field ${errors.designation ? 'invalid' : ''}`}>
                        <label htmlFor="designation">Designation <span className="req">*</span></label>
                        <input
                          id="designation"
                          name="designation"
                          placeholder="Job Designation"
                          value={formData.designation}
                          onChange={handleInputChange}
                        />
                        <span className="err">{errors.designation || 'Designation is required.'}</span>
                      </div>

                      {/* 14. Company Name */}
                      <div className={`field full ${errors.company_name ? 'invalid' : ''}`}>
                        <label htmlFor="company_name">Company / Employer Name <span className="req">*</span></label>
                        <input
                          id="company_name"
                          name="company_name"
                          placeholder="Full Company or Business Name"
                          value={formData.company_name}
                          onChange={handleInputChange}
                        />
                        <span className="err">{errors.company_name || 'Company Name is required.'}</span>
                      </div>

                      {/* Consent Checkbox */}
                      <div className="consent field">
                        <input
                          id="consent"
                          name="consent"
                          type="checkbox"
                          checked={formData.consent}
                          onChange={handleInputChange}
                        />
                        <label htmlFor="consent">
                          I authorise <b>FinMantra</b> (an authorised DSA of SBI Card) to fetch my credit report and contact me via Phone, SMS, or WhatsApp regarding this credit card application. Privacy Policy.
                        </label>
                      </div>
                      <span className="err" style={{ gridColumn: '1/-1', display: errors.consent ? 'block' : 'none' }}>
                        {errors.consent || 'Please tick the box to continue.'}
                      </span>

                      {formError && (
                        <div style={{ gridColumn: '1/-1', padding: '12px', background: '#FDF2F2', border: '1px solid #FDE8E8', borderRadius: '12px', color: 'var(--err)', fontSize: '14px', fontWeight: 600 }}>
                          {formError}
                        </div>
                      )}

                      <div className="securenote">&#128274; Sent over a 256-bit secure connection. We only use your details for application decisioning.</div>

                      <div className="submitrow">
                        <button type="submit" className="btn btn-primary" id="submitbtn" disabled={isSubmitting}>
                          {isSubmitting ? 'Submitting\u2026' : 'Submit & Verify WhatsApp OTP \u2192'}
                        </button>
                      </div>

                    </div>
                  </form>
                )}
              </div>
            </div>

          </div>
        </header>

        {/* BENEFITS SECTION */}
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

        {/* FOOTER */}
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

        {/* OTP VERIFICATION MODAL */}
        {showOtpModal && (
          <div className="sbi-modal-overlay">
            <div className="sbi-modal-panel">
              <button className="sbi-modal-close" onClick={() => setShowOtpModal(false)}>
                <X size={20} />
              </button>
              <div className="sbi-modal-icon-row">
                <Phone size={28} />
              </div>
              <h3 className="sbi-modal-title">Verify WhatsApp OTP</h3>
              <p className="sbi-modal-desc">
                We sent a 6-digit verification code to your WhatsApp number:<br />
                <strong>+91 {formData.mobile}</strong>
              </p>

              {simulatedOtpText && (
                <div style={{ margin: '0 0 14px', padding: '10px', background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: '10px', color: '#B78103', fontSize: '13px', fontWeight: 600 }}>
                  [TEST MODE OTP]: {simulatedOtpText}
                </div>
              )}

              <input
                type="text"
                className="sbi-otp-input-field"
                maxLength={6}
                value={otpVal}
                onChange={(e) => setOtpVal(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
              />

              {otpStatus && <span className="sbi-otp-status">{otpStatus}</span>}

              <div className="sbi-otp-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleVerifyOtp}
                  disabled={otpVal.length !== 6 || isSubmitting}
                >
                  {isSubmitting ? 'Verifying\u2026' : 'Verify & Submit \u2192'}
                </button>

                <button
                  type="button"
                  className="sbi-resend-btn"
                  onClick={handleResendOtp}
                  disabled={resendTimer > 0 || isSubmitting}
                >
                  {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP via WhatsApp'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
