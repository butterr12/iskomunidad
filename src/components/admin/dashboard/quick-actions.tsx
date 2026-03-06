import Link from "next/link";
import {
  FileText,
  Calendar,
  MapPin,
  Briefcase,
  Users,
  ShieldAlert,
  Flag,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const actions = [
  { label: "Post Queue", href: "/admin/queue", icon: FileText },
  { label: "Event Queue", href: "/admin/events/queue", icon: Calendar },
  { label: "Gig Queue", href: "/admin/gigs/queue", icon: Briefcase },
  { label: "Location Queue", href: "/admin/locations/queue", icon: MapPin },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Abuse Monitor", href: "/admin/abuse", icon: ShieldAlert },
  { label: "CM Reports", href: "/admin/campus-match-reports", icon: Flag },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.href}
            variant="outline"
            size="sm"
            asChild
          >
            <Link href={action.href}>
              <Icon className="mr-1.5 h-3.5 w-3.5" />
              {action.label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
