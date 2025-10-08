/**
 * SVG Complexity Analysis System
 *
 * @description
 * Intelligent analysis system that analyzes SVG structure and content to calculate
 * rendering complexity and automatically determines optimal quality levels
 *
 * **Core Features:**
 * - Complexity weighting for various SVG elements
 * - Comprehensive analysis of file size and advanced feature usage
 * - Quality level recommendations considering browser rendering performance
 * - Safe fallback when analysis fails
 */

/**
 * SVG complexity metrics interface
 *
 * @description Various complexity indicators collected through SVG analysis
 */
export interface SvgComplexityMetrics {
  /** Number of path elements - indicator of vector path complexity */
  pathCount: number;
  /** Number of gradients - color interpolation calculation complexity */
  gradientCount: number;
  /** Number of filter effects - highest rendering cost */
  filterCount: number;
  /** Number of animation elements - dynamic processing complexity */
  animationCount: number;
  /** Number of text elements - font rendering complexity */
  textElementCount: number;
  /** Total element count - overall DOM complexity */
  totalElementCount: number;
  /** Whether clipping paths are used - advanced masking features */
  hasClipPath: boolean;
  /** Whether masks are used - advanced transparency processing */
  hasMask: boolean;
  /** File size in bytes - memory usage indicator */
  fileSize: number;
}

/**
 * Complexity analysis result interface
 *
 * @description Comprehensive report containing the final results of SVG complexity analysis
 */
export interface ComplexityAnalysisResult {
  /** Collected metrics information */
  metrics: SvgComplexityMetrics;
  /** Normalized complexity score in 0.0 ~ 1.0 range */
  complexityScore: number;
  /** Recommended quality level based on analysis results */
  recommendedQuality: QualityLevel;
  /** Specific reasons behind the recommendation */
  reasoning: string[];
}

/**
 * SVG rendering quality levels
 *
 * @description 4-tier quality levels based on complexity
 * - low: Simple SVG, basic rendering
 * - medium: Moderate complexity, standard quality
 * - high: Complex SVG, high-quality rendering
 * - ultra: Very complex or large SVG, highest quality
 */
export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

/**
 * Main SVG complexity analysis function
 *
 * @description
 * Core function that parses SVG strings to comprehensively analyze complexity
 * and recommend optimal rendering quality levels
 *
 * **Analysis Process:**
 * 1. XML parsing and validation
 * 2. Collection of various complexity metrics
 * 3. Weight-based complexity score calculation
 * 4. Quality level determination and recommendation reasoning generation
 *
 * @param svgString SVG XML string to analyze
 * @returns Complexity analysis result (metrics, score, recommended quality, reasoning)
 *
 * @example
 * ```typescript
 * const result = analyzeSvgComplexity('<svg>...</svg>');
 * console.log(`Complexity: ${result.complexityScore}`);
 * console.log(`Recommended quality: ${result.recommendedQuality}`);
 * console.log(`Reasoning: ${result.reasoning.join(', ')}`);
 * ```
 */
export function analyzeSvgComplexity(svgString: string): ComplexityAnalysisResult {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');

    // Check for parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      throw new Error('SVG parsing failed');
    }

    // Collect metrics
    const metrics = collectMetrics(doc, svgString);

    // Calculate complexity score (0.0 ~ 1.0)
    const complexityScore = calculateComplexityScore(metrics);

    // Determine quality level
    const recommendedQuality = determineQualityLevel(complexityScore, metrics);

    // Generate recommendation reasoning
    const reasoning = generateRecommendationReasoning(metrics, complexityScore);

    return {
      metrics,
      complexityScore,
      recommendedQuality,
      reasoning,
    };
  } catch (error) {
    // Return fallback values on error
    return createFallbackAnalysisResult(svgString, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Collect complexity metrics from SVG document
 *
 * @param doc Parsed SVG document
 * @param svgString Original SVG string (for file size calculation)
 * @returns Collected metrics
 */
function collectMetrics(doc: Document, svgString: string): SvgComplexityMetrics {
  return {
    pathCount: doc.querySelectorAll('path').length,
    gradientCount: doc.querySelectorAll('linearGradient, radialGradient').length,
    filterCount: doc.querySelectorAll('filter').length,
    animationCount: doc.querySelectorAll('animate, animateTransform, animateMotion').length,
    textElementCount: doc.querySelectorAll('text, tspan').length,
    totalElementCount: doc.querySelectorAll('*').length,
    hasClipPath: doc.querySelector('clipPath') !== null,
    hasMask: doc.querySelector('mask') !== null,
    fileSize: new Blob([svgString]).size,
  };
}

/**
 * Complexity score calculation algorithm
 *
 * Calculates overall complexity in 0.0~1.0 range by applying weights to each element
 *
 * @param metrics Collected metrics
 * @returns Complexity score (0.0 ~ 1.0)
 */
function calculateComplexityScore(metrics: SvgComplexityMetrics): number {
  let score = 0;

  // Path complexity (max 0.3 points)
  // More paths make rendering more complex
  score += Math.min(0.3, metrics.pathCount * 0.02);

  // Gradient complexity (max 0.2 points)
  // Gradients require pixel-level calculations with high complexity
  score += Math.min(0.2, metrics.gradientCount * 0.05);

  // Filter complexity (max 0.2 points)
  // Filter effects have the highest computational cost
  score += Math.min(0.2, metrics.filterCount * 0.1);

  // Animation complexity (max 0.1 points)
  // Animation elements have minimal impact on static rendering
  score += Math.min(0.1, metrics.animationCount * 0.02);

  // Text complexity (max 0.1 points)
  // Text rendering complexity varies by font
  score += Math.min(0.1, metrics.textElementCount * 0.02);

  // Advanced feature complexity (max 0.1 points)
  if (metrics.hasClipPath) score += 0.05;
  if (metrics.hasMask) score += 0.05;

  return Math.min(1.0, score);
}

/**
 * Determine quality level based on complexity score and metrics
 *
 * @param complexityScore Complexity score
 * @param metrics Metrics information
 * @returns Recommended quality level
 */
function determineQualityLevel(complexityScore: number, metrics: SvgComplexityMetrics): QualityLevel {
  // Consider file size (50KB+ considered large)
  const isLargeFile = metrics.fileSize > 50000;

  // Whether advanced features are used
  const hasAdvancedFeatures = metrics.hasClipPath || metrics.hasMask || metrics.filterCount > 0;

  // Quality level determination based on complexity and special conditions
  if (complexityScore >= 0.8 || isLargeFile || (hasAdvancedFeatures && complexityScore >= 0.6)) {
    return 'ultra';
  }

  if (complexityScore >= 0.6 || hasAdvancedFeatures) {
    return 'high';
  }

  if (complexityScore >= 0.3) {
    return 'medium';
  }

  return 'low';
}

/**
 * Generate recommendation reasoning text
 *
 * @param metrics Metrics information
 * @param complexityScore Complexity score
 * @returns List of recommendation reasons
 */
function generateRecommendationReasoning(metrics: SvgComplexityMetrics, complexityScore: number): string[] {
  const reasoning: string[] = [];

  // Overall complexity assessment
  if (complexityScore >= 0.8) {
    reasoning.push('Very high overall complexity (high-resolution rendering required)');
  } else if (complexityScore >= 0.6) {
    reasoning.push('High overall complexity');
  } else if (complexityScore >= 0.3) {
    reasoning.push('Moderate complexity level');
  } else {
    reasoning.push('Simple structure');
  }

  // Specific complexity factors
  if (metrics.pathCount > 10) {
    reasoning.push(`Multiple path elements (${metrics.pathCount} paths)`);
  }

  if (metrics.gradientCount > 0) {
    reasoning.push(`Gradient effects used (${metrics.gradientCount} gradients)`);
  }

  if (metrics.filterCount > 0) {
    reasoning.push(`Filter effects used (${metrics.filterCount} filters)`);
  }

  if (metrics.hasClipPath) {
    reasoning.push('Clipping paths used');
  }

  if (metrics.hasMask) {
    reasoning.push('Masks used');
  }

  if (metrics.fileSize > 50000) {
    reasoning.push(`Large file size (${Math.round(metrics.fileSize / 1024)}KB)`);
  }

  if (metrics.animationCount > 0) {
    reasoning.push(`Animation elements included (${metrics.animationCount} animations)`);
  }

  return reasoning;
}

/**
 * Generate fallback result when analysis fails
 *
 * @param svgString Original SVG string
 * @param errorMessage Error message
 * @returns Default analysis result
 */
function createFallbackAnalysisResult(svgString: string, errorMessage: string): ComplexityAnalysisResult {
  const fileSize = new Blob([svgString]).size;

  return {
    metrics: {
      pathCount: 0,
      gradientCount: 0,
      filterCount: 0,
      animationCount: 0,
      textElementCount: 0,
      totalElementCount: 0,
      hasClipPath: false,
      hasMask: false,
      fileSize,
    },
    complexityScore: 0.5, // Assume moderate complexity
    recommendedQuality: fileSize > 50000 ? 'high' : 'medium', // Decision based on file size
    reasoning: [
      'Using default values due to analysis failure',
      `Error: ${errorMessage}`,
      fileSize > 50000 ? 'High quality recommended based on file size' : 'Medium quality recommended',
    ],
  };
}
