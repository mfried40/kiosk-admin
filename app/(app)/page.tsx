"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DeviceCard } from "@/components/DeviceCard";
import { DeviceForm } from "@/components/DeviceForm";
import { DiscoveredDevicesBanner } from "@/components/DiscoveredDevicesBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DeviceWithRelations, DeviceInfo } from "@/lib/types";
import type { Group, Tag } from "@/lib/generated/prisma/client";
import type { UnknownDevice } from "@/lib/mqtt/discovery";
import { Plus, RefreshCw, Zap, X } from "lucide-react";
import { toast } from "sonner";

const BULK_COMMANDS = [
  { cmd: "screenOn", label: "Screen On" },
  { cmd: "screenOff", label: "Screen Off" },
  { cmd: "reloadStartUrl", label: "Reload Start URL" },
  { cmd: "restartApp", label: "Restart App" },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [devices, setDevices] = useState<DeviceWithRelations[]>([]);
  const [groups, setGroups] = useState<Pick<Group, "id" | "name">[]>([]);
  const [tags, setTags] = useState<Pick<Tag, "id" | "name">[]>([]);
  const [deviceInfos, setDeviceInfos] = useState<Record<string, DeviceInfo | null>>({});
  const [loadingInfos, setLoadingInfos] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState(() => searchParams.get("groupId") ?? "");
  const [filterTag, setFilterTag] = useState(() => searchParams.get("tagId") ?? "");
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCmd, setBulkCmd] = useState("");
  const [bulkSending, setBulkSending] = useState(false);
  const [sseActive, setSseActive] = useState(false);
  const [unknownDevices, setUnknownDevices] = useState<UnknownDevice[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filterGroup) params.set("groupId", filterGroup);
    if (filterTag) params.set("tagId", filterTag);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/", { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterGroup, filterTag]);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterGroup) params.set("groupId", filterGroup);
      if (filterTag) params.set("tagId", filterTag);
      const res = await fetch(`/api/devices?${params}`);
      const data = (await res.json()) as DeviceWithRelations[];
      setDevices(data);
    } catch {
      toast.error("Failed to load devices");
    } finally {
      setLoading(false);
    }
  }, [search, filterGroup, filterTag]);

  // Fetch live device status for all devices
  const fetchDeviceInfos = useCallback(async (devs: DeviceWithRelations[]) => {
    // Mark all as loading immediately
    setLoadingInfos(Object.fromEntries(devs.map((d) => [d.id, true])));

    // Fetch all in parallel — one offline device won't block the others
    await Promise.allSettled(
      devs.map(async (device) => {
        try {
          const res = await fetch(`/api/devices/${device.id}/info`);
          const info = (await res.json()) as DeviceInfo;
          setDeviceInfos((prev) => ({ ...prev, [device.id]: info }));
        } catch {
          setDeviceInfos((prev) => ({ ...prev, [device.id]: null }));
        } finally {
          setLoadingInfos((prev) => ({ ...prev, [device.id]: false }));
        }
      }),
    );
  }, []);

  useEffect(() => {
    void fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    if (devices.length > 0) {
      void fetchDeviceInfos(devices);
    }
  }, [devices, fetchDeviceInfos]);

  useEffect(() => {
    const fetchMeta = async () => {
      const [gRes, tRes, uRes, unknownRes] = await Promise.all([
        fetch("/api/groups"),
        fetch("/api/tags"),
        fetch("/api/auth/session"),
        fetch("/api/devices/unknown"),
      ]);
      if (gRes.ok) setGroups((await gRes.json()) as Pick<Group, "id" | "name">[]);
      if (tRes.ok) setTags((await tRes.json()) as Pick<Tag, "id" | "name">[]);
      if (uRes.ok) {
        const session = (await uRes.json()) as { user?: { role?: string } };
        setUserRole(session.user?.role ?? null);
      }
      if (unknownRes.ok) setUnknownDevices((await unknownRes.json()) as UnknownDevice[]);
    };
    void fetchMeta();
  }, []);

  // Open SSE connection; fall back to polling on error
  useEffect(() => {
    const es = new EventSource("/api/events");
    let failCount = 0;

    es.onopen = () => {
      setSseActive(true);
      failCount = 0;
    };

    es.addEventListener("device-update", (e) => {
      const { deviceId, ...fields } = JSON.parse(e.data) as { deviceId: string } & Record<string, unknown>;
      setDeviceInfos((prev) => ({
        ...prev,
        [deviceId]: { ...(prev[deviceId] ?? {}), ...fields } as (typeof prev)[string],
      }));
    });

    es.addEventListener("unknown-device", (e) => {
      const entry = JSON.parse(e.data) as UnknownDevice;
      setUnknownDevices((prev) => [
        ...prev.filter((d) => d.mqttDeviceId !== entry.mqttDeviceId),
        entry,
      ]);
    });

    es.addEventListener("unknown-device-dismissed", (e) => {
      const { mqttDeviceId } = JSON.parse(e.data) as { mqttDeviceId: string };
      setUnknownDevices((prev) => prev.filter((d) => d.mqttDeviceId !== mqttDeviceId));
    });

    es.onerror = () => {
      failCount++;
      if (failCount >= 3) {
        es.close();
        setSseActive(false);
      }
    };

    return () => {
      es.close();
      setSseActive(false);
    };
  }, []);

  // 30-second polling for live info (only when SSE is not active)
  useEffect(() => {
    if (sseActive) return;
    const interval = setInterval(() => {
      if (devices.length > 0) void fetchDeviceInfos(devices);
    }, 30_000);
    return () => clearInterval(interval);
  }, [devices, fetchDeviceInfos, sseActive]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function sendBulkCommand() {
    if (!bulkCmd || selectedIds.size === 0) return;
    setBulkSending(true);
    try {
      const res = await fetch("/api/devices/bulk/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd: bulkCmd, deviceIds: Array.from(selectedIds) }),
      });
      const data = (await res.json()) as {
        succeeded?: string[];
        failed?: { id: string; error: string }[];
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Bulk command failed");
      } else {
        const ok = data.succeeded?.length ?? 0;
        const fail = data.failed?.length ?? 0;
        if (fail === 0) {
          toast.success(`Command sent to ${ok} device(s)`);
        } else {
          toast.warning(`Sent to ${ok}, failed on ${fail} device(s)`);
        }
        setSelectedIds(new Set());
        setBulkCmd("");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setBulkSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Devices</h1>
          <p className="text-muted-foreground text-sm">{devices.length} device(s)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void fetchDevices();
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger
              render={
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Add Device
                </Button>
              }
            />
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Device</DialogTitle>
              </DialogHeader>
              <DeviceForm
                groups={groups}
                tags={tags}
                onSuccess={() => {
                  setAddOpen(false);
                  void fetchDevices();
                  toast.success("Device added");
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search…"
          className="max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {groups.length > 0 && (
          <Select value={filterGroup} onValueChange={(v) => setFilterGroup(v ?? "")}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All groups</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {tags.length > 0 && (
          <Select value={filterTag} onValueChange={(v) => setFilterTag(v ?? "")}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All tags</SelectItem>
              {tags.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {(filterGroup || filterTag) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFilterGroup(""); setFilterTag(""); }}
            className="text-muted-foreground h-8 gap-1"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="bg-primary text-primary-foreground flex flex-wrap items-center gap-3 rounded-lg px-4 py-2">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Select value={bulkCmd} onValueChange={(v) => setBulkCmd(v ?? "")}>
            <SelectTrigger className="h-7 w-44 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground">
              <SelectValue placeholder="Choose command" />
            </SelectTrigger>
            <SelectContent>
              {BULK_COMMANDS.map((c) => (
                <SelectItem key={c.cmd} value={c.cmd}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="secondary"
            disabled={!bulkCmd || bulkSending}
            onClick={() => void sendBulkCommand()}
            className="flex items-center gap-1"
          >
            <Zap className="h-3.5 w-3.5" />
            {bulkSending ? "Sending…" : "Send"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setSelectedIds(new Set()); setBulkCmd(""); }}
            className="ml-auto hover:bg-primary-foreground/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Discovery banner — ADMIN only */}
      {userRole === "ADMIN" && (
        <DiscoveredDevicesBanner
          devices={unknownDevices}
          groups={groups}
          tags={tags}
          onDismiss={(id) =>
            setUnknownDevices((prev) => prev.filter((d) => d.mqttDeviceId !== id))
          }
          onAdded={(id) => {
            setUnknownDevices((prev) => prev.filter((d) => d.mqttDeviceId !== id));
            void fetchDevices();
            toast.success("Device added");
          }}
        />
      )}

      {/* Device grid */}
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : devices.length === 0 ? (
        <div className="border-border rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground mb-4">No devices found.</p>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add your first device
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              info={deviceInfos[device.id]}
              loading={loadingInfos[device.id]}
              selected={selectedIds.has(device.id)}
              onToggleSelect={() => toggleSelect(device.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
