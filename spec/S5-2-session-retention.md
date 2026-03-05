# S5-2 Session Retention - 90일 유지 + 복구 우선순위

## 배경
웹 새로고침/앱 재실행 시 Google 세션이 사라져 반복 로그인 이슈가 발생.

## 범위
- 세션 쿠키 TTL을 90일로 상향(`SESSION_MAX_AGE_DAYS=90`).
- 웹 쿠키 `Secure` 옵션은 환경 기반(`production`일 때만 true).
- `/api/v1/auth/session`에 `sessionId` 쿼리 fallback 지원.
- 모바일 앱은 `expo-secure-store`에 세션 ID 저장 및 만료(TTL) 기반 복구.

## 복구 우선순위
1. 쿠키 기반 `/api/v1/auth/session`
2. `sessionId` 쿼리 `/api/v1/auth/session?sessionId=...`
3. `GoogleSignin.signInSilently()` 후 `/api/v1/auth/google/session`

## Given / When / Then
1. Given 웹에서 Google 로그인한 세션이 존재할 때,
   When 페이지 새로고침이 일어나면,
   Then `HttpOnly` 세션 쿠키로 재인증 없이 복구된다.

2. Given 모바일 앱 재실행 후 쿠키가 없더라도 SecureStore에 sessionId가 저장되어 있을 때,
   When 앱이 시작되면,
   Then `/api/v1/auth/session?sessionId=...`로 세션이 복구된다.

3. Given 저장된 sessionId가 만료/무효되어 복구 실패 시,
   When 앱이 시작되면,
   Then `GoogleSignin.signInSilently()`를 마지막 폴백으로 시도한다.

## 실패 테스트
- 쿠키에 `Secure` 플래그가 로컬 환경에서 강제 지정되면 실패.
- 쿼리 fallback 없이 시나리오 2가 무시되면 실패.
- SecureStore 만료값이 무효인데도 복구를 계속 시도하면 실패.

## 완료 기준
- `apps/web/src/lib/session-cookie.ts`에서 `SESSION_MAX_AGE_DAYS=90` 적용.
- `apps/web/src/lib/session-store.ts` TTL + 저장/복구/삭제 동작 적용.
- `apps/mobile/App.tsx` 복구 순서 고정 적용.
- `apps/web/tests/api-routes.test.ts`에서 `maxAge` 및 `sessionId` 쿼리 복구 테스트 통과.
