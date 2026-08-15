/**
 * Type-safe image processor interface
 *
 * @description Tracks resize() call state with TypeScript type system to
 * prevent incorrect usage at compile time.
 *
 * The interface itself lives in ./processor-interface (IImageProcessor) —
 * ShortcutBuilder depends on that file to avoid a circular import with
 * processor.ts. This module only derives the state-specific aliases from it.
 */

import type { ImageSource } from '../types';
import type { IImageProcessor } from './processor-interface';
import type { AfterResize, BeforeResize } from './processor-state.internal';

// Re-export for use by other modules
export type { AfterResize, BeforeResize } from './processor-state.internal';

/**
 * Initial processor type (before resize() call)
 */
export type InitialProcessor = IImageProcessor<BeforeResize>;

/**
 * Resizing complete processor type (after resize() call)
 */
export type ResizedProcessor = IImageProcessor<AfterResize>;

/**
 * Processor factory function type
 */
export type ProcessorFactory = (source: ImageSource) => InitialProcessor;
