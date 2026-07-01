"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, ImageOff } from "lucide-react";

type ScreenshotStatus = "loading" | "loaded" | "unsupported" | "offline" | "unavailable";

interface ScreenshotPanelProps {
  deviceId: string;
}

export function ScreenshotPanel({ deviceId }: ScreenshotPanelProps) {
  const [buster, setBuster] = useState(() => Date.now());
  const [status, setStatus] = useState<ScreenshotStatus>("loading");

  const refresh = useCallback(() => {
    setStatus("loading");
    setBuster(Date.now());
  }, []);

  const src = `/api/devices/${deviceId}/screenshot?t=${buster}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Screenshot</span>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={status === "loading"}>
          <RefreshCw className={`h-4 w-4 ${status === "loading" ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
        {status === "loading" && <Skeleton className="absolute inset-0 h-full w-full rounded-lg" />}

        {(status === "unsupported" || status === "offline" || status === "unavailable") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-8 w-8" />
            <p className="text-sm text-center px-4">
              {status === "unsupported"
                ? "Screenshots not supported by this provider"
                : status === "unavailable"
                  ? 'Screenshot unavailable — enable it in the device\'s Remote Admin settings'
                  : "Device offline"}
            </p>
          </div>
        )}

        {/* Always render the img; hide when not loaded */}
        <img
          src={src}
          alt="Device screenshot"
          className={`h-full w-full object-contain ${status === "loaded" ? "block" : "hidden"}`}
          onLoad={() => setStatus("loaded")}
          onError={async () => {
            // Distinguish error types via a HEAD fetch to the same URL
            try {
              const res = await fetch(src, { method: "HEAD" });
              if (res.status === 501) setStatus("unsupported");
              else if (res.status === 422) setStatus("unavailable");
              else setStatus("offline");
            } catch {
              setStatus("offline");
            }
          }}
        />
      </div>
    </div>
  );
}
