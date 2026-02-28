/**
 * Global type augmentations for Transformo.
 *
 * These declarations extend the `Window` interface only where absolutely
 * necessary (legacy handler compatibility and DEV-only debug helpers).
 * Prefer explicit imports over window globals for new code.
 */

import type { FileFormat, FileData, ConvertPathNode } from './FormatHandler.js';
import type { TraversionGraph } from './TraversionGraph.js';

declare global {
  interface Window {
    /**
     * Cache of supported formats, keyed by handler name.
     * Populated during handler initialisation; consumed by the traversal graph.
     * @deprecated - Access via the {@link ConversionEngine} interface instead.
     */
    supportedFormatCache: Map<string, FileFormat[]>;

    /**
     * The live traversal graph.
     * Exposed on `window` in DEV mode only for debugging purposes.
     */
    traversionGraph?: TraversionGraph;

    /**
     * MIME type normalisation utility.
     * Exposed for backward compatibility with legacy handlers that reference
     * `window.normalizeMimeType` directly.
     */
    normalizeMimeType?: (mime: string) => string;

    /** @internal Used by legacy handlers only. Prefer the popup module functions. */
    showPopup?: (html: string) => void;
    /** @internal Used by legacy handlers only. Prefer the popup module functions. */
    hidePopup?: () => void;

    /**
     * @internal Conversion entry point used by legacy handlers that invoke
     * conversion recursively. New code should use {@link ConversionEngine.tryConvert}.
     */
    tryConvertByTraversing?: (
      files: FileData[],
      from: ConvertPathNode,
      to: ConvertPathNode,
    ) => Promise<{ files: FileData[]; path: ConvertPathNode[] } | null>;

    /** Google Analytics data layer (optional). */
    dataLayer?: unknown[];
    /** Google Analytics global event function (optional). */
    gtag?: (...args: unknown[]) => void;
  }
}

export { };
