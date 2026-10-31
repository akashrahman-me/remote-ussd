"use client"

import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { number } from "@/lib/format"
import { dailySeries } from "@/lib/stats"
import { useAppStore } from "@/store/app-store"

const config = {
  completed: { label: "Completed", color: "var(--chart-1)" },
  timedOut: { label: "Timed out", color: "var(--chart-3)" },
  failed: { label: "Failed", color: "var(--chart-4)" },
} satisfies ChartConfig

export function RunsChart({ className }: { className?: string }) {
  const runs = useAppStore((s) => s.runs)
  const data = useMemo(() => dailySeries(runs, 7), [runs])
  const total = data.reduce((sum, d) => sum + d.completed + d.failed + d.timedOut, 0)
  const ok = data.reduce((sum, d) => sum + d.completed, 0)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Runs, last 7 days</CardTitle>
        <CardDescription>
          {number(total)} sessions · {total ? ((ok / total) * 100).toFixed(1) : "0"}% completed
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-56 w-full">
          <BarChart data={data} margin={{ left: 0, right: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="completed" stackId="a" fill="var(--color-completed)" radius={[0, 0, 4, 4]} />
            <Bar dataKey="timedOut" stackId="a" fill="var(--color-timedOut)" />
            <Bar dataKey="failed" stackId="a" fill="var(--color-failed)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
