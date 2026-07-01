"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Group {
  id: string;
  name: string;
  description: string | null;
  _count: { devices: number };
}

function GroupForm({
  group,
  onSuccess,
}: {
  group?: Group;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const url = group ? `/api/groups/${group.id}` : "/api/groups";
    const method = group ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || undefined }),
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
        <Label htmlFor="group-name">Name</Label>
        <Input
          id="group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Floor 1"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="group-desc">Description</Label>
        <Input
          id="group-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : group ? "Save Changes" : "Create Group"}
        </Button>
      </div>
    </form>
  );
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchGroups = async () => {
    setLoading(true);
    const res = await fetch("/api/groups");
    if (res.ok) setGroups((await res.json()) as Group[]);
    setLoading(false);
  };

  useEffect(() => {
    void fetchGroups();
  }, []);

  async function handleDelete() {
    if (!deleteGroup) return;
    setDeleting(true);
    const res = await fetch(`/api/groups/${deleteGroup.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      toast.success("Group deleted");
      setDeleteGroup(null);
      void fetchGroups();
    } else {
      toast.error("Failed to delete group");
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Groups</h1>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                New Group
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Group</DialogTitle>
            </DialogHeader>
            <GroupForm
              onSuccess={() => {
                setAddOpen(false);
                void fetchGroups();
                toast.success("Group created");
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="border-border rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground mb-4">No groups yet.</p>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Create a group
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <Card key={g.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{g.name}</span>
                  <div className="flex gap-1">
                    <Dialog
                      open={editGroup?.id === g.id}
                      onOpenChange={(open) => !open && setEditGroup(null)}
                    >
                      <DialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditGroup(g)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        }
                      />
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Group</DialogTitle>
                        </DialogHeader>
                        <GroupForm
                          group={g}
                          onSuccess={() => {
                            setEditGroup(null);
                            void fetchGroups();
                            toast.success("Group updated");
                          }}
                        />
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteGroup(g)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                {g.description && (
                  <p className="text-muted-foreground text-sm flex-1">{g.description}</p>
                )}
                <Badge variant="secondary">{g._count.devices} device(s)</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!deleteGroup}
        onOpenChange={(open) => !open && setDeleteGroup(null)}
        title={`Delete "${deleteGroup?.name}"?`}
        description="Devices in this group will be ungrouped."
        loading={deleting}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
