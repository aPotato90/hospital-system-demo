"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Dashboard charts. Single series each, so one validated hue (--chart-1, see
 * globals.css) and no legend: the title names what is plotted. Thin marks,
 * hairline grid, text in text tokens, a hover/focus tooltip, and every value
 * also available in the data table under each chart.
 */

const AXIS = { fontSize: 12, fill: "var(--muted-foreground)" } as const;

/** Figure with a title, a short description and a data table fallback. */
export function ChartFigure({
  id,
  title,
  description,
  columns,
  rows,
  children,
}: {
  id: string;
  title: string;
  description: string;
  columns: [string, string];
  rows: [string, string][];
  children: React.ReactNode;
}) {
  return (
    <figure
      aria-labelledby={`${id}-title`}
      className="rounded-xl border bg-card p-4"
    >
      <figcaption>
        <h3 id={`${id}-title`} className="font-semibold">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </figcaption>
      {/* The plot is decorative for assistive tech; the table carries the data. */}
      <div className="mt-3 h-64" aria-hidden="true">
        {children}
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer rounded text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          Show data table
        </summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="py-1 pr-2 font-medium">
                  {columns[0]}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {columns[1]}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k} className="border-b border-dashed last:border-0">
                  <th scope="row" className="py-1 pr-2 text-left font-normal">
                    {k}
                  </th>
                  <td className="py-1 text-right tabular-nums">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown; payload?: { label?: string } }>;
  label?: unknown;
  format: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0].value ?? 0);
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="font-semibold tabular-nums">{format(value)}</p>
      <p className="text-muted-foreground">
        {String(payload[0].payload?.label ?? label)}
      </p>
    </div>
  );
}

/** Area chart over time (single series, crosshair tooltip). */
export function TimeAreaChart({
  data,
  format,
  compact,
}: {
  data: { label: string; value: number }[];
  format: (v: number) => string;
  compact: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        accessibilityLayer={false}
      >
        <CartesianGrid
          vertical={false}
          stroke="var(--border)"
          strokeWidth={1}
        />
        <XAxis
          dataKey="label"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          tickFormatter={compact}
          width={56}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
          content={({ active, payload, label }) => (
            <ChartTooltip
              active={active}
              payload={payload}
              label={label}
              format={format}
            />
          )}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--chart-1)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="var(--chart-1)"
          fillOpacity={0.1}
          activeDot={{
            r: 4,
            fill: "var(--chart-1)",
            stroke: "var(--card)",
            strokeWidth: 2,
          }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars for a ranked or categorical breakdown, value at the tip. */
export function HorizontalBarChart({
  data,
  format,
  labelWidth = 120,
}: {
  data: { label: string; value: number }[];
  format: (v: number) => string;
  labelWidth?: number;
}) {
  const short = (s: string) => (s.length > 18 ? `${s.slice(0, 17)}…` : s);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 64, bottom: 0, left: 0 }}
        barCategoryGap={2}
        accessibilityLayer={false}
      >
        <CartesianGrid
          horizontal={false}
          stroke="var(--border)"
          strokeWidth={1}
        />
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis
          type="category"
          dataKey="label"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          width={labelWidth}
          tickFormatter={short}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={({ active, payload, label }) => (
            <ChartTooltip
              active={active}
              payload={payload}
              label={label}
              format={format}
            />
          )}
          isAnimationActive={false}
        />
        <Bar
          dataKey="value"
          fill="var(--chart-1)"
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v: unknown) => format(Number(v))}
            style={{ fontSize: 12, fill: "var(--foreground)" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
