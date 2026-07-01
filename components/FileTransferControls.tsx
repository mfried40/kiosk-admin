"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FolderDown } from "lucide-react";
import { toast } from "sonner";

interface FileTransferControlsProps {
  deviceId: string;
}

export function FileTransferControls({ deviceId }: FileTransferControlsProps) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [dir, setDir] = useState("");

  async function deploy() {
    setLoading(true);
    try {
      const body: Record<string, string> = { url };
      if (dir.trim()) body["dir"] = dir.trim();

      const res = await fetch(`/api/devices/${deviceId}/loadzip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) toast.error(data.error ?? "Deploy failed");
      else toast.success("ZIP deploy initiated");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  let isValidUrl = false;
  try {
    new URL(url);
    isValidUrl = true;
  } catch {
    isValidUrl = false;
  }

  return (
    <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">ZIP URL</label>
          <Input
            placeholder="https://example.com/assets.zip"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-7 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Target directory (optional)</label>
          <Input
            placeholder="/sdcard/kiosk/"
            value={dir}
            onChange={(e) => setDir(e.target.value)}
            className="h-7 text-sm"
          />
        </div>
        <div>
          <Button
            size="sm"
            variant="outline"
            disabled={!isValidUrl || loading}
            onClick={() => void deploy()}
            className="flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderDown className="h-3.5 w-3.5" />}
            Deploy ZIP
          </Button>
        </div>
    </div>
  );
}
