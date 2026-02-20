"use client";

import { useState, useEffect } from "react";
import { Loader2, ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  adminGetAbuseStats,
  adminGetAbuseEvents,
  adminClearAbuseCooldown,
} from "@/actions/admin";

interface AbuseStats {
  total: number;
  denied: number;
  throttled: number;
  shadow: number;
  byAction: { action: string; count: number }[];
  topOffenders: { userIdHash: string; count: number }[];
}

interface AbuseEvent {
  id: string;
  action: string;
  decision: string;
  reason: string | null;
  triggeredRule: string | null;
  currentCount: number | null;
  limitValue: number | null;
  userIdHash: string | null;
  ipHash: string | null;
  mode: string;
  createdAt: string;
}

export default function AbuseMonitorPage() {
  const [stats, setStats] = useState<AbuseStats | null>(null);
  const [events, setEvents] = useState<AbuseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      const [statsRes, eventsRes] = await Promise.all([
        adminGetAbuseStats(),
        adminGetAbuseEvents({
          action: actionFilter || undefined,
          decision: decisionFilter || undefined,
        }),
      ]);
      if (cancelled) return;
      if (statsRes.success) setStats(statsRes.data);
      if (eventsRes.success) setEvents(eventsRes.data.events as AbuseEvent[]);
      setLoading(false);
    }

    fetchData();
    return () => { cancelled = true; };
  }, [actionFilter, decisionFilter, refreshKey]);

  const handleRefresh = () => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  const handleClearCooldown = async (userIdHash: string) => {
    await adminClearAbuseCooldown(userIdHash);
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          <h1 className="text-2xl font-bold">Abuse Monitor</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Events (24h)" value={stats.total} />
          <StatCard label="Denied" value={stats.denied} className="text-red-600" />
          <StatCard label="Throttled" value={stats.throttled} className="text-yellow-600" />
          <StatCard label="Shadow Mode" value={stats.shadow} className="text-blue-600" />
        </div>
      )}

      {/* By-action breakdown */}
      {stats && stats.byAction.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">By Action (24h)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Action</th>
                  <th className="px-4 py-2 text-right font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {stats.byAction.map((row) => (
                  <tr key={row.action} className="border-b last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">{row.action}</td>
                    <td className="px-4 py-2 text-right">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top offenders */}
      {stats && stats.topOffenders.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Top Offenders (24h)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">User ID Hash</th>
                  <th className="px-4 py-2 text-right font-medium">Events</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats.topOffenders.map((row) => (
                  <tr key={row.userIdHash} className="border-b last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">{row.userIdHash}</td>
                    <td className="px-4 py-2 text-right">{row.count}</td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleClearCooldown(row.userIdHash)}
                      >
                        Clear Cooldown
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent events */}
      <div className="rounded-lg border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">Recent Events</h2>
          <div className="flex gap-2">
            <select
              className="rounded border px-2 py-1 text-xs"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All actions</option>
              {stats?.byAction.map((r) => (
                <option key={r.action} value={r.action}>
                  {r.action}
                </option>
              ))}
            </select>
            <select
              className="rounded border px-2 py-1 text-xs"
              value={decisionFilter}
              onChange={(e) => setDecisionFilter(e.target.value)}
            >
              <option value="">All decisions</option>
              <option value="deny">deny</option>
              <option value="throttle">throttle</option>
              <option value="degrade_to_review">degrade_to_review</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Time</th>
                <th className="px-4 py-2 text-left font-medium">Action</th>
                <th className="px-4 py-2 text-left font-medium">Decision</th>
                <th className="px-4 py-2 text-left font-medium">Reason</th>
                <th className="px-4 py-2 text-left font-medium">Count/Limit</th>
                <th className="px-4 py-2 text-left font-medium">Mode</th>
                <th className="px-4 py-2 text-left font-medium">User Hash</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No abuse events found
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 text-xs">
                      {new Date(event.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{event.action}</td>
                    <td className="px-4 py-2">
                      <DecisionBadge decision={event.decision} />
                    </td>
                    <td className="px-4 py-2 text-xs">{event.reason}</td>
                    <td className="px-4 py-2 text-xs">
                      {event.currentCount != null && event.limitValue != null
                        ? `${event.currentCount}/${event.limitValue}`
                        : "-"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                          event.mode === "shadow"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {event.mode}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {event.userIdHash?.slice(0, 8) ?? "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${className ?? ""}`}>{value}</p>
    </div>
  );
}

function DecisionBadge({ decision }: { decision: string }) {
  const colors: Record<string, string> = {
    deny: "bg-red-100 text-red-700",
    throttle: "bg-yellow-100 text-yellow-700",
    degrade_to_review: "bg-orange-100 text-orange-700",
    allow: "bg-green-100 text-green-700",
  };
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
        colors[decision] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {decision}
    </span>
  );
}
