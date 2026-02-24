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
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { toast } from "sonner";
import {
  adminGetAllLandmarks,
  adminApproveLandmark,
  adminRejectLandmark,
  adminDeleteLandmark,
  adminBulkDeleteLandmarks,
  adminBulkApproveLandmarks,
  adminBulkRejectLandmarks,
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showBulkReject, setShowBulkReject] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  const { data: landmarks = [], isLoading } = useQuery({
    queryKey: LANDMARKS_QUERY_KEY,
    queryFn: async () => {
      const res = await adminGetAllLandmarks();
      return res.success ? (res.data as AdminLandmarkRow[]) : [];
    },
  });

  const counts = useMemo(() => {
    const c = { all: landmarks.length, draft: 0, approved: 0, rejected: 0 };
    for (const lm of landmarks) {
      const status = lm.status ?? "approved";
      c[status]++;
    }
    return c;
  }, [landmarks]);

  const filtered = useMemo(() => {
    if (tab === "all") return landmarks;
    return landmarks.filter((lm) => (lm.status ?? "approved") === tab);
  }, [landmarks, tab]);

  const handleTabChange = (newTab: string) => {
    setTab(newTab);
    setSelected(new Set());
  };

  const refreshLandmarks = async () => {
    await queryClient.invalidateQueries({ queryKey: LANDMARKS_QUERY_KEY });
  };

  // ── Individual actions ──────────────────────────────────────────────────────

  const handleApprove = async (id: string) => {
    const result = await adminApproveLandmark(id);
    if (!result.success) toast.error(result.error);
    else toast.success("Location published");
    await refreshLandmarks();
  };

  const handleReject = async (id: string, reason: string) => {
    const result = await adminRejectLandmark(id, reason);
    if (!result.success) toast.error(result.error);
    else toast.success("Location declined");
    await refreshLandmarks();
  };

  const handleDelete = async (id: string) => {
    const result = await adminDeleteLandmark(id);
    if (!result.success) toast.error(result.error);
    else toast.success("Location deleted");
    await refreshLandmarks();
  };

  // ── Checkbox helpers ────────────────────────────────────────────────────────

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((lm) => selected.has(lm.id));
  const someSelected = selected.size > 0;
  const indeterminate =
    someSelected &&
    !allVisibleSelected &&
    filtered.some((lm) => selected.has(lm.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((lm) => lm.id)));
    }
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Bulk actions ────────────────────────────────────────────────────────────

  const selectedIds = Array.from(selected);

  const handleBulkApprove = async () => {
    setBulkLoading(true);
    const result = await adminBulkApproveLandmarks(selectedIds);
    setBulkLoading(false);
    if (!result.success) {
      toast.error(result.error);
    } else {
      const n = result.data.count;
      toast.success(`${n} location${n !== 1 ? "s" : ""} published`);
      setSelected(new Set());
    }
    await refreshLandmarks();
  };

  const handleBulkReject = async (reason: string) => {
    setShowBulkReject(false);
    setBulkLoading(true);
    const result = await adminBulkRejectLandmarks(selectedIds, reason);
    setBulkLoading(false);
    if (!result.success) {
      toast.error(result.error);
    } else {
      const n = result.data.count;
      toast.success(`${n} location${n !== 1 ? "s" : ""} declined`);
      setSelected(new Set());
    }
    await refreshLandmarks();
  };

  const handleBulkDelete = async () => {
    setShowBulkDelete(false);
    setBulkLoading(true);
    const result = await adminBulkDeleteLandmarks(selectedIds);
    setBulkLoading(false);
    if (!result.success) {
      toast.error(result.error);
    } else {
      const n = result.data.count;
      toast.success(`${n} location${n !== 1 ? "s" : ""} deleted`);
      setSelected(new Set());
    }
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
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="draft">Draft ({counts.draft})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Bulk action toolbar — appears when at least one row is selected */}
      {someSelected && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            {tab !== "approved" && (
              <Button
                size="sm"
                variant="outline"
                className="text-green-600"
                disabled={bulkLoading}
                onClick={() => void handleBulkApprove()}
              >
                {bulkLoading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                )}
                Approve
              </Button>
            )}
            {tab !== "rejected" && (
              <Button
                size="sm"
                variant="outline"
                className="text-red-600"
                disabled={bulkLoading}
                onClick={() => setShowBulkReject(true)}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Reject
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-muted-foreground"
              disabled={bulkLoading}
              onClick={() => setShowBulkDelete(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={bulkLoading}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = indeterminate;
                  }}
                  onChange={toggleSelectAll}
                  className="cursor-pointer"
                  aria-label="Select all"
                />
              </TableHead>
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
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  No locations found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((lm) => {
                const status = lm.status ?? "approved";
                const badge = STATUS_BADGE[status];
                const isSelected = selected.has(lm.id);
                return (
                  <TableRow
                    key={lm.id}
                    data-state={isSelected ? "selected" : undefined}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(lm.id)}
                        className="cursor-pointer"
                        aria-label={`Select ${lm.name}`}
                      />
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-medium">
                      {lm.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{lm.category}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {lm.address ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {Number(lm.lat).toFixed(4)},{" "}
                      {Number(lm.lng).toFixed(4)}
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
                            onClick={() => handleApprove(lm.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        {status !== "rejected" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-600"
                            onClick={() => setRejectTarget(lm)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => handleDelete(lm.id)}
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

      {/* Individual reject dialog */}
      {rejectTarget && (
        <RejectDialog
          open={!!rejectTarget}
          itemTitle={rejectTarget.name}
          title="Reject Location"
          confirmLabel="Reject"
          reasonPlaceholder="Enter rejection reason..."
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason) => {
            void handleReject(rejectTarget.id, reason);
            setRejectTarget(null);
          }}
        />
      )}

      {/* Bulk reject dialog — single reason applied to all selected */}
      <RejectDialog
        open={showBulkReject}
        itemTitle={`${selected.size} location${selected.size !== 1 ? "s" : ""}`}
        title="Reject Locations"
        description={`Rejecting ${selected.size} location${selected.size !== 1 ? "s" : ""}. The same reason will be sent to each creator.`}
        confirmLabel="Reject All"
        reasonPlaceholder="Enter rejection reason..."
        onClose={() => setShowBulkReject(false)}
        onConfirm={(reason) => void handleBulkReject(reason)}
      />

      {/* Bulk delete confirmation */}
      <ConfirmDialog
        open={showBulkDelete}
        title="Delete Locations"
        description={`Permanently delete ${selected.size} location${selected.size !== 1 ? "s" : ""}? This cannot be undone.`}
        confirmLabel="Delete All"
        variant="destructive"
        onClose={() => setShowBulkDelete(false)}
        onConfirm={() => void handleBulkDelete()}
      />
    </div>
  );
}
