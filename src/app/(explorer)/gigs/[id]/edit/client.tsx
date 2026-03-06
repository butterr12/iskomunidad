"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { GigFormInner, type CreateGigFormData } from "@/components/gigs/create-gig-form";
import { CreatePageHeader } from "@/components/shared/create-page-header";
import { getGigById, updateGig } from "@/actions/gigs";
import { toast } from "sonner";

interface GigData {
  id: string;
  title: string;
  description: string;
  category: string;
  compensation: string;
  urgency: "flexible" | "soon" | "urgent";
  contactMethod: string;
  deadline?: string | null;
  tags: string[];
  locationNote?: string | null;
  posterId: string;
}

export function EditGigPageClient() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [gig, setGig] = useState<GigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;

    getGigById(id).then((res) => {
      if (!res.success) {
        setError("Gig not found");
        setLoading(false);
        return;
      }
      setGig(res.data as GigData);
      setLoading(false);
    });
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
        <CreatePageHeader title="Edit Gig" fallbackHref="/gigs" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !gig) {
    return (
      <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
        <CreatePageHeader title="Edit Gig" fallbackHref="/gigs" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-lg font-medium">{error ?? "Gig not found"}</p>
            <button
              onClick={() => router.push("/gigs")}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Back to Gigs
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (session?.user?.id !== gig.posterId) {
    return (
      <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
        <CreatePageHeader title="Edit Gig" fallbackHref="/gigs" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-lg font-medium">Not authorized</p>
            <p className="mt-1 text-sm text-muted-foreground">You can only edit your own gigs.</p>
            <button
              onClick={() => router.push("/gigs")}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Back to Gigs
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (data: CreateGigFormData) => {
    const res = await updateGig(gig.id, data);
    if (res.success) {
      await queryClient.invalidateQueries({ queryKey: ["approved-gigs"] });
      toast.success("Gig updated.");
      router.push("/gigs");
    } else {
      toast.error(res.error);
    }
    return { success: res.success };
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
      <CreatePageHeader title="Edit Gig" fallbackHref="/gigs" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-4">
          <div className="rounded-2xl border bg-card shadow-sm p-6 flex flex-col gap-4">
            <GigFormInner
              gigId={gig.id}
              initialData={{
                title: gig.title,
                description: gig.description,
                category: gig.category,
                compensation: gig.compensation,
                urgency: gig.urgency,
                contactMethod: gig.contactMethod,
                deadline: gig.deadline ?? undefined,
                tags: gig.tags,
                locationNote: gig.locationNote ?? undefined,
              }}
              onSubmit={handleSubmit}
              onClose={() => router.push("/gigs")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
