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
