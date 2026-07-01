"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsTable } from "@/components/SettingsTable";
import { SettingsImportPanel } from "@/components/SettingsImportPanel";
import { toast } from "sonner";
import { getCapabilitiesForProvider } from "@/lib/capabilities";
import { getSettingDef } from "@/lib/settings-schema";
import type { DeviceWithRelations } from "@/lib/types";

interface RawSettingsResponse {
  [key: string]: string;
}

export default function DeviceSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [device, setDevice] = useState<DeviceWithRelations | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  // Debounce timers for auto-save
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Track the "pending" values so we can debounce
  const pendingValues = useRef<Record<string, string>>({});

  const fetchDevice = useCallback(async () => {
    const res = await fetch(`/api/devices/${id}`);
    if (!res.ok) {
      router.push("/");
      return;
    }
    const data = (await res.json()) as DeviceWithRelations;
    setDevice(data);
    return data;
  }, [id, router]);

  const fetchSettings = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      else setRefreshing(true);
      setOffline(false);
      try {
        const res = await fetch(`/api/devices/${id}/device-settings`);
        if (res.status === 503) {
          setOffline(true);
          return;
        }
        if (!res.ok) {
          toast.error("Failed to load settings");
          return;
        }
        const data = (await res.json()) as RawSettingsResponse;
        setSettings(data);
      } catch {
        setOffline(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    void fetchDevice();
    void fetchSettings();
  }, [fetchDevice, fetchSettings]);

  function saveSetting(key: string, value: string) {
    // Use the schema to determine whether this is a boolean setting
    const def = getSettingDef(key);
    const isBoolean = def?.type === "boolean";

    const body = isBoolean
      ? { type: "boolean" as const, key, value: value === "true" }
      : { type: "string" as const, key, value };

    setSavingKeys((prev) => new Set([...prev, key]));

    fetch(`/api/devices/${id}/device-settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data: { error?: string }) => {
            throw new Error(data.error ?? `HTTP ${res.status}`);
          });
        }
        // Keep the updated value
      })
      .catch((err: unknown) => {
        toast.error(
          `Failed to save ${key}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      })
      .finally(() => {
        setSavingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      });
  }

  function handleChange(key: string, value: string) {
    // Optimistic update
    setSettings((prev) => ({ ...prev, [key]: value }));
    pendingValues.current[key] = value;

    // Debounce save by 800 ms
    clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(() => {
      saveSetting(key, pendingValues.current[key] ?? value);
    }, 800);
  }

  function handleImport(imported: Record<string, string>) {
    setSettings((prev) => ({ ...prev, ...imported }));
  }

  const caps = device ? getCapabilitiesForProvider(device.provider) : null;

  if (!loading && caps && !caps.hasAppManagement) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-muted-foreground text-sm">
          Device settings are not supported by this provider.
        </p>
        <Link href={`/devices/${id}`}>
          <Button variant="outline" size="sm" className="mt-4">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Device
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={`/devices/${id}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {device ? device.name : <Skeleton className="inline-block h-7 w-40" />}
            </h1>
            <p className="text-sm text-muted-foreground">Device Settings</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchSettings(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw className={`mr-1 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Offline banner */}
      {offline && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Device is offline or unreachable. Showing last-known settings may not be available.{" "}
          <button
            onClick={() => void fetchSettings()}
            className="underline underline-offset-2 font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Import panel */}
      {device && <SettingsImportPanel deviceId={device.id} onImport={handleImport} />}

      {/* Settings table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span>All Settings</span>
            {!loading && (
              <span className="text-sm font-normal text-muted-foreground">
                {Object.keys(settings).length} settings loaded
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-9 w-64" />
                </div>
              ))}
            </div>
          ) : (
            <SettingsTable
              values={settings}
              onChange={handleChange}
              savingKeys={savingKeys}
              disabled={offline}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
