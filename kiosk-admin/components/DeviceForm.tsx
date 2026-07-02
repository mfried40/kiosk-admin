"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DeviceWithRelations } from "@/lib/types";
import type { Group, Tag } from "@/lib/generated/prisma/client";

export interface DeviceFormInitialValues {
  name?: string;
  ipAddress?: string;
  port?: number;
  provider?: "FULLY_KIOSK" | "FREE_KIOSK";
  mqttDeviceId?: string;
}

interface DeviceFormProps {
  device?: DeviceWithRelations;
  initialValues?: DeviceFormInitialValues;
  groups: Pick<Group, "id" | "name">[];
  tags: Pick<Tag, "id" | "name">[];
  onSuccess?: () => void;
}

export function DeviceForm({ device, initialValues, groups, tags, onSuccess }: DeviceFormProps) {
  const router = useRouter();
  const isEditing = Boolean(device);

  const [name, setName] = useState(device?.name ?? initialValues?.name ?? "");
  const [ipAddress, setIpAddress] = useState(device?.ipAddress ?? initialValues?.ipAddress ?? "");
  const [port, setPort] = useState(String(device?.port ?? initialValues?.port ?? 2323));
  const [password, setPassword] = useState("");
  const [provider, setProvider] = useState<"FULLY_KIOSK" | "FREE_KIOSK">(device?.provider ?? initialValues?.provider ?? "FULLY_KIOSK");
  const [groupId, setGroupId] = useState(device?.groupId ?? "");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    device?.tags.map((t) => t.tag.id) ?? [],
  );
  const [mqttDeviceId, setMqttDeviceId] = useState(device?.mqttDeviceId ?? initialValues?.mqttDeviceId ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState("");

  async function handleProbe() {
    setProbing(true);
    setProbeError("");
    try {
      const res = await fetch("/api/devices/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipAddress,
          port: parseInt(port, 10),
          password: password || undefined,
          provider,
          ...(isEditing && device?.id ? { existingDeviceId: device.id } : {}),
        }),
      });
      const data = (await res.json()) as { deviceId?: string; deviceName?: string; error?: string; availableFields?: string[] };
      if (!res.ok || !data.deviceId) {
        const detail = data.availableFields?.length
          ? `Available fields: ${data.availableFields.join(", ")}`
          : (data.error ?? "No device ID returned");
        setProbeError(detail);
        return;
      }
      setMqttDeviceId(data.deviceId);
      if (!name && data.deviceName) setName(data.deviceName);
    } catch {
      setProbeError("Could not reach device");
    } finally {
      setProbing(false);
    }
  }

  const [localGroups, setLocalGroups] = useState(groups);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [localTags, setLocalTags] = useState(tags);
  const [addingTag, setAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

  async function handleCreateGroup() {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    setCreatingGroup(true);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      const group = (await res.json()) as Pick<Group, "id" | "name">;
      setLocalGroups((prev) => [...prev, group]);
      setGroupId(group.id);
      setNewGroupName("");
      setAddingGroup(false);
    }
    setCreatingGroup(false);
  }

  async function handleCreateTag() {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    setCreatingTag(true);
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      const tag = (await res.json()) as Pick<Tag, "id" | "name">;
      setLocalTags((prev) => [...prev, tag]);
      setSelectedTagIds((prev) => [...prev, tag.id]);
      setNewTagName("");
      setAddingTag(false);
    }
    setCreatingTag(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const body: Record<string, unknown> = {
      name,
      ipAddress,
      port: parseInt(port, 10),
      provider,
      ...(mqttDeviceId ? { mqttDeviceId } : {}),
      ...(groupId ? { groupId } : {}),
    };

    if (!isEditing) {
      if (!password && provider !== "FREE_KIOSK") {
        setError("Password is required");
        setSaving(false);
        return;
      }
      if (password) body["password"] = password;
      body["tagIds"] = selectedTagIds;
    } else {
      if (password) {
        body["password"] = password;
      }
    }

    const url = isEditing ? `/api/devices/${device!.id}` : "/api/devices";
    const method = isEditing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const text = await res.text();
      let data: { error?: unknown } = {};
      try { data = JSON.parse(text) as { error?: unknown }; } catch { data = { error: text || "Save failed" }; }
      if (typeof data.error === "string") {
        setError(data.error);
      } else if (data.error && typeof data.error === "object") {
        const fe = (data.error as { fieldErrors?: Record<string, string[]> }).fieldErrors;
        if (fe) {
          const first = Object.values(fe).flat()[0];
          setError(first ?? "Validation failed");
        } else {
          setError("Save failed");
        }
      } else {
        setError("Save failed");
      }
      return;
    }

    // Sync tags after creation/update
    if (isEditing) {
      await fetch(`/api/devices/${device!.id}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: selectedTagIds }),
      });
    }

    router.refresh();
    onSuccess?.();
  }

  function toggleTag(id: string) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Reception Tablet"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="provider">Provider</Label>
          <Select value={provider} onValueChange={(v) => { if (v) setProvider(v as "FULLY_KIOSK" | "FREE_KIOSK"); }}>
            <SelectTrigger id="provider">
              <SelectValue>
                {{ FULLY_KIOSK: "Fully Kiosk", FREE_KIOSK: "FreeKiosk" }[provider]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FULLY_KIOSK">Fully Kiosk</SelectItem>
              <SelectItem value="FREE_KIOSK">FreeKiosk</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ipAddress">IP Address</Label>
          <Input
            id="ipAddress"
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            placeholder="192.168.1.100"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="port">Port</Label>
          <Input
            id="port"
            type="number"
            min={1}
            max={65535}
            value={port}
            onChange={(e) => setPort(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="password">
            {isEditing
              ? provider === "FREE_KIOSK"
                ? "API Key (leave blank to keep or clear)"
                : "New Password (leave blank to keep)"
              : provider === "FREE_KIOSK"
                ? "API Key (optional)"
                : "Password"}
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEditing ? "••••••••" : provider === "FREE_KIOSK" ? "Leave blank if no API key" : "Remote admin password"}
            required={!isEditing && provider !== "FREE_KIOSK"}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="mqttDeviceId">MQTT Device ID</Label>
          <div className="flex gap-2">
            <Input
              id="mqttDeviceId"
              value={mqttDeviceId}
              onChange={(e) => setMqttDeviceId(e.target.value)}
              placeholder="Auto-filled on save, or fetch now"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={probing || !ipAddress || !port}
              onClick={() => void handleProbe()}
            >
              {probing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
            </Button>
          </div>
          {probeError && <p className="text-destructive text-xs">{probeError}</p>}
          <p className="text-muted-foreground text-xs">Required for MQTT command routing. Click Fetch to retrieve it from the device automatically.</p>
        </div>

        <div className="flex flex-col gap-1.5">
            <Label htmlFor="group">Group</Label>
            <Select value={groupId} onValueChange={(v) => setGroupId(v ?? "")}>
              <SelectTrigger id="group">
                <SelectValue placeholder="No group">
                  {groupId ? (localGroups.find((g) => g.id === groupId)?.name ?? groupId) : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No group</SelectItem>
                {localGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {addingGroup ? (
              <div className="flex gap-1.5">
                <Input
                  autoFocus
                  placeholder="Group name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); void handleCreateGroup(); }
                    if (e.key === "Escape") { setAddingGroup(false); setNewGroupName(""); }
                  }}
                />
                <Button type="button" size="sm" disabled={creatingGroup || !newGroupName.trim()} onClick={() => void handleCreateGroup()}>
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingGroup(true)}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
              >
                <Plus className="h-3 w-3" /> New group
              </button>
            )}
          </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-2">
          {localTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedTagIds.includes(tag.id)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tag.name}
            </button>
          ))}
          {addingTag ? (
            <div className="flex gap-1.5">
              <Input
                autoFocus
                placeholder="Tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="h-7 rounded-full px-3 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); void handleCreateTag(); }
                  if (e.key === "Escape") { setAddingTag(false); setNewTagName(""); }
                }}
              />
              <Button type="button" size="sm" className="h-7 rounded-full px-2" disabled={creatingTag || !newTagName.trim()} onClick={() => void handleCreateTag()}>
                <Check className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingTag(true)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-colors"
            >
              <Plus className="h-3 w-3" /> New tag
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : isEditing ? "Save Changes" : "Add Device"}
        </Button>
      </div>
    </form>
  );
}
