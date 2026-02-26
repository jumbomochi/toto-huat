const BASE_URL = "https://www.singaporepools.com.sg/en/product/sr/Pages/toto_results.aspx";
const TOP_DRAWS_URL = "https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/toto_result_top_draws_en.html";

export function encodeDrawNumber(drawNumber: number): string {
  return Buffer.from(`DrawNumber=${drawNumber}`).toString("base64");
}

export function buildDrawUrl(drawNumber: number): string {
  return `${BASE_URL}?sppl=${encodeDrawNumber(drawNumber)}`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchDrawHtml(
  drawNumber: number,
  retries = 3,
): Promise<string> {
  const url = buildDrawUrl(drawNumber);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = 1000 * Math.pow(2, attempt - 1);
      console.warn(`Fetch draw ${drawNumber} attempt ${attempt} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw new Error("unreachable");
}

export async function fetchTopDrawsHtml(): Promise<string> {
  const res = await fetch(TOP_DRAWS_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching top draws`);
  return await res.text();
}
