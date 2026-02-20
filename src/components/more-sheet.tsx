"use client";

import Link from "next/link";
import { CalendarDays, HeartHandshake, Settings, Bot, UsersRound, Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const items = [
  { label: "Events", href: "/events", icon: CalendarDays, comingSoon: false, toastMessage: "" },
  { label: "Match", href: null, icon: HeartHandshake, comingSoon: true, toastMessage: "Campus Match is coming soon! Stay tuned." },
  { label: "Settings", href: "/settings", icon: Settings, comingSoon: false, toastMessage: "" },
  { label: "Isko AI", href: null, icon: Bot, comingSoon: true, toastMessage: "Isko AI chatbot is coming soon! Your all-in-one uni assistant." },
  { label: "Orgs", href: null, icon: UsersRound, comingSoon: true, toastMessage: "Orgs directory is coming soon! Discover and join student organizations." },
  { label: "Housing", href: null, icon: Building2, comingSoon: true, toastMessage: "Housing portal & Rate My Dorm is coming soon!" },
];

interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
}

export function MoreSheet({ open, onOpenChange, pathname }: MoreSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="rounded-t-2xl px-6 pb-8 pt-3 gap-0"
      >
        <SheetHeader className="p-0">
          <SheetTitle className="sr-only">More</SheetTitle>
          <SheetDescription className="sr-only">
            Additional navigation options
          </SheetDescription>
        </SheetHeader>

        {/* Drag indicator pill */}
        <div className="flex justify-center mb-4">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="grid grid-cols-3 gap-3 items-stretch">
          {items.map((item, i) => {
            const isActive = item.href ? pathname.startsWith(item.href) : false;

            if (item.comingSoon) {
              return (
                <button
                  key={item.label}
                  className="more-grid-item flex flex-col items-center justify-center gap-2 rounded-xl bg-muted/60 p-4 transition-colors"
                  style={{ animationDelay: `${i * 60}ms` }}
                  onClick={() =>
                    toast.info(item.toastMessage)
                  }
                >
                  <div className="relative">
                    <item.icon className="h-6 w-6 text-muted-foreground" />
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary">
                      <span className="absolute inset-0 animate-ping rounded-full bg-primary" />
                    </span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {item.label}
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0"
                  >
                    Soon
                  </Badge>
                </button>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href ?? "#"}
                className={cn(
                  "more-grid-item flex flex-col items-center justify-center gap-2 rounded-xl p-4 transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "bg-muted/40 hover:bg-muted"
                )}
                style={{ animationDelay: `${i * 60}ms` }}
                onClick={() => onOpenChange(false)}
              >
                <item.icon
                  className={cn(
                    "h-6 w-6",
                    isActive ? "text-primary" : "text-foreground"
                  )}
                />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
