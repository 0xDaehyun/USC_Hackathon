import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "EmberAid CA — Pitch",
  description:
    "Hackathon pitch deck for explainable wildfire evacuation assistance priorities.",
};

const slides = [
  {
    eyebrow: "Problem",
    title: "산불 정보는 많지만, 지원 행동으로 이어지지 않습니다.",
    body: [
      "캘리포니아에는 화재 경계, 대피 명령, 풍향, 공기질을 보여주는 서비스가 이미 있습니다.",
      "그러나 차량 미보유, 고령·장애, 언어 장벽, 제한된 진출 도로처럼 같은 경보를 받아도 대응 능력이 다른 지역은 공통 도구만으로는 드러나지 않습니다.",
    ],
    bullets: [
      "공식 대피 명령과 실제 지원 격차를 연결하는 도구 부재",
      "취약계층 지도와 실시간 사건 정보의 분리",
      "점수만 있고 왜, 무엇을 해야 하는지 없는 대시보드",
    ],
  },
  {
    eyebrow: "Solution",
    title: "EmberAid CA — 어느 구역에 어떤 지원이 먼저 필요한가",
    body: [
      "공식 산불·기상·대피 데이터와 집계된 인구·도로·지원시설 정보를 결합해, 구역별 대피 지원 우선순위와 그 이유를 설명합니다.",
      "공식 명령을 대체하지 않으며, 담당자가 확인할 의사결정 체크리스트를 제공합니다.",
    ],
    bullets: [
      "Evacuation Assistance Priority Map",
      "Explainable Action Card",
      "Data Confidence — 출처·갱신 시각·신뢰 수준 분리",
    ],
  },
  {
    eyebrow: "Differentiation",
    title: "취약계층 지도가 아니라, 사건별 대피 지원 격차 분석",
    body: [
      "Watch Duty는 실시간 알림, CAL FIRE FHSZ는 장기 hazard, AFN 지도는 자원 목록에 강합니다.",
      "EmberAid CA는 이 데이터를 현재 사건과 대피구역 단위로 결합해 우선순위·원인·부족한 지원 유형·체크리스트를 함께 제공합니다.",
    ],
    bullets: [
      "Dynamic Threat 45% + Evacuation Friction 35% + Support Need 20%",
      "개인이 아닌 Census Block Group / 공식 구역 집계만 사용",
      "Live · Historical Reconstruction · What-if를 UI에서 명시적으로 구분",
    ],
  },
  {
    eyebrow: "MVP Demo",
    title: "2025 Eaton Fire — LA County Historical Reconstruction",
    body: [
      "137개 공식 Eaton 구역과 설명 가능한 예시 우선순위 5개를 비교합니다.",
      "Altadena·Pasadena 주변에서 차량 접근성, 고령 인구, 언어, 진출 도로가 순위에 미치는 영향을 설명합니다.",
    ],
    bullets: [
      "LA County 최대 대피구역 레이어 + Eaton 경보 조사 보고서",
      "MapLibre 지도 + 구역별 점수·원인·1차 조치",
      "점수는 해커톤용 예시 — 운영 전 전문가 검증 필요",
    ],
  },
  {
    eyebrow: "Ask",
    title: "재난 대응에서 정보를 행동으로 연결하는 보조 도구",
    body: [
      "EmberAid CA는 공개된 공식 데이터를 결합해 산불 상황에서 대피 지원이 가장 필요한 지역과 그 이유를 설명하고, 대응기관의 자원 배치 결정을 돕습니다.",
    ],
    bullets: [
      "운영 대시보드 중심 — 카운티·비영리·교통·대피소 운영기관",
      "Next.js · TypeScript · MapLibre · 규칙 기반 설명 가능 점수",
      "공식 명령 최우선 · 모델 결과는 확률·명령으로 표현하지 않음",
    ],
  },
] as const;

export default function PitchPage() {
  return (
    <div className="pitch-deck bg-[#102220] text-white">
      <header className="fixed inset-x-0 top-0 z-20 border-b border-white/10 bg-[#102220]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-[#c65337] text-sm font-bold">
              E
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">EmberAid CA</p>
              <p className="text-xs text-white/55">Hackathon pitch</p>
            </div>
          </div>
          <Link
            href="/"
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/85 transition hover:border-white/30 hover:text-white"
          >
            서비스 데모 보기 →
          </Link>
        </div>
      </header>

      <main className="snap-y snap-mandatory overflow-y-auto pt-[4.5rem]">
        {slides.map((slide, index) => (
          <section
            key={slide.eyebrow}
            className="flex min-h-[calc(100vh-4.5rem)] snap-start items-center px-6 py-12"
          >
            <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold tracking-[0.24em] text-[#f3b493] uppercase">
                  {String(index + 1).padStart(2, "0")} · {slide.eyebrow}
                </p>
                <h1 className="mt-4 max-w-3xl text-4xl leading-[1.08] font-semibold tracking-[-0.04em] sm:text-5xl">
                  {slide.title}
                </h1>
                <div className="mt-6 space-y-4 text-base leading-7 text-white/72">
                  {slide.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </div>

              <ul className="space-y-3 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
                {slide.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex gap-3 text-sm leading-6 text-white/82"
                  >
                    <span
                      aria-hidden
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-[#c65337]"
                    />
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}

        <footer className="snap-start border-t border-white/10 px-6 py-10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-white/50">
            <p>Prototype · 공식 대피 시스템 아님 · 집계 데이터만 사용</p>
            <p>EmberAid CA · USC Hackathon · 2026</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
