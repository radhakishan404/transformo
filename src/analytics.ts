type AnalyticsPrimitive = string | number | boolean;
type AnalyticsParams = Record<string, AnalyticsPrimitive | null | undefined>;

let analyticsEnabled = false;
const measurementId = (import.meta.env.VITE_GA_MEASUREMENT_ID ?? '').trim();

function safeParamValue(value: AnalyticsPrimitive | null | undefined): AnalyticsPrimitive | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value.slice(0, 100);
  return value;
}

export function initAnalytics(): void {
  if (!measurementId || analyticsEnabled) return;

  if (!window.dataLayer) window.dataLayer = [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag(...args: unknown[]): void {
      window.dataLayer?.push(args);
    };
  }

  const existing = document.getElementById('transformo-ga4');
  if (!existing) {
    const script = document.createElement('script');
    script.id = 'transformo-ga4';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
  }

  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    send_page_view: true,
    anonymize_ip: true,
  });

  analyticsEnabled = true;
}

export function trackEvent(eventName: string, params: AnalyticsParams = {}): void {
  if (!analyticsEnabled || typeof window.gtag !== 'function') return;

  const normalizedParams: Record<string, AnalyticsPrimitive> = {};
  for (const [key, value] of Object.entries(params)) {
    const normalized = safeParamValue(value);
    if (normalized !== undefined) normalizedParams[key] = normalized;
  }

  window.gtag('event', eventName, normalizedParams);
}

