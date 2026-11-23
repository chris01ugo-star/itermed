"use client";

import type { LabLeveyJennings, LabTraceVisual } from "@/lib/simulator/laboratory-workbench";

const INK = "#1E324E";
const INK_SOFT = "#345884";
const MUTED = "#64748B";
const LINE = "#E2E8F0";
const PAPER = "#F8FAFC";
const WARN = "#F39C12";
const RISK = "#C0392B";

const CLUSTER_FILL: Record<"neutral" | "accent" | "warning" | "danger", string> = {
  neutral: "#94A3B8",
  accent: "#345884",
  warning: "#F39C12",
  danger: "#C0392B",
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(value);
}

export function HilPhotometricBars({
  hemolysis,
  icterus,
  lipemia,
}: {
  hemolysis: number;
  icterus: number;
  lipemia: number;
}) {
  const rows = [
    { code: "H", name: "Emolisi", value: hemolysis, max: 200, tick: 50, fill: RISK },
    { code: "I", name: "Ittero 450/575 nm", value: icterus, max: 40, tick: 15, fill: WARN },
    { code: "L", name: "Lipemia", value: lipemia, max: 80, tick: 20, fill: INK_SOFT },
  ];
  return (
    <div className="space-y-2 rounded-aequan border border-subtle bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
        Lettura fotometrica HIL
      </p>
      {rows.map((row) => {
        const width = Math.max(0, Math.min(100, (row.value / row.max) * 100));
        const tick = (row.tick / row.max) * 100;
        return (
          <div key={row.code} className="grid grid-cols-[88px_1fr_52px] items-center gap-2">
            <div>
              <p className="text-xs font-semibold text-brand-primary">{row.code}</p>
              <p className="text-[10px] text-text-secondary">{row.name}</p>
            </div>
            <svg viewBox="0 0 200 28" className="h-7 w-full" role="img" aria-label={`${row.name} ${row.value}`}>
              <rect x="0" y="8" width="200" height="12" rx="3" fill={PAPER} stroke={LINE} />
              <rect x="0" y="8" width={(width / 100) * 200} height="12" rx="3" fill={row.fill} opacity="0.85" />
              <line x1={(tick / 100) * 200} x2={(tick / 100) * 200} y1="4" y2="24" stroke={INK} strokeWidth="1" />
            </svg>
            <span className="text-right text-xs font-semibold tabular-nums text-text-primary">
              {formatNumber(row.value)}
            </span>
          </div>
        );
      })}
      <p className="text-[10px] text-text-secondary">La tacca verticale è la soglia analitica della linea.</p>
    </div>
  );
}

export function LeveyJenningsChart({ chart }: { chart: LabLeveyJennings }) {
  const width = 640;
  const height = 250;
  const pad = { left: 54, right: 16, top: 16, bottom: 32 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const yMin = chart.mean - chart.sd * 4;
  const yMax = chart.mean + chart.sd * 4;
  const yOf = (value: number) => pad.top + ((yMax - value) / (yMax - yMin)) * plotH;
  const xOf = (index: number) =>
    pad.left + (chart.points.length <= 1 ? plotW / 2 : (index / (chart.points.length - 1)) * plotW);
  const bands = [3, 2, 1, 0, -1, -2, -3];
  const polyline = chart.points.map((point, index) => `${xOf(index)},${yOf(point.value)}`).join(" ");
  return (
    <div className="rounded-aequan border border-subtle bg-white p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-brand-primary">
          {chart.analyteName}{" "}
          <span className="font-normal text-text-secondary">({chart.unit})</span>
        </p>
        <p className="text-[11px] tabular-nums text-text-secondary">Lotto {chart.lotNumber}</p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Carta di controllo">
        {bands.map((band) => {
          const value = chart.mean + band * chart.sd;
          const y = yOf(value);
          const strong = band === 0;
          return (
            <g key={band}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
                stroke={strong ? INK : band === 3 || band === -3 ? RISK : band === 2 || band === -2 ? WARN : LINE}
                strokeDasharray={strong ? undefined : "4 4"}
                strokeWidth={strong ? 1.4 : 1}
              />
              <text x={4} y={y + 3} fill={MUTED} fontSize="10" className="tabular-nums">
                {band === 0 ? "Media" : `${band > 0 ? "+" : ""}${band} SD`}
              </text>
            </g>
          );
        })}
        <polyline points={polyline} fill="none" stroke={INK_SOFT} strokeWidth="1.6" />
        {chart.points.map((point, index) => (
          <g key={`${point.runLabel}-${index}`}>
            <circle cx={xOf(index)} cy={yOf(point.value)} r="3.5" fill={INK}>
              <title>{`${point.runLabel}: ${formatNumber(point.value)} ${chart.unit}`}</title>
            </circle>
            <text x={xOf(index)} y={height - 10} textAnchor="middle" fill={MUTED} fontSize="9">
              {point.runLabel}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function ElectrophoresisTraceChart({
  trace,
}: {
  trace: Extract<LabTraceVisual, { type: "ELECTROPHORESIS" }>;
}) {
  const width = 640;
  const height = 220;
  const pad = { left: 28, right: 12, top: 12, bottom: 28 };
  const max = Math.max(...trace.curvePoints, 1);
  const xOf = (index: number) =>
    pad.left + (index / Math.max(trace.curvePoints.length - 1, 1)) * (width - pad.left - pad.right);
  const yOf = (value: number) => pad.top + (1 - value / max) * (height - pad.top - pad.bottom);
  const line = trace.curvePoints.map((value, index) => `${xOf(index)},${yOf(value)}`).join(" ");
  const area = `${pad.left},${height - pad.bottom} ${line} ${width - pad.right},${height - pad.bottom}`;
  const zones = ["Alb", "α1", "α2", "β1", "β2", "γ"];
  return (
    <div className="space-y-3 rounded-aequan border border-subtle bg-white p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Tracciato elettroforetico">
        {zones.map((zone, index) => {
          const start = pad.left + (index / zones.length) * (width - pad.left - pad.right);
          const span = (width - pad.left - pad.right) / zones.length;
          const marked = trace.highlightZone === zone;
          return (
            <g key={zone}>
              <rect
                x={start}
                y={pad.top}
                width={span}
                height={height - pad.top - pad.bottom}
                fill={marked ? "#E8EEF5" : index % 2 === 0 ? "#F8FAFC" : "#FFFFFF"}
              />
              <text x={start + span / 2} y={height - 8} textAnchor="middle" fill={INK} fontSize="11">
                {zone}
              </text>
            </g>
          );
        })}
        <polygon points={area} fill={INK_SOFT} opacity="0.18" />
        <polyline points={line} fill="none" stroke={INK} strokeWidth="1.8" />
      </svg>
      <table className="w-full text-left text-xs">
        <thead className="text-text-secondary">
          <tr>
            <th className="py-1 font-medium">Frazione</th>
            <th className="py-1 font-medium">%</th>
            <th className="py-1 font-medium">Riferimento</th>
          </tr>
        </thead>
        <tbody>
          {trace.fractions.map((row) => (
            <tr key={row.label} className="border-t border-subtle">
              <td className="py-1 text-text-primary">{row.label}</td>
              <td className="py-1 tabular-nums text-text-primary">{formatNumber(row.percent)}</td>
              <td className="py-1 tabular-nums text-text-secondary">{row.refRange}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HematologyScattergram({
  plot,
}: {
  plot: Extract<LabTraceVisual, { type: "SCATTERGRAM" }>;
}) {
  const size = 320;
  const pad = 36;
  const dots = plot.clusters.flatMap((cluster) => {
    const random = mulberry32(hashSeed(`${cluster.label}:${cluster.cx}:${cluster.cy}:${cluster.density}`));
    return Array.from({ length: cluster.density }, (_, index) => {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random());
      return {
        key: `${cluster.label}-${index}`,
        cx: pad + ((cluster.cx + Math.cos(angle) * cluster.rx * radius) / 100) * (size - pad * 2),
        cy: pad + ((100 - (cluster.cy + Math.sin(angle) * cluster.ry * radius)) / 100) * (size - pad * 2),
        fill: CLUSTER_FILL[cluster.colorToken],
      };
    });
  });
  return (
    <div className="rounded-aequan border border-subtle bg-white p-3">
      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-auto w-full max-w-sm" role="img" aria-label="Scattergramma">
        {[0, 1, 2, 3, 4].map((step) => (
          <g key={step}>
            <line
              x1={pad}
              x2={size - pad}
              y1={pad + ((size - pad * 2) * step) / 4}
              y2={pad + ((size - pad * 2) * step) / 4}
              stroke={LINE}
            />
            <line
              y1={pad}
              y2={size - pad}
              x1={pad + ((size - pad * 2) * step) / 4}
              x2={pad + ((size - pad * 2) * step) / 4}
              stroke={LINE}
            />
          </g>
        ))}
        {dots.map((dot) => (
          <circle key={dot.key} cx={dot.cx} cy={dot.cy} r="2.2" fill={dot.fill} opacity="0.85" />
        ))}
        <text x={size / 2} y={size - 8} textAnchor="middle" fill={MUTED} fontSize="11">
          {plot.xAxisLabel}
        </text>
        <text x="14" y={size / 2} fill={MUTED} fontSize="11" transform={`rotate(-90 14 ${size / 2})`}>
          {plot.yAxisLabel}
        </text>
      </svg>
    </div>
  );
}

function fieldPoint(seed: string, index: number, radius: number): { x: number; y: number } {
  const random = mulberry32(hashSeed(`${seed}:${index}`));
  const angle = random() * Math.PI * 2;
  const distance = Math.sqrt(random()) * radius;
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}

function CellGlyph({
  kind,
  x,
  y,
  dark,
}: {
  kind: Extract<LabTraceVisual, { type: "MICROSCOPY" }>["elements"][number]["kind"];
  x: number;
  y: number;
  dark: boolean;
}) {
  if (kind === "SCHISTOCYTE") {
    return <polygon points={`${x},${y - 5} ${x + 6},${y + 4} ${x - 2},${y + 3}`} fill="#C47A7A" />;
  }
  if (kind === "PLT_CLUMP") {
    return (
      <g>
        {[0, 1, 2, 3, 4].map((dot) => (
          <circle key={dot} cx={x + (dot % 3) * 3 - 3} cy={y + Math.floor(dot / 3) * 3 - 2} r="1.6" fill="#6D4A86" />
        ))}
      </g>
    );
  }
  if (kind === "NEUTROPHIL") {
    return (
      <g>
        <circle cx={x} cy={y} r="7" fill="#F3D2C8" stroke="#C4A294" />
        <circle cx={x - 2} cy={y} r="2" fill="#7A5A9A" />
        <circle cx={x + 2.4} cy={y + 1} r="1.7" fill="#7A5A9A" />
      </g>
    );
  }
  if (kind === "AUER_BLAST") {
    return (
      <g>
        <circle cx={x} cy={y} r="8" fill="#E7D7F2" stroke="#8A6AA8" />
        <line x1={x - 3} y1={y + 1} x2={x + 4} y2={y - 2} stroke="#C0392B" strokeWidth="1.2" />
      </g>
    );
  }
  if (kind === "ACANTHOCYTE") {
    return <polygon points={`${x},${y - 6} ${x + 2},${y - 1} ${x + 6},${y} ${x + 2},${y + 2} ${x},${y + 6} ${x - 2},${y + 1} ${x - 6},${y - 1}`} fill="#D7A3A3" />;
  }
  if (kind === "RBC_CAST") {
    return <rect x={x - 10} y={y - 3} width="22" height="6" rx="3" fill="#E7C27A" opacity="0.9" />;
  }
  if (kind === "BACTERIA") {
    return <rect x={x - 3} y={y - 1} width="7" height="2" rx="1" fill={dark ? "#7DCEA0" : "#3D6B54"} />;
  }
  if (kind === "IFI_HOMOGENEOUS") {
    return <circle cx={x} cy={y} r="7" fill="#3DDC84" opacity="0.85" />;
  }
  if (kind === "IFI_SPECKLED") {
    return (
      <g>
        <circle cx={x} cy={y} r="7" fill="none" stroke="#3DDC84" />
        <circle cx={x - 2} cy={y} r="1.1" fill="#3DDC84" />
        <circle cx={x + 2} cy={y + 1} r="1.1" fill="#3DDC84" />
        <circle cx={x} cy={y - 2} r="1.1" fill="#3DDC84" />
      </g>
    );
  }
  return <ellipse cx={x} cy={y} rx="6" ry="4.2" fill="#E7B4B4" />;
}

export function MicroscopyFieldViewer({
  field,
}: {
  field: Extract<LabTraceVisual, { type: "MICROSCOPY" }>;
}) {
  const dark = field.specimen === "ANA_IFI";
  const glyphs = field.elements.flatMap((element) =>
    Array.from({ length: element.count }, (_, index) => {
      const point = fieldPoint(`${field.specimen}:${element.kind}`, index, 78);
      return { kind: element.kind, x: 120 + point.x, y: 120 + point.y, key: `${element.kind}-${index}` };
    }),
  );
  return (
    <div className="rounded-aequan border border-subtle bg-white p-3">
      <div className="mb-2 flex flex-wrap justify-between gap-2 text-[11px] text-text-secondary">
        <span>{field.magnification}</span>
        <span>{field.stain}</span>
      </div>
      <svg viewBox="0 0 240 240" className="mx-auto h-auto w-full max-w-xs" role="img" aria-label="Campo microscopico">
        <circle cx="120" cy="120" r="108" fill={dark ? "#0C1A14" : "#F7F3EC"} stroke={LINE} />
        {glyphs.map((glyph) => (
          <CellGlyph key={glyph.key} kind={glyph.kind} x={glyph.x} y={glyph.y} dark={dark} />
        ))}
      </svg>
      <p className="mt-2 text-xs text-text-secondary">{field.caption}</p>
    </div>
  );
}

export function MixingStudyChart({
  study,
}: {
  study: Extract<LabTraceVisual, { type: "MIXING_STUDY" }>;
}) {
  const bars = [
    { label: "Basale", value: study.baselineSec },
    { label: "Miscela 1:1", value: study.immediateMixSec },
    { label: "Incubata 2 h", value: study.incubatedMixSec },
    { label: "Controllo", value: study.controlSec },
  ];
  const max = Math.max(...bars.map((bar) => bar.value), 1) * 1.15;
  return (
    <div className="rounded-aequan border border-subtle bg-white p-3">
      <p className="mb-2 text-[11px] text-text-secondary">Secondi · riferimento {study.refRangeSec}</p>
      <div className="grid grid-cols-4 items-end gap-2">
        {bars.map((bar) => (
          <div key={bar.label} className="flex flex-col items-center gap-1">
            <span className="text-xs font-semibold tabular-nums text-text-primary">{formatNumber(bar.value)}</span>
            <div className="flex h-28 w-full items-end rounded-aequan bg-ui-bg">
              <div
                className="w-full rounded-aequan bg-brand-primary"
                style={{ height: `${(bar.value / max) * 100}%` }}
              />
            </div>
            <span className="text-center text-[10px] text-text-secondary">{bar.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LabTraceVisualView({ visual }: { visual: LabTraceVisual }) {
  if (visual.type === "ELECTROPHORESIS") return <ElectrophoresisTraceChart trace={visual} />;
  if (visual.type === "SCATTERGRAM") return <HematologyScattergram plot={visual} />;
  if (visual.type === "MICROSCOPY") return <MicroscopyFieldViewer field={visual} />;
  return <MixingStudyChart study={visual} />;
}
