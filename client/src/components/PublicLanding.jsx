import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Zap, HelpCircle, ArrowRight, X, Clock, RefreshCw, Layers, ArrowLeft, User, Phone, Mail, Briefcase, MapPin, ChevronDown, Calendar, Home } from 'lucide-react';
import { trackLeadSubmission, initAnalytics, resolveRedirectUrl } from '../utils/analytics';

const COMMON_DESIGNATIONS = [
  "Software Engineer",
  "Manager",
  "Associate",
  "Analyst",
  "Consultant",
  "Director",
  "Executive",
  "Officer",
  "Engineer",
  "Architect",
  "Teacher / Professor",
  "Doctor",
  "Chartered Accountant (CA)",
  "Sales Representative",
  "HR Specialist",
  "Proprietor / Owner",
  "Student",
  "Retired",
  "Housewife",
  "Other"
];

// Offline fallback helper to resolve Indian pincodes to State/Region
const getStateFromPincode = (pin) => {
  if (!pin || pin.length < 2) return null;
  const prefix2 = pin.substring(0, 2);
  const prefix1 = pin.substring(0, 1);
  
  const mapping = {
    '11': 'Delhi',
    '12': 'Haryana',
    '13': 'Haryana',
    '14': 'Punjab',
    '15': 'Punjab',
    '16': 'Chandigarh',
    '17': 'Himachal Pradesh',
    '18': 'Jammu & Kashmir',
    '19': 'Jammu & Kashmir',
    '20': 'Uttar Pradesh',
    '21': 'Uttar Pradesh',
    '22': 'Uttar Pradesh',
    '23': 'Uttar Pradesh',
    '24': 'Uttar Pradesh',
    '25': 'Uttar Pradesh',
    '26': 'Uttar Pradesh',
    '27': 'Uttar Pradesh',
    '28': 'Uttar Pradesh',
    '30': 'Rajasthan',
    '31': 'Rajasthan',
    '32': 'Rajasthan',
    '33': 'Rajasthan',
    '34': 'Rajasthan',
    '36': 'Gujarat',
    '37': 'Gujarat',
    '38': 'Gujarat',
    '39': 'Gujarat',
    '40': 'Maharashtra',
    '41': 'Maharashtra',
    '42': 'Maharashtra',
    '43': 'Maharashtra',
    '44': 'Maharashtra',
    '45': 'Madhya Pradesh',
    '46': 'Madhya Pradesh',
    '47': 'Madhya Pradesh',
    '48': 'Madhya Pradesh',
    '49': 'Chhattisgarh',
    '50': 'Telangana',
    '51': 'Andhra Pradesh',
    '52': 'Andhra Pradesh',
    '53': 'Andhra Pradesh',
    '56': 'Karnataka',
    '57': 'Karnataka',
    '58': 'Karnataka',
    '59': 'Karnataka',
    '60': 'Tamil Nadu',
    '61': 'Tamil Nadu',
    '62': 'Tamil Nadu',
    '63': 'Tamil Nadu',
    '64': 'Tamil Nadu',
    '67': 'Kerala',
    '68': 'Kerala',
    '69': 'Kerala',
    '70': 'West Bengal',
    '71': 'West Bengal',
    '72': 'West Bengal',
    '73': 'West Bengal',
    '74': 'West Bengal',
    '75': 'Odisha',
    '76': 'Odisha',
    '77': 'Odisha',
    '78': 'Assam',
    '79': 'North Eastern States',
    '80': 'Bihar',
    '81': 'Bihar',
    '82': 'Bihar',
    '83': 'Jharkhand',
    '84': 'Bihar',
    '85': 'Bihar',
  };

  const regionMapping = {
    '1': 'Northern Region',
    '2': 'Northern Region (UP/Uttarakhand)',
    '3': 'Western Region (Rajasthan/Gujarat)',
    '4': 'Western Region (Maharashtra/MP)',
    '5': 'Southern Region (AP/Telangana/Karnataka)',
    '6': 'Southern Region (TN/Kerala)',
    '7': 'Eastern Region (WB/Orissa/North East)',
    '8': 'Eastern Region (Bihar/Jharkhand)',
    '9': 'Army Postal Service'
  };

  return mapping[prefix2] || regionMapping[prefix1] || null;
};

export default function PublicLanding({ navigateTo, utmParams }) {
  const getCategoryColor = (cat) => {
    switch (cat?.toLowerCase()) {
      case 'premium':
        return '#d4af37'; // Luxury Gold
      case 'rewards':
        return '#3b82f6'; // Trust Blue
      case 'travel':
        return '#8b5cf6'; // Royal Purple
      case 'cashback':
        return '#10b981'; // Emerald Green
      case 'shopping':
        return '#f43f5e'; // Bright Rose/Pink
      case 'digital':
        return '#06b6d4'; // Cyber Cyan
      default:
        return '#6366f1'; // Indigo
    }
  };

  const [cards, setCards] = useState([]);
  const [locations, setLocations] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    pan_no: '',
    pincode: '',
    consent: true
  });

  const [errors, setErrors] = useState({});
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const isPhoneVerifiedRef = useRef(false);
  const [currentUrn, setCurrentUrn] = useState('');

  // Pincode Lookup & Serviceability States
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeLocationText, setPincodeLocationText] = useState('');
  const [pincodeError, setPincodeError] = useState('');
  const [pincodeLocalities, setPincodeLocalities] = useState([]);

  // OTP State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpVal, setOtpVal] = useState('');
  const [otpStatus, setOtpStatus] = useState('');
  const [simulatedOtpText, setSimulatedOtpText] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Resume Session State
  const [resumeSession, setResumeSession] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formStep, setFormStep] = useState(1);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Canvas Animation Reference
  const canvasRef = useRef(null);

  // API base URL
  const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173') ? 'http://localhost:5000/api' : '/api';

  // Load initial cards, locations, settings
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cardsRes, locsRes, settingsRes] = await Promise.all([
          fetch(`${API_URL}/cards`),
          fetch(`${API_URL}/locations`),
          fetch(`${API_URL}/settings`)
        ]);

        const cardsData = await cardsRes.json();
        const locsData = await locsRes.json();
        const settingsData = await settingsRes.json();

        const cardsList = Array.isArray(cardsData) ? cardsData : [];
        const locsList = Array.isArray(locsData) ? locsData : [];

        setCards(cardsList);
        setLocations(locsList.filter(l => l.active));
        setSettings(settingsData);
        initAnalytics(settingsData);
        
        if (cardsList.length > 0) {
          let initialCardId = cardsList[0].id;
          if (utmParams && utmParams.utm_internal) {
            const matchedCard = cardsList.find(c => String(c.utm_internal || '').trim().toLowerCase() === String(utmParams.utm_internal).trim().toLowerCase());
            if (matchedCard) {
              initialCardId = matchedCard.id;
            }
          }
          setFormData(prev => ({ ...prev, selectedCard: initialCardId }));
        }
      } catch (err) {
        console.error('Error fetching landing page data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Check for previous session in sessionStorage to offer resumption
    const lastSession = sessionStorage.getItem('finmantra_applied_lead');
    if (lastSession) {
      setResumeSession(JSON.parse(lastSession));
    }
  }, []);

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
          setPincodeLocalities(data.localities);
          
          setFormData(prev => ({ 
            ...prev, 
            city: data.city,
            address_city: data.city,
            address_state: data.state,
            address_locality: data.localities[0] || ''
          }));
        } else {
          throw new Error('Not found');
        }
      } catch (e) {
        setPincodeLocalities([]);
        const fallbackState = getStateFromPincode(pin);
        if (fallbackState) {
          setPincodeLocationText(`${fallbackState} (Estimated)`);
          setFormData(prev => ({ 
            ...prev, 
            city: fallbackState,
            address_city: fallbackState,
            address_state: fallbackState,
            address_locality: ''
          }));
        } else {
          setPincodeError('Pincode not found');
        }
      } finally {
        if (pin.length === 6 && /^\d+$/.test(pin)) {
          const selectedCardDetails = cards.find(c => c.id === formData.selectedCard);
          if (selectedCardDetails && selectedCardDetails.bank) {
            let bankRules = {};
            try {
              if (settings.bank_pincode_rules) {
                bankRules = typeof settings.bank_pincode_rules === 'string'
                  ? JSON.parse(settings.bank_pincode_rules)
                  : settings.bank_pincode_rules;
              }
            } catch (err) {}

            const rule = bankRules[selectedCardDetails.bank];
            if (rule && rule.mode === 'list') {
              const pinArray = String(rule.list || '').split(',').map(p => p.trim()).filter(Boolean);
              if (!pinArray.includes(pin)) {
                setPincodeError(`${selectedCardDetails.bank} cards facilities are currently not available for your location.`);
              }
            }
          }
        }
        setPincodeLoading(false);
      }
    };

    lookupPincode();
  }, [formData.pincode]);

  // Re-validate pincode immediately if selected card/bank changes
  useEffect(() => {
    if (formData.pincode) {
      validateField('pincode', formData.pincode);
    }
  }, [formData.selectedCard]);



  // OTP Resend Timer
  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer(t => t - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [resendTimer]);

  // Interactive Particle Canvas in Hero (3D Money & Card Floating)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle Classes
    class Particle {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * -100 - 20;
        this.size = Math.random() * 8 + 4;
        this.speedY = Math.random() * 1.5 + 0.8;
        this.speedX = Math.random() * 0.8 - 0.4;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;
        this.opacity = Math.random() * 0.5 + 0.3;
        // 0: Money Bills, 1: Glowing Sparkles, 2: Credit Card Outlines
        this.type = Math.floor(Math.random() * 3);
        this.color = this.type === 0 ? 'hsla(145, 80%, 45%, ' : 
                     this.type === 1 ? 'hsla(42, 95%, 55%, ' : 'hsla(250, 85%, 65%, ';
      }

      update() {
        this.y += this.speedY;
        this.x += this.speedX;
        this.rotation += this.rotationSpeed;

        if (this.y > height) {
          this.reset();
        }
      }

      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.opacity;

        if (this.type === 0) {
          // Bill Shape
          ctx.fillStyle = hslToRgbStr(145, 80, 45, this.opacity);
          ctx.fillRect(-this.size * 1.5, -this.size * 0.8, this.size * 3, this.size * 1.6);
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.lineWidth = 1;
          ctx.strokeRect(-this.size * 1.5, -this.size * 0.8, this.size * 3, this.size * 1.6);
        } else if (this.type === 1) {
          // Star/Sparkle Shape
          ctx.fillStyle = hslToRgbStr(42, 95, 55, this.opacity);
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            ctx.lineTo(0, -this.size);
            ctx.lineTo(this.size * 0.3, -this.size * 0.3);
            ctx.rotate(Math.PI / 2);
          }
          ctx.closePath();
          ctx.fill();
        } else {
          // Credit Card Shape
          ctx.strokeStyle = hslToRgbStr(250, 85, 65, this.opacity);
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-this.size * 1.8, -this.size * 1.1, this.size * 3.6, this.size * 2.2);
          // Draw small chip
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.fillRect(-this.size * 1.2, -this.size * 0.5, this.size * 0.6, this.size * 0.5);
        }

        ctx.restore();
      }
    }

    // Helper HSL convertor
    function hslToRgbStr(h, s, l, a) {
      return `hsla(${h}, ${s}%, ${l}%, ${a})`;
    }

    const particles = Array.from({ length: 45 }, () => new Particle());

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // 3D Card Hover / Tilt Effect Logic
  const handleMouseMove = (e, cardId) => {
    const cardEl = e.currentTarget;
    const rect = cardEl.getBoundingClientRect();
    const x = e.clientX - rect.left; // x position inside element
    const y = e.clientY - rect.top;  // y position inside element
    
    // Calculate rotation limits (-15 to 15 deg)
    const rx = ((y / rect.height) - 0.5) * -20;
    const ry = ((x / rect.width) - 0.5) * 20;
    
    cardEl.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateY(-8px)`;
  };

  const handleMouseLeave = (e) => {
    const cardEl = e.currentTarget;
    cardEl.style.transform = 'rotateX(0deg) rotateY(0deg) translateY(0px)';
  };

  const validateField = (name, value) => {
    let errorText = '';
    
    if (name === 'fullName') {
      const trimmed = value.trim();
      const rules = formSchema.fields.fullName?.validationRules || {};
      const alphabeticOnly = rules.alphabeticOnly !== false;
      const requireSecondWord = rules.requireSecondWord !== false;

      if (trimmed) {
        if (alphabeticOnly && !/^[a-zA-Z\s]+$/.test(trimmed)) {
          errorText = 'Enter your Name as per PAN card';
        } else if (requireSecondWord) {
          const words = trimmed.split(/\s+/).filter(Boolean);
          if (words.length < 2) {
            errorText = 'Please enter your Last Name / Father Name';
          }
        }
      } else if (formSchema.fields.fullName?.required) {
        errorText = 'This field is required';
      }
    }
    
    if (name === 'phone') {
      const rules = formSchema.fields.phone?.validationRules || {};
      const allowedStr = rules.allowedDigitsStart || '6,7,8,9';
      const startChars = allowedStr.split(',').map(s => s.trim()).filter(Boolean);
      
      if (value) {
        const isValidStart = startChars.some(char => value.startsWith(char));
        if (!isValidStart) {
          errorText = `Mobile number should start with ${startChars.join(',')} only`;
        } else if (value.length !== 10) {
          errorText = 'Mobile number must be exactly 10 digits.';
        }
      } else if (formSchema.fields.phone?.required) {
        errorText = 'This field is required';
      }
    }
    
    if (name === 'email') {
      if (value) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errorText = 'Please enter valid Email';
        }
      } else if (formSchema.fields.email?.required) {
        errorText = 'This field is required';
      }
    }
    
    if (name === 'monthly_income') {
      const rules = formSchema.fields.monthly_income?.validationRules || {};
      const minIncome = rules.minIncome !== undefined ? rules.minIncome : 25000;
      const maxIncome = rules.maxIncome !== undefined ? rules.maxIncome : 1000000;

      if (value) {
        const incomeNum = parseInt(value, 10);
        if (isNaN(incomeNum) || incomeNum < minIncome || incomeNum > maxIncome) {
          const minLabel = minIncome >= 1000 ? (minIncome / 1000) + 'k' : minIncome;
          const maxLabel = maxIncome >= 100000 ? (maxIncome / 100000) + ' lakhs' : (maxIncome >= 1000 ? (maxIncome / 1000) + 'k' : maxIncome);
          errorText = `Salary ranges from ${minLabel} to ${maxLabel}`;
        }
      } else if (formSchema.fields.monthly_income?.required) {
        errorText = 'This field is required';
      }
    }
    
    if (name === 'pan_no') {
      if (value) {
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value)) {
          errorText = 'Invalid PAN card format (e.g. ABCDE1234F).';
        }
      } else if (formSchema.fields.pan_no?.required) {
        errorText = 'This field is required';
      }
    }
    
    if (name === 'pincode') {
      if (value) {
        if (value.length !== 6 || !/^\d+$/.test(value)) {
          errorText = 'Pincode must be exactly 6 digits.';
        } else {
          // Check global pincode serviceability
          const pinMode = settings.pincode_serviceability_mode || 'all';
          const pinListRaw = settings.pincode_serviceability_list || '';
          if (pinMode !== 'all') {
            const pinArray = pinListRaw.split(',').map(p => p.trim()).filter(Boolean);
            const isInList = pinArray.includes(value);
            if (pinMode === 'whitelist' && !isInList) {
              errorText = 'Credit card services are not available at your pincode currently.';
            }
            if (pinMode === 'blacklist' && isInList) {
              errorText = 'Credit card services are not available at your pincode currently.';
            }
          }

          // Check bank-specific pincode serviceability
          if (!errorText) {
            const selectedCardDetails = cards.find(c => c.id === formData.selectedCard);
            if (selectedCardDetails && selectedCardDetails.bank) {
              let bankRules = {};
              try {
                if (settings.bank_pincode_rules) {
                  bankRules = typeof settings.bank_pincode_rules === 'string'
                    ? JSON.parse(settings.bank_pincode_rules)
                    : settings.bank_pincode_rules;
                }
              } catch (err) {}

              const rule = bankRules[selectedCardDetails.bank];
              if (rule && rule.mode === 'list') {
                const pinArray = String(rule.list || '').split(',').map(p => p.trim()).filter(Boolean);
                if (!pinArray.includes(value)) {
                  errorText = `${selectedCardDetails.bank} cards facilities are currently not available for your location.`;
                }
              }
            }
          }
        }
      } else if (formSchema.fields.pincode?.required) {
        errorText = 'This field is required';
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

  // Form Input Change Handler
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Numeric-only restriction for phone, monthly_income, and pincode
    if (name === 'phone' || name === 'monthly_income' || name === 'pincode') {
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

  // Pre-fill form when user selects a card from the grid
  const selectCardFromGrid = (cardId) => {
    setFormData(prev => ({ ...prev, selectedCard: cardId }));
    const formElement = document.getElementById('apply-form-section');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Step-by-step form validation helper
  const validateStep = (stepNum) => {
    const newErrors = {};
    const isSalaried = (formData.employment === 'Salaried');

    if (stepNum === 1) {
      // Validate Full Name
      if (formSchema.fields.fullName.visible) {
        const val = formData.fullName.trim();
        const rules = formSchema.fields.fullName.validationRules || {};
        const alphabeticOnly = rules.alphabeticOnly !== false;
        const requireSecondWord = rules.requireSecondWord !== false;

        if (!val) {
          if (formSchema.fields.fullName.required) newErrors.fullName = 'This field is required';
        } else if (alphabeticOnly && !/^[a-zA-Z\s]+$/.test(val)) {
          newErrors.fullName = 'Enter your Name as per PAN card';
        } else if (requireSecondWord) {
          const words = val.split(/\s+/).filter(Boolean);
          if (words.length < 2) {
            newErrors.fullName = 'Please enter your Last Name / Father Name';
          }
        }
      }

      // Validate Phone
      if (formSchema.fields.phone.visible) {
        const val = formData.phone;
        const rules = formSchema.fields.phone.validationRules || {};
        const allowedStr = rules.allowedDigitsStart || '6,7,8,9';
        const startChars = allowedStr.split(',').map(s => s.trim()).filter(Boolean);

        if (!val) {
          if (formSchema.fields.phone.required) newErrors.phone = 'This field is required';
        } else {
          const isValidStart = startChars.some(char => val.startsWith(char));
          if (!isValidStart) {
            newErrors.phone = `Mobile number should start with ${startChars.join(',')} only`;
          } else if (val.length !== 10) {
            newErrors.phone = 'Mobile number must be exactly 10 digits.';
          }
        }
      }

      // Validate Email
      if (formSchema.fields.email.visible) {
        const val = formData.email.trim();
        if (!val) {
          if (formSchema.fields.email.required) newErrors.email = 'This field is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          newErrors.email = 'Please enter valid Email';
        }
      }

      // Validate DOB
      if (!formData.dob) {
        newErrors.dob = 'Date of Birth is required';
      } else {
        const birthDate = new Date(formData.dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        if (age < 18) {
          newErrors.dob = 'Minimum age required is 18 years.';
        }
      }

      // Validate Mother's Name
      if (!formData.mother_name || !formData.mother_name.trim()) {
        newErrors.mother_name = "Mother's name is required";
      }
    } else if (stepNum === 2) {
      // Validate Employment
      if (formSchema.fields.employment.visible && formSchema.fields.employment.required) {
        if (!formData.employment) {
          newErrors.employment = 'This field is required';
        }
      }

      // Validate Monthly Income
      if (formSchema.fields.monthly_income && formSchema.fields.monthly_income.visible) {
        const val = formData.monthly_income;
        const isFieldRequired = formSchema.fields.monthly_income.required;
        const rules = formSchema.fields.monthly_income.validationRules || {};
        const minIncome = rules.minIncome !== undefined ? rules.minIncome : 25000;
        const maxIncome = rules.maxIncome !== undefined ? rules.maxIncome : 1000000;

        if (!val) {
          if (isFieldRequired) {
            newErrors.monthly_income = 'This field is required';
          }
        } else {
          const incomeNum = parseInt(val, 10);
          if (isNaN(incomeNum) || incomeNum < minIncome || incomeNum > maxIncome) {
            const minLabel = minIncome >= 1000 ? (minIncome / 1000) + 'k' : minIncome;
            const maxLabel = maxIncome >= 100000 ? (maxIncome / 100000) + ' lakhs' : (maxIncome >= 1000 ? (maxIncome / 1000) + 'k' : maxIncome);
            newErrors.monthly_income = `Salary ranges from ${minLabel} to ${maxLabel}`;
          }
        }
      }

      // Validate PAN Number
      if (formSchema.fields.pan_no && formSchema.fields.pan_no.visible) {
        const val = formData.pan_no.trim();
        const isFieldRequired = formSchema.fields.pan_no.required;
        if (!val) {
          if (isFieldRequired) {
            newErrors.pan_no = 'This field is required';
          }
        } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val)) {
          newErrors.pan_no = 'Invalid PAN card format (e.g. ABCDE1234F).';
        }
      }

      // Validate Credit Card Toggle
      if (formSchema.fields.has_credit_card.visible && formSchema.fields.has_credit_card.required) {
        if (!formData.has_credit_card) {
          newErrors.has_credit_card = 'This field is required';
        }
      }

      // Validate Pincode
      if (formSchema.fields.pincode.visible) {
        const val = formData.pincode.trim();
        const isFieldRequired = formSchema.fields.pincode.required;
        if (!val) {
          if (isFieldRequired) {
            newErrors.pincode = 'This field is required';
          }
        } else if (val.length !== 6 || !/^\d+$/.test(val)) {
          newErrors.pincode = 'Pincode must be exactly 6 digits.';
        } else {
          const pinMode = settings.pincode_serviceability_mode || 'all';
          const pinListRaw = settings.pincode_serviceability_list || '';
          if (pinMode !== 'all') {
            const pinArray = pinListRaw.split(',').map(p => p.trim()).filter(Boolean);
            const isInList = pinArray.includes(val);
            
            if (pinMode === 'whitelist' && !isInList) {
              newErrors.pincode = 'Credit card services are not available at your pincode currently.';
            }
            if (pinMode === 'blacklist' && isInList) {
              newErrors.pincode = 'Credit card services are not available at your pincode currently.';
            }
          }

          // Validate bank-specific pincode rules
          const selectedCardDetails = cards.find(c => c.id === formData.selectedCard);
          if (selectedCardDetails && selectedCardDetails.bank) {
            let bankRules = {};
            try {
              if (settings.bank_pincode_rules) {
                bankRules = typeof settings.bank_pincode_rules === 'string'
                  ? JSON.parse(settings.bank_pincode_rules)
                  : settings.bank_pincode_rules;
              }
            } catch (err) {}

            const rule = bankRules[selectedCardDetails.bank];
            if (rule && rule.mode === 'list') {
              const pinArray = String(rule.list || '').split(',').map(p => p.trim()).filter(Boolean);
              if (!pinArray.includes(val)) {
                newErrors.pincode = `${selectedCardDetails.bank} cards facilities are currently not available for your location.`;
              }
            }
          }
        }
      }

      // Validate Designation
      if (!formData.designation || !formData.designation.trim()) {
        newErrors.designation = 'Designation is required';
      }

      // Validate Structured Address components in Step 2
      if (!formData.address_house || !formData.address_house.trim()) {
        newErrors.address_house = 'House/Flat No. is required';
      }
      if (!formData.address_street || !formData.address_street.trim()) {
        newErrors.address_street = 'Street/Road/Area is required';
      }
      if (!formData.address_city || !formData.address_city.trim()) {
        newErrors.address_city = 'City is required';
      }
      if (!formData.address_state || !formData.address_state.trim()) {
        newErrors.address_state = 'State is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePrevStep = () => {
    setFormStep(1);
  };

  // Send OTP right in Step 1
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

  // Validate Form
  const validateForm = () => {
    const newErrors = {};
    if (!formData.fullName || formData.fullName.trim().length < 3) {
      newErrors.fullName = 'Full Name is required';
    } else {
      const trimmed = formData.fullName.trim();
      if (!/^[A-Za-z\s]+$/.test(trimmed)) {
        newErrors.fullName = 'Full Name must contain letters and spaces only';
      } else {
        const words = trimmed.split(/\s+/).filter(Boolean);
        if (words.length < 2) {
          newErrors.fullName = 'Please enter your Last Name / Father Name';
        }
      }
    }

    if (!formData.phone || formData.phone.length !== 10 || !/^[6-9]/.test(formData.phone)) {
      newErrors.phone = 'Enter a valid 10-digit mobile number';
    }

    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Enter a valid email address';
    }

    if (!formData.pan_no || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan_no.toUpperCase())) {
      newErrors.pan_no = 'Invalid PAN card format (e.g. ABCDE1234F)';
    }

    if (!formData.pincode || formData.pincode.length !== 6 || !/^\d+$/.test(formData.pincode)) {
      newErrors.pincode = 'Pincode must be exactly 6 digits';
    } else if (pincodeError) {
      newErrors.pincode = pincodeError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form Submission (Single Step)
  const handleFormSubmit = async (e) => {
    if (e) e.preventDefault();
    setFormError('');
    setPincodeError('');

    if (!validateForm()) {
      setFormError('Please correct the highlighted errors before submitting.');
      return;
    }

    if (!isPhoneVerifiedRef.current) {
      sendStep1Otp();
      return;
    }

    setIsSubmitting(true);
    try {
      const savedUtmStr = sessionStorage.getItem('finmantra_utm');
      const savedUtm = savedUtmStr ? JSON.parse(savedUtmStr) : {};
      const mergedUtm = { ...savedUtm, ...(utmParams || {}) };

      const res = await fetch(`${API_URL}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.fullName.trim(),
          phone: formData.phone,
          email: formData.email.trim(),
          pan_no: formData.pan_no.toUpperCase(),
          pincode: formData.pincode,
          consent: true,
          source: 'public',
          ...mergedUtm,
          utm_params: mergedUtm
        })
      });

      const data = await res.json();
      if (res.ok) {
        trackLeadSubmission({
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          eventId: data.urn,
          contentName: 'Public Lead Submitted',
          status: 'submitted'
        });

        const cacheData = {
          name: formData.fullName,
          urn: data.urn,
          redirectUrl: data.redirectUrl,
          cardName: 'FinMantra Card Redirect',
          bank: 'Partner Bank',
          timestamp: new Date().getTime()
        };
        sessionStorage.setItem('finmantra_applied_lead', JSON.stringify(cacheData));
        window.location.replace(resolveRedirectUrl(data.redirectUrl));
      } else {
        setFormError(data.error || 'Failed to submit application. Please try again.');
      }
    } catch (err) {
      setFormError('Network error. Unable to contact servers.');
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

  // Resume Pending Application
  const handleResumeRedirect = () => {
    if (resumeSession) {
      window.location.replace(resolveRedirectUrl(resumeSession.redirectUrl));
    }
  };

  // Cancel Resume Session View
  const handleClearResume = () => {
    sessionStorage.removeItem('finmantra_applied_lead');
    setResumeSession(null);
  };

  const formSchema = (() => {
    try {
      if (settings.landing_form_schema) {
        return typeof settings.landing_form_schema === 'string'
          ? JSON.parse(settings.landing_form_schema)
          : settings.landing_form_schema;
      }
    } catch (e) {
      console.error('Failed to parse form schema', e);
    }
    return {
      fields: {
        fullName: { visible: true, required: true, label: "Full Name (as per PAN Card)", placeholder: "Enter your full name as per PAN Card" },
        phone: { visible: true, required: true, label: "Mobile Number", placeholder: "WhatsApp number (10 digits)" },
        email: { visible: true, required: true, label: "Email address", placeholder: "e.g. name@example.com" },
        has_credit_card: { visible: true, required: true, label: "Do you already have a credit card?" },
        employment: {
          visible: true,
          required: true,
          label: "Employment Type",
          options: [
            { value: "Salaried", enabled: true },
            { value: "Self Employed (Business)", enabled: false },
            { value: "Self Employed (Professional)", enabled: false }
          ]
        },
        monthly_income: { visible: true, required: true, label: "Net Monthly Income", placeholder: "Net Monthly Income" },
        pincode: { visible: true, required: true, label: "Residence Pincode", placeholder: "Residence Pincode" }
      }
    };
  })();

  return (
    <div style={{ position: 'relative' }}>
      
      {/* 3D Money rain Canvas on Hero Area */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '550px', zIndex: 0, pointerEvents: 'none', opacity: 0.8 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}></canvas>
      </div>

      {/* Hero section */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 560px', gap: '48px', padding: '60px 8% 72px 8%', position: 'relative', zIndex: 1, alignItems: 'start' }} className="hero-section">
        {/* Left Side Pitch */}
        <div style={{ paddingTop: '20px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--gold-deep)', marginBottom: '18px', fontWeight: 700 }}>
            Credit Cards • India
          </div>
          <h1 style={{ fontSize: 'clamp(2.3rem, 4.6vw, 3.5rem)', fontWeight: 800, marginBottom: '18px', color: 'var(--ink)' }}>
            Get the right credit card.<br />
            <span style={{ color: 'var(--gold-deep)' }}>Apply in minutes.</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1.14rem', marginBottom: '28px', maxWidth: '38ch' }}>
            Compare top cards, pick the one that fits how you spend, and apply online - free.
          </p>

          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '30px', padding: 0 }}>
            <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', fontWeight: 600, fontSize: '1.02rem', color: 'var(--ink)' }}>
              <span style={{ flex: '0 0 auto', width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(22, 163, 123, 0.15)', color: 'var(--mint)', display: 'grid', placeItems: 'center', fontSize: '0.8rem', fontWeight: 700, marginTop: '1px' }}>✓</span>
              Top credit cards, all in one place
            </li>
            <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', fontWeight: 600, fontSize: '1.02rem', color: 'var(--ink)' }}>
              <span style={{ flex: '0 0 auto', width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(22, 163, 123, 0.15)', color: 'var(--mint)', display: 'grid', placeItems: 'center', fontSize: '0.8rem', fontWeight: 700, marginTop: '1px' }}>✓</span>
              100% online & paperless
            </li>
            <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', fontWeight: 600, fontSize: '1.02rem', color: 'var(--ink)' }}>
              <span style={{ flex: '0 0 auto', width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(22, 163, 123, 0.15)', color: 'var(--mint)', display: 'grid', placeItems: 'center', fontSize: '0.8rem', fontWeight: 700, marginTop: '1px' }}>✓</span>
              No charges - ever
            </li>
            <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', fontWeight: 600, fontSize: '1.02rem', color: 'var(--ink)' }}>
              <span style={{ flex: '0 0 auto', width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(22, 163, 123, 0.15)', color: 'var(--mint)', display: 'grid', placeItems: 'center', fontSize: '0.8rem', fontWeight: 700, marginTop: '1px' }}>✓</span>
              Quick, secure application
            </li>
          </ul>

          <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', paddingTop: '20px', borderTop: '1px solid var(--line)' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 800, display: 'block', lineHeight: 1, color: 'var(--ink)' }}>8+</span>
              <small style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>cards to choose</small>
            </div>
            <div>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 800, display: 'block', lineHeight: 1, color: 'var(--ink)' }}>5 min</span>
              <small style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>to apply</small>
            </div>
            <div>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 800, display: 'block', lineHeight: 1, color: 'var(--ink)' }}>₹0</span>
              <small style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>to use</small>
            </div>
          </div>
        </div>

        {/* Right Side Form Card */}
        <div id="apply-form-section" className="glass-panel" style={{ position: 'sticky', top: '24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink)' }}>Apply in 2 minutes</h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.94rem', marginTop: '4px' }}>
              Fill in your details and we'll take you to the bank to finish.
            </p>
          </div>

          {resumeSession && (
            <div style={{ background: 'hsla(40, 75%, 52%, 0.08)', border: '1px solid rgba(224, 168, 46, 0.15)', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginBottom: '1rem', position: 'relative' }}>
              <button onClick={handleClearResume} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', color: 'var(--ink)', cursor: 'pointer' }}>
                <X size={14} />
              </button>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 500 }}>
                We detected a previous unfinished session:
              </div>
              <div style={{ fontWeight: 700, margin: '0.15rem 0 0.35rem 0', color: 'var(--gold-deep)' }}>
                {resumeSession.name}'s {resumeSession.cardName} ({resumeSession.urn})
              </div>
              <button onClick={handleResumeRedirect} className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', width: 'auto' }}>
                Resume Application <ArrowRight size={12} />
              </button>
            </div>
          )}
          <form onSubmit={handleFormSubmit}>
            {formError && (
              <div style={{ background: 'rgba(209, 67, 67, 0.1)', border: '1px solid rgba(209, 67, 67, 0.2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', color: 'var(--err)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--ink)' }}>
                  Full Name (as per PAN) <span style={{ color: 'var(--err)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', opacity: 0.7, display: 'flex', alignItems: 'center' }}>
                    <User size={18} />
                  </span>
                  <input 
                    type="text" name="fullName" className="form-input"
                    style={{ paddingLeft: '2.5rem', height: '42px', borderRadius: 'var(--radius-sm)' }}
                    placeholder="Enter your full name as per PAN Card"
                    value={formData.fullName} onChange={handleInputChange}
                    required disabled={isSubmitting}
                  />
                </div>
                {errors.fullName && <div style={{ color: 'var(--err)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{errors.fullName}</div>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--ink)' }}>
                    PAN Number <span style={{ color: 'var(--err)' }}>*</span>
                  </label>
                  <input
                    type="text" name="pan_no" className="form-input"
                    style={{ height: '42px', borderRadius: 'var(--radius-sm)', textTransform: 'uppercase' }}
                    placeholder="ABCDE1234F"
                    maxLength="10"
                    value={formData.pan_no} onChange={handleInputChange}
                    required disabled={isSubmitting}
                  />
                  {errors.pan_no && <div style={{ color: 'var(--err)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.pan_no}</div>}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--ink)' }}>
                    WhatsApp Number <span style={{ color: 'var(--err)' }}>*</span>
                  </label>
                  <div className="phone-verify-container">
                    <div className="phone-input-wrapper">
                      <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', opacity: 0.7, display: 'flex', alignItems: 'center' }}>
                        <Phone size={18} />
                      </span>
                      <input
                        type="tel" name="phone" className="form-input"
                        style={{ paddingLeft: '2.5rem', height: '42px', borderRadius: 'var(--radius-sm)' }}
                        placeholder="10-digit mobile"
                        maxLength="10" value={formData.phone} onChange={handleInputChange}
                        required disabled={isSubmitting || isPhoneVerified}
                      />
                    </div>
                    {formData.phone.length === 10 && !errors.phone && (
                      <button
                        type="button"
                        onClick={sendStep1Otp}
                        className="phone-verify-button btn-primary"
                        style={{ 
                          background: isPhoneVerified ? 'var(--mint)' : '#ef4444',
                          borderColor: isPhoneVerified ? 'var(--mint)' : '#ef4444',
                          color: 'var(--white)',
                          fontWeight: 700,
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          cursor: isPhoneVerified ? 'default' : 'pointer'
                        }}
                        disabled={isSubmitting || isPhoneVerified}
                      >
                        {isPhoneVerified ? '✓ Verified' : 'Verify'}
                      </button>
                    )}
                  </div>
                  {errors.phone && <div style={{ color: 'var(--err)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.phone}</div>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--ink)' }}>
                    Email Address <span style={{ color: 'var(--err)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', opacity: 0.7, display: 'flex', alignItems: 'center' }}>
                      <Mail size={18} />
                    </span>
                    <input
                      type="email" name="email" className="form-input"
                      style={{ paddingLeft: '2.5rem', height: '42px', borderRadius: 'var(--radius-sm)' }}
                      placeholder="you@example.com"
                      value={formData.email} onChange={handleInputChange}
                      required disabled={isSubmitting}
                    />
                  </div>
                  {errors.email && <div style={{ color: 'var(--err)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.email}</div>}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--ink)' }}>
                    Pincode <span style={{ color: 'var(--err)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', opacity: 0.7, display: 'flex', alignItems: 'center' }}>
                      <MapPin size={18} />
                    </span>
                    <input
                      type="text" name="pincode" className="form-input"
                      style={{ paddingLeft: '2.5rem', height: '42px', borderRadius: 'var(--radius-sm)' }}
                      placeholder="6-digit Pincode"
                      maxLength="6" value={formData.pincode} onChange={handleInputChange}
                      required disabled={isSubmitting}
                    />
                  </div>
                  {pincodeLoading && <div style={{ fontSize: '0.7rem', color: 'red', marginTop: '0.25rem' }}>Verifying...</div>}
                  {pincodeLocationText && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--mint)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: 'var(--mint)' }}></span>
                      {pincodeLocationText}
                    </div>
                  )}
                  {(errors.pincode || pincodeError) && <div style={{ fontSize: '0.7rem', color: 'var(--err)', marginTop: '0.25rem' }}>{errors.pincode || pincodeError}</div>}
                </div>
              </div>

              <div className="consent" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', margin: '4px 0 10px' }}>
                <input type="checkbox" id="consent" defaultChecked={true} required disabled={isSubmitting} style={{ marginTop: '3px', flex: '0 0 auto', width: '18px', height: '18px', accentColor: 'var(--gold)' }} />
                <label htmlFor="consent" style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5, cursor: 'pointer' }}>
                  {settings.consent_text || 'I authorise FinMantra and its partner banks to contact me via call, SMS, WhatsApp and email about credit card offers, even if I\'m registered under DND/NDNC.'}{' '}
                  I've read the <a href={settings.terms_link || '#'} target="_blank" rel="noreferrer" style={{ color: 'var(--gold-deep)', textDecoration: 'underline' }}>Terms</a> & <a href={settings.privacy_link || '#'} target="_blank" rel="noreferrer" style={{ color: 'var(--gold-deep)', textDecoration: 'underline' }}>Privacy Policy</a>.
                </label>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', height: '42px' }} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting Application...' : 'Apply Now'} <ArrowRight size={18} />
              </button>
            </div>
            
            <div className="securenote" style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--muted)', marginTop: '16px', display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
              <span>✓ No hidden charges</span>
              <span>•</span>
              <span>✓ 100% paperless & secure</span>
            </div>
          </form>
        </div>
      </section>

      {/* Dark Horizontal Badge Strip */}
      <div style={{ background: 'var(--dark-section-bg)', padding: '1.2rem 8%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4rem', flexWrap: 'wrap', zIndex: 2, position: 'relative' }}>
        <div style={{ color: '#ffffff', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--gold)' }}>✓</span> Cards from India's leading banks
        </div>
        <div style={{ color: '#ffffff', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--gold)' }}>✓</span> No hidden charges
        </div>
        <div style={{ color: '#ffffff', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--gold)' }}>✓</span> Secure & paperless
        </div>
      </div>

      {/* How it works */}
      <section style={{ padding: '6rem 8% 5rem 8%', position: 'relative', zIndex: 1, backgroundColor: 'var(--paper)' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold-deep)', marginBottom: '0.5rem', fontWeight: 700 }}>
            HOW IT WORKS
          </div>
          <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-heading)' }}>Three steps. That's it.</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2.5rem' }} className="how-it-works-grid">
          {/* Step 1 */}
          <div className="glass-card" style={{ background: 'var(--white)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '3.5rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'var(--transition-smooth)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '3rem', fontWeight: 800, color: 'var(--gold)', marginBottom: '1rem', lineHeight: 1 }}>01</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '0.75rem', fontFamily: 'var(--font-heading)' }}>Fill the form</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.92rem', lineHeight: 1.5 }}>A few quick details - takes about two minutes.</p>
          </div>

          {/* Step 2 */}
          <div className="glass-card" style={{ background: 'var(--white)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '3.5rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'var(--transition-smooth)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '3rem', fontWeight: 800, color: 'var(--gold)', marginBottom: '1rem', lineHeight: 1 }}>02</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '0.75rem', fontFamily: 'var(--font-heading)' }}>Pick your card</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.92rem', lineHeight: 1.5 }}>Choose the card that fits how you spend.</p>
          </div>

          {/* Step 3 */}
          <div className="glass-card" style={{ background: 'var(--white)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '3.5rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'var(--transition-smooth)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '3rem', fontWeight: 800, color: 'var(--gold)', marginBottom: '1rem', lineHeight: 1 }}>03</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '0.75rem', fontFamily: 'var(--font-heading)' }}>Apply online</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.92rem', lineHeight: 1.5 }}>Finish on the bank's secure page. They handle approval.</p>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section style={{ padding: '5rem 8%', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold-deep)', marginBottom: '0.5rem', fontWeight: 700 }}>
            FAQ
          </div>
          <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-heading)' }}>Good to know.</h2>
        </div>

        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
          <FaqItem 
            question="Is this free?" 
            answer="Yes, 100% free! FinMantra is an authorised referral partner of top banks and we do not charge customers for any comparisons, filters, or registration processes. Ever."
          />
          <FaqItem 
            question="Who approves my card?" 
            answer="Final approval, credit limit configuration, and card terms are governed at the sole discretion of the issuing bank (such as HDFC, ICICI, etc.). We help you select and fill the details before securely handing over to the bank."
          />
          <FaqItem 
            question="What happens after I submit?" 
            answer="Upon entering and verifying your details via WhatsApp OTP, we immediately route you to the bank's secure application endpoint, passing your tracking ID so the bank recognizes your referral. They will perform a final review and dispatch the card."
          />
          <FaqItem 
            question="Is my data safe?" 
            answer="Absolutely. We take security extremely seriously. All applications are paperless and transmitted via HTTPS encrypted connections. Your telephone number and details are used solely to facilitate the card application transaction."
          />
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '4.5rem 8% 3rem 8%', background: 'var(--dark-section-bg)', position: 'relative', zIndex: 1, color: '#ffffff' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
          <img src="/logo.jpg" alt="FinMantra Logo" style={{ height: '32px', width: '32px', borderRadius: '8px', objectFit: 'cover', boxShadow: '0 2px 8px rgba(224, 168, 46, 0.3)' }} />
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.03em', color: '#ffffff' }}>FinMantra</span>
        </div>

        {/* Disclaimer text */}
        <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', lineHeight: 1.7, marginBottom: '1rem', textAlign: 'justify', maxWidth: '100%' }}>
          FinMantra is a brand owned and operated by <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Chaos Design Pvt. Ltd.</strong> - an authorised marketing and referral partner of its partner banks.
        </div>
        <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.35)', lineHeight: 1.7, marginBottom: '2.5rem' }}>
          We are not a bank, lender or card issuer, and we do not charge customers for our services. Card features, fees and rewards are indicative and subject to the bank's current terms. Approval, credit limit and final terms are at the sole discretion of the respective bank. Please borrow responsibly.
        </div>

        {/* Links row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.4)' }}>
          <span>&copy; 2026 FinMantra - A brand of Chaos Design Pvt. Ltd.</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.25)' }}>&middot;</span>
          <a href="#" onClick={(e) => { e.preventDefault(); navigateTo('/privacy-policy'); window.scrollTo(0, 0); }} style={{ color: 'rgba(255, 255, 255, 0.5)', textDecoration: 'none', fontWeight: 500 }} onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'} onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'}>Privacy Policy</a>
          <span style={{ color: 'rgba(255, 255, 255, 0.25)' }}>&middot;</span>
          <a href="#" onClick={(e) => { e.preventDefault(); navigateTo('/terms'); window.scrollTo(0, 0); }} style={{ color: 'rgba(255, 255, 255, 0.5)', textDecoration: 'none', fontWeight: 500 }} onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'} onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'}>Terms & Conditions</a>
          <span style={{ color: 'rgba(255, 255, 255, 0.25)' }}>&middot;</span>
          <a href="#" onClick={(e) => { e.preventDefault(); navigateTo('/about'); window.scrollTo(0, 0); }} style={{ color: 'rgba(255, 255, 255, 0.5)', textDecoration: 'none', fontWeight: 500 }} onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'} onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'}>About Us</a>
          <span style={{ color: 'rgba(255, 255, 255, 0.25)' }}>&middot;</span>
          <a href="#" onClick={(e) => { e.preventDefault(); navigateTo('/contact'); window.scrollTo(0, 0); }} style={{ color: 'rgba(255, 255, 255, 0.5)', textDecoration: 'none', fontWeight: 500 }} onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'} onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'}>Contact</a>
        </div>
      </footer>

      {/* WhatsApp OTP Verification Modal */}
      {showOtpModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '450px', position: 'relative', textAlign: 'center', borderTop: '4px solid var(--gold)' }}>
            <button onClick={() => setShowOtpModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer' }}>
              <X size={20} />
            </button>

            <div style={{ width: '60px', height: '60px', background: 'rgba(224, 168, 46, 0.15)', color: 'var(--gold-deep)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <Clock size={32} />
            </div>

            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>WhatsApp OTP Verification</h3>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              We've sent a 6-digit OTP verification code to <strong style={{ color: 'hsl(var(--primary))' }}>+91 {formData.phone}</strong> via WhatsApp.
            </p>

            {simulatedOtpText && (
              <div style={{ background: 'hsla(42, 95%, 55%, 0.1)', border: '1px solid hsla(42, 95%, 55%, 0.2)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                <div style={{ color: 'hsl(var(--accent-gold))', fontWeight: 600, marginBottom: '0.25rem' }}>🛠️ Developer Simulation Mode</div>
                <div>Your OTP verification code is: <strong style={{ fontSize: '1.1rem', letterSpacing: '2px', color: 'hsl(var(--text-primary))' }}>{simulatedOtpText}</strong></div>
              </div>
            )}

            <div className="form-group" style={{ maxWidth: '240px', margin: '0 auto 1.5rem auto' }}>
              <input 
                type="text" 
                maxLength="6" 
                placeholder="Enter 6-digit OTP" 
                value={otpVal} 
                onChange={(e) => setOtpVal(e.target.value)}
                style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '1.5rem', fontWeight: 800 }}
                className="form-input" 
                disabled={isSubmitting}
              />
            </div>

            {otpStatus && (
              <div style={{ color: otpStatus.includes('Success') || otpStatus.includes('Verified') ? 'var(--mint)' : 'var(--gold-deep)', fontSize: '0.9rem', marginBottom: '1.5rem', fontWeight: 500 }}>
                {otpStatus}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button onClick={handleVerifyOtp} className="btn-primary" style={{ flex: 1, padding: '0.75rem' }} disabled={isSubmitting}>
                {isSubmitting ? 'Verifying...' : 'Verify OTP'}
              </button>
              <button 
                onClick={handleResendOtp} 
                disabled={resendTimer > 0 || isSubmitting} 
                className="btn-secondary" 
                style={{ flex: 1, padding: '0.75rem', fontSize: '0.9rem', color: (resendTimer > 0 || isSubmitting) ? 'hsl(var(--text-muted))' : 'hsl(var(--text-primary))' }}
              >
                {resendTimer > 0 ? `Resend (${resendTimer}s)` : 'Resend OTP'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Collapsible FAQ item sub-component
function FaqItem({ question, answer }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div 
      onClick={() => setIsOpen(!isOpen)}
      style={{ 
        cursor: 'pointer', 
        transition: 'var(--transition-fast)',
        borderBottom: '1px solid var(--line)',
        padding: '1.4rem 0.5rem'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-heading)' }}>{question}</h4>
        <span style={{ color: 'var(--gold)', fontSize: '1.5rem', fontWeight: 600, transition: 'transform 0.2s', transform: isOpen ? 'rotate(45deg)' : 'none', display: 'inline-block', lineHeight: 1 }}>+</span>
      </div>
      {isOpen && (
        <div style={{ marginTop: '0.9rem', color: 'var(--muted)', fontSize: '0.96rem', lineHeight: 1.6 }}>
          {answer}
        </div>
      )}
    </div>
  );
}
