import { MessageSquare, Shuffle, CalendarCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EngagementSnapshotProps {
  data: {
    messagesSent: number;
    campusMatchSessions: number;
    eventRsvps: number;
  };
}

export function EngagementSnapshot({ data }: EngagementSnapshotProps) {
  const items = [
    {
      label: "Messages Sent",
      value: data.messagesSent,
      icon: MessageSquare,
      color: "text-blue-500",
    },
    {
      label: "CM Sessions",
      value: data.campusMatchSessions,
      icon: Shuffle,
      color: "text-purple-500",
    },
    {
      label: "Event RSVPs",
      value: data.eventRsvps,
      icon: CalendarCheck,
      color: "text-green-500",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Engagement (7 days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="text-center">
                <Icon className={`mx-auto h-5 w-5 ${item.color}`} />
                <div className="mt-2 text-xl font-bold">{item.value}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.label}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
