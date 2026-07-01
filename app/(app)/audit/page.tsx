"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface AuditEntry {
  id: string;
  userId: string;
  deviceId: string | null;
  action: string;
  payload: unknown;
  createdAt: string;
  userEmail: string | null;
  deviceName: string | null;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

function payloadSummary(action: string, payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;
  if (action === "sendCommand") return `cmd: ${String(p.cmd ?? "")}`;
  if (action === "updateDevice") {
    const fields = Array.isArray(p.fields) ? (p.fields as string[]).join(", ") : "";
    return `fields: ${fields}`;
  }
  if (action === "TEMPLATE_APPLIED" || action === "applyTemplate")
    return `template: ${String(p.templateName ?? "")}`;
  if (action === "setSetting") return `${String(p.key ?? "")}: ${String(p.oldValue ?? "?")} → ${String(p.newValue ?? "")}`;
  return JSON.stringify(payload).slice(0, 80);
}

const ACTION_COLORS: Record<string, string> = {
  sendCommand: "secondary",
  updateDevice: "outline",
  TEMPLATE_APPLIED: "default",
  setSetting: "secondary",
};

export default function AuditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = 50;
  const deviceId = searchParams.get("deviceId") ?? "";
  const userId = searchParams.get("userId") ?? "";
  const action = searchParams.get("action") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (deviceId) params.set("deviceId", deviceId);
      if (userId) params.set("userId", userId);
      if (action) params.set("action", action);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/audit?${params}`);
      if (res.ok) {
        const data = (await res.json()) as AuditResponse;
        setEntries(data.entries);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [deviceId, userId, action, from, to, page]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function setPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground mt-1 text-sm">{total} entries</p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filterAction">Action</Label>
          <Input
            id="filterAction"
            className="w-40"
            placeholder="e.g. sendCommand"
            value={action}
            onChange={(e) => updateParam("action", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filterFrom">From</Label>
          <Input
            id="filterFrom"
            type="date"
            className="w-36"
            value={from ? from.slice(0, 10) : ""}
            onChange={(e) =>
              updateParam("from", e.target.value ? `${e.target.value}T00:00:00.000Z` : "")
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filterTo">To</Label>
          <Input
            id="filterTo"
            type="date"
            className="w-36"
            value={to ? to.slice(0, 10) : ""}
            onChange={(e) =>
              updateParam("to", e.target.value ? `${e.target.value}T23:59:59.999Z` : "")
            }
          />
        </div>
        {(deviceId || userId || action || from || to) && (
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.replace("/audit")}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Time</th>
              <th className="px-4 py-2 text-left font-medium">User</th>
              <th className="px-4 py-2 text-left font-medium">Device</th>
              <th className="px-4 py-2 text-left font-medium">Action</th>
              <th className="px-4 py-2 text-left font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground px-4 py-8 text-center">
                  Loading…
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground px-4 py-8 text-center">
                  No entries found.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="text-muted-foreground px-4 py-2 whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 max-w-[180px] truncate">
                    {entry.userEmail ?? entry.userId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2">
                    {entry.deviceId ? (
                      <Link
                        href={`/devices/${entry.deviceId}`}
                        className="text-primary hover:underline"
                      >
                        {entry.deviceName ?? entry.deviceId.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={(ACTION_COLORS[entry.action] as "default" | "secondary" | "outline" | "destructive") ?? "secondary"}>
                      {entry.action}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground px-4 py-2 font-mono text-xs max-w-xs truncate">
                    {payloadSummary(entry.action, entry.payload)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
