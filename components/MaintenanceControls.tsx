"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Loader2, Lock, Unlock, MessageSquare, X } from "lucide-react";
import { toast } from "sonner";

interface MaintenanceControlsProps {
  deviceId: string;
}

export function MaintenanceControls({ deviceId }: MaintenanceControlsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [overlayText, setOverlayText] = useState("");
  const [enableOpen, setEnableOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  async function setMode(action: "enable" | "disable") {
    setLoading(action);
    try {
      const res = await fetch(`/api/devices/${deviceId}/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) toast.error(data.error ?? "Maintenance mode failed");
      else toast.success(`Maintenance mode ${action}d`);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(null);
    }
  }

  async function sendOverlay(text: string) {
    setLoading("overlay");
    try {
      const res = await fetch(`/api/devices/${deviceId}/overlay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) toast.error(data.error ?? "Overlay failed");
      else toast.success(text ? "Overlay shown" : "Overlay cleared");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Locked Mode
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={loading !== null}
              onClick={() => setEnableOpen(true)}
              className="flex items-center gap-1.5"
            >
              {loading === "enable" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
              Enable Maintenance Mode
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={loading !== null}
              onClick={() => setDisableOpen(true)}
              className="flex items-center gap-1.5"
            >
              {loading === "disable" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
              Disable Maintenance Mode
            </Button>
          </div>
          <ConfirmDialog
            open={enableOpen}
            onOpenChange={setEnableOpen}
            title="Enable maintenance mode?"
            description="Users will be locked out of device interaction until you disable it."
            confirmLabel="Enable"
            onConfirm={() => { setEnableOpen(false); void setMode("enable"); }}
          />
          <ConfirmDialog
            open={disableOpen}
            onOpenChange={setDisableOpen}
            title="Disable maintenance mode?"
            description="Normal device operation will resume."
            confirmLabel="Disable"
            onConfirm={() => { setDisableOpen(false); void setMode("disable"); }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Overlay Message
          </p>
          <Input
            placeholder="Message to display on screen…"
            value={overlayText}
            maxLength={500}
            onChange={(e) => setOverlayText(e.target.value)}
            className="h-7 text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!overlayText || loading !== null}
              onClick={() => void sendOverlay(overlayText)}
              className="flex items-center gap-1.5"
            >
              {loading === "overlay" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
              Show Overlay
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={loading !== null}
              onClick={() => { setOverlayText(""); void sendOverlay(""); }}
              className="flex items-center gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              Clear Overlay
            </Button>
          </div>
        </div>
    </div>
  );
}
