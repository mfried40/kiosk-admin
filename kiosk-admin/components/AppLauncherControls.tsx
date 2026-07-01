"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Loader2, Play, ArrowUpFromLine, ArrowDownFromLine, LogOut } from "lucide-react";
import { toast } from "sonner";

interface AppLauncherControlsProps {
  deviceId: string;
}

export function AppLauncherControls({ deviceId }: AppLauncherControlsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [pkg, setPkg] = useState("");
  const [intent, setIntent] = useState("");
  const [exitOpen, setExitOpen] = useState(false);

  async function sendCommand(cmd: string, params?: Record<string, string>) {
    setLoading(cmd);
    try {
      const res = await fetch(`/api/devices/${deviceId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd, params }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) toast.error(data.error ?? "Command failed");
      else toast.success(`${cmd} sent`);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(null);
    }
  }

  function btn(cmd: string, label: string, icon: React.ReactNode, disabled?: boolean) {
    const busy = loading === cmd;
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={disabled ?? loading !== null}
        onClick={() => void sendCommand(cmd)}
        className="flex items-center gap-1.5"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
        {label}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Input
            placeholder="com.example.app"
            value={pkg}
            onChange={(e) => setPkg(e.target.value)}
            className="h-7 text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!pkg || loading !== null}
            onClick={() => void sendCommand("startApplication", { package: pkg })}
            className="shrink-0 flex items-center gap-1.5"
          >
            {loading === "startApplication" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Launch App
          </Button>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="intent://… or package://…"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            className="h-7 text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!intent || loading !== null}
            onClick={() => void sendCommand("startIntent", { url: intent })}
            className="shrink-0 flex items-center gap-1.5"
          >
            {loading === "startIntent" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Start Intent
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {btn("toForeground", "Bring to Foreground", <ArrowUpFromLine className="h-3.5 w-3.5" />)}
          {btn("toBackground", "Send to Background", <ArrowDownFromLine className="h-3.5 w-3.5" />)}
          <Button
            size="sm"
            variant="outline"
            disabled={loading !== null}
            onClick={() => setExitOpen(true)}
            className="flex items-center gap-1.5 text-destructive hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" />
            Exit App
          </Button>
          <ConfirmDialog
            open={exitOpen}
            onOpenChange={setExitOpen}
            title="Exit app?"
            description="This will close the Fully Kiosk app on the device."
            confirmLabel="Exit"
            onConfirm={() => {
              setExitOpen(false);
              void sendCommand("exitApp");
            }}
          />
        </div>
    </div>
  );
}
