"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";

interface LogEntry {
  time: string;
  type: number;
  tag: string;
  message: string;
}

type Tab = "fully" | "logcat";

interface LogsPanelProps {
  deviceId: string;
}

function LogContent({ text, entries }: { text: string; entries: LogEntry[] | null }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [text]);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="ghost"
        className="absolute right-2 top-2 z-10"
        onClick={() => void handleCopy()}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
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
          <div ref={bottomRef} />
        </div>
      ) : (
        <pre className="overflow-auto max-h-96 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
          {text}
          <div ref={bottomRef} />
        </pre>
      )}
    </div>
  );
}

export function LogsPanel({ deviceId }: LogsPanelProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("fully");

  const [fullyText, setFullyText] = useState<string | null>(null);
  const [fullyEntries, setFullyEntries] = useState<LogEntry[] | null>(null);
  const [fullyLoading, setFullyLoading] = useState(false);
  const [fullyError, setFullyError] = useState<string | null>(null);

  const [logcatText, setLogcatText] = useState<string | null>(null);
  const [logcatLoading, setLogcatLoading] = useState(false);
  const [logcatError, setLogcatError] = useState<string | null>(null);

  async function loadFully() {
    if (fullyText !== null) return;
    setFullyLoading(true);
    setFullyError(null);
    try {
      const res = await fetch(`/api/devices/${deviceId}/logs`);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setFullyError(data.error ?? `Error ${res.status}`);
      } else {
        const text = await res.text();
        setFullyText(text);
        try {
          const parsed = JSON.parse(text) as unknown;
          if (Array.isArray(parsed)) setFullyEntries(parsed as LogEntry[]);
        } catch { /* plain text */ }
      }
    } catch { setFullyError("Network error"); }
    finally { setFullyLoading(false); }
  }

  async function loadLogcat() {
    if (logcatText !== null) return;
    setLogcatLoading(true);
    setLogcatError(null);
    try {
      const res = await fetch(`/api/devices/${deviceId}/logcat`);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setLogcatError(data.error ?? `Error ${res.status}`);
      } else {
        setLogcatText(await res.text());
      }
    } catch { setLogcatError("Network error"); }
    finally { setLogcatLoading(false); }
  }

  function handleOpen() {
    if (!open) {
      setOpen(true);
      void loadFully();
    } else {
      setOpen(false);
    }
  }

  function switchTab(t: Tab) {
    setTab(t);
    if (t === "logcat") void loadLogcat();
  }

  const isFully = tab === "fully";
  const loading = isFully ? fullyLoading : logcatLoading;
  const error = isFully ? fullyError : logcatError;
  const text = isFully ? fullyText : logcatText;
  const entries = isFully ? fullyEntries : null;

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
        Device Logs
      </button>

      {open && (
        <div className="border-t">
          <div className="flex border-b">
            {(["fully", "logcat"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => switchTab(t)}
                className={`px-4 py-2 text-xs font-medium capitalize transition-colors ${
                  tab === t
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "fully" ? "Fully Log" : "Logcat"}
              </button>
            ))}
          </div>
          {loading && <div className="p-4"><Skeleton className="h-40 w-full" /></div>}
          {error && <p className="px-4 py-3 text-sm text-destructive">{error}</p>}
          {text !== null && !loading && (
            <LogContent text={text} entries={entries} />
          )}
        </div>
      )}
    </div>
  );
}
