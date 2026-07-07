"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Loader2, Download, Trash2, Info, RefreshCw, Play, Square, ArrowUpFromLine, ArrowDownFromLine, LogOut } from "lucide-react";
import { toast } from "sonner";

interface ApkManagerProps {
  deviceId: string;
}

interface InstalledApp {
  packageName: string;
  appLabel: string;
  appVersion?: string;
  icon?: string;
}

export function ApkManager({ deviceId }: ApkManagerProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [apkUrl, setApkUrl] = useState("");
  const [forceInstall, setForceInstall] = useState(false);
  const [uninstallPkg, setUninstallPkg] = useState("");
  const [uninstallOpen, setUninstallOpen] = useState(false);
  const [uninstallTarget, setUninstallTarget] = useState<InstalledApp | null>(null);
  const [status, setStatus] = useState<unknown>(null);

  // App Launcher state
  const [launchPkg, setLaunchPkg] = useState("");
  const [intent, setIntent] = useState("");
  const [exitOpen, setExitOpen] = useState(false);

  // Installed apps list
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appSearch, setAppSearch] = useState("");

  const filteredApps = useMemo(() => {
    if (!apps) return [];
    const q = appSearch.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter(
      (a) =>
        a.appLabel.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q)
    );
  }, [apps, appSearch]);

  async function install() {
    setLoading("install");
    try {
      const res = await fetch(`/api/devices/${deviceId}/apk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: apkUrl, forceInstall }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) toast.error(data.error ?? "Install failed");
      else toast.success("APK install initiated");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(null);
    }
  }

  async function uninstallByPkg(pkg: string) {
    setLoading(`uninstall:${pkg}`);
    try {
      const res = await fetch(`/api/devices/${deviceId}/apk`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package: pkg }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) toast.error(data.error ?? "Uninstall failed");
      else {
        toast.success("App uninstalled");
        setUninstallPkg("");
        // Remove from list if loaded
        setApps((prev) => prev?.filter((a) => a.packageName !== pkg) ?? prev);
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(null);
    }
  }

  async function checkStatus() {
    setLoading("status");
    try {
      const res = await fetch(`/api/devices/${deviceId}/apk`);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Status check failed");
      } else {
        setStatus(await res.json());
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(null);
    }
  }

  async function loadApps() {
    setAppsLoading(true);
    try {
      const res = await fetch(`/api/devices/${deviceId}/apps`);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Failed to load apps");
        return;
      }
      const data = (await res.json()) as InstalledApp[];
      // Sort alphabetically by label
      data.sort((a, b) => a.appLabel.localeCompare(b.appLabel));
      setApps(data);
    } catch {
      toast.error("Network error");
    } finally {
      setAppsLoading(false);
    }
  }

  async function sendLaunchCommand(cmd: string, params?: Record<string, string>) {
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

  async function appCommand(cmd: string, pkg: string, label: string) {
    setLoading(`${cmd}:${pkg}`);
    try {
      const res = await fetch(`/api/devices/${deviceId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd, params: { package: pkg } }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) toast.error(data.error ?? `${label} failed`);
      else toast.success(`${label} sent`);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Launch */}
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Launch</p>
        <div className="flex gap-2">
          <Input
            placeholder="com.example.app"
            value={launchPkg}
            onChange={(e) => setLaunchPkg(e.target.value)}
            className="h-7 text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!launchPkg || loading !== null}
            onClick={() => void sendLaunchCommand("startApplication", { package: launchPkg })}
            className="shrink-0 flex items-center gap-1.5"
          >
            {loading === "startApplication" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Launch
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
            onClick={() => void sendLaunchCommand("startIntent", { url: intent })}
            className="shrink-0 flex items-center gap-1.5"
          >
            {loading === "startIntent" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Start Intent
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={loading !== null} onClick={() => void sendLaunchCommand("toForeground")} className="flex items-center gap-1.5">
            {loading === "toForeground" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpFromLine className="h-3.5 w-3.5" />}
            Foreground
          </Button>
          <Button size="sm" variant="outline" disabled={loading !== null} onClick={() => void sendLaunchCommand("toBackground")} className="flex items-center gap-1.5">
            {loading === "toBackground" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowDownFromLine className="h-3.5 w-3.5" />}
            Background
          </Button>
          <Button size="sm" variant="outline" disabled={loading !== null} onClick={() => setExitOpen(true)} className="flex items-center gap-1.5 text-destructive hover:text-destructive">
            <LogOut className="h-3.5 w-3.5" />
            Exit App
          </Button>
          <ConfirmDialog
            open={exitOpen}
            onOpenChange={setExitOpen}
            title="Exit app?"
            description="This will close the Fully Kiosk app on the device."
            confirmLabel="Exit"
            onConfirm={() => { setExitOpen(false); void sendLaunchCommand("exitApp"); }}
          />
        </div>
      </div>

      <Separator />

      {/* Install */}
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Install from URL</p>
        <Input
          placeholder="https://example.com/app.apk"
          value={apkUrl}
          onChange={(e) => setApkUrl(e.target.value)}
          className="h-7 text-sm"
        />
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={forceInstall}
              onChange={(e) => setForceInstall(e.target.checked)}
              className="rounded"
            />
            Force install
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={!apkUrl || loading !== null}
            onClick={() => void install()}
            className="flex items-center gap-1.5"
          >
            {loading === "install" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Install APK
          </Button>
        </div>
      </div>

      {/* Manual uninstall by package */}
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Uninstall by package</p>
        <div className="flex gap-2">
          <Input
            placeholder="com.example.app"
            value={uninstallPkg}
            onChange={(e) => setUninstallPkg(e.target.value)}
            className="h-7 text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!uninstallPkg || loading !== null}
            onClick={() => { setUninstallTarget(null); setUninstallOpen(true); }}
            className="shrink-0 flex items-center gap-1.5 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Uninstall
          </Button>
        </div>
      </div>

      {/* Install status */}
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Install status</p>
        <div>
          <Button
            size="sm"
            variant="outline"
            disabled={loading !== null}
            onClick={() => void checkStatus()}
            className="flex items-center gap-1.5"
          >
            {loading === "status" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Info className="h-3.5 w-3.5" />}
            Check
          </Button>
        </div>
        {status !== null && (
          <pre className="rounded bg-muted p-2 text-xs overflow-auto max-h-40">
            {JSON.stringify(status, null, 2)}
          </pre>
        )}
      </div>

      <Separator />

      {/* Installed apps list */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Installed Apps{apps !== null ? ` (${apps.length})` : ""}
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void loadApps()}
            disabled={appsLoading}
            className="h-7 px-2 flex items-center gap-1.5 text-xs"
          >
            {appsLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />}
            {apps === null ? "Load" : "Refresh"}
          </Button>
        </div>

        {apps !== null && (
          <>
            <Input
              placeholder="Search apps…"
              value={appSearch}
              onChange={(e) => setAppSearch(e.target.value)}
              className="h-7 text-sm"
            />
            <div className="flex flex-col divide-y rounded-md border overflow-y-auto max-h-96">
              {filteredApps.length === 0 ? (
                <p className="text-sm text-muted-foreground px-3 py-4 text-center">
                  {appSearch ? "No apps match your search." : "No apps found."}
                </p>
              ) : (
                filteredApps.map((app) => {
                  const busyLaunch = loading === `startApplication:${app.packageName}`;
                  const busyStop = loading === `stopApp:${app.packageName}`;
                  const busyUninstall = loading === `uninstall:${app.packageName}`;
                  const busy = busyLaunch || busyStop || busyUninstall;
                  return (
                    <div
                      key={app.packageName}
                      className="flex items-center gap-3 px-3 py-2.5"
                    >
                      {/* Icon */}
                      {app.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`data:image/png;base64,${app.icon}`}
                          alt=""
                          className="h-8 w-8 rounded shrink-0 object-contain"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted shrink-0 flex items-center justify-center text-muted-foreground text-xs font-bold">
                          {app.appLabel.charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Label + package */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{app.appLabel}</p>
                        <p className="text-xs text-muted-foreground truncate">{app.packageName}</p>
                        {app.appVersion && (
                          <p className="text-xs text-muted-foreground">v{app.appVersion}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy || loading !== null}
                          onClick={() => void appCommand("startApplication", app.packageName, "Launch")}
                          title="Launch"
                          className="h-7 w-7 p-0"
                        >
                          {busyLaunch ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy || loading !== null}
                          onClick={() => void appCommand("stopApp", app.packageName, "Stop")}
                          title="Stop"
                          className="h-7 w-7 p-0"
                        >
                          {busyStop ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy || loading !== null}
                          onClick={() => { setUninstallTarget(app); setUninstallPkg(app.packageName); setUninstallOpen(true); }}
                          title="Uninstall"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        >
                          {busyUninstall ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* Shared uninstall confirm dialog */}
      <ConfirmDialog
        open={uninstallOpen}
        onOpenChange={(open) => { setUninstallOpen(open); if (!open) setUninstallTarget(null); }}
        title="Uninstall app?"
        description={
          uninstallTarget
            ? `This will uninstall "${uninstallTarget.appLabel}" (${uninstallTarget.packageName}) from the device.`
            : `This will uninstall "${uninstallPkg}" from the device.`
        }
        confirmLabel="Uninstall"
        onConfirm={() => {
          const pkg = uninstallTarget?.packageName ?? uninstallPkg;
          setUninstallOpen(false);
          setUninstallTarget(null);
          void uninstallByPkg(pkg);
        }}
      />
    </div>
  );
}


interface ApkManagerProps {
  deviceId: string;
}
