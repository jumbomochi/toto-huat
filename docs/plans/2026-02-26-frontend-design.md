# Frontend Design — Toto Huat

## Overview

Public-facing React SPA with dark theme that visualizes Singapore Toto statistical analysis. Consumes a REST API backed by the existing analysis modules. Four pages: dashboard, frequency explorer, trends & patterns, draw history.

## Architecture

- **Frontend:** React SPA in `apps/frontend/` (Vite + TypeScript + Tailwind v4 + ShadCn)
- **Backend API:** Hono HTTP server in `apps/backend/src/server.ts` wrapping existing analysis functions
- **Monorepo:** Root `pnpm-workspace.yaml` linking `apps/*`
- **Shared types:** Stay in backend for now; frontend defines its own API response types matching the backend interfaces. Extract to `packages/shared/` only when duplication becomes painful.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Theme | Dark mode only | User preference; no toggle needed |
| Data fetching | TanStack Query | Caching, loading states, stale-while-revalidate |
| Charts | Recharts | React-native, good Tailwind integration, bar/line/area out of the box |
| Routing | React Router v7 | Standard, lightweight |
| Backend framework | Hono | Lightweight, TypeScript-native, fast |
| UI components | ShadCn (Radix UI) | Accessible primitives, Tailwind-styled, dark mode support |

## API Endpoints

All endpoints return JSON. No auth. CORS enabled for local dev.

| Endpoint | Returns |
|----------|---------|
| `GET /api/frequency` | NumberFrequencies + HotColdResult + OverdueNumber[] |
| `GET /api/distribution` | ChiSquaredResult + OddEvenResult + HighLowResult + GroupResult |
| `GET /api/patterns` | ConsecutiveResult + SumRangeResult + PairResult[] |
| `GET /api/trends?window=20` | TrendResult[] |
| `GET /api/recommend` | Recommendation |
| `GET /api/draws?page=1&limit=20` | { draws: DrawRecord[], total: number } |

## Pages

### 1. Dashboard (`/`)

Hero card with the 6 recommended numbers. Summary stat cards: total draws analyzed, bias status (significant/not), hot numbers count, trending up count. Quick-glance hot/cold number grid and top 5 overdue numbers.

### 2. Frequency Explorer (`/frequency`)

7x7 number grid (1-49) with heatmap coloring by frequency. Toggle to sortable table view. Hot/cold/neutral badges per number. Overdue numbers ranked list with draws-since-last-seen.

### 3. Trends & Patterns (`/trends`)

Recharts line chart for trending numbers (window frequency vs overall). Bar chart for group distribution (1-10, 11-20, etc). Consecutive numbers percentage stat card. Sum range histogram. Top 10 co-occurring pairs table.

### 4. Draw History (`/history`)

Paginated table of past draw results. Each row: draw number, date, 6 numbers rendered as colored balls, additional number. Filter by number.

## Layout

Sidebar navigation (collapsible on mobile). Dark background using ShadCn dark theme tokens (slate/zinc). Bright accent color (amber or emerald) for number highlights and recommended picks.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Build | Vite 6 |
| Framework | React 19 + TypeScript |
| Routing | React Router v7 |
| UI | ShadCn (Radix UI) |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Data fetching | TanStack Query |
| Backend server | Hono |

## Data Flow

```
Browser → React (TanStack Query) → GET /api/* → Hono server → analysis functions → SQLite → JSON
```

TanStack Query caches with `staleTime` of 5 minutes. Loading skeletons during fetch. Data changes twice a week (Mon/Thu draw ingestion).

## Dark Mode

Tailwind v4 CSS-first config with `@custom-variant dark (&.dark)`. The `dark` class set permanently on `<html>`. ShadCn dark theme tokens for consistent component styling.
