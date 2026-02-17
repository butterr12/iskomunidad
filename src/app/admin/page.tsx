"use client";

import { useMemo } from "react";
import { FileText, Clock, CheckCircle, XCircle, Bell, BellDot, Calendar, MapPin } from "lucide-react";
import { StatsCard } from "@/components/admin/stats-card";
import { getPosts, getNotifications, getEvents, getLandmarks } from "@/lib/admin-store";

export default function AdminDashboardPage() {
  const stats = useMemo(() => {
    const posts = getPosts();
    const events = getEvents();
    const landmarks = getLandmarks();
    const notifications = getNotifications();

    return {
      posts: {
        total: posts.length,
        pending: posts.filter((p) => p.status === "draft").length,
        approved: posts.filter((p) => !p.status || p.status === "approved").length,
        rejected: posts.filter((p) => p.status === "rejected").length,
      },
      events: {
        total: events.length,
        pending: events.filter((e) => e.status === "draft").length,
        approved: events.filter((e) => !e.status || e.status === "approved").length,
        rejected: events.filter((e) => e.status === "rejected").length,
      },
      locations: {
        total: landmarks.length,
        pending: landmarks.filter((l) => l.status === "draft").length,
        approved: landmarks.filter((l) => !l.status || l.status === "approved").length,
        rejected: landmarks.filter((l) => l.status === "rejected").length,
      },
      totalNotifs: notifications.length,
      unread: notifications.filter((n) => !n.readByAdmin).length,
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Posts</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Total Posts" value={stats.posts.total} icon={FileText} />
          <StatsCard title="Pending Review" value={stats.posts.pending} icon={Clock} className="text-amber-500" />
          <StatsCard title="Approved" value={stats.posts.approved} icon={CheckCircle} className="text-green-500" />
          <StatsCard title="Rejected" value={stats.posts.rejected} icon={XCircle} className="text-red-500" />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Events</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Total Events" value={stats.events.total} icon={Calendar} />
          <StatsCard title="Pending Review" value={stats.events.pending} icon={Clock} className="text-amber-500" />
          <StatsCard title="Approved" value={stats.events.approved} icon={CheckCircle} className="text-green-500" />
          <StatsCard title="Rejected" value={stats.events.rejected} icon={XCircle} className="text-red-500" />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Locations</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Total Locations" value={stats.locations.total} icon={MapPin} />
          <StatsCard title="Pending Review" value={stats.locations.pending} icon={Clock} className="text-amber-500" />
          <StatsCard title="Approved" value={stats.locations.approved} icon={CheckCircle} className="text-green-500" />
          <StatsCard title="Rejected" value={stats.locations.rejected} icon={XCircle} className="text-red-500" />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">System</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Notifications" value={stats.totalNotifs} icon={Bell} />
          <StatsCard title="Unread Notifications" value={stats.unread} icon={BellDot} className="text-primary" />
        </div>
      </div>
    </div>
  );
}
