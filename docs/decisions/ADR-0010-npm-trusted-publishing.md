# ADR-0010: npm 배포를 태그 push의 trusted publishing으로 일원화

## 상태

Accepted

## 배경

- 5.1.2까지 npm 배포는 개발자 PC에서 `npm login`한 계정으로 `npm publish`를 실행하는 방식이었다. 장기 토큰 또는 OTP가 로컬 환경에 의존했고 배포본에 출처 증명(provenance)이 없었다.
- npm은 GitHub Actions의 OIDC 토큰으로 인증하는 trusted publishing을 제공한다. 패키지 설정에 저장소와 workflow 파일명을 등록하면 토큰 없이 publish할 수 있다. 이 방식은 npm CLI 11.5.1 이상이 필요하고, Node 24에 번들된 npm이 이를 충족한다.
- 첫 CI 실행에서 브라우저 smoke test 1건이 실패했다. GitHub runner는 `localhost`를 `::1`로 먼저 해석해, 기본 설정의 테스트 서버가 IPv6에만 바인딩되었다. 교차 출처 fixture는 `127.0.0.1` 주소를 쓰므로 연결이 거부되었다. 로컬은 IPv4 `localhost`만 있어 재현되지 않았다.

## 결정

1. npm publish는 `v*` 태그 push로 실행되는 GitHub Actions에서만 한다. 인증은 OIDC trusted publishing이며 npm 토큰 secret을 쓰지 않는다. `npm publish --provenance --access public`으로 provenance를 붙인다.
2. publish 전에 세 가지를 모두 확인한다: 태그 커밋이 `main`에 포함되는지, 태그 이름이 `v<package.json 버전>`과 같은지, 릴리스 전체 검증(`verify:release`)이 통과하는지. 하나라도 실패하면 publish하지 않는다.
3. 릴리스 도구(release-it)는 버전 bump, commit, tag, push만 한다. 도구 자체의 npm publish는 끈다. 로컬 직접 `npm publish`는 `prepublishOnly` 가드가 막고, GitHub Actions의 태그 실행과 dry-run만 허용한다.
4. npmjs.com trusted publisher 등록값은 다음과 같다. Organization or user `cp949`, Repository `web-image-util`, Workflow filename `release.yml`, Environment 비움. workflow 파일명을 바꾸면 등록도 함께 바꾼다.
5. 첫 CI publish 성공 뒤 npm 패키지 설정에서 토큰 publish를 막는다.
6. workflow runner 이미지는 `ubuntu-26.04`로 고정한다. 기본 CI와 릴리스 workflow가 같은 이미지에서 실행된다.
7. 브라우저 smoke test는 기본 CI와 릴리스 workflow에서 실행한다. 브라우저 테스트 서버는 `127.0.0.1`에 고정한다.

## 근거

- 장기 토큰을 없애면 토큰 유출로 인한 무단 publish 경로가 사라진다. 5번까지 적용하면 등록된 workflow 외에는 publish할 수 없다.
- provenance는 배포본이 어느 저장소·커밋·workflow에서 빌드되었는지 npm 페이지에서 검증할 수 있게 한다.
- 검토한 대안:
  - 로컬 publish 유지: 인증 정보가 개발자 PC에 남고 provenance를 붙일 수 없어 기각했다.
  - npm 토큰을 CI secret으로 저장: 토큰 유출 경로가 남아 기각했다.
  - 릴리스 workflow에서 브라우저 smoke test를 제외: 첫 실패 직후 임시로 적용했으나, 원인(서버 바인딩)을 확인하고 해결한 뒤 되돌렸다. 제외하면 CI에서 브라우저 회귀를 잡지 못한다.
- 서버 바인딩 host를 `127.0.0.1`로 고정하면 `localhost` 해석 순서와 무관하게 동작한다. 서버가 loopback에만 열려 외부에 노출되지 않는다. GitHub runner에서 이 설정으로 브라우저 테스트 전체가 통과함을 확인했다.
- runner 라벨 `ubuntu-latest`는 이미지 세대가 바뀔 때 동작이 함께 바뀐다. 고정하면 이미지 교체 시점을 저장소가 정한다.

## 영향

- 릴리스 담당 모듈은 검증 후 버전 bump와 태그 push까지만 맡는다. publish는 태그를 받은 CI가 맡는다.
- 릴리스 실행 전 패키지 버전은 직전 배포 버전이어야 한다. 릴리스 도구가 이 값을 올려 태그를 만들기 때문이다. 미리 올려 두면 다음 버전이 배포된다.
- 태그 push는 npm에 되돌릴 수 없는 공개 배포를 일으킨다. 태그는 사용자가 직접 push한다.
- runner 이미지는 새 LTS 이미지가 필요해지면 라벨을 올린다.
- 브라우저 테스트 설정에서 서버 host 고정을 제거하면 `::1` 우선 해석 환경에서 교차 출처 테스트가 다시 실패한다.
