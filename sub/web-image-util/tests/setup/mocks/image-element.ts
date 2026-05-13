/**
 * HTMLImageElement / Image 관련 mock.
 *
 * @description src 설정 시 즉시 로드 완료 상태로 전이하도록 한다. 실제 디코딩 타이밍은 보장하지 않는다.
 */

// HTMLImageElement 목이다.
export class MockHTMLImageElement {
  private _src: string = '';
  width: number = 100;
  height: number = 100;
  naturalWidth: number = 100;
  naturalHeight: number = 100;
  complete: boolean = false;
  onload: ((this: HTMLImageElement, ev: Event) => any) | null = null;
  onerror: ((this: HTMLImageElement, ev: Event) => any) | null = null;

  // src 접근자를 통해 로딩 완료 상태를 흉내 낸다.
  get src(): string {
    return this._src;
  }

  set src(value: string) {
    this._src = value;

    // src가 설정되면 즉시 로딩 완료로 간주한다.
    // Blob URL과 Data URL은 기본 크기 정보도 함께 맞춘다.
    if (value.startsWith('blob:') || value.startsWith('data:')) {
      // 기존 크기가 없으면 기본 크기를 사용한다.
      if (!this.naturalWidth || this.naturalWidth === 0) this.naturalWidth = 100;
      if (!this.naturalHeight || this.naturalHeight === 0) this.naturalHeight = 100;
      this.width = this.naturalWidth;
      this.height = this.naturalHeight;
    }

    this.complete = true;

    // onload가 연결돼 있으면 즉시 호출한다.
    const callback = this.onload;
    if (callback) {
      try {
        callback.call(this as any, new Event('load'));
      } catch (error) {
        console.error('Mock Image onload error:', error);
      }
    }
  }
}

// document.createElement('img')와 new Image()가 같은 클래스를 바라보게 맞춘다.
// @ts-expect-error - 전역 타입 확장
global.HTMLImageElement = MockHTMLImageElement;
// @ts-expect-error - 전역 타입 확장
global.Image = MockHTMLImageElement;
