"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Trash2, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RejectDialog } from "@/components/admin/reject-dialog";
import {
  adminGetAllLandmarks,
  adminApproveLandmark,
  adminRejectLandmark,
  adminDeleteLandmark,
} from "@/actions/admin";

type ModerationStatus = "draft" | "approved" | "rejected";

interface AdminLandmarkRow {
  id: string;
  name: string;
  category: string;
  address: string | null;
  lat: number;
  lng: number;
  status?: ModerationStatus;
}

const STATUS_BADGE: Record<
  ModerationStatus,
  { variant: "default" | "secondary" | "destructive"; label: string }
> = {
  draft: { variant: "secondary", label: "Draft" },
  approved: { variant: "default", label: "Approved" },
  rejected: { variant: "destructive", label: "Rejected" },
};

const LANDMARKS_QUERY_KEY = ["admin-landmarks"] as const;

export default function AllLocationsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("all");
  const [rejectTarget, setRejectTarget] = useState<AdminLandmarkRow | null>(
    null,
  );

  const { data: landmarks = [], isLoading } = useQuery({
    queryKey: LANDMARKS_QUERY_KEY,
    queryFn: async () => {
      const res = await adminGetAllLandmarks();
      return res.success ? (res.data as AdminLandmarkRow[]) : [];
    },
  });

  const counts = useMemo(() => {
    const c = { all: landmarks.length, draft: 0, approved: 0, rejected: 0 };
    for (const landmark of landmarks) {
      const status = landmark.status ?? "approved";
      c[status]++;
    }
    return c;
  }, [landmarks]);

  const filtered = useMemo(() => {
    if (tab === "all") return landmarks;
    return landmarks.filter((landmark) => (landmark.status ?? "approved") === tab);
  }, [landmarks, tab]);

  const refreshLandmarks = async () => {
    await queryClient.invalidateQueries({ queryKey: LANDMARKS_QUERY_KEY });
  };

  const handleApprove = async (id: string) => {
    await adminApproveLandmark(id);
    await refreshLandmarks();
  };

  const handleReject = async (id: string, reason: string) => {
    await adminRejectLandmark(id, reason);
    await refreshLandmarks();
  };

  const handleDelete = async (id: string) => {
    await adminDeleteLandmark(id);
    await refreshLandmarks();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="draft">Draft ({counts.draft})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Lat/Lng</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No locations found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((landmark) => {
                const status = landmark.status ?? "approved";
                const badge = STATUS_BADGE[status];
                return (
                  <TableRow key={landmark.id}>
                    <TableCell className="max-w-[200px] truncate font-medium">
                      {landmark.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{landmark.category}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {landmark.address ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {Number(landmark.lat).toFixed(4)},{" "}
                      {Number(landmark.lng).toFixed(4)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {status !== "approved" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600"
                            onClick={() => handleApprove(landmark.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        {status !== "rejected" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-600"
                            onClick={() => setRejectTarget(landmark)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => handleDelete(landmark.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {rejectTarget && (
        <RejectDialog
          open={!!rejectTarget}
          postTitle={rejectTarget.name}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason) => {
            void handleReject(rejectTarget.id, reason);
            setRejectTarget(null);
          }}
        />
      )}
    </div>
  );
}
