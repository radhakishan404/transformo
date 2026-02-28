/**
 * Drop zone UI module.
 * Manages the file-drop area's visual states: idle, drag-over, and file-loaded.
 */

import { AppElements } from './elements.ts';

// ─── File icon helpers ────────────────────────────────────────────────────────

/** Maps a MIME type or file extension to a descriptive emoji icon. */
function resolveFileIcon(fileName: string, mimeType: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    const mime = mimeType.toLowerCase();

    if (mime.startsWith('image/')) return '🖼️';
    if (mime.startsWith('video/')) return '🎬';
    if (mime.startsWith('audio/')) return '🎵';
    if (mime.includes('pdf')) return '📄';
    if (mime.includes('font')) return '🔤';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦';
    if (['json', 'xml', 'yaml', 'yml', 'toml'].includes(ext)) return '📝';
    if (['js', 'ts', 'py', 'rs', 'go', 'cpp', 'c', 'java', 'cs'].includes(ext)) return '💻';
    if (['txt', 'md', 'csv', 'log'].includes(ext)) return '📃';
    return '📁';
}

/** Formats a byte count into a human-readable string (B / KB / MB / GB). */
function formatBytes(bytes: number): string {
    if (bytes < 1_024) return `${bytes} B`;
    if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
    if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
    return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
}

/** Escapes unsafe characters before injecting user-provided strings into HTML. */
function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

// ─── Drop zone state transitions ─────────────────────────────────────────────

/** Shows the initial idle state (upload prompt). */
export function setDropZoneIdle(): void {
    AppElements.fileDropZone.classList.remove('drop-zone--loaded', 'drop-zone--drag-over', 'drop-zone--processing');
    AppElements.fileDropZoneContent.innerHTML = `
    <div class="upload-beacon" aria-hidden="true"></div>
    <div class="upload-icon" aria-hidden="true">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="23" stroke="url(#uploadGrad)" stroke-width="2"/>
        <path d="M24 32V16M24 16l-6 6M24 16l6 6" stroke="url(#uploadGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M16 35h16" stroke="url(#uploadGrad)" stroke-width="2.5" stroke-linecap="round"/>
        <defs>
          <linearGradient id="uploadGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#a78bfa"/>
            <stop offset="100%" stop-color="#60a5fa"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
    <h2 class="upload-title">Drop your file here</h2>
    <p class="upload-subtitle" id="drop-hint-text">
      or <span class="upload-cta">click to browse</span> · paste with Ctrl+V
    </p>
    <p class="upload-meta">
      All conversions happen <strong>locally in your browser</strong> —
      your files never leave your device
    </p>`;
}

/** Updates the drop zone to display information about the selected file(s). */
export function setDropZoneLoaded(files: File[]): void {
    const primaryFile = files[0];
    const icon = resolveFileIcon(primaryFile.name, primaryFile.type);
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    const safeName = escapeHtml(primaryFile.name);
    const extraLabel =
        files.length > 1
            ? `<span class="file-loaded__extra">+ ${files.length - 1} more file${files.length > 2 ? 's' : ''}</span>`
            : '';

    AppElements.fileDropZoneContent.innerHTML = `
    <div class="file-loaded">
      <div class="file-loaded__icon" aria-hidden="true">${icon}</div>
      <p class="file-loaded__name">${safeName}${extraLabel}</p>
      <p class="file-loaded__meta">${formatBytes(totalBytes)}</p>
      <div class="file-loaded__badges" aria-hidden="true">
        <span class="file-badge">Ready</span>
        <span class="file-badge">Local</span>
      </div>
      <p class="file-loaded__hint">Click to change file</p>
    </div>`;

    AppElements.fileDropZone.classList.add('drop-zone--loaded');
    AppElements.fileDropZone.classList.remove('drop-zone--drag-over', 'drop-zone--processing');
}

/** Shows conversion-in-progress state in the drop area. */
export function setDropZoneProcessing(fileCount: number, fromLabel: string, toLabel: string): void {
    AppElements.fileDropZone.classList.add('drop-zone--processing');
    AppElements.fileDropZone.classList.remove('drop-zone--drag-over');
    AppElements.fileDropZoneContent.innerHTML = `
    <div class="drop-processing" role="status" aria-live="polite">
      <div class="drop-processing__ring" aria-hidden="true"></div>
      <h2 class="drop-processing__title">Converting ${fileCount} file${fileCount === 1 ? '' : 's'}…</h2>
      <p class="drop-processing__sub">${escapeHtml(fromLabel)} → ${escapeHtml(toLabel)}</p>
      <p class="drop-processing__hint">Working in your browser with no uploads</p>
    </div>`;
}

/** Toggles drag-over highlight. */
export function setDropZoneDragOver(active: boolean): void {
    AppElements.fileDropZone.classList.toggle('drop-zone--drag-over', active);
}
