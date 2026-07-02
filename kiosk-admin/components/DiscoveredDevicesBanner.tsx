"use client";

import { useState } from "react";
import { Wifi, X, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DeviceForm, type DeviceFormInitialValues } from "@/components/DeviceForm";
import type { UnknownDevice } from "@/lib/mqtt/discovery";
import type { Group, Tag } from "@/lib/generated/prisma/client";

interface DiscoveredDevicesBannerProps {
  devices: UnknownDevice[];
  groups: Pick<Group, "id" | "name">[];
  tags: Pick<Tag, "id" | "name">[];
  onDismiss: (mqttDeviceId: string) => void;
  onAdded: (mqttDeviceId: string) => void;
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

export function DiscoveredDevicesBanner({
  devices,
  groups,
  tags,
  onDismiss,
  onAdded,
}: DiscoveredDevicesBannerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [addingDevice, setAddingDevice] = useState<UnknownDevice | null>(null);
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());

  if (devices.length === 0) return null;

  async function handleDismiss(mqttDeviceId: string) {
    setDismissing((prev) => new Set(prev).add(mqttDeviceId));
    try {
      await fetch(`/api/devices/unknown/${encodeURIComponent(mqttDeviceId)}`, {
        method: "DELETE",
      });
      onDismiss(mqttDeviceId);
    } finally {
      setDismissing((prev) => {
        const next = new Set(prev);
        next.delete(mqttDeviceId);
        return next;
      });
    }
  }

  const initialValues = addingDevice
    ? ({
        name: addingDevice.deviceName,
        ipAddress: addingDevice.ipAddress,
        port: 2323,
        provider: "FULLY_KIOSK",
        mqttDeviceId: addingDevice.deviceId,
      } satisfies DeviceFormInitialValues)
    : undefined;

  return (
    <>
      <div className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
        {/* Header */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-primary/10 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wifi className="h-4 w-4 text-primary" />
            <span>
              {devices.length} device{devices.length !== 1 ? "s" : ""} discovered via MQTT — not yet added
            </span>
          </div>
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* List */}
        {!collapsed && (
          <ul className="divide-y divide-border">
            {devices.map((d) => (
              <li
                key={d.mqttDeviceId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {d.deviceName ?? d.mqttDeviceId}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[d.ipAddress, d.model].filter(Boolean).join(" · ")}
                    {" · "}
                    seen {timeAgo(d.seenAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    disabled={dismissing.has(d.mqttDeviceId)}
                    onClick={() => void handleDismiss(d.mqttDeviceId)}
                    title="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => setAddingDevice(d)}
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add Device sheet */}
      <Sheet open={Boolean(addingDevice)} onOpenChange={(open) => { if (!open) setAddingDevice(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Add Device</SheetTitle>
          </SheetHeader>
          {addingDevice && initialValues && (
            <DeviceForm
              initialValues={initialValues}
              groups={groups}
              tags={tags}
              onSuccess={() => {
                onAdded(addingDevice.mqttDeviceId);
                setAddingDevice(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
