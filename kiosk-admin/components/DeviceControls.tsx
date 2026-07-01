"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProviderCapabilities } from "@/lib/provider.types";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Monitor,
  MonitorOff,
  Globe,
  RotateCcw,
  RefreshCw,
  Lock,
  Unlock,
  PlayCircle,
  StopCircle,
  Volume2,
  MessageSquare,
  Moon,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface DeviceControlsProps {
  deviceId: string;
  capabilities: ProviderCapabilities;
}

export function DeviceControls({ deviceId, capabilities }: DeviceControlsProps) {
  const [loadingCmd, setLoadingCmd] = useState<string | null>(null);
  const [loadUrl, setLoadUrl] = useState("");
  const [ttsText, setTtsText] = useState("");
  const [volume, setVolume] = useState(50);
  const [forceSleepOpen, setForceSleepOpen] = useState(false);

  async function sendCommand(
    cmd: string,
    params?: Record<string, string>,
    label?: string,
  ) {
    setLoadingCmd(cmd);
    try {
      const res = await fetch(`/api/devices/${deviceId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd, params }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast.error(d.error ?? "Command failed");
      } else {
        toast.success(`${label ?? cmd} sent`);
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoadingCmd(null);
    }
  }

  function cmdButton(
    cmd: string,
    label: string,
    icon: React.ReactNode,
    params?: Record<string, string>,
  ) {
    const busy = loadingCmd === cmd;
    return (
      <Button
        key={cmd}
        size="sm"
        variant="outline"
        disabled={busy || loadingCmd !== null}
        onClick={() => void sendCommand(cmd, params, label)}
        className="flex items-center gap-1.5"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
        {label}
      </Button>
    );
  }

  const hasAny =
    capabilities.hasScreenControl ||
    capabilities.hasUrlControl ||
    capabilities.hasAppRestart ||
    capabilities.hasKioskLock ||
    capabilities.hasScreensaver ||
    capabilities.hasTTS ||
    capabilities.hasVolume;

  if (!hasAny) {
    return (
      <p className="text-muted-foreground text-sm">
        This provider has no remote control capabilities.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Screen */}
      {capabilities.hasScreenControl && (
        <section className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Screen
          </h3>
          <div className="flex flex-wrap gap-2">
            {cmdButton("screenOn", "Screen On", <Monitor className="h-3.5 w-3.5" />)}
            {cmdButton("screenOff", "Screen Off", <MonitorOff className="h-3.5 w-3.5" />)}
            <Button
              size="sm"
              variant="outline"
              disabled={loadingCmd !== null}
              onClick={() => setForceSleepOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Moon className="h-3.5 w-3.5" />
              Force Sleep
            </Button>
            <ConfirmDialog
              open={forceSleepOpen}
              onOpenChange={setForceSleepOpen}
              title="Force sleep?"
              description="This will immediately suspend the screen and background processes."
              confirmLabel="Sleep"
              onConfirm={() => { setForceSleepOpen(false); void sendCommand("forceSleep", undefined, "Force Sleep"); }}
            />
          </div>
        </section>
      )}

      {/* Navigation */}
      {capabilities.hasUrlControl && (
        <section className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Navigation
          </h3>
          <div className="flex flex-wrap gap-2">
            {cmdButton("reloadStartUrl", "Reload Start URL", <RotateCcw className="h-3.5 w-3.5" />)}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="https://example.com"
              value={loadUrl}
              onChange={(e) => setLoadUrl(e.target.value)}
              className="h-7 text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!loadUrl || loadingCmd !== null}
              onClick={() =>
                void sendCommand("loadUrl", { url: loadUrl }, "Load URL")
              }
              className="flex items-center gap-1.5 shrink-0"
            >
              {loadingCmd === "loadUrl" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Globe className="h-3.5 w-3.5" />
              )}
              Load URL
            </Button>
          </div>
        </section>
      )}

      {/* App */}
      {(capabilities.hasAppRestart || capabilities.hasKioskLock) && (
        <section className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            App
          </h3>
          <div className="flex flex-wrap gap-2">
            {capabilities.hasAppRestart &&
              cmdButton("restartApp", "Restart App", <RefreshCw className="h-3.5 w-3.5" />)}
            {capabilities.hasKioskLock &&
              cmdButton("lockKiosk", "Lock Kiosk", <Lock className="h-3.5 w-3.5" />)}
            {capabilities.hasKioskLock &&
              cmdButton("unlockKiosk", "Unlock Kiosk", <Unlock className="h-3.5 w-3.5" />)}
          </div>
        </section>
      )}

      {/* Screensaver */}
      {capabilities.hasScreensaver && (
        <section className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Screensaver
          </h3>
          <div className="flex flex-wrap gap-2">
            {cmdButton("startScreensaver", "Start Screensaver", <PlayCircle className="h-3.5 w-3.5" />)}
            {cmdButton("stopScreensaver", "Stop Screensaver", <StopCircle className="h-3.5 w-3.5" />)}
            {cmdButton("startDaydream", "Start Daydream", <PlayCircle className="h-3.5 w-3.5" />)}
            {cmdButton("stopDaydream", "Stop Daydream", <StopCircle className="h-3.5 w-3.5" />)}
          </div>
        </section>
      )}

      {/* Volume */}
      {capabilities.hasVolume && (
        <section className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Volume
          </h3>
          <div className="flex items-center gap-3">
            <Volume2 className="text-muted-foreground h-4 w-4 shrink-0" />
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-muted-foreground w-8 text-right text-sm">{volume}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={loadingCmd !== null}
              onClick={() =>
                void sendCommand(
                  "setVolume",
                  { level: String(volume) },
                  "Set Volume",
                )
              }
            >
              {loadingCmd === "setVolume" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Set"
              )}
            </Button>
          </div>
        </section>
      )}

      {/* TTS */}
      {capabilities.hasTTS && (
        <section className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Text to Speech
          </h3>
          <div className="flex gap-2">
            <Input
              placeholder="Enter text to speak…"
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              className="h-7 text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!ttsText || loadingCmd !== null}
              onClick={() =>
                void sendCommand("textToSpeech", { text: ttsText }, "Text to Speech")
              }
              className="shrink-0 flex items-center gap-1.5"
            >
              {loadingCmd === "textToSpeech" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MessageSquare className="h-3.5 w-3.5" />
              )}
              Speak
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
