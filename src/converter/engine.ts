/**
 * Conversion engine module.
 * Orchestrates multi-step file conversion via the traversal graph.
 * Completely decoupled from the DOM — all UI calls are injected via callbacks.
 */

import type { FileData, FileFormat, FormatHandler, ConvertPathNode } from '../FormatHandler.ts';
import type { TraversionGraph } from '../TraversionGraph.ts';
import { showConversionStepPopup, showRouteSearchPopup } from '../ui/popup.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversionResult {
    readonly files: FileData[];
    readonly path: ConvertPathNode[];
}

export interface ConversionEngine {
    readonly formatCache: Map<string, FileFormat[]>;
    readonly traversalGraph: TraversionGraph;
    tryConvert(
        files: FileData[],
        from: ConvertPathNode,
        to: ConvertPathNode,
        simpleMode: boolean,
    ): Promise<ConversionResult | null>;
    printFormatCache(): string;
}

// ─── Implementation ───────────────────────────────────────────────────────────

class ConversionEngineImpl implements ConversionEngine {
    public readonly formatCache: Map<string, FileFormat[]>;
    public readonly traversalGraph: TraversionGraph;
    private readonly handlers: FormatHandler[];

    /** Path segments that failed during the current conversion attempt. */
    private deadEnds: ConvertPathNode[][] = [];

    constructor(
        formatCache: Map<string, FileFormat[]>,
        traversalGraph: TraversionGraph,
        handlers: FormatHandler[],
    ) {
        this.formatCache = formatCache;
        this.traversalGraph = traversalGraph;
        this.handlers = handlers;
    }

    public async tryConvert(
        files: FileData[],
        from: ConvertPathNode,
        to: ConvertPathNode,
        simpleMode: boolean,
    ): Promise<ConversionResult | null> {
        this.deadEnds = [];
        this.traversalGraph.clearDeadEndPaths();
        let attemptNumber = 0;

        for await (const path of this.traversalGraph.searchPath(from, to, simpleMode)) {
            attemptNumber++;
            // Prefer the exact output format if the terminal handler supports it.
            if (path.at(-1)?.handler === to.handler) {
                path[path.length - 1] = to;
            }

            const stageCount = Math.max(1, path.length - 1);
            showRouteSearchPopup(
                path.map(n => n.format.format.toUpperCase()),
                `Attempt ${attemptNumber} · ${stageCount} stage${stageCount === 1 ? '' : 's'} in this route`,
            );

            const result = await this.attemptPath(files, path, attemptNumber);
            if (result) return result;
        }

        return null;
    }

    public printFormatCache(): string {
        return JSON.stringify([...this.formatCache.entries()], null, 2);
    }

    // ─── Private ───────────────────────────────────────────────────────────────

    /**
     * Attempts to execute a specific conversion path.
     * Returns the converted files if successful, or `null` if any step fails.
     */
    private async attemptPath(
        files: FileData[],
        path: ConvertPathNode[],
        attemptNumber: number,
    ): Promise<ConversionResult | null> {
        const pathLabels = path.map(n => n.format.format.toUpperCase());

        // Skip paths that start with a known dead end.
        if (this.isKnownDeadEnd(path)) {
            console.warn(`Skipping path ${pathLabels.join(' → ')}: known dead end.`);
            return null;
        }

        for (let i = 0; i < path.length - 1; i++) {
            const handler = path[i + 1].handler;

            try {
                showConversionStepPopup(pathLabels, i, path.length - 1, handler.name);
                const supportedFormats = await this.ensureHandlerReady(handler);
                const inputFormat = supportedFormats.find(
                    f => f.mime === path[i].format.mime && f.from,
                );
                if (!inputFormat) throw new Error(`Handler "${handler.name}" does not accept ${path[i].format.mime}`);

                const [converted] = await Promise.all([
                    handler.doConvert(files, inputFormat, path[i + 1].format),
                    yieldToRenderer(),
                ]);

                if (converted.some(f => !f.bytes.length)) {
                    throw new Error('Conversion produced empty output.');
                }

                files = converted;
            } catch (err) {
                const deadEndPath = path.slice(0, i + 2);
                this.deadEnds.push(deadEndPath);
                this.traversalGraph.addDeadEndPath(deadEndPath);

                console.error(
                    `[${handler.name}] ${path[i].format.format} → ${path[i + 1].format.format}:`,
                    err,
                );
                showRouteSearchPopup(
                    pathLabels,
                    `Attempt ${attemptNumber} failed at ${path[i].format.format.toUpperCase()} → ${path[i + 1].format.format.toUpperCase()}. Trying fallback route…`,
                );
                await yieldToRenderer();
                return null;
            }
        }

        return { files, path };
    }

    /**
     * Ensures a handler's `init()` has been called and its formats are cached.
     * @returns The handler's supported formats.
     */
    private async ensureHandlerReady(handler: FormatHandler): Promise<FileFormat[]> {
        if (!handler.ready) {
            await handler.init();
            if (handler.supportedFormats) {
                this.formatCache.set(handler.name, handler.supportedFormats);
            }
        }

        const formats = this.formatCache.get(handler.name);
        if (!formats) throw new Error(`Handler "${handler.name}" has no supported formats.`);
        return formats;
    }

    /** Checks if a path begins with any registered dead-end segment. */
    private isKnownDeadEnd(path: ConvertPathNode[]): boolean {
        return this.deadEnds.some(dead =>
            dead.every((node, i) => path[i] === node),
        );
    }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createConversionEngine(
    formatCache: Map<string, FileFormat[]>,
    traversalGraph: TraversionGraph,
    handlers: FormatHandler[],
): ConversionEngine {
    return new ConversionEngineImpl(formatCache, traversalGraph, handlers);
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/** Yields to the browser's rendering pipeline (double rAF). */
function yieldToRenderer(): Promise<void> {
    return new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
}
