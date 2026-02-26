import { describe, it, expect } from "vitest";
import { buildDrawUrl, encodeDrawNumber } from "./fetcher.js";

describe("fetcher utilities", () => {
  it("encodes draw number to base64", () => {
    expect(encodeDrawNumber(4159)).toBe("RHJhd051bWJlcj00MTU5");
  });

  it("encodes draw number 1195", () => {
    expect(encodeDrawNumber(1195)).toBe("RHJhd051bWJlcj0xMTk1");
  });

  it("builds correct URL", () => {
    const url = buildDrawUrl(4159);
    expect(url).toBe(
      "https://www.singaporepools.com.sg/en/product/sr/Pages/toto_results.aspx?sppl=RHJhd051bWJlcj00MTU5"
    );
  });
});
