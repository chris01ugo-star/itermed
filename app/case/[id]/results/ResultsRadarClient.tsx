"use client";

import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";

export type RadarDatum = {
  metric: string;
  score: number;
  target?: number;
};

export function ResultsRadarClient({ data }: { data: RadarDatum[] }) {
  const chartData = (Array.isArray(data) ? data : []).map((d) => ({
    ...d,
    score: Number.isFinite(d?.score) ? d.score : 0,
    target: d.target ?? 100,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center text-xs text-[var(--aequan-text-secondary)]">
        Dati radar non disponibili
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} outerRadius="72%">
          <PolarGrid radialLines={false} stroke="var(--aequan-border)" />
          <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--aequan-text-secondary)", fontSize: 11 }} />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "var(--aequan-text-secondary)", fontSize: 10 }}
            tickCount={6}
          />
          <Radar
            name="Target"
            dataKey="target"
            stroke="var(--aequan-border)"
            fill="var(--aequan-border-subtle)"
            fillOpacity={0.25}
            strokeDasharray="4 4"
          />
          <Radar
            name="Performance"
            dataKey="score"
            stroke="var(--aequan-brand-secondary)"
            fill="var(--aequan-brand-secondary)"
            fillOpacity={0.22}
          />
          <Legend
            verticalAlign="bottom"
            height={28}
            wrapperStyle={{ fontSize: 11, color: "var(--aequan-text-secondary)" }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
