"use client";

import { BellOff } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/posts";

interface AdminNotification {
  id: string;
  type: string;
  targetId: string;
  targetTitle: string;
  authorHandle: string;
  reason?: string | null;
  createdAt: string;
  readByAdmin: boolean;
}

interface NotificationTableProps {
  notifications: AdminNotification[];
  onMarkAllRead: () => void;
}

function getNotificationBadge(type: string): { variant: "default" | "destructive" | "secondary"; label: string } {
  switch (type) {
    case "post_approved":
      return { variant: "default", label: "Post Published" };
    case "post_rejected":
      return { variant: "destructive", label: "Post Declined" };
    case "post_pending":
      return { variant: "secondary", label: "Post Pending" };
    case "event_approved":
      return { variant: "default", label: "Event Published" };
    case "event_rejected":
      return { variant: "destructive", label: "Event Declined" };
    case "event_pending":
      return { variant: "secondary", label: "Event Pending" };
    case "landmark_approved":
      return { variant: "default", label: "Location Approved" };
    case "landmark_rejected":
      return { variant: "destructive", label: "Location Rejected" };
    case "landmark_pending":
      return { variant: "secondary", label: "Location Pending" };
    case "gig_approved":
      return { variant: "default", label: "Gig Published" };
    case "gig_rejected":
      return { variant: "destructive", label: "Gig Declined" };
    case "gig_pending":
      return { variant: "secondary", label: "Gig Pending" };
    default:
      return { variant: "secondary", label: type };
  }
}

export function NotificationTable({ notifications, onMarkAllRead }: NotificationTableProps) {
  const unreadCount = notifications.filter((n) => !n.readByAdmin).length;

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <BellOff className="h-10 w-10 mb-2" />
        <p>No notifications yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onMarkAllRead}>
            Mark all as read ({unreadCount})
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Author / Organizer</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notifications.map((n) => {
              const badge = getNotificationBadge(n.type);
              return (
                <TableRow key={n.id}>
                  <TableCell>
                    {!n.readByAdmin && (
                      <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badge.variant}>
                      {badge.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-medium">{n.targetTitle}</TableCell>
                  <TableCell className="text-muted-foreground">{n.authorHandle}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {n.reason ?? "\u2014"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatRelativeTime(n.createdAt)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
