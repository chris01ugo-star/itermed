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
      <div className="flex h-full min-h-0 w-full items-center justify-center text-xs text-slate-400">
        Dati radar non disponibili
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} outerRadius="72%">
          <PolarGrid radialLines={false} stroke="#E2E8F0" />
          <PolarAngleAxis dataKey="metric" tick={{ fill: "#64748B", fontSize: 11 }} />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            tickCount={6}
          />
          <Radar
            name="Target"
            dataKey="target"
            stroke="#CBD5E1"
            fill="#E2E8F0"
            fillOpacity={0.25}
            strokeDasharray="4 4"
          />
          <Radar
            name="Performance"
            dataKey="score"
            stroke="#345884"
            fill="#345884"
            fillOpacity={0.22}
          />
          <Legend
            verticalAlign="bottom"
            height={28}
            wrapperStyle={{ fontSize: 11, color: "#64748B" }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
