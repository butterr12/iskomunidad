import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ContentHealthProps {
  data: {
    posts: { draft: number; approved: number; rejected: number };
    events: { draft: number; approved: number; rejected: number };
    gigs: { draft: number; approved: number; rejected: number };
    landmarks: { draft: number; approved: number; rejected: number };
  };
}

function HealthBar({
  label,
  stats,
}: {
  label: string;
  stats: { draft: number; approved: number; rejected: number };
}) {
  const total = stats.draft + stats.approved + stats.rejected;
  if (total === 0) {
    return (
      <div className="flex items-center gap-3">
        <span className="w-20 shrink-0 text-sm font-medium">{label}</span>
        <div className="flex h-5 flex-1 items-center rounded-full bg-muted">
          <span className="px-2 text-xs text-muted-foreground">No data</span>
        </div>
        <span className="w-8 text-right text-xs text-muted-foreground">0</span>
      </div>
    );
  }

  const approvedPct = (stats.approved / total) * 100;
  const draftPct = (stats.draft / total) * 100;
  const rejectedPct = (stats.rejected / total) * 100;

  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-sm font-medium">{label}</span>
      <div className="flex h-5 flex-1 overflow-hidden rounded-full">
        {stats.approved > 0 && (
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${approvedPct}%` }}
            title={`Approved: ${stats.approved}`}
          />
        )}
        {stats.draft > 0 && (
          <div
            className="bg-amber-400 transition-all"
            style={{ width: `${draftPct}%` }}
            title={`Pending: ${stats.draft}`}
          />
        )}
        {stats.rejected > 0 && (
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${rejectedPct}%` }}
            title={`Rejected: ${stats.rejected}`}
          />
        )}
      </div>
      <span className="w-8 text-right text-xs text-muted-foreground">
        {total}
      </span>
    </div>
  );
}

export function ContentHealth({ data }: ContentHealthProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Content Health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <HealthBar label="Posts" stats={data.posts} />
        <HealthBar label="Events" stats={data.events} />
        <HealthBar label="Gigs" stats={data.gigs} />
        <HealthBar label="Locations" stats={data.landmarks} />

        <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            Approved
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            Pending
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            Rejected
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
