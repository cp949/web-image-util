/**
 * Processor factory type
 *
 * @description
 * ShortcutBuilder depends on ./processor-interface (IImageProcessor) to avoid
 * a circular import with processor.ts. This module only derives the factory
 * alias from it.
 */

import type { ImageSource } from '../types';
import type { IImageProcessor } from './processor-interface';

/**
 * Processor factory function type
 */
export type ProcessorFactory = (source: ImageSource) => IImageProcessor;
