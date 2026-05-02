/**
 * WSL 테스트 환경에서 사용하는 공통 목 설정이다.
 *
 * @description
 * vitest.wsl.config.ts가 참조하는 setup 파일로, Node 기반 테스트와 동일한
 * Canvas/Image 목을 사용해 타입/계약 테스트가 시작 단계에서 실패하지 않게 한다.
 */

import './canvas-mock';
