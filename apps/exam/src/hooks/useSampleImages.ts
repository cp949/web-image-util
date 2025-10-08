import { useCallback } from 'react';

/**
 * Sample image information type
 */
export interface SampleImage {
  /** Image name */
  name: string;
  /** Image path */
  path: string;
  /** Image type */
  type: 'jpg' | 'png' | 'svg';
  /** Image size category */
  size: 'small' | 'medium' | 'large';
  /** Description */
  description: string;
  /** Preview path */
  preview: string;
}

/**
 * Sample image list
 */
const SAMPLE_IMAGES: SampleImage[] = [
  // Sample 1 - High quality photos
  {
    name: 'Sample 1 - High Quality Photo',
    path: '/sample-images/sample1.jpg',
    type: 'jpg',
    size: 'large',
    description: 'High quality landscape photo (JPEG, ~800KB)',
    preview: '/sample-images/sample1.jpg',
  },
  {
    name: 'Sample 1 - Transparent Graphic',
    path: '/sample-images/sample1.png',
    type: 'png',
    size: 'medium',
    description: 'Graphic with transparency (PNG, ~220KB)',
    preview: '/sample-images/sample1.png',
  },
  {
    name: 'Sample 1 - Simple Vector',
    path: '/sample-images/sample1.svg',
    type: 'svg',
    size: 'small',
    description: 'Simple vector image (SVG, ~5KB)',
    preview: '/sample-images/sample1.svg',
  },
  // Sample 2 - Large images
  {
    name: 'Sample 2 - Large Photo',
    path: '/sample-images/sample2.jpg',
    type: 'jpg',
    size: 'large',
    description: 'Large high-resolution photo (JPEG, ~2MB)',
    preview: '/sample-images/sample2.jpg',
  },
  {
    name: 'Sample 2 - Small Graphic',
    path: '/sample-images/sample2.png',
    type: 'png',
    size: 'small',
    description: 'Small graphic image (PNG, ~4KB)',
    preview: '/sample-images/sample2.png',
  },
  {
    name: 'Sample 2 - Medium Vector',
    path: '/sample-images/sample2.svg',
    type: 'svg',
    size: 'medium',
    description: 'Medium complexity vector (SVG, ~23KB)',
    preview: '/sample-images/sample2.svg',
  },
  // Sample 3 - Small images
  {
    name: 'Sample 3 - Small Photo',
    path: '/sample-images/sample3.jpg',
    type: 'jpg',
    size: 'small',
    description: 'Small photo (JPEG, ~9KB)',
    preview: '/sample-images/sample3.jpg',
  },
  {
    name: 'Sample 3 - Small PNG',
    path: '/sample-images/sample3.png',
    type: 'png',
    size: 'small',
    description: 'Small PNG image (~11KB)',
    preview: '/sample-images/sample3.png',
  },
  {
    name: 'Sample 3 - Complex Vector',
    path: '/sample-images/sample3.svg',
    type: 'svg',
    size: 'large',
    description: 'Complex vector image (SVG, ~155KB)',
    preview: '/sample-images/sample3.svg',
  },
  // Sample 4 - Medium size images
  {
    name: 'Sample 4 - Medium Photo',
    path: '/sample-images/sample4.jpg',
    type: 'jpg',
    size: 'medium',
    description: 'Medium size photo (JPEG, ~34KB)',
    preview: '/sample-images/sample4.jpg',
  },
  {
    name: 'Sample 4 - Medium PNG',
    path: '/sample-images/sample4.png',
    type: 'png',
    size: 'medium',
    description: 'Medium PNG image (~24KB)',
    preview: '/sample-images/sample4.png',
  },
  {
    name: 'Sample 4 - Extra Large Vector',
    path: '/sample-images/sample4.svg',
    type: 'svg',
    size: 'large',
    description: 'Extra large complex vector (SVG, ~305KB)',
    preview: '/sample-images/sample4.svg',
  },
];

/**
 * Sample image management hook
 */
export function useSampleImages() {
  /**
   * Filter images by type
   */
  const getImagesByType = useCallback((type: 'jpg' | 'png' | 'svg') => {
    return SAMPLE_IMAGES.filter((img) => img.type === type);
  }, []);

  /**
   * Filter images by size
   */
  const getImagesBySize = useCallback((size: 'small' | 'medium' | 'large') => {
    return SAMPLE_IMAGES.filter((img) => img.size === size);
  }, []);

  /**
   * Get recommended images - Phase 3: Extended recommendation system
   */
  const getRecommendedImages = useCallback((demoType: string): SampleImage[] => {
    const recommendations: Record<string, { images: string[]; reason: string }> = {
      // Basic demos
      basic: {
        images: ['sample1.jpg', 'sample2.png', 'sample3.jpg'],
        reason: 'Optimal for basic functionality testing with various sizes and formats',
      },
      padding: {
        images: ['sample1.jpg', 'sample2.png', 'sample1.svg'],
        reason: 'Images where padding effects are clearly visible',
      },
      'quick-preview': {
        images: ['sample3.jpg', 'sample4.jpg', 'sample2.png'],
        reason: 'Medium-sized images suitable for quick previews',
      },

      // Advanced features
      presets: {
        images: ['sample1.jpg', 'sample3.png', 'sample4.jpg'],
        reason: 'Diverse images suitable for demonstrating preset functions',
      },
      advanced: {
        images: ['sample4.svg', 'sample2.png', 'sample3.svg'],
        reason: 'Suitable for advanced processing feature testing',
      },
      filters: {
        images: ['sample1.jpg', 'sample2.jpg', 'sample4.jpg'],
        reason: 'High-quality photos where filter effects are clearly visible',
      },

      // SVG related
      svg: {
        images: ['sample1.svg', 'sample2.svg', 'sample3.svg', 'sample4.svg'],
        reason: 'For SVG processing and compatibility testing',
      },
      'svg-quality': {
        images: ['sample3.svg', 'sample4.svg', 'sample2.svg'],
        reason: 'Complex vector images for SVG quality testing',
      },

      // Performance and batch
      batch: {
        images: ['sample1.jpg', 'sample2.png', 'sample3.svg', 'sample4.jpg'],
        reason: 'Mixed formats for batch processing',
      },
      performance: {
        images: ['sample2.jpg', 'sample1.jpg', 'sample4.jpg'],
        reason: 'Large images for performance measurement',
      },
      'performance-benchmark': {
        images: ['sample2.jpg', 'sample4.svg'],
        reason: 'High-resolution images for benchmark testing',
      },

      // Conversion and format
      converters: {
        images: ['sample1.jpg', 'sample2.png', 'sample1.svg'],
        reason: 'For various format conversion testing',
      },
      'smart-format': {
        images: ['sample1.jpg', 'sample2.jpg', 'sample3.jpg'],
        reason: 'JPEG images for smart format selection testing',
      },
      'image-source-converter': {
        images: ['sample1.jpg', 'sample2.png', 'sample3.svg'],
        reason: 'For source type conversion testing',
      },

      // Comparison and gallery
      'fit-mode-comparison': {
        images: ['sample1.jpg', 'sample2.png'],
        reason: 'Common aspect ratio images for fit mode comparison',
      },
      'preview-gallery': {
        images: ['sample1.jpg', 'sample2.png', 'sample3.jpg', 'sample4.jpg'],
        reason: 'Various images for gallery preview',
      },

      // Developer tools
      'dev-tools': {
        images: ['sample1.jpg', 'sample2.png', 'sample3.svg'],
        reason: 'For development tools',
      },
    };

    const recommendation = recommendations[demoType];
    if (!recommendation) return [];

    return SAMPLE_IMAGES.filter((img) =>
      recommendation.images.some((name) => img.path.includes(name)),
    );
  }, []);

  return {
    /** Complete sample image list */
    sampleImages: SAMPLE_IMAGES,
    /** Filter by type */
    getImagesByType,
    /** Filter by size */
    getImagesBySize,
    /** Get recommended images */
    getRecommendedImages,
  };
}