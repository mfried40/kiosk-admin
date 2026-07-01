"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { ConfigResponse } from "@/app/api/config/route";
import { Wifi, WifiOff, Loader2, Trash2, Plus } from "lucide-react";
import type { AlertType } from "@/lib/generated/prisma/client";

interface AlertRule {
  id: string;
  type: AlertType;
  deviceId: string | null;
  threshold: number | null;
  emailEnabled: boolean;
  emailTo: string | null;
  active: boolean;
  device?: { name: string } | null;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // MQTT form state
  const [brokerUrl, setBrokerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [topicPrefix, setTopicPrefix] = useState("fully");
  const [connected, setConnected] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [retentionDays, setRetentionDays] = useState(7);

  // SMTP form state
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpHasPass, setSmtpHasPass] = useState(false);
  const [alertFromEmail, setAlertFromEmail] = useState("");
  const [smtpSaving, setSmtpSaving] = useState(false);

  // Alert rules
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [newRuleType, setNewRuleType] = useState<"OFFLINE" | "BATTERY" | "UNPLUGGED">("OFFLINE");
  const [newRuleThreshold, setNewRuleThreshold] = useState(20);
  const [newRuleEmail, setNewRuleEmail] = useState("");
  const [newRuleEmailEnabled, setNewRuleEmailEnabled] = useState(false);
  const [alertSaving, setAlertSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) return;
        const data = (await res.json()) as ConfigResponse;
        if (data.mqtt) {
          setBrokerUrl(data.mqtt.brokerUrl);
          setUsername(data.mqtt.username ?? "");
          setTopicPrefix(data.mqtt.topicPrefix);
          setConnected(data.mqtt.connected);
          setHasPassword(data.mqtt.hasPassword);
        }
        setRetentionDays(data.retentionDays);
        if (data.smtp) {
          setSmtpHost(data.smtp.host ?? "");
          setSmtpPort(data.smtp.port ?? 587);
          setSmtpUser(data.smtp.user ?? "");
          setSmtpHasPass(data.smtp.hasPassword);
          setAlertFromEmail(data.smtp.fromEmail ?? "");
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
    // Load alert rules
    void fetch("/api/alerts").then(async (res) => {
      if (res.ok) setAlertRules((await res.json()) as AlertRule[]);
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: {
        mqtt: {
          brokerUrl: string;
          username?: string;
          password?: string;
          topicPrefix: string;
        };
        retentionDays: number;
      } = {
        mqtt: {
          brokerUrl,
          topicPrefix,
        },
        retentionDays,
      };
      if (username) body.mqtt.username = username;
      if (password) body.mqtt.password = password;

      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(brokerUrl ? "MQTT settings saved and connected" : "MQTT disconnected");
        setPassword("");
        if (brokerUrl) {
          setConnected(true);
          setHasPassword(!!password || hasPassword);
        } else {
          setConnected(false);
          setHasPassword(false);
        }
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Failed to save settings");
        setConnected(false);
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mqtt: { brokerUrl: "" } }),
      });
      if (res.ok) {
        setBrokerUrl("");
        setUsername("");
        setPassword("");
        setTopicPrefix("fully");
        setConnected(false);
        setHasPassword(false);
        toast.success("MQTT disconnected");
      } else {
        toast.error("Failed to disconnect");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSmtpSave(e: React.FormEvent) {
    e.preventDefault();
    setSmtpSaving(true);
    try {
      const smtp: {
        host: string | null;
        port: number;
        user?: string;
        password?: string;
        fromEmail?: string;
      } = {
        host: smtpHost || null,
        port: smtpPort,
      };
      if (smtpUser) smtp.user = smtpUser;
      if (smtpPass) smtp.password = smtpPass;
      if (alertFromEmail) smtp.fromEmail = alertFromEmail;

      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtp }),
      });
      if (res.ok) {
        toast.success("SMTP settings saved");
        setSmtpPass("");
        if (smtpPass) setSmtpHasPass(true);
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Failed to save SMTP settings");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSmtpSaving(false);
    }
  }

  async function addAlertRule(e: React.FormEvent) {
    e.preventDefault();
    setAlertSaving(true);
    try {
      const body: {
        type: string;
        threshold?: number;
        emailEnabled: boolean;
        emailTo?: string;
      } = {
        type: newRuleType,
        emailEnabled: newRuleEmailEnabled,
      };
      if (newRuleType === "BATTERY") body.threshold = newRuleThreshold;
      if (newRuleEmailEnabled && newRuleEmail) body.emailTo = newRuleEmail;

      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const rule = (await res.json()) as AlertRule;
        setAlertRules((prev) => [rule, ...prev]);
        toast.success("Alert rule added");
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Failed to add rule");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setAlertSaving(false);
    }
  }

  async function deleteAlertRule(id: string) {
    const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAlertRules((prev) => prev.filter((r) => r.id !== id));
      toast.success("Alert rule deleted");
    } else {
      toast.error("Failed to delete rule");
    }
  }

  async function toggleAlertRule(id: string, active: boolean) {
    const res = await fetch(`/api/alerts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (res.ok) {
      const updated = (await res.json()) as AlertRule;
      setAlertRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure your MQTT broker for real-time device updates.
        </p>
      </div>

      {/* MQTT Section */}
      <section className="rounded-lg border p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">MQTT Broker</h2>
            <p className="text-sm text-muted-foreground">
              Connect to a message broker to receive real-time device events.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {connected ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-green-600 font-medium">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Disconnected</span>
              </>
            )}
          </div>
        </div>

        <form onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brokerUrl">Broker URL</Label>
            <Input
              id="brokerUrl"
              type="url"
              placeholder="mqtt://192.168.1.10:1883"
              value={brokerUrl}
              onChange={(e) => setBrokerUrl(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="topicPrefix">Topic Prefix</Label>
            <Input
              id="topicPrefix"
              placeholder="fully"
              value={topicPrefix}
              onChange={(e) => setTopicPrefix(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Defaults to <code>fully</code> — matches Fully Kiosk Browser&apos;s default prefix.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mqttUsername">Username (optional)</Label>
            <Input
              id="mqttUsername"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mqttPassword">
              Password (optional{hasPassword ? " — leave blank to keep existing" : ""})
            </Label>
            <Input
              id="mqttPassword"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save &amp; Connect
            </Button>
            {connected && (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => void handleDisconnect()}
              >
                Disconnect
              </Button>
            )}
          </div>
        </form>
      </section>
      {/* History Retention */}
      <section className="rounded-lg border p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">History Retention</h2>
          <p className="text-sm text-muted-foreground">
            How many days of device status history to keep.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1.5 w-36">
            <Label htmlFor="retentionDays">Retention (days)</Label>
            <Input
              id="retentionDays"
              type="number"
              min={1}
              max={365}
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
            />
          </div>
          <Button
            className="mt-5"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                const res = await fetch("/api/config", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ retentionDays }),
                });
                if (res.ok) {
                  toast.success("Retention period saved");
                } else {
                  toast.error("Failed to save");
                }
              } catch {
                toast.error("Network error");
              } finally {
                setSaving(false);
              }
            }}
          >
            Save
          </Button>
        </div>
      </section>

      {/* SMTP Section */}
      <section className="rounded-lg border p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Email (SMTP)</h2>
          <p className="text-sm text-muted-foreground">
            Configure outbound email for alert notifications.
          </p>
        </div>
        <form onSubmit={(e) => void handleSmtpSave(e)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
              <Label htmlFor="smtpHost">SMTP Host</Label>
              <Input
                id="smtpHost"
                placeholder="smtp.example.com"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="smtpPort">Port</Label>
              <Input
                id="smtpPort"
                type="number"
                min={1}
                max={65535}
                value={smtpPort}
                onChange={(e) => setSmtpPort(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="smtpUser">Username (optional)</Label>
            <Input
              id="smtpUser"
              autoComplete="off"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="smtpPass">
              Password{smtpHasPass ? " (leave blank to keep existing)" : " (optional)"}
            </Label>
            <Input
              id="smtpPass"
              type="password"
              autoComplete="new-password"
              value={smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="alertFromEmail">From address</Label>
            <Input
              id="alertFromEmail"
              type="email"
              placeholder="alerts@example.com"
              value={alertFromEmail}
              onChange={(e) => setAlertFromEmail(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-fit" disabled={smtpSaving}>
            {smtpSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save SMTP Settings
          </Button>
        </form>
      </section>

      {/* Alert Rules Section */}
      <section className="rounded-lg border p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Alert Rules</h2>
          <p className="text-sm text-muted-foreground">
            Configure rules to receive notifications when devices go offline, run low on battery, or are unplugged.
          </p>
        </div>

        {/* Existing rules */}
        {alertRules.length > 0 && (
          <ul className="flex flex-col gap-2">
            {alertRules.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {rule.type}
                    {rule.threshold !== null && ` ≤ ${rule.threshold}%`}
                    {rule.deviceId ? ` — ${rule.device?.name ?? "device"}` : " — all devices"}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {rule.emailEnabled ? `Email: ${rule.emailTo ?? "not set"}` : "No email"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => void toggleAlertRule(rule.id, !rule.active)}
                  >
                    {rule.active ? "Active" : "Paused"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => void deleteAlertRule(rule.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* New rule form */}
        <form onSubmit={(e) => void addAlertRule(e)} className="flex flex-col gap-3 rounded-md border border-dashed p-3">
          <p className="text-sm font-medium">Add rule</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newRuleType">Type</Label>
              <select
                id="newRuleType"
                value={newRuleType}
                onChange={(e) => setNewRuleType(e.target.value as "OFFLINE" | "BATTERY" | "UNPLUGGED")}
                className="border-input bg-background rounded-md border px-3 py-1.5 text-sm"
              >
                <option value="OFFLINE">Offline</option>
                <option value="BATTERY">Battery low</option>
                <option value="UNPLUGGED">Unplugged</option>
              </select>
            </div>
            {newRuleType === "BATTERY" && (
              <div className="flex flex-col gap-1.5 w-28">
                <Label htmlFor="newRuleThreshold">Threshold (%)</Label>
                <Input
                  id="newRuleThreshold"
                  type="number"
                  min={1}
                  max={99}
                  value={newRuleThreshold}
                  onChange={(e) => setNewRuleThreshold(Number(e.target.value))}
                />
              </div>
            )}
            <div className="flex items-center gap-2 pb-1">
              <input
                id="newRuleEmailEnabled"
                type="checkbox"
                checked={newRuleEmailEnabled}
                onChange={(e) => setNewRuleEmailEnabled(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="newRuleEmailEnabled" className="cursor-pointer">Email alert</Label>
            </div>
            {newRuleEmailEnabled && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newRuleEmail">Send to</Label>
                <Input
                  id="newRuleEmail"
                  type="email"
                  placeholder="you@example.com"
                  value={newRuleEmail}
                  onChange={(e) => setNewRuleEmail(e.target.value)}
                  className="w-52"
                />
              </div>
            )}
            <Button type="submit" size="sm" disabled={alertSaving} className="mb-0.5">
              {alertSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Add
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
