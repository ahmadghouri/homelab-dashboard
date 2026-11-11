import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { cn } from '@/lib/utils';

// Time series area chart.
// series: [{ key, label, color }] where color is a CSS color (for example 'var(--chart-1)').
export function MetricChart({
  data,
  series,
  valueFormatter = (value) => value,
  timeFormatter,
  yDomain = [0, 'auto'],
  className,
}) {
  const config = Object.fromEntries(
    series.map(({ key, label, color }) => [key, { label, color }]),
  );

  return (
    <ChartContainer config={config} className={cn('aspect-auto h-64 w-full', className)}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <defs>
          {series.map(({ key }) => (
            <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={`var(--color-${key})`} stopOpacity={0.35} />
              <stop offset="95%" stopColor={`var(--color-${key})`} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="ts"
          tickLine={false}
          axisLine={false}
          minTickGap={40}
          tickFormatter={timeFormatter}
        />
        <YAxis
          width={56}
          tickLine={false}
          axisLine={false}
          domain={yDomain}
          tickFormatter={valueFormatter}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => timeFormatter?.(payload?.[0]?.payload?.ts)}
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span
                      className="size-2 rounded-[2px]"
                      style={{ backgroundColor: `var(--color-${name})` }}
                    />
                    {config[name]?.label ?? name}
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {valueFormatter(value)}
                  </span>
                </div>
              )}
            />
          }
        />
        {series.map(({ key }) => (
          <Area
            key={key}
            dataKey={key}
            type="monotone"
            stroke={`var(--color-${key})`}
            strokeWidth={2}
            fill={`url(#fill-${key})`}
            isAnimationActive={false}
            connectNulls
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}
