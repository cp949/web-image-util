# SVG Crop Utility Design

## Context

`@cp949/web-image-util` currently routes image processing through a browser-only lazy Canvas pipeline. That pipeline preserves SVG quality during resize by rendering only once, but Canvas outputs are raster formats. A crop operation that must return SVG without quality loss should therefore live outside the Canvas pipeline as an SVG-only utility.

The target use case is an image editor loading a displayed `100px x 100px` SVG and cropping a rectangle such as the top-left `50px x 50px`. The result must remain SVG, preserve vector quality, and represent crop regions outside the original image as transparent space.

## Public API

Add an SVG-only utility:

```ts
type SvgCropUnit = 'px' | 'userUnit';

interface SvgCropOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  unit?: SvgCropUnit;
  viewportWidth?: number;
  viewportHeight?: number;
}

function cropSvg(svg: string, options: SvgCropOptions): string;
```

The utility should be exported from the main package entry point and the existing `./utils` export surface.

## Coordinate Rules

`unit` applies to the entire crop rectangle: `x`, `y`, `width`, and `height`.

- `unit: 'px'` means the crop rectangle is expressed in the SVG's rendered CSS pixel space.
- `unit: 'userUnit'` means the crop rectangle is expressed in the SVG `viewBox` coordinate space.
- The default unit is `'px'`, matching image editor interaction coordinates.

For `unit: 'px'`, the utility converts the crop rectangle into source SVG user coordinates using the source display size and `viewBox`.

Example:

```svg
<svg width="100" height="100" viewBox="0 0 200 200">
```

```ts
cropSvg(svg, { x: 0, y: 0, width: 50, height: 50, unit: 'px' });
```

The crop rectangle covers `50px x 50px` in rendered space, which maps to `100 x 100` in source user coordinates.

For `unit: 'userUnit'`, the utility preserves the requested source coordinate size while deriving output display pixels from the original viewBox-to-pixel ratio.

## Output Rules

The result is a new SVG document with:

- `width` and `height` set to the crop rectangle's rendered pixel size.
- `viewBox="0 0 <outputWidth> <outputHeight>"`.
- Transparent background by default.
- Original SVG content preserved as vector content inside the new crop viewport.
- The original root SVG cloned as an inner `<svg>` so its `viewBox`, root attributes, `<defs>`, gradients, filters, and CSS remain attached to the content.
- The inner SVG positioned so the selected source area maps to the outer viewport origin.

For a `100px x 100px` SVG:

```ts
cropSvg(svg, { x: 0, y: 0, width: 50, height: 50 });
```

returns an SVG displayed as `50px x 50px`.

For an outside crop:

```ts
cropSvg(svg, { x: -10, y: -10, width: 50, height: 50 });
```

returns a `50px x 50px` SVG where the original image is shifted inward by `10px, 10px`; the newly exposed top and left area remains transparent.

## Source Dimension Rules

The utility resolves the source display size as follows:

1. If numeric `width` and `height` attributes are present, use them as CSS pixels.
2. If `width` and `height` are absent but a valid `viewBox` exists, treat the viewBox width and height as the rendered pixel size.
3. If dimensions use relative or non-pixel units such as `%`, `em`, or `rem`, require `viewportWidth` and `viewportHeight`.
4. If no display size can be resolved, throw `ImageProcessError`.

The utility resolves the source user coordinate system as follows:

1. If `viewBox` exists, use it.
2. If `viewBox` is absent but numeric display width and height exist, use `0 0 width height`.
3. If neither path is possible, throw `ImageProcessError`.

## Architecture

Implementation should be DOM-based rather than string-regex based:

1. Parse the SVG with `DOMParser`.
2. Validate that the document contains a root `<svg>`.
3. Resolve source display size and source viewBox.
4. Convert the crop rectangle between `px` and source user coordinates when needed.
5. Create a new SVG document with the output display size and `viewBox`.
6. Clone the original root SVG as an inner SVG.
7. Set the inner SVG's display size to the resolved source display size and preserve its source `viewBox`.
8. Position the inner SVG by the negative crop origin in rendered pixel space.
9. Serialize with `XMLSerializer`.

The utility should not rasterize through Canvas, should not create intermediate images, and should not alter unrelated processing pipeline behavior.

## Error Handling

Throw `ImageProcessError` for:

- Invalid XML or missing root `<svg>`.
- Non-finite `x`, `y`, `width`, or `height`.
- `width <= 0` or `height <= 0`.
- Missing dimensions that cannot be inferred from `viewBox`.
- Relative or non-pixel dimensions without explicit `viewportWidth` and `viewportHeight`.

Errors should include actionable suggestions where useful, such as passing `viewportWidth` and `viewportHeight` for relative-size SVGs.

## Testing

Add unit tests under `sub/web-image-util/tests/unit/utils/`.

Required cases:

- Cropping `0,0,50,50` from a `100x100` SVG returns a `50x50` SVG.
- `unit: 'px'` correctly maps a `100x100` display with `viewBox="0 0 200 200"`.
- `unit: 'userUnit'` derives rendered output size from the source viewBox-to-pixel ratio.
- Negative `x` and `y` produce transparent outside space without clipping away the output viewport.
- SVG with only `viewBox` uses viewBox dimensions as pixel fallback.
- Relative dimensions throw without explicit viewport size.
- Relative dimensions succeed with explicit `viewportWidth` and `viewportHeight`.
- Invalid crop sizes throw `ImageProcessError`.

Contract tests should be updated if adding new public exports affects the package export surface.

## Non-Goals

- Do not add `processImage().crop()` in this phase.
- Do not add Canvas-backed SVG output.
- Do not optimize or minify the output SVG.
- Do not rewrite IDs, gradients, filters, or CSS beyond what is required for crop positioning.
