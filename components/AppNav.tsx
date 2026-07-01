"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Monitor, Layers, Tag, Settings, LogOut, FileCode, ClipboardList } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Devices", icon: Monitor },
  { href: "/groups", label: "Groups", icon: Layers },
  { href: "/tags", label: "Tags", icon: Tag },
  { href: "/templates", label: "Templates", icon: FileCode },
  { href: "/audit", label: "Audit Log", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 flex-col border-r bg-sidebar px-3 py-4">
      <div className="mb-6 px-2">
        <span className="text-lg font-bold tracking-tight text-sidebar-foreground">Kiosk Admin</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center justify-between border-t border-sidebar-border pt-3">
        <NotificationBell />
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
