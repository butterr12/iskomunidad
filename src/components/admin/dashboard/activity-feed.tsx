import {
  UserPlus,
  FileText,
  Calendar,
  ShieldAlert,
  Flag,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ActivityItem = {
  type: "new_user" | "new_post" | "new_event" | "abuse" | "cm_report";
  title: string;
  detail: string;
  timestamp: string;
};

const iconMap = {
  new_user: { icon: UserPlus, color: "bg-green-500" },
  new_post: { icon: FileText, color: "bg-blue-500" },
  new_event: { icon: Calendar, color: "bg-purple-500" },
  abuse: { icon: ShieldAlert, color: "bg-red-500" },
  cm_report: { icon: Flag, color: "bg-amber-500" },
};

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="max-h-80 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No recent activity
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item, i) => {
              const { icon: Icon, color } = iconMap[item.type];
              return (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${color}`}
                  >
                    <Icon className="h-3 w-3 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-tight">
                      <span className="font-medium">{item.title}</span>{" "}
                      <span className="text-muted-foreground">{item.detail}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {timeAgo(item.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
