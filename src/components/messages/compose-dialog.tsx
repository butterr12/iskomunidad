"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { searchUsers, type UserSearchResult } from "@/actions/follows";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComposeDialog({ open, onOpenChange }: ComposeDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Reset state when dialog closes (via event handler, not effect)
  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      setQuery("");
      setDebouncedQuery("");
    }
    onOpenChange(newOpen);
  }

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Search on debounced value
  const { data: results = [], isLoading: loading } = useQuery<UserSearchResult[]>({
    queryKey: ["user-search", debouncedQuery],
    queryFn: async () => {
      const res = await searchUsers(debouncedQuery);
      return res.success ? res.data : [];
    },
    enabled: !!debouncedQuery.trim(),
  });

  // Clear stale results when query is empty
  const displayResults = debouncedQuery.trim() ? results : [];

  function handleSelect(userId: string) {
    router.push(`/messages?with=${userId}`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or username..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-64 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && debouncedQuery.trim() && displayResults.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">No users found</p>
            </div>
          )}

          {!loading && displayResults.length > 0 && (
            <div className="divide-y">
              {displayResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSelect(u.id)}
                  className="flex w-full items-center gap-3 px-2 py-2.5 text-left transition-colors hover:bg-muted/50 rounded-md"
                >
                  <Avatar size="default">
                    <AvatarImage src={u.image ?? undefined} alt={u.name} />
                    <AvatarFallback>{getInitials(u.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    {u.username && (
                      <p className="text-xs text-muted-foreground truncate">
                        @{u.username}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && !debouncedQuery.trim() && (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">
                Search for a user to start a conversation
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
