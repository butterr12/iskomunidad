import Link from "next/link";
import { Users, FileText, Clock, ShieldAlert, Flag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface KpiCardsProps {
  kpis: {
    totalUsers: number;
    newUsersThisWeek: number;
    totalContent: number;
    pendingModeration: number;
    activeAbuseAlerts: number;
    pendingCmReports: number;
  };
}

export function KpiCards({ kpis }: KpiCardsProps) {
  const cards = [
    {
      label: "Total Users",
      value: kpis.totalUsers,
      sub: `+${kpis.newUsersThisWeek} this week`,
      icon: Users,
      color: "text-blue-500",
      href: "/admin/users",
    },
    {
      label: "Total Content",
      value: kpis.totalContent,
      icon: FileText,
      color: "text-foreground",
    },
    {
      label: "Pending Review",
      value: kpis.pendingModeration,
      icon: Clock,
      color: "text-amber-500",
      href: "/admin/queue",
    },
    {
      label: "Abuse Alerts (24h)",
      value: kpis.activeAbuseAlerts,
      icon: ShieldAlert,
      color: kpis.activeAbuseAlerts > 0 ? "text-red-500" : "text-muted-foreground",
      href: "/admin/abuse",
    },
    {
      label: "CM Reports",
      value: kpis.pendingCmReports,
      icon: Flag,
      color: kpis.pendingCmReports > 0 ? "text-amber-500" : "text-muted-foreground",
      href: "/admin/campus-match-reports",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        const content = (
          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {card.label}
                </span>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <div className="mt-2 text-2xl font-bold">{card.value}</div>
              {card.sub && (
                <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
              )}
            </CardContent>
          </Card>
        );
        if (card.href) {
          return (
            <Link key={card.label} href={card.href} className="transition-opacity hover:opacity-80">
              {content}
            </Link>
          );
        }
        return <div key={card.label}>{content}</div>;
      })}
    </div>
  );
}
