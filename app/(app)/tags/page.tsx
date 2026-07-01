"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const TAG_COMMANDS = [
  { cmd: "screenOn", label: "Screen On" },
  { cmd: "screenOff", label: "Screen Off" },
  { cmd: "reloadStartUrl", label: "Reload Start URL" },
  { cmd: "restartApp", label: "Restart App" },
] as const;

interface Tag {
  id: string;
  name: string;
  _count: { devices: number };
}

function TagForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = (await res.json()) as { error: unknown };
      setError(typeof d.error === "string" ? d.error : "Save failed");
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tag-name">Tag name</Label>
        <Input
          id="tag-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="lobby"
          required
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Create Tag"}
        </Button>
      </div>
    </form>
  );
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTag, setDeleteTag] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sendingTagId, setSendingTagId] = useState<string | null>(null);
  const [tagCmd, setTagCmd] = useState("");

  const fetchTags = async () => {
    setLoading(true);
    const res = await fetch("/api/tags");
    if (res.ok) setTags((await res.json()) as Tag[]);
    setLoading(false);
  };

  useEffect(() => {
    void fetchTags();
  }, []);

  async function handleDelete() {
    if (!deleteTag) return;
    setDeleting(true);
    const res = await fetch(`/api/tags/${deleteTag.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      toast.success("Tag deleted");
      setDeleteTag(null);
      void fetchTags();
    } else {
      toast.error("Failed to delete tag");
    }
  }

  async function sendTagCommand(tagId: string) {
    if (!tagCmd) return;
    const res = await fetch(`/api/tags/${tagId}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: tagCmd }),
    });
    const data = (await res.json()) as { succeeded?: string[]; failed?: { id: string; error: string }[]; error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "Command failed");
    } else {
      const ok = data.succeeded?.length ?? 0;
      const fail = data.failed?.length ?? 0;
      if (fail === 0) {
        toast.success(`Sent to ${ok} device(s)`);
      } else {
        toast.warning(`Sent to ${ok}, failed on ${fail}`);
      }
    }
    setSendingTagId(null);
    setTagCmd("");
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tags</h1>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                New Tag
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Tag</DialogTitle>
            </DialogHeader>
            <TagForm
              onSuccess={() => {
                setAddOpen(false);
                void fetchTags();
                toast.success("Tag created");
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : tags.length === 0 ? (
        <div className="border-border rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground mb-4">No tags yet.</p>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Create a tag
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tags.map((tag) => (
            <div key={tag.id} className="rounded-lg border p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{tag.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {tag._count.devices} device{tag._count.devices !== 1 ? "s" : ""}
                </Badge>
                <div className="ml-auto flex items-center gap-1">
                  {tag._count.devices > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-xs"
                      onClick={() => {
                        setSendingTagId(sendingTagId === tag.id ? null : tag.id);
                        setTagCmd("");
                      }}
                    >
                      <Zap className="h-3 w-3" />
                      Send command
                    </Button>
                  )}
                  <button
                    onClick={() => setDeleteTag(tag)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    aria-label={`Delete tag ${tag.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {sendingTagId === tag.id && (
                <div className="flex items-center gap-2 border-t pt-2">
                  <select
                    value={tagCmd}
                    onChange={(e) => setTagCmd(e.target.value)}
                    className="border-input bg-background rounded-md border px-2 py-1 text-sm"
                  >
                    <option value="">Choose command…</option>
                    {TAG_COMMANDS.map((c) => (
                      <option key={c.cmd} value={c.cmd}>{c.label}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={!tagCmd}
                    onClick={() => void sendTagCommand(tag.id)}
                  >
                    Send
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setSendingTagId(null); setTagCmd(""); }}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!deleteTag}
        onOpenChange={(open) => !open && setDeleteTag(null)}
        title={`Delete "${deleteTag?.name}"?`}
        description="This tag will be removed from all devices."
        loading={deleting}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
