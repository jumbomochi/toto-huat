# Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a dark-themed React SPA with 4 pages (dashboard, frequency, trends, history) consuming a Hono REST API that wraps the existing analysis modules.

**Architecture:** Monorepo with pnpm workspaces. Hono API server added to the existing backend. React SPA in `apps/frontend/` with Vite, Tailwind v4, ShadCn, TanStack Query, Recharts.

**Tech Stack:** React 19, TypeScript, Vite 6, Tailwind CSS v4, ShadCn, Hono, TanStack Query, Recharts, React Router v7

---

## Reference: Existing Code

- **Backend analysis modules** in `apps/backend/src/analysis/`:
  - `frequency.ts` — `getNumberFrequencies()`, `classifyHotCold()`, `getOverdueNumbers()`
  - `distribution.ts` — `chiSquaredUniformityTest()`, `oddEvenDistribution()`, `highLowDistribution()`, `groupDistribution()`
  - `patterns.ts` — `consecutiveAnalysis()`, `sumRangeAnalysis()`, `pairFrequency()`
  - `trends.ts` — `slidingWindowFrequency()`, `trendingNumbers()`
  - `recommend.ts` — `generatePicks()`
- **DB module** (`apps/backend/src/db/index.ts`): `openDb()`, `getAllDraws()`, `getDrawCount()`, `getLatestDrawNumber()`
- **DrawRecord type**: `{ drawNumber, drawDate, numbers: [6-tuple], additional }`
- **Package**: `apps/backend/package.json` — name is `@toto-huat/backend`, uses pnpm, ESM

---

### Task 1: Monorepo setup

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root)
- Modify: `apps/backend/package.json` (update lock path reference)

**Step 1: Create pnpm workspace config**

Create `pnpm-workspace.yaml` at repository root `/Users/huiliang/GitHub/toto-huat/`:

```yaml
packages:
  - "apps/*"
```

**Step 2: Create root package.json**

Create `package.json` at repository root:

```json
{
  "name": "toto-huat",
  "private": true,
  "scripts": {
    "dev:frontend": "pnpm --filter frontend dev",
    "dev:backend": "pnpm --filter @toto-huat/backend dev",
    "dev": "pnpm -r --parallel dev"
  }
}
```

**Step 3: Move backend lockfile and reinstall**

The backend currently has its own `pnpm-lock.yaml`. With a workspace, the lockfile lives at the root.

```bash
cd /Users/huiliang/GitHub/toto-huat
rm apps/backend/pnpm-lock.yaml
pnpm install
```

This creates a root `pnpm-lock.yaml` that manages all workspaces.

**Step 4: Verify backend still works**

```bash
cd /Users/huiliang/GitHub/toto-huat
pnpm --filter @toto-huat/backend test
```

Expected: all 53 tests pass.

**Step 5: Update .github/workflows/ingest.yml**

The workflow currently references `apps/backend/pnpm-lock.yaml` for cache. Update to use root lockfile:

Change `cache-dependency-path: apps/backend/pnpm-lock.yaml` to `cache-dependency-path: pnpm-lock.yaml`.

Change `working-directory: apps/backend` on the install step to work from root, and adjust the install command.

**Step 6: Commit**

```bash
git add pnpm-workspace.yaml package.json pnpm-lock.yaml .github/workflows/ingest.yml
git add -u  # pick up deleted apps/backend/pnpm-lock.yaml
git commit -m "feat: set up pnpm monorepo workspace

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Backend API server

**Files:**
- Create: `apps/backend/src/server.ts`
- Create: `apps/backend/src/server.test.ts`
- Modify: `apps/backend/package.json` (add hono deps + dev script)

**Step 1: Install Hono dependencies**

```bash
cd /Users/huiliang/GitHub/toto-huat
pnpm --filter @toto-huat/backend add hono @hono/node-server
```

**Step 2: Write the failing tests**

Create `apps/backend/src/server.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { app } from "./server.js";

describe("API", () => {
  it("GET /api/frequency returns frequency data", async () => {
    const res = await app.request("/api/frequency");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("frequencies");
    expect(data).toHaveProperty("hotCold");
    expect(data).toHaveProperty("overdue");
    expect(data.frequencies).toHaveProperty("main");
    expect(data.frequencies).toHaveProperty("totalDraws");
  });

  it("GET /api/distribution returns distribution data", async () => {
    const res = await app.request("/api/distribution");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("chiSquared");
    expect(data).toHaveProperty("oddEven");
    expect(data).toHaveProperty("highLow");
    expect(data).toHaveProperty("groups");
  });

  it("GET /api/patterns returns pattern data", async () => {
    const res = await app.request("/api/patterns");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("consecutive");
    expect(data).toHaveProperty("sumRange");
    expect(data).toHaveProperty("pairs");
  });

  it("GET /api/trends returns trend data", async () => {
    const res = await app.request("/api/trends");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.trending)).toBe(true);
    expect(data).toHaveProperty("windowSize");
  });

  it("GET /api/trends accepts window query param", async () => {
    const res = await app.request("/api/trends?window=10");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.windowSize).toBe(10);
  });

  it("GET /api/recommend returns recommendation", async () => {
    const res = await app.request("/api/recommend");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.numbers).toHaveLength(6);
    expect(data).toHaveProperty("scores");
    expect(data).toHaveProperty("reasoning");
    expect(data).toHaveProperty("warnings");
  });

  it("GET /api/draws returns paginated draws", async () => {
    const res = await app.request("/api/draws?page=1&limit=5");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("draws");
    expect(data).toHaveProperty("total");
    expect(data.draws.length).toBeLessThanOrEqual(5);
  });
});
```

**Step 3: Run tests to verify they fail**

```bash
pnpm --filter @toto-huat/backend test src/server.test.ts
```

Expected: FAIL (module not found).

**Step 4: Implement the API server**

Create `apps/backend/src/server.ts`:

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { openDb, getAllDraws, getDrawCount } from "./db/index.js";
import { getNumberFrequencies, classifyHotCold, getOverdueNumbers } from "./analysis/frequency.js";
import { chiSquaredUniformityTest, oddEvenDistribution, highLowDistribution, groupDistribution } from "./analysis/distribution.js";
import { consecutiveAnalysis, sumRangeAnalysis, pairFrequency } from "./analysis/patterns.js";
import { trendingNumbers } from "./analysis/trends.js";
import { generatePicks } from "./analysis/recommend.js";
import type { DrawRecord } from "./db/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "..", "data", "toto.db");

function withDraws<T>(fn: (draws: DrawRecord[]) => T): T {
  const db = openDb(DB_PATH);
  try {
    const draws = getAllDraws(db);
    return fn(draws);
  } finally {
    db.close();
  }
}

export const app = new Hono();

app.use("/api/*", cors({ origin: "*" }));

app.get("/api/frequency", (c) => {
  return c.json(withDraws((draws) => {
    const frequencies = getNumberFrequencies(draws);
    const hotCold = classifyHotCold(frequencies);
    const overdue = getOverdueNumbers(draws);
    return { frequencies, hotCold, overdue };
  }));
});

app.get("/api/distribution", (c) => {
  return c.json(withDraws((draws) => {
    const chiSquared = chiSquaredUniformityTest(draws);
    const oddEven = oddEvenDistribution(draws);
    const highLow = highLowDistribution(draws);
    const groups = groupDistribution(draws);
    return { chiSquared, oddEven, highLow, groups };
  }));
});

app.get("/api/patterns", (c) => {
  return c.json(withDraws((draws) => {
    const consecutive = consecutiveAnalysis(draws);
    const sumRange = sumRangeAnalysis(draws);
    const pairs = pairFrequency(draws, 10);
    return { consecutive, sumRange, pairs };
  }));
});

app.get("/api/trends", (c) => {
  const window = parseInt(c.req.query("window") || "20", 10);
  return c.json(withDraws((draws) => {
    const windowSize = Math.min(window, Math.floor(draws.length / 2));
    const trending = trendingNumbers(draws, windowSize);
    return { trending, windowSize };
  }));
});

app.get("/api/recommend", (c) => {
  return c.json(withDraws((draws) => generatePicks(draws)));
});

app.get("/api/draws", (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "20", 10)));

  const db = openDb(DB_PATH);
  try {
    const total = getDrawCount(db);
    const draws = getAllDraws(db);
    const start = (page - 1) * limit;
    const paginated = draws.reverse().slice(start, start + limit);
    return c.json({ draws: paginated, total, page, limit });
  } finally {
    db.close();
  }
});
```

**Step 5: Add dev script to backend package.json**

Add to `apps/backend/package.json` scripts:

```json
"dev": "tsx watch src/serve.ts"
```

Create `apps/backend/src/serve.ts` (entry point that starts the HTTP server):

```typescript
import { serve } from "@hono/node-server";
import { app } from "./server.js";

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`API server running at http://localhost:${info.port}`);
});
```

**Step 6: Run tests to verify they pass**

```bash
pnpm --filter @toto-huat/backend test src/server.test.ts
```

Expected: all 7 tests PASS.

**Step 7: Run ALL backend tests**

```bash
pnpm --filter @toto-huat/backend test
```

Expected: all 60 tests pass (53 existing + 7 new).

**Step 8: Commit**

```bash
cd /Users/huiliang/GitHub/toto-huat
git add apps/backend/src/server.ts apps/backend/src/server.test.ts apps/backend/src/serve.ts apps/backend/package.json pnpm-lock.yaml
git commit -m "feat: add Hono REST API server for analysis data

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Scaffold frontend with Vite + React + TypeScript

**Files:**
- Create: `apps/frontend/` (entire Vite scaffold)

**Step 1: Scaffold with Vite**

```bash
cd /Users/huiliang/GitHub/toto-huat
pnpm create vite@latest apps/frontend --template react-ts
```

**Step 2: Update frontend package.json name**

Edit `apps/frontend/package.json` — change the `name` field to `"frontend"` (to match the filter in root scripts).

**Step 3: Install frontend dependencies from workspace root**

```bash
cd /Users/huiliang/GitHub/toto-huat
pnpm install
```

**Step 4: Verify Vite works**

```bash
pnpm --filter frontend dev
```

Expected: Vite dev server starts at `http://localhost:5173`. Stop it after verifying.

**Step 5: Commit**

```bash
cd /Users/huiliang/GitHub/toto-huat
git add apps/frontend/ pnpm-lock.yaml
git commit -m "feat: scaffold frontend with Vite + React + TypeScript

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Tailwind v4 + ShadCn + dark mode setup

**Files:**
- Modify: `apps/frontend/vite.config.ts`
- Modify: `apps/frontend/tsconfig.json`
- Modify: `apps/frontend/tsconfig.app.json`
- Modify: `apps/frontend/src/index.css`
- Modify: `apps/frontend/index.html` (add `class="dark"`)
- Create: `apps/frontend/components.json` (via shadcn init)
- Create: `apps/frontend/src/lib/utils.ts` (via shadcn init)

**Step 1: Install Tailwind v4**

```bash
cd /Users/huiliang/GitHub/toto-huat
pnpm --filter frontend add tailwindcss @tailwindcss/vite
```

**Step 2: Configure Vite**

Replace `apps/frontend/vite.config.ts`:

```typescript
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

**Step 3: Configure TypeScript path aliases**

Add to `apps/frontend/tsconfig.json` under `compilerOptions`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Add the same `baseUrl` and `paths` to `apps/frontend/tsconfig.app.json` under `compilerOptions`.

**Step 4: Install @types/node**

```bash
pnpm --filter frontend add -D @types/node
```

**Step 5: Initialize ShadCn**

```bash
cd /Users/huiliang/GitHub/toto-huat/apps/frontend
pnpm dlx shadcn@latest init
```

When prompted:
- Style: **New York**
- Base color: **Zinc**
- CSS variables: **Yes**

This will modify `src/index.css` with dark mode CSS variables and create `src/lib/utils.ts`.

**Step 6: Set permanent dark mode**

Edit `apps/frontend/index.html` — add `class="dark"` to the `<html>` tag:

```html
<html lang="en" class="dark">
```

**Step 7: Add ShadCn components**

```bash
cd /Users/huiliang/GitHub/toto-huat/apps/frontend
pnpm dlx shadcn@latest add button card table badge tabs skeleton separator
```

**Step 8: Clean up default Vite files**

- Delete `apps/frontend/src/App.css`
- Delete `apps/frontend/src/assets/react.svg`
- Delete `apps/frontend/public/vite.svg`
- Replace `apps/frontend/src/App.tsx` with a minimal placeholder:

```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <h1 className="text-2xl font-bold p-8">Toto Huat</h1>
    </div>
  )
}
```

**Step 9: Verify**

```bash
cd /Users/huiliang/GitHub/toto-huat
pnpm --filter frontend dev
```

Expected: Dark background, white "Toto Huat" text. Stop after verifying.

**Step 10: Commit**

```bash
cd /Users/huiliang/GitHub/toto-huat
git add apps/frontend/
git commit -m "feat: set up Tailwind v4 + ShadCn + dark mode

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Routing + layout + data fetching setup

**Files:**
- Modify: `apps/frontend/src/main.tsx`
- Modify: `apps/frontend/src/App.tsx`
- Create: `apps/frontend/src/lib/api.ts`
- Create: `apps/frontend/src/components/layout.tsx`
- Create: `apps/frontend/src/pages/dashboard.tsx`
- Create: `apps/frontend/src/pages/frequency.tsx`
- Create: `apps/frontend/src/pages/trends.tsx`
- Create: `apps/frontend/src/pages/history.tsx`

**Step 1: Install routing + data fetching deps**

```bash
cd /Users/huiliang/GitHub/toto-huat
pnpm --filter frontend add react-router @tanstack/react-query
```

**Step 2: Create API client**

Create `apps/frontend/src/lib/api.ts`:

```typescript
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  frequency: () => fetchJSON<FrequencyResponse>("/api/frequency"),
  distribution: () => fetchJSON<DistributionResponse>("/api/distribution"),
  patterns: () => fetchJSON<PatternsResponse>("/api/patterns"),
  trends: (window = 20) => fetchJSON<TrendsResponse>(`/api/trends?window=${window}`),
  recommend: () => fetchJSON<RecommendResponse>("/api/recommend"),
  draws: (page = 1, limit = 20) => fetchJSON<DrawsResponse>(`/api/draws?page=${page}&limit=${limit}`),
};

// Response types matching backend API
export interface FrequencyResponse {
  frequencies: { main: Record<string, number>; additional: Record<string, number>; totalDraws: number };
  hotCold: { hot: number[]; cold: number[]; neutral: number[]; expectedFrequency: number };
  overdue: { number: number; lastSeenDraw: number | null; drawsSinceLastSeen: number }[];
}

export interface DistributionResponse {
  chiSquared: { statistic: number; pValue: number; degreesOfFreedom: number; isSignificant: boolean; sampleSizeWarning: boolean };
  oddEven: { averageOdd: number; averageEven: number };
  highLow: { averageHigh: number; averageLow: number };
  groups: { groups: { label: string; range: [number, number]; count: number; expected: number }[]; totalNumbers: number };
}

export interface PatternsResponse {
  consecutive: { drawsWithConsecutive: number; totalDraws: number; percentage: number };
  sumRange: { min: number; max: number; average: number };
  pairs: { pair: [number, number]; count: number }[];
}

export interface TrendsResponse {
  trending: { number: number; direction: "up" | "down"; windowFrequency: number; overallFrequency: number; deviation: number }[];
  windowSize: number;
}

export interface RecommendResponse {
  numbers: [number, number, number, number, number, number];
  scores: { number: number; score: number; factors: string[] }[];
  reasoning: string[];
  warnings: string[];
}

export interface DrawsResponse {
  draws: { drawNumber: number; drawDate: string; numbers: [number, number, number, number, number, number]; additional: number }[];
  total: number;
  page: number;
  limit: number;
}
```

**Step 3: Set up main.tsx with providers**

Replace `apps/frontend/src/main.tsx`:

```tsx
import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import App from "./App"
import "./index.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
```

**Step 4: Create layout component**

Create `apps/frontend/src/components/layout.tsx`:

```tsx
import { Link, useLocation } from "react-router"
import { cn } from "@/lib/utils"

const navItems = [
  { path: "/", label: "Dashboard", icon: "🎯" },
  { path: "/frequency", label: "Frequency", icon: "📊" },
  { path: "/trends", label: "Trends", icon: "📈" },
  { path: "/history", label: "History", icon: "📋" },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="w-64 border-r border-border p-4 hidden md:block">
        <h1 className="text-xl font-bold mb-8 px-2">Toto Huat</h1>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                pathname === item.path
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-background z-50">
        <nav className="flex justify-around p-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 rounded-md text-xs",
                pathname === item.path ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="flex-1 p-6 md:p-8 overflow-auto pb-20 md:pb-8">
        {children}
      </main>
    </div>
  )
}
```

**Step 5: Create placeholder pages**

Create `apps/frontend/src/pages/dashboard.tsx`:

```tsx
export default function DashboardPage() {
  return <h2 className="text-2xl font-bold">Dashboard</h2>
}
```

Create `apps/frontend/src/pages/frequency.tsx`:

```tsx
export default function FrequencyPage() {
  return <h2 className="text-2xl font-bold">Frequency Explorer</h2>
}
```

Create `apps/frontend/src/pages/trends.tsx`:

```tsx
export default function TrendsPage() {
  return <h2 className="text-2xl font-bold">Trends & Patterns</h2>
}
```

Create `apps/frontend/src/pages/history.tsx`:

```tsx
export default function HistoryPage() {
  return <h2 className="text-2xl font-bold">Draw History</h2>
}
```

**Step 6: Wire up App.tsx with routes**

Replace `apps/frontend/src/App.tsx`:

```tsx
import { Routes, Route } from "react-router"
import { Layout } from "@/components/layout"
import DashboardPage from "@/pages/dashboard"
import FrequencyPage from "@/pages/frequency"
import TrendsPage from "@/pages/trends"
import HistoryPage from "@/pages/history"

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/frequency" element={<FrequencyPage />} />
        <Route path="/trends" element={<TrendsPage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </Layout>
  )
}
```

**Step 7: Verify**

Start both backend and frontend:

```bash
# Terminal 1
pnpm --filter @toto-huat/backend dev

# Terminal 2
pnpm --filter frontend dev
```

Expected: Dark-themed app at `http://localhost:5173` with sidebar navigation. Clicking nav items changes pages. Mobile view shows bottom tab bar.

**Step 8: Commit**

```bash
cd /Users/huiliang/GitHub/toto-huat
git add apps/frontend/
git commit -m "feat: add routing, layout, API client, placeholder pages

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Dashboard page

**Files:**
- Modify: `apps/frontend/src/pages/dashboard.tsx`
- Create: `apps/frontend/src/components/number-ball.tsx`

**Step 1: Create number ball component**

Create `apps/frontend/src/components/number-ball.tsx`:

```tsx
import { cn } from "@/lib/utils"

interface NumberBallProps {
  number: number
  variant?: "default" | "hot" | "cold" | "additional"
  size?: "sm" | "md" | "lg"
}

export function NumberBall({ number, variant = "default", size = "md" }: NumberBallProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold",
        size === "sm" && "h-8 w-8 text-xs",
        size === "md" && "h-10 w-10 text-sm",
        size === "lg" && "h-14 w-14 text-lg",
        variant === "default" && "bg-zinc-700 text-zinc-100",
        variant === "hot" && "bg-amber-600 text-white",
        variant === "cold" && "bg-blue-600 text-white",
        variant === "additional" && "bg-emerald-600 text-white",
      )}
    >
      {number}
    </span>
  )
}
```

**Step 2: Implement dashboard page**

Replace `apps/frontend/src/pages/dashboard.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { NumberBall } from "@/components/number-ball"

export default function DashboardPage() {
  const { data: rec, isLoading: recLoading } = useQuery({
    queryKey: ["recommend"],
    queryFn: api.recommend,
  })
  const { data: freq, isLoading: freqLoading } = useQuery({
    queryKey: ["frequency"],
    queryFn: api.frequency,
  })
  const { data: dist, isLoading: distLoading } = useQuery({
    queryKey: ["distribution"],
    queryFn: api.distribution,
  })
  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ["trends"],
    queryFn: () => api.trends(20),
  })

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      {/* Recommended picks */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Numbers</CardTitle>
        </CardHeader>
        <CardContent>
          {recLoading ? (
            <div className="flex gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-14 rounded-full" />
              ))}
            </div>
          ) : rec ? (
            <>
              <div className="flex gap-3 mb-4">
                {rec.numbers.map((n) => (
                  <NumberBall key={n} number={n} variant="hot" size="lg" />
                ))}
              </div>
              {rec.warnings.length > 0 && (
                <p className="text-sm text-muted-foreground mb-2">{rec.warnings[0]}</p>
              )}
              <div className="space-y-1">
                {rec.reasoning.map((r, i) => (
                  <p key={i} className="text-sm text-muted-foreground">{r}</p>
                ))}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Draws</p>
            {freqLoading ? <Skeleton className="h-8 w-20 mt-1" /> : (
              <p className="text-2xl font-bold">{freq?.frequencies.totalDraws.toLocaleString()}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Bias Detected</p>
            {distLoading ? <Skeleton className="h-8 w-20 mt-1" /> : (
              <Badge variant={dist?.chiSquared.isSignificant ? "destructive" : "secondary"}>
                {dist?.chiSquared.isSignificant ? "Yes" : "No"}
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Hot Numbers</p>
            {freqLoading ? <Skeleton className="h-8 w-20 mt-1" /> : (
              <p className="text-2xl font-bold">{freq?.hotCold.hot.length}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Trending Up</p>
            {trendsLoading ? <Skeleton className="h-8 w-20 mt-1" /> : (
              <p className="text-2xl font-bold">
                {trends?.trending.filter((t) => t.direction === "up").length}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hot & Cold numbers */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Hot Numbers</CardTitle>
          </CardHeader>
          <CardContent>
            {freqLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {freq?.hotCold.hot.map((n) => (
                  <NumberBall key={n} number={n} variant="hot" size="sm" />
                ))}
                {freq?.hotCold.hot.length === 0 && (
                  <p className="text-sm text-muted-foreground">None</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Most Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            {freqLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <div className="space-y-2">
                {freq?.overdue.slice(0, 5).map((o) => (
                  <div key={o.number} className="flex items-center justify-between">
                    <NumberBall number={o.number} variant="cold" size="sm" />
                    <span className="text-sm text-muted-foreground">
                      {o.drawsSinceLastSeen} draws ago
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

**Step 3: Verify**

Start both backend and frontend. Dashboard should show recommended numbers, stat cards, hot/cold grids.

**Step 4: Commit**

```bash
cd /Users/huiliang/GitHub/toto-huat
git add apps/frontend/src/
git commit -m "feat: implement dashboard page with recommendations and stats

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Frequency explorer page

**Files:**
- Modify: `apps/frontend/src/pages/frequency.tsx`
- Create: `apps/frontend/src/components/number-grid.tsx`

**Step 1: Create number grid component**

Create `apps/frontend/src/components/number-grid.tsx`:

```tsx
import { cn } from "@/lib/utils"

interface NumberGridProps {
  frequencies: Record<string, number>
  hotNumbers: number[]
  coldNumbers: number[]
  maxFrequency: number
}

export function NumberGrid({ frequencies, hotNumbers, coldNumbers, maxFrequency }: NumberGridProps) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 49 }, (_, i) => i + 1).map((n) => {
        const count = frequencies[String(n)] || 0
        const intensity = maxFrequency > 0 ? count / maxFrequency : 0
        const isHot = hotNumbers.includes(n)
        const isCold = coldNumbers.includes(n)

        return (
          <div
            key={n}
            className={cn(
              "aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-colors",
              isHot && "bg-amber-600/80 text-white",
              isCold && "bg-blue-600/80 text-white",
              !isHot && !isCold && "text-zinc-300",
            )}
            style={
              !isHot && !isCold
                ? { backgroundColor: `rgba(161, 161, 170, ${0.1 + intensity * 0.5})` }
                : undefined
            }
          >
            <span className="font-bold">{n}</span>
            <span className="text-[10px] opacity-75">{count}</span>
          </div>
        )
      })}
    </div>
  )
}
```

**Step 2: Implement frequency page**

Replace `apps/frontend/src/pages/frequency.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { NumberGrid } from "@/components/number-grid"
import { NumberBall } from "@/components/number-ball"

export default function FrequencyPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["frequency"],
    queryFn: api.frequency,
  })

  if (isLoading) return <FrequencySkeleton />
  if (!data) return null

  const maxFreq = Math.max(...Object.values(data.frequencies.main))

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Frequency Explorer</h2>

      <Card>
        <CardHeader>
          <CardTitle>Number Frequency Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <NumberGrid
            frequencies={data.frequencies.main}
            hotNumbers={data.hotCold.hot}
            coldNumbers={data.hotCold.cold}
            maxFrequency={maxFreq}
          />
          <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-amber-600" /> Hot
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-blue-600" /> Cold
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-zinc-500" /> Neutral
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Hot Numbers ({data.hotCold.hot.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.hotCold.hot.map((n) => (
                <NumberBall key={n} number={n} variant="hot" size="sm" />
              ))}
              {data.hotCold.hot.length === 0 && (
                <p className="text-sm text-muted-foreground">None at current threshold</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cold Numbers ({data.hotCold.cold.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.hotCold.cold.map((n) => (
                <NumberBall key={n} number={n} variant="cold" size="sm" />
              ))}
              {data.hotCold.cold.length === 0 && (
                <p className="text-sm text-muted-foreground">None at current threshold</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Most Overdue Numbers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.overdue.slice(0, 15).map((o) => (
              <div key={o.number} className="flex items-center gap-4">
                <NumberBall number={o.number} variant="cold" size="sm" />
                <div className="flex-1">
                  <div
                    className="h-2 rounded bg-blue-600/60"
                    style={{ width: `${Math.min(100, (o.drawsSinceLastSeen / 50) * 100)}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-24 text-right">
                  {o.drawsSinceLastSeen} draws
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FrequencySkeleton() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Frequency Explorer</h2>
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 3: Verify**

Visit `http://localhost:5173/frequency`. Should show a 7x7 heatmap grid, hot/cold cards, and overdue bar chart.

**Step 4: Commit**

```bash
cd /Users/huiliang/GitHub/toto-huat
git add apps/frontend/src/
git commit -m "feat: implement frequency explorer page with heatmap grid

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Trends & patterns page

**Files:**
- Modify: `apps/frontend/src/pages/trends.tsx`

**Step 1: Install Recharts**

```bash
cd /Users/huiliang/GitHub/toto-huat
pnpm --filter frontend add recharts
```

**Step 2: Implement trends page**

Replace `apps/frontend/src/pages/trends.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { NumberBall } from "@/components/number-ball"

export default function TrendsPage() {
  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ["trends"],
    queryFn: () => api.trends(20),
  })
  const { data: patterns, isLoading: patternsLoading } = useQuery({
    queryKey: ["patterns"],
    queryFn: api.patterns,
  })
  const { data: dist, isLoading: distLoading } = useQuery({
    queryKey: ["distribution"],
    queryFn: api.distribution,
  })

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Trends & Patterns</h2>

      {/* Trending numbers */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Trending Up</CardTitle>
          </CardHeader>
          <CardContent>
            {trendsLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-2">
                {trends?.trending
                  .filter((t) => t.direction === "up")
                  .slice(0, 10)
                  .map((t) => (
                    <div key={t.number} className="flex items-center gap-3">
                      <NumberBall number={t.number} variant="hot" size="sm" />
                      <div className="flex-1 text-sm">
                        <span className="text-muted-foreground">
                          {(t.windowFrequency * 100).toFixed(0)}% recent vs{" "}
                          {(t.overallFrequency * 100).toFixed(0)}% overall
                        </span>
                      </div>
                      <Badge variant="secondary">+{(t.deviation * 100).toFixed(0)}%</Badge>
                    </div>
                  ))}
                {trends?.trending.filter((t) => t.direction === "up").length === 0 && (
                  <p className="text-sm text-muted-foreground">No numbers trending up</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Trending Down</CardTitle>
          </CardHeader>
          <CardContent>
            {trendsLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-2">
                {trends?.trending
                  .filter((t) => t.direction === "down")
                  .slice(0, 10)
                  .map((t) => (
                    <div key={t.number} className="flex items-center gap-3">
                      <NumberBall number={t.number} variant="cold" size="sm" />
                      <div className="flex-1 text-sm">
                        <span className="text-muted-foreground">
                          {(t.windowFrequency * 100).toFixed(0)}% recent vs{" "}
                          {(t.overallFrequency * 100).toFixed(0)}% overall
                        </span>
                      </div>
                      <Badge variant="outline">{(t.deviation * 100).toFixed(0)}%</Badge>
                    </div>
                  ))}
                {trends?.trending.filter((t) => t.direction === "down").length === 0 && (
                  <p className="text-sm text-muted-foreground">No numbers trending down</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Group distribution chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Number Group Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {distLoading ? <Skeleton className="h-48 w-full" /> : dist ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dist.groups.groups}>
                <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} />
                <YAxis stroke="#a1a1aa" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#27272a", border: "1px solid #3f3f46", borderRadius: "8px" }}
                  labelStyle={{ color: "#fafafa" }}
                  itemStyle={{ color: "#a1a1aa" }}
                />
                <Bar dataKey="count" name="Actual" radius={[4, 4, 0, 0]}>
                  {dist.groups.groups.map((_, i) => (
                    <Cell key={i} fill="#f59e0b" />
                  ))}
                </Bar>
                <Bar dataKey="expected" name="Expected" fill="#3f3f46" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </CardContent>
      </Card>

      {/* Pattern stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Draws with Consecutive Numbers</p>
            {patternsLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (
              <p className="text-2xl font-bold">{patterns?.consecutive.percentage.toFixed(1)}%</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Average Sum of 6 Numbers</p>
            {patternsLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (
              <p className="text-2xl font-bold">{patterns?.sumRange.average.toFixed(0)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Sum Range</p>
            {patternsLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (
              <p className="text-2xl font-bold">{patterns?.sumRange.min} — {patterns?.sumRange.max}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top pairs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Co-occurring Pairs</CardTitle>
        </CardHeader>
        <CardContent>
          {patternsLoading ? <Skeleton className="h-32 w-full" /> : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {patterns?.pairs.map((p, i) => (
                <div key={i} className="flex items-center gap-2 bg-zinc-800/50 rounded-lg p-3">
                  <NumberBall number={p.pair[0]} size="sm" />
                  <NumberBall number={p.pair[1]} size="sm" />
                  <span className="text-sm text-muted-foreground ml-auto">{p.count}x</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 3: Verify**

Visit `http://localhost:5173/trends`. Should show trending up/down lists, group distribution bar chart, pattern stats, and top pairs.

**Step 4: Commit**

```bash
cd /Users/huiliang/GitHub/toto-huat
git add apps/frontend/ pnpm-lock.yaml
git commit -m "feat: implement trends & patterns page with charts

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Draw history page

**Files:**
- Modify: `apps/frontend/src/pages/history.tsx`

**Step 1: Implement history page**

Replace `apps/frontend/src/pages/history.tsx`:

```tsx
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { NumberBall } from "@/components/number-ball"

export default function HistoryPage() {
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, isLoading } = useQuery({
    queryKey: ["draws", page],
    queryFn: () => api.draws(page, limit),
  })

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Draw History</h2>
        {data && (
          <p className="text-sm text-muted-foreground">{data.total.toLocaleString()} total draws</p>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {data?.draws.map((draw) => (
                <div
                  key={draw.drawNumber}
                  className="flex items-center gap-4 py-2 border-b border-border last:border-0"
                >
                  <div className="w-16 text-sm font-mono text-muted-foreground">
                    #{draw.drawNumber}
                  </div>
                  <div className="w-24 text-sm text-muted-foreground">
                    {draw.drawDate}
                  </div>
                  <div className="flex gap-1.5 flex-1">
                    {draw.numbers.map((n, i) => (
                      <NumberBall key={i} number={n} size="sm" />
                    ))}
                    <span className="mx-1 text-muted-foreground">+</span>
                    <NumberBall number={draw.additional} variant="additional" size="sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify**

Visit `http://localhost:5173/history`. Should show paginated draw history with colored number balls and pagination controls.

**Step 3: Commit**

```bash
cd /Users/huiliang/GitHub/toto-huat
git add apps/frontend/src/
git commit -m "feat: implement draw history page with pagination

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Final polish and verification

**Step 1: Run all backend tests**

```bash
pnpm --filter @toto-huat/backend test
```

Expected: all tests pass (53 existing + 7 server tests).

**Step 2: Start both services and do full walkthrough**

```bash
# Terminal 1
pnpm --filter @toto-huat/backend dev

# Terminal 2
pnpm --filter frontend dev
```

Walk through all 4 pages:
- Dashboard: recommended numbers shown, stat cards populated, hot/cold grids render
- Frequency: 7x7 heatmap renders, hot/cold badges, overdue bars
- Trends: trending up/down lists, bar chart renders, pattern stats, top pairs
- History: draws listed with number balls, pagination works

**Step 3: Build frontend to verify production build**

```bash
pnpm --filter frontend build
```

Expected: build succeeds with no TypeScript errors.

**Step 4: Final commit if any adjustments were made**

```bash
cd /Users/huiliang/GitHub/toto-huat
git add -A
git commit -m "chore: final frontend polish

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
