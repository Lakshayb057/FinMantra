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
}

/**
 * Resolves redirect URLs that use the custom 'intent://' scheme
 * for non-Android platforms by extracting the browser fallback URL.
 */
export function resolveRedirectUrl(url) {
  if (url && String(url).startsWith('intent://')) {
    const isAndroid = /Android/i.test(navigator.userAgent || '');
    if (!isAndroid) {
      const match = String(url).match(/S\.browser_fallback_url=([^;]+)/);
      if (match && match[1]) {
        try {
          const decoded = decodeURIComponent(match[1]);
          console.log('[Intent Resolver] Non-Android environment detected. Falling back to:', decoded);
          return decoded;
        } catch (e) {
          console.error('[Intent Resolver] Failed to decode fallback URL:', e);
        }
      }
    }
  }
  return url;
}
