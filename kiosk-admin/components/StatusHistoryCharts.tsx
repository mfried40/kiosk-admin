"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface HistoryRow {
  recordedAt: string;
  online: boolean;
  batteryLevel: number | null;
  screenOn: boolean | null;
}

interface StatusHistoryChartsProps {
  deviceId: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function StatusHistoryCharts({ deviceId }: StatusHistoryChartsProps) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const to = new Date().toISOString();
        const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const res = await fetch(
          `/api/devices/${deviceId}/history?from=${from}&to=${to}`,
        );
        if (!res.ok) throw new Error("fetch failed");
        setRows((await res.json()) as HistoryRow[]);
      } catch {
        setError(true);
      }
    };
    void load();
  }, [deviceId]);

  if (error) return null;
  if (!rows) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No history available yet. Data is recorded each time the device info is fetched.
      </p>
    );
  }

  const batteryRows = rows.filter((r) => r.batteryLevel !== null);
  const uptimeRows = rows.map((r) => ({
    t: formatTime(r.recordedAt),
    online: r.online ? 1 : 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      {batteryRows.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Battery Level (%)
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={batteryRows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="batteryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="recordedAt"
                tickFormatter={formatTime}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={{ stroke: "hsl(var(--border))" }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={{ stroke: "hsl(var(--border))" }}
                width={32}
              />
              <Tooltip
                formatter={(v) => [`${String(v)}%`, "Battery"]}
                labelFormatter={(l) => formatTime(String(l))}
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "hsl(var(--popover-foreground))",
                }}
              />
              <Area
                type="monotone"
                dataKey="batteryLevel"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#batteryGradient)"
                dot={batteryRows.length <= 30}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Online Status
        </p>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={uptimeRows} barCategoryGap="20%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="t"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
              interval="preserveStartEnd"
            />
            <YAxis hide domain={[0, 1]} />
            <Tooltip
              formatter={(v) => [v === 1 ? "Online" : "Offline", "Status"]}
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "12px",
                color: "hsl(var(--popover-foreground))",
              }}
            />
            <Bar dataKey="online" radius={[2, 2, 0, 0]}>
              {uptimeRows.map((row, i) => (
                <Cell
                  key={i}
                  fill={row.online === 1 ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
