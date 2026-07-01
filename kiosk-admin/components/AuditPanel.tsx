"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: string;
  action: string;
  payload: unknown;
  createdAt: string;
  userEmail: string | null;
}

function payloadSummary(action: string, payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;
  if (action === "sendCommand") return `cmd: ${String(p.cmd ?? "")}`;
  if (action === "updateDevice") {
    const fields = Array.isArray(p.fields) ? (p.fields as string[]).join(", ") : "";
    return fields;
  }
  if (action === "TEMPLATE_APPLIED" || action === "applyTemplate")
    return String(p.templateName ?? "");
  if (action === "setSetting")
    return `${String(p.key ?? "")} → ${String(p.newValue ?? "")}`;
  return "";
}

interface Props {
  deviceId: string;
}

export function AuditPanel({ deviceId }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    setLoading(true);
    void fetch(`/api/audit?deviceId=${deviceId}&pageSize=20`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { entries: AuditEntry[] };
        setEntries(data.entries);
        setLoaded(true);
      })
      .finally(() => setLoading(false));
  }, [open, loaded, deviceId]);

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className={cn(
          "flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/50",
          open && "border-b",
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <span>Audit Log</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="p-4 flex flex-col gap-3">
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground text-sm">No audit entries for this device.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="pb-1 text-left font-medium">Time</th>
                  <th className="pb-1 text-left font-medium">User</th>
                  <th className="pb-1 text-left font-medium">Action</th>
                  <th className="pb-1 text-left font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="text-muted-foreground py-1.5 pr-3 whitespace-nowrap text-xs">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-3 max-w-[140px] truncate text-xs">
                      {e.userEmail ?? "—"}
                    </td>
                    <td className="py-1.5 pr-3">
                      <Badge variant="secondary" className="text-xs">
                        {e.action}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground py-1.5 font-mono text-xs max-w-[200px] truncate">
                      {payloadSummary(e.action, e.payload)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Link
            href={`/audit?deviceId=${deviceId}`}
            className="text-primary text-sm hover:underline"
          >
            View all →
          </Link>
        </div>
      )}
    </div>
  );
}
