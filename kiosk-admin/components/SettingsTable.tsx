"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SettingControl } from "@/components/SettingControl";
import {
  SETTINGS_SCHEMA,
  ALL_CATEGORIES,
  type SettingCategory,
} from "@/lib/settings-schema";

interface SettingsTableProps {
  /** Current flat key→value map from the device */
  values: Record<string, string>;
  /** Called when a setting value is changed (key, newValue) */
  onChange: (key: string, value: string) => void;
  /** Keys that are currently being saved */
  savingKeys?: Set<string>;
  /** Whether all controls should be disabled */
  disabled?: boolean;
}

type TabId = "All" | SettingCategory;

export function SettingsTable({
  values,
  onChange,
  savingKeys = new Set(),
  disabled,
}: SettingsTableProps) {
  const [activeTab, setActiveTab] = useState<TabId>("All");
  const [search, setSearch] = useState("");

  // Determine which categories have at least one matching setting in the current values
  const populatedCategories = useMemo<Set<SettingCategory>>(() => {
    const cats = new Set<SettingCategory>();
    for (const def of SETTINGS_SCHEMA) {
      if (def.key in values) cats.add(def.category);
    }
    return cats;
  }, [values]);

  const filteredSettings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SETTINGS_SCHEMA.filter((def) => {
      if (!(def.key in values)) return false;
      if (activeTab !== "All" && def.category !== activeTab) return false;
      if (q) {
        return (
          def.key.toLowerCase().includes(q) ||
          def.label.toLowerCase().includes(q) ||
          (def.description?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [values, activeTab, search]);

  const tabs: TabId[] = useMemo(
    () => ["All", ...ALL_CATEGORIES.filter((c) => populatedCategories.has(c))],
    [populatedCategories]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <Input
        placeholder="Search settings…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors " +
              (activeTab === tab
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70")
            }
          >
            {tab}
          </button>
        ))}
      </div>

      <Separator />

      {/* Settings list */}
      {filteredSettings.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {search ? "No settings match your search." : "No settings loaded for this category."}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {filteredSettings.map((def) => {
            const inputId = `setting-${def.key}`;
            const isSaving = savingKeys.has(def.key);
            return (
              <div key={def.key} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[1fr_auto]">
                <div className="flex flex-col gap-1">
                  <Label htmlFor={inputId} className="flex items-center gap-2 font-medium">
                    {def.label}
                    {def.plusOnly && (
                      <Badge variant="secondary" className="text-xs">Plus</Badge>
                    )}
                    {def.securityWarning && (
                      <Badge variant="destructive" className="text-xs">Security risk</Badge>
                    )}
                    {isSaving && (
                      <span className="text-xs text-muted-foreground">saving…</span>
                    )}
                  </Label>
                  {def.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {def.description}
                    </p>
                  )}
                  <code className="text-xs text-muted-foreground font-mono">{def.key}</code>
                </div>
                <div className="sm:self-center min-w-0 sm:min-w-[220px]">
                  <SettingControl
                    def={def}
                    id={inputId}
                    value={values[def.key] ?? ""}
                    onChange={(v) => onChange(def.key, v)}
                    disabled={disabled || isSaving}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
