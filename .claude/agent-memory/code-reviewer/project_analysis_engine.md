---
name: project_analysis_engine
description: Architecture notes for the facial analysis engine — key files, data flow, known design decisions, and reviewed change sets.
type: project
---

## Core analysis pipeline
- `landmarks.ts` — MediaPipe index constants (sparse array, indices 0–477, some may be undefined)
- `metrics.ts` — pure math over NormalizedLandmark[]; all landmark accesses can be undefined in sparse array
- `features.ts` — orchestrates metrics → FeatureAnalysis objects (10 features)
- `report.ts` — calls all feature analyzers, computes qualityFactor, returns AnalysisReport
- `proportions.ts` — gender/population-specific ideal ranges; returns ProportionItem[] with optional `informational` flag
- `scoring.ts` — computes overall harmony score from FeatureAnalysis[]

## Key design decisions
- Landmark array is SPARSE (`new Array<NormalizedLandmark>(478)` with holes); any index access must guard for undefined
- `qualityFactor` floor changed 0.35 → 0.15 (2026-03-23 review)
- `insufficient_data` features excluded entirely from weighted average in `computeOverallScore`
- `strength` status requires `allIdeal=true` param to `statusFromConfidence`; as of 2026-03-23 review, `allIdeal` is never passed as `true` from any call site — `strength` is effectively dead code
- EAR (Eye Aspect Ratio) upgraded to full 3-pair Soukupova formula; ranges differ between features.ts (0.25–0.55 normal band) and proportions.ts (female 0.38–0.54 ideal) — intentional two-layer design but gap at low end (0.25–0.38) is in-normal but out-of-ideal

## Reviewed change set (2026-03-23)
Files: scoring.ts, report.ts, landmarks.ts, metrics.ts, features.ts, proportions.ts
See code-review session notes for all bugs found.
