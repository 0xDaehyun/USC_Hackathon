# LA Wildfire & Smoke Vulnerability Risk Pipeline

2025년 1월 LA Palisades/Eaton 산불에 대해 **화상 지역(위성) + 연기 노출(HRRR-Smoke) + 사회 취약성(SVI)** 을 결합한 구역별 Risk Score 지도를 생성하는 무인 실행 파이프라인입니다. Next.js 앱과 독립적으로 동작합니다.

> Historical Reconstruction 산출물입니다. 공식 위험·대피 제품이 아니며 가중치는 검증되지 않은 해커톤용 가설입니다.

## 실행

```bash
cd pipeline
.venv/bin/python run_pipeline.py
```

모든 로그는 저장소 루트의 `execution_log.txt`에 타임스탬프와 함께 누적됩니다.

## Phase 구성

| Phase | 내용 | 출력 |
| --- | --- | --- |
| 1 | Sentinel-2 L2A(Earth Search STAC) 6밴드 스택 → Prithvi-EO-2.0-300M-BurnScars 제로샷 추론, 실패 시 dNBR(>0.27) 결정론적 폴백 | `outputs/burn_mask.tif` |
| 2 | NOAA HRRR-Smoke MASSDEN(8 m) 분석장(fxx=0, AWS 아카이브, Herbie) 다중 시각 평균 | `outputs/smoke_pm25.tif` |
| 3 | CDC/ATSDR SVI 2022 tract(LA County) + 구역별 zonal mean → `(0.5*norm(burn)+0.5*norm(smoke))*RPL_THEMES` | `outputs/final_risk_scores.geojson` |
| 4 | Folium 인터랙티브 지도 | `outputs/la_wildfire_risk_map.html` |

## 안전 규칙 구현

- **학습 금지**: 사전학습 모델 추론과 결정론적 계산만 사용합니다.
- **재시도 3회 후 중단**: 실패 시 `execution_log.txt`에 원인 기록, 부분 데이터 보존, 다음 단계 진행.
- **더미 데이터 명시**: 실데이터 수집 실패 시 올바른 shape/CRS의 0 배열을 쓰고 `HUMAN DATA INJECTION REQUIRED`로 로그에 남깁니다. 각 산출물의 `*.meta.json`에 실제 사용된 방법이 기록됩니다.

## 의존성 목적

- `pystac-client`, `requests`: Sentinel-2 장면 검색·SVI FeatureServer 조회
- `rasterio`, `rioxarray`, `xarray`, `numpy`, `scipy`: 래스터 클리핑·재투영·dNBR·격자 리샘플링
- `geopandas`, `shapely`, `rasterstats`: tract 벡터 처리와 zonal statistics
- `herbie-data`, `cfgrib`, `eccodes`: HRRR GRIB2 아카이브 부분 다운로드·해석
- `huggingface_hub`(+선택 `terratorch`, `torch`): Prithvi BurnScars 체크포인트 다운로드·추론
- `folium`, `branca`, `mapclassify`: 최종 지도 렌더링

`terratorch`는 설치 실패 가능성이 높은 대형 의존성이라 `requirements.txt`에서 분리했습니다. 미설치 시 Phase 1이 자동으로 dNBR 폴백을 사용합니다.

## 검증 결과에 따른 권장 산출물

2026-07-25 실행에서 Prithvi 제로샷 마스크는 dNBR 교차 검증을 통과하지 못했습니다(확인율 12%, 512px 타일 격자 아티팩트, AOI 19% 화상 판정 vs 실제 약 5%). 원인은 Sentinel-2로 조립한 입력과 모델의 HLS 학습 전처리 불일치로 추정됩니다.

- **권장**: `outputs/final_risk_scores_dnbr.geojson`, `outputs/la_wildfire_risk_map_dnbr.html` (결정론적 dNBR 화상 입력)
- 비교용으로 보존: `outputs/final_risk_scores.geojson`, `outputs/la_wildfire_risk_map.html` (Prithvi 화상 입력)
- 두 버전 비교 이미지: `outputs/burn_mask_comparison.png`

이후 실행부터는 Phase 1이 Prithvi 출력을 dNBR 확인율 30% 이상일 때만 채택하고, 아니면 자동으로 dNBR로 폴백합니다(`phase1_burn.py`의 `validate_prithvi_mask`).

## 데이터 출처

`data/source-manifest.json`의 `sentinel-2-earth-search`, `noaa-hrrr-smoke-archive`, `cdc-svi-2022-tract`, `prithvi-eo-burnscars` 항목을 참고하세요.
