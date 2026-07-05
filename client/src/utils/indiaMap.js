// India Pincode-to-State Mapping & SVG Map Data
// Maps Indian 6-digit pincodes (first 2 digits) to state names

export const PINCODE_TO_STATE = {
  // Zone 1: Delhi, Haryana, Punjab, HP, J&K, Chandigarh
  '11': 'Delhi',
  '12': 'Haryana', '13': 'Haryana',
  '14': 'Punjab', '15': 'Punjab', '16': 'Punjab',
  '17': 'Himachal Pradesh',
  '18': 'Jammu & Kashmir', '19': 'Jammu & Kashmir',

  // Zone 2: Uttar Pradesh, Uttarakhand
  '20': 'Uttar Pradesh', '21': 'Uttar Pradesh', '22': 'Uttar Pradesh',
  '23': 'Uttar Pradesh', '24': 'Uttar Pradesh', '25': 'Uttar Pradesh',
  '26': 'Uttarakhand', '27': 'Uttar Pradesh', '28': 'Uttar Pradesh',

  // Zone 3: Rajasthan, Gujarat
  '30': 'Rajasthan', '31': 'Rajasthan', '32': 'Rajasthan',
  '33': 'Rajasthan', '34': 'Rajasthan',
  '36': 'Gujarat', '37': 'Gujarat', '38': 'Gujarat', '39': 'Gujarat',

  // Zone 4: Maharashtra, Goa, Madhya Pradesh, Chhattisgarh
  '40': 'Maharashtra', '41': 'Maharashtra', '42': 'Maharashtra',
  '43': 'Maharashtra', '44': 'Maharashtra',
  '45': 'Madhya Pradesh', '46': 'Madhya Pradesh', '47': 'Madhya Pradesh',
  '48': 'Madhya Pradesh', '49': 'Chhattisgarh',
  '403': 'Goa',

  // Zone 5: Andhra Pradesh, Telangana, Karnataka
  '50': 'Telangana',
  '51': 'Andhra Pradesh', '52': 'Andhra Pradesh', '53': 'Andhra Pradesh',
  '56': 'Karnataka', '57': 'Karnataka', '58': 'Karnataka', '59': 'Karnataka',

  // Zone 6: Kerala, Tamil Nadu, Puducherry, Lakshadweep
  '60': 'Tamil Nadu', '61': 'Tamil Nadu', '62': 'Tamil Nadu',
  '63': 'Tamil Nadu', '64': 'Tamil Nadu',
  '67': 'Kerala', '68': 'Kerala', '69': 'Kerala',
  '605': 'Tamil Nadu',

  // Zone 7: West Bengal, Odisha, NE States, A&N Islands
  '70': 'West Bengal', '71': 'West Bengal', '72': 'West Bengal', '73': 'West Bengal', '74': 'West Bengal',
  '75': 'Odisha', '76': 'Odisha', '77': 'Odisha',
  '78': 'Assam',
  '79': 'Assam',

  // Zone 8: Bihar, Jharkhand
  '80': 'Bihar', '81': 'Bihar', '82': 'Bihar', '84': 'Bihar', '85': 'Bihar',
  '83': 'Jharkhand',

  // Zone 9: Army Post / Field Post
  '90': 'APO/FPO', '91': 'APO/FPO',

  // NE States (special ranges)
  '791': 'Arunachal Pradesh', '792': 'Assam',
  '793': 'Meghalaya', '794': 'Meghalaya',
  '795': 'Manipur',
  '796': 'Mizoram', '797': 'Nagaland', '798': 'Nagaland',
  '799': 'Tripura',

  // Sikkim, Ladakh
  '737': 'Sikkim',
  '194': 'Ladakh',

  // Andaman & Nicobar
  '744': 'Andaman & Nicobar',

  // Dadra & Nagar Haveli / Daman & Diu
  '396': 'Dadra & Nagar Haveli',

  // Lakshadweep
  '682': 'Lakshadweep',
};

// Resolve a 6-digit pincode to a state name
export function pincodeToState(pincode) {
  if (!pincode) return null;
  const p = String(pincode).replace(/\D/g, '').trim();
  if (p.length < 2) return null;

  // Try 3-digit match first (for Goa, NE states, etc.)
  const p3 = p.substring(0, 3);
  if (PINCODE_TO_STATE[p3]) return PINCODE_TO_STATE[p3];

  // Then 2-digit
  const p2 = p.substring(0, 2);
  if (PINCODE_TO_STATE[p2]) return PINCODE_TO_STATE[p2];

  return null;
}

// India State SVG Path Data (simplified boundaries for visualization)
// ViewBox: 0 0 500 550, focused on Indian subcontinent
export const INDIA_STATES_SVG = {
  'Jammu & Kashmir': {
    path: 'M168,30 L185,22 L210,18 L225,25 L235,40 L230,55 L218,62 L205,58 L195,65 L180,60 L170,50 L165,40 Z',
    cx: 200, cy: 42
  },
  'Ladakh': {
    path: 'M235,15 L260,10 L280,15 L285,30 L275,45 L260,48 L245,42 L235,40 L230,30 Z',
    cx: 258, cy: 28
  },
  'Himachal Pradesh': {
    path: 'M195,65 L218,62 L228,72 L225,85 L210,90 L198,85 L190,78 Z',
    cx: 210, cy: 76
  },
  'Punjab': {
    path: 'M170,70 L190,78 L198,85 L195,100 L180,105 L165,100 L160,88 L162,78 Z',
    cx: 178, cy: 90
  },
  'Chandigarh': {
    path: 'M192,88 L196,86 L198,90 L194,92 Z',
    cx: 195, cy: 89
  },
  'Uttarakhand': {
    path: 'M225,85 L248,78 L262,85 L258,100 L242,108 L228,105 L220,95 Z',
    cx: 240, cy: 94
  },
  'Haryana': {
    path: 'M165,100 L180,105 L195,100 L210,90 L220,95 L218,110 L205,118 L190,120 L178,115 L168,108 Z',
    cx: 192, cy: 108
  },
  'Delhi': {
    path: 'M193,112 L200,110 L204,115 L200,120 L194,118 Z',
    cx: 198, cy: 115
  },
  'Uttar Pradesh': {
    path: 'M205,118 L218,110 L242,108 L265,112 L290,120 L310,135 L318,155 L305,170 L285,178 L265,180 L248,175 L230,165 L218,155 L210,140 L200,130 Z',
    cx: 260, cy: 145
  },
  'Rajasthan': {
    path: 'M105,110 L130,105 L155,108 L168,108 L178,115 L190,120 L200,130 L210,140 L205,158 L195,172 L180,180 L158,185 L135,178 L115,168 L100,155 L95,138 L98,125 Z',
    cx: 152, cy: 145
  },
  'Gujarat': {
    path: 'M70,168 L95,160 L100,155 L115,168 L135,178 L140,195 L135,215 L125,230 L110,238 L95,240 L80,235 L68,225 L60,210 L55,195 L62,180 Z',
    cx: 98, cy: 200
  },
  'Madhya Pradesh': {
    path: 'M155,185 L180,180 L195,172 L205,158 L218,155 L230,165 L248,175 L265,180 L275,192 L270,210 L258,225 L240,230 L220,228 L200,220 L185,215 L170,205 L158,195 Z',
    cx: 218, cy: 200
  },
  'Bihar': {
    path: 'M310,135 L330,130 L350,128 L365,135 L370,148 L365,160 L350,165 L335,162 L318,155 Z',
    cx: 342, cy: 148
  },
  'Jharkhand': {
    path: 'M305,170 L318,155 L335,162 L350,165 L355,180 L348,195 L332,200 L315,195 L305,185 Z',
    cx: 330, cy: 180
  },
  'West Bengal': {
    path: 'M350,128 L370,120 L385,125 L392,140 L388,158 L382,175 L378,195 L375,215 L368,228 L358,232 L350,220 L345,205 L348,195 L355,180 L350,165 L365,160 L370,148 L365,135 Z',
    cx: 372, cy: 178
  },
  'Odisha': {
    path: 'M285,210 L305,200 L315,195 L332,200 L345,205 L350,220 L342,238 L325,248 L308,250 L292,245 L280,235 L278,220 Z',
    cx: 312, cy: 225
  },
  'Chhattisgarh': {
    path: 'M265,180 L285,178 L305,185 L315,195 L305,200 L285,210 L278,220 L268,218 L258,225 L270,210 L275,192 Z',
    cx: 285, cy: 200
  },
  'Maharashtra': {
    path: 'M100,235 L125,230 L135,215 L140,195 L155,185 L158,195 L170,205 L185,215 L200,220 L210,232 L205,250 L195,262 L178,270 L158,272 L138,268 L118,260 L105,250 Z',
    cx: 158, cy: 240
  },
  'Goa': {
    path: 'M125,272 L135,268 L140,275 L138,285 L130,288 L125,282 Z',
    cx: 132, cy: 278
  },
  'Telangana': {
    path: 'M200,250 L210,232 L220,228 L240,230 L258,225 L268,240 L265,258 L250,268 L232,270 L215,265 L205,258 Z',
    cx: 235, cy: 250
  },
  'Andhra Pradesh': {
    path: 'M178,270 L195,262 L205,258 L215,265 L232,270 L250,268 L265,258 L280,262 L295,270 L305,285 L310,305 L298,318 L282,325 L268,320 L252,312 L238,305 L225,295 L210,290 L195,282 L182,278 Z',
    cx: 252, cy: 290
  },
  'Karnataka': {
    path: 'M118,260 L138,268 L158,272 L178,270 L182,278 L195,282 L210,290 L205,310 L195,325 L180,335 L162,338 L145,332 L130,320 L120,305 L115,288 L112,275 Z',
    cx: 158, cy: 300
  },
  'Kerala': {
    path: 'M145,332 L162,338 L168,350 L165,368 L158,385 L150,398 L142,408 L135,400 L130,385 L128,368 L132,350 L138,340 Z',
    cx: 148, cy: 370
  },
  'Tamil Nadu': {
    path: 'M162,338 L180,335 L195,325 L205,310 L210,290 L225,295 L238,305 L250,318 L255,335 L248,355 L238,370 L225,382 L210,388 L195,392 L178,395 L165,398 L158,385 L165,368 L168,350 Z',
    cx: 210, cy: 355
  },
  'Assam': {
    path: 'M380,95 L400,88 L425,85 L445,90 L455,100 L448,112 L435,118 L420,115 L405,110 L395,105 L385,100 Z',
    cx: 420, cy: 100
  },
  'Meghalaya': {
    path: 'M395,115 L415,118 L430,122 L425,132 L410,135 L395,130 L390,122 Z',
    cx: 412, cy: 125
  },
  'Tripura': {
    path: 'M418,145 L428,140 L435,148 L432,160 L425,165 L418,158 Z',
    cx: 426, cy: 152
  },
  'Mizoram': {
    path: 'M400,142 L415,140 L418,155 L415,168 L408,172 L400,165 L398,155 Z',
    cx: 408, cy: 155
  },
  'Manipur': {
    path: 'M435,108 L448,105 L455,112 L452,125 L442,130 L435,122 Z',
    cx: 445, cy: 118
  },
  'Nagaland': {
    path: 'M445,90 L462,85 L470,95 L465,108 L455,112 L448,105 L445,95 Z',
    cx: 458, cy: 98
  },
  'Arunachal Pradesh': {
    path: 'M410,60 L435,52 L460,55 L478,65 L475,80 L462,85 L445,90 L425,85 L410,78 L405,68 Z',
    cx: 442, cy: 70
  },
  'Sikkim': {
    path: 'M355,102 L365,98 L372,105 L368,115 L360,118 L354,110 Z',
    cx: 362, cy: 108
  },
  'Andaman & Nicobar': {
    path: 'M420,320 L425,315 L428,325 L430,340 L428,355 L425,365 L420,370 L418,360 L416,345 L418,330 Z',
    cx: 424, cy: 345
  },
  'Lakshadweep': {
    path: 'M98,365 L105,360 L108,368 L105,375 L98,375 Z',
    cx: 103, cy: 368
  },
};

// Aggregate leads by state from pincodes and MIS state data
export function aggregateLeadsByState(leads) {
  const stateCounts = {};

  leads.forEach(lead => {
    let state = null;

    // Priority 1: MIS state data
    const misState = lead.mis_data?.state || lead.mis_data?.STATE;
    if (misState && String(misState).trim().length > 1) {
      state = normalizeStateName(String(misState).trim());
    }

    // Priority 2: Pincode mapping
    if (!state) {
      const pincode = lead.mis_data?.PIN_CODE || lead.mis_data?.pin_code || lead.pincode;
      if (pincode) {
        state = pincodeToState(pincode);
      }
    }

    if (state && state !== 'APO/FPO') {
      stateCounts[state] = (stateCounts[state] || 0) + 1;
    }
  });

  return stateCounts;
}

// Normalize common state name variations
function normalizeStateName(name) {
  const n = name.toLowerCase().trim();
  const map = {
    'andhra pradesh': 'Andhra Pradesh',
    'arunachal pradesh': 'Arunachal Pradesh',
    'assam': 'Assam',
    'bihar': 'Bihar',
    'chhattisgarh': 'Chhattisgarh',
    'chattisgarh': 'Chhattisgarh',
    'goa': 'Goa',
    'gujarat': 'Gujarat',
    'haryana': 'Haryana',
    'himachal pradesh': 'Himachal Pradesh',
    'jharkhand': 'Jharkhand',
    'karnataka': 'Karnataka',
    'kerala': 'Kerala',
    'madhya pradesh': 'Madhya Pradesh',
    'maharashtra': 'Maharashtra',
    'manipur': 'Manipur',
    'meghalaya': 'Meghalaya',
    'mizoram': 'Mizoram',
    'nagaland': 'Nagaland',
    'odisha': 'Odisha',
    'orissa': 'Odisha',
    'punjab': 'Punjab',
    'rajasthan': 'Rajasthan',
    'sikkim': 'Sikkim',
    'tamil nadu': 'Tamil Nadu',
    'tamilnadu': 'Tamil Nadu',
    'telangana': 'Telangana',
    'tripura': 'Tripura',
    'uttar pradesh': 'Uttar Pradesh',
    'uttarakhand': 'Uttarakhand',
    'uttaranchal': 'Uttarakhand',
    'west bengal': 'West Bengal',
    'delhi': 'Delhi',
    'new delhi': 'Delhi',
    'jammu & kashmir': 'Jammu & Kashmir',
    'jammu and kashmir': 'Jammu & Kashmir',
    'j&k': 'Jammu & Kashmir',
    'ladakh': 'Ladakh',
    'chandigarh': 'Chandigarh',
    'puducherry': 'Tamil Nadu',
    'pondicherry': 'Tamil Nadu',
    'andaman & nicobar': 'Andaman & Nicobar',
    'andaman and nicobar': 'Andaman & Nicobar',
    'lakshadweep': 'Lakshadweep',
    'dadra & nagar haveli': 'Gujarat',
    'dadra and nagar haveli': 'Gujarat',
    'daman & diu': 'Gujarat',
    'daman and diu': 'Gujarat',
  };

  // Exact match
  if (map[n]) return map[n];

  // Partial match
  for (const [key, val] of Object.entries(map)) {
    if (n.includes(key) || key.includes(n)) return val;
  }

  // Return cleaned original
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// Color gradient for heatmap intensity — uses gold theme (#E0A82E)
export function getHeatColor(value, maxValue) {
  if (!value || !maxValue) return 'rgba(224, 168, 46, 0.04)';
  const intensity = Math.min(value / maxValue, 1);

  if (intensity === 0) return 'rgba(224, 168, 46, 0.04)';
  if (intensity < 0.15) return 'rgba(224, 168, 46, 0.12)';
  if (intensity < 0.3) return 'rgba(224, 168, 46, 0.22)';
  if (intensity < 0.45) return 'rgba(224, 168, 46, 0.38)';
  if (intensity < 0.6) return 'rgba(224, 168, 46, 0.52)';
  if (intensity < 0.75) return 'rgba(224, 168, 46, 0.68)';
  if (intensity < 0.9) return 'rgba(198, 138, 18, 0.82)';
  return 'rgba(198, 138, 18, 0.92)';
}
