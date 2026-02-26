# Statistical Analysis & Number Recommendation Module Design

## Overview

Pure TypeScript analysis module that runs statistical tests on historical Toto draw data to detect bias and generate number recommendations. CLI-first interface, built on top of the existing SQLite database and ingestion pipeline.

## Goals

1. **Bias detection** — Statistical tests to determine whether draw generation shows measurable non-uniformity
2. **Number recommendations** — Use frequency, pattern, and trend analysis to suggest higher-probability picks

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | Pure TypeScript | Math is bounded and straightforward; no external stats library needed |
| Interface | CLI first | Fast to build, easy to test; API can wrap these later for frontend |
| Architecture | Functional modules | Each analysis area is a separate module with pure functions |

## Module Structure

```
apps/backend/src/
  analysis/
    frequency.ts      # Number frequency counts, hot/cold classification
    distribution.ts   # Chi-squared test, odd/even, high/low, group distribution
    patterns.ts       # Consecutive numbers, sum ranges, pair co-occurrence
    trends.ts         # Sliding window frequency trends
    recommend.ts      # Combines all analyses into number recommendations
    stats.ts          # Shared math utilities (chi-squared, z-score)
  cli.ts              # Extended with analyze:* commands
```

## Analysis Functions

### 1. Frequency & Recency (`frequency.ts`)

- `getNumberFrequencies(draws)` — Count how often each number (1–49) appears as main and additional number
- `classifyHotCold(frequencies, threshold)` — Label numbers as hot (above expected), cold (below expected), or neutral
- `getOverdueNumbers(draws)` — Numbers not drawn in the longest time, ranked by draws since last appearance

### 2. Distribution Tests (`distribution.ts`)

- `chiSquaredTest(frequencies, expectedFreq)` — Test if number distribution is uniform. Returns test statistic and p-value. For 49 numbers, expected frequency = totalDraws * 6/49 per number
- `oddEvenDistribution(draws)` — Ratio of odd vs even numbers per draw vs expected
- `highLowDistribution(draws)` — Ratio of high (25–49) vs low (1–24) per draw
- `groupDistribution(draws)` — Distribution across groups (1–10, 11–20, 21–30, 31–40, 41–49)

### 3. Pattern Analysis (`patterns.ts`)

- `consecutiveAnalysis(draws)` — How often draws contain consecutive numbers
- `sumRangeAnalysis(draws)` — Distribution of the sum of 6 drawn numbers
- `pairFrequency(draws, topN)` — Most frequently co-occurring number pairs

### 4. Time-Series Trends (`trends.ts`)

- `slidingWindowFrequency(draws, windowSize)` — Frequency of each number in last N draws vs overall
- `trendingNumbers(draws, windowSize)` — Numbers whose recent frequency significantly deviates from historical average

### 5. Number Recommendation (`recommend.ts`)

- `generatePicks(draws, config?)` — Scores each number 1–49 using signals from all analyses, suggests a 6-number pick
- Scoring signals: hot numbers, overdue numbers, trending up, distribution balance
- Returns top-scored numbers + reasoning for each

## Shared Math (`stats.ts`)

- `chiSquaredStatistic(observed, expected)` — Sum of (O−E)²/E
- `chiSquaredPValue(statistic, degreesOfFreedom)` — Lookup-based approximation
- `zScore(observed, expected, stdDev)` — Standard z-score calculation

## CLI Commands

- `pnpm analyze:frequency` — Print frequency table, hot/cold numbers, overdue numbers
- `pnpm analyze:bias` — Run chi-squared test and distribution analysis
- `pnpm analyze:patterns` — Print pattern analysis (consecutive, sum range, top pairs)
- `pnpm analyze:trends` — Print trending numbers (sliding window)
- `pnpm analyze:recommend` — Generate recommended number picks with reasoning

## Data Flow

```
SQLite DB → query all draws → analysis functions → formatted CLI output
```

Each analysis function takes an array of draw records and returns a typed result. The CLI reads from the DB, calls the analysis, and formats the output.

## Sample Size Considerations

Analysis functions should include warnings when sample size is too small for statistical significance. Chi-squared test requires minimum expected frequency of ~5 per cell (roughly 40+ draws for basic validity). The recommendation engine should caveat its output when working with limited data.
