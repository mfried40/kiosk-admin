"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import type { DeviceWithRelations, DeviceInfo } from "@/lib/types";
import { Battery, Monitor, Wifi, WifiOff, Settings } from "lucide-react";
import Link from "next/link";

interface DeviceCardProps {
  device: DeviceWithRelations;
  info?: DeviceInfo | null;
  loading?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export function DeviceCard({ device, info, loading, selected, onToggleSelect }: DeviceCardProps) {
  const online = info?.online ?? false;

  return (
    <Card className={`flex flex-col transition-colors ${selected ? "ring-primary ring-2" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {onToggleSelect && (
              <input
                type="checkbox"
                checked={selected ?? false}
                onChange={onToggleSelect}
                onClick={(e) => e.stopPropagation()}
                className="h-3.5 w-3.5 shrink-0 accent-primary cursor-pointer"
                aria-label={`Select ${device.name}`}
              />
            )}
            <CardTitle className="truncate text-base leading-tight">{device.name}</CardTitle>
          </div>
          <Badge variant={online ? "default" : "secondary"} className="shrink-0">
            {online ? (
              <Wifi className="mr-1 h-3 w-3" />
            ) : (
              <WifiOff className="mr-1 h-3 w-3" />
            )}
            {loading ? "…" : online ? "Online" : "Offline"}
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs">
          {device.ipAddress}:{device.port}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {/* Loading skeleton */}
        {loading && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-3">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-3 w-32" />
          </div>
        )}

        {/* Device info row */}
        {!loading && online && info && (
          <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
            {info.batteryLevel !== undefined && (
              <span className="flex items-center gap-1">
                <Battery className="h-3 w-3" />
                {Math.round(info.batteryLevel)}%
              </span>
            )}
            {info.screenOn !== undefined && (
              <span className="flex items-center gap-1">
                <Monitor className="h-3 w-3" />
                {info.screenOn ? "Screen on" : "Screen off"}
              </span>
            )}
            {info.deviceModel && <span>{info.deviceModel}</span>}
          </div>
        )}

        {/* URL */}
        {!loading && online && info?.currentUrl && (
          <p className="text-muted-foreground truncate text-xs" title={info.currentUrl}>
            {info.currentUrl}
          </p>
        )}

        {/* Group */}
        {device.group && (
          <Badge variant="outline" className="w-fit text-xs">
            {device.group.name}
          </Badge>
        )}

        {/* Tags */}
        {device.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {device.tags.map(({ tag }) => (
              <Badge key={tag.id} variant="secondary" className="text-xs">
                {tag.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex gap-2 pt-2">
          <Link
            href={`/devices/${device.id}`}
            className={buttonVariants({ size: "sm", variant: "outline", className: "flex-1" })}
          >
            <Settings className="mr-1 h-3 w-3" />
            Manage
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
