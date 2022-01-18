# web-image-util

web-image-util은 웹이미지 유틸리티 라이브러리입니다.

## 설치

web-image-util은 [npm에 등록](https://www.npmjs.com/package/@cp949/web-image-util)되어 있습니다.

```bash
npm install @cp949/web-image-util
```

## 사용법

이미지 유틸리티와 리사이즈를 제공합니다.

다음과 같이 import 할 수 있습니다.

```javascript
import { Images } from "@cp949/web-image-util";
```

## Resize

대략 다음과 같이 사용할 수 있습니다

```javascript
const img = await Images.resizeFrom(imgSrc)
  .centerCrop({ size: 300 }) // or centerInside, fit, fill
  .toElement("jpeg"); // or 'png', return HTMLImageElement
```

### Resize 이미지 소스

`Images.resizeFrom( imageSrc )`에서 `imageSrc` 부분에 다음과 같은 항목을 지정할 수 있습니다.

- HTMLImageElement
- Blob
- HTTP URL string(ex: http://...)
- Data URL string(ex: data://...)
- SVG XML string(ex: `<svg ...>...</svg>`)

### Resize 결과물 타입

이미지를 리사이징한 결과물은 다음과 유형을 지원합니다.

- HTMLImageElement
- Data url
- Blob
- File

```javascript
const element = await Images.resizeFrom(imgSrc)
  .centerCrop({ size: 300 })
  .toElement("png"); // HTMLImageElement

const dataUrl = await Images.resizeFrom(imgSrc)
  .centerCrop({ size: 300 })
  .toDataUrl("png"); // Data url string

const blob = await Images.resizeFrom(imgSrc)
  .centerCrop({ size: 300 })
  .toBlob("png"); // Blob

const file = await Images.resizeFrom(imgSrc)
  .centerCrop({ size: 300 })
  .toFile("png", "output.png"); // File
```

- 파일 확장자의 경우는 자동으로 고쳐집니다.
- 아래의 경우 `output.svg`를 지정했지만, `output.png`로 자동으로 고쳐집니다.

```javascript
const file = await Images.resizeFrom(imgSrc)
  .centerCrop({ size: 300 })
  .toFile("png", "output.svg"); // autofix to outpu.png
```

### Resize 이미지 스케일

- 네가지의 스케일 타입이 존재합니다.
  - centerCrop
  - centerInside
  - fit
  - fill

### Resize - centerCrop

- 이미지를 주어진 사각형에 가득 채웁니다.
- 가득 채울때 이미지의 일부는 잘릴 수 있습니다.
- 이미지의 Aspect Ratio는 유지됩니다.
- 지정한 사각형보다 큰 이미지의 경우, 축소됩니다.
- 지정한 사각형보다 작은 이미지의 경우, 확대됩니다.

```javascript
await Images.resizeFrom(img)
  .centerCrop({
    size: {
      width: 400,
      height: 300,
    },
  })
  .toElement("png");
```

### Resize Options

전체 옵션은 다음과 같습니다. 다른 스케일 타입에서도 같은 의미입니다.

```javascript
centerCrop({
  size: { width: 400, height: 300 }, // or size : 400,
  crossOrigin: "Anonymous",
  quality: 0.5, // canvas.toDataURL()에서 사용합니다
  backgroundColor: "#fff", // default: 'transparent'
  padding: 8, // or {top:8, bottom:8, left:8, right:8 }
});
```

#### scale

배율을 지정하여 이미지를 확대/축소할 수도 있습니다. `size` 대신 `scale`을 지정합니다. scale을 지정하면 결과 이미지의 크기는 원본 이미지 크기에 `scale` 곱한 값이 됩니다.

```javascript
centerCrop({
  scale: 1.5, // or scale : {scaleX: 1.5, scaleY: 1.5}
  crossOrigin: "Anonymous",
  quality: 0.5,
  backgroundColor: "#fff",
  padding: 8,
});
```

#### `size`와 `scale`의 우선 순위

- size와 scale을 둘 다 지정한 경우 scale은 무시됩니다. 즉, 지정한 사각형 영역이 우선순위를 갖습니다.
- size와 scale을 둘 다 지정하지 않은 경우는 scale이 1인 것과 동일하게 동작합니다. 즉, 크기가 변경되지 않습니다. 이미지의 포맷만 변경되겠네요.

### Resize - 결과 이미지의 크기

`padding`에 의해 결과 이미지의 크기가 조금 달라집니다.

이미지의 원본 크기가 `800x800`인 경우를 예로 듭니다.

- size 기준 결과 이미지 크기
  - size를 지정한 경우 최종 결과 이미지는 무조건 size입니다.
  - 아래의 결과 이미지의 크기는 `400x400`입니다.
  - 패딩을 제거한, 순수 이미지 영역의 크기는 `384x384`입니다.

```javascript
Images.resizeFrom(img)
  .centerCrop({
    size: 400,
    padding: 8,
  })
  .toDataUrl("png");
```

- scale 기준 결과 이미지 크기
  - scale을 지정한 경우 이미지가 scale 된 후에, padding 만큼 이미지가 늘어납니다.
  - 아래의 결과 이미지의 크기는 `416x416`입니다.
  - 패딩을 제거한 순수 이미지 영역의 크기는 `400x400`입니다.

```javascript
Images.resizeFrom(img)
  .centerCrop({
    scale: 0.5,
    padding: 8,
  })
  .toDataUrl("png");
```

### Resize - centerInside

- 이미지를 주어진 사각형안에 배치합니다.
- 이미지의 일부가 잘리지 않습니다.
- 이미지의 Aspect Ratio는 유지됩니다.
- 지정한 사각형 보다 큰 이미지의 경우 축소됩니다.
- `확대하지는 않습니다.` 지정한 사각형 보다 작은 이미지의 경우, 사각형의 중앙에 배치하며, 확대하지는 않습니다.

```javascript
// imgSrc: 800x800일때 output: 400x300
await Images.resizeFrom(imgSrc)
  .centerInside({
    size: {
      width: 400,
      height: 300,
    },
  })
  .toElement("png");
```

`centerInside`는 보통 큰 이미지를 이미지 잘림 없이 사각형 영역에 넣을 때 사용합니다.

- `trim` 옵션
  - 예를 들어 800x800 이미지를 400x300 사각형에 넣으면, 결과 이미지의 크기는 400x300이고, 거기서 이미지 영역의 크기는 300x300이 됩니다. 만약 결과 이미지의 크기를 이미지 영역의 크기로 만들고 싶다면 `trim` 옵션을 사용할 수 있습니다.
  - trim 은 `centerInside`에만 존재하는 옵션입니다.

```javascript
// imgSrc: 800x800일때 output: 300x300
await Images.resizeFrom(imgSrc)
  .centerInside({
    size: {
      width: 400,
      height: 300,
    },
    trim: true,
  })
  .toElement("png");
```

##### fit

- 이미지를 주어진 사각형안에 배치합니다.
- 이미지의 일부가 잘리지 않습니다.
- 이미지의 Aspect Ratio는 유지됩니다.
- 지정한 사각형 보다 큰 이미지의 경우 축소됩니다.
- 지정한 사각형 보다 작은 이미지의 경우, 사각형 크기만큼 확대됩니다.

```javascript
await Images.resizeFrom(img)
  .fit({
    size: {
      width: 400,
      height: 300,
    },
  })
  .toElement("png");
```

##### fill

- 이미지를 주어진 사각형안에 가득 채웁니다.
- 이미지는 잘리지 않습니다.
- 이미지의 Aspect ratio는 사각형의 비율로 변형됩니다.
- 지정한 사각형 보다 큰 이미지의 경우 축소됩니다.
- 지정한 사각형 보다 작은 이미지의 경우, 사각형 크기만큼 확대됩니다.

```javascript
await Images.resizeFrom(img)
  .fit({
    size: {
      width: 400,
      height: 300,
    },
  })
  .toElement("png");
```

## 기타 이미지 유틸리티

- 이미지 소스를 다운로드

```javascript
import { Images } from "@cp949/web-image-util";

Images.download(imageSrc, "test.png");

// imagsSrc:
//     HTMLImageElement
//     Blob
//     HTTP URL string(ex: http://...)
//     Data URL string(ex: data://...)
//     SVG XML string(ex: `<svg ...>...</svg>`)
```

- 이미지 소스를 HTMLImageElement로 변환

```javascript
import { Images } from "@cp949/web-image-util";

const img = await Images.toElement(imageSrc, "test.png");

// imagsSrc:
//     HTMLImageElement
//     Blob
//     HTTP URL string(ex: http://...)
//     Data URL string(ex: data://...)
//     SVG XML string(ex: `<svg ...>...</svg>`)
```

- 기타 이미지 유틸리티

```javascript
import { Images } from "@cp949/web-image-util";

// Images.util.base64ToBuffer (...)
// Images.util.blobToDataUrl (...)
// Images.util.blobToFile (...)
// Images.util.downloadBlob (...)
// Images.util.downloadLink (...)
// Images.util.fixBlobFileExt (...)
// Images.util.isSvgDataUrl (...)
// Images.util.svgToDataUrl (...)
// Images.util.urlToBlob (...)
// Images.util.urlToFile (...)
// Images.util.urlToBuffer (...)
// Images.util.urlToDataUrl (...)
// Images.util.urlToElement (...)

const blob = await Images.util.urlToBlob(url);
const file = await Images.util.urlToFile(url, "test.png");
const buffer: Uint8Array = await Images.util.urlToBuffer(url, "test.png");
const dataUrl = await Images.util.urlToDataUrl(url);
const img = await.Image.util.urlToElement(url);

const buf: Uint8Array = await Images.util.base64ToBuffer(base64str);
const dataUrl = await Images.util.blobToDataUrl(blob);
const file = await Images.util.blobToFile(blob, "test.png");

// return fixed file name by blob.type
const fixedFileName = Images.util.fixBlobFileExt(blob, "test.png");

const isSvg = Images.util.isSvgDataUrl("data:image/svg+xml...");

const dataUrl = await Images.util.svgToDataUrl("<svg ...>...");
```

## TODO

- resize에 canvasHookFn 추가

```javascript
const element = await Images.resizeFrom(imgSrc)
  .centerCrop({
    size: 300,
    canvasHookFn: (step, canvas, ctx) => {
      if (step === "preSetup") {
        ctx.imageSmoothingEnabled = true;
      } else if (step === "preDraw") {
        ctx.drawImage(bg, 0, 0);
      } else if (step === "postDraw") {
        ctx.drawImage(overlay, 0, 0);
      }
    },
  })
  .toElement("png"); // HTMLImageElement
```
