/**
 * Modal popup system.
 * Manages a single, reusable overlay dialog used for conversion progress
 * and result display.
 */

import { AppElements } from './elements.ts';

interface SuccessPopupActions {
    readonly onDismiss: () => void;
    readonly onFeedback?: () => void;
}

/** Renders HTML into the popup and makes it visible. */
export function showPopup(html: string): void {
    const inner = AppElements.popupBox.querySelector('.popup-inner');
    if (inner) inner.innerHTML = html;
    AppElements.popupBox.style.display = 'block';
    AppElements.popupBox.setAttribute('aria-hidden', 'false');
    AppElements.popupOverlay.style.display = 'block';
    AppElements.popupOverlay.setAttribute('aria-hidden', 'false');
}

/** Hides the popup and overlay. */
export function hidePopup(): void {
    AppElements.popupBox.style.display = 'none';
    AppElements.popupBox.setAttribute('aria-hidden', 'true');
    AppElements.popupOverlay.style.display = 'none';
    AppElements.popupOverlay.setAttribute('aria-hidden', 'true');
}

/** Renders the spinning "in progress" popup. */
export function showProgressPopup(title: string, subtitle?: string, progressRatio?: number): void {
    const clampedProgress = typeof progressRatio === 'number'
        ? Math.max(0, Math.min(100, progressRatio * 100))
        : null;
    showPopup(`
    <div class="popup-status-badge">Preparing</div>
    ${spinnerSvg('prepare')}
    <h2>${escapeHtml(title)}</h2>
    ${subtitle ? `<p class="popup-sub">${escapeHtml(subtitle)}</p>` : ''}
    <div class="popup-progress">
      <div class="popup-progress__track">
        <span class="popup-progress__bar ${clampedProgress === null ? 'popup-progress__bar--indeterminate' : ''}"
              ${clampedProgress !== null ? `style="width:${clampedProgress.toFixed(2)}%"` : ''}></span>
      </div>
    </div>
  `);
}

/** Renders the route-search popup with path chips. */
export function showRouteSearchPopup(pathLabels: string[], subtitle: string = 'Exploring valid conversion chains…'): void {
    showPopup(`
    <div class="popup-status-badge">Route Discovery</div>
    ${spinnerSvg('search')}
    <h2>Finding conversion route…</h2>
    <p class="popup-sub">${escapeHtml(subtitle)}</p>
    <div class="route-path route-path--scan">${routeChips(pathLabels, -1)}</div>
    <div class="popup-progress">
      <div class="popup-progress__track">
        <span class="popup-progress__bar popup-progress__bar--indeterminate"></span>
      </div>
    </div>
  `);
}

/** Renders step-by-step progress while a specific path is being executed. */
export function showConversionStepPopup(
    pathLabels: string[],
    stepIndex: number,
    totalSteps: number,
    handlerName: string,
): void {
    const from = pathLabels[stepIndex] ?? '';
    const to = pathLabels[stepIndex + 1] ?? '';
    const safeTotal = Math.max(1, totalSteps);
    const ratio = Math.max(0, Math.min(1, (stepIndex + 1) / safeTotal));

    showPopup(`
    <div class="popup-status-badge">Converting</div>
    ${spinnerSvg('convert')}
    <h2>Step ${stepIndex + 1} of ${safeTotal}</h2>
    <p class="popup-sub">${escapeHtml(from)} → ${escapeHtml(to)} · ${escapeHtml(handlerName)}</p>
    <div class="route-path">${routeChips(pathLabels, stepIndex + 1)}</div>
    <div class="popup-progress">
      <div class="popup-progress__track">
        <span class="popup-progress__bar" style="width:${(ratio * 100).toFixed(2)}%"></span>
      </div>
    </div>
  `);
}

/** Renders the success popup after a completed conversion. */
export function showSuccessPopup(
    fromLabel: string,
    toLabel: string,
    pathLabels: string[],
    actions: SuccessPopupActions,
): void {
    const stepCount = Math.max(0, pathLabels.length - 1);
    const hasFeedback = Boolean(actions.onFeedback);

    showPopup(`
    <div class="popup-success-glow" aria-hidden="true"></div>
    <div class="popup-icon popup-icon--success">✓</div>
    <h2 class="popup-title-success">Conversion complete</h2>
    <p class="popup-sub">${escapeHtml(fromLabel)} → ${escapeHtml(toLabel)}</p>
    <div class="popup-summary popup-summary--success">
      <span class="popup-summary__chip popup-summary__chip--ok">${stepCount} step${stepCount === 1 ? '' : 's'}</span>
      <span class="popup-summary__chip popup-summary__chip--ok">Downloaded</span>
    </div>
    <div class="route-path">${routeChips(pathLabels)}</div>
    ${hasFeedback ? `
      <section class="popup-support" aria-label="Support Transformo">
        <p class="popup-support__title">Have ideas to improve Transformo?</p>
        <p class="popup-support__sub">Share your feedback and help shape the next version.</p>
        <div class="popup-support__actions">
          ${actions.onFeedback ? '<button id="popup-feedback-btn" class="popup-cta popup-cta--ghost">Send feedback</button>' : ''}
        </div>
      </section>
    ` : ''}
    <button id="popup-dismiss-btn" class="popup-cta popup-cta--primary">Done</button>
    `);
    document.getElementById('popup-dismiss-btn')?.addEventListener('click', actions.onDismiss);
    if (actions.onFeedback) {
        document.getElementById('popup-feedback-btn')?.addEventListener('click', actions.onFeedback);
    }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function spinnerSvg(variant: 'prepare' | 'search' | 'convert'): string {
    const variantClass = `popup-spinner--${variant}`;
    return `
    <div class="popup-spinner ${variantClass}">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <circle cx="20" cy="20" r="17" stroke="rgba(255,255,255,0.1)" stroke-width="3"/>
        <path d="M20 3a17 17 0 0117 17" stroke="url(#spinGrad)" stroke-width="3" stroke-linecap="round"/>
        <defs>
          <linearGradient id="spinGrad" x1="3" y1="20" x2="37" y2="20" gradientUnits="userSpaceOnUse">
            <stop stop-color="#7C3AED"/><stop offset="1" stop-color="#3B82F6"/>
          </linearGradient>
        </defs>
      </svg>
    </div>`;
}

function routeChips(labels: string[], activeIndex: number = -1): string {
    return labels.map((label, i) =>
        i === 0
            ? `<span class="route-step ${i === activeIndex ? 'route-step--active' : ''}">${escapeHtml(label)}</span>`
            : `<span class="route-arrow" aria-hidden="true">→</span><span class="route-step ${i === activeIndex ? 'route-step--active' : ''}">${escapeHtml(label)}</span>`
    ).join('');
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
