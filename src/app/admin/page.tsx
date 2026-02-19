"use client";

import { useState, useEffect } from "react";
import { FileText, Clock, CheckCircle, XCircle, Bell, BellDot, Calendar, MapPin, Briefcase, Loader2 } from "lucide-react";
import { StatsCard } from "@/components/admin/stats-card";
import { adminGetDashboardStats } from "@/actions/admin";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<{
    posts: Record<string, number>;
    events: Record<string, number>;
    landmarks: Record<string, number>;
    gigs: Record<string, number>;
    notifications: { total: number; unread: number };
  } | null>(null);

  useEffect(() => {
    adminGetDashboardStats().then((res) => {
      if (res.success) setStats(res.data);
    });
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Posts</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Total Posts" value={stats.posts.total} icon={FileText} />
          <StatsCard title="Pending Review" value={stats.posts.draft} icon={Clock} className="text-amber-500" />
          <StatsCard title="Published" value={stats.posts.approved} icon={CheckCircle} className="text-green-500" />
          <StatsCard title="Declined" value={stats.posts.rejected} icon={XCircle} className="text-red-500" />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Events</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Total Events" value={stats.events.total} icon={Calendar} />
          <StatsCard title="Pending Review" value={stats.events.draft} icon={Clock} className="text-amber-500" />
          <StatsCard title="Published" value={stats.events.approved} icon={CheckCircle} className="text-green-500" />
          <StatsCard title="Declined" value={stats.events.rejected} icon={XCircle} className="text-red-500" />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Gigs</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Total Gigs" value={stats.gigs.total} icon={Briefcase} />
          <StatsCard title="Pending Review" value={stats.gigs.draft} icon={Clock} className="text-amber-500" />
          <StatsCard title="Published" value={stats.gigs.approved} icon={CheckCircle} className="text-green-500" />
          <StatsCard title="Declined" value={stats.gigs.rejected} icon={XCircle} className="text-red-500" />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Locations</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Total Locations" value={stats.landmarks.total} icon={MapPin} />
          <StatsCard title="Pending Review" value={stats.landmarks.draft} icon={Clock} className="text-amber-500" />
          <StatsCard title="Approved" value={stats.landmarks.approved} icon={CheckCircle} className="text-green-500" />
          <StatsCard title="Rejected" value={stats.landmarks.rejected} icon={XCircle} className="text-red-500" />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">System</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Notifications" value={stats.notifications.total} icon={Bell} />
          <StatsCard title="Unread Notifications" value={stats.notifications.unread} icon={BellDot} className="text-primary" />
        </div>
      </div>
    </div>
  );
}
