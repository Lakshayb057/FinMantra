/**
 * Analytics Utility for Meta Pixel and Google Tag Manager (GTM)
 */

let dynamicPixelId = '1015546961540665';

export function initAnalytics(settings = {}) {
  if (typeof window === 'undefined') return;

  window.FINMANTRA_SETTINGS = settings;
  if (settings.meta_pixel_id) {
    dynamicPixelId = settings.meta_pixel_id;
  }

  // Inject or update GTM if container ID is provided in settings
  const gtmId = settings.gtm_container_id || settings.gtm_id;
  if (gtmId && !document.getElementById('gtm-dynamic-script')) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({'gtm.start': new Date().getTime(), event: 'gtm.js'});
      const f = document.getElementsByTagName('script')[0];
      const j = document.createElement('script');
      j.id = 'gtm-dynamic-script';
      j.async = true;
      j.src = 'https://www.googletagmanager.com/gtm.js?id=' + gtmId;
      if (f && f.parentNode) {
        f.parentNode.insertBefore(j, f);
      } else {
        document.head.appendChild(j);
      }
      console.log(`[GTM] Dynamic script injected with Container ID: ${gtmId}`);
    } catch (err) {
      console.error('[GTM] Failed to inject container script:', err);
    }
  }
  // Inject Microsoft Clarity if Project ID is provided in settings
  const clarityId = settings.clarity_project_id;
  if (clarityId && !document.getElementById('clarity-dynamic-script')) {
    try {
      window.clarity = window.clarity || function() {
        (window.clarity.q = window.clarity.q || []).push(arguments);
      };
      const f = document.getElementsByTagName('script')[0];
      const j = document.createElement('script');
      j.id = 'clarity-dynamic-script';
      j.async = true;
      j.src = 'https://www.clarity.ms/tag/' + clarityId;
      if (f && f.parentNode) {
        f.parentNode.insertBefore(j, f);
      } else {
        document.head.appendChild(j);
      }
      console.log(`[Clarity] Dynamic script injected with Project ID: ${clarityId}`);
    } catch (err) {
      console.error('[Clarity] Failed to inject container script:', err);
    }
  }

  // Inject LinkedIn Insight Tag if Partner ID is provided in settings (or default 9660484)
  const linkedinPartnerId = settings.linkedin_partner_id || settings.linkedin_tag_id || '9660484';
  if (linkedinPartnerId && !document.getElementById('linkedin-insight-script')) {
    try {
      window._linkedin_partner_id = linkedinPartnerId;
      window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
      if (!window._linkedin_data_partner_ids.includes(linkedinPartnerId)) {
        window._linkedin_data_partner_ids.push(linkedinPartnerId);
      }

      if (!window.lintrk) {
        window.lintrk = function(a, b) {
          window.lintrk.q = window.lintrk.q || [];
          window.lintrk.q.push([a, b]);
        };
        window.lintrk.q = [];
      }

      const f = document.getElementsByTagName('script')[0];
      const b = document.createElement('script');
      b.id = 'linkedin-insight-script';
      b.type = 'text/javascript';
      b.async = true;
      b.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
      if (f && f.parentNode) {
        f.parentNode.insertBefore(b, f);
      } else {
        document.head.appendChild(b);
      }

      // Fallback noscript image for non-JS environments
      if (!document.getElementById('linkedin-noscript-img')) {
        const ns = document.createElement('noscript');
        const img = document.createElement('img');
        img.id = 'linkedin-noscript-img';
        img.height = '1';
        img.width = '1';
        img.style.display = 'none';
        img.alt = '';
        img.src = `https://px.ads.linkedin.com/collect/?pid=${encodeURIComponent(linkedinPartnerId)}&fmt=gif`;
        ns.appendChild(img);
        document.body.appendChild(ns);
      }

      console.log(`[LinkedIn Insight Tag] Dynamic script & NoScript injected with Partner ID: ${linkedinPartnerId}`);
    } catch (err) {
      console.error('[LinkedIn Insight Tag] Failed to inject tracking script:', err);
    }
  }
}

export function trackLeadSubmission({ fullName, email, phone, eventId = null, contentName = 'Lead Submitted', status = 'submitted' }) {
  if (typeof window === 'undefined') return;

  const activePixelId = window.FINMANTRA_SETTINGS?.meta_pixel_id || dynamicPixelId;

  // Split full name into first and last name for Meta Advanced Matching
  const trimmedName = (fullName || '').trim();
  const nameParts = trimmedName.split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Clean phone and email
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const cleanEmail = (email || '').trim().toLowerCase();

  console.log(`[Analytics] Triggering Lead Event for: ${firstName} ${lastName} (${cleanPhone})`);

  // 1. Meta Pixel (fbq) - Advanced Matching & Lead Event
  if (typeof window.fbq === 'function') {
    try {
      // Advanced Matching Initialization
      window.fbq('init', activePixelId, {
        fn: firstName,
        ln: lastName,
        em: cleanEmail,
        ph: cleanPhone
      });

      // Track Lead Event
      const pixelParams = {
        content_name: contentName,
        status: status
      };
      
      const pixelOptions = eventId ? { eventID: String(eventId) } : {};
      window.fbq('track', 'Lead', pixelParams, pixelOptions);
      console.log('[Meta Pixel] Fired "Lead" event successfully.', pixelParams);
    } catch (err) {
      console.error('[Meta Pixel] Error tracking event:', err);
    }
  } else {
    console.warn('[Meta Pixel] window.fbq not found on window object.');
  }

  // 2. Google Tag Manager (GTM) - dataLayer Push
  try {
    window.dataLayer = window.dataLayer || [];
    const gtmPayload = {
      event: 'lead_submitted',
      content_name: contentName,
      status: status,
      user_data: {
        first_name: firstName,
        last_name: lastName,
        email: cleanEmail,
        phone: cleanPhone
      }
    };
    if (eventId) {
      gtmPayload.event_id = String(eventId);
    }
    window.dataLayer.push(gtmPayload);
    console.log('[GTM dataLayer] Pushed "lead_submitted" event successfully.', gtmPayload);
  } catch (err) {
    console.error('[GTM dataLayer] Error pushing event:', err);
  }

  // 3. LinkedIn Conversion Tracking (lintrk)
  if (typeof window.lintrk === 'function') {
    try {
      window.lintrk('track', { conversion_id: eventId || Date.now() });
      console.log('[LinkedIn Insight Tag] Tracked lead conversion event successfully.');
    } catch (err) {
      console.error('[LinkedIn Insight Tag] Error tracking conversion:', err);
    }
  }
}

/**
 * Resolves redirect URLs that use the custom Android 'intent://' scheme
 * by extracting the browser fallback URL (S.browser_fallback_url).
 * 
 * Web browsers cannot handle intent:// via JavaScript window.location —
 * on real Android, Chrome handles intent links at the OS/navigation layer
 * before JS runs. So in our JS code, we ALWAYS extract the HTTPS fallback.
 */
export function resolveRedirectUrl(url) {
  if (url && String(url).startsWith('intent://')) {
    const match = String(url).match(/S\.browser_fallback_url=([^;]+)/);
    if (match && match[1]) {
      try {
        const decoded = decodeURIComponent(match[1]);
        console.log('[Intent Resolver] Resolved intent:// to HTTPS fallback:', decoded);
        return decoded;
      } catch (e) {
        console.error('[Intent Resolver] Failed to decode fallback URL:', e);
      }
    }
  }
  return url;
}
