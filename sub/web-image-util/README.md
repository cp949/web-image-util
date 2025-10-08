# @cp949/web-image-util

> High-performance image processing library for web browsers

Provides various image processing capabilities including resizing, SVG processing, and format conversion based on Canvas 2D API.

**Design Philosophy**: Provides powerful image processing capabilities optimized for web browser environments, bringing server-side image processing convenience to the client side with Canvas 2D API.

[![npm version](https://img.shields.io/npm/v/@cp949/web-image-util)](https://www.npmjs.com/package/@cp949/web-image-util)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Key Features

- **🎯 Complete Type Safety**: TypeScript support with Discriminated Union type system
- **🎨 High-Quality SVG Processing**: Special pipeline that fully preserves vector quality
- **🔗 Chainable API**: Convenient usage with intuitive method chaining
- **⚡ High Performance**: Optimizations including Canvas Pool and smart format selection
- **🌐 Zero Dependencies**: Uses only browser native APIs
- **📦 Tree-Shakable**: Bundle size optimization with ES modules

## Installation

```bash
npm install @cp949/web-image-util
```

## 🚀 Quick Start

### ⚡ First Success in 5 Minutes

```typescript
import { processImage } from '@cp949/web-image-util';

// 🎯 Scenario 1: Social media profile image (square, high quality)
const profileImage = await processImage(userPhoto)
  .shortcut.coverBox(400, 400)  // Crop to square
  .toBlob({ format: 'webp', quality: 0.9 });

// 📱 Scenario 2: Responsive thumbnail (fast loading)
const thumbnail = await processImage(originalImage)
  .shortcut.scale(0.5)  // 50% reduction
  .toBlob({ format: 'webp', quality: 0.8 });

// 🎨 Scenario 3: Banner with watermark
const banner = await processImage(backgroundImage)
  .resize({ fit: 'cover', width: 1200, height: 400 })
  .blur(1)  // Slight blur effect
  .toBlob({ format: 'jpeg', quality: 0.85 });
```

### 🎮 More Examples

```typescript
// ✨ Even simpler with convenience functions
import { createThumbnail, createAvatar } from '@cp949/web-image-util/presets';

const thumbnail = await createThumbnail(imageFile, { width: 300, height: 200 });
const avatar = await createAvatar(profilePhoto, { size: 128 });
```

### 📦 Direct Application to Your Project

```bash
# 1. Installation
npm install @cp949/web-image-util

# 2. Type definitions (TypeScript)
import { processImage } from '@cp949/web-image-util';

# 3. First image processing
const result = await processImage(file).shortcut.scale(0.8).toBlob();
```

## 📖 Table of Contents

- [Architecture](#-architecture)
- [Resizing Guide](#-resizing-guide)
- [🚀 Shortcut API](#-shortcut-api)
- [Convenience Functions (Presets)](#-convenience-functions-presets)
- [Input/Output Types](#-inputoutput-types)
- [SVG Processing](#-svg-processing)
- [API Reference](#-api-reference)
- [Browser Support](#-browser-support)

---

## 🏗️ Architecture

### Overall Flow Diagram

```
                         ┌────────────────────┐
                         │  processImage()    │
                         │ (factory function) │
                         └─────────┬──────────┘
                                   │
           ┌───────────────────────┴─────────────────────┐
           │                                             │
   ┌───────▼─────────┐                           ┌───────▼────────┐
   │ SourceConverter │                           │ ImageProcessor │
   │ (source convert)│                           │ (chaining API) │
   └───────┬─────────┘                           └───────┬────────┘
           │                                             │
 ┌─────────▼──────────┐                          ┌───────▼────────┐
 │ SVG Detection      │                          │ LazyPipeline   │
 │ - isInlineSvg()    │                          │ - resize()     │
 │ - sniffSvgFromBlob │                          │ - blur()       │
 │ - MIME + Content   │                          └───────┬────────┘
 └─────────┬──────────┘                                  │
           │                                             │
 ┌─────────▼──────────────┐                ┌─────────────▼─────────────┐
 │ convertSvgToElement    │                │ ResizeCalculator          │
 │ - SVG normalization    │                │ - calculateFinalLayout()  │
 │ - complexity analysis  │                │ - fit mode calculation    │
 │ - quality level select │                └─────────────┬─────────────┘
 │ - high quality render  │                              │
 └────────────────────────┘                ┌─────────────▼─────────────┐
                                           │ OnehotRenderer            │
                                           │ - single drawImage() call │
                                           │ - quality setting         │
                                           │ - background color        │
                                           └───────────────────────────┘
```


### Core Flow

1. **Input Processing**: Convert various sources (File, URL, SVG, etc.) to HTMLImageElement
2. **Operation Accumulation**: Chained methods (.resize(), .blur(), etc.) are stored in LazyPipeline
3. **Batch Rendering**: Execute all processing with a single Canvas operation only at final output
4. **Format Conversion**: Convert Canvas to Blob, DataURL, File, etc.

### Key Features

- **Lazy Rendering**: Memory-efficient processing without creating intermediate Canvas
- **SVG Compatibility**: Automatic correction of browser-specific SVG rendering differences
- **Type Safety**: Prevent incorrect method chaining at compile time
- **Smart Format**: Automatic selection of optimal format based on browser support

---

## 🎯 Resizing Guide

### Fit Modes

Provides 5 different resizing methods:

| fit mode  | Maintain Ratio | Show Full | Add Padding | Crop | Scale        | Use Case                |
| --------- | -------------- | --------- | ----------- | ---- | ------------ | ----------------------- |
| `cover`   | ✅              | ❌         | ❌           | ✅    | Both         | Thumbnails, backgrounds |
| `contain` | ✅              | ✅         | ✅           | ❌    | Both         | Gallery, preview        |
| `fill`    | ❌              | ✅         | ❌           | ❌    | Both         | Exact size needed       |
| `maxFit`  | ✅              | ✅         | ❌           | ❌    | Shrink only  | Maximum size limit      |
| `minFit`  | ✅              | ✅         | ❌           | ❌    | Enlarge only | Minimum size guarantee  |

### Basic Usage

```typescript
// cover: Maintain ratio and fill entire area (default, cropping possible)
await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toBlob();

// contain: Maintain ratio and show full image (padding added)
await processImage(source)
  .resize({
    fit: 'contain',
    width: 300,
    height: 200,
    background: '#ffffff'  // Padding color
  })
  .toBlob();

// fill: Ignore ratio and fit exactly (image distorted)
await processImage(source)
  .resize({ fit: 'fill', width: 300, height: 200 })
  .toBlob();

// maxFit: Shrink only (no enlargement) - Protect original size
await processImage(source)
  .resize({ fit: 'maxFit', width: 800, height: 600 })
  .toBlob();

// minFit: Enlarge only (no shrinking) - Guarantee minimum size
await processImage(source)
  .resize({ fit: 'minFit', width: 800, height: 600 })
  .toBlob();
```

### Specifying Only One Dimension

```typescript
// Specify width only (height calculated automatically based on ratio)
await processImage(source)
  .resize({ fit: 'maxFit', width: 800 })
  .toBlob();

// Specify height only (width calculated automatically based on ratio)
await processImage(source)
  .resize({ fit: 'maxFit', height: 600 })
  .toBlob();
```

### Practical Examples

```typescript
// Thumbnail (square, cropping allowed)
const thumbnail = await processImage(photo)
  .resize({ fit: 'cover', width: 200, height: 200 })
  .toBlob({ format: 'webp', quality: 0.8 });

// Profile avatar (high quality)
const avatar = await processImage(userPhoto)
  .resize({ fit: 'cover', width: 150, height: 150 })
  .toBlob({ format: 'png', quality: 0.9 });

// Mobile optimization (protect original size)
const mobile = await processImage(photo)
  .resize({ fit: 'maxFit', width: 400 })
  .toBlob({ format: 'webp', quality: 0.7 });
```

### Important: resize() Constraints

**resize() can only be called once.** This is a design decision to ensure image quality (especially for SVG).

```typescript
// ❌ Error: Calling resize() twice
const wrong = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .resize({ fit: 'contain', width: 400, height: 300 }); // 💥 ImageProcessError

// ✅ Correct: Specify final size directly
const correct = await processImage(source)
  .resize({ fit: 'contain', width: 400, height: 300 })
  .toBlob();
```

---

## 🚀 Shortcut API

Provides intuitive shortcut API similar to Sharp.js. Commonly used resizing patterns can be expressed concisely.

### Usage

```typescript
import { processImage } from '@cp949/web-image-util';

// Easy usage with Shortcut API
const result = await processImage(source)
  .shortcut.coverBox(300, 200)
  .toBlob();

// Chaining is also possible
const blurred = await processImage(source)
  .shortcut.scale(1.5)
  .blur(2)
  .toBlob();
```

### Direct Mapping

Convenience methods that are immediately converted to ResizeConfig.

```typescript
// Fill box completely (some parts may be cropped)
await processImage(source).shortcut.coverBox(300, 200).toBlob();

// Fit entire image within box
await processImage(source).shortcut.containBox(300, 200).toBlob();

// Convert to exact size
await processImage(source).shortcut.exactSize(300, 200).toBlob();

// Size limits
await processImage(source).shortcut.maxWidth(500).toBlob();
await processImage(source).shortcut.maxHeight(400).toBlob();
await processImage(source).shortcut.maxSize({ width: 800, height: 600 }).toBlob();

// Minimum size guarantee
await processImage(source).shortcut.minWidth(300).toBlob();
await processImage(source).shortcut.minHeight(200).toBlob();
await processImage(source).shortcut.minSize({ width: 400, height: 300 }).toBlob();
```

### Lazy Operations

Operations calculated based on the original image size. Actual calculation is performed at the final output.

```typescript
// Uniform scaling
await processImage(source).shortcut.scale(1.5).toBlob();        // 1.5x enlargement
await processImage(source).shortcut.scale(0.5).toBlob();        // 0.5x reduction

// Specify one dimension
await processImage(source).shortcut.exactWidth(300).toBlob();   // Adjust to 300px width
await processImage(source).shortcut.exactHeight(200).toBlob();  // Adjust to 200px height

// Individual axis scaling
await processImage(source).shortcut.scaleX(2).toBlob();         // 2x horizontal only
await processImage(source).shortcut.scaleY(0.5).toBlob();       // 0.5x vertical only
await processImage(source).shortcut.scaleXY(2, 1.5).toBlob();   // 2x horizontal, 1.5x vertical

// Object form also available
await processImage(source).shortcut.scale({ sx: 2, sy: 1.5 }).toBlob();
```

### ScaleOperation Type

The `scale` method can accept various forms of scale values:

```typescript
// Uniform scale
scale(2)                      // number

// Horizontal only
scale({ sx: 2 })              // { sx: number }

// Vertical only
scale({ sy: 1.5 })            // { sy: number }

// Individual settings
scale({ sx: 2, sy: 0.75 })    // { sx: number, sy: number }
```

### Chaining

Shortcut API can be freely combined with other methods:

```typescript
// Shortcut + blur
const result = await processImage(source)
  .shortcut.coverBox(300, 200)
  .blur(3)
  .toBlob({ format: 'webp', quality: 0.8 });

// Lazy operation + blur
const scaled = await processImage(source)
  .shortcut.scale(1.5)
  .blur(2)
  .toDataURL();

// Complex chaining
const complex = await processImage(source)
  .shortcut.exactWidth(300)
  .blur(2)
  .toBlob();
```

### Option Support

Some methods support additional options:

```typescript
// containBox options
await processImage(source).shortcut.containBox(300, 200, {
  padding: { top: 10, bottom: 10, left: 10, right: 10 },
  background: '#ffffff',
  trimEmpty: true,
  withoutEnlargement: true
}).toBlob();

// coverBox options
await processImage(source).shortcut.coverBox(300, 200, {
  padding: { top: 5, bottom: 5, left: 5, right: 5 },
  background: '#000000'
}).toBlob();
```

---

## 📋 Convenience Functions (Presets)

Functions that automatically apply optimized settings for each purpose.

```typescript
import {
  createThumbnail,
  createAvatar,
  createSocialImage
} from '@cp949/web-image-util/presets';

// Web thumbnail (performance optimized)
const thumbnail = await createThumbnail(source, {
  size: 300,           // 300x300 square
  format: 'webp',      // WebP first (JPEG if not supported)
  quality: 0.8         // Moderate quality
});

// Profile avatar (quality first)
const avatar = await createAvatar(userPhoto, {
  size: 64,            // 64x64
  format: 'png',       // PNG (transparency support)
  quality: 0.9         // High quality
});

// Social media image (compatibility first)
const instagramPost = await createSocialImage(photo, {
  platform: 'instagram',  // 1080x1080 auto applied
  format: 'jpeg',         // JPEG (compatibility first)
  quality: 0.85           // Balanced quality
});

// Supported platforms: 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'pinterest'
```

---

## 📥📤 Input/Output Types

### Input (ImageSource)

Supports various types of image sources:

```typescript
// File/Blob objects
const file = document.querySelector('input[type="file"]').files[0];
await processImage(file).resize({ width: 300, height: 200 }).toBlob();

// HTTP(S) URL
await processImage('https://example.com/photo.jpg')
  .resize({ width: 300, height: 200 })
  .toBlob();

// Data URL
await processImage('data:image/jpeg;base64,/9j/4AAQ...')
  .resize({ width: 300, height: 200 })
  .toBlob();

// HTMLImageElement
const img = document.querySelector('img');
await processImage(img).resize({ width: 300, height: 200 }).toBlob();

// ArrayBuffer / Uint8Array
await processImage(arrayBuffer).resize({ width: 300, height: 200 }).toBlob();

// SVG string
const svgXml = '<svg width="100" height="100">...</svg>';
await processImage(svgXml).resize({ width: 200, height: 200 }).toBlob();
```

### Output Formats

#### toBlob() - For file upload

```typescript
const result = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toBlob({ format: 'webp', quality: 0.8 });

// Metadata
console.log(result.blob);           // Blob object
console.log(result.width);          // Post-processing width
console.log(result.height);         // Post-processing height
console.log(result.processingTime); // Processing time (ms)

// Upload with FormData
const formData = new FormData();
formData.append('image', result.blob);
await fetch('/upload', { method: 'POST', body: formData });
```

#### toDataURL() - For immediate display

```typescript
const result = await processImage(source)
  .resize({ fit: 'contain', width: 300, height: 200 })
  .toDataURL({ format: 'png' });

// Direct use in img tag
document.querySelector('img').src = result.dataURL;
```

#### toFile() - With filename

```typescript
const result = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toFile('thumbnail.webp', { quality: 0.8 });

console.log(result.file.name);  // 'thumbnail.webp'
console.log(result.file.size);  // File size (bytes)
```

#### toCanvas() - For additional processing

```typescript
const canvas = await processImage(source)
  .resize({ fit: 'contain', width: 300, height: 200 })
  .toCanvas();

// Additional drawing operations on canvas
const ctx = canvas.getContext('2d');
ctx.fillText('Watermark', 10, 20);
```

---

## 🎨 SVG Processing

### Automatic SVG Detection and High-Quality Rendering

The **core technology** of the library, accurately and safely detecting various forms of SVG input to fully preserve vector quality.

#### Supported SVG Source Types

```typescript
// 1. SVG XML string
const svgXml = '<svg width="100" height="100">...</svg>';
await processImage(svgXml).resize({ width: 200, height: 200 }).toBlob();

// 2. Data URL SVG
const svgDataUrl = 'data:image/svg+xml;base64,PHN2Zz4uLi48L3N2Zz4=';
await processImage(svgDataUrl).resize({ width: 200, height: 200 }).toBlob();

// 3. HTTP(S) URL (.svg extension or Content-Type: image/svg+xml)
await processImage('https://example.com/icon.svg')
  .resize({ width: 200, height: 200 })
  .toBlob();

// 4. File/Blob object (type='image/svg+xml' or .svg extension)
const svgFile = new File([svgXml], 'icon.svg', { type: 'image/svg+xml' });
await processImage(svgFile).resize({ width: 200, height: 200 }).toBlob();
```

#### SVG Quality Guarantee

Ensures sharp results regardless of SVG resizing size:

```typescript
// High-quality SVG resizing - sharp even when enlarged to 1000x1000
const result = await processImage(svgString)
  .resize({ fit: 'cover', width: 1000, height: 1000 })
  .toBlob({ format: 'png' });
```

**Technical Features**:
- ✅ **Vector Quality Preservation**: Keep SVG original intact and render directly to target size on Canvas
- ✅ **Accurate Detection**: Precise `<svg>` tag matching after removing BOM, XML prologue, comments, DOCTYPE
- ✅ **False Positive Prevention**: Accurately distinguish non-SVG sources like SVG in HTML, general XML
- ✅ **Dual Verification**: Safe detection through MIME type + content sniffing

#### SVG Compatibility Enhancement (Optional)

Automatically fix and render non-standard SVGs:

```typescript
import { enhanceBrowserCompatibility } from '@cp949/web-image-util/utils';

const { enhanced, report } = enhanceBrowserCompatibility(svgString, {
  fixDimensions: true,    // Fix dimension attributes
  addNamespaces: true,    // Auto-add xmlns attributes
  modernizeSyntax: true   // Modernize legacy syntax
});

console.log('Processing result:', report.warnings);
await processImage(enhanced).resize({ width: 300, height: 200 }).toBlob();
```

---

## 📚 API Reference

### processImage()

The main entry point function that starts image processing chaining.

```typescript
function processImage(source: ImageSource): ImageProcessor
```

### ImageProcessor Class

#### .resize(config: ResizeConfig)

Resizes the image. **Can only be called once.**

```typescript
interface ResizeConfig {
  fit: 'cover' | 'contain' | 'fill' | 'maxFit' | 'minFit';
  width?: number;
  height?: number;
  background?: string;  // Padding color in contain mode
  padding?: number | { top?, right?, bottom?, left? };
  trimEmpty?: boolean;  // Remove padding in contain mode
}
```

#### .blur(radius: number)

Applies blur effect (radius 1-10).

```typescript
await processImage(source)
  .resize({ fit: 'cover', width: 400, height: 300 })
  .blur(3)
  .toBlob();
```

#### Output Methods

```typescript
// Return as Blob
await processor.toBlob(options?: {
  format?: 'jpeg' | 'png' | 'webp' | 'avif',
  quality?: number  // 0-1
}): Promise<ResultBlob>

// Return as Data URL
await processor.toDataURL(options?): Promise<ResultDataURL>

// Return as File object
await processor.toFile(filename: string, options?): Promise<ResultFile>

// Return as Canvas element
await processor.toCanvas(): Promise<HTMLCanvasElement>
```

### Type Definitions

```typescript
// Input source types
type ImageSource =
  | HTMLImageElement
  | Blob
  | File
  | ArrayBuffer
  | Uint8Array
  | string; // URL, Data URL, SVG XML, file path

// Result types
interface ResultBlob {
  blob: Blob;
  width: number;
  height: number;
  format: ImageFormat;
  size: number;          // bytes
  processingTime: number; // ms
}

// Error class
class ImageProcessError extends Error {
  code: string;  // 'INVALID_INPUT', 'PROCESSING_FAILED', 'OUTPUT_FAILED', etc.
  details?: any;
}
```

### Utility Functions

```typescript
// SVG compatibility enhancement
import { enhanceBrowserCompatibility, enhanceSvgForBrowser } from '@cp949/web-image-util/utils';

// SVG complexity analysis
import { analyzeSvgComplexity } from '@cp949/web-image-util';

// SVG dimension extraction
import { extractSvgDimensions } from '@cp949/web-image-util';

// Format conversion
import { toBlob, toDataURL, toFile } from '@cp949/web-image-util/utils';
```

---

## ⚙️ Browser Support

**Recommended Browser Versions**:
- Chrome 88+
- Firefox 90+
- Safari 14+
- Edge 88+

**Feature Check**:

```typescript
import { features } from '@cp949/web-image-util';

console.log(features.webp);           // WebP support
console.log(features.avif);           // AVIF support
console.log(features.offscreenCanvas); // OffscreenCanvas support
console.log(features.imageBitmap);    // ImageBitmap support
```

---

## 🚨 Error Handling

```typescript
import { processImage, ImageProcessError } from '@cp949/web-image-util';

try {
  const result = await processImage(source)
    .resize({ fit: 'cover', width: 300, height: 200 })
    .toBlob();
} catch (error) {
  if (error instanceof ImageProcessError) {
    console.error(`[${error.code}] ${error.message}`);
    // Error codes: 'INVALID_INPUT', 'INVALID_DIMENSIONS', 'PROCESSING_FAILED',
    //              'OUTPUT_FAILED', 'MULTIPLE_RESIZE_NOT_ALLOWED', etc.

    if (error.details) {
      console.log('Details:', error.details);
    }
  }
}
```

---

## 📦 Sub-packages

Optimize bundle size by importing only needed features:

```typescript
// Main API
import { processImage } from '@cp949/web-image-util';

// Convenience functions
import { createThumbnail, createAvatar } from '@cp949/web-image-util/presets';

// Utility functions
import { enhanceBrowserCompatibility } from '@cp949/web-image-util/utils';
```

---

## 📄 License

MIT License

---

## 🔗 Related Links

- [GitHub Repository](https://github.com/cp949/web-image-util)
- [npm Package](https://www.npmjs.com/package/@cp949/web-image-util)
- [Example App](../../apps/exam/) - Interactive demo

---

<div align="center">

Made with ❤️ for the web

</div>
