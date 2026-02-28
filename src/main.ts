/**
 * Transformo — application entry point.
 *
 * This module is intentionally thin: it wires together the individual UI and
 * conversion modules, registers event listeners, and drives the top-level
 * application state. All heavy logic lives in the imported modules.
 */

import type { FileData, ConvertPathNode } from './FormatHandler.ts';
import { TraversionGraph } from './TraversionGraph.ts';
import normalizeMimeType from './normalizeMimeType.ts';
import handlers from './handlers/index.ts';

import { AppElements } from './ui/elements.ts';
import { showToast } from './ui/toast.ts';
import { hidePopup, showProgressPopup, showSuccessPopup } from './ui/popup.ts';
import { initAnalytics, trackEvent } from './analytics.ts';
import { getMonetizationSettings } from './monetization.ts';
import {
  setDropZoneIdle,
  setDropZoneLoaded,
  setDropZoneProcessing,
  setDropZoneDragOver,
} from './ui/dropzone.ts';
import {
  allFormatOptions,
  addFormatOption,
  clearSuggestedOutputOptions,
  getSelectedOptionIndex,
  handleSearchInput,
  getSelectedInputOption,
  getSelectedOutputOption,
  listPanelOptions,
  markSuggestedOutputOptions,
  onFormatSelectionChange,
  refreshListCounts,
  renderFormatLists,
  setSelectedPanelOption,
} from './ui/formatList.ts';
import { createConversionEngine } from './converter/engine.ts';

// ─── Application state ────────────────────────────────────────────────────────

/** The files selected by the user (via drop, click, or paste). */
let selectedFiles: File[] = [];

/** Whether "Simple Mode" is active (hides per-handler duplicate formats). */
let simpleMode = true;
let isConverting = false;
let globalDragDepth = 0;
let autoSuggestedOutputIndex: number | null = null;

type Theme = 'dark' | 'light';
const THEME_STORAGE_KEY = 'transformo-theme';
type SuggestionObjective = 'compatibility' | 'quality' | 'size';
const SUGGESTION_OBJECTIVE_STORAGE_KEY = 'transformo-suggestion-objective';
interface SmartSuggestion {
  readonly index: number;
  readonly score: number;
  readonly reason: string;
}
interface AlternativeOutputCandidate {
  readonly index: number;
  readonly score: number;
  readonly option: ReturnType<typeof listPanelOptions>[number]['option'];
}
let suggestionObjective: SuggestionObjective = resolveSuggestionObjective();
const monetization = getMonetizationSettings();

// ─── Graph & engine setup ─────────────────────────────────────────────────────

const traversalGraph = new TraversionGraph();
const formatCache = new Map<string, import('./FormatHandler.ts').FileFormat[]>();

const engine = createConversionEngine(formatCache, traversalGraph, handlers);

initAnalytics();

// Expose debug helpers on window (stripped in production builds by the bundler).
if (import.meta.env.DEV) {
  Object.assign(window, {
    printFormatCache: () => engine.printFormatCache(),
    traversionGraph: traversalGraph,
  });
}

// ─── Mode toggle ──────────────────────────────────────────────────────────────

AppElements.modeToggleButton.addEventListener('click', () => {
  simpleMode = !simpleMode;
  document.body.classList.toggle('advanced-mode', !simpleMode);
  AppElements.modeToggleButton.classList.toggle('active', !simpleMode);
  AppElements.modeToggleButton.setAttribute('aria-pressed', String(!simpleMode));
  AppElements.modeToggleButton.querySelector('.mode-label')!.textContent =
    simpleMode ? 'Advanced' : 'Simple';

  // Re-render the format lists for the new mode.
  rebuildFormatLists();
});

// ─── Theme toggle ────────────────────────────────────────────────────────────

applyTheme(resolveInitialTheme());

AppElements.themeToggleButton.addEventListener('click', () => {
  const current: Theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  const next: Theme = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
});

// ─── Drop zone interaction ────────────────────────────────────────────────────

setDropZoneIdle();

AppElements.fileDropZone.addEventListener('click', () => {
  AppElements.fileInput.click();
});

AppElements.fileInput.addEventListener('change', () => {
  const files = Array.from(AppElements.fileInput.files ?? []);
  if (files.length) onFilesSelected(files);
});

AppElements.fileDropZone.addEventListener('dragenter', e => {
  e.preventDefault();
  setDropZoneDragOver(true);
});

AppElements.fileDropZone.addEventListener('dragover', e => {
  e.preventDefault();
});

AppElements.fileDropZone.addEventListener('dragleave', e => {
  if (!AppElements.fileDropZone.contains(e.relatedTarget as Node)) {
    setDropZoneDragOver(false);
  }
});

AppElements.fileDropZone.addEventListener('drop', e => {
  e.preventDefault();
  setDropZoneDragOver(false);
  const files = Array.from(e.dataTransfer?.files ?? []);
  if (files.length) onFilesSelected(files);
});

document.addEventListener('paste', e => {
  const files = Array.from(e.clipboardData?.files ?? []);
  if (files.length) onFilesSelected(files);
});

window.addEventListener('dragenter', event => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  globalDragDepth++;
  toggleGlobalDragOverlay(true);
});

window.addEventListener('dragover', event => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  toggleGlobalDragOverlay(true);
});

window.addEventListener('dragleave', event => {
  if (!isFileDrag(event)) return;
  const hasLeftViewport =
    event.clientX <= 0 ||
    event.clientY <= 0 ||
    event.clientX >= window.innerWidth ||
    event.clientY >= window.innerHeight;
  if (hasLeftViewport) {
    globalDragDepth = 0;
    toggleGlobalDragOverlay(false);
    return;
  }
  globalDragDepth = Math.max(0, globalDragDepth - 1);
  if (globalDragDepth === 0) toggleGlobalDragOverlay(false);
});

window.addEventListener('drop', event => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  globalDragDepth = 0;
  toggleGlobalDragOverlay(false);
});

window.addEventListener('dragend', () => {
  globalDragDepth = 0;
  toggleGlobalDragOverlay(false);
});

// ─── File selection ───────────────────────────────────────────────────────────

function onFilesSelected(files: File[]): void {
  selectedFiles = files;
  trackEvent('file_selected', {
    file_count: files.length,
    file_ext: getFileExtension(files[0]?.name ?? ''),
  });
  autoSelectFormatsForFiles(files, true);
  if (!isConverting) setDropZoneLoaded(files);
  updateConvertBar();
}

// ─── Format search ────────────────────────────────────────────────────────────

AppElements.inputSearchBox.addEventListener('input', handleSearchInput);
AppElements.outputSearchBox.addEventListener('input', handleSearchInput);
AppElements.smartSuggestions.addEventListener('click', event => {
  const target = event.target as HTMLElement;
  const objectiveButton = target.closest<HTMLButtonElement>('.smart-objective-btn');
  if (objectiveButton) {
    const objective = objectiveButton.dataset.objective;
    if (objective === 'compatibility' || objective === 'quality' || objective === 'size') {
      suggestionObjective = objective;
      persistSuggestionObjective(suggestionObjective);
      if (selectedFiles.length) {
        autoSelectFormatsForFiles(selectedFiles, false);
      } else {
        updateConvertBar();
      }
    }
    return;
  }

  const chip = target.closest<HTMLButtonElement>('.smart-suggestion-chip');
  if (!chip) return;
  const optionIndex = Number(chip.dataset.optionIndex);
  if (!Number.isFinite(optionIndex)) return;
  if (setSelectedPanelOption('output', optionIndex)) {
    autoSuggestedOutputIndex = optionIndex;
    updateConvertBar();
  }
});

// ─── Format selection state ───────────────────────────────────────────────────

onFormatSelectionChange(updateConvertBar);

/** Updates the convert button and info text based on the current selection. */
function updateConvertBar(): void {
  const fromOption = getSelectedInputOption();
  const toOption = getSelectedOutputOption();
  const hasFiles = selectedFiles.length > 0;
  const hasFrom = fromOption !== null;
  const hasTo = toOption !== null;

  AppElements.inputPanel.classList.toggle('format-container--selected', hasFrom);
  AppElements.outputPanel.classList.toggle('format-container--selected', hasTo);
  document.body.classList.toggle('ready-to-convert', hasFiles && hasFrom && hasTo && !isConverting);

  AppElements.convertButton.disabled = !(hasFiles && hasFrom && hasTo) || isConverting;

  if (isConverting) {
    AppElements.convertInfoText.textContent = 'Conversion in progress…';
    return;
  }

  if (!hasFiles) {
    AppElements.convertInfoText.textContent = 'Drop a file, then select input and output formats';
  } else if (!hasFrom || !hasTo) {
    AppElements.convertInfoText.textContent =
      hasFrom ? 'Select an output format' : 'Select an input format';
  } else {
    const from = fromOption!.format.format.toUpperCase();
    const to = toOption!.format.format.toUpperCase();
    const selectedOutputIndex = getSelectedOptionIndex('output');
    const suggestedSuffix =
      selectedOutputIndex !== null && selectedOutputIndex === autoSuggestedOutputIndex
        ? ` · Suggested (${objectiveLabel(suggestionObjective)})`
        : '';
    AppElements.convertInfoText.textContent =
      `${from} → ${to} · ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}${suggestedSuffix}`;
  }
}

// ─── Popup close ─────────────────────────────────────────────────────────────

AppElements.popupOverlay.addEventListener('click', hidePopup);

// ─── Conversion ───────────────────────────────────────────────────────────────

AppElements.convertButton.addEventListener('click', async () => {
  const fromOption = getSelectedInputOption();
  const toOption = getSelectedOutputOption();
  const selectedOutputIndex = getSelectedOptionIndex('output');

  if (isConverting || !selectedFiles.length || !fromOption || !toOption) return;

  const fromLabel = fromOption.format.format.toUpperCase();
  let resolvedToOption = toOption;
  let resolvedToIndex: number | null = selectedOutputIndex;
  const fromNode: ConvertPathNode = { handler: fromOption.handler, format: fromOption.format };
  let toNode: ConvertPathNode = { handler: toOption.handler, format: toOption.format };

  trackEvent('conversion_started', {
    from_format: fromOption.format.format.toLowerCase(),
    to_format: toOption.format.format.toLowerCase(),
    file_count: selectedFiles.length,
    suggestion_objective: suggestionObjective,
  });

  setConvertingState(true);
  setDropZoneProcessing(selectedFiles.length, fromLabel, resolvedToOption.format.format.toUpperCase());
  showProgressPopup('Preparing your files', 'Reading file buffers in-memory…', 0.12);

  try {
    // Read actual bytes eagerly to avoid async issues inside handlers.
    const loadedFiles: FileData[] = await Promise.all(
      selectedFiles.map(async f => ({
        name: f.name,
        bytes: new Uint8Array(await f.arrayBuffer()),
      })),
    );

    showProgressPopup('Building conversion strategy', `${fromLabel} → ${resolvedToOption.format.format.toUpperCase()}`, 0.32);
    let result = await engine.tryConvert(loadedFiles, fromNode, toNode, simpleMode);

    if (!result) {
      const alternatives = collectAlternativeOutputCandidates(toOption, selectedOutputIndex);
      for (const alternative of alternatives) {
        resolvedToOption = alternative.option;
        resolvedToIndex = alternative.index;
        toNode = { handler: resolvedToOption.handler, format: resolvedToOption.format };
        showProgressPopup(
          'Trying compatible route',
          `${fromLabel} → ${resolvedToOption.format.format.toUpperCase()} via ${resolvedToOption.handler.name}`,
          0.46,
        );
        result = await engine.tryConvert(loadedFiles, fromNode, toNode, simpleMode);
        if (result) break;
      }
    }

    if (!result) {
      trackEvent('conversion_failed_route', {
        from_format: fromLabel.toLowerCase(),
        to_format: toOption.format.format.toLowerCase(),
        file_count: selectedFiles.length,
      });
      showToast(
        `No conversion route found from ${fromLabel} to ${toOption.format.format.toUpperCase()}.`,
        'error',
      );
      hidePopup();
      return;
    }

    if (resolvedToIndex !== null && resolvedToIndex !== selectedOutputIndex) {
      setSelectedPanelOption('output', resolvedToIndex);
      autoSuggestedOutputIndex = resolvedToIndex;
      showToast(`Switched to a compatible ${resolvedToOption.format.format.toUpperCase()} route`, 'info', 2400);
    }

    showProgressPopup('Finalising output', 'Preparing your download…', 0.92);
    downloadFiles(result.files, resolvedToOption.format.extension);

    const pathLabels = result.path.map(n => n.format.format.toUpperCase());
    const resolvedToLabel = resolvedToOption.format.format.toUpperCase();
    showSuccessPopup(fromLabel, resolvedToLabel, pathLabels, {
      onDismiss: hidePopup,
      onFeedback: monetization.feedbackUrl
        ? () => openExternalLink(monetization.feedbackUrl, 'feedback_clicked', 'popup')
        : undefined,
    });

    trackEvent('conversion_succeeded', {
      from_format: fromLabel.toLowerCase(),
      to_format: resolvedToLabel.toLowerCase(),
      file_count: result.files.length,
      step_count: pathLabels.length - 1,
      used_fallback_route: resolvedToIndex !== selectedOutputIndex,
    });

    showToast(
      `Successfully converted to ${resolvedToLabel}`,
      'success',
    );
  } catch (err) {
    console.error('Unexpected conversion failure:', err);
    trackEvent('conversion_failed_exception', {
      from_format: fromOption.format.format.toLowerCase(),
      to_format: toOption.format.format.toLowerCase(),
      file_count: selectedFiles.length,
      message: err instanceof Error ? err.message : String(err),
    });
    showToast('Conversion failed unexpectedly. Please try again.', 'error');
    hidePopup();
  } finally {
    setConvertingState(false);
    if (selectedFiles.length) {
      setDropZoneLoaded(selectedFiles);
    } else {
      setDropZoneIdle();
    }
  }
});

// ─── Download helper ──────────────────────────────────────────────────────────

function downloadFiles(files: FileData[], extension: string): void {
  for (const file of files) {
    const blob = new Blob([new Uint8Array(file.bytes)]);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = replaceExtension(file.name, extension);
    anchor.click();
    // Revoke after a tick to ensure the browser has started the download.
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

function openExternalLink(url: string, eventName: string, source: string): void {
  trackEvent(eventName, { source, url_host: safeHost(url) });
  window.open(url, '_blank', 'noopener,noreferrer');
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid-url';
  }
}

function replaceExtension(fileName: string, newExtension: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  const base = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  return `${base}.${newExtension}`;
}

// ─── Handler initialisation ───────────────────────────────────────────────────

/**
 * Loads format metadata for all handlers concurrently and populates the
 * traversal graph. Called once on startup.
 */
async function initialiseHandlers(): Promise<void> {
  renderFormatLists(simpleMode);
  const tasks = handlers.map(async handler => {
    try {
      await handler.init();
      const formats = handler.supportedFormats ?? [];
      if (formats.length) {
        formatCache.set(handler.name, formats);
        formats.forEach(format =>
          addFormatOption({ format, handler }, simpleMode),
        );
      }
    } catch (err) {
      console.warn(`[${handler.name}] init failed:`, err);
    }
  });

  await Promise.allSettled(tasks);

  traversalGraph.init(formatCache, handlers);

  refreshListCounts();
  if (selectedFiles.length) autoSelectFormatsForFiles(selectedFiles, false);
  updateConvertBar();
  showToast('Formats loaded — ready to convert!', 'success', 3000);
}

function rebuildFormatLists(): void {
  // Clear rendered formats and re-add from cache.
  AppElements.inputFormatList.innerHTML = '';
  AppElements.outputFormatList.innerHTML = '';
  allFormatOptions.length = 0;

  for (const [handlerName, formats] of formatCache.entries()) {
    const handler = handlers.find(h => h.name === handlerName);
    if (!handler) continue;
    formats.forEach(format => addFormatOption({ format, handler }, simpleMode));
  }

  refreshListCounts();
  if (selectedFiles.length) {
    autoSelectFormatsForFiles(selectedFiles, false);
  } else {
    clearSuggestedOutputOptions();
    autoSuggestedOutputIndex = null;
    clearSmartSuggestionChips();
  }
  updateConvertBar();
}

// ─── Kick off ─────────────────────────────────────────────────────────────────

initialiseHandlers().catch(err => {
  console.error('Fatal: handler initialisation failed.', err);
  showToast('Failed to load conversion handlers. Please refresh.', 'error');
});

// ─── MIME normalisation (exported to global for legacy handler compat) ─────────
// Some older handlers call window.normalizeMimeType directly.
(window as unknown as Record<string, unknown>)['normalizeMimeType'] = normalizeMimeType;

function setConvertingState(active: boolean): void {
  isConverting = active;
  document.body.classList.toggle('is-converting', active);
  AppElements.convertButton.classList.toggle('btn--working', active);
  AppElements.convertButtonLabel.textContent = active ? 'Converting…' : 'Convert';
  updateConvertBar();
}

function resolveInitialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Ignore localStorage failures and fallback to preference.
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  AppElements.themeToggleButton.setAttribute('aria-pressed', String(theme === 'light'));
  AppElements.themeToggleButton.title =
    theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
}

function isFileDrag(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

function toggleGlobalDragOverlay(active: boolean): void {
  AppElements.dragOverlay.classList.toggle('drag-overlay--active', active);
  AppElements.dragOverlay.setAttribute('aria-hidden', String(!active));
}

function autoSelectFormatsForFiles(files: File[], showSuggestionToast: boolean): void {
  const primary = files[0];
  if (!primary) return;

  // Reset filters so auto selections are visible to the user.
  AppElements.inputSearchBox.value = '';
  AppElements.outputSearchBox.value = '';
  refreshListCounts();

  clearSuggestedOutputOptions();
  autoSuggestedOutputIndex = null;
  clearSmartSuggestionChips();

  const fileExt = getFileExtension(primary.name);
  const fileMime = normalizeMimeType(primary.type || '');

  const inputCandidates = listPanelOptions('input');
  if (!inputCandidates.length) return;

  const bestInput = pickBestInputCandidate(inputCandidates, primary.name, fileMime, fileExt);
  if (bestInput) setSelectedPanelOption('input', bestInput.index);

  const selectedInput = getSelectedInputOption();
  if (!selectedInput) return;

  const outputCandidates = listPanelOptions('output');
  const rankedSuggestions = rankOutputSuggestions(
    outputCandidates,
    selectedInput,
    fileMime,
    fileExt,
    suggestionObjective,
  );
  if (!rankedSuggestions.length) return;

  const suggestedIndices = rankedSuggestions.slice(0, 3).map(s => s.index);
  markSuggestedOutputOptions(suggestedIndices);
  renderSmartSuggestionChips(
    rankedSuggestions.slice(0, 3),
    selectedInput.format.format.toUpperCase(),
    suggestionObjective,
  );

  autoSuggestedOutputIndex = rankedSuggestions[0].index;
  setSelectedPanelOption('output', autoSuggestedOutputIndex);

  if (showSuggestionToast) {
    const top = allFormatOptions[autoSuggestedOutputIndex];
    if (top) {
      showToast(
        `Suggested output: ${top.format.format.toUpperCase()} (${objectiveLabel(suggestionObjective)} · ${rankedSuggestions[0].reason})`,
        'info',
        2600,
      );
    }
  }
}

function getFileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx > 0 ? fileName.slice(idx + 1).toLowerCase() : '';
}

function mimeFamily(mime: string): string {
  const [family] = mime.toLowerCase().split('/');
  return family ?? '';
}

function pickBestInputCandidate(
  candidates: ReturnType<typeof listPanelOptions>,
  fileName: string,
  fileMime: string,
  fileExt: string,
): { index: number; score: number } | null {
  const family = mimeFamily(fileMime);
  const lowerFileName = fileName.toLowerCase();
  const scored = candidates.map(({ option, index }) => {
    const format = option.format;
    const formatId = format.format.toLowerCase();
    const ext = format.extension.toLowerCase();
    const mime = normalizeMimeType(format.mime.toLowerCase());
    const internal = (format.internal ?? '').toLowerCase();
    const canonicalId = canonicalInputId(formatId, ext, mime);

    let score = 0;
    if (fileMime && mime === fileMime) score += 120;
    if (fileExt && formatId === fileExt) score += 130;
    if (fileExt && ext === fileExt) score += 102;
    if (fileExt && canonicalId === fileExt) score += 70;
    if (family && mime.startsWith(`${family}/`)) score += 18;
    if (fileExt && format.name.toLowerCase().includes(fileExt)) score += 8;

    score += canonicalInputBonus(canonicalId);
    score -= specializedInputPenalty(formatId, internal, format.name, lowerFileName);

    return { index, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0] && scored[0].score > 0 ? scored[0] : null;
}

function rankOutputSuggestions(
  candidates: ReturnType<typeof listPanelOptions>,
  selectedInput: NonNullable<ReturnType<typeof getSelectedInputOption>>,
  fileMime: string,
  fileExt: string,
  objective: SuggestionObjective,
): SmartSuggestion[] {
  const fromFormat = selectedInput.format.format.toLowerCase();
  const fromExt = selectedInput.format.extension.toLowerCase();
  const fromMime = selectedInput.format.mime.toLowerCase();
  const normalizedSourceId = normalizeSourceFormatId(fromFormat, fromExt, fromMime);
  const sourceFamily = mimeFamily(fileMime || selectedInput.format.mime);
  const preferred = buildPreferredTargets(normalizedSourceId, fileExt, sourceFamily);
  const universalGood = new Set([
    'pdf', 'webp', 'png', 'jpg', 'jpeg', 'mp3', 'wav', 'zip', 'txt', 'csv', 'json',
  ]);

  const ranked = candidates
    .map(({ option, index }) => {
      const format = option.format;
      const id = format.format.toLowerCase();
      const ext = format.extension.toLowerCase();
      const mime = format.mime.toLowerCase();

      // Skip equivalent outputs.
      if (id === fromFormat || ext === fromExt || mime === fromMime || id === normalizedSourceId) {
        return null;
      }

      let score = 0;
      let reason = 'smart match';
      const preferredRule = preferred.find(target => target.id === id || target.id === ext);
      if (preferredRule) {
        score += preferredRule.bonus;
        reason = preferredRule.reason;
      }

      const objectiveBias = computeObjectiveBias(objective, sourceFamily, id, ext, mime, format.name);
      score += objectiveBias.bonus;
      if (objectiveBias.bonus > 0 && !preferredRule) {
        reason = objectiveBias.reason;
      } else if (objectiveBias.bonus > 0 && preferredRule) {
        reason = `${preferredRule.reason} · ${objectiveBias.reason}`;
      }

      if (sourceFamily && mime.startsWith(`${sourceFamily}/`)) {
        score += 22;
        if (reason === 'smart match') reason = `${sourceFamily} format`;
      }
      if (universalGood.has(id) || universalGood.has(ext)) {
        score += 12;
      }
      if (id.includes('lossless') || format.name.toLowerCase().includes('lossless')) {
        score += 6;
      }
      return { index, score, reason };
    })
    .filter((value): value is SmartSuggestion => value !== null)
    .sort((a, b) => b.score - a.score);

  if (ranked.length && ranked[0].score > 0) return ranked;

  // Fallback: pick the first non-equivalent output.
  const fallback = candidates.find(({ option }) => {
    const id = option.format.format.toLowerCase();
    const ext = option.format.extension.toLowerCase();
    const mime = option.format.mime.toLowerCase();
    return id !== fromFormat && ext !== fromExt && mime !== fromMime;
  });
  return fallback ? [{ index: fallback.index, score: 1, reason: 'closest available option' }] : [];
}

function buildPreferredTargets(
  fromFormat: string,
  fileExt: string,
  sourceFamily: string,
): Array<{ id: string; reason: string; bonus: number }> {
  const key = fromFormat || fileExt;
  const byFormat: Record<string, Array<{ id: string; reason: string; bonus: number }>> = {
    png: [
      { id: 'webp', reason: 'smaller web image', bonus: 135 },
      { id: 'jpg', reason: 'photo friendly output', bonus: 122 },
      { id: 'avif', reason: 'modern compressed image', bonus: 120 },
      { id: 'svg', reason: 'vector output', bonus: 96 },
      { id: 'pdf', reason: 'document ready export', bonus: 88 },
    ],
    jpg: [
      { id: 'png', reason: 'lossless image', bonus: 130 },
      { id: 'webp', reason: 'smaller web image', bonus: 124 },
      { id: 'avif', reason: 'modern compressed image', bonus: 118 },
      { id: 'pdf', reason: 'document ready export', bonus: 88 },
    ],
    jpeg: [
      { id: 'png', reason: 'lossless image', bonus: 130 },
      { id: 'webp', reason: 'smaller web image', bonus: 124 },
      { id: 'avif', reason: 'modern compressed image', bonus: 118 },
      { id: 'pdf', reason: 'document ready export', bonus: 88 },
    ],
    webp: [
      { id: 'png', reason: 'lossless image', bonus: 132 },
      { id: 'jpg', reason: 'compatible photo format', bonus: 118 },
      { id: 'avif', reason: 'next-gen web format', bonus: 112 },
    ],
    gif: [
      { id: 'mp4', reason: 'smaller animated output', bonus: 138 },
      { id: 'webm', reason: 'modern animated web output', bonus: 134 },
      { id: 'webp', reason: 'animated web image', bonus: 122 },
      { id: 'png', reason: 'extract static frames', bonus: 86 },
    ],
    svg: [
      { id: 'png', reason: 'raster image output', bonus: 134 },
      { id: 'webp', reason: 'optimized web image', bonus: 124 },
      { id: 'pdf', reason: 'print friendly document', bonus: 108 },
      { id: 'jpg', reason: 'photo output', bonus: 96 },
    ],
    bmp: [
      { id: 'png', reason: 'lossless compressed image', bonus: 138 },
      { id: 'webp', reason: 'smaller web image', bonus: 118 },
      { id: 'jpg', reason: 'photo output', bonus: 102 },
    ],
    tiff: [
      { id: 'png', reason: 'lossless image output', bonus: 136 },
      { id: 'jpg', reason: 'lighter photo file', bonus: 118 },
      { id: 'pdf', reason: 'scan/document format', bonus: 110 },
    ],
    mp3: [
      { id: 'wav', reason: 'uncompressed master audio', bonus: 132 },
      { id: 'flac', reason: 'lossless compressed audio', bonus: 128 },
      { id: 'ogg', reason: 'streaming friendly audio', bonus: 112 },
      { id: 'm4a', reason: 'apple ecosystem audio', bonus: 104 },
    ],
    wav: [
      { id: 'mp3', reason: 'smaller playback file', bonus: 134 },
      { id: 'flac', reason: 'lossless archive audio', bonus: 126 },
      { id: 'ogg', reason: 'streaming friendly audio', bonus: 110 },
      { id: 'm4a', reason: 'portable audio output', bonus: 102 },
    ],
    flac: [
      { id: 'mp3', reason: 'smaller playback file', bonus: 132 },
      { id: 'wav', reason: 'editing waveform format', bonus: 122 },
      { id: 'ogg', reason: 'streaming friendly audio', bonus: 108 },
    ],
    ogg: [
      { id: 'mp3', reason: 'most compatible audio', bonus: 132 },
      { id: 'wav', reason: 'editing waveform format', bonus: 116 },
      { id: 'flac', reason: 'lossless archive audio', bonus: 112 },
    ],
    mp4: [
      { id: 'webm', reason: 'web streaming format', bonus: 130 },
      { id: 'gif', reason: 'quick preview animation', bonus: 116 },
      { id: 'mp3', reason: 'audio extraction', bonus: 112 },
      { id: 'wav', reason: 'high-quality audio extraction', bonus: 100 },
    ],
    mov: [
      { id: 'mp4', reason: 'best compatibility', bonus: 136 },
      { id: 'webm', reason: 'web streaming format', bonus: 124 },
      { id: 'gif', reason: 'quick preview animation', bonus: 108 },
    ],
    webm: [
      { id: 'mp4', reason: 'best compatibility', bonus: 134 },
      { id: 'gif', reason: 'quick preview animation', bonus: 112 },
      { id: 'mp3', reason: 'audio extraction', bonus: 108 },
    ],
    mkv: [
      { id: 'mp4', reason: 'best compatibility', bonus: 132 },
      { id: 'webm', reason: 'web streaming format', bonus: 118 },
      { id: 'mp3', reason: 'audio extraction', bonus: 108 },
    ],
    txt: [
      { id: 'pdf', reason: 'shareable document output', bonus: 132 },
      { id: 'md', reason: 'rich text markdown', bonus: 122 },
      { id: 'html', reason: 'web page output', bonus: 116 },
      { id: 'json', reason: 'structured text output', bonus: 96 },
    ],
    md: [
      { id: 'html', reason: 'publish-ready webpage', bonus: 134 },
      { id: 'pdf', reason: 'document export', bonus: 122 },
      { id: 'txt', reason: 'plain text output', bonus: 98 },
    ],
    html: [
      { id: 'pdf', reason: 'print-ready document', bonus: 132 },
      { id: 'txt', reason: 'plain text extraction', bonus: 112 },
      { id: 'md', reason: 'markdown output', bonus: 106 },
    ],
    pdf: [
      { id: 'txt', reason: 'extract readable text', bonus: 128 },
      { id: 'png', reason: 'page image output', bonus: 118 },
      { id: 'jpg', reason: 'compact page image', bonus: 110 },
      { id: 'html', reason: 'web readable output', bonus: 100 },
    ],
    json: [
      { id: 'txt', reason: 'human-readable plain text', bonus: 118 },
      { id: 'yaml', reason: 'config friendly format', bonus: 116 },
      { id: 'csv', reason: 'table-friendly export', bonus: 112 },
      { id: 'xml', reason: 'structured interchange format', bonus: 98 },
    ],
    xml: [
      { id: 'json', reason: 'web-native structured format', bonus: 120 },
      { id: 'yaml', reason: 'config friendly format', bonus: 112 },
      { id: 'txt', reason: 'plain text output', bonus: 96 },
    ],
    csv: [
      { id: 'xlsx', reason: 'spreadsheet-ready output', bonus: 124 },
      { id: 'json', reason: 'structured data output', bonus: 118 },
      { id: 'txt', reason: 'plain text export', bonus: 92 },
    ],
    zip: [
      { id: '7z', reason: 'higher compression archive', bonus: 130 },
      { id: 'tar', reason: 'unix archive format', bonus: 116 },
      { id: 'gz', reason: 'compressed single stream', bonus: 108 },
    ],
    tar: [
      { id: 'zip', reason: 'cross-platform archive', bonus: 126 },
      { id: 'gz', reason: 'compressed tarball output', bonus: 120 },
      { id: '7z', reason: 'high compression archive', bonus: 110 },
    ],
    gz: [
      { id: 'zip', reason: 'cross-platform archive', bonus: 124 },
      { id: 'tar', reason: 'package archive format', bonus: 116 },
      { id: '7z', reason: 'high compression archive', bonus: 106 },
    ],
    ttf: [
      { id: 'woff2', reason: 'best modern web font', bonus: 132 },
      { id: 'woff', reason: 'legacy web font support', bonus: 118 },
      { id: 'otf', reason: 'desktop font variant', bonus: 102 },
    ],
    otf: [
      { id: 'woff2', reason: 'best modern web font', bonus: 130 },
      { id: 'woff', reason: 'legacy web font support', bonus: 116 },
      { id: 'ttf', reason: 'desktop font variant', bonus: 100 },
    ],
    woff: [
      { id: 'woff2', reason: 'smaller web font', bonus: 132 },
      { id: 'ttf', reason: 'desktop installable font', bonus: 110 },
      { id: 'otf', reason: 'desktop font variant', bonus: 100 },
    ],
  };

  const familyDefaults: Record<string, Array<{ id: string; reason: string; bonus: number }>> = {
    image: [
      { id: 'webp', reason: 'optimized web image', bonus: 124 },
      { id: 'png', reason: 'lossless image output', bonus: 118 },
      { id: 'jpg', reason: 'compact photo output', bonus: 112 },
      { id: 'pdf', reason: 'document-ready output', bonus: 96 },
    ],
    audio: [
      { id: 'mp3', reason: 'widest playback support', bonus: 128 },
      { id: 'wav', reason: 'editing waveform format', bonus: 120 },
      { id: 'flac', reason: 'lossless archive audio', bonus: 114 },
      { id: 'ogg', reason: 'streaming friendly audio', bonus: 106 },
    ],
    video: [
      { id: 'mp4', reason: 'widest playback support', bonus: 132 },
      { id: 'webm', reason: 'web streaming format', bonus: 122 },
      { id: 'gif', reason: 'short animation output', bonus: 102 },
      { id: 'mp3', reason: 'audio extraction', bonus: 100 },
    ],
    text: [
      { id: 'pdf', reason: 'shareable document output', bonus: 124 },
      { id: 'txt', reason: 'plain text output', bonus: 116 },
      { id: 'md', reason: 'rich text markdown', bonus: 108 },
      { id: 'html', reason: 'web-readable output', bonus: 102 },
    ],
    application: [
      { id: 'pdf', reason: 'portable document output', bonus: 112 },
      { id: 'zip', reason: 'archive output', bonus: 104 },
      { id: 'txt', reason: 'plain text extraction', bonus: 96 },
    ],
    font: [
      { id: 'woff2', reason: 'modern web font', bonus: 126 },
      { id: 'woff', reason: 'legacy web font', bonus: 114 },
      { id: 'ttf', reason: 'desktop installable font', bonus: 104 },
    ],
  };

  const chosen = byFormat[key] ?? familyDefaults[sourceFamily] ?? [
    { id: 'pdf', reason: 'portable output', bonus: 98 },
    { id: 'zip', reason: 'archive output', bonus: 92 },
    { id: 'txt', reason: 'plain text extraction', bonus: 88 },
  ];

  const deduped = new Map<string, { id: string; reason: string; bonus: number }>();
  for (const target of chosen) {
    const id = target.id.toLowerCase();
    if (!deduped.has(id)) deduped.set(id, { id, reason: target.reason, bonus: target.bonus });
  }
  return [...deduped.values()];
}

function normalizeSourceFormatId(fromFormat: string, fromExt: string, fromMime: string): string {
  if (fromFormat.includes('cgbi') || fromMime.includes('image/png') || fromExt === 'png') return 'png';
  if (fromExt === 'jpg' || fromExt === 'jpeg' || fromMime === 'image/jpeg') return 'jpeg';
  return fromFormat;
}

function normalizeTargetFormatId(format: string, extension: string, mime: string): string {
  const id = format.toLowerCase();
  const ext = extension.toLowerCase();
  const lowerMime = mime.toLowerCase();
  if (id === 'jpg' || id === 'jpeg' || ext === 'jpg' || ext === 'jpeg' || lowerMime === 'image/jpeg') return 'jpeg';
  if (id.includes('png') || ext === 'png' || lowerMime === 'image/png') return 'png';
  if (id.includes('webp') || ext === 'webp' || lowerMime === 'image/webp') return 'webp';
  if (id.includes('tif') || ext === 'tif' || ext === 'tiff') return 'tiff';
  return id || ext;
}

function collectAlternativeOutputCandidates(
  selectedTo: NonNullable<ReturnType<typeof getSelectedOutputOption>>,
  selectedIndex: number | null,
): AlternativeOutputCandidate[] {
  const selectedId = normalizeTargetFormatId(
    selectedTo.format.format,
    selectedTo.format.extension,
    selectedTo.format.mime,
  );

  return listPanelOptions('output')
    .filter(({ index }) => selectedIndex === null || index !== selectedIndex)
    .map(({ option, index }) => {
      const optionId = normalizeTargetFormatId(
        option.format.format,
        option.format.extension,
        option.format.mime,
      );
      let score = 0;
      if (optionId === selectedId) score += 120;
      if (option.format.mime === selectedTo.format.mime) score += 80;
      if (option.format.extension === selectedTo.format.extension) score += 50;
      if (option.format.format === selectedTo.format.format) score += 40;
      // Prefer well-known conversion handlers first.
      if (option.handler.name === 'canvasToBlob') score += 18;
      if (option.handler.name === 'ImageMagick') score += 16;
      if (option.handler.name === 'FFmpeg') score += 10;
      return { option, index, score };
    })
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
}

function canonicalInputId(formatId: string, ext: string, mime: string): string {
  if (formatId === 'jpeg' || formatId === 'jpg' || ext === 'jpg' || ext === 'jpeg' || mime === 'image/jpeg') {
    return 'jpeg';
  }
  if (formatId.includes('png') || ext === 'png' || mime === 'image/png') {
    return 'png';
  }
  if (formatId.includes('webp') || ext === 'webp' || mime === 'image/webp') {
    return 'webp';
  }
  if (formatId.includes('gif') || ext === 'gif' || mime === 'image/gif') {
    return 'gif';
  }
  if (formatId.includes('mp3') || ext === 'mp3' || mime.includes('audio/mpeg')) {
    return 'mp3';
  }
  if (formatId.includes('wav') || ext === 'wav' || mime.includes('audio/wav')) {
    return 'wav';
  }
  if (formatId.includes('mp4') || ext === 'mp4' || mime.includes('video/mp4')) {
    return 'mp4';
  }
  if (ext) return ext;
  return formatId;
}

function canonicalInputBonus(canonicalId: string): number {
  if (['png', 'jpeg', 'webp', 'gif', 'mp3', 'wav', 'mp4', 'pdf', 'txt', 'json', 'zip'].includes(canonicalId)) {
    return 16;
  }
  return 0;
}

function specializedInputPenalty(
  formatId: string,
  internal: string,
  formatName: string,
  lowerFileName: string,
): number {
  const tokens = ['cgbi', 'raw', 'special', 'optimized', 'iphone', 'indexed', 'internal'];
  const haystack = `${formatId} ${internal} ${formatName.toLowerCase()}`;
  const hasSpecialMarker = tokens.some(token => haystack.includes(token));
  if (!hasSpecialMarker) return 0;

  const explicitMatch = tokens.some(token => lowerFileName.includes(token));
  if (explicitMatch) return 0;

  // Heavily discourage niche/internal variants unless filename explicitly hints them.
  return 220;
}

function computeObjectiveBias(
  objective: SuggestionObjective,
  sourceFamily: string,
  id: string,
  ext: string,
  mime: string,
  formatName: string,
): { bonus: number; reason: string } {
  const token = new Set([id, ext]);
  const lowerName = formatName.toLowerCase();
  const family = sourceFamily || mimeFamily(mime);

  const compatibilityByFamily: Record<string, string[]> = {
    image: ['png', 'jpg', 'jpeg', 'webp', 'pdf'],
    audio: ['mp3', 'wav', 'm4a', 'ogg'],
    video: ['mp4', 'webm', 'mov'],
    text: ['txt', 'pdf', 'html', 'md'],
    application: ['pdf', 'zip', 'json', 'xml'],
    font: ['ttf', 'woff', 'woff2', 'otf'],
  };
  const qualityByFamily: Record<string, string[]> = {
    image: ['png', 'tiff', 'bmp', 'svg'],
    audio: ['wav', 'flac'],
    video: ['mkv', 'mov', 'webm'],
    text: ['pdf', 'html', 'json', 'xml', 'md'],
    application: ['zip', '7z', 'tar'],
    font: ['ttf', 'otf'],
  };
  const sizeByFamily: Record<string, string[]> = {
    image: ['webp', 'avif', 'jpg', 'jpeg'],
    audio: ['mp3', 'm4a', 'ogg', 'opus'],
    video: ['webm', 'mp4'],
    text: ['txt', 'md', 'json', 'csv'],
    application: ['7z', 'gz', 'zip'],
    font: ['woff2', 'woff'],
  };

  const has = (list: string[]): boolean => list.some(value => token.has(value));
  const compatibilityPool = compatibilityByFamily[family] ?? [];
  const qualityPool = qualityByFamily[family] ?? [];
  const sizePool = sizeByFamily[family] ?? [];

  if (objective === 'compatibility') {
    let bonus = has(compatibilityPool) ? 42 : 0;
    if (['pdf', 'zip', 'png', 'jpg', 'jpeg', 'mp3', 'mp4', 'txt'].some(value => token.has(value))) {
      bonus += 16;
    }
    return { bonus, reason: 'best compatibility' };
  }

  if (objective === 'quality') {
    let bonus = has(qualityPool) ? 44 : 0;
    if (lowerName.includes('lossless') || token.has('flac') || token.has('png') || token.has('wav')) {
      bonus += 18;
    }
    if (token.has('jpg') || token.has('jpeg') || token.has('mp3')) {
      bonus -= 8;
    }
    return { bonus, reason: 'higher quality' };
  }

  // objective === 'size'
  let bonus = has(sizePool) ? 46 : 0;
  if (token.has('webp') || token.has('avif') || token.has('7z') || token.has('gz') || token.has('woff2')) {
    bonus += 14;
  }
  if (token.has('wav') || token.has('bmp') || token.has('tiff')) {
    bonus -= 10;
  }
  return { bonus, reason: 'smaller file size' };
}

function objectiveLabel(objective: SuggestionObjective): string {
  if (objective === 'quality') return 'Best Quality';
  if (objective === 'size') return 'Smallest Size';
  return 'Compatibility';
}

function resolveSuggestionObjective(): SuggestionObjective {
  try {
    const stored = window.localStorage.getItem(SUGGESTION_OBJECTIVE_STORAGE_KEY);
    if (stored === 'compatibility' || stored === 'quality' || stored === 'size') return stored;
  } catch {
    // Ignore localStorage read errors.
  }
  return 'compatibility';
}

function persistSuggestionObjective(objective: SuggestionObjective): void {
  try {
    window.localStorage.setItem(SUGGESTION_OBJECTIVE_STORAGE_KEY, objective);
  } catch {
    // Ignore localStorage write errors.
  }
}

function renderSmartSuggestionChips(
  suggestions: SmartSuggestion[],
  fromLabel: string,
  objective: SuggestionObjective,
): void {
  if (!suggestions.length) {
    clearSmartSuggestionChips();
    return;
  }

  const chips = suggestions.map((suggestion, idx) => {
    const option = allFormatOptions[suggestion.index];
    if (!option) return '';
    const label = option.format.format.toUpperCase();
    const reason = suggestion.reason;
    const chipLabel = idx === 0 ? 'Top pick' : `Alternative ${idx}`;
    return `
      <button class="smart-suggestion-chip ${idx === 0 ? 'smart-suggestion-chip--primary' : ''}"
        type="button"
        data-option-index="${suggestion.index}"
        title="${escapeHtml(reason)}">
        <span class="smart-suggestion-chip__label">${chipLabel}</span>
        <span class="smart-suggestion-chip__value">${escapeHtml(label)}</span>
      </button>`;
  }).join('');

  AppElements.smartSuggestions.innerHTML = `
    <div class="smart-suggestions__title">Smart picks for ${escapeHtml(fromLabel)}</div>
    <div class="smart-objectives" role="tablist" aria-label="Suggestion objective">
      ${renderObjectiveButton('compatibility', objective)}
      ${renderObjectiveButton('quality', objective)}
      ${renderObjectiveButton('size', objective)}
    </div>
    <div class="smart-suggestions__list">${chips}</div>
  `;
  AppElements.smartSuggestions.classList.add('smart-suggestions--active');
}

function clearSmartSuggestionChips(): void {
  AppElements.smartSuggestions.classList.remove('smart-suggestions--active');
  AppElements.smartSuggestions.innerHTML = '';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderObjectiveButton(objective: SuggestionObjective, activeObjective: SuggestionObjective): string {
  const activeClass = objective === activeObjective ? 'smart-objective-btn--active' : '';
  const label = objectiveLabel(objective);
  return `
    <button class="smart-objective-btn ${activeClass}"
      type="button"
      data-objective="${objective}"
      role="tab"
      aria-selected="${String(objective === activeObjective)}"
      title="Prioritize ${label.toLowerCase()}">
      ${label}
    </button>`;
}
