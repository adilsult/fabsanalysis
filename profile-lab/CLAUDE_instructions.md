# Profile Lab — Инструкции для следующей сессии

> Последнее обновление: 25 марта 2026

## Что это такое

`profile-lab/` — изолированная лаборатория для разработки и тестирования детектора цефалометрических ландмарков на 90° профильных фотографиях лица.

**Проблема**: MediaPipe обучен на фронтальных лицах → на 90° профиле ставит ландмарки некорректно → NFA ~170° вместо нормы 115–130°.
**Решение**: собственный контурный детектор через Canvas API + MobileSAM.

---

## Запуск

```bash
# Из папки profile-lab:
npm run dev        # Vite фронтенд → http://localhost:5200
node server.mjs    # API сервер   → http://localhost:5201
```

Перезапустить API сервер (через Claude Code или вручную):
```bash
lsof -i :5201 | grep LISTEN   # узнать PID
kill <PID>
node server.mjs &
```

---

## Ключевые файлы

| Файл | Роль |
|------|------|
| `profile-lab/profile-landmarks-handler.mjs` | **Основной детектор** (Node.js, server-side). Здесь вся логика. |
| `profile-lab/server.mjs` | HTTP сервер (порт 5201). Роуты: `/api/profile-landmarks`, `/api/annotations`, `/api/annotations/count` |
| `profile-lab/src/main.tsx` | UI: загрузка фото, SAM, вызов API, рисование ландмарков, annotation mode |
| `profile-lab/vite.config.ts` | Proxy `/api/*` → порт 5201 (важно: без этого Save в annotation не работает) |
| `src/analysis/profileContourDetector.ts` | Клиент-сайд детектор (production). **НЕ синхронизирован** с handler.mjs — это задача следующих сессий |
| `src/analysis/mobileSam.ts` | MobileSAM сегментация → контур |

---

## Пайплайн (текущее состояние)

```
Фото профиля
    ↓
MobileSAM → бинарная маска лица
    ↓
detectProfileContourFromMask() → контур [{x,y}] топ→дно
    ↓
POST /api/profile-landmarks
    ↓
inferDeterministicFromContour():
  1. buildProjectionCurve()   — P[i] = x (right) или width-1-x (left)
  2. savitzkyGolay()          — SG сглаживание (окно 7-15, cubic)
  3. savitzkyGolayD1()        — SG первая производная
  4. computeKappa()           — нормальная кривизна κ = Pd2 / (1 + Pd1²)^(3/2)
  5. computeFaceBBox()        — bbox от globalMax по порогу 35% → topIdx/bottomIdx/faceH
  6. computeProminence()      — топографическая prominence для всех точек
  7. bestInZone() × 7         — candidate-based детекция в y_norm зонах
    ↓
{ landmarks, overallConfidence, source, reason }
    ↓
Canvas: цветные точки + линии углов (NFA синяя, NLA жёлтая) + русские подписи
```

---

## Алгоритм детектора — подробно

### Кривизна κ (новое, добавлено в текущей сессии)
```js
computeKappa(Pd1, Pd2):
  kappa[i] = Pd2[i] / max(1e-6, (1 + Pd1[i]²)^1.5)
```
Вместо голого знака Pd2 — реальная нормальная кривизна. Пики: κ < 0, впадины: κ > 0.

### Анатомические приоры

```js
LM_IS_PEAK   = { g: true,  n: false, prn: true,  sn: false, ls: true,  pg: true  }
LM_YN_CENTER = { g: 0.200, n: 0.165, prn: 0.465, sn: 0.600, ls: 0.740, pg: 0.890 }
LM_YN_HALF   = { g: 0.100, n: 0.085, prn: 0.115, sn: 0.080, ls: 0.070, pg: 0.110 }
```

`yNorm[i] = (i - topIdx) / faceH` — 0=лоб, 1=подбородок относительно face bbox.

### Feature scoring (scorePoint) — 6 признаков

```js
Ps_norm      = (smoothed[i] - zMin) / zRange          // высота в зоне
prom_norm    = promArr[i] / promMax                    // prominence в зоне
kappaSign    = isPeak ? (κ<0 ? 1.0 : 0.1) : (κ>0 ? 1.0 : 0.1)
kappaMagNorm = |κ[i]| / kappaAbsMax                   // НОВЫЙ признак
derivOk      = 1.0 если Pd1 меняет знак вокруг i, иначе 0.2
yScore       = 1 - |yNorm[i] - center| / half

// Веса по типу:
prn: 0.40·Ps + 0.20·prom + 0.12·κSign + 0.08·κMag + 0.10·deriv + 0.10·y
n:   0.25·(1-Ps) + 0.25·prom + 0.15·κSign + 0.10·κMag + 0.15·deriv + 0.10·y
sn:  0.25·(1-Ps) + 0.25·prom + 0.15·κSign + 0.10·κMag + 0.15·deriv + 0.10·y
g:   0.30·Ps + 0.25·prom + 0.12·κSign + 0.08·κMag + 0.15·deriv + 0.10·y
ls:  0.30·Ps + 0.25·prom + 0.12·κSign + 0.08·κMag + 0.15·deriv + 0.10·y
pg:  0.35·Ps + 0.25·prom + 0.12·κSign + 0.08·κMag + 0.10·deriv + 0.10·y
```

### Candidate-based детекция (новое)

```js
collectZoneCandidates(zone, lm, topK=5):
  1. Найти все локальные экстремумы в зоне
  2. Отфильтровать: prom >= promMax * 0.10
  3. preScore = 0.55·promNorm + 0.30·kappaSignOk + 0.15·kappaMagNorm
  4. Сортировка по preScore, дедуп: minSeparation = max(2, zoneLen*0.06)
  5. Вернуть top-k индексов

bestInZone():
  candidates = collectZoneCandidates(...)
  если < 2 кандидатов → fallback на bestInZoneLegacy (full-scan)
  иначе → scorePoint только по кандидатам → argmax
```

### Зоны поиска (y_norm)

```
prn:  [0.35 .. 0.58]  + fallback на globalMax если P < 60% globalMax
n:    [0.08 .. 0.25]  + ограничен prnIdx - 2
g:    [0.08 .. 0.30]  + ограничен nIdx - 2
sn:   [0.52 .. 0.68]  + от prnIdx + 2
cm:   inferColumellaIndex() — гибрид (см. ниже)
ls:   [0.67 .. 0.84]  + от snIdx + max(2, faceH*0.10), не дальше snIdx + faceH*0.24
      (fallback зона: [0.65..0.80] + snIdx + faceH*0.08 если основная пуста)
pg:   [0.78 .. 1.00]  + от lsIdx + 2
```

### Колумелла (cm) — гибридная детекция

```js
inferColumellaIndex(prnIdx, snIdx):
  span = snIdx - prnIdx
  innerPad = max(1, round(span * 0.12))
  зона поиска: [prnIdx+innerPad .. snIdx-innerPad]

  Ищет valley-кандидата: локальный минимум с prom >= segRange*0.10 и κ > 0
  quality = 0.55·promNorm + 0.30·kappaSignOk + 0.15·kappaMagNorm

  если valleyStrong → idx = лучший кандидат, score = 0.45 + 0.40·quality
  иначе → fallback: idx = prnIdx + round(span*0.46), score = ~0.29

  ограничение: idx <= prnIdx + round(span*0.72)  (не дрейфовать к sn)

cmScore = min(prnR.score, snR.score) * 0.45 + cmR.score * 0.55
```

### Overall confidence

```js
scrArr = [g*0.85, n, prn, cm, sn, ls, pg]
avgConf = mean(scrArr)
strongCount = count(v > 0.40)
strengthPenalty = strongCount >= 3 ? 1.0 : strongCount / 3
overallConfidence = clamp01(avgConf * strengthPenalty * 1.25)
```

### Диагностические логи в консоли сервера

```
[ProfileContour] SG win=15 bbox top=0 bot=1073 faceH=1073 N=1074
[ProfileContour] cand g=candidate:3 sn=candidate:2 ls=fallback:1 cm=candidate:2
[ProfileContour] scrArr=[...] avgConf=0.722 strong=7 penalty=1.000 overall=0.902
[profile-landmarks] Detector right: conf=0.902 N=1074 indices={...}
```

Если видишь `ls=fallback:1` — зона ls слишком узкая или нет кандидатов → нужно расширять зону или снижать порог.

---

## Annotation UI

В `main.tsx`:
- **Annotation Mode** (OFF/ON) — режим ручной коррекции ландмарков
- Drag точки мышью → snap к ближайшей точке контура
- **Sex label**: Male / Female / Unknown (сохраняется в аннотацию)
- **Save** → `POST /api/annotations` → `data/annotations/*.json`
- **Skip** → сохраняет без коррекций, `skipped: true`
- **Save & Next** → сохраняет и загружает следующее фото из очереди

Формат аннотации:
```json
{
  "filename": "photo.jpg",
  "side": "right",
  "sex": "male",
  "gender": "male",
  "imageWidth": 1300,
  "imageHeight": 1438,
  "contourLength": 1074,
  "auto": { "g": 14, "n": 267, ... },
  "corrected": { "g": 14, "n": 267, ... },
  "autoConfidences": { "g": 0.54, ... },
  "overallConfidence": 0.902,
  "skipped": false,
  "timestamp": 1711386000000
}
```

---

## Нерешённые проблемы / что делать дальше

### Приоритет 1 — Тест на разных типах лиц
- Женский профиль, худой, полный, левый профиль
- Проверить: NFA 115–140°, NLA 90–110°, ls на ~14–17% ниже sn

### Приоритет 2 — Синхронизировать с production детектором
- `src/analysis/profileContourDetector.ts` **устарел**: там нет computeKappa, нет candidate-based, старый cm (65% интерполяция)
- После стабилизации lab-версии → перенести логику

### Приоритет 3 — Собрать ~150 аннотаций
- Запустить profile-lab, загружать фото батчами, делать аннотации
- Сохраняются в `data/annotations/`

### Приоритет 4 — ML heatmap регрессор (после аннотаций)
- Python + PyTorch, MobileNet backbone + heatmap head
- Обучить на аннотированных силуэтах → заменить rule-based

---

## Важные архитектурные ограничения

1. **cm (колумелла)** на силуэте принципиально недетектируема — это точка между ноздрями, не на контуре. Гибридный метод даёт ~0.3–0.5 уверенности — это приемлемо.

2. **NFA/NLA** в 2D: точность ±10–15° из-за неизвестного фокуса камеры, питча головы, волос. Это физическое ограничение, не баг алгоритма.

3. **GPT отключён** (`aiFailureReason = 'disabled_phase1'`). AI-ветка кода сохранена, но не используется.

4. **Откатили**: calibration-shifts по индексам (был `scripts/train-annotation-calibration.mjs`) — удалён полностью. В логах не должно быть строк `Calibration ...`.

5. **Два детектора** сейчас расходятся:
   - `profile-lab/profile-landmarks-handler.mjs` — актуальный (κ, candidate-based, hybrid cm)
   - `src/analysis/profileContourDetector.ts` — старый (65% интерполяция cm, нет κ)
