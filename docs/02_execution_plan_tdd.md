# RoutineMate 실행 계획 (세부 작업 분해 + 검증 루프)

## 0) 진행 관리 방식
- 단위: 1~2일 내 완료 가능한 작은 작업(Vertical Slice).
- 상태: `todo -> in_progress -> review -> done`.
- 규칙:
  1. 작업 시작 전 Spec/테스트 먼저.
  2. 작업 완료 후 코드 리뷰/검증 체크.
  3. 결함 발견 시 신규 작업으로 환류.

---

## 1) 릴리즈 로드맵

### Phase 1. Foundation (주 1~2)
- P1-1 모노레포/CI/코드 컨벤션 셋업
- P1-2 인증/사용자 프로필/기본 네비게이션
- P1-3 공통 디자인 시스템(토큰/컴포넌트)

### Phase 2. Core Logging (주 3~4)
- P2-1 식단 간편 기록
- P2-2 운동 간편 기록
- P2-3 체중/체지방 기록
- P2-4 날짜별 캘린더 조회/수정

### Phase 3. Goal & Dashboard (주 5~6)
- P3-1 목표 설정(D-day/체중/체지방/루틴횟수)
- P3-2 진행률 계산 엔진
- P3-3 대시보드 시각화

### Phase 4. Habit Loop (주 7~8)
- P4-1 리마인더/푸시
- P4-2 추천/자동완성
- P4-3 템플릿/기록 복사

---

## 2) 상세 백로그 (예시)

## Epic A. 인증/계정
### A-1 이메일 로그인
- Spec
  - Given 미가입 이메일, When 회원가입, Then 계정 생성 및 세션 발급.
  - Given 가입 이메일, When 로그인, Then 대시보드로 이동.
- 테스트
  - 단위: 비밀번호 정책 검증.
  - 통합: 로그인 API 상태코드/에러.
  - E2E: 회원가입→로그인→로그아웃.
- 완료 기준
  - 정상/실패/예외 케이스 테스트 통과.

## Epic B. 식단 기록
### B-1 3초 식단 입력
- Spec
  - Given 날짜가 오늘, When [식사유형+대표음식+양] 입력, Then 3탭 이내 저장.
- 테스트
  - 단위: 입력 스키마(Zod) 검증.
  - 통합: `meal_logs` 저장/수정/삭제.
  - E2E: 모바일/웹 공통 플로우.
- UX 검증
  - 첫 입력 소요 시간 < 15초.
  - 재입력(최근 기록 사용) < 5초.

## Epic C. 운동 기록
### C-1 이름 몰라도 기록
- Spec
  - Given 운동명을 모름, When 부위/도구/목표 선택, Then 후보 운동이 제시됨.
- 테스트
  - 단위: 추천 랭킹 함수(최근 빈도 가중치).
  - 통합: 후보 조회 API + 필터 조합.
  - E2E: 선택→기록 저장→캘린더 반영.

## Epic D. 대시보드
### D-1 주간 진행률 카드
- Spec
  - Given 7일 로그 존재, When 대시보드 조회, Then 목표 대비 달성률 표시.
- 테스트
  - 단위: 달성률 계산 함수(0~100, 경계값).
  - 통합: 집계 쿼리 정확성.
  - 시각 회귀: 차트/카드 레이아웃 스냅샷.

---

## 3) 테스트 전략 (TDD 딥 루프)

## 테스트 피라미드
- Unit 60%: 도메인 계산(점수, 추세, 추천).
- Integration 30%: API + DB + 인증 경계.
- E2E 10%: 핵심 사용자 여정(기록, 조회, 목표 확인).

## 반복 루프(작업 1개당)
1. **Spec 작성**: 인수 조건을 Gherkin 형태로 작성.
2. **Failing tests**: 실패하는 테스트 먼저 커밋.
3. **Minimal pass**: 최소 구현으로 통과.
4. **Refactor**: 가독성/성능 개선.
5. **Review gate**:
   - 코드 리뷰 체크리스트 통과.
   - UX 체크리스트 통과.
   - 성능/접근성 점검.
6. **Regression**: 전체 테스트 재실행.

## 품질 게이트
- PR 머지 조건
  - 단위/통합/E2E 전부 green.
  - Lighthouse 모바일 성능 80+ (핵심 화면).
  - 접근성 주요 항목(라벨/포커스/명도) 충족.

---

## 4) UI/UX 설계 체크리스트
- 모바일 우선(한 손 조작, 큰 터치 타겟).
- 탭 수 최소화(주요 작업 3탭 이내).
- 읽기 쉬운 색/타이포(달력 가독성).
- 빈 상태(Empty state)에서 즉시 행동 유도.
- 기록 성공 피드백(햅틱/토스트/애니메이션).

---

## 5) 역할 기반 협업 구조(Team 대체안)
> Team 스킬이 없어도 같은 효과를 내기 위한 역할 분업 템플릿.

- Product Owner: 요구사항 우선순위/범위 통제.
- UX Lead: 플로우/와이어프레임/사용성 검증.
- Frontend Dev: 웹/앱 UI 구현.
- Backend Dev: API/DB/집계/알림.
- QA Lead: 테스트 시나리오/E2E/회귀.

각 작업은 "담당/검토자"를 분리해서 승인.

---

## 6) 바로 시작할 Sprint 0 제안

1. 리포지토리 초기화(모노레포 + lint/test/CI)
2. 디자인 토큰(색상/간격/타이포) 확정
3. 핵심 사용자 여정 3개에 대한 Spec 작성
   - 식단 빠른 입력
   - 운동 빠른 입력
   - 대시보드 진행률 확인
4. 위 3개 여정의 E2E 테스트 스켈레톤 생성


---

## 7) S3-5 신규 스프린트 (S3-4 -> S4-1 사이)

### S3-5 목적
- 정보구조 3분리, 식단 체크인 모델 전환, day/week/month 버킷 집계, soft delete, 템플릿 CRUD를 한 스프린트로 묶어 정리.

### S3-5 작업 분해
1. `S3-5-1` Notion 스키마 검증 레이어 강화
- Meals/Workouts/BodyMetrics/Goals + (옵션)Template DB 필드 검증
- 누락 시 명시 오류: `필드명 불일치: <DB>.<Field>`

2. `S3-5-2` Dashboard 버킷 엔진 전환
- `range=7d -> day`
- `range=30d -> week`
- `range=90d -> month`
- 샘플링 제거, 버킷 전체 렌더링

3. `S3-5-3` App Router 3페이지 분리
- `/dashboard`, `/records`, `/settings`
- 상단 탭 + 모바일 하단 탭 내비

4. `S3-5-4` Meal Checkin API/UI 전환
- `POST /v1/meal-checkins`
- `PATCH /v1/meal-checkins/:id`
- `DELETE /v1/meal-checkins/:id` (soft delete)
- 슬롯 체크인 카드 UI 적용

5. `S3-5-5` 목표 설정 분리
- 목표 입력은 `/settings` 전용
- `/dashboard`는 read-only 목표 카드

6. `S3-5-6` soft delete 연결
- `DELETE /v1/workout-logs/:id`
- `DELETE /v1/body-metrics/:id`

7. `S3-5-7` 템플릿 CRUD 연결
- `GET/POST/PATCH/DELETE /v1/templates/meals`
- `GET/POST/PATCH/DELETE /v1/templates/workouts`
- 기록 페이지 템플릿 빠른 선택 연동

8. `S3-5-8` 회귀 검증
- typecheck + unit/integration tests + API 계약 테스트

### S3-5 테스트 포인트
- 신규 API 라우트 테스트(meal-checkins/templates/delete)
- 30d 주간 평균, 90d 월간 평균 집계 정확성
- soft delete 후 목록/달력 반영 일치
- 페이지 분리 후 세션/데이터 로드 정상

---

## 8) S3-6 신규 스프린트 (S3-5 -> S4-1 사이)

### S3-6 목적
- 페이지 전환 시 상태 초기화 체감을 제거하고, 저장 액션을 낙관적 UI로 즉시 반영한다.

### S3-6 작업 분해
1. `S3-6-1` Query 전역 계층 도입
- `QueryClientProvider`를 앱 레이아웃에 연결
- 세션/대시보드/일자/목표/템플릿을 query key로 관리

2. `S3-6-2` Bootstrap API 추가
- `GET /v1/bootstrap?view=&date=&range=`
- 페이지 진입 시 스냅샷으로 다중 요청을 묶어 초기 깜빡임 축소

3. `S3-6-3` 세션 UX 일원화
- 설정 페이지에서만 `게스트 세션 시작/세션 확인` 버튼 노출
- 대시보드/기록은 읽기 상태만 노출

4. `S3-6-4` 낙관적 업데이트 + 롤백
- 대상: meal-checkin, workout, bodyMetric, goal, template create/update/deactivate
- 실패 시 query cache rollback + 오류 메시지

5. `S3-6-5` 템플릿 인라인 수정
- 설정 목록 행 단위 `수정/저장/취소`
- `PATCH /v1/templates/meals/:id`, `PATCH /v1/templates/workouts/:id` 연결

6. `S3-6-6` 라벨/간격 UX 정리
- 대시보드 토글 표기 `Day/Week/Month`
- 기록 페이지 저장 버튼 간격 공통 클래스(`action-gap`)로 통일

7. `S3-6-7` 조회 범위 최적화
- `repository`에 range 조회 메서드 추가
- `calendar/day`, `dashboard`가 전체 사용자 히스토리 대신 날짜 범위 조회 사용

8. `S3-6-8` 회귀 검증
- API route test + Playwright 배포 검증 시나리오 확장

### S3-6 테스트 포인트
- 페이지 전환 후 목표/템플릿/기록 즉시 유지
- 템플릿 인라인 수정 후 설정/기록 페이지 동시 반영
- 저장 실패 시 낙관적 상태 롤백
- 대시보드 토글 라벨/집계 단위 정합성 유지

---

## 9) S4 스프린트 (S4-1 ~ S4-4)

### S4-1 리마인더/미기록 감지
- API: `GET/POST /v1/reminders/settings`, `GET /v1/reminders/evaluate`
- 정책: 고정 시간 + 미기록 감지(당일 meal/workout/bodyMetric 모두 0)
- 저장: Notion `ReminderSettings` DB
- 테스트: 설정 저장/재조회, 미기록 -> 기록 후 해제

### S4-2 게스트 -> Google 업그레이드
- API: `POST /v1/auth/upgrade/google`, `POST /v1/auth/google/session`, `GET /v1/auth/google/config`
- 세션 필드 확장: `AuthProvider`, `ProviderSubject`, `AvatarUrl`
- 테스트: 업그레이드 후 `isGuest=false`, 재로그인 시 동일 user 복원

### S4-3 UX/성능/접근성 안정화
- 캐시 우선 렌더 + 동기화 상태 표시
- mutation 낙관 반영 유지 및 실패 롤백 강화
- 버튼 간격 규칙 `action-gap-lg` 통일
- 테스트: 페이지 이동 시 깜빡임 완화, 저장 즉시성 회귀 없음

### S4-4 릴리즈 파이프라인(웹+APK)
- 웹: `deploy:prod:verify`
- 모바일: `eas.json` 기반 `preview/release` APK 빌드
- 릴리즈: GitHub Release APK 첨부 스크립트 + Discord CHANGELOG
- 테스트: env 누락 시 명확 오류, 성공 시 산출물 업로드
