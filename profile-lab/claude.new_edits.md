# New Edits Summary (March 25, 2026)

Этот файл фиксирует итог правок текущей сессии для будущих агентов.
Статус: **активно в `profile-lab`**, без переноса в production/client detector.

## 1) Что реально осталось в коде (active changes)

### 1.1 Detector upgrade в `profile-lab/profile-landmarks-handler.mjs`

Внедрены и активны:

1. Нормальная кривизна:
   - `kappa = Pd2 / (1 + Pd1^2)^(3/2)` с защитой `denom >= 1e-6`.
2. Обновлённый scoring:
   - знак экстремума теперь по `kappa` (peak `<0`, valley `>0`),
   - добавлен `kappaMagNorm` (нормализованная |kappa| в зоне),
   - веса перестроены так, чтобы общий вклад curvature-блока не был сломан.
3. Candidate-based детекция:
   - `collectZoneCandidates(...)` (top-k кандидатов, `k=5`),
   - дедуп по расстоянию: `minSeparation = max(2, round(zoneLen * 0.06))`,
   - если кандидатов мало (`<2`), fallback на legacy full-scan (`bestInZoneLegacy`).
4. `cm` (columella) гибрид:
   - сначала valley-candidate на участке `prn..sn`,
   - fallback на интерполяцию (около 46–47% пути), если quality слабый.
5. Диагностический лог:
   - строка вида:
     - `[ProfileContour] cand g=... sn=... ls=... cm=...`

### 1.2 Annotation UX/Data improvements

В `profile-lab/src/main.tsx`:

1. Добавлен выбор пола в annotation panel:
   - `Male | Female | Unknown`.
2. В payload сохранения теперь пишется:
   - `sex` (`male|female|unknown`),
   - `gender` (`male|female|null`) для совместимости.
3. Улучшен лог save-ошибок:
   - теперь показывает `status + body` (если есть), а не только код.

В `profile-lab/vite.config.ts`:

1. Добавлен proxy для:
   - `/api/annotations`
   - `/api/annotations/count`

Это устранило кейс “Save нажимается, но не сохраняет” из-за отсутствующего proxy.

## 2) Что было добавлено и потом полностью откатили

Полностью удалено (не активно):

1. Аннотационная калибровка индексов в рантайме (`annotation-calibration.json` shifts).
2. Скрипт тренировки сдвигов:
   - `scripts/train-annotation-calibration.mjs` (удалён).
3. npm script:
   - `train:calibration` (удалён из `package.json`).
4. Любая post-correction логика `Calibration ... shifts=...` из handler.

Проверка: в актуальных логах не должно быть строк `Calibration ...`.

## 3) Важные ограничения текущего состояния

1. Изменения detector-а применены **только** в:
   - `profile-lab/profile-landmarks-handler.mjs`
2. Они **не синхронизированы** с:
   - `src/analysis/profileContourDetector.ts`
   - `server/profile-landmarks-handler.mjs`
3. Аннотации сохраняются как dataset и пока не обучают runtime-модель автоматически.
4. Отдельного ML training pipeline (PyTorch/heatmap) в репозитории пока нет.

## 4) Как проверить, что запущена новая версия

1. Запуск:
   - `cd /Users/adilsultankhairolla/Documents/beauty-platform/profile-lab`
   - `npm run dev`
2. UI:
   - `http://localhost:5200`
3. API:
   - `http://localhost:5201`
4. В консоли API-сервера должны появляться строки:
   - `[ProfileContour] cand g=... sn=... ls=... cm=...`
   - `[ProfileContour] scrArr=[...] ...`
5. Не должно быть:
   - `Calibration ... shifts=...` (это откатили).

## 5) Что делать дальше (рекомендовано)

1. Обновить `profile-lab/CLAUDE_instructions.md`, потому что он сейчас частично устарел:
   - там ещё описан старый `cm=65% interpolation` и старый scoring без `kappaMagNorm`.
2. Прогнать валидацию на разных типах лиц:
   - male/female, lean/full, left/right.
3. Если quality всё ещё слабый по `ls/cm`:
   - перейти к tuning весов/порогов на аннотациях (но не через постоянный индексный shift).
4. После стабилизации lab-версии:
   - синхронизировать логику с `src/analysis/profileContourDetector.ts`.

