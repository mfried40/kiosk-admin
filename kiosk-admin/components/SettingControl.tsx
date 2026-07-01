"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { SettingDef } from "@/lib/settings-schema-types";

interface SettingControlProps {
  def: SettingDef;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}

export function SettingControl({
  def,
  value,
  onChange,
  disabled,
  id,
}: SettingControlProps) {
  if (def.type === "boolean") {
    return (
      <Switch
        id={id}
        checked={value === "true"}
        onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
        disabled={disabled}
      />
    );
  }

  if (def.type === "select" && def.options) {
    return (
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
      >
        {def.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (def.type === "multiline") {
    return (
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={4}
        className="font-mono text-sm resize-y"
        placeholder={def.description}
      />
    );
  }

  if (def.type === "color") {
    return (
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="#RRGGBB or AARRGGBB"
          className="font-mono"
        />
        {value && /^#?[0-9a-fA-F]{6,8}$/.test(value) && (
          <span
            className="h-7 w-7 rounded border border-input flex-shrink-0"
            style={{
              background: value.startsWith("#") ? value.slice(-6).padStart(6, "0") ? `#${value.slice(-6)}` : undefined : `#${value.slice(-6)}`,
            }}
          />
        )}
      </div>
    );
  }

  if (def.type === "password") {
    return (
      <Input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoComplete="new-password"
      />
    );
  }

  if (def.type === "number") {
    return (
      <Input
        id={id}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min={def.min}
        max={def.max}
        className="w-32"
      />
    );
  }

  // string, url — default text input
  return (
    <Input
      id={id}
      type={def.type === "url" ? "url" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={def.description}
    />
  );
}
