"use client";

import { type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface CreatePageHeaderProps {
  title: string;
  fallbackHref?: string;
  rightContent?: ReactNode;
}

export function CreatePageHeader({ title, fallbackHref, rightContent }: CreatePageHeaderProps) {
  const router = useRouter();

  return (
    <div className="sticky top-12 sm:top-14 z-10 border-b bg-background/80 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else if (fallbackHref) {
                router.push(fallbackHref);
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        {rightContent && <div>{rightContent}</div>}
      </div>
    </div>
  );
}
