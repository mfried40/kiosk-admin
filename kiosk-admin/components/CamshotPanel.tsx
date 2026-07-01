"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Camera } from "lucide-react";

interface CamshotPanelProps {
  deviceId: string;
}

export function CamshotPanel({ deviceId }: CamshotPanelProps) {
  const [loading, setLoading] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function capture() {
    setLoading(true);
    setError(null);

    // Revoke previous object URL to avoid memory leak
    if (imgSrc) URL.revokeObjectURL(imgSrc);
    setImgSrc(null);

    try {
      const res = await fetch(`/api/devices/${deviceId}/camshot`);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        if (res.status === 422) {
          setError(
            data.error ??
              "Camshot unavailable — enable motion detection in Fully Kiosk Remote Admin settings",
          );
        } else {
          setError(data.error ?? `Error ${res.status}`);
        }
        return;
      }
      const blob = await res.blob();
      setImgSrc(URL.createObjectURL(blob));
      setTimestamp(new Date());
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => void capture()}
          className="flex items-center gap-1.5"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
          Capture
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {imgSrc && (
        <div className="flex flex-col gap-1">
          <img
            src={imgSrc}
            alt="Device camera snapshot"
            className="w-full max-w-sm rounded border"
          />
          {timestamp && (
            <p className="text-muted-foreground text-xs">
              Captured {timestamp.toLocaleTimeString()}
            </p>
          )}
        </div>
      )}

      {!imgSrc && !error && !loading && (
        <p className="text-muted-foreground text-sm">Press Capture to take a camera snapshot.</p>
      )}
    </div>
  );
}
