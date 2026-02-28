import { showToast } from './ui/toast.ts';

type TrackFn = (eventName: string, params?: Record<string, string | number | boolean>) => void;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function initPwa(trackEvent?: TrackFn): void {
  if (!('serviceWorker' in navigator)) return;

  const installButton = document.getElementById('install-app-button') as HTMLButtonElement | null;
  const installButtonLabel = installButton?.querySelector('.mode-label') as HTMLSpanElement | null;
  const isIOS = detectIOS();
  const isSafari = detectSafari();
  const inStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari standalone mode support.
    (typeof (window.navigator as Navigator & { standalone?: boolean }).standalone === 'boolean' &&
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));

  if (installButtonLabel) {
    if (isIOS && isSafari) installButtonLabel.textContent = 'Add to Home';
    if (isIOS && !isSafari) installButtonLabel.textContent = 'Use Safari';
  }

  if (inStandalone && installButton) {
    installButton.hidden = true;
  } else if (installButton && isIOS) {
    // iOS does not fire beforeinstallprompt; expose manual install guidance.
    installButton.hidden = false;
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    if (installButton && !inStandalone) installButton.hidden = false;
    trackEvent?.('pwa_install_prompt_ready');
  });

  if (installButton) {
    installButton.addEventListener('click', async () => {
      if (!deferredPrompt) {
        if (isIOS) {
          if (isSafari) {
            showToast('Safari: tap Share, then Add to Home Screen.', 'info', 5200);
            trackEvent?.('pwa_ios_install_hint_shown', { browser: 'safari' });
            return;
          }
          showToast('On iPhone, install works in Safari. Open this page in Safari, then Share -> Add to Home Screen.', 'info', 6200);
          trackEvent?.('pwa_ios_install_hint_shown', { browser: 'non_safari' });
          return;
        }

        showToast('Install prompt is not available on this device/browser yet.', 'info', 2800);
        return;
      }

      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      trackEvent?.('pwa_install_prompt_choice', {
        outcome: choice.outcome,
      });

      if (choice.outcome === 'accepted') {
        showToast('Transformo is being installed.', 'success', 2600);
        installButton.hidden = true;
      }

      deferredPrompt = null;
    });
  }

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (installButton) installButton.hidden = true;
    showToast('Transformo installed. You can launch it like a native app.', 'success', 3200);
    trackEvent?.('pwa_installed');
  });

  window.addEventListener('offline', () => {
    showToast('You are offline. Cached routes will still work.', 'info', 2600);
  });

  window.addEventListener('online', () => {
    showToast('Back online. Full conversion routes are available.', 'success', 2400);
  });

  if (!import.meta.env.PROD) return;

  const swUrl = `${import.meta.env.BASE_URL}sw.js`;
  navigator.serviceWorker
    .register(swUrl, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    })
    .then(() => {
      trackEvent?.('pwa_service_worker_registered');
    })
    .catch(error => {
      console.warn('Service worker registration failed:', error);
      trackEvent?.('pwa_service_worker_registration_failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    });
}

function detectIOS(): boolean {
  const ua = window.navigator.userAgent;
  const platform = window.navigator.platform;
  return /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

function detectSafari(): boolean {
  const ua = window.navigator.userAgent;
  const isSafariLike = /Safari/i.test(ua);
  const isOtherIOSBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo/i.test(ua);
  return isSafariLike && !isOtherIOSBrowser;
}
