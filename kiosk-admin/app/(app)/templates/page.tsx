"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp, Zap } from "lucide-react";

interface ConfigTemplate {
  id: string;
  name: string;
  provider: string;
  settings: string;
  createdAt: string;
}

interface DeviceOption {
  id: string;
  name: string;
  provider: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ConfigTemplate[]>([]);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [loading, setLoading] = useState(true);

  // New template form
  const [newName, setNewName] = useState("");
  const [newProvider, setNewProvider] = useState<"FULLY_KIOSK" | "FREE_KIOSK">("FULLY_KIOSK");
  const [newSettings, setNewSettings] = useState("{}");
  const [newSettingsError, setNewSettingsError] = useState("");
  const [creating, setCreating] = useState(false);

  // Apply template state
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  // Expand/collapse settings preview
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      const [tRes, dRes] = await Promise.all([fetch("/api/templates"), fetch("/api/devices")]);
      if (tRes.ok) setTemplates((await tRes.json()) as ConfigTemplate[]);
      if (dRes.ok) {
        const devs = (await dRes.json()) as DeviceOption[];
        setDevices(devs);
      }
      setLoading(false);
    };
    void load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(newSettings) as Record<string, string>;
    } catch {
      setNewSettingsError("Invalid JSON");
      return;
    }
    setNewSettingsError("");
    setCreating(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, provider: newProvider, settings: parsed }),
      });
      if (res.ok) {
        const tmpl = (await res.json()) as ConfigTemplate;
        setTemplates((prev) => [tmpl, ...prev]);
        setNewName("");
        setNewSettings("{}");
        toast.success("Template created");
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Failed to create template");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template deleted");
    } else {
      toast.error("Failed to delete template");
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function toggleDevice(id: string) {
    setSelectedDeviceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  async function handleApply() {
    if (!applyingId || selectedDeviceIds.size === 0) return;
    setApplying(true);
    try {
      const res = await fetch(`/api/templates/${applyingId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceIds: Array.from(selectedDeviceIds) }),
      });
      const data = (await res.json()) as {
        results: { deviceId: string; success: boolean; error?: string }[];
        partial?: boolean;
      };
      if (!res.ok) {
        const err = (data as unknown as { error?: string }).error;
        toast.error(err ?? "Failed to apply template");
        return;
      }
      const failed = data.results.filter((r) => !r.success);
      if (failed.length === 0) {
        toast.success(`Template applied to ${data.results.length} device(s)`);
      } else {
        toast.warning(`Applied to ${data.results.length - failed.length}, failed on ${failed.length}`);
      }
      setApplyingId(null);
      setSelectedDeviceIds(new Set());
    } catch {
      toast.error("Network error");
    } finally {
      setApplying(false);
    }
  }

  const applyingTemplate = templates.find((t) => t.id === applyingId);
  const compatibleDevices = applyingTemplate
    ? devices.filter((d) => d.provider === applyingTemplate.provider)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Config Templates</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Define reusable configuration templates and apply them to devices.
        </p>
      </div>

      {/* Create template form */}
      <section className="rounded-lg border p-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold">New Template</h2>
        <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1.5 flex-1 min-w-48">
              <Label htmlFor="tmplName">Name</Label>
              <Input
                id="tmplName"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My template"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tmplProvider">Provider</Label>
              <select
                id="tmplProvider"
                value={newProvider}
                onChange={(e) =>
                  setNewProvider(e.target.value as "FULLY_KIOSK" | "FREE_KIOSK")
                }
                className="border-input bg-background rounded-md border px-3 py-1.5 text-sm"
              >
                <option value="FULLY_KIOSK">Fully Kiosk</option>
                <option value="FREE_KIOSK">Free Kiosk</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tmplSettings">
              Settings (JSON object of <code>key: value</code> pairs)
            </Label>
            <textarea
              id="tmplSettings"
              rows={4}
              value={newSettings}
              onChange={(e) => setNewSettings(e.target.value)}
              className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-1"
            />
            {newSettingsError && (
              <p className="text-destructive text-xs">{newSettingsError}</p>
            )}
          </div>
          <Button type="submit" className="w-fit" disabled={creating}>
            <Plus className="mr-1 h-4 w-4" />
            Create Template
          </Button>
        </form>
      </section>

      {/* Template list */}
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-muted-foreground text-sm">No templates yet. Create one above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((t) => {
            const settings = JSON.parse(t.settings) as Record<string, string | number | boolean | null>;
            const count = Object.keys(settings).length;
            const isOpen = expanded.has(t.id);
            return (
              <div key={t.id} className="rounded-lg border p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{t.name}</span>
                      <Badge variant="secondary">{t.provider.replace("_", " ")}</Badge>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {count} setting{count !== 1 ? "s" : ""} ·{" "}
                      {new Date(t.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(t.id)}
                    >
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setApplyingId(t.id);
                        setSelectedDeviceIds(new Set());
                      }}
                    >
                      <Zap className="mr-1 h-3.5 w-3.5" />
                      Apply
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive h-8 w-8"
                      onClick={() => void handleDelete(t.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <pre className="bg-muted rounded-md p-3 text-xs overflow-auto">
                    {JSON.stringify(settings, null, 2)}
                  </pre>
                )}

                {/* Apply panel inline */}
                {applyingId === t.id && (
                  <div className="border-t pt-3 flex flex-col gap-3">
                    <p className="text-sm font-medium">Select devices to apply to:</p>
                    {compatibleDevices.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        No compatible devices found for this provider.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {compatibleDevices.map((d) => (
                          <label
                            key={d.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm select-none"
                          >
                            <input
                              type="checkbox"
                              checked={selectedDeviceIds.has(d.id)}
                              onChange={() => toggleDevice(d.id)}
                              className="h-3.5 w-3.5"
                            />
                            {d.name}
                          </label>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={applying || selectedDeviceIds.size === 0}
                        onClick={() => void handleApply()}
                      >
                        {applying ? "Applying…" : `Apply to ${selectedDeviceIds.size} device(s)`}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setApplyingId(null); setSelectedDeviceIds(new Set()); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
