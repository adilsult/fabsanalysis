---
name: project_fabs_analysis
description: FABS facial analysis engine audit — key findings about landmark indices, ideal ranges, scoring, and 2D limitations
type: project
---

Audited on 2026-03-23 / updated 2026-03-24 (full features.ts audit) / updated 2026-03-24 (NFA z-depth question). Key files:
- src/analysis/landmarks.ts — MediaPipe 478-point index definitions
- src/analysis/metrics.ts — raw metric computation functions
- src/analysis/features.ts — per-zone feature analyzers (10 zones)
- src/analysis/report.ts — report orchestration, qualityScore calculation
- src/analysis/proportions.ts — ideal-range standards (gender/population aware)
- src/analysis/scoring.ts — overall score, status-to-score mapping
- src/analysis/softTissueProfile.ts — profile cephalometric landmark extraction

General architecture issues (session 1 — 2026-03-23):
1. EAR formula: confirmed fixed — now uses 3-pair Soukupova formula
2. noseWidthRatio uses IPD denominator — intercanthal distance is clinical standard
3. noseLengthRatio lm168→lm2 — reasonable (nasion origin) per comment
4. vShapeProxy uses JAW.rightBody/leftBody (172/397) not true gonion (234/454)
5. gonialAngleProxy uses faceTop (lm10) — anatomically incorrect
6. lowerFaceRatio range (0.25–0.80) too wide vs Farkas sn:stomion:menton norm
7. faceWidth() blends JAW.rightAngle(234/454) + ZYGION outer(123/352) — anatomically mixed
8. CHIN_SOFT_TISSUE_DENSE includes lateral mandible points

Full features.ts numeric audit (session 2 — 2026-03-24):

EYEBROWS (analyzeEyebrows):
- isSymmetric condition (line 112): avgEyeDist > 0.04 && < 0.12 — hardcoded, does NOT match proportions.ts
  EYEBROW_STANDARDS.browToEyeDistance unisex min=0.045, max=0.115. Both bounds disagree.
- rangeSeverity call (line 115): (0.045, 0.115, 0.4) — correctly matches proportions.ts unisex
- Observation threshold (line 143): avgEyeDist < 0.05 "close to eye line". Contradicts isSymmetric lower
  bound of 0.04 — a value of 0.042 passes isSymmetric but triggers "close to eye" observation.
- Observation threshold (line 145): avgEyeDist > 0.10 "high brows". proportions.ts max is 0.115; this
  fires 15 units before the defined norm ends — false positive zone.
- symmetry threshold (line 129/131): 0.9 → "good", 0.8 → "mild", <0.8 → "marked". isSymmetric lower
  bound is 0.85 — the 0.80–0.85 band passes isSymmetric but hits "mild asymmetry" observation, which
  is internally consistent but the 0.85 gate is not documented in proportions.ts.

EYES (analyzeEyes):
- isNormal avgEAR bounds (line 204): > 0.30 && < 0.55 — lower bound 0.30 is the physiological/
  pathological gate, NOT the aesthetic ideal (0.38 female per proportions.ts). Code comment says this
  is intentional (line 201-202). This is correct per clinical logic but means patients with EAR 0.30–0.38
  receive "within_norm" status despite falling below aesthetic ideal range in proportions.ts.
- isNormal intercanthalToEye bounds (line 207-208): > 0.82 && < 1.25 — proportions.ts unisex is
  0.85–1.15 (line 132). Lower bound is 0.82 vs 0.85 (too permissive); upper bound is 1.25 vs 1.15
  (too permissive). Both sides are wider than the standard.
- rangeSeverity intercanthalToEye (line 212): (0.85, 1.25, 0.45) — lower bound now matches proportions.ts
  but upper bound is still 1.25 vs 1.15.
- Observation threshold (line 229): avgEAR < 0.2 "narrow/partially closed". With isNormal lower bound
  at 0.30, the 0.20–0.30 range produces 'attention' status from statusFromConfidence but gets the benign
  "narrow" observation rather than a clinical flag. Gap between observation threshold and isNormal gate.
- Observation threshold (line 231): avgEAR > 0.35 "widely open". proportions.ts female ideal is 0.38–0.54;
  this fires at 0.35, below the minimum of the ideal range — misclassifies 0.35–0.38 as "widely open"
  when they are actually sub-ideal.
- allIdeal condition (line 258): fifths.intercanthalToEye > 0.90 && < 1.10 — reasonable tighter gate
  for 'strength', not from proportions.ts but clinically defensible as inner-1-SD range.

NOSE (analyzeNose):
- isNormal widthToIntercanthal (line 301-302): > 0.80 && < 1.20 — proportions.ts unisex is 0.85–1.15
  (line 157). Both bounds too permissive by 0.05.
- isNormal lengthRatio (line 303-304): > 0.15 && < 0.34 — proportions.ts unisex is 0.17–0.29 (line 178).
  Lower bound 0.15 vs 0.17 (too permissive); upper bound 0.34 vs 0.29 — MAJOR: 0.29 is the unisex max
  but the isNormal gate allows up to 0.34 (+17% beyond standard).
- rangeSeverity widthToIntercanthal (line 307): (0.80, 1.20, 0.35) — same asymmetry as isNormal, 0.05
  too wide on each side vs proportions.ts 0.85–1.15.
- rangeSeverity lengthRatio (line 309): (0.15, 0.34, 0.4) — upper bound 0.34 vs proportions.ts 0.29.
  A nose that is 20% longer than the clinical max still scores severity=0.
- Observation threshold widthRatio/IPD (line 321): < 0.55 "narrow" — proportions.ts for alarWidthToIPD
  female min is 0.55 (line 165). Clinically correct lower bound but uses IPD-based metric while
  isNormal uses the intercanthal-based metric. Mixed denominators in the same function.
- Observation threshold widthRatio/IPD (line 323): > 0.85 "wide" — proportions.ts alarWidthToIPD
  female max is 0.70, male 0.75. The 0.85 threshold is 0.15 above the female clinical maximum —
  wide noses are not flagged until they are far past the standard.

CHEEKS (analyzeCheeks):
- hwRatio observation threshold (line 435): < 1.05 "round/wide". Published Farkas (1994) female mean
  HW = ~1.36. A ratio of 1.05 is already a markedly wide face; the label is correct but the threshold
  is too low — values 1.05–1.28 fall into "square/medium" (line 437-438) without being identified as
  below-ideal.
- hwRatio observation threshold (line 437): < 1.25 "square/medium". isBalanced lower bound (line 503)
  is 1.28 (matching proportions.ts). The range 1.25–1.28 passes the "square" observation branch but
  FAILS isBalanced — produces 'attention' status with a "pропорции в пределах нормы" label. Label
  contradicts status.
- hwRatio observation threshold (line 439): <= 1.45 "oval/typical". proportions.ts unisex max is 1.48;
  the observation branch ends at 1.45, meaning 1.45–1.48 falls into "elongated" (else branch) despite
  being within the ideal range.
- isBalanced (line 503): hwRatio >= 1.28 && <= 1.48 — correctly matches proportions.ts unisex (1.28–1.48).
- rangeSeverity hwRatio (line 507): (1.28, 1.48, 0.45) — correctly matches proportions.ts unisex.
- rednessSeverity (line 504): rangeSeverity(rednessIndex, -0.01, 0.08, 0.8) — upper threshold 0.08
  consistent with observation/recommendation threshold (line 450/501). Correct internal consistency.
  However, the lower bound of -0.01 is meaningless (rednessIndex cannot be negative by formula); use 0.

JAW (analyzeJaw):
- isNormal vShape (line 535): > 0.70 && < 0.98 — proportions.ts unisex vShapeProxy is 0.72–0.90
  (line 248). Lower bound 0.70 vs 0.72 (slightly too permissive); upper bound 0.98 vs 0.90 — MAJOR:
  0.90 is the unisex maximum but isNormal allows up to 0.98 (+8.9% beyond standard).
- isNormal hwRatio (line 535): > 1.20 && < 1.52 — proportions.ts unisex faceHeightWidthRatio is
  1.28–1.48 (line 258). Lower bound 1.20 vs 1.28 (0.08 too permissive); upper 1.52 vs 1.48 (0.04 too
  permissive). Both boundaries substantially differ from the standard.
- rangeSeverity vShape (line 538): (0.72, 0.95, 0.45) — lower bound now matches proportions.ts but
  upper bound is 0.95 vs 0.90 from proportions.ts. Inconsistency between isNormal (0.98) and
  rangeSeverity (0.95) for the same metric's upper bound.
- rangeSeverity hwRatio (line 539): (1.25, 1.50, 0.45) — proportions.ts unisex 1.28–1.48. Lower 1.25
  vs 1.28; upper 1.50 vs 1.48. Neither bound matches the standard.
- Observation threshold vShape (line 549): < 0.8 "V-shape tendency". rangeSeverity lower bound is 0.72;
  this observation fires at 0.80 — well inside the normal range. Values 0.72–0.80 get the "V-shape"
  observation despite having zero severity.
- Observation threshold vShape (line 551): > 1.1 "wider jaw than forehead". isNormal upper gate is 0.98;
  rangeSeverity upper bound is 0.95. The 1.1 observation threshold is 0.12 beyond isNormal and 0.15
  beyond rangeSeverity — the "square/rectangular" observation fires very late.

LIPS (analyzeLips):
- isNormal ratio bounds (line 624): > 0.64 && < 1.08 — proportions.ts unisex upperLowerRatio is
  0.64–1.08 (line 193). EXACT MATCH. Correct.
- isNormal mouthToNose bounds (line 624): > 1.20 && < 1.70 — proportions.ts unisex mouthToNoseWidthRatio
  is 1.28–1.62 (line 213). Lower bound 1.20 vs 1.28 (too permissive); upper 1.70 vs 1.62 (too
  permissive).
- isNormal tilt bounds (line 624): > -2.5 && < 4.5 — proportions.ts unisex cornerTilt is -2.0 to +4.0
  (line 223). Both bounds 0.5 too permissive.
- rangeSeverity ratio (line 626): (0.64, 1.08, 0.45) — matches proportions.ts unisex. Correct.
- rangeSeverity mouthToNose (line 627): (1.28, 1.62, 0.45) — matches proportions.ts unisex. Correct.
- rangeSeverity tilt (line 629): (-2.0, 4.0, 0.55) — matches proportions.ts unisex. Correct.
- CRITICAL INCONSISTENCY: isNormal uses (-2.5, 4.5) for tilt but rangeSeverity uses (-2.0, 4.0).
  A tilt of -2.3° passes isNormal (> -2.5) but has severity > 0 from rangeSeverity (< -2.0). This
  means a patient can get isNormal=true with severity > 0, producing confusing status output.
- Same inconsistency for mouthToNose: isNormal allows 1.20–1.70 but severity starts outside 1.28–1.62.
  A value of 1.22 passes isNormal but has severity > 0.
- Observation threshold ratio (line 641): < 0.64 — matches proportions.ts and isNormal. Correct.
- Observation threshold ratio (line 643): > 1.08 — matches proportions.ts and isNormal. Correct.
- Observation threshold tilt (line 649): < -2 "corners pointing down" — proportions.ts lower bound is
  -2.0 and isNormal gate is -2.5. Observation fires at -2.0 (matching proportions.ts) — correct.
- Observation threshold tilt (line 651): > 2 "corners pointing up" — proportions.ts center is 1.5;
  this fires inside the ideal range, creating a positive observation for values that are aesthetically
  normal. Not clinically harmful but cosmetically misleading.

CHIN (analyzeChin):
- isNormal chinHeight (line 714): > 0.1 && < 0.27 — proportions.ts unisex chinHeightRatio is 0.14–0.21
  (line 273). Lower 0.10 vs 0.14 (0.04 too permissive); upper 0.27 vs 0.21 — MAJOR: 0.21 is the
  unisex max; the isNormal gate allows 28.6% above the clinical standard.
- isNormal lowerFace (line 714): > 0.25 && < 0.8 — proportions.ts unisex lowerFaceRatio is 0.40–0.62
  (line 312). Range is 3.5x wider than the standard (0.55 span vs 0.22 span). This is an extremely
  permissive gate that will almost never flag lowerFace deviations.
- rangeSeverity chinHeight (line 716): (0.1, 0.27, 0.4) — same too-wide bounds as isNormal.
- rangeSeverity lowerFace (line 717): (0.25, 0.8, 0.45) — same extremely wide bounds as isNormal.
  A lowerFaceRatio of 0.30 (well outside proportions.ts min of 0.40) still has low severity.
- rangeSeverity faceThirds (lines 718-719): uses absolute deviation thresholds (0, 0.08) and (0, 0.10)
  — these are not in proportions.ts at all. proportions.ts CHIN_STANDARDS.faceThirdUpper/Middle/Lower
  all have min=0.28, max=0.37. The code does not call rangeSeverity on the actual third values but
  on the DIFFERENCE between thirds. This is a valid approach (equal-thirds canon) but is disconnected
  from the proportions.ts standard ranges.
- Observation threshold thirds (line 735): thirdDeviation < 0.1 "well balanced". This is total
  absolute deviation from 0.33 across all three thirds. Max possible deviation if one third is 0.37
  and another is 0.28 is 0.12. The threshold of 0.10 is quite tight and may flag normal variation.
- Observation threshold lowerThird (line 739): thirds.lower > 0.4. proportions.ts unisex max is 0.37.
  The observation threshold is 0.03 above the standard maximum — delayed flagging.
- Observation threshold lowerThird (line 741): thirds.lower < 0.27. proportions.ts unisex min is 0.28.
  The observation threshold is 0.01 below the standard minimum. Almost correct.

SKIN (analyzeSkin):
- isNormal for brightness: no threshold defined — brightness is measured (line 834) but isNormal is
  never set to false based on brightness alone. avgBrightness is reported but never evaluated against
  any range.
- brightnessVariance threshold (line 847): > 500 "high texture variance". This is in raw pixel units
  (variance of 0-255 luminance values). No published clinical standard uses this scale. The threshold
  of 500 is arbitrary. At 8-pixel radius sampling, JPEG compression artifacts can easily exceed 500
  in high-frequency areas. Not clinically meaningful.
- rednessIndex threshold in analyzeSkin (line 858): > 0.06 "elevated redness". analyzeCheeks uses
  > 0.08 (lines 450, 501). INCONSISTENCY: the same metric has two different thresholds in two
  functions — 0.06 in analyzeSkin vs 0.08 in analyzeCheeks.
- rednessIndex threshold (line 865): > 0.03 "mild redness tendency". No clinical reference for this
  intermediate threshold. Arbitrary.
- colorUniformity threshold (line 871): < 0.7 "color non-uniformity". No clinical standard cited.
  Arbitrary pixel-space threshold.
- Base confidence (line 827): 0.45 without imageData — this is the floor; statusFromConfidence returns
  'insufficient_data' for confidence < 0.45. With qualityFactor=1, dynConf(0.45, 1.0) = 0.45 exactly.
  This means skin without imageData is right at the insufficient_data boundary. With any quality
  degradation (qualityFactor < 1), it will drop below 0.45 and return insufficient_data. This is
  borderline acceptable.

NECK (analyzeNeck):
- rangeSeverity bounds (line 919): (115, 136, 0.55) — proportions.ts NECK_STANDARDS female is
  118–134, male 113–129, unisex 115–132 (line 353). The severity function uses 115 (unisex min)
  and 136 (female max + 2, neither unisex nor female exactly). Upper bound 136 vs 132 (unisex) or
  134 (female) — 4° too permissive. This is a mixed-gender range not from proportions.ts.
- isNormal (line 920): severity < 0.35 — derived from the severity score, not a direct range check.
  This is acceptable but less transparent than a direct range comparison.
- Note: lowerFaceProfileAngle measures subnasale→menton→gonion, which is NOT the cervico-mental
  angle (requires true cervical point below the mandible, not visible in face mesh). The metric is
  explicitly a proxy. The standard in proportions.ts (118–134°) cites cervico-mental angle norms;
  applying these norms to this proxy is clinically misleading.

EARS (analyzeEars):
- hasProfiles branch: statusFromConfidence(confidence, true, 0.25) — hardcoded severity=0.25. This
  will always resolve to 'within_norm' for any confidence > 0.45. Ears have no measurements, so
  this is essentially a "not enough data but not flagging it" state — 'insufficient_data' would be
  more honest since no actual measurement is performed.
- Base confidence with profiles (line 980): 0.58. With qualityFactor=1: dynConf(0.58, 1) = 0.58.
  This returns 'within_norm' despite zero measurements — misleading.

PROFILE CONTOUR PIPELINE (profileContourDetector.ts — audited 2026-03-24):
Architecture: 4-stage pure-canvas pipeline (grayscale → Gaussian blur → Sobel+NMS+hysteresis → silhouette → 1D projection peaks/valleys)
Replaces MediaPipe entirely for profile photos (correct decision — MediaPipe is unreliable on true 90° profiles).

Stage 1-2 (preprocessing + edge detection): technically sound. Gaussian sigma adaptive (1.5–4 based on width/200). Sobel + NMS + BFS hysteresis. Thresholds auto-computed from percentile distribution (40th/85th) — good.

Stage 3 (silhouette extraction): single-column-scan-per-row approach: for each row, takes the FIRST edge pixel from the face side. This is fragile when:
- Hair or clothing creates an edge closer to the camera than the actual face silhouette (hair-side artifact)
- Background has a vertical edge (wall, door frame) inside the 65% ROI guard
- Subject wears glasses with dark frames that create a strong edge
- ROI guard is fixed at 65% width — does not adapt to face size in frame

Stage 4 (landmark identification): uses 1D projection curve (protrusion from face side). Peak/valley detection with zone fractions:
- Pronasale: 30-58% zone — clinically, nose tip is typically 35-55% of face height in profile. Zone is reasonable.
- Nasion: 12-38% zone — correct superior position
- Glabella: 5-28% zone — correct; above nasion
- Subnasale: 45-66% zone — reasonable, just inferior to nose tip
- Columella: 60% descent from prn to sn — this is NOT a real contour landmark. The columella is
  inside the profile silhouette (it separates the two nostrils but the outermost silhouette point
  is the alar rim, not the columella). The detector places columella at 60% interpolation between
  prn and sn — this is a fictional point not detectable from the silhouette.
- Labiale Superius: 52-72% zone — the upper lip in profile is detectable as the most anterior
  point between the subnasale valley and the chin. However it is frequently confused with the
  vermilion border of the lower lip in subjects with protrusion.
- Pogonion: 68-95% zone — the chin is the most anterior point of the lower face in profile.
  Reliable if background is clean.

Key clinical gaps in the contour detector:
1. Labrale inferius (li) — lower lip — not detected. Required for nasolabial angle and E-line.
2. Menton (me/soft tissue menton) — the most inferior point of the chin. Detector uses pogonion
   (most anterior) but these differ by ~4-6mm clinically. Menton requires a vertical minimum, not
   a horizontal projection peak — the detector's projection curve cannot find it.
3. Cervical point (c) — not detectable from face-only silhouette. Cervicomentomental angle requires this.
4. Supramentale / B-point soft tissue — not detected. Needed for lower lip depth assessment.

MediaPipe on 90° profile photos:
- Reliable landmarks: ipsilateral eye (133/33 for right profile), ipsilateral eyebrow (70-107), nasion (168),
  nose tip (1), nose base (2), upper lip vermilion (13/0), chin (152), jawline ipsilateral side.
- Unreliable/collapsed: ALL contralateral side landmarks (376, 280, 362 etc.), iris centers (468/473),
  all bilateral width measurements, jaw angles (the contralateral jaw point 234 or 454 is occluded).
- The current code correctly falls back to the contour detector and uses MediaPipe only when contour
  confidence is below 0.35.

2D mobile photo limitations for profile analysis:
- Camera lens focal length affects apparent nose projection significantly. A wide-angle lens
  (typical phone front camera: 22-28mm equivalent) exaggerates nose size and projection.
  A portrait lens (85-105mm equivalent) is needed for accurate cephalometric measurements.
- No depth information: prn x-coordinate is not true projection — it is the silhouette extent,
  which depends on nose shape AND camera distance AND in-plane rotation of the head.
- Head pitch (up/down tilt) of even 5-10° changes the apparent nasofrontal angle by 5-15°.
- Hair overlap on the forehead obscures the glabella region and the top of the silhouette.
- The n→pg normalization used in softTissueProfile.ts is appropriate for scale invariance,
  but in 2D it measures the PROJECTED distance, not the true anatomical distance.

Recommended minimum reliable landmark set from contour for cephalometric angles:
- Pronasale (prn): reliable — global maximum of horizontal projection curve, ~35-55% height
- Nasion (n): reliable — clear valley between glabella and prn peaks, ~15-30% height
- Subnasale (sn): moderately reliable — valley after prn, ~48-62% height
- Glabella (g): less reliable — peak above nasion often flattened by hair or lacks prominence
- Pogonion (pg): reliable if background clean — global maximum in lower 30% of face
- Labiale superius (ls): least reliable — small peak after sn, easily confused with lower lip

GPT PROFILE LANDMARK PROMPT AUDIT (session 2026-03-24):
File: server/profile-landmarks-handler.mjs

Current SYSTEM_PROMPT deficiencies:
1. No anterior-direction geometry rule (x-direction for left vs right profile) — most critical deficiency
2. No vertical zone percentages for any landmark
3. Nasion not identified as valley/recessed — only "radix depression" without projection constraint
4. cm has no anatomical description whatsoever — only order constraint
5. g has no projection-peak constraint
6. ls has no projection-peak constraint

Proposed prompt: substantially better. Key findings from clinical audit:
- Geometry rules (anterior = smaller x for left, larger x for right): CORRECT and critical improvement
- Glabella zone 10-20%: TOO NARROW; should be 8-28% (Farkas 1994 places g at 15-22% of trichion-menton,
  but contour includes hairline variation). Will miss g in many real photographs.
- Nasion zone 20-35%: CORRECT. "RADIX DEPRESSION" and "most recessed" language excellent.
  BUT: right-profile x-constraint for n is not stated (only left is stated). Must add symmetric constraint.
- Pronasale zone 35-55%: ACCEPTABLE. Farkas: ~42-52% of trichion-menton.
- Columella cm "60% from prn to sn": NOT A REAL SILHOUETTE LANDMARK. Cannot be observed on silhouette.
  Should be described as interpolation with confidence cap 0.50 max. (Same issue in deterministic detector.)
- Subnasale zone 50-65%: CORRECT. Should add "local valley" in projection curve.
- Labiale superius zone 60-72%: CORRECT. Should add "local protrusion peak between sn valley and interlabial space."
- Pogonion zone 70-92%: Upper bound 92% risks neck region. Recommend 70-88%.

Critical missing constraints:
1. proj(n) < proj(prn) AND proj(sn) < proj(prn) — both nasion and subnasale set back vs nose tip — not stated
2. Per-landmark peak/valley classification not systematically stated: g=peak, n=valley, prn=peak, sn=valley, ls=peak, pg=peak
3. proj(g) >= proj(n) in most subjects (Holdaway 1983 — g protrudes 2-5mm more than nasion)
4. Right-profile nasion x-constraint missing (symmetric to left-profile constraint stated)
5. Contour is face-side boundary only — not stated explicitly

PROFILE LANDMARK QA SESSION (2026-03-25 — real image evaluation, right profile male ~35-45y):

Image: 1300x1438px, right profile (nose facing right = high x)
Detected coordinates: g(833,239,c=0.54) n(966,492,c=0.54) prn(1107,643,c=0.85) cm(1071,802,c=0.60) sn(1044,887,c=0.98) ls(1056,935,c=0.95) pg(798,1286,c=0.59)
Overall detector confidence: 0.902

COMPUTED ANGLES (from pixel coordinates, verified mathematically):

NFA (angle at n, vectors n→g and n→prn):
  Vector g→n: dx=+133, dy=+253 (angle 27.7° from vertical = forehead slopes forward)
  Vector n→prn: dx=+141, dy=+151 (angle 43.0° from vertical = nasal dorsum projection)
  Computed NFA: 164.7°
  Clinical interpretation: ABNORMALLY HIGH. Normal NFA (Powell & Humphreys 1984): 115-130° (ideal 115-130°, acceptable 100-135°).
  Root cause: g is positioned TOO HIGH on the forehead (y=239 vs expected ~y=350-400 for true glabella).
  g is likely detecting the superior forehead/hairline point rather than the true glabella prominence.
  Effect on NFA: g above the true glabella → g→n vector is more vertical → angle at n widens from ~125° to ~165°.

NLA variant A — cm→sn→ls (code preferred when cm stable):
  Computed NLA_cm: 148.3°
  Clinical interpretation: ABOVE NORMAL. Published NLA norms: male 90-95° (Farkas 1994),
  acceptable range 90-110° male, 95-115° female (Powell & Humphreys 1984).
  A value of 148° indicates strong retroclination of the upper lip — clinically suggests a retruded upper lip
  or an excessively obtuse nasolabial angle, both cosmetically significant findings.

NLA variant B — prn→sn→ls (code fallback):
  Computed NLA_prn: 151.5°
  Slightly worse than cm variant. If cm is stable (cmSnDist=89.2px is adequate), cm variant is preferred.

DISTANCES AND RATIOS (normalized to n→pg):
  n→pg: 811.6px
  gNRatio (g→n / n→pg): 0.352 — published norm: 0.28-0.33 (Farkas). Elevated: g is too high.
  nPrnRatio (n→prn / n→pg): 0.255 — published norm (Goode): 0.55-0.60 of nose height. Cannot compare directly.
    Ricketts: nose projection = 0.67 × alar base width. Needs frontal data to verify.
  snLsRatio (sn→ls / n→pg): 0.061 — THIS IS TOO SMALL.
    In absolute terms: sn→ls = 49.5px / faceH(g→pg)=1047px = 4.7%.
    Published norm (Farkas 1994): sn-ls segment is ~18-22mm in adults, face height ~120-130mm → ~14-17%.
    4.7% is 3× too small. Diagnosis: ls is placed immediately below sn (48px gap at 1438px height).
    Root cause: on profile, the upper lip protrudes between sn and the interlabial space. The detector's
    peak-finding in zone [62-78%] should find ls as a protrusion peak, but sn and ls are being detected
    too close together. The sn detection at 61.7% y_norm and ls at 65.0% y_norm are only 3.3% apart.
    Clinically, sn-ls vertical distance should be ~5-8% of face height in profile.
  lsPgRatio (ls→pg / n→pg): 0.537 — reasonable for lower face depth
  cmSnRatio (cm→sn / n→pg): 0.110 — cm is interpolated (65% prn→sn), not a true detection.
    Deviation from expected interpolation: only 5.0px (sub-pixel — correct, cm IS the interpolation).

LANDMARK-SPECIFIC FINDINGS:

g (Glabella, conf=0.54):
  LIKELY MISPLACED — too high. y=239 = 16.6% of 1438. True glabella should be ~24-30% from top (hairline).
  y_norm_center for g in code is 0.075 (7.5% of face bbox). If bbox top is near hairline (~50px),
  the normalized y would be ~(239-50)/(1286-50) = 0.153 — outside the LM_YNORM_CENTER window of 0.075±0.075.
  This suggests the code found the best-scoring point in the zone [0..15%] which corresponds to the
  upper forehead, not the true glabella bump. Confidence 0.54 correctly reflects low certainty.
  Clinical consequence: NFA is inflated by ~30-40° above true clinical value.

n (Nasion, conf=0.54):
  ANATOMICALLY PLAUSIBLE. y=492 = 34.2% of image height. For a right profile, n at x=966 vs prn at x=1107
  means nasion is 141px behind the nose tip — correct direction. Confidence 0.54 is low but acceptable
  given that nasion is a valley (low projection point) which is inherently harder to localize precisely.

prn (Pronasale, conf=0.85):
  CORRECT. The nose tip at x=1107 is the rightmost (most anterior) point in the upper face — correct for
  a right-facing profile. y=643 = 44.7% of image height — within the expected 35-55% zone. High confidence
  reflects that pronasale is the global horizontal maximum, the most reliable contour landmark.

cm (Columella, conf=0.60):
  NOT A TRUE SILHOUETTE DETECTION — it is always the 65% interpolation between prn and sn (confirmed:
  expected=(1066,802) vs detected=(1071,802), deviation=5px). This is a synthetic point. Confidence
  0.60 is misleading — it should be capped at 0.40-0.45 as stated in code comment (line 547).
  The reported conf=0.60 exceeds the recommended cap, suggesting the capping is not enforced in this path.

sn (Subnasale, conf=0.98):
  PLAUSIBLE but proximity issue. y=887 = 61.7% of height. x=1044 is slightly behind prn(1107) — correct,
  sn should be recessed vs nose tip. Confidence 0.98 is the highest of all landmarks — plausible since
  sn is a clear valley in the projection curve immediately after the nasal tip peak.

ls (Labiale Superius, conf=0.95):
  SUSPICIOUS. y=935, only 48px below sn(y=887). At image height 1438px this is only 3.3% of face height.
  Anatomically the upper lip (sn to vermilion border) is 16-20mm in adults = roughly 12-15% of face height.
  The detector found a very shallow local peak immediately below sn — possibly a minor undulation in the
  lip contour rather than the true vermilion protrusion peak. High confidence (0.95) is misleading — the
  feature scoring system apparently rewards finding a valid local peak with high scores regardless of
  whether the peak has sufficient amplitude for clinical significance.

pg (Pogonion, conf=0.59):
  PLAUSIBLE. y=1286 = 89.4% of height. x=798 — behind the face vertical center, which is expected for
  a man with a slightly retrognathic or straight profile. Confidence 0.59 is appropriate for a male
  with a strong chin where pg can be a broad, flat maximum rather than a sharp peak.
  Note: n→pg vector has −11.9° tilt from vertical (tilts toward left/back of image), which is geometrically
  plausible for a right-facing profile where the reference line isn't perfectly vertical.

SUMMARY OF ISSUES FOR THIS SPECIFIC DETECTION:
1. g MISPLACED (high forehead vs true glabella) → NFA 164.7° instead of expected ~120-130° — unusable
2. ls TOO CLOSE TO sn (4.7% face height vs clinical 14-17%) → NLA meaningless (148° instead of ~95-110°)
3. cm IS INTERPOLATED — not a real detection — confidence should be ≤0.45
4. The overall 0.902 confidence from the detector is overcalibrated for this result:
   g and ls are clinically wrong, making NFA and NLA both invalid.

SILHOUETTE METHOD EVALUATION (session 2026-03-24 — clinical opinion on segmentation approaches):

Options evaluated: Canny (current), MobileSAM (15MB, 1.5-4s iOS WASM), MediaPipe multiclass (15.6MB, 80-200ms), RMBG-1.4 (44MB int8, 8-20s)

Key clinical findings:
1. Glabella is a skin landmark — any silhouette method (including MobileSAM) that includes hair in
   the mask boundary produces a falsely anterior glabella when hair covers the forehead.
   This cannot be solved by better segmentation. Recommendation: cap NFA confidence at 0.40 (below
   current 0.55*0.85=0.47) and add explicit "hair-covering-forehead" warning in UI.

2. MobileSAM is the best viable approach for prn, nasion, sn, pg — cleaner boundary removes
   background walls, glasses frames, and chin-clothing edges that corrupt the Canny pipeline.
   Should be implemented with 3.5s hard timeout fallback to Canny.

3. Two-stage multiclass→MobileSAM is not justified. The MobileSAM prompt point can be derived
   geometrically from the known profile side (no additional model needed).

4. RMBG-1.4 is not viable for interactive use on iOS (8-20s WASM latency).

5. Menton (me) — lowest y-coordinate of chin — is detectable from a clean MobileSAM mask but
   NOT from the Canny projection curve (which finds the most anterior point = pogonion, not the
   most inferior point). MobileSAM would enable adding menton as the correct normalization
   reference for Ricketts analysis and lower-face thirds.

6. NFA accuracy ceiling with ANY mobile silhouette method: ±10-15° due to 2D projection without
   camera calibration. NLA is better at ±5-8°. No segmentation improvement changes this ceiling.

7. MobileSAM implementation requirements:
   - Prompt point: hardcoded from profile side (no multiclass stage needed)
   - Timeout: 3.5s hard limit, fallback to Canny
   - Device gate: WASM SIMD + >4GB RAM check before loading 15MB model
   - Clinical gain: primarily for prn, nasion, sn, pg — NOT for glabella
