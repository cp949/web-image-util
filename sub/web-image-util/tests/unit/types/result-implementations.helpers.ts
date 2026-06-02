/** result 구현체 테스트에서 img load/error를 동기적으로 제어한다. */
export function createControlledImg(outcome: 'load' | 'error'): HTMLImageElement {
  const img = document.createElement('img') as HTMLImageElement;
  let assignedSrc = '';
  Object.defineProperty(img, 'src', {
    configurable: true,
    get: () => assignedSrc,
    set: (value: string) => {
      assignedSrc = value;
      if (outcome === 'load') {
        img.onload?.(new Event('load'));
      } else {
        img.onerror?.(new Event('error'));
      }
    },
  });
  return img;
}
