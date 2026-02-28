/**
 * Typed references to all DOM elements used by the application.
 * Centralising element lookups prevents scattered `querySelector` calls
 * and makes refactoring safer.
 */

function requireElement<T extends HTMLElement>(selector: string): T {
    const el = document.querySelector<T>(selector);
    if (!el) throw new Error(`Required DOM element not found: "${selector}"`);
    return el;
}

export const AppElements = {
    fileInput: requireElement<HTMLInputElement>('#file-input'),
    fileDropZone: requireElement<HTMLDivElement>('#file-area'),
    fileDropZoneContent: requireElement<HTMLDivElement>('#file-area-content'),
    dragOverlay: requireElement<HTMLDivElement>('#drag-overlay'),

    convertButton: requireElement<HTMLButtonElement>('#convert-button'),
    convertButtonLabel: requireElement<HTMLSpanElement>('#convert-button-label'),
    modeToggleButton: requireElement<HTMLButtonElement>('#mode-button'),
    themeToggleButton: requireElement<HTMLButtonElement>('#theme-button'),
    inputPanel: requireElement<HTMLDivElement>('#from-container'),
    outputPanel: requireElement<HTMLDivElement>('#to-container'),

    inputFormatList: requireElement<HTMLDivElement>('#from-list'),
    outputFormatList: requireElement<HTMLDivElement>('#to-list'),
    inputSearchBox: requireElement<HTMLInputElement>('#search-from'),
    outputSearchBox: requireElement<HTMLInputElement>('#search-to'),
    smartSuggestions: requireElement<HTMLDivElement>('#smart-suggestions'),
    inputFormatCount: requireElement<HTMLSpanElement>('#from-count'),
    outputFormatCount: requireElement<HTMLSpanElement>('#to-count'),

    convertInfoText: requireElement<HTMLParagraphElement>('#convert-info-text'),

    popupOverlay: requireElement<HTMLDivElement>('#popup-bg'),
    popupBox: requireElement<HTMLDivElement>('#popup'),
    toastContainer: requireElement<HTMLDivElement>('#toast-container'),
} as const;

export type AppElementsType = typeof AppElements;
