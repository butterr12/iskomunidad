"use client";

import { useState, useMemo } from "react";
import { Check, X, Trash2 } from "lucide-react";
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
import { RejectDialog } from "./reject-dialog";
import {
  FLAIR_COLORS,
  formatRelativeTime,
  type CommunityPost,
  type PostStatus,
} from "@/lib/posts";

interface PostTableProps {
  posts: CommunityPost[];
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onDelete: (id: string) => void;
}

const STATUS_BADGE: Record<PostStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  draft: { variant: "secondary", label: "Draft" },
  approved: { variant: "default", label: "Approved" },
  rejected: { variant: "destructive", label: "Rejected" },
};

export function PostTable({ posts, onApprove, onReject, onDelete }: PostTableProps) {
  const [tab, setTab] = useState("all");
  const [rejectTarget, setRejectTarget] = useState<CommunityPost | null>(null);

  const counts = useMemo(() => {
    const c = { all: posts.length, draft: 0, approved: 0, rejected: 0 };
    for (const p of posts) {
      const s = p.status ?? "approved";
      c[s]++;
    }
    return c;
  }, [posts]);

  const filtered = useMemo(() => {
    if (tab === "all") return posts;
    return posts.filter((p) => (p.status ?? "approved") === tab);
  }, [posts, tab]);

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
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Flair</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No posts found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((post) => {
                const status = post.status ?? "approved";
                const badge = STATUS_BADGE[status];
                return (
                  <TableRow key={post.id}>
                    <TableCell className="max-w-[200px] truncate font-medium">{post.title}</TableCell>
                    <TableCell className="text-muted-foreground">{post.authorHandle}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{ borderColor: FLAIR_COLORS[post.flair], color: FLAIR_COLORS[post.flair] }}
                      >
                        {post.flair}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{post.type}</TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{post.score}</TableCell>
                    <TableCell className="text-muted-foreground">{formatRelativeTime(post.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {status !== "approved" && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => onApprove(post.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        {status !== "rejected" && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => setRejectTarget(post)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => onDelete(post.id)}>
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
          postTitle={rejectTarget.title}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason) => {
            onReject(rejectTarget.id, reason);
            setRejectTarget(null);
          }}
        />
      )}
    </div>
  );
}
