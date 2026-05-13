/**
 * Node 환경용 FileReader mock.
 *
 * @description readAsDataURL/ArrayBuffer/Text 호출 시 즉시 결과를 채우고 onload를 비동기 트리거한다.
 *   실제 이미지 디코딩은 수행하지 않으며 1x1 투명 PNG Data URL을 고정 반환한다.
 */

if (typeof FileReader === 'undefined') {
  globalThis.FileReader = class MockFileReader {
    result: string | ArrayBuffer | null = null;
    error: DOMException | null = null;
    onload: ((this: FileReader, ev: ProgressEvent) => any) | null = null;
    onerror: ((this: FileReader, ev: ProgressEvent) => any) | null = null;
    onabort: ((this: FileReader, ev: ProgressEvent) => any) | null = null;
    onloadstart: ((this: FileReader, ev: ProgressEvent) => any) | null = null;
    onloadend: ((this: FileReader, ev: ProgressEvent) => any) | null = null;
    onprogress: ((this: FileReader, ev: ProgressEvent) => any) | null = null;
    readyState: number = 0; // EMPTY

    readAsDataURL(blob: Blob) {
      this.readyState = 1; // LOADING

      // Blob 타입을 그대로 사용하고 본문은 1x1 투명 PNG로 고정한다.
      const type = blob.type || 'application/octet-stream';
      const base64Data =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='; // 1x1 transparent PNG
      this.result = `data:${type};base64,${base64Data}`;
      this.readyState = 2; // DONE

      // onload는 마이크로태스크보다 한 박자 뒤에 트리거한다.
      setTimeout(() => {
        if (this.onload) {
          const event = new Event('load') as ProgressEvent;
          this.onload.call(this as any, event);
        }
      }, 0);
    }

    readAsArrayBuffer(blob: Blob) {
      this.readyState = 1; // LOADING

      // Blob 크기만 따라가는 빈 버퍼를 반환한다.
      const buffer = new ArrayBuffer(blob.size);
      this.result = buffer;
      this.readyState = 2; // DONE

      setTimeout(() => {
        if (this.onload) {
          const event = new Event('load') as ProgressEvent;
          this.onload.call(this as any, event);
        }
      }, 0);
    }

    readAsText(blob: Blob) {
      this.readyState = 1; // LOADING
      this.result = 'mock text content';
      this.readyState = 2; // DONE

      setTimeout(() => {
        if (this.onload) {
          const event = new Event('load') as ProgressEvent;
          this.onload.call(this as any, event);
        }
      }, 0);
    }

    abort() {
      this.readyState = 2; // DONE
      if (this.onabort) {
        const event = new Event('abort') as ProgressEvent;
        this.onabort.call(this as any, event);
      }
    }

    addEventListener(type: string, listener: any) {
      if (type === 'load') this.onload = listener;
      else if (type === 'error') this.onerror = listener;
      else if (type === 'abort') this.onabort = listener;
    }

    removeEventListener() {
      // 테스트 환경에서는 별도 정리가 필요하지 않다.
    }

    dispatchEvent() {
      return true;
    }
  } as any;
}
