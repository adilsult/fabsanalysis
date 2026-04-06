/**
 * Server API handler: POST /api/analyze
 *
 * Accepts facial landmark measurements (NO images — privacy preserved),
 * calls OpenAI GPT-4o and streams back AI-generated personalized
 * recommendations for each of the 10 features.
 *
 * Response format: Server-Sent Events (SSE)
 *   data: {"partial": "...text chunk..."}   ← streaming text
 *   data: {"done": true, "result": {...}}   ← final parsed JSON
 *   data: {"done": true, "error": "..."}    ← error case
 */

import OpenAI from 'openai';
import type { IncomingMessage, ServerResponse } from 'http';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Streaming budget used by serverless hosts that support this hint.
export const maxDuration = 60;

function readEnvValueFromFiles(key: string): string | undefined {
  const files = [path.resolve(process.cwd(), '.env.local'), path.resolve(process.cwd(), '.env')];
  for (const filePath of files) {
    if (!existsSync(filePath)) continue;
    const raw = readFileSync(filePath, 'utf8');
    for (const rawLine of raw.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      if (line.slice(0, eq).trim() !== key) continue;
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      const clean = value.trim();
      if (clean) return clean;
    }
  }
  return undefined;
}

function resolveOpenAIKey(): string | undefined {
  const candidates = [
    process.env.OPENAI_API_KEY,
    process.env.VITE_OPENAI_API_KEY,
    process.env.OPENAI_KEY,
    readEnvValueFromFiles('OPENAI_API_KEY'),
    readEnvValueFromFiles('VITE_OPENAI_API_KEY'),
  ];
  for (const candidate of candidates) {
    const clean = candidate?.trim();
    if (clean) return clean;
  }
  return undefined;
}

function resolveOpenAIModel(): string {
  return (
    process.env.OPENAI_MODEL?.trim() ||
    process.env.VITE_OPENAI_MODEL?.trim() ||
    readEnvValueFromFiles('OPENAI_MODEL') ||
    readEnvValueFromFiles('VITE_OPENAI_MODEL') ||
    'gpt-4o-mini'
  );
}

type UiLanguage = 'ru' | 'en';

function languageLabel(language?: string): UiLanguage {
  return language === 'en' ? 'en' : 'ru';
}

const SYSTEM_PROMPT_RU = `Ты — пластический хирург и эксперт по эстетической медицине. На входе только структурные метрики лица (НЕ фото). На выходе нужны клинически-полезные рекомендации для клиента косметологической клиники на русском языке.

Правила интерпретации:
- Для каждой карточки используй status + observations + measurements + confidence.
  Если переданы proportions, сначала анализируй пункты со status="deviation", затем status="close".
- В aiInsight обязательно:
  1) начни с короткой позитивной фразы о сильной стороне внешности в этой зоне;
  2) укажи 2-4 ключевые метрики с числами;
  3) во втором предложении строго напиши "Статус: OK|Monitor|Attention";
  4) дай короткий клинический смысл отклонений или нормы.
  5) при наличии proportions используй формулировку "label: userValue при идеале idealMin–idealMax".
  6) обязательно отдельной фразой укажи соответствие выбранному стандарту (default/east_asian): "высокое/частичное/низкое".
- Если confidence < 0.35, явно укажи, что надежность оценки низкая и приоритет — пересъёмка.
- Не повторяй observations дословно, добавляй новую интерпретацию.

Популяционные нормы:
- Если во входных данных указана популяция east_asian, интерпретируй отклонения относительно east_asian-диапазонов, а не default.

Требования к aiRecommendations:
- Статус Attention: ровно 5 пунктов, обязательно минимум один пункт "Хирургия:" и один "План контроля:".
- Статус Monitor: ровно 4 пункта, обязательно один из "Косметология|Инъекции|Аппаратные" и один "План контроля:".
- Статус OK: ровно 3 пункта поддерживающей тактики.
- Каждый пункт должен:
  - начинаться с префикса: "Приоритет:", "Косметология:", "Инъекции:", "Аппаратные:", "Хирургия:" или "План контроля:";
  - быть конкретным (12-24 слова);
  - связывать действие с конкретной метрикой/пропорцией и целью коррекции;
  - включать якорь по числам с коротким пояснением: "(метрика — что это значит визуально: currentValue → цель targetValue)". Пример: "(соотношение высоты/ширины лица: 1.139 → цель 1.4, лицо визуально короче нормы)".
- Для статуса Monitor/Attention минимум 2 пункта должны содержать конкретные названия процедур (по уместности зоны и метрик).
- aiInsight: 2-3 предложения, максимум 60 слов.

Ограничения:
- Профессиональный нейтральный тон, без оценки привлекательности.
- Подача позитивная и поддерживающая: подчеркивай гармоничные черты и потенциал эстетического улучшения.
- Без медицинских диагнозов и без категоричных обещаний результата.
- Без общих бытовых советов без привязки к данным.

CRITICAL: Respond ONLY with a valid JSON object. No markdown, no explanation outside JSON.

Output schema:
{
  "features": [
    {
      "name": "ExactFeatureName",
      "aiInsight": "Интерпретация метрик с числами и статусом.",
      "aiRecommendations": [
        "Приоритет: ...",
        "Косметология: ...",
        "План контроля: ..."
      ]
    }
  ]
}

The "features" array must contain exactly as many objects as the input batch, preserving input order.`;

const SYSTEM_PROMPT_EN = `You are a plastic surgery and aesthetic medicine expert. Input contains only structured facial metrics (NO photos). Output must be clinically useful recommendations in English.

Interpretation rules:
- For each feature, use status + observations + measurements + confidence.
- If proportions are provided, analyze items with status="deviation" first, then status="close".
- aiInsight must include:
  1) one short positive opening about this facial area;
  2) 2-4 key metrics with numbers;
  3) second sentence exactly "Status: OK|Monitor|Attention";
  4) short clinical meaning of deviation or norm;
  5) if proportions are present use "label: userValue with ideal idealMin-idealMax";
  6) one separate sentence with selected-standard match (default/east_asian): "high/partial/low".
- If confidence < 0.35, explicitly mention low reliability and that re-capture is the top priority.
- Do not copy observations verbatim; add interpretation.

Population rules:
- If population is east_asian, interpret against east_asian ranges (not default).

aiRecommendations requirements:
- Attention: exactly 5 items, including at least one "Surgery:" and one "Follow-up plan:".
- Monitor: exactly 4 items, including one of "Cosmetology|Injections|Device-based" and one "Follow-up plan:".
- OK: exactly 3 supportive items.
- Each item must:
  - start with one prefix: "Priority:", "Cosmetology:", "Injections:", "Device-based:", "Surgery:", "Follow-up plan:";
  - be specific (12-24 words);
  - link action to a concrete metric/proportion and correction goal;
  - include numeric anchor and short visual meaning.
- For Monitor/Attention include at least 2 concrete procedure names.
- aiInsight: 2-3 sentences, max 60 words.

Constraints:
- Professional neutral tone, no attractiveness judgment.
- Positive and supportive framing.
- No medical diagnosis or guaranteed outcomes.
- No generic advice without data linkage.

CRITICAL:
- Respond ONLY with valid JSON. No markdown and no extra text outside JSON.
- If UI language is English, every aiInsight and aiRecommendations item must be in English only.

Output schema:
{
  "features": [
    {
      "name": "ExactFeatureName",
      "aiInsight": "Interpretation with metrics and status.",
      "aiRecommendations": [
        "Priority: ...",
        "Cosmetology: ...",
        "Follow-up plan: ..."
      ]
    }
  ]
}

The "features" array must contain exactly as many objects as the input batch, preserving input order.`;

export interface FeatureInput {
  name: string;
  status: string;
  observations: string[];
  measurements: Record<string, number | string>;
  proportions?: Array<{
    key: string;
    label: string;
    userValue: number;
    idealMin: number;
    idealMax: number;
    status: 'ideal' | 'close' | 'deviation';
    unit: string;
  }>;
  confidence: number;
}

export interface AIFeatureResult {
  name: string;
  aiInsight: string;
  aiRecommendations: string[];
}

export interface AnalyzeResponse {
  features: AIFeatureResult[];
}

function isValidAnalyzeResponse(value: unknown): value is AnalyzeResponse {
  return Boolean(
    value &&
      typeof value === 'object' &&
      Array.isArray((value as { features?: unknown }).features),
  );
}

function stripJsonFences(text: string): string {
  return text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
}

function extractBalancedJsonObject(text: string): string | null {
  const source = stripJsonFences(text);
  const start = source.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

function extractBalancedArrayAfterFeaturesKey(text: string): string | null {
  const source = stripJsonFences(text);
  const keyIdx = source.search(/"features"\s*:/);
  if (keyIdx < 0) return null;
  const arrStart = source.indexOf('[', keyIdx);
  if (arrStart < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = arrStart; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '[') depth += 1;
    if (ch === ']') {
      depth -= 1;
      if (depth === 0) return source.slice(arrStart, i + 1);
    }
  }
  return null;
}

function parseAnalyzeResponseLoose(text: string): AnalyzeResponse | null {
  const candidates: string[] = [];
  const stripped = stripJsonFences(text);
  if (stripped) candidates.push(stripped);

  const balancedObj = extractBalancedJsonObject(stripped);
  if (balancedObj) candidates.push(balancedObj);

  const featureArray = extractBalancedArrayAfterFeaturesKey(stripped);
  if (featureArray) candidates.push(`{"features":${featureArray}}`);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (isValidAnalyzeResponse(parsed)) return parsed;
    } catch {
      // try next candidate
    }
  }
  return null;
}

function hasCyrillic(text: string): boolean {
  return /[А-Яа-яЁё]/.test(text);
}

function mapInputStatusToGuidelineStatus(
  status: string,
): 'OK' | 'Monitor' | 'Attention' {
  if (status === 'attention') return 'Attention';
  if (status === 'within_norm' || status === 'strength') return 'OK';
  return 'Monitor';
}

function recommendationsForStatus(
  status: 'OK' | 'Monitor' | 'Attention',
): number {
  if (status === 'Attention') return 5;
  if (status === 'Monitor') return 4;
  return 3;
}

function populationLabel(population?: string): 'default' | 'east_asian' {
  return population === 'east_asian' ? 'east_asian' : 'default';
}

function standardMatchFromProportions(
  proportions?: FeatureInput['proportions'],
  language: UiLanguage = 'ru',
): 'высокое' | 'частичное' | 'низкое' | 'high' | 'partial' | 'low' {
  if (!Array.isArray(proportions) || proportions.length === 0) {
    return language === 'en' ? 'partial' : 'частичное';
  }
  const deviation = proportions.filter((p) => p?.status === 'deviation').length;
  const close = proportions.filter((p) => p?.status === 'close').length;
  if (deviation === 0 && close <= 1) return language === 'en' ? 'high' : 'высокое';
  if (deviation >= 2) return language === 'en' ? 'low' : 'низкое';
  return language === 'en' ? 'partial' : 'частичное';
}

function ensureStandardAlignmentInsight(
  text: string,
  population: 'default' | 'east_asian',
  proportions?: FeatureInput['proportions'],
  language: UiLanguage = 'ru',
): string {
  const clause = language === 'en'
    ? `Standard alignment with selected ${population} standard: ${standardMatchFromProportions(proportions, language)}.`
    : `Соответствие выбранному стандарту ${population}: ${standardMatchFromProportions(proportions, language)}.`;
  const trimmed = text.trim();
  if (!trimmed) return clause;
  if (language === 'en') {
    if (/alignment|standard/i.test(trimmed)) return trimmed;
  } else if (/соответств|стандарт/i.test(trimmed)) {
    return trimmed;
  }
  return `${clause} ${trimmed}`;
}

function normalizeAiResult(
  parsed: AnalyzeResponse,
  inputFeatures: FeatureInput[],
  population: 'default' | 'east_asian',
  language: UiLanguage = 'ru',
): AnalyzeResponse {
  const rawFeatures = Array.isArray(parsed?.features) ? parsed.features : [];

  const features: AIFeatureResult[] = inputFeatures.map((input, index) => {
    const byName = rawFeatures.find((f) => f?.name === input.name);
    const raw = byName ?? rawFeatures[index] ?? ({ name: input.name } as AIFeatureResult);
    const guidelineStatus = mapInputStatusToGuidelineStatus(input.status);
    const targetCount = recommendationsForStatus(guidelineStatus);

    const rawRecs = Array.isArray(raw.aiRecommendations)
      ? raw.aiRecommendations.filter((r) => typeof r === 'string' && r.trim().length > 0)
          .filter((r) => !(language === 'en' && hasCyrillic(r)))
      : [];
    const rawInsight = typeof raw.aiInsight === 'string' && raw.aiInsight.trim().length > 0
      ? raw.aiInsight
      : '';
    const insightAllowed = rawInsight.length > 0 && !(language === 'en' && hasCyrillic(rawInsight));

    return {
      name: input.name,
      aiInsight: insightAllowed
        ? ensureStandardAlignmentInsight(rawInsight, population, input.proportions, language)
        : '',
      aiRecommendations: rawRecs.slice(0, targetCount),
    };
  });

  return { features };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Метод не поддерживается' }));
    return;
  }

  const apiKey = resolveOpenAIKey();
  const model = resolveOpenAIModel();
  if (!apiKey) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error:
          'OPENAI_API_KEY не настроен на сервере. Для локального запуска добавьте ключ в .env.local и перезапустите `npm run dev`.',
      }),
    );
    return;
  }

  // Parse request body
  let body: { features?: FeatureInput[]; population?: string; language?: UiLanguage };
  try {
    const raw = await readBody(req);
    body = JSON.parse(raw);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Некорректный JSON в теле запроса' }));
    return;
  }

  const { features } = body;
  if (!features || !Array.isArray(features) || features.length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Требуется массив features' }));
    return;
  }
  const population = populationLabel(body.population);
  const language = languageLabel(body.language);
  const systemPrompt = language === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_RU;
  const populationNote =
    language === 'en'
      ? population !== 'default'
        ? `\nPopulation: ${population}. Apply this selected beauty standard for interpretation.\n`
        : '\nPopulation: default. Apply default selected beauty standard for interpretation.\n'
      : population !== 'default'
        ? `\nПопуляция: ${population}. Используй соответствующие популяционные нормы.\n`
        : '\nПопуляция: default. Используй стандартные нормы.\n';

  // Set up SSE streaming — flushHeaders() is required so the browser sees
  // the 200+SSE content-type immediately and doesn't wait for the first chunk;
  // without it the client fetch hangs until the server writes something.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    // Force flush after every SSE event so the browser receives it immediately
    (res as unknown as { flush?: () => void }).flush?.();
  };

  try {
    // 30-second hard timeout prevents the OpenAI call from hanging forever
    const client = new OpenAI({ apiKey, timeout: 30_000 });

    // Prepare minimal feature payload (no images, only measurements)
    const featurePayload = features.map((f) => ({
      name: f.name,
      status: f.status,
      observations: f.observations,
      measurements: f.measurements,
      proportions: f.proportions,
      confidence: Math.round(f.confidence * 100) / 100,
    }));

    // Split features into 2 parallel batches for ~2× speedup.
    // Each batch runs a separate OpenAI call simultaneously; results are merged in order.
    const mid = Math.ceil(featurePayload.length / 2);
    const batches = [featurePayload.slice(0, mid), featurePayload.slice(mid)];

    const requestBatchStream = async (batch: FeatureInput[]): Promise<string> => {
      const batchStream = await client.chat.completions.create({
        model,
        temperature: 0,
        max_tokens: 3500,
        stream: true,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: language === 'en'
              ? `UI language: English. Output language must be English.${populationNote}\nGenerate personalized AI recommendations for this facial analysis report.\nData:\n\n${JSON.stringify(batch)}`
              : `Сформируй персональные AI-рекомендации для этого отчёта анализа лица.${populationNote}\nДанные:\n\n${JSON.stringify(batch)}`,
          },
        ],
      });

      let batchText = '';
      for await (const chunk of batchStream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          batchText += delta;
          sendEvent({ partial: delta });
        }
      }
      return batchText;
    };

    const requestBatchRetry = async (batch: FeatureInput[]): Promise<string> => {
      const retryResponse = await client.chat.completions.create({
        model,
        temperature: 0,
        max_tokens: 3500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: language === 'en'
              ? `UI language: English. Output language must be English.\nReturn strict JSON only. No prose, no markdown fences.${populationNote}\nData:\n\n${JSON.stringify(batch)}`
              : `Верни строго JSON без пояснений и без markdown-блоков.${populationNote}\nДанные:\n\n${JSON.stringify(batch)}`,
          },
        ],
      });
      return retryResponse.choices?.[0]?.message?.content ?? '';
    };

    let parsed: AnalyzeResponse;
    const batchOutputs = await Promise.all(
      batches.map(async (batch) => {
        const text = await requestBatchStream(batch);
        return { batch, text };
      }),
    );

    // Merge parsed features from all batches preserving original order
    const allFeatures: AIFeatureResult[] = [];
    for (const output of batchOutputs) {
      let batchParsed = parseAnalyzeResponseLoose(output.text);
      if (!batchParsed) {
        // One retry without streaming improves reliability when streaming text gets malformed.
        const retryText = await requestBatchRetry(output.batch);
        batchParsed = parseAnalyzeResponseLoose(retryText);
      }
      if (!batchParsed) {
        throw new Error('GPT вернул некорректный JSON. Попробуйте ещё раз.');
      }
      allFeatures.push(...batchParsed.features);
    }
    parsed = { features: allFeatures };

    const normalized = normalizeAiResult(parsed, featurePayload, population, language);
    sendEvent({ done: true, result: normalized });
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    console.error('[/api/analyze] Error:', message);

    if (!res.writableEnded) {
      sendEvent({ done: true, error: message });
      res.end();
    }
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString();
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
