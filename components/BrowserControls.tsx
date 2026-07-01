"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProviderCapabilities } from "@/lib/provider.types";
import { Loader2, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface BrowserControlsProps {
  deviceId: string;
  capabilities: ProviderCapabilities;
}

export function BrowserControls({ deviceId, capabilities }: BrowserControlsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [tabIndex, setTabIndex] = useState(0);

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

  async function sendTabAction(action: "focus" | "close" | "refresh") {
    setLoading(`tab:${action}`);
    try {
      const body =
        action === "refresh" ? { action } : { action, tab: tabIndex };
      const res = await fetch(`/api/devices/${deviceId}/tabs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) toast.error(data.error ?? "Tab action failed");
      else toast.success(`Tab ${action} sent`);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(null);
    }
  }

  function btn(cmd: string, label: string, icon: React.ReactNode) {
    const busy = loading === cmd;
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={loading !== null}
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
        {capabilities.hasUrlControl && (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Cache &amp; Storage
            </p>
            <div className="flex flex-wrap gap-2">
              {btn("clearCache", "Clear Cache", <Trash2 className="h-3.5 w-3.5" />)}
              {btn("clearCookies", "Clear Cookies", <Trash2 className="h-3.5 w-3.5" />)}
              {btn("clearWebstorage", "Clear Web Storage", <Trash2 className="h-3.5 w-3.5" />)}
              {btn("resetWebview", "Reset Webview", <RefreshCw className="h-3.5 w-3.5" />)}
            </div>
          </div>
        )}

        {capabilities.hasTabManagement && (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Tab Management
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground shrink-0">Tab index:</span>
              <Input
                type="number"
                min={0}
                value={tabIndex}
                onChange={(e) => setTabIndex(Math.max(0, Number(e.target.value)))}
                className="h-7 w-20 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={loading !== null}
                onClick={() => void sendTabAction("focus")}
                className="flex items-center gap-1.5"
              >
                {loading === "tab:focus" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Focus
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={loading !== null}
                onClick={() => void sendTabAction("close")}
                className="flex items-center gap-1.5"
              >
                {loading === "tab:close" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Close
              </Button>
            </div>
            <div>
              <Button
                size="sm"
                variant="outline"
                disabled={loading !== null}
                onClick={() => void sendTabAction("refresh")}
                className="flex items-center gap-1.5"
              >
                {loading === "tab:refresh" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Refresh Tab
              </Button>
            </div>
          </div>
        )}
    </div>
  );
}
