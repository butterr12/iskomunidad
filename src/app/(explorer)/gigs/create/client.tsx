"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { GigFormInner, type CreateGigFormData } from "@/components/gigs/create-gig-form";
import { CreatePageHeader } from "@/components/shared/create-page-header";
import { createGig } from "@/actions/gigs";
import { toast } from "sonner";
import { usePostHog } from "posthog-js/react";

export function CreateGigPageClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const posthog = usePostHog();

  const handleSubmit = async (data: CreateGigFormData) => {
    const res = await createGig(data);
    if (res.success) {
      await queryClient.invalidateQueries({ queryKey: ["approved-gigs"] });
      const status = (res.data as { status?: string }).status;
      posthog?.capture("gig_created", { status, category: data.category });
      toast.success(
        status === "draft"
          ? "Gig submitted for review."
          : "Gig posted!",
      );
      router.push("/gigs");
    } else {
      toast.error(res.error);
    }
    return { success: res.success };
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
      <CreatePageHeader title="Post a Gig" fallbackHref="/gigs" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-4">
          <div className="rounded-2xl border bg-card shadow-sm p-6 flex flex-col gap-4">
            <GigFormInner
              onSubmit={handleSubmit}
              onClose={() => router.push("/gigs")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
