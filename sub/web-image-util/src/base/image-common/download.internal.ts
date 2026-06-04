/**
 * 브라우저 다운로드 DOM 조작을 담당하는 image-common 내부 유틸리티다.
 */

import { debugLog } from '../../utils/debug.internal';

/**
 * Blob을 파일로 다운로드한다.
 *
 * @description 브라우저 환경에서 Blob 다운로드를 처리하고 iOS Safari 우회도 함께 지원한다.
 * @param blob 다운로드할 Blob 객체
 * @param fileName 저장할 파일 이름
 */
export function downloadBlob(blob: Blob, fileName: string) {
  if ('download' in HTMLAnchorElement.prototype) {
    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('crossorigin', 'anonymous');
    document.body.appendChild(downloadLink);
    const url = window.URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = fileName;
    downloadLink.type = blob.type;
    downloadLink.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(downloadLink);
  } else {
    // iOS Safari에서는 새 탭에 Data URL을 열어 다운로드를 우회한다.
    let popup: Window | null = window.open('', '_blank');
    if (popup) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (popup) {
          popup.location.href = reader.result as string;
          popup = null;
        }
      };
      reader.readAsDataURL(blob);
    } else {
      debugLog.warn('window.open() fail');
    }
  }
}

/** 링크를 다운로드 가능한 리소스로 연다. */
export function downloadLink(href: string) {
  if ('download' in HTMLAnchorElement.prototype) {
    const downloadLink = document.createElement('a');
    document.body.appendChild(downloadLink);
    downloadLink.href = href;
    downloadLink.type = 'application/octet-stream';
    downloadLink.click();
    document.body.removeChild(downloadLink);
  } else {
    // iOS Safari에서는 새 탭 열기로 대체한다.
    const popup: Window | null = window.open('', '_blank');
    if (popup) {
      popup.location.href = href;
    } else {
      debugLog.warn('window.open() fail');
    }
  }
}
