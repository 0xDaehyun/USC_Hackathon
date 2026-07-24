# EmberAid CA

> 프로젝트명은 임시 이름입니다.

캘리포니아 산불의 실시간 위협과 지역별 대피 취약성을 결합해, **어느 구역에 어떤 지원을 먼저 배치해야 하는지** 설명하는 재난 대응 의사결정 지원 서비스입니다.

## 1. 문제 정의

캘리포니아에는 산불 위치, 화재 경계, 대피 명령, 풍향, 공기질을 보여주는 서비스가 이미 존재합니다. 그러나 정보가 제공된다고 해서 모든 주민이 동일하게 대피할 수 있는 것은 아닙니다.

다음과 같은 지역은 같은 대피 경보를 받아도 실제 대응 능력이 더 낮을 수 있습니다.

- 차량이 없는 가구가 많은 지역
- 고령자 또는 장애인 비율이 높은 지역
- 영어 안내를 이해하기 어려운 주민이 많은 지역
- 요양시설, 학교, 병원 등 지원이 필요한 시설이 밀집한 지역
- 이용 가능한 진출 도로가 적거나 도로 폐쇄 영향을 크게 받는 지역
- 접근 가능한 교통수단이나 대피시설이 부족한 지역

현재의 핵심 문제는 산불 정보를 하나 더 보여주는 것이 아니라, **위험 정보를 실제 지원 행동으로 연결하는 과정이 부족하다는 것**입니다.

## 2. 서비스 정의

EmberAid CA는 산불을 정확히 예측하거나 공식 대피 명령을 대신하는 서비스가 아닙니다.

실시간 산불·기상·대피 정보와 집계된 인구통계·도로·지원시설 데이터를 결합해 다음 질문에 답하는 보조 도구입니다.

1. 지금 지원이 가장 시급한 대피구역은 어디인가?
2. 그 구역의 우선순위가 높은 이유는 무엇인가?
3. 교통, 언어, 호흡기 보호, 접근 가능한 대피시설 중 어떤 지원이 필요한가?
4. 데이터가 얼마나 최신이며 결과를 어느 정도 신뢰할 수 있는가?

### 핵심 가치 제안

> 기존 서비스가 “무슨 일이 어디에서 일어나고 있는가”를 전달한다면, EmberAid CA는 “어느 구역에 어떤 지원이 먼저 필요한가”를 설명합니다.

## 3. 목표 사용자

### 주요 사용자

- 카운티·지방정부 재난 대응 담당자
- 비영리 구조 및 지역 지원 단체
- 대피소와 접근 가능한 교통수단 운영기관

### 보조 사용자

- 산불 영향권의 일반 주민
- 고령자, 장애인, 차량 미보유자, 영어 미숙 주민을 지원하는 가족과 돌봄 제공자

해커톤 MVP의 중심은 **기관 및 지원단체용 운영 대시보드**입니다. 주민용 기능은 동일한 데이터를 간단한 행동 카드로 제공하는 보조 화면으로 제한합니다.

## 4. 경쟁 서비스와 차별화

| 서비스 | 이미 잘하는 일 | EmberAid CA가 중복하지 않을 영역 |
| --- | --- | --- |
| [Watch Duty](https://www.watchduty.org/) | 검증된 실시간 알림, 화재 경계, 대피·대피소 정보, 항공기, 풍향, 공기질, 정전 정보 | 사건 속보와 범용 산불 지도 |
| [CAL FIRE Fire Hazard Severity Zones](https://osfm.fire.ca.gov/osfm/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones) | 장기적인 화재 `hazard`를 Moderate, High, Very High로 분류 | 공식 위험구역 분류의 재구현 |
| [USDA Wildfire Risk to Communities](https://wildfirerisk.org/about/faq/) | 지역사회 산불 위험과 사회경제적 취약성 비교 | 정적 지역 위험·취약성 지도 |
| [California Vulnerable Communities Platform](https://lci.ca.gov/newsroom/news/2025/10-14/) | 현재·미래 기후 위험과 취약 지역의 적응 계획 지원 | 장기 기후 적응 계획 |
| [Cal OES AFN Web Map](https://www.caloes.ca.gov/office-of-the-director/policy-administration/access-functional-needs/oafn-web-map/) | Access and Functional Needs 관련 자산과 자원 파악 | AFN 자원 목록 자체의 재구현 |
| [FIRIS/WIFIRE](https://www.arcgis.com/home/item.html?id=025fb2ea05f14890b2b11573341b5b18&sublayer=0) | 항공 적외선 데이터와 전문 화재 확산 모델링 | 정확한 화재 확산 예측 엔진 |

### 방어 가능한 차별점

검토한 기존 서비스들은 각각 실시간 상황 인식, 정적 위험 분석, 취약성·자원 지도, 전문 확산 모델링을 제공합니다. EmberAid CA는 이 데이터를 **현재 사건과 대피구역 단위로 결합**하고 다음 결과를 함께 제공하는 데 집중합니다.

- 구역별 대피 지원 우선순위
- 우선순위를 만든 주요 원인
- 부족할 가능성이 높은 지원 유형
- 실행 가능한 대응 체크리스트
- 데이터 출처, 갱신 시각, 신뢰 수준

“취약계층 지도”가 아니라 **사건별 대피 지원 격차 분석과 행동 제안**이 핵심 차별점입니다.

## 5. MVP 핵심 기능

### 5.1 Evacuation Assistance Priority Map

대피구역별로 `대피 지원 우선순위`를 계산하고 지도에 표시합니다.

우선순위는 다음 세 요소를 조합합니다.

- **Dynamic Threat**: 원본 기관이 발령한 대피 상태, 화재 경계와의 거리, 풍향·풍속, 공기질
- **Evacuation Friction**: 차량 미보유 가구, 제한된 진출 도로, 도로 폐쇄, 지원시설과의 거리
- **Support Need**: 고령자, 장애인, 영어 미숙 인구, 요양시설·학교·병원 분포

개인의 신상정보나 특정 가구의 장애 여부는 사용하지 않습니다. Census Block Group 또는 공식 대피구역 단위의 집계 데이터만 사용합니다.

### 5.2 Explainable Action Card

점수만 보여주지 않고, 각 구역에 필요한 행동을 함께 제시합니다.

예시:

```text
Zone PAS-E003
대피 지원 우선순위: 매우 높음
데이터 신뢰 수준: 중간

주요 원인
- 공식 Evacuation Warning 상태
- 차량 미보유 가구 비율이 지역 평균보다 높음
- 65세 이상 인구 비율이 높음
- 사용 가능한 주요 진출 도로가 제한적임

우선 검토할 조치
1. 접근 가능한 교통수단 배치 여부 확인
2. 영어 외 주요 언어의 공식 안내 발송
3. 고령자 시설에 N95 및 실내 공기질 안내 전달
4. 접근 가능한 대피소 운영 상태 확인
```

추천 조치는 자동 명령이 아니라 담당자가 확인할 **의사결정 체크리스트**로 표현합니다.

### 5.3 Resident Action Card (P1)

주민은 주소와 필요한 지원 유형을 선택해 간단한 행동 카드를 확인합니다.

- 현재 공식 대피 상태
- 화재·연기 노출 수준
- 공식 대피소 및 지원 연락처
- 차량이 없거나 이동 지원이 필요할 때의 안내
- 선택한 언어로 제공되는 짧은 행동 체크리스트
- 모든 정보의 출처와 갱신 시각

건강 정보는 진단이나 치료 지시를 제공하지 않습니다. 산불 연기 안내는 [EPA/AirNow 공식 지침](https://www.airnow.gov/wildfires/when-smoke-is-in-the-air/)을 템플릿으로 사용합니다.

### 5.4 Data Confidence

모든 결과에 다음 정보를 표시합니다.

- 데이터 출처
- 마지막 갱신 시각
- 누락된 데이터
- 결과 신뢰 수준
- 공식 명령과 모델 결과의 구분

오래되거나 누락된 데이터는 점수에 숨겨서 반영하지 않고 사용자에게 명시합니다.

## 6. 우선순위 산정 방식

MVP에서는 검증되지 않은 복잡한 AI 모델보다 설명 가능한 규칙 기반 점수를 사용합니다.

```text
Evacuation Assistance Priority
= 45% Dynamic Threat
+ 35% Evacuation Friction
+ 20% Support Need
```

각 요소를 0~100으로 정규화하고 최종 점수와 세부 점수를 모두 표시합니다. 가중치는 확정된 과학적 기준이 아니라 **해커톤용 초기 가설**이며, 실제 운영 전에는 재난 대응 전문가 및 지역사회와 함께 검증해야 합니다.

데이터의 최신성·완전성을 나타내는 `Confidence`는 우선순위 점수와 별도로 계산합니다. 데이터가 부족한 상황을 낮은 위험으로 오인하지 않도록 하기 위함입니다.

## 7. 사용자 흐름

### 운영 모드

- **Live**: 현재 활성 대피구역과 최신 기상·화재 데이터를 표시합니다.
- **Historical Reconstruction**: 공식 보고서와 보존된 구역 데이터를 결합해 과거 상황을 재구성합니다. 당시 화면의 원본 스냅샷처럼 표현하지 않습니다.
- **What-if**: 풍속 또는 도로 조건을 사용자가 바꿔 우선순위 변화를 비교합니다. 예보나 공식 명령으로 표현하지 않습니다.

### 재난 대응 담당자

1. Live 또는 Historical Reconstruction 모드와 산불 사건을 선택합니다.
2. 지도에서 우선순위가 높은 대피구역을 확인합니다.
3. 구역을 선택해 점수의 원인과 부족한 지원 유형을 확인합니다.
4. 추천 체크리스트와 주변 AFN 자원을 검토합니다.
5. 풍속 또는 도로 상태 시나리오를 변경해 우선순위 변화를 비교합니다.

### 일반 주민

1. 주소 또는 대피구역을 입력합니다.
2. 이동·언어·건강 관련 지원 유형을 선택합니다.
3. 공식 대피 상태와 개인화된 행동 카드를 확인합니다.
4. 공식 기관의 명령과 연락처로 이동합니다.

## 8. 해커톤 구현 범위

### P0: 반드시 구현

- Los Angeles County의 대피구역 지도
- 구역별 대피 지원 우선순위
- 우선순위 구성요소 및 근거 표시
- 구역별 대응 체크리스트
- 데이터 출처·갱신 시각·신뢰 수준

### P1: 시간이 남으면 구현

- 풍향·풍속 또는 도로 폐쇄에 따른 시나리오 비교
- 영어·스페인어·한국어의 검토된 안내 템플릿
- 사용 가능한 교통·대피소 자원을 입력한 간단한 배치 보조 기능
- 주민용 행동 카드 1개 흐름

### MVP에서 제외

- 산불 발생 시각 또는 위치의 정확한 예측
- 자체 화재 확산 예측 모델
- 전력·통신·도로·학교의 정확한 복구 시간 예측
- 대피소의 미래 실시간 혼잡도 예측
- 하나의 “가장 안전한” 대피 경로 지시
- 주소별 소실 확률 또는 재산 피해액 예측
- 개인 의료 진단과 마스크 착용 시간 처방
- 개인별 장애·질환·이민 상태의 수집 또는 표시

## 9. 데모 시나리오

MVP는 범위를 통제하고 결과를 반복 재현할 수 있도록 **Los Angeles County의 2025 Eaton Fire 공식 기록 기반 재구성**을 기본 데모로 사용합니다.

1. Eaton Fire의 공식 대피구역 최대 범위와 공식 보고서의 선택된 경보 시점을 불러옵니다.
2. Altadena·Pasadena 주변 구역의 대피 지원 우선순위를 비교합니다.
3. 차량 미보유, 고령 인구, 언어 장벽, 진출 도로 조건이 우선순위에 미치는 영향을 설명합니다.
4. P1 구현 시 풍속 증가 또는 주요 도로 폐쇄 시나리오에서 순위 변화를 보여줍니다.
5. P1 구현 시 한 주민 프로필에 대해 공식 상태와 행동 카드를 생성합니다.

[LA County 2025 최대 대피구역 레이어](https://www.arcgis.com/home/item.html?id=182e6350c18440e3a52e4de5f9d7fad2)는 2025년 1월 산불 당시 한 번이라도 Warning 또는 Order 상태였던 구역과 각 구역의 가장 높은 경보 단계를 제공합니다. 특정 시점별 상태 이력은 포함하지 않으므로 [LA County Eaton Fire 대피 경보 조사 보고서](https://file.lacounty.gov/SDSInter/lac/1208708_InvestigationReportoftheEatonFireEvacuationAlerts_05-18-26_.pdf)의 경보 타임라인과 함께 사용합니다.

이 데모는 당시 운영 화면의 완전한 원본 재생이 아닙니다. UI에 `Historical Reconstruction`, 기준 시각, 사용한 출처, 누락된 정보를 명시합니다. [CAL FIRE Eaton Fire 기록](https://www.fire.ca.gov/incidents/2025/1/7/eaton-fire)과 [Eaton Fire DINS 데이터](https://lab.data.ca.gov/datasets?q=Eaton&tag=Eaton)는 사건 및 피해 결과의 교차 검증 자료로만 사용합니다.

## 10. 데이터 소스

| 데이터 | 사용 목적 | MVP 주의사항 |
| --- | --- | --- |
| [CAL FIRE Incidents](https://www.fire.ca.gov/incidents) | 사건 위치, 규모, 상태 | 작은 사건은 제공되지 않을 수 있음 |
| [CAL FIRE FHSZ](https://osfm.fire.ca.gov/osfm/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones) | 장기 기본 화재 hazard | 현재 사건의 실시간 위험 확률이 아님 |
| [California Active Evacuation Zones](https://www.arcgis.com/home/item.html?id=c0dd2a8779764c26910b83a7e974ee66) | 여러 카운티와 Genasys에서 집계한 활성 Warning·Order 구역 | 원본 카운티 발령 내용과 갱신 상태를 최종 확인 |
| [LA County 2025 최대 대피구역](https://www.arcgis.com/home/item.html?id=182e6350c18440e3a52e4de5f9d7fad2) | Eaton Fire를 포함한 2025년 1월 산불의 구역 지오메트리와 최고 경보 단계 | 최대 범위 데이터이며 시점별 상태 스냅샷이 아님 |
| [LA County Eaton Fire 대피 경보 조사 보고서](https://file.lacounty.gov/SDSInter/lac/1208708_InvestigationReportoftheEatonFireEvacuationAlerts_05-18-26_.pdf) | 선택 시점의 공식 경보 타임라인 재구성 | 보고서에 없는 상태를 추정하지 않음 |
| [AirNow](https://www.airnow.gov/about-airnow/) | 현재·예보 AQI와 연기 영향 | 실시간 관측은 변동하며 의료 진단에 사용하지 않음 |
| [NWS Alerts API](https://www.weather.gov/documentation/services-web-alerts) | Red Flag Warning 등 공식 기상 경보 | 위치별 경보 누락과 갱신 시각 표시 |
| [U.S. Census ACS API](https://www.census.gov/programs-surveys/acs/data/data-via-api.html) | 차량, 연령, 장애, 언어 등 집계 통계 | 5년 추정치이며 실시간 인구가 아님 |
| [Cal OES AFN Web Map](https://www.caloes.ca.gov/office-of-the-director/policy-administration/access-functional-needs/oafn-web-map/) | 접근 가능한 교통·대피·지원 자원 | 자원의 실제 운영 여부를 별도로 확인 |
| OpenStreetMap | 도로망과 시설 위치 | 공식 도로 폐쇄 정보로 간주하지 않음 |

## 11. 권장 기술 구성

### Frontend

- Next.js
- TypeScript
- MapLibre GL JS
- Tailwind CSS

### P0 앱 및 데이터 전처리

- Next.js Route Handlers
- Python
- GeoPandas / Shapely
- DuckDB + GeoParquet

### 배포

- Vercel: P0 단일 Next.js 앱

MVP에서는 Python으로 재현 가능한 GeoJSON/JSON 스냅샷을 만들고 Next.js에서 표시합니다. 별도 FastAPI 서비스는 실시간 공간 연산이 P0에 반드시 필요하다는 검증 후에만 추가합니다. 이후 운영 단계에서 PostGIS와 주기적 데이터 수집 작업을 도입합니다.

### 로컬 실행

Node.js와 npm이 설치된 환경에서 다음 명령을 실행합니다.

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 LA County 공식 Eaton 구역과 UI 검증용 우선순위 5개를 확인할 수 있습니다. 현재 화면의 점수는 실제 운영 점수가 아닌 예시값입니다.

API 키가 필요한 데이터 연동을 개발할 때는 `.env.example`을 `.env.local`로 복사하고 실제 값을 로컬 파일에만 입력합니다. 현재 공개 구역 데모는 별도 API 키 없이 실행됩니다.

```bash
npm run test
npm run lint
npm run build
```

데이터 출처의 접근 방식과 검증 상태는 [`data/source-manifest.json`](data/source-manifest.json), 우선순위 결과 계약은 [`data/contracts/zone-priority.schema.json`](data/contracts/zone-priority.schema.json)에서 관리합니다.

## 12. 안전·윤리 원칙

- 공식 대피 명령을 가장 높은 우선순위로 표시하고 변경하거나 재해석하지 않습니다.
- 모델 결과를 확률, 보장, 명령으로 표현하지 않습니다.
- 위험 점수와 데이터 신뢰 수준을 분리합니다.
- 개인의 민감정보 대신 구역 단위 집계 데이터만 사용합니다.
- MVP는 주민이 입력한 주소와 지원 선택을 저장하지 않고 현재 세션에서만 처리합니다.
- 특정 취약계층을 낙인찍지 않고 필요한 지원 유형을 중심으로 설명합니다.
- 자동 번역문을 공식 안내처럼 표시하지 않습니다. 검토된 템플릿을 사용합니다.
- 모든 추천은 담당자 확인이 필요한 의사결정 보조 정보로 표시합니다.

## 13. 성공 기준

해커톤 MVP는 다음 조건을 만족하면 성공으로 봅니다.

- 최소 5개 이상의 대피구역 우선순위를 비교할 수 있습니다.
- 모든 점수에 원인, 출처, 갱신 시각이 표시됩니다.
- 상위 구역마다 최소 1개의 구체적인 지원 조치가 제시됩니다.
- Live, Historical Reconstruction, What-if 데이터를 화면에서 혼동할 수 없게 구분합니다.
- 어떤 화면도 공식 명령이나 안전을 보장하는 경로처럼 오해되지 않습니다.

P1 기능을 구현한 경우에는 다음 조건을 추가로 확인합니다.

- 풍속 또는 도로 조건을 바꾸면 우선순위 변화가 설명됩니다.
- 주민이 1분 이내에 자신의 공식 대피 상태와 행동 카드를 확인할 수 있습니다.

## 14. 향후 확장

- 기관이 보유한 실시간 교통·대피소 운영 데이터 연동
- 지역 단체가 제공하는 지원 자원 상태 업데이트
- 익명·옵트인 방식의 주민 지원 요청 집계
- 전문가 검증을 거친 가중치 및 지역별 보정
- 사건 종료 후 실제 대응 결과와 우선순위의 사후 평가
- 캘리포니아 전역으로 대상 지역 확대

## 15. 핵심 포지셔닝

### 지양할 표현

> AI가 캘리포니아 산불과 모든 피해를 정확히 예측합니다.

### 사용할 표현

> EmberAid CA는 공개된 공식 데이터를 결합해 산불 상황에서 대피 지원이 가장 필요한 지역과 그 이유를 설명하고, 대응기관의 자원 배치 결정을 돕습니다.

---

조사 및 문서 기준일: 2026-07-23
