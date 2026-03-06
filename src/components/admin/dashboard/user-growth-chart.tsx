import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UserGrowthChartProps {
  data: { date: string; count: number }[];
}

export function UserGrowthChart({ data }: UserGrowthChartProps) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            User Signups (30d)
          </CardTitle>
          <span className="text-2xl font-bold">{total}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-[2px] h-28">
          {data.map((day) => (
            <div
              key={day.date}
              className="flex-1 rounded-t-sm bg-primary transition-all hover:opacity-80"
              style={{
                height: `${Math.max((day.count / max) * 100, day.count > 0 ? 4 : 0)}%`,
              }}
              title={`${day.date}: ${day.count} signup${day.count !== 1 ? "s" : ""}`}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{data[0]?.date.slice(5)}</span>
          <span>{data[data.length - 1]?.date.slice(5)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
