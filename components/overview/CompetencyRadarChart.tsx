"use client";

import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from "recharts";

export type CompetencyRadarPoint = {
  metric: string;
  score: number;
};

type CompetencyRadarChartProps = {
  data: CompetencyRadarPoint[];
};

function RadarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: CompetencyRadarPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-sm">
      <p className="font-display font-semibold text-text-primary">{point.metric}</p>
      <p className="mt-0.5 font-medium text-brand-secondary">Media: {point.score}/100</p>
    </div>
  );
}

export function CompetencyRadarChart({ data }: CompetencyRadarChartProps) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%" cx="50%" cy="52%">
          <defs>
            <linearGradient id="itermedRadarFill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#345884" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#1E324E" stopOpacity={0.16} />
            </linearGradient>
            <linearGradient id="itermedRadarStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#1E324E" />
              <stop offset="100%" stopColor="#345884" />
            </linearGradient>
          </defs>
          <PolarGrid gridType="circle" stroke="#E2E8F0" strokeWidth={1} />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fill: "#475569", fontSize: 11, fontWeight: 600 }}
          />
          <PolarRadiusAxis
            angle={20}
            domain={[0, 100]}
            tickCount={3}
            tick={{ fill: "#94A3B8", fontSize: 9 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<RadarTooltip />} />
          <Radar
            name="Score"
            dataKey="score"
            stroke="url(#itermedRadarStroke)"
            strokeWidth={2.5}
            fill="url(#itermedRadarFill)"
            fillOpacity={1}
            dot={{ fill: "#345884", stroke: "#fff", strokeWidth: 2, r: 4 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
