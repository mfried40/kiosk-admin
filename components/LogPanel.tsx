"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";

interface LogEntry {
  time: string;
  type: number;
  tag: string;
  message: string;
}

interface LogPanelProps {
  deviceId: string;
}

export function LogPanel({ deviceId }: LogPanelProps) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<string | null>(null);
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (logs !== null) return; // already loaded
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/devices/${deviceId}/logs`);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? `Error ${res.status}`);
      } else {
        const text = await res.text();
        setLogs(text);
        try {
          const parsed = JSON.parse(text) as unknown;
          if (Array.isArray(parsed)) {
            setEntries(parsed as LogEntry[]);
          }
        } catch {
          // not JSON — fall back to plain text
        }
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!logs) return;
    await navigator.clipboard.writeText(logs);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors text-left"
        onClick={() => void handleOpen()}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        Device Log
      </button>

      {open && (
        <div className="border-t">
          {loading && (
            <div className="p-4">
              <Skeleton className="h-40 w-full" />
            </div>
          )}
          {error && (
            <p className="px-4 py-3 text-sm text-destructive">{error}</p>
          )}
          {logs !== null && !loading && (
            <div className="relative">
              <Button
                size="sm"
                variant="ghost"
                className="absolute right-2 top-2 z-10"
                onClick={() => void handleCopy()}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
              {entries !== null ? (
                <div className="overflow-auto max-h-96">
                  <table className="w-full text-xs font-mono border-collapse">
                    <thead className="sticky top-0 bg-muted text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Time</th>
                        <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Tag</th>
                        <th className="text-left px-3 py-2 font-medium">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, i) => (
                        <tr
                          key={i}
                          className={`border-t ${entry.type === 1 ? "bg-destructive/5 text-destructive" : "hover:bg-muted/40"}`}
                        >
                          <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{entry.time}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap font-semibold">{entry.tag}</td>
                          <td className="px-3 py-1.5 break-words max-w-sm leading-relaxed">{entry.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <pre className="overflow-auto max-h-96 p-4 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                  {logs}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
