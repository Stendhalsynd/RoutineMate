# RoutineMate Notion DB Setup

## 1) 사전 준비

### S3-5 기준 변경 요약 (기존 설정 대비)

### 기존 DB에서 추가/변경해야 할 필드
- `Meals`: `MealSlot(Select)`, `Completed(Checkbox)`, `TemplateId(Rich text)`, `IsDeleted(Checkbox)`, `DeletedAt(Date)` 추가
- `Workouts`: `TemplateId(Rich text)`, `IsDeleted(Checkbox)`, `DeletedAt(Date)` 추가
- `BodyMetrics`: `IsDeleted(Checkbox)`, `DeletedAt(Date)` 추가
- `FoodLabel`, `MealType`, `PortionSize`는 하위호환 필드로 유지 가능(필수 아님)

### 새로 추가해야 할 DB 페이지
- `RoutineMate MealTemplates`
- `RoutineMate WorkoutTemplates`

### .env / Vercel 환경변수 추가
- `NOTION_DB_MEAL_TEMPLATES`
- `NOTION_DB_WORKOUT_TEMPLATES`
- `NOTION_DB_REMINDER_SETTINGS`

템플릿 관리 기능(`/settings` 템플릿 CRUD)을 사용하려면 위 2개를 반드시 설정해야 합니다.
S4 리마인더 기능을 사용하려면 `NOTION_DB_REMINDER_SETTINGS`가 필요합니다.

1. Notion에서 `Internal Integration` 생성
- Integration 생성 후 `Internal Integration Token` 확보

2. 아래 7개 데이터베이스 생성
- `RoutineMate Sessions`
- `RoutineMate Meals`
- `RoutineMate Workouts`
- `RoutineMate BodyMetrics`
- `RoutineMate Goals`
- `RoutineMate MealTemplates`
- `RoutineMate WorkoutTemplates`
- `RoutineMate ReminderSettings`

3. 각 데이터베이스를 Integration에 공유
- DB 우측 상단 `...` -> `Connections` -> 생성한 Integration 연결

4. DB ID 확보
- DB URL에서 UUID 추출
- 예시 URL: `https://www.notion.so/workspace/<db_id>?v=<view_id>`

5. 환경변수 설정 (`.env`, Vercel Project Env 모두)
- `NOTION_TOKEN=...`
- `NOTION_DB_SESSIONS=...`
- `NOTION_DB_MEALS=...`
- `NOTION_DB_WORKOUTS=...`
- `NOTION_DB_BODY_METRICS=...`
- `NOTION_DB_GOALS=...`
- `NOTION_DB_MEAL_TEMPLATES=...`
- `NOTION_DB_WORKOUT_TEMPLATES=...`
- `NOTION_DB_REMINDER_SETTINGS=...`
- `GOOGLE_WEB_CLIENT_ID=...`
- `GOOGLE_ANDROID_CLIENT_ID=...`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...`

APK 릴리즈(S4-4) 참고:
- 로컬 Gradle 빌드 전략을 사용하며, Android SDK/JDK가 필요합니다.
- GitHub Release 자동 업로드를 사용하면 `GITHUB_TOKEN`(또는 `gh auth login`)이 필요합니다.
- 로컬 APK 빌드는 Android SDK/JDK 환경변수(`ANDROID_HOME` 또는 `ANDROID_SDK_ROOT`)가 필요합니다.

---

## 2) 데이터베이스별 컬럼 스키마 (Notion 타입 준수)

주의:
- 컬럼명은 아래와 동일하게 생성해야 서버 매핑과 1:1로 동작함.
- 각 DB는 Notion 제약상 `Title` 타입 1개가 반드시 필요함.

## Sessions DB (`NOTION_DB_SESSIONS`)

| 컬럼명 | 타입(Notion) | 필수 | 설명 |
|---|---|---|---|
| `Name` | `Title` | Y | `sessionId` 저장 |
| `UserId` | `Rich text` | Y | 내부 사용자 식별자 |
| `IsGuest` | `Checkbox` | Y | 게스트 여부 |
| `Email` | `Email` | N | 업그레이드 후 이메일 |
| `CreatedAt` | `Date` | Y | 세션 생성 시각 |
| `UpgradedAt` | `Date` | N | 계정 업그레이드 시각 |
| `AuthProvider` | `Select` | N | `guest` 또는 `google` |
| `ProviderSubject` | `Rich text` | N | Google `sub` 식별자 |
| `AvatarUrl` | `URL` | N | Google 프로필 이미지 URL |

## Meals DB (`NOTION_DB_MEALS`)

| 컬럼명 | 타입(Notion) | 필수 | 설명 |
|---|---|---|---|
| `Name` | `Title` | Y | 표시용 제목(예: `2026-02-28 샐러드`) |
| `Id` | `Rich text` | Y | meal log id |
| `UserId` | `Rich text` | Y | 사용자 식별자 |
| `Date` | `Date` | Y | 기록 날짜 |
| `MealType` | `Select` | N | 하위호환(`breakfast`/`lunch`/`dinner`/`snack`) |
| `FoodLabel` | `Rich text` | N | 하위호환 필드(오타 금지) |
| `PortionSize` | `Select` | N | 하위호환 필드 |
| `MealSlot` | `Select` | Y | `breakfast`/`lunch`/`dinner`/`dinner2` |
| `Completed` | `Checkbox` | Y | 체크인 완료 여부 |
| `TemplateId` | `Rich text` | N | 연결된 식단 템플릿 ID |
| `IsDeleted` | `Checkbox` | Y | 소프트 삭제 여부 |
| `DeletedAt` | `Date` | Y | 소프트 삭제 일시 |
| `CreatedAt` | `Date` | Y | 생성 시각 |

## Workouts DB (`NOTION_DB_WORKOUTS`)

| 컬럼명 | 타입(Notion) | 필수 | 설명 |
|---|---|---|---|
| `Name` | `Title` | Y | 표시용 제목 |
| `Id` | `Rich text` | Y | workout log id |
| `UserId` | `Rich text` | Y | 사용자 식별자 |
| `Date` | `Date` | Y | 기록 날짜 |
| `BodyPart` | `Select` | Y | `chest/back/legs/core/shoulders/arms/full_body/cardio` |
| `Purpose` | `Select` | Y | `muscle_gain/fat_loss/endurance/mobility/recovery` |
| `Tool` | `Select` | Y | `bodyweight/dumbbell/machine/barbell/kettlebell/mixed` |
| `ExerciseName` | `Rich text` | Y | 운동명 |
| `TemplateId` | `Rich text` | N | 연결된 운동 템플릿 ID |
| `Intensity` | `Select` | Y | `low/medium/high` |
| `Sets` | `Number` | N | 세트 |
| `Reps` | `Number` | N | 반복 |
| `WeightKg` | `Number` | N | 중량 |
| `DurationMinutes` | `Number` | N | 운동 시간 |
| `IsDeleted` | `Checkbox` | Y | 소프트 삭제 여부 |
| `DeletedAt` | `Date` | Y | 소프트 삭제 일시 |
| `CreatedAt` | `Date` | Y | 생성 시각 |

## BodyMetrics DB (`NOTION_DB_BODY_METRICS`)

| 컬럼명 | 타입(Notion) | 필수 | 설명 |
|---|---|---|---|
| `Name` | `Title` | Y | 표시용 제목 |
| `Id` | `Rich text` | Y | body metric id |
| `UserId` | `Rich text` | Y | 사용자 식별자 |
| `Date` | `Date` | Y | 기록 날짜 |
| `WeightKg` | `Number` | N | 체중 |
| `BodyFatPct` | `Number` | N | 체지방률 |
| `IsDeleted` | `Checkbox` | Y | 소프트 삭제 여부 |
| `DeletedAt` | `Date` | Y | 소프트 삭제 일시 |
| `CreatedAt` | `Date` | Y | 생성 시각 |

## Goals DB (`NOTION_DB_GOALS`)

| 컬럼명 | 타입(Notion) | 필수 | 설명 |
|---|---|---|---|
| `Name` | `Title` | Y | 고정값 `Goal` 사용 |
| `Id` | `Rich text` | Y | goal id |
| `UserId` | `Rich text` | Y | 사용자 식별자 |
| `WeeklyRoutineTarget` | `Number` | Y | 주간 목표 횟수 |
| `DDay` | `Date` | N | 목표 날짜 |
| `TargetWeightKg` | `Number` | N | 목표 체중 |
| `TargetBodyFat` | `Number` | N | 목표 체지방 |
| `CreatedAt` | `Date` | Y | 생성 시각 |

---

## 3) Select 옵션 값 (정확히 동일)

## Meals
- `MealType`: `breakfast`, `lunch`, `dinner`, `snack`
- `PortionSize`: `small`, `medium`, `large`
- `MealSlot`: `breakfast`, `lunch`, `dinner`, `dinner2`

## Workouts
- `BodyPart`: `chest`, `back`, `legs`, `core`, `shoulders`, `arms`, `full_body`, `cardio`
- `Purpose`: `muscle_gain`, `fat_loss`, `endurance`, `mobility`, `recovery`
- `Tool`: `bodyweight`, `dumbbell`, `machine`, `barbell`, `kettlebell`, `mixed`
- `Intensity`: `low`, `medium`, `high`

---

## 4) 배포 후 확인 체크리스트

1. `게스트 세션 시작` 성공
2. 목표 저장 성공
3. 식단 저장 성공
4. 운동 저장 성공
5. 체중/체지방 저장 성공
6. 새로고침 후 기록 유지(쿠키 기반 세션 + Notion 조회)

---

## 5) 템플릿 DB (신규)

## MealTemplates DB (`NOTION_DB_MEAL_TEMPLATES`)

| 컬럼명 | 타입(Notion) | 필수 | 설명 |
|---|---|---|---|
| `Name` | `Title` | Y | 표시용 제목 |
| `Id` | `Rich text` | Y | 템플릿 id |
| `UserId` | `Rich text` | Y | 사용자 식별자 |
| `Label` | `Rich text` | Y | 템플릿 이름 |
| `MealSlot` | `Select` | Y | `breakfast/lunch/dinner/dinner2` |
| `IsActive` | `Checkbox` | Y | 활성 여부 |
| `CreatedAt` | `Date` | Y | 생성 시각 |

## WorkoutTemplates DB (`NOTION_DB_WORKOUT_TEMPLATES`)

| 컬럼명 | 타입(Notion) | 필수 | 설명 |
|---|---|---|---|
| `Name` | `Title` | Y | 표시용 제목 |
| `Id` | `Rich text` | Y | 템플릿 id |
| `UserId` | `Rich text` | Y | 사용자 식별자 |
| `Label` | `Rich text` | Y | 템플릿 이름 |
| `BodyPart` | `Select` | Y | 운동 부위 |
| `Purpose` | `Select` | Y | 운동 목적 |
| `Tool` | `Select` | Y | 운동 도구 |
| `DefaultDuration` | `Number` | N | 기본 운동 시간(분) |
| `IsActive` | `Checkbox` | Y | 활성 여부 |
| `CreatedAt` | `Date` | Y | 생성 시각 |

## 6) 스키마 오류 트러블슈팅
- 앱은 시작 시 필수 컬럼 존재를 검사합니다.
- 컬럼명이 다르면 `필드명 불일치: <DB>.<Field>` 형식으로 API 에러를 반환합니다.
- 예: `Meals.DeletedAt` 누락 시 삭제 API 호출에서 실패합니다.

참고:
- `FoodLabel`은 현재 하위호환용 optional 필드입니다.
- 다만 과거 데이터/호환성을 위해 컬럼을 남겨두는 것은 권장합니다.

## 6-1) ReminderSettings DB (신규)

| 컬럼명 | 타입(Notion) | 필수 | 설명 |
|---|---|---|---|
| `Name` | `Title` | Y | 고정값 `ReminderSettings` |
| `Id` | `Rich text` | Y | 설정 id |
| `UserId` | `Rich text` | Y | 사용자 식별자 |
| `IsEnabled` | `Checkbox` | Y | 리마인더 활성화 여부 |
| `DailyReminderTime` | `Rich text` | Y | `HH:MM` |
| `MissingLogReminderTime` | `Rich text` | Y | `HH:MM` |
| `Channels` | `Rich text` | Y | `web_in_app,mobile_local` 같은 CSV |
| `Timezone` | `Rich text` | Y | 예: `Asia/Seoul` |
| `CreatedAt` | `Date` | Y | 생성 시각 |
| `UpdatedAt` | `Date` | Y | 마지막 변경 시각 |

## 7) 자동 점검 스크립트

Notion 실제 DB 컬럼이 문서/코드 스키마와 맞는지 API로 자동 점검합니다.

실행:
```bash
npm run notion:schema:check
```

동작:
- `.env`를 로드한 뒤 Notion `GET /v1/databases/{id}` 호출
- DB별 required 필드 누락 시 `FAIL` + 종료코드 1
- optional 필드 누락 시 `WARN`만 출력

점검 대상 env:
- `NOTION_DB_SESSIONS`
- `NOTION_DB_MEALS`
- `NOTION_DB_WORKOUTS`
- `NOTION_DB_BODY_METRICS`
- `NOTION_DB_GOALS`
- `NOTION_DB_MEAL_TEMPLATES`
- `NOTION_DB_WORKOUT_TEMPLATES`

## 8) 배포 후 Playwright 검증 루프

S3-5 이후 권장 루프:
1. Notion 스키마 점검
2. Vercel 프로덕션 배포
3. 배포 URL에서 Playwright E2E 검증

한 번에 실행:
```bash
npm run deploy:prod:verify
```

개별 실행:
```bash
npm run notion:schema:check
npx vercel --prod --yes --token "$VERCEL_TOKEN"
PLAYWRIGHT_BASE_URL="https://routinemate-kohl.vercel.app" npm run verify:deploy:prod
```

Playwright 검증 시나리오 파일:
- `tests/e2e/deploy-verification.spec.ts`

검증 항목:
- `/settings` 진입 및 게스트 세션 시작
- 목표 저장 성공 메시지 확인
- 식단/운동 템플릿 추가 성공 확인
- `Notion integration is not configured...` 에러 미노출
- `빠른 API 확인` 섹션 미노출

## 9) Android Google Login 승인 오류 트러블슈팅

`액세스가 차단되었습니다: 승인 오류`는 Google OAuth 앱 설정 불일치가 원인인 경우가 많습니다.

1. Android 클라이언트 자격증명 점검
- `GOOGLE_ANDROID_CLIENT_ID`(및 `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`)는 **Android 타입 클라이언트 ID**여야 합니다.
- Web client ID를 Android 전용으로 사용하면 승인 단계에서 막힙니다.

2. 패키지명/키 해시 일치
- Google Cloud Console Android OAuth 클라이언트의 `Package name`은 `com.routinemate.app`이어야 합니다.
- SHA-1 지문은 실제 빌드에 사용하는 키스토어의 값을 사용해야 합니다.
- Debug/Release 빌드가 다르면 각 SHA-1을 모두 등록해야 합니다.

3. SHA-1 확인 (예시)
- Android SDK 기본 debug keystore:
```bash
keytool -list -v -keystore "$HOME/Library/Android/sdk/.android/debug.keystore" -alias androiddebugkey -storepass android -keypass android
```
- release keystore:
```bash
keytool -list -v -keystore /path/to/your-release.keystore -alias YOUR_ALIAS
```

4. 리다이렉트 URI/스킴
- 앱에서 사용하는 URI는 `makeRedirectUri({ scheme: "routinemate", path: "oauth" })` 입니다.
- APK 재빌드 전 값 변경 시 앱 스킴(`scheme`)이 변경되지 않도록 확인합니다.

5. OAuth 동의 화면
- 앱이 "테스트" 상태면 로그인 시도 Google 계정을 테스트 사용자로 추가하세요.
- 사용자 인증이 막히면 동의 화면의 테스트 사용자/동의 상태, 승인 대상 스코프 설정을 확인합니다.

6. 환경변수 정합성
- Vercel 환경변수에도 `GOOGLE_ANDROID_CLIENT_ID`를 동일값으로 등록했는지 확인합니다.
- 모바일 실행용 번들에 `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`가 반영되었는지 확인하고, APK를 새로 빌드합니다.
