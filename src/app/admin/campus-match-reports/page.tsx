"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert } from "lucide-react";
import {
  adminBanUserFromCampusMatchReport,
  adminGetCampusMatchReports,
  adminLiftCampusMatchBan,
  adminResolveCampusMatchReport,
} from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type ReportFilter = "pending" | "resolved" | "all";

const REPORTS_QUERY_KEY = ["admin-campus-match-reports"] as const;

function formatUserLabel(user: { name: string; username: string | null }): string {
  return user.username ? `${user.name} (@${user.username})` : user.name;
}

export default function CampusMatchReportsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ReportFilter>("pending");
  const [noteByReportId, setNoteByReportId] = useState<Record<string, string>>({});
  const [daysByReportId, setDaysByReportId] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: [...REPORTS_QUERY_KEY, filter],
    queryFn: async () => {
      const res = await adminGetCampusMatchReports(filter === "all" ? undefined : filter);
      return res.success ? res.data : [];
    },
  });

  const summary = useMemo(() => {
    const pending = reports.filter((report) => report.status === "pending").length;
    const resolved = reports.filter((report) => report.status === "resolved").length;
    return { pending, resolved, total: reports.length };
  }, [reports]);

  async function refreshReports() {
    await queryClient.invalidateQueries({ queryKey: REPORTS_QUERY_KEY });
  }

  async function handleResolve(reportId: string) {
    const key = `resolve:${reportId}`;
    setBusyKey(key);
    const adminNote = noteByReportId[reportId]?.trim() || undefined;
    const res = await adminResolveCampusMatchReport({ reportId, adminNote });
    setBusyKey(null);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Report resolved");
    await refreshReports();
  }

  async function handleBan(reportId: string) {
    const key = `ban:${reportId}`;
    setBusyKey(key);
    const daysInput = daysByReportId[reportId]?.trim();
    const parsedDays = daysInput ? Number(daysInput) : 7;
    const durationDays = Number.isFinite(parsedDays) && parsedDays > 0
      ? Math.floor(parsedDays)
      : 7;
    const adminNote = noteByReportId[reportId]?.trim() || undefined;
    const res = await adminBanUserFromCampusMatchReport({
      reportId,
      durationDays,
      adminNote,
    });
    setBusyKey(null);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(`User banned for ${durationDays} day${durationDays === 1 ? "" : "s"}`);
    await refreshReports();
  }

  async function handleLiftBan(banId: string) {
    const key = `lift:${banId}`;
    setBusyKey(key);
    const res = await adminLiftCampusMatchBan({ banId });
    setBusyKey(null);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Ban lifted");
    await refreshReports();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-semibold">{summary.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Resolved</p>
            <p className="text-2xl font-semibold">{summary.resolved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold">{summary.total}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as ReportFilter)}>
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No reports in this view.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const noteValue = noteByReportId[report.id] ?? "";
            const daysValue = daysByReportId[report.id] ?? "7";
            const canMutate = busyKey === null;
            return (
              <Card key={report.id}>
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base">Report #{report.id.slice(0, 8)}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Filed {new Date(report.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={report.status === "pending" ? "destructive" : "secondary"}>
                        {report.status}
                      </Badge>
                      {report.activeBan && (
                        <Badge variant="outline" className="text-amber-700">
                          Banned until {new Date(report.activeBan.expiresAt).toLocaleDateString()}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <p>
                      <span className="text-muted-foreground">Reporter: </span>
                      {formatUserLabel(report.reporter)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Reported user: </span>
                      {formatUserLabel(report.reportedUser)}
                    </p>
                    <p className="sm:col-span-2">
                      <span className="text-muted-foreground">Reason: </span>
                      {report.reason}
                    </p>
                    {report.adminNote && (
                      <p className="sm:col-span-2">
                        <span className="text-muted-foreground">Admin note: </span>
                        {report.adminNote}
                      </p>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border">
                    <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                      Transcript preview (last 20)
                    </div>
                    {report.transcriptPreview.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-muted-foreground">No anon messages captured.</p>
                    ) : (
                      <div className="max-h-64 space-y-2 overflow-y-auto px-3 py-3">
                        {report.transcriptPreview.map((msg) => (
                          <div key={msg.id} className="rounded-md border bg-muted/20 px-2 py-1.5 text-xs">
                            <p className="mb-1 text-[11px] text-muted-foreground">
                              {msg.senderAlias} · {new Date(msg.createdAt).toLocaleString()}
                            </p>
                            {msg.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
                            {msg.imageUrl && (
                              <p className="mt-1 text-muted-foreground">Image: {msg.imageUrl}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                    <div className="space-y-1">
                      <Label htmlFor={`admin-note-${report.id}`}>Admin note</Label>
                      <Textarea
                        id={`admin-note-${report.id}`}
                        value={noteValue}
                        onChange={(e) =>
                          setNoteByReportId((prev) => ({ ...prev, [report.id]: e.target.value }))
                        }
                        placeholder="Optional note for resolution or ban"
                        maxLength={1000}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`ban-days-${report.id}`}>Ban duration (days)</Label>
                      <Input
                        id={`ban-days-${report.id}`}
                        value={daysValue}
                        onChange={(e) =>
                          setDaysByReportId((prev) => ({ ...prev, [report.id]: e.target.value }))
                        }
                        inputMode="numeric"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {report.status === "pending" && (
                      <Button
                        variant="outline"
                        onClick={() => void handleResolve(report.id)}
                        disabled={!canMutate || busyKey === `resolve:${report.id}`}
                      >
                        {busyKey === `resolve:${report.id}` ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Resolve
                      </Button>
                    )}

                    <Button
                      variant="destructive"
                      onClick={() => void handleBan(report.id)}
                      disabled={
                        !canMutate ||
                        busyKey === `ban:${report.id}` ||
                        report.activeBan !== null
                      }
                    >
                      {busyKey === `ban:${report.id}` ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldAlert className="mr-2 h-4 w-4" />
                      )}
                      Ban user
                    </Button>

                    {report.activeBan && (
                      <Button
                        variant="outline"
                        onClick={() => void handleLiftBan(report.activeBan!.banId)}
                        disabled={!canMutate || busyKey === `lift:${report.activeBan.banId}`}
                      >
                        {busyKey === `lift:${report.activeBan.banId}` ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Lift ban
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
