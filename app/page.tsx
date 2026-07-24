import { EvacuationMap } from "@/components/EvacuationMap";
import fixture from "@/data/sample/eaton-priority.json";
import type { PriorityDataset, PriorityLevel } from "@/lib/types";

const data = fixture as PriorityDataset;

const levelStyles: Record<PriorityLevel, string> = {
  "very-high": "bg-red-100 text-red-800 ring-red-200",
  high: "bg-orange-100 text-orange-800 ring-orange-200",
  medium: "bg-amber-100 text-amber-800 ring-amber-200",
  low: "bg-emerald-100 text-emerald-800 ring-emerald-200",
};

const levelLabels: Record<PriorityLevel, string> = {
  "very-high": "매우 높음",
  high: "높음",
  medium: "중간",
  low: "낮음",
};

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-stone-200/80 bg-[#f6f3ec]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[92rem] items-center justify-between px-5 py-4 sm:px-8">
          <a className="flex items-center gap-3" href="#">
            <span className="grid size-10 place-items-center rounded-2xl bg-[#183a35] text-lg text-white shadow-sm">
              E
            </span>
            <span>
              <span className="block text-base font-bold tracking-tight text-slate-950">
                EmberAid CA
              </span>
              <span className="block text-xs text-slate-500">
                Evacuation assistance intelligence
              </span>
            </span>
          </a>
          <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800">
            Prototype · 공식 시스템 아님
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:py-12">
        <section className="grid gap-8 border-b border-stone-300 pb-9 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#183a35] px-3 py-1 text-xs font-semibold text-white">
                Historical Reconstruction
              </span>
              <span className="rounded-full border border-stone-300 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700">
                데이터 기준 {data.dataAsOf}
              </span>
            </div>
            <h1 className="max-w-4xl text-4xl leading-[1.08] font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-6xl">
              지원이 먼저 필요한 구역과
              <span className="text-[#c65337]"> 그 이유</span>를 함께 봅니다.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              LA County 공식 구역과 설명 가능한 예시 점수를 결합한 P0 화면
              골격입니다. 점수는 아직 검증되지 않았으며 공식 대피 명령을
              대체하지 않습니다.
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-3">
            <Metric label="공식 Eaton 구역" value="137" />
            <Metric label="예시 우선순위" value={String(data.zones.length)} />
            <Metric label="점수 신뢰" value="낮음" />
          </dl>
        </section>

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(23rem,0.7fr)]">
          <EvacuationMap />

          <aside
            aria-labelledby="ranking-title"
            className="rounded-[1.75rem] border border-stone-200 bg-[#183a35] p-5 text-white shadow-[0_24px_70px_rgba(26,54,49,0.16)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-[#f3b493] uppercase">
                  Illustrative scores
                </p>
                <h2 id="ranking-title" className="mt-1 text-xl font-semibold">
                  지원 우선순위
                </h2>
              </div>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/80">
                45 · 35 · 20
              </span>
            </div>

            <ol className="mt-5 space-y-3">
              {data.zones.map((zone, index) => (
                <li
                  key={zone.zoneId}
                  className="rounded-2xl border border-white/10 bg-white/[0.07] p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white/45">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{zone.displayName}</p>
                      <p className="mt-0.5 truncate text-xs text-white/55">
                        {zone.evacuationStatus}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold tabular-nums">
                        {zone.priorityScore}
                      </p>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ring-1 ring-inset ${levelStyles[zone.priorityLevel]}`}
                      >
                        {levelLabels[zone.priorityLevel]}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <ScorePart
                      label="위협"
                      score={zone.components.dynamicThreat}
                    />
                    <ScorePart
                      label="대피 마찰"
                      score={zone.components.evacuationFriction}
                    />
                    <ScorePart
                      label="지원 필요"
                      score={zone.components.supportNeed}
                    />
                  </div>

                  <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-white/70">
                    {zone.actions[0].label}
                  </p>
                </li>
              ))}
            </ol>

            <p className="mt-5 rounded-xl bg-black/15 px-3 py-2.5 text-xs leading-5 text-white/60">
              점수 입력은 UI·계산 계약 검증용 예시입니다. 실제 운영 전에는
              ACS 지표, 도로 데이터, 전문가 검증이 필요합니다.
            </p>
          </aside>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <MethodCard
            number="45%"
            title="Dynamic Threat"
            body="공식 대피 상태, 화재 경계, 기상·공기질을 분리된 출처와 시각으로 추적합니다."
          />
          <MethodCard
            number="35%"
            title="Evacuation Friction"
            body="차량 접근성과 진출 도로처럼 실제 이동을 방해할 수 있는 조건을 설명합니다."
          />
          <MethodCard
            number="20%"
            title="Support Need"
            body="개인이 아닌 집계 통계로 지원 수요를 보고, 신뢰도와 오차를 별도로 표시합니다."
          />
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white/65 p-4">
      <dt className="text-xs leading-4 text-slate-500">{label}</dt>
      <dd className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </dd>
    </div>
  );
}

function ScorePart({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-xl bg-black/15 px-2 py-2">
      <p className="text-[0.65rem] text-white/50">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{score}</p>
    </div>
  );
}

function MethodCard({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-white/60 p-5">
      <p className="text-sm font-semibold text-[#c65337]">{number}</p>
      <h2 className="mt-2 font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </article>
  );
}
