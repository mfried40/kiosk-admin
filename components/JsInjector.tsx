"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";

interface JsInjectorProps {
  deviceId: string;
}

export function JsInjector({ deviceId }: JsInjectorProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/devices/${deviceId}/inject-js`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as { error?: string; result?: unknown };
      if (!res.ok) {
        toast.error(data.error ?? "Injection failed");
      } else {
        toast.success("Script injected");
        if (data.result !== undefined && data.result !== null) {
          setResult(JSON.stringify(data.result, null, 2));
        }
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
        <Textarea
          placeholder={"// Enter JavaScript to run on the device page\ndocument.title = 'Hello from admin';"}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={8}
          className="font-mono text-sm"
        />
        <div>
          <Button
            size="sm"
            variant="outline"
            disabled={!code.trim() || loading}
            onClick={() => void run()}
            className="flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run Script
          </Button>
        </div>
        {result !== null && (
          <div className="flex flex-col gap-1">
            <p className="text-muted-foreground text-xs">Return value:</p>
            <pre className="rounded bg-muted p-2 text-xs overflow-auto max-h-40">{result}</pre>
          </div>
        )}
    </div>
  );
}
