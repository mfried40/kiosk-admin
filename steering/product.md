# Product — Kiosk Admin

## What it is
Kiosk Admin is a self-hosted web application that lets a team manage a fleet of Android kiosk devices from a single dashboard. Devices run kiosk software (e.g. Fully Kiosk Browser, Free Kiosk) that exposes a REST API for remote control.

## Who uses it
- **IT admin (ADMIN role)** — configures devices, sends commands, manages templates and alerts.
- **Technician (VIEWER role)** — monitors device status and takes screenshots; cannot send commands or change settings.

## Core value proposition
1. One place to see all devices — online/offline, battery, screen state, current URL.
2. Send commands to one device or hundreds at once.
3. Abstract away provider differences — the same UI works regardless of whether a device runs Fully Kiosk or another provider.
4. Zero-config default — runs on SQLite out of the box; upgrade to Postgres or Mongo when needed.

## Non-goals
- Not a replacement for Fully Cloud EMM (no enterprise device provisioning).
- Not a mobile app.
- Not multi-tenant.
