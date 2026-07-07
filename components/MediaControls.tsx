"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Loader2, Play, Square } from "lucide-react";
import { toast } from "sonner";

const AUDIO_STREAMS = [
  { value: "0", label: "Voice Call" },
  { value: "1", label: "System" },
  { value: "2", label: "Ring" },
  { value: "3", label: "Music" },
  { value: "4", label: "Alarm" },
  { value: "5", label: "Notification" },
];

interface MediaControlsProps {
  deviceId: string;
}

export function MediaControls({ deviceId }: MediaControlsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [soundUrl, setSoundUrl] = useState("");
  const [soundLoop, setSoundLoop] = useState(false);
  const [soundStream, setSoundStream] = useState("3");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoLoop, setVideoLoop] = useState(false);
  const [videoControls, setVideoControls] = useState(false);
  const [videoExitTouch, setVideoExitTouch] = useState(false);
  const [videoExitDone, setVideoExitDone] = useState(true);

  async function post(action: string, body: Record<string, unknown>) {
    setLoading(action);
    try {
      const res = await fetch(`/api/devices/${deviceId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) toast.error(data.error ?? "Media action failed");
      else toast.success(`${action} sent`);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
        {/* Audio */}
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Audio</p>
          <Input
            placeholder="https://example.com/audio.mp3"
            value={soundUrl}
            onChange={(e) => setSoundUrl(e.target.value)}
            className="h-7 text-sm"
          />
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={soundLoop}
                onChange={(e) => setSoundLoop(e.target.checked)}
                className="rounded"
              />
              Loop
            </label>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs">Stream</Label>
              <select
                value={soundStream}
                onChange={(e) => setSoundStream(e.target.value)}
                className="h-7 rounded-md border bg-background px-2 text-sm"
              >
                {AUDIO_STREAMS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!soundUrl || loading !== null}
              onClick={() => void post("playSound", { url: soundUrl, loop: soundLoop, stream: Number(soundStream) })}
              className="flex items-center gap-1.5"
            >
              {loading === "playSound" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Play Sound
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={loading !== null}
              onClick={() => void post("stopSound", {})}
              className="flex items-center gap-1.5"
            >
              {loading === "stopSound" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
              Stop
            </Button>
          </div>
        </div>

        {/* Video */}
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Video</p>
          <Input
            placeholder="https://example.com/video.mp4"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="h-7 text-sm"
          />
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {(
              [
                ["videoLoop", "Loop", videoLoop, setVideoLoop],
                ["videoControls", "Show Controls", videoControls, setVideoControls],
                ["videoExitTouch", "Exit on Touch", videoExitTouch, setVideoExitTouch],
                ["videoExitDone", "Exit on Finish", videoExitDone, setVideoExitDone],
              ] as [string, string, boolean, (v: boolean) => void][]
            ).map(([key, label, val, setter]) => (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={val}
                  onChange={(e) => setter(e.target.checked)}
                  className="rounded"
                />
                {label}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!videoUrl || loading !== null}
              onClick={() => void post("playVideo", { url: videoUrl, loop: videoLoop, showControls: videoControls, exitOnTouch: videoExitTouch, exitOnCompletion: videoExitDone })}
              className="flex items-center gap-1.5"
            >
              {loading === "playVideo" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Play Video
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={loading !== null}
              onClick={() => void post("stopVideo", {})}
              className="flex items-center gap-1.5"
            >
              {loading === "stopVideo" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
              Stop
            </Button>
          </div>
        </div>
    </div>
  );
}
