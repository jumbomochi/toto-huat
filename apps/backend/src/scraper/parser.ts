import * as cheerio from "cheerio";
import type { PrizeInput } from "../db/index.js";

export interface ParsedDraw {
  drawNumber: number;
  drawDate: string;
  numbers: [number, number, number, number, number, number];
  additional: number;
  prizes: PrizeInput[];
}

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04",
  May: "05", Jun: "06", Jul: "07", Aug: "08",
  Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function parseDate(raw: string): string | null {
  // Expected format: "Mon, 23 Feb 2026" -> strip day-of-week prefix
  const cleaned = raw.replace(/^[A-Za-z]+,\s*/, "");
  const match = cleaned.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;

  const day = match[1].padStart(2, "0");
  const month = MONTHS[match[2]];
  const year = parseInt(match[3], 10);

  if (!month || year < 1968) return null;

  return `${match[3]}-${month}-${day}`;
}

function parseCurrency(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function parseIntComma(raw: string): number {
  return parseInt(raw.replace(/,/g, ""), 10);
}

export function parseDrawHtml(html: string): ParsedDraw | null {
  if (!html || !html.trim()) return null;

  const $ = cheerio.load(html);

  const drawNumText = $(".drawNumber").first().text().trim();
  const drawNumMatch = drawNumText.match(/(\d+)/);
  if (!drawNumMatch) return null;
  const drawNumber = parseInt(drawNumMatch[1], 10);

  const drawDateText = $(".drawDate").first().text().trim();
  const drawDate = parseDate(drawDateText);
  if (!drawDate) return null;

  const numbers: number[] = [];
  for (let i = 1; i <= 6; i++) {
    const num = parseInt($(`.win${i}`).first().text().trim(), 10);
    if (isNaN(num)) return null;
    numbers.push(num);
  }

  const additional = parseInt($(".additional").first().text().trim(), 10);
  if (isNaN(additional)) return null;

  const prizes: PrizeInput[] = [];
  $(".tableWinningShares tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 3) return;

    const groupText = $(cells[0]).text().trim();
    const groupMatch = groupText.match(/(\d+)/);
    if (!groupMatch) return;

    prizes.push({
      group: parseInt(groupMatch[1], 10),
      shareAmount: parseCurrency($(cells[1]).text().trim()),
      winners: parseIntComma($(cells[2]).text().trim()),
    });
  });

  return {
    drawNumber,
    drawDate,
    numbers: numbers as [number, number, number, number, number, number],
    additional,
    prizes,
  };
}
