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
 * Thumbnail generator - Optimized for web performance and SEO
 *
 * @description
 * High-performance preset for generating web-optimized thumbnails with intelligent format selection.
 * Automatically chooses the best format (WebP → JPEG fallback) and applies compression settings
 * optimized for fast loading while maintaining visual quality.
 *
 * **🎯 Optimization Strategy:**
 * - **Format Selection**: WebP preferred (smaller files), JPEG fallback for compatibility
 * - **Quality Setting**: 0.8 default (sweet spot for web - good quality, reasonable size)
 * - **Resize Mode**: 'cover' default (fills entire thumbnail area, may crop edges)
 * - **Background**: White default (suitable for most web designs)
 *
 * **📊 Performance Benefits:**
 * - ~30-50% smaller file sizes with WebP vs JPEG at same quality
 * - Intelligent browser support detection for optimal format
 * - Optimized quality settings reduce bandwidth usage
 * - Fast processing with single-pass resize operation
 *
 * **🎨 Common Use Cases:**
 * - **Product Images**: E-commerce product grids, consistent sizing
 * - **Article Previews**: Blog post thumbnails, news feed images
 * - **Gallery Views**: Photo galleries, image carousels
 * - **Profile Images**: User profile pictures, team member photos
 * - **Content Cards**: Social media cards, preview images
 *
 * **💡 Best Practices:**
 * - Use square thumbnails (size: number) for consistent grid layouts
 * - Choose 'contain' fit for logos/graphics that must show completely
 * - Use PNG format when transparency is needed (logos, icons)
 * - Consider 'cover' fit for photos where cropping is acceptable
 *
 * @param source Image source (any supported type: File, Blob, URL, etc.)
 * @param options Thumbnail generation options with smart defaults
 * @returns Generated thumbnail with metadata (size, format, processing time)
 *
 * @example E-commerce Product Thumbnails
 * ```typescript
 * // Standard product grid - 300x300 WebP thumbnails
 * const productThumbs = await Promise.all(
 *   productImages.map(img => createThumbnail(img, { size: 300 }))
 * );
 *
 * // Display file size savings
 * productThumbs.forEach(result => {
 *   console.log(`Generated ${result.format} thumbnail: ${result.size} bytes`);
 * });
 * ```
 *
 * @example Blog Article Previews
 * ```typescript
 * // Rectangular thumbnails for article cards (16:9 aspect ratio)
 * const articleThumbnail = await createThumbnail(featuredImage, {
 *   size: { width: 400, height: 225 },
 *   quality: 0.75,  // Slightly lower quality for faster loading
 *   fit: 'cover'     // Ensure thumbnail fills entire area
 * });
 * ```
 *
 * @example Logo/Icon Thumbnails
 * ```typescript
 * // Preserve entire logo with transparent background
 * const logoThumbnail = await createThumbnail(logoFile, {
 *   size: 150,
 *   format: 'png',        // Preserve transparency
 *   fit: 'contain',       // Show entire logo
 *   background: 'transparent'
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
 * Avatar generator - Optimized for user profile images and high-quality display
 *
 * @description
 * Specialized preset for creating square user avatars with optimal quality and transparency support.
 * Designed for user profiles, team member photos, and other circular or square avatar displays
 * where image quality is prioritized over file size.
 *
 * **🎯 Quality-First Design:**
 * - **Format**: PNG default (transparency support, lossless quality)
 * - **Quality**: 0.9 default (high quality for important user-facing images)
 * - **Size**: 64px default (standard avatar size, scalable)
 * - **Fit**: 'cover' mode (fills entire avatar area, may crop for best composition)
 *
 * **🖼️ Avatar-Specific Optimizations:**
 * - **Transparency Support**: PNG format preserves transparent backgrounds
 * - **Sharp Details**: High quality setting preserves facial features and text
 * - **Consistent Sizing**: Always square output for uniform display
 * - **Background Handling**: Transparent default, customizable solid colors
 *
 * **📱 Common Avatar Scenarios:**
 * - **User Profiles**: Social platforms, forums, comment systems
 * - **Team Pages**: About us pages, staff directories
 * - **Chat Interfaces**: Messaging apps, video calls
 * - **Gaming Profiles**: Player avatars, leaderboards
 * - **Professional Networks**: LinkedIn-style profile photos
 *
 * **🎨 Design Considerations:**
 * - Use transparent background for circular masks in CSS
 * - Consider solid background colors for email/print compatibility
 * - Larger sizes (128px+) for high-DPI displays and zoom scenarios
 * - WebP format option for modern browsers when file size matters
 *
 * @param source Image source (photo, uploaded file, profile picture)
 * @param options Avatar generation options with quality-focused defaults
 * @returns High-quality square avatar with metadata
 *
 * @example Standard User Profile Avatar
 * ```typescript
 * // Default 64x64 PNG avatar with transparency
 * const userAvatar = await createAvatar(profilePhoto);
 *
 * // Display in HTML with CSS circular mask
 * // CSS: .avatar { border-radius: 50%; }
 * const avatarURL = await userAvatar.toDataURL();
 * avatarImg.src = avatarURL;
 * ```
 *
 * @example High-Resolution Team Member Photos
 * ```typescript
 * // Large avatar for team page display
 * const teamMemberAvatar = await createAvatar(memberPhoto, {
 *   size: 200,              // High resolution for quality display
 *   quality: 0.95,          // Maximum quality for professional appearance
 *   background: '#f8f9fa'   // Light background for email compatibility
 * });
 * ```
 *
 * @example Chat/Messaging Interface
 * ```typescript
 * // Small avatars for chat interface
 * const chatAvatar = await createAvatar(userPhoto, {
 *   size: 40,               // Compact size for chat bubbles
 *   format: 'webp',         // Smaller files for better chat performance
 *   quality: 0.8            // Balanced quality for small display
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
 * Social media image generator - Platform-optimized for maximum engagement and SEO
 *
 * @description
 * Comprehensive preset for creating social media images that meet each platform's specific
 * requirements and best practices. Automatically applies optimal dimensions, aspect ratios,
 * and compression settings to maximize visual quality and engagement across social platforms.
 *
 * **📊 Platform Optimization (2024 Standards):**
 * - **Twitter/X**: 1200×675 (16:9) - Optimized for timeline and card displays
 * - **Facebook**: 1200×630 (1.91:1) - Link previews and post attachments
 * - **Instagram**: 1080×1080 (1:1) - Square format for feed posts
 * - **LinkedIn**: 1200×627 (1.91:1) - Professional content sharing
 * - **YouTube**: 1280×720 (16:9) - Video thumbnails and channel art
 * - **Pinterest**: 1000×1500 (2:3) - Vertical format for pin optimization
 *
 * **🎯 SEO & Engagement Benefits:**
 * - **Rich Previews**: Proper dimensions ensure clean link previews
 * - **Algorithm Optimization**: Platform-specific sizes improve visibility
 * - **Mobile Compatibility**: Responsive sizing for mobile social apps
 * - **Brand Consistency**: Standardized formatting across platforms
 *
 * **🔧 Technical Optimizations:**
 * - **Format**: JPEG default (universal compatibility, good compression)
 * - **Quality**: 0.85 (balanced for social media compression algorithms)
 * - **Fit Mode**: 'contain' (preserves entire image, adds background if needed)
 * - **Background**: White default (clean appearance, text overlay friendly)
 *
 * **📱 Social Media Strategy Integration:**
 * - Automatically handles platform-specific aspect ratios
 * - Optimized file sizes for fast loading and engagement
 * - Compatible with social media management tools
 * - Designed for both organic posts and paid advertising
 *
 * @param source Image source (brand assets, photos, graphics)
 * @param options Social media optimization options with platform presets
 * @returns Platform-optimized social image with metadata
 *
 * @example Twitter/X Marketing Campaign
 * ```typescript
 * // Twitter card image for blog post sharing
 * const twitterCard = await createSocialImage(articleImage, {
 *   platform: 'twitter',
 *   background: '#ffffff',    // Clean background for text overlay
 *   quality: 0.8             // Optimized for Twitter's compression
 * });
 *
 * // Perfect for Twitter Cards meta tags:
 * // <meta name="twitter:image" content={twitterCard.url} />
 * ```
 *
 * @example Multi-Platform Content Distribution
 * ```typescript
 * // Generate images for all major platforms
 * const platforms = ['twitter', 'facebook', 'instagram', 'linkedin'];
 * const campaignImage = 'campaign-photo.jpg';
 *
 * const socialImages = await Promise.all(
 *   platforms.map(platform =>
 *     createSocialImage(campaignImage, {
 *       platform,
 *       background: '#f8f9fa',  // Branded background color
 *       quality: 0.85
 *     })
 *   )
 * );
 *
 * // Results ready for social media scheduling tools
 * socialImages.forEach((img, i) => {
 *   console.log(`${platforms[i]}: ${img.width}x${img.height} (${img.size} bytes)`);
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
