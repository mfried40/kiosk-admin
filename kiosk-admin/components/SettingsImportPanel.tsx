"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface SettingsImportPanelProps {
  deviceId: string;
  /** Called after a successful import with the merged values */
  onImport: (values: Record<string, string>) => void;
}

export function SettingsImportPanel({ deviceId, onImport }: SettingsImportPanelProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleImport() {
    const trimmed = url.trim();
    if (!trimmed) return;

    // Basic URL validation
    try {
      new URL(trimmed);
    } catch {
      toast.error("Invalid URL");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/devices/${deviceId}/device-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configUrl: trimmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { settings: Record<string, string> };
      onImport(data.settings);
      toast.success("Settings imported successfully");
      setUrl("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-muted-foreground" />
          Import settings from URL
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 flex flex-col gap-3 border-t">
          <p className="text-xs text-muted-foreground">
            Provide a URL to a Fully Kiosk settings export file. The settings will be applied to the device and merged with the current values shown on this page.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-url">Config URL</Label>
            <div className="flex gap-2">
              <Input
                id="import-url"
                type="url"
                placeholder="https://example.com/kiosk-settings.json"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleImport();
                }}
              />
              <Button
                onClick={() => void handleImport()}
                disabled={!url.trim() || loading}
              >
                {loading ? "Importing…" : "Import"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
