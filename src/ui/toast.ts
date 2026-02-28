/**
 * Toast notification system.
 * Renders ephemeral status messages in the bottom-right corner of the screen.
 */

import { AppElements } from './elements.ts';

export type ToastVariant = 'success' | 'error' | 'info';

const TOAST_DURATION_MS = 4000;
const TOAST_FADE_MS = 300;

/**
 * Displays a brief toast notification.
 *
 * @param message - Text content of the toast.
 * @param variant - Visual style: 'success' | 'error' | 'info'.
 * @param durationMs - How long the toast is visible before fading.
 */
export function showToast(
    message: string,
    variant: ToastVariant = 'info',
    durationMs: number = TOAST_DURATION_MS,
): void {
    const toast = document.createElement('div');
    toast.className = `toast toast--${variant}`;
    toast.setAttribute('role', 'alert');
    toast.textContent = message;

    AppElements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = `opacity ${TOAST_FADE_MS}ms ease`;
        setTimeout(() => toast.remove(), TOAST_FADE_MS);
    }, durationMs);
}
