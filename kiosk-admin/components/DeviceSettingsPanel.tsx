"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DeviceSettingsPanelProps {
  deviceId: string;
}

interface EditState {
  key: string;
  value: string;
  type: "string" | "boolean";
}

export function DeviceSettingsPanel({ deviceId }: DeviceSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadSettings() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/devices/${deviceId}/device-settings`);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? `Error ${res.status}`);
      } else {
        setSettings((await res.json()) as Record<string, string>);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!edit) return;
    setSaving(true);
    try {
      const body =
        edit.type === "boolean"
          ? { type: "boolean", key: edit.key, value: edit.value === "true" }
          : { type: "string", key: edit.key, value: edit.value };

      const res = await fetch(`/api/devices/${deviceId}/device-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Save failed");
      } else {
        toast.success("Setting saved");
        setSettings((prev) => prev ? { ...prev, [edit.key]: edit.value } : prev);
        setEdit(null);
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  const rows = useMemo(() => {
    if (!settings) return [];
    const entries = Object.entries(settings);
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(([k]) => k.toLowerCase().includes(q));
  }, [settings, search]);

  function handleOpen() {
    if (!open) {
      setOpen(true);
      if (!settings) void loadSettings();
    } else {
      setOpen(false);
    }
  }

  function startEdit(key: string, value: string) {
    const isBool = value === "true" || value === "false";
    setEdit({ key, value, type: isBool ? "boolean" : "string" });
  }

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors text-left"
        onClick={handleOpen}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        Device Settings
        {settings && (
          <span className="ml-1 text-xs text-muted-foreground font-normal">
            ({Object.keys(settings).length} settings)
          </span>
        )}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search settings…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => { setSettings(null); void loadSettings(); }}
              className="shrink-0 flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Reload
            </Button>
          </div>

          {loading && <Skeleton className="h-40 w-full" />}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {rows.length > 0 && (
            <div className="overflow-auto max-h-96 rounded border text-xs">
              <table className="w-full border-collapse font-mono">
                <thead className="sticky top-0 bg-muted text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium w-1/2">Key</th>
                    <th className="text-left px-3 py-2 font-medium">Value</th>
                    <th className="px-3 py-2 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([key, value]) => (
                    <tr key={key} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-1.5 text-muted-foreground">{key}</td>
                      <td className="px-3 py-1.5 break-all max-w-xs">
                        {edit?.key === key ? (
                          <div className="flex items-center gap-1">
                            {edit.type === "boolean" ? (
                              <select
                                value={edit.value}
                                onChange={(e) => setEdit({ ...edit, value: e.target.value })}
                                className="h-6 rounded border bg-background px-1 text-xs"
                              >
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            ) : (
                              <Input
                                value={edit.value}
                                onChange={(e) => setEdit({ ...edit, value: e.target.value })}
                                className="h-6 text-xs"
                              />
                            )}
                            <Button size="sm" disabled={saving} onClick={() => void save()} className="h-6 px-2 text-xs">
                              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEdit(null)} className="h-6 px-2 text-xs">
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          value
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {edit?.key !== key && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(key, value)}
                            className="h-6 px-2 text-xs"
                          >
                            Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && settings && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {search ? "No settings match your search." : "No settings found."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
