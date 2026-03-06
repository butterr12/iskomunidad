"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminGetPrompts,
  adminCreatePrompt,
  adminUpdatePrompt,
  adminDeletePrompt,
} from "@/actions/match";
import { CATEGORY_LABELS, type PromptCategory } from "@/lib/match-constants";

interface Prompt {
  id: string;
  category: string;
  promptText: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export default function MatchPromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [category, setCategory] = useState<PromptCategory>("vulnerability");
  const [promptText, setPromptText] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  async function loadPrompts() {
    const res = await adminGetPrompts();
    if (res.success) setPrompts(res.data);
    setLoading(false);
  }

  useEffect(() => {
    void loadPrompts();
  }, []);

  function openCreate() {
    setEditingPrompt(null);
    setCategory("vulnerability");
    setPromptText("");
    setSortOrder(0);
    setDialogOpen(true);
  }

  function openEdit(prompt: Prompt) {
    setEditingPrompt(prompt);
    setCategory(prompt.category as PromptCategory);
    setPromptText(prompt.promptText);
    setSortOrder(prompt.sortOrder);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!promptText.trim()) return;
    setSaving(true);

    if (editingPrompt) {
      const res = await adminUpdatePrompt(editingPrompt.id, {
        category,
        promptText: promptText.trim(),
        sortOrder,
      });
      if (res.success) {
        toast.success("Prompt updated");
      } else {
        toast.error(res.error);
      }
    } else {
      const res = await adminCreatePrompt({
        category,
        promptText: promptText.trim(),
        sortOrder,
      });
      if (res.success) {
        toast.success("Prompt created");
      } else {
        toast.error(res.error);
      }
    }

    setSaving(false);
    setDialogOpen(false);
    void loadPrompts();
  }

  async function handleToggleActive(prompt: Prompt) {
    const res = await adminUpdatePrompt(prompt.id, {
      isActive: !prompt.isActive,
    });
    if (res.success) {
      setPrompts((prev) =>
        prev.map((p) =>
          p.id === prompt.id ? { ...p, isActive: !p.isActive } : p,
        ),
      );
    } else {
      toast.error(res.error);
    }
  }

  async function handleDelete(id: string) {
    const res = await adminDeletePrompt(id);
    if (res.success) {
      toast.success("Prompt deleted");
      setPrompts((prev) => prev.filter((p) => p.id !== id));
    } else {
      toast.error(res.error);
    }
    setDeleteConfirm(null);
  }

  // Group by category
  const grouped = prompts.reduce<Record<string, Prompt[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Match Prompt Pool</h2>
          <p className="text-sm text-muted-foreground">
            Manage the prompts users can choose for their match profiles.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Prompt
        </Button>
      </div>

      {Object.entries(grouped).map(([cat, catPrompts]) => (
        <Card key={cat}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              {CATEGORY_LABELS[cat as PromptCategory] ?? cat}
            </CardTitle>
            <CardDescription>
              {catPrompts.length} prompt{catPrompts.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {catPrompts
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((prompt) => (
                <div
                  key={prompt.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Switch
                      checked={prompt.isActive}
                      onCheckedChange={() => handleToggleActive(prompt)}
                    />
                    <span className={`text-sm truncate ${!prompt.isActive ? "text-muted-foreground line-through" : ""}`}>
                      {prompt.promptText}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Badge variant="outline" className="text-[10px]">
                      #{prompt.sortOrder}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(prompt)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteConfirm(prompt.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      ))}

      {prompts.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            No prompts yet. Add some to get started.
          </p>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPrompt ? "Edit Prompt" : "New Prompt"}
            </DialogTitle>
            <DialogDescription>
              {editingPrompt
                ? "Update this prompt in the pool."
                : "Add a new prompt to the pool."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as PromptCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prompt Text</Label>
              <Input
                placeholder='e.g. "My biggest red flag:"'
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!promptText.trim() || saving}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingPrompt ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete prompt?</DialogTitle>
            <DialogDescription>
              This will permanently remove this prompt. Users who selected it will keep their answers but the prompt won&apos;t be available for new profiles.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
