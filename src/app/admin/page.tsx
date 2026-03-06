"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { adminGetDashboardData } from "@/actions/admin";
import { KpiCards } from "@/components/admin/dashboard/kpi-cards";
import { QuickActions } from "@/components/admin/dashboard/quick-actions";
import { ActivityFeed } from "@/components/admin/dashboard/activity-feed";
import { UserGrowthChart } from "@/components/admin/dashboard/user-growth-chart";
import { ContentHealth } from "@/components/admin/dashboard/content-health";
import { EngagementSnapshot } from "@/components/admin/dashboard/engagement-snapshot";

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const res = await adminGetDashboardData();
      return res.success ? res.data : null;
    },
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <KpiCards kpis={data.kpis} />
      <QuickActions />

      <div className="grid gap-6 lg:grid-cols-2">
        <ActivityFeed items={data.recentActivity} />
        <UserGrowthChart data={data.userGrowth} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ContentHealth data={data.contentHealth} />
        <EngagementSnapshot data={data.engagement} />
      </div>
    </div>
  );
}
