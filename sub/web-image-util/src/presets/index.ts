/**
 * Preset functions - Commonly used image processing patterns
 *
 * @description Provides commonly needed image processing through simple function calls
 * Uses internally optimized options to guarantee the best results
 */

import { processImage } from '../processor';
import type { ImageSource, ResultBlob } from '../types';

/**
 * Thumbnail generation options
 */
export interface ThumbnailOptions {
  /** Size (square) or width/height object */
  size: number | { width: number; height?: number };
  /** Output format (default: webp if supported, otherwise jpeg) */
  format?: 'webp' | 'jpeg' | 'png';
  /** Compression quality 0.0-1.0 (default: 0.8) */
  quality?: number;
  /** Resize mode (default: 'cover') */
  fit?: 'cover' | 'contain';
  /** Background color (for fit mode, default: white) */
  background?: string;
}

/**
 * Thumbnail generator
 *
 * @description Optimized preset for the most commonly used thumbnail generation on the web
 * Automatically selects optimal format and quality to balance file size and quality
 *
 * @param source Image source
 * @param options Thumbnail options
 * @returns Generated thumbnail Blob and metadata
 *
 * @example
 * ```typescript
 * // Basic usage - 300px square thumbnail
 * const result = await createThumbnail(imageSource, { size: 300 });
 *
 * // Rectangular thumbnail
 * const result = await createThumbnail(imageSource, {
 *   size: { width: 400, height: 300 }
 * });
 *
 * // High-quality PNG thumbnail
 * const result = await createThumbnail(imageSource, {
 *   size: 150,
 *   format: 'png',
 *   quality: 0.9
 * });
 *
 * // Preserve entire image (with margins)
 * const result = await createThumbnail(imageSource, {
 *   size: 200,
 *   fit: 'contain',
 *   background: '#f0f0f0'
 * });
 * ```
 */
export async function createThumbnail(source: ImageSource, options: ThumbnailOptions): Promise<ResultBlob> {
  // Normalize size
  const { width, height } =
    typeof options.size === 'number'
      ? { width: options.size, height: options.size }
      : { width: options.size.width, height: options.size.height || options.size.width };

  // Set default options
  const defaultOptions = {
    format: (await getOptimalFormat('webp', 'jpeg')) as 'webp' | 'jpeg' | 'png',
    quality: 0.8,
    fit: 'cover' as const,
    background: '#ffffff',
  };

  const finalOptions = { ...defaultOptions, ...options };

  // Image processing
  return await processImage(source)
    .resize({
      fit: finalOptions.fit,
      width,
      height,
      background: finalOptions.background,
    })
    .toBlob({
      format: finalOptions.format,
      quality: finalOptions.quality,
    });
}

/**
 * Avatar generation options
 */
export interface AvatarOptions {
  /** Avatar size (square, default: 64) */
  size?: number;
  /** Background color (default: transparent) */
  background?: string;
  /** Output format (default: png - transparency support) */
  format?: 'webp' | 'png';
  /** Compression quality 0.0-1.0 (default: 0.9 - high quality) */
  quality?: number;
  /** Resizing fit mode (default: cover) */
  fit?: 'cover' | 'contain' | 'fill';
}

/**
 * Avatar generator
 *
 * @description Preset for generating square avatar images for user profiles
 * Creates square avatars with background color and format options
 *
 * @param source Image source
 * @param options Avatar options
 * @returns Generated avatar Blob and metadata
 *
 * @example
 * ```typescript
 * // Default 64px square avatar
 * const result = await createAvatar(imageSource);
 *
 * // 128px avatar
 * const result = await createAvatar(imageSource, {
 *   size: 128
 * });
 *
 * // Avatar with background color
 * const result = await createAvatar(imageSource, {
 *   size: 80,
 *   background: '#f8f9fa',
 *   format: 'webp'
 * });
 * ```
 */
export async function createAvatar(source: ImageSource, options: AvatarOptions = {}): Promise<ResultBlob> {
  // Default options
  const defaultOptions = {
    size: 64,
    background: 'transparent',
    format: 'png' as const, // transparency support
    quality: 0.9, // high quality for avatars
  };

  const finalOptions = { ...defaultOptions, ...options };

  // Basic resizing (square, cover fit)
  const processor = processImage(source).resize({
    fit: 'cover',
    width: finalOptions.size,
    height: finalOptions.size,
    background: finalOptions.background,
  });

  return await processor.toBlob({
    format: finalOptions.format,
    quality: finalOptions.quality,
  });
}

/**
 * Social image platform type
 */
export type SocialPlatform = 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'pinterest';

/**
 * Social image generation options
 */
export interface SocialImageOptions {
  /** Platform (recommended size automatically applied) */
  platform: SocialPlatform;
  /** Custom size (overrides platform settings) */
  customSize?: { width: number; height: number };
  /** Background color (default: white) */
  background?: string;
  /** Output format (default: jpeg - optimized for social platforms) */
  format?: 'jpeg' | 'png' | 'webp';
  /** Compression quality 0.0-1.0 (default: 0.85) */
  quality?: number;
}

/**
 * Platform-specific recommended image sizes (as of 2024)
 */
const SOCIAL_PLATFORM_SIZES: Record<SocialPlatform, { width: number; height: number }> = {
  // Twitter(X) - 1200x675 (16:9 ratio)
  twitter: { width: 1200, height: 675 },

  // Facebook - 1200x630 (1.91:1 ratio)
  facebook: { width: 1200, height: 630 },

  // Instagram - 1080x1080 (1:1 ratio, square)
  instagram: { width: 1080, height: 1080 },

  // LinkedIn - 1200x627 (1.91:1 ratio)
  linkedin: { width: 1200, height: 627 },

  // YouTube thumbnail - 1280x720 (16:9 ratio)
  youtube: { width: 1280, height: 720 },

  // Pinterest - 1000x1500 (2:3 ratio, vertical)
  pinterest: { width: 1000, height: 1500 },
};

/**
 * Social image generator
 *
 * @description Preset for generating platform-optimized images for social media
 * Automatically applies recommended sizes and ratios for each platform, optimized for SEO
 *
 * @param source Image source
 * @param options Social image options
 * @returns Generated social image Blob and metadata
 *
 * @example
 * ```typescript
 * // Twitter image (1200x675)
 * const result = await createSocialImage(imageSource, {
 *   platform: 'twitter'
 * });
 *
 * // Instagram square image (1080x1080)
 * const result = await createSocialImage(imageSource, {
 *   platform: 'instagram'
 * });
 *
 * // Facebook image with background color
 * const result = await createSocialImage(imageSource, {
 *   platform: 'facebook',
 *   background: '#f8f9fa'
 * });
 *
 * // Custom size (overrides platform settings)
 * const result = await createSocialImage(imageSource, {
 *   platform: 'twitter',
 *   customSize: { width: 800, height: 600 }
 * });
 * ```
 */
export async function createSocialImage(source: ImageSource, options: SocialImageOptions): Promise<ResultBlob> {
  // Determine size
  const targetSize = options.customSize || SOCIAL_PLATFORM_SIZES[options.platform];

  // Default options
  const defaultOptions = {
    background: '#ffffff',
    format: 'jpeg' as const, // Optimized for social platforms
    quality: 0.85,
  };

  const finalOptions = { ...defaultOptions, ...options };

  return await processImage(source)
    .resize({
      fit: 'contain', // Social images usually show the entire image
      width: targetSize.width,
      height: targetSize.height,
      background: finalOptions.background,
    })
    .toBlob({
      format: finalOptions.format,
      quality: finalOptions.quality,
    });
}

/**
 * Optimal format selection utility
 *
 * @description Selects the optimal image format by checking browser support
 * @param preferredFormat Preferred format
 * @param fallbackFormat Fallback format
 * @returns Supported format
 */
async function getOptimalFormat(preferredFormat: string, fallbackFormat: string): Promise<string> {
  // Check format support with Canvas.toBlob
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(preferredFormat);
      } else {
        resolve(fallbackFormat);
      }
    }, `image/${preferredFormat}`);
  });
}
