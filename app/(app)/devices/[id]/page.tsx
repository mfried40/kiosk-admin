"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceForm } from "@/components/DeviceForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DeviceControls } from "@/components/DeviceControls";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ScreenshotPanel } from "@/components/ScreenshotPanel";
import { StatusHistoryCharts } from "@/components/StatusHistoryCharts";
import { LogsPanel } from "@/components/LogsPanel";
import { AuditPanel } from "@/components/AuditPanel";
import { CamshotPanel } from "@/components/CamshotPanel";
import { BrowserControls } from "@/components/BrowserControls";
import { MediaControls } from "@/components/MediaControls";
import { ApkManager } from "@/components/ApkManager";
import { MaintenanceControls } from "@/components/MaintenanceControls";
import { JsInjector } from "@/components/JsInjector";
import { FileTransferControls } from "@/components/FileTransferControls";
import { getCapabilitiesForProvider } from "@/lib/capabilities";
import type { ProviderCapabilities } from "@/lib/provider.types";
import type { Group, Tag } from "@/lib/generated/prisma/client";
import type { DeviceWithRelations, DeviceInfo } from "@/lib/types";
import {
  ArrowLeft,
  Battery,
  Monitor,
  Wifi,
  WifiOff,
  RefreshCw,
  Trash2,
  Pencil,
  Download,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

// ── Tab config ───────────────────────────────────────────────────────────────

const TOP_TABS = ["overview", "controls", "advanced", "logs"] as const;
type TopTab = (typeof TOP_TABS)[number];

const TOP_TAB_LABELS: Record<TopTab, string> = {
  overview: "Overview",
  controls: "Controls",
  advanced: "Advanced",
  logs: "Logs",
};

type AdvancedSubTab = {
  key: string;
  label: string;
  visible: (c: ProviderCapabilities) => boolean;
};

const ADVANCED_SUB_TABS: AdvancedSubTab[] = [
  { key: "browser",     label: "Browser",       visible: (c) => c.hasUrlControl || c.hasTabManagement },
  { key: "apk",         label: "Apps",           visible: (c) => c.hasAppLauncher || c.hasApkManagement },
  { key: "maintenance", label: "Maintenance",    visible: (c) => c.hasMaintenance },
  { key: "js",          label: "JS Injection",   visible: (c) => c.hasInjectJS },
  { key: "filetransfer",label: "File Transfer",  visible: (c) => c.hasFileTransfer },
];

// ── Page component ───────────────────────────────────────────────────────────

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [device, setDevice] = useState<DeviceWithRelations | null>(null);
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [groups, setGroups] = useState<Pick<Group, "id" | "name">[]>([]);
  const [tags, setTags] = useState<Pick<Tag, "id" | "name">[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Top-level tab state — driven by ?tab= query param
  const rawTab = searchParams.get("tab") ?? "overview";
  const activeTab: TopTab = (TOP_TABS as readonly string[]).includes(rawTab)
    ? (rawTab as TopTab)
    : "overview";

  // Lazy-mount: track which top tabs have been visited
  const [visitedTabs, setVisitedTabs] = useState<Set<TopTab>>(new Set(["overview"]));

  // Advanced sub-tab state (local, not reflected in URL)
  const [advancedSubTab, setAdvancedSubTab] = useState<string>("");
  const [visitedSubTabs, setVisitedSubTabs] = useState<Set<string>>(new Set());

  function handleTabChange(tab: TopTab) {
    setVisitedTabs((prev) => new Set([...prev, tab]));
    router.replace(`?tab=${tab}`, { scroll: false });
  }

  function handleSubTabChange(key: string) {
    setAdvancedSubTab(key);
    setVisitedSubTabs((prev) => new Set([...prev, key]));
  }

  const fetchDevice = useCallback(async () => {
    const res = await fetch(`/api/devices/${id}`);
    if (!res.ok) {
      router.push("/");
      return;
    }
    setDevice((await res.json()) as DeviceWithRelations);
  }, [id, router]);

  const fetchInfo = useCallback(async () => {
    setInfoLoading(true);
    try {
      const res = await fetch(`/api/devices/${id}/info`);
      setInfo((await res.json()) as DeviceInfo);
    } catch {
      setInfo(null);
    } finally {
      setInfoLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchDevice();
    void fetchInfo();
    const fetchMeta = async () => {
      const [gRes, tRes] = await Promise.all([fetch("/api/groups"), fetch("/api/tags")]);
      if (gRes.ok) setGroups((await gRes.json()) as Pick<Group, "id" | "name">[]);
      if (tRes.ok) setTags((await tRes.json()) as Pick<Tag, "id" | "name">[]);
    };
    void fetchMeta();
  }, [fetchDevice, fetchInfo]);

  // Initialise the first visible advanced sub-tab once capabilities are known
  useEffect(() => {
    if (!device || advancedSubTab) return;
    const caps = getCapabilitiesForProvider(device.provider);
    const first = ADVANCED_SUB_TABS.find((t) => t.visible(caps));
    if (first) {
      setAdvancedSubTab(first.key);
      setVisitedSubTabs(new Set([first.key]));
    }
  }, [device, advancedSubTab]);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/devices/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Device deleted");
      router.push("/");
    } else {
      toast.error("Failed to delete device");
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (!device) {
    return <p className="text-muted-foreground p-6">Loading…</p>;
  }

  const online = info?.online ?? false;
  const caps = getCapabilitiesForProvider(device.provider);
  const visibleSubTabs = ADVANCED_SUB_TABS.filter((t) => t.visible(caps));
  const hasAnyAdvanced =
    visibleSubTabs.length > 0 || caps.hasAppManagement || caps.hasUsageStats;

  // ── Tab button helper ──────────────────────────────────────────────────────
  function tabBtn(tab: TopTab) {
    const active = activeTab === tab;
    return (
      <button
        key={tab}
        onClick={() => handleTabChange(tab)}
        className={
          "px-4 py-2 rounded-md text-sm font-medium transition-colors " +
          (active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/70")
        }
      >
        {TOP_TAB_LABELS[tab]}
      </button>
    );
  }

  function subTabBtn(key: string, label: string) {
    const active = advancedSubTab === key;
    return (
      <button
        key={key}
        onClick={() => handleSubTabChange(key)}
        className={
          "px-3 py-1.5 rounded-md text-sm font-medium transition-colors " +
          (active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/70")
        }
      >
        {label}
      </button>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 max-w-4xl">

      {/* ── Persistent header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{device.name}</h1>
            <p className="text-muted-foreground text-sm">
              {device.ipAddress}:{device.port} · {device.provider}
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { void fetchDevice(); void fetchInfo(); }}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${infoLoading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger
              render={
                <Button variant="outline" size="sm">
                  <Pencil className="mr-1 h-4 w-4" />
                  Edit
                </Button>
              }
            />
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Device</DialogTitle>
              </DialogHeader>
              <DeviceForm
                device={device}
                groups={groups}
                tags={tags}
                onSuccess={() => {
                  setEditOpen(false);
                  void fetchDevice();
                  toast.success("Device updated");
                }}
              />
            </DialogContent>
          </Dialog>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            disabled={deleting}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Delete
          </Button>
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title="Delete device?"
            description="This cannot be undone. The device will be permanently removed."
            loading={deleting}
            onConfirm={() => void handleDelete()}
          />
        </div>
      </div>

      {/* ── Top-level tab bar ─────────────────────────────────────────────── */}
      <div className="flex gap-1 flex-wrap">
        {TOP_TABS.map(tabBtn)}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Overview
      ══════════════════════════════════════════════════════════════════════ */}
      {visitedTabs.has("overview") && (
        <div className={activeTab === "overview" ? "block" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-4">

            {/* Left column: Live Status + Details */}
            <div className="flex flex-col gap-4">

              {/* Live Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    Live Status
                    <Badge variant={online ? "default" : "secondary"}>
                      {online
                        ? <Wifi className="mr-1 h-3 w-3" />
                        : <WifiOff className="mr-1 h-3 w-3" />}
                      {infoLoading ? "Checking…" : online ? "Online" : "Offline"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                {online && info && (
                  <CardContent>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      {info.deviceModel && (
                        <div>
                          <dt className="text-muted-foreground text-xs">Model</dt>
                          <dd>{info.deviceModel}</dd>
                        </div>
                      )}
                      {info.androidVersion && (
                        <div>
                          <dt className="text-muted-foreground text-xs">Android</dt>
                          <dd>{info.androidVersion}</dd>
                        </div>
                      )}
                      {info.appVersion && (
                        <div>
                          <dt className="text-muted-foreground text-xs">App version</dt>
                          <dd>{info.appVersion}</dd>
                        </div>
                      )}
                      {info.batteryLevel !== undefined && (
                        <div>
                          <dt className="text-muted-foreground flex items-center gap-1 text-xs">
                            <Battery className="h-3 w-3" /> Battery
                          </dt>
                          <dd>{Math.round(info.batteryLevel)}%</dd>
                        </div>
                      )}
                      {info.screenOn !== undefined && (
                        <div>
                          <dt className="text-muted-foreground flex items-center gap-1 text-xs">
                            <Monitor className="h-3 w-3" /> Screen
                          </dt>
                          <dd>{info.screenOn ? "On" : "Off"}</dd>
                        </div>
                      )}
                      {info.storageFree !== undefined && info.storageTotal !== undefined && (
                        <div className="col-span-2">
                          <dt className="text-muted-foreground text-xs">Storage free</dt>
                          <dd>
                            {Math.round(info.storageFree / 1024 / 1024)} MB /{" "}
                            {Math.round(info.storageTotal / 1024 / 1024)} MB
                          </dd>
                        </div>
                      )}
                      {info.currentUrl && (
                        <div className="col-span-2">
                          <dt className="text-muted-foreground text-xs">Current URL</dt>
                          <dd className="truncate" title={info.currentUrl}>
                            {info.currentUrl}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </CardContent>
                )}
              </Card>

              {/* Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Details</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {device.group && (
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs">Group</p>
                      <Badge variant="outline">{device.group.name}</Badge>
                    </div>
                  )}
                  {device.tags.length > 0 && (
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs">Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {device.tags.map(({ tag }) => (
                          <Badge key={tag.id} variant="secondary">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-muted-foreground text-xs">
                    Added {new Date(device.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right column: History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">History (last 7 days)</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusHistoryCharts deviceId={device.id} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Controls
      ══════════════════════════════════════════════════════════════════════ */}
      {visitedTabs.has("controls") && (
        <div className={activeTab === "controls" ? "block" : "hidden"}>
          <div className="flex flex-col gap-4">

            {/* Remote Controls — full width */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Remote Controls</CardTitle>
              </CardHeader>
              <CardContent>
                <DeviceControls
                  deviceId={device.id}
                  capabilities={caps}
                />
              </CardContent>
            </Card>

            {/* Screenshot + Camera Snapshot — side by side on md+ */}
            {(caps.hasScreenshot || caps.hasCamshot) && (
              <div className={
                caps.hasScreenshot && caps.hasCamshot
                  ? "grid grid-cols-1 md:grid-cols-2 gap-4"
                  : "grid grid-cols-1 gap-4"
              }>
                {caps.hasScreenshot && (
                  <Card>
                    <CardContent className="pt-6">
                      <ScreenshotPanel deviceId={device.id} />
                    </CardContent>
                  </Card>
                )}
                {caps.hasCamshot && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Camera Snapshot</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CamshotPanel deviceId={device.id} />
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Advanced
      ══════════════════════════════════════════════════════════════════════ */}
      {visitedTabs.has("advanced") && (
        <div className={activeTab === "advanced" ? "block" : "hidden"}>
          <div className="flex flex-col gap-4">

            {/* Quick-action row */}
            {(caps.hasAppManagement || caps.hasUsageStats) && (
              <div className="flex gap-3 flex-wrap">
                {caps.hasAppManagement && (
                  <Link
                    href={`/devices/${device.id}/settings`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <Settings className="mr-1 h-4 w-4" />
                    View Device Settings
                  </Link>
                )}
                {caps.hasUsageStats && (
                  <a
                    href={`/api/devices/${device.id}/usage-stats`}
                    download={`usage-${device.id}.csv`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <Download className="mr-1 h-4 w-4" />
                    Download Usage CSV
                  </a>
                )}
              </div>
            )}

            {/* Sub-tab bar */}
            {visibleSubTabs.length > 0 ? (
              <>
                <div className="flex gap-1 flex-wrap">
                  {visibleSubTabs.map((t) => subTabBtn(t.key, t.label))}
                </div>

                {/* Sub-tab content (lazy-mounted) */}
                <Card>
                  <CardContent className="pt-6">
                    {visitedSubTabs.has("browser") && (
                      <div className={advancedSubTab === "browser" ? "block" : "hidden"}>
                        <BrowserControls deviceId={device.id} capabilities={caps} />
                      </div>
                    )}
                    {visitedSubTabs.has("media") && (
                      <div className={advancedSubTab === "media" ? "block" : "hidden"}>
                        <MediaControls deviceId={device.id} />
                      </div>
                    )}
                    {visitedSubTabs.has("apk") && (
                      <div className={advancedSubTab === "apk" ? "block" : "hidden"}>
                        <ApkManager deviceId={device.id} />
                      </div>
                    )}
                    {visitedSubTabs.has("maintenance") && (
                      <div className={advancedSubTab === "maintenance" ? "block" : "hidden"}>
                        <MaintenanceControls deviceId={device.id} />
                      </div>
                    )}
                    {visitedSubTabs.has("js") && (
                      <div className={advancedSubTab === "js" ? "block" : "hidden"}>
                        <JsInjector deviceId={device.id} />
                      </div>
                    )}
                    {visitedSubTabs.has("filetransfer") && (
                      <div className={advancedSubTab === "filetransfer" ? "block" : "hidden"}>
                        <FileTransferControls deviceId={device.id} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : !caps.hasAppManagement && !caps.hasUsageStats ? (
              <p className="text-sm text-muted-foreground py-4">
                No advanced capabilities available for this provider.
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Logs
      ══════════════════════════════════════════════════════════════════════ */}
      {visitedTabs.has("logs") && (
        <div className={activeTab === "logs" ? "block" : "hidden"}>
          <div className="flex flex-col gap-4">
            {caps.hasLogViewer && <LogsPanel deviceId={device.id} />}
            <AuditPanel deviceId={device.id} />
          </div>
        </div>
      )}

    </div>
  );
}
