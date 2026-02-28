export interface MonetizationSettings {
  readonly donatePrimaryUrl: string;
  readonly donateSecondaryUrl: string;
  readonly feedbackUrl: string;
  readonly adsenseClientId: string;
  readonly adsenseSlotId: string;
  readonly donationEnabled: boolean;
  readonly adsEnabled: boolean;
}

const settings: MonetizationSettings = (() => {
  const donatePrimaryUrl = (import.meta.env.VITE_DONATE_URL ?? '').trim();
  const donateSecondaryUrl = (import.meta.env.VITE_DONATE_SECONDARY_URL ?? '').trim();
  const feedbackUrl = (import.meta.env.VITE_FEEDBACK_URL ?? '').trim();
  const adsenseClientId = (import.meta.env.VITE_ADSENSE_CLIENT_ID ?? '').trim();
  const adsenseSlotId = (import.meta.env.VITE_ADSENSE_SLOT_ID ?? '').trim();

  return {
    donatePrimaryUrl,
    donateSecondaryUrl,
    feedbackUrl,
    adsenseClientId,
    adsenseSlotId,
    donationEnabled: Boolean(donatePrimaryUrl || donateSecondaryUrl),
    adsEnabled: Boolean(adsenseClientId && adsenseSlotId),
  };
})();

export function getMonetizationSettings(): MonetizationSettings {
  return settings;
}

function ensureAdsenseScript(clientId: string): Promise<void> {
  const existing = document.getElementById('transformo-adsense') as HTMLScriptElement | null;
  if (existing) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'transformo-adsense';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google AdSense script'));
    document.head.appendChild(script);
  });
}

export async function setupAdsenseSlot(): Promise<void> {
  if (!settings.adsEnabled) return;

  const container = document.getElementById('ad-slot-container');
  const fallback = document.getElementById('ad-slot-fallback');
  const ins = document.getElementById('adsbygoogle-slot') as HTMLElement | null;
  if (!container || !ins) return;

  container.hidden = false;
  if (fallback) fallback.hidden = true;

  ins.setAttribute('data-ad-client', settings.adsenseClientId);
  ins.setAttribute('data-ad-slot', settings.adsenseSlotId);
  ins.setAttribute('data-ad-format', 'auto');
  ins.setAttribute('data-full-width-responsive', 'true');

  try {
    await ensureAdsenseScript(settings.adsenseClientId);
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.push({});
  } catch {
    container.hidden = true;
    if (fallback) fallback.hidden = false;
  }
}
