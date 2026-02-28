/**
 * Format list UI module.
 * Handles rendering, searching, and selection state for the
 * "Convert from" and "Convert to" format panels.
 */

import type { FileFormat, FormatHandler } from '../FormatHandler.ts';
import { AppElements } from './elements.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormatOption {
    readonly format: FileFormat;
    readonly handler: FormatHandler;
}

export type PanelSide = 'input' | 'output';

interface PanelRefs {
    list: HTMLDivElement;
    search: HTMLInputElement;
    count: HTMLSpanElement;
}

export interface PanelOptionRef {
    readonly button: HTMLButtonElement;
    readonly option: FormatOption;
    readonly index: number;
}

// ─── Module state ─────────────────────────────────────────────────────────────

/** Flat array of all resolved format options, indexed by button `data-option-index`. */
export const allFormatOptions: FormatOption[] = [];

let onSelectionChange: (() => void) | null = null;

/** Registers a callback invoked whenever the selection state changes. */
export function onFormatSelectionChange(callback: () => void): void {
    onSelectionChange = callback;
}

// ─── Querying selection ───────────────────────────────────────────────────────

/** Returns the currently selected input format option, or `null`. */
export function getSelectedInputOption(): FormatOption | null {
    return getSelectedOption(AppElements.inputFormatList);
}

/** Returns the currently selected output format option, or `null`. */
export function getSelectedOutputOption(): FormatOption | null {
    return getSelectedOption(AppElements.outputFormatList);
}

/** Returns the selected option index for a panel, or `null` when none is selected. */
export function getSelectedOptionIndex(side: PanelSide): number | null {
    const selected = getPanelRefs(side).list.querySelector<HTMLButtonElement>('.format-btn--selected');
    if (!selected) return null;
    const idx = Number(selected.dataset.optionIndex);
    return Number.isFinite(idx) ? idx : null;
}

function getSelectedOption(list: HTMLDivElement): FormatOption | null {
    const btn = list.querySelector<HTMLButtonElement>('.format-btn--selected');
    if (!btn) return null;
    const idx = Number(btn.dataset.optionIndex);
    return allFormatOptions[idx] ?? null;
}

// ─── Rendering ────────────────────────────────────────────────────────────────

/**
 * Populates both format lists from the current `allFormatOptions` array.
 * Clears any existing content first.
 *
 * @param simpleMode - When true, de-duplicates formats by MIME type.
 */
export function renderFormatLists(simpleMode: boolean): void {
    allFormatOptions.length = 0;
    AppElements.inputFormatList.innerHTML = '';
    AppElements.outputFormatList.innerHTML = '';

    // Render skeletons while formats load
    renderSkeletons(AppElements.inputFormatList, 8);
    renderSkeletons(AppElements.outputFormatList, 8);
}

/**
 * Appends skeleton placeholder buttons to a list while real data loads.
 */
function renderSkeletons(list: HTMLDivElement, count: number): void {
    for (let i = 0; i < count; i++) {
        const sk = document.createElement('div');
        sk.className = 'skeleton';
        list.appendChild(sk);
    }
}

/**
 * Appends a single `FormatOption` to the relevant panel(s) and registers it
 * in `allFormatOptions`.
 *
 * @param option - The format/handler pair to register.
 * @param simpleMode - If true, only one entry per unique MIME is rendered.
 * @returns Whether at least one button was added.
 */
export function addFormatOption(option: FormatOption, simpleMode: boolean): boolean {
    const { format } = option;
    if (!format.mime) return false;

    const optionIndex = allFormatOptions.length;
    allFormatOptions.push(option);

    let added = false;

    const addToInput = format.from && !isDuplicateInList(AppElements.inputFormatList, format, simpleMode);
    const addToOutput = format.to && !isDuplicateInList(AppElements.outputFormatList, format, simpleMode);

    if (!addToInput && !addToOutput) return false;

    const label = buildFormatLabel(option, simpleMode);

    if (addToInput) {
        AppElements.inputFormatList.appendChild(
            createFormatButton(label, format, optionIndex, 'input'),
        );
        added = true;
    }
    if (addToOutput) {
        AppElements.outputFormatList.appendChild(
            createFormatButton(label, format, optionIndex, 'output'),
        );
        added = true;
    }
    return added;
}

/** Updates both count badges and applies any active search filters. */
export function refreshListCounts(): void {
    const fromVisible = filterList(AppElements.inputFormatList, AppElements.inputSearchBox.value);
    const toVisible = filterList(AppElements.outputFormatList, AppElements.outputSearchBox.value);
    updateCount(AppElements.inputFormatCount, fromVisible);
    updateCount(AppElements.outputFormatCount, toVisible);
}

// ─── Searching ────────────────────────────────────────────────────────────────

/** Handles input events on a search box by filtering its sibling format list. */
export function handleSearchInput(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;

    // Walk up: input → .search-wrapper → .format-container → .format-list
    const list = input.closest('.format-container')?.querySelector<HTMLDivElement>('.format-list');
    const countEl = input.closest('.format-container')?.querySelector<HTMLSpanElement>('.panel-count');
    if (!list || !countEl) return;

    const visible = filterList(list, input.value);
    updateCount(countEl, visible);
}

/**
 * Hides buttons whose text/extension does not match `query`.
 * @returns Number of visible buttons after filtering.
 */
export function filterList(list: HTMLDivElement, query: string): number {
    const normalised = query.toLowerCase().trim();
    let visible = 0;

    for (const child of list.children) {
        if (!(child instanceof HTMLButtonElement)) continue;

        const idx = Number(child.dataset.optionIndex);
        const option = allFormatOptions[idx];
        const matches =
            !normalised ||
            child.textContent?.toLowerCase().includes(normalised) ||
            option?.format.extension.toLowerCase().includes(normalised);

        child.style.display = matches ? '' : 'none';
        if (matches) visible++;
    }
    return visible;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function createFormatButton(
    label: string,
    format: FileFormat,
    optionIndex: number,
    side: PanelSide,
): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'format-btn format-btn--enter';
    btn.dataset.optionIndex = String(optionIndex);
    btn.dataset.mimeType = format.mime;
    btn.dataset.side = side;
    btn.style.setProperty('--enter-index', String(optionIndex % 18));
    btn.title = format.mime;
    btn.textContent = label;
    btn.addEventListener('click', handleFormatButtonClick);
    window.setTimeout(() => btn.classList.remove('format-btn--enter'), 520);
    return btn;
}

function handleFormatButtonClick(event: Event): void {
    const clicked = event.currentTarget;
    if (!(clicked instanceof HTMLButtonElement)) return;

    const list = clicked.parentElement;
    if (!list) return;

    applySelection(list, clicked);
}

function buildFormatLabel(option: FormatOption, simpleMode: boolean): string {
    const { format, handler } = option;
    const tag = format.format.toUpperCase();

    if (simpleMode) {
        // Strip parenthesised handler annotations from the name
        const cleanName = format.name
            .replace(/\([^)]*\)/g, '')
            .trim();
        return `${tag} — ${cleanName}`;
    }
    return `${tag} — ${format.name} [${handler.name}]`;
}

function isDuplicateInList(
    list: HTMLDivElement,
    format: FileFormat,
    simpleMode: boolean,
): boolean {
    if (!simpleMode) return false;
    return Array.from(list.querySelectorAll<HTMLButtonElement>('.format-btn')).some(btn => {
        const idx = Number(btn.dataset.optionIndex);
        const existing = allFormatOptions[idx]?.format;
        return existing?.mime === format.mime && existing?.format === format.format;
    });
}

function updateCount(el: HTMLSpanElement, count: number): void {
    el.textContent = `${count} format${count !== 1 ? 's' : ''}`;
}

/** Returns all rendered options for a panel with their backing model references. */
export function listPanelOptions(side: PanelSide): PanelOptionRef[] {
    const { list } = getPanelRefs(side);
    return Array.from(list.querySelectorAll<HTMLButtonElement>('.format-btn'))
        .map(button => {
            const index = Number(button.dataset.optionIndex);
            const option = allFormatOptions[index];
            return option ? { button, option, index } : null;
        })
        .filter((entry): entry is PanelOptionRef => entry !== null);
}

/** Programmatically selects a panel option by index. */
export function setSelectedPanelOption(side: PanelSide, optionIndex: number): boolean {
    const list = getPanelRefs(side).list;
    const button = list.querySelector<HTMLButtonElement>(`.format-btn[data-option-index="${optionIndex}"]`);
    if (!button) return false;
    applySelection(list, button);
    return true;
}

/** Removes suggestion markers from output options. */
export function clearSuggestedOutputOptions(): void {
    for (const button of AppElements.outputFormatList.querySelectorAll<HTMLButtonElement>('.format-btn--suggested')) {
        button.classList.remove('format-btn--suggested');
        delete button.dataset.suggestedRank;
        delete button.dataset.suggestionLabel;
    }
}

/** Marks specific output options as suggested (ordered by confidence). */
export function markSuggestedOutputOptions(optionIndices: number[]): void {
    clearSuggestedOutputOptions();
    optionIndices.slice(0, 3).forEach((idx, order) => {
        const button = AppElements.outputFormatList.querySelector<HTMLButtonElement>(`.format-btn[data-option-index="${idx}"]`);
        if (!button) return;
        button.classList.add('format-btn--suggested');
        button.dataset.suggestedRank = String(order + 1);
        button.dataset.suggestionLabel = order === 0 ? 'Recommended' : 'Suggested';
    });
}

function applySelection(list: Element, target: HTMLButtonElement): void {
    list.querySelector('.format-btn--selected')?.classList.remove('format-btn--selected');
    target.classList.add('format-btn--selected');
    onSelectionChange?.();
}

// ─── Exported panel refs helper ───────────────────────────────────────────────

export function getPanelRefs(side: PanelSide): PanelRefs {
    return side === 'input'
        ? {
            list: AppElements.inputFormatList,
            search: AppElements.inputSearchBox,
            count: AppElements.inputFormatCount,
        }
        : {
            list: AppElements.outputFormatList,
            search: AppElements.outputSearchBox,
            count: AppElements.outputFormatCount,
        };
}
