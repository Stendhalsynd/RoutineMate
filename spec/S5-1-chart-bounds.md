# S5-1 Chart Bounds - 모바일 차트 클리핑 및 오버플로우 방지

## 배경
체성분 추세 라인차트가 컨테이너 폭을 넘어서거나 모바일에서 영역 밖으로 벗어나는 현상이 발생했다.

## 범위
- 차트 렌더링의 컨테이너 기반 크기 계산만 허용.
- 차트 SVG 좌표와 패스가 차트 영역 경계(70 내)에서 벗어나지 않음.
- 320/360/390/768 해상도에서 모바일/소형뷰 반응성을 보장.

## 핵심 요구사항
- 1) 고정 폭(예: `680`) 제거
- 2) `ResizeObserver` 기반 컨테이너 폭 추적
- 3) 그리드/패딩 계산 클램프 처리
- 4) `overflow: hidden` + `min-width: 0`로 부모 카드/래퍼 경계 수렴
- 5) 빈 데이터/단일 포인트 처리 시 안전한 fallback

## Given / When / Then
1. Given 차트 포인트가 있고 모바일 폭이 320, 360, 390, 768일 때,
   When 차트를 렌더링하면,
   Then `x` 좌표가 `padding.left`와 `width-padding.right` 사이를 벗어나지 않아야 한다.

2. Given `points.length === 1` 또는 `0`일 때,
   When 차트를 렌더링하면,
   Then path가 유효 문자열(`M` 시작) 또는 빈 문자열로 처리되어 크래시가 없어야 한다.

3. Given 동적 폭이 변할 때(회전/리사이즈),
   When 래퍼 너비가 변경되면,
   Then 차트는 즉시 새 뷰포트에 맞춰 다시 계산해야 한다.

## 실패 테스트
- 좌표 범위를 클램프하지 않아 `Math.max/min` 경계 밖으로 벗어나는 렌더가 존재하면 실패.
- `metric-chart` 유틸에서 빈 데이터에 path 생성 시 비정상 문자열이 나오면 실패.

## 완료 기준
- `apps/web/src/lib/metric-chart.ts` 추가됨.
- `apps/web/src/components/routine-workspace.tsx`에서 레이아웃 유틸을 통해 차트 렌더링.
- `apps/web/tests/metric-chart-layout.test.ts` 통과.
- `npm run test --workspace @routinemate/web` 통과.
