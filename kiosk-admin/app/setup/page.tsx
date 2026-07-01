"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function SetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Redirect if setup already done
  useEffect(() => {
    fetch("/api/auth/setup")
      .then((r) => r.json())
      .then((data) => {
        if (data.configured) router.replace("/login");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 12) { setError("Password must be at least 12 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) { router.replace("/login"); return; }
        setError(data.error ?? "Setup failed");
        return;
      }
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Welcome to Kiosk Admin</h1>
          <p className="text-sm text-muted-foreground">Create your admin account to get started.</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input id="email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input id="password" type="password" required minLength={12} value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <p className="text-xs text-muted-foreground">Minimum 12 characters</p>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="confirm" className="text-sm font-medium">Confirm password</label>
            <input id="confirm" type="password" required value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating account\u2026" : "Create admin account"}
          </Button>
        </form>
      </div>
    </main>
  );
}
