import type { FeatureName, ReportInputs, StatusLevel } from './types';
import { getCurrentLang } from './lib/language';
import ruData from './locales/ru';
import enData from './locales/en';
import type { Lang } from './lib/language';

const TRANSLATIONS: Record<Lang, Record<string, string>> = { ru: ruData, en: enData };

function t(key: string): string {
  const lang = getCurrentLang();
  return TRANSLATIONS[lang][key] ?? TRANSLATIONS.ru[key] ?? key;
}

export function featureLabel(name: string): string {
  return t(`f.${name}`) !== `f.${name}` ? t(`f.${name}`) : name;
}

export function statusLabel(status: StatusLevel): string {
  return t(`s.${status}`);
}

export function lightingLabel(lighting: ReportInputs['lightingHeuristic']): string {
  return t(`l.${lighting}`);
}

export function inputTypeLabel(type: ReportInputs['type']): string {
  const lang = getCurrentLang();
  const labels: Record<Lang, Record<string, string>> = {
    ru: { photo: 'фото', camera: 'камера' },
    en: { photo: 'photo', camera: 'camera' },
  };
  return labels[lang][type] ?? type;
}

export function deviceLabel(device: string): string {
  return t(`d.${device}`) !== `d.${device}` ? t(`d.${device}`) : device;
}

export function getLocaleCode(): string {
  return t('locale.code');
}

// ─── Measurement Info (tooltips) ──────────────────────────────────────────────

export interface MeasurementMeta {
  label: string;
  description: string;
}

const MEASUREMENT_INFO_RU: Record<string, MeasurementMeta> = {
  // ── Брови ──
  rightArchAngle: {
    label: 'Угол арки (левая)',
    description:
      'Угол изгиба правой брови в градусах, измеренный в точке наивысшего подъёма. Норма: 120–160°. Вычисляется по трём ключевым точкам брови.',
  },
  leftArchAngle: {
    label: 'Угол арки (правая)',
    description:
      'Угол изгиба левой брови в градусах. Измеряется аналогично правой. Норма: 120–160°.',
  },
  symmetryIndex: {
    label: 'Индекс симметрии',
    description:
      'Показывает симметричность левой и правой сторон. 1.0 — идеальная симметрия. Норма: выше 0.85. Рассчитывается как отношение разницы сторон к максимальному значению.',
  },
  rightLengthProxy: {
    label: 'Длина брови (левая)',
    description:
      'Длина правой брови относительно высоты лица. Расстояние от внутреннего до внешнего края, делённое на высоту лица.',
  },
  leftLengthProxy: {
    label: 'Длина брови (правая)',
    description:
      'Длина левой брови относительно высоты лица. Аналогично правой стороне.',
  },
  browToEyeDistance: {
    label: 'Расстояние бровь–глаз',
    description:
      'Вертикальный зазор между пиком брови и верхним веком, нормализованный к высоте лица. Норма: 0.02–0.09. Малые значения — низкие брови, большие — высокие.',
  },
  // ── Глаза ──
  rightEAR: {
    label: 'Открытость глаза (левый)',
    description:
      'Eye Aspect Ratio — соотношение вертикального и горизонтального размера глазной щели. Норма: 0.18–0.42. Низкие значения — узкий глаз, высокие — широко открытый.',
  },
  leftEAR: {
    label: 'Открытость глаза (правый)',
    description:
      'Аналогичный показатель для левого глаза. Сравнение с правым даёт информацию о симметрии. Норма: 0.18–0.42.',
  },
  interpupillaryDistance: {
    label: 'Межзрачковое расстояние',
    description:
      'Расстояние между центрами зрачков (нормализованное). Используется как базовая единица для расчёта многих пропорций лица.',
  },
  rightWidthRatio: {
    label: 'Ширина глаза (левый)',
    description:
      'Горизонтальный размер правой глазной щели относительно межзрачкового расстояния.',
  },
  leftWidthRatio: {
    label: 'Ширина глаза (правый)',
    description:
      'Горизонтальный размер левой глазной щели относительно межзрачкового расстояния.',
  },
  intercanthalToEyeWidth: {
    label: 'Межкантальное / ширина глаза',
    description:
      'Расстояние между внутренними уголками глаз ÷ средняя ширина глаза. По правилу «пятых» идеально ~1.0. Норма: 0.7–1.4.',
  },
  facialWidthToEyeWidth: {
    label: 'Ширина лица / ширина глаза',
    description:
      'Ширина лица по скулам ÷ средняя ширина глаза. Часть анализа «лицевых пятых» — горизонтальных пропорциональных зон.',
  },
  // ── Нос ──
  alarWidthToIPD: {
    label: 'Ширина носа / МЗР',
    description:
      'Ширина крыльев носа ÷ межзрачковое расстояние. Норма: 0.50–0.95. Классический канон: ширина носа ≈ расстояние между внутренними уголками глаз.',
  },
  alarWidthToIntercanthal: {
    label: 'Ширина носа / межкантальное',
    description:
      'Ширина крыльев носа ÷ расстояние между внутренними уголками глаз. Норма: 0.8–1.35. Идеал ~1.0.',
  },
  noseLengthRatio: {
    label: 'Длина носа',
    description:
      'Длина носа (от переносицы до кончика) ÷ высота лица. Норма: 0.12–0.28.',
  },
  // ── Щёки / Челюсть ──
  faceHeightWidthRatio: {
    label: 'Высота / ширина лица',
    description:
      'Высота лица ÷ ширина по скулам. Определяет форму лица. Норма: 1.15–1.58. Ниже 1.2 — круглое, выше 1.5 — вытянутое.',
  },
  biocularToFaceWidth: {
    label: 'Биокулярная / ширина лица',
    description:
      'Расстояние между наружными уголками глаз ÷ ширина лица по скулам. Показывает горизонтальные пропорции средней зоны.',
  },
  skinUniformity: {
    label: 'Однородность кожи',
    description:
      'Равномерность цвета кожи в зоне щёк (0–1). Норма: выше 0.7. Низкие значения — неравномерная пигментация.',
  },
  rednessIndex: {
    label: 'Индекс покраснения',
    description:
      'Отклонение красного канала от нейтрального баланса. Норма: ниже 0.06. Повышенные значения — покраснение, розацеа или чувствительность.',
  },
  // ── Челюсть ──
  jawWidthRatio: {
    label: 'Ширина челюсти',
    description:
      'Ширина челюсти (от угла до угла) ÷ ширина лица по скулам. Показывает массивность нижней челюсти.',
  },
  vShapeProxy: {
    label: 'V-форма лица',
    description:
      'Ширина челюсти ÷ ширина лба. Норма: 0.72–1.18. Ниже 0.8 — V-форма, выше 1.1 — квадратная форма.',
  },
  // ── Губы ──
  upperLowerRatio: {
    label: 'Верхняя / нижняя губа',
    description:
      'Высота верхней губы ÷ нижней. Классический идеал ~0.625 (1:1.6). Норма: 0.45–1.05.',
  },
  mouthWidthToIPD: {
    label: 'Ширина рта / МЗР',
    description:
      'Ширина рта ÷ межзрачковое расстояние. Показывает пропорциональность рта к средней зоне лица.',
  },
  mouthToNoseWidthRatio: {
    label: 'Ширина рта / ширина носа',
    description:
      'Ширина рта ÷ ширина крыльев носа. Норма: 1.15–1.95. Канон: рот шире носа примерно в 1.5 раза.',
  },
  cornerTilt: {
    label: 'Наклон уголков рта',
    description:
      'Угол линии уголков рта в градусах. 0° — ровная линия. Норма: ±6°. Положительные — правый уголок выше.',
  },
  // ── Подбородок ──
  chinHeightRatio: {
    label: 'Высота подбородка',
    description:
      'Расстояние от нижней губы до кончика подбородка ÷ высота лица. Норма: 0.10–0.27.',
  },
  faceThirdUpper: {
    label: 'Верхняя треть лица',
    description:
      'Доля верхней трети (от линии роста волос до бровей) в высоте лица. Идеал: ~0.33 (равные трети).',
  },
  faceThirdMiddle: {
    label: 'Средняя треть лица',
    description:
      'Доля средней трети (от бровей до основания носа) в высоте лица. Идеал: ~0.33.',
  },
  faceThirdLower: {
    label: 'Нижняя треть лица',
    description:
      'Доля нижней трети (от основания носа до подбородка) в высоте лица. Идеал: ~0.33.',
  },
  lowerFaceRatio: {
    label: 'Пропорция нижней части',
    description:
      'Расстояние от основания носа до линии смыкания губ ÷ от линии губ до подбородка. Норма: 0.25–0.80.',
  },
  // ── Кожа ──
  avgBrightness: {
    label: 'Яркость кожи',
    description:
      'Средняя яркость кожи в зоне щёк (0–255). Зависит от освещения и фототипа. Базовый ориентир.',
  },
  textureVariance: {
    label: 'Текстура кожи',
    description:
      'Вариативность яркости в зоне щёк. Норма: ниже 500. Высокие значения — неровности, расширенные поры.',
  },
  brightnessVariance: {
    label: 'Текстура кожи',
    description:
      'Вариативность яркости в зоне щёк. Норма: ниже 500. Высокие значения — неровности, расширенные поры.',
  },
  colorUniformity: {
    label: 'Однородность цвета',
    description:
      'Равномерность цвета кожи (0–1). Норма: выше 0.7. Основана на стандартном отклонении цветовых каналов.',
  },
  // ── Шея ──
  submentalContourProxyAngle: {
    label: 'Контур подбородок–шея',
    description:
      'Угол шейно-подбородочной зоны по профильному снимку. Норма: 95–145°. Меньший угол — более чёткий контур шеи.',
  },
  // ── Профильные метрики ──
  noseProjectionRatio: {
    label: 'Проекция носа (профиль)',
    description:
      'Горизонтальная проекция кончика носа от линии nasion–chin, нормализованная к высоте лица. Измеряется по профильному снимку.',
  },
  nasofrontalAngle: {
    label: 'Носолобный угол (NFA)',
    description:
      'Угол между глабеллой, насионом и кончиком носа. Идеал: жен. 130–145°, муж. 125–140°. Определяет глубину переносицы.',
  },
  nasolabialAngle: {
    label: 'Носогубный угол (NLA)',
    description:
      'Угол между колумеллой и верхней губой в точке subnasale. Идеал: жен. 95–115°, муж. 88–105°. Отражает наклон/ротацию кончика носа.',
  },
  chinProjectionRatio: {
    label: 'Проекция подбородка (профиль)',
    description:
      'Горизонтальное отстояние pogonion от линии nasion–subnasale. Положительные значения — выступающий подбородок.',
  },
  gonialAngle: {
    label: 'Гониальный угол',
    description:
      'Угол нижней челюсти в области gonion. Норма: 120–135°. Меньший угол — квадратная челюсть, больший — узкое лицо.',
  },
  lipProjectionRatio: {
    label: 'Проекция губ (E-line)',
    description:
      'Отстояние верхней губы от линии subnasale–pogonion (Ricketts E-line proxy). Положительные = губы выступают.',
  },
  malarProjectionProxy: {
    label: 'Выступание скул (профиль)',
    description:
      'Латеральная проекция скуловой области от средней линии, нормализованная к высоте лица. Отражает рельеф скул.',
  },
  // ── Мягкотканевые метрики ──
  softTissue_nPrnRatio: {
    label: 'Носовая проекция (ST)',
    description:
      'Мягкотканевое расстояние nasion→pronasale / nasion→pogonion. Показывает выступание носа в профиль. Ориентировочный показатель.',
  },
  softTissue_noseProtrusion: {
    label: 'Протрузия носа (ST)',
    description:
      'Горизонтальное отклонение кончика носа от линии n→pg. Положительные значения = нос выступает вперёд.',
  },
  softTissue_nasofrontalAngle: {
    label: 'Носолобный угол (ST)',
    description:
      'Угол glabella–nasion–pronasale по мягкотканевым ориентирам. Ориентировочный — не заменяет цефалометрический.',
  },
  softTissue_nasolabialAngle: {
    label: 'Носогубный угол (ST)',
    description:
      'Угол columella–subnasale–labiale superius. Ориентировочный мягкотканевый показатель.',
  },
  softTissue_cmSnRatio: {
    label: 'Длина колумеллы (ST)',
    description:
      'Расстояние columella→subnasale / n→pg. Отражает длину видимой части колумеллы в профиль.',
  },
  softTissue_snLsRatio: {
    label: 'Высота верхней губы (ST)',
    description:
      'Расстояние subnasale→labiale superius / n→pg. Высота верхней губы от основания носа до красной каймы.',
  },
  softTissue_lipProtrusion: {
    label: 'Протрузия губ (ST)',
    description:
      'Отстояние верхней губы от линии sn→pg. Ориентировочный мягкотканевый показатель проекции губ.',
  },
  softTissue_lsPgRatio: {
    label: 'Нижнее лицо ls→pg (ST)',
    description:
      'Расстояние labiale superius→pogonion / n→pg. Высота нижней части профиля.',
  },
  softTissue_gNRatio: {
    label: 'Глабелла–насион (ST)',
    description:
      'Расстояние glabella→nasion / n→pg. Глубина надбровной области. Ориентировочный показатель.',
  },
  softTissue_nPgDistance: {
    label: 'Дистанция n→pg (ST)',
    description:
      'Расстояние nasion→pogonion (в нормализованных координатах). Используется как базовая единица для soft-tissue метрик.',
  },
  softTissue_confidence: {
    label: 'Общий балл (ST)',
    description:
      'Общий балл мягкотканевого профильного анализа (0–1). Зависит от точности локализации ландмарков на профильном снимке.',
  },
};

const MEASUREMENT_INFO_EN: Record<string, MeasurementMeta> = {
  rightArchAngle: { label: 'Arch Angle (left)', description: 'Angle of the right eyebrow arch in degrees, measured at the highest point. Norm: 120–160°. Calculated from three key brow landmarks.' },
  leftArchAngle: { label: 'Arch Angle (right)', description: 'Left eyebrow arch angle in degrees. Measured similarly to the right. Norm: 120–160°.' },
  symmetryIndex: { label: 'Symmetry Index', description: 'Shows left-right symmetry. 1.0 = perfect symmetry. Norm: above 0.85. Calculated as the ratio of side difference to maximum value.' },
  rightLengthProxy: { label: 'Brow Length (left)', description: 'Right eyebrow length relative to face height. Distance from inner to outer edge divided by face height.' },
  leftLengthProxy: { label: 'Brow Length (right)', description: 'Left eyebrow length relative to face height. Same as right side.' },
  browToEyeDistance: { label: 'Brow-Eye Distance', description: 'Vertical gap between brow peak and upper eyelid, normalized to face height. Norm: 0.02–0.09. Low = low brows, high = high brows.' },
  rightEAR: { label: 'Eye Openness (left)', description: 'Eye Aspect Ratio — vertical/horizontal ratio of the eye opening. Norm: 0.18–0.42. Low = narrow eye, high = wide open.' },
  leftEAR: { label: 'Eye Openness (right)', description: 'Same metric for the left eye. Comparison with right gives symmetry info. Norm: 0.18–0.42.' },
  interpupillaryDistance: { label: 'Interpupillary Distance', description: 'Distance between pupil centers (normalized). Used as a base unit for many facial proportion calculations.' },
  rightWidthRatio: { label: 'Eye Width (left)', description: 'Horizontal size of the right eye opening relative to interpupillary distance.' },
  leftWidthRatio: { label: 'Eye Width (right)', description: 'Horizontal size of the left eye opening relative to interpupillary distance.' },
  intercanthalToEyeWidth: { label: 'Intercanthal / Eye Width', description: 'Distance between inner eye corners ÷ average eye width. Ideally ~1.0 (rule of fifths). Norm: 0.7–1.4.' },
  facialWidthToEyeWidth: { label: 'Face Width / Eye Width', description: 'Face width at cheekbones ÷ average eye width. Part of the facial fifths analysis — horizontal proportional zones.' },
  alarWidthToIPD: { label: 'Nose Width / IPD', description: 'Alar width ÷ interpupillary distance. Norm: 0.50–0.95. Classic canon: nose width ≈ intercanthal distance.' },
  alarWidthToIntercanthal: { label: 'Nose Width / Intercanthal', description: 'Alar width ÷ intercanthal distance. Norm: 0.8–1.35. Ideal ~1.0.' },
  noseLengthRatio: { label: 'Nose Length', description: 'Nose length (bridge to tip) ÷ face height. Norm: 0.12–0.28.' },
  faceHeightWidthRatio: { label: 'Face Height / Width', description: 'Face height ÷ cheekbone width. Determines face shape. Norm: 1.15–1.58. Below 1.2 = round, above 1.5 = elongated.' },
  biocularToFaceWidth: { label: 'Biocular / Face Width', description: 'Distance between outer eye corners ÷ cheekbone width. Shows horizontal proportions of the middle zone.' },
  skinUniformity: { label: 'Skin Uniformity', description: 'Skin color evenness in the cheek area (0–1). Norm: above 0.7. Low values indicate uneven pigmentation.' },
  rednessIndex: { label: 'Redness Index', description: 'Red channel deviation from neutral balance. Norm: below 0.06. High values indicate redness, rosacea, or sensitivity.' },
  jawWidthRatio: { label: 'Jaw Width', description: 'Jaw width (angle to angle) ÷ cheekbone width. Shows jawline massiveness.' },
  vShapeProxy: { label: 'V-Shape Index', description: 'Jaw width ÷ forehead width. Norm: 0.72–1.18. Below 0.8 = V-shape, above 1.1 = square shape.' },
  upperLowerRatio: { label: 'Upper / Lower Lip', description: 'Upper lip height ÷ lower. Classic ideal ~0.625 (1:1.6). Norm: 0.45–1.05.' },
  mouthWidthToIPD: { label: 'Mouth Width / IPD', description: 'Mouth width ÷ interpupillary distance. Shows mouth proportionality to the mid-face.' },
  mouthToNoseWidthRatio: { label: 'Mouth Width / Nose Width', description: 'Mouth width ÷ alar width. Norm: 1.15–1.95. Canon: mouth is ~1.5× wider than nose.' },
  cornerTilt: { label: 'Mouth Corner Tilt', description: 'Angle of the mouth corner line in degrees. 0° = level. Norm: ±6°. Positive = right corner higher.' },
  chinHeightRatio: { label: 'Chin Height', description: 'Distance from lower lip to chin tip ÷ face height. Norm: 0.10–0.27.' },
  faceThirdUpper: { label: 'Upper Face Third', description: 'Upper third proportion (hairline to brows) of face height. Ideal: ~0.33 (equal thirds).' },
  faceThirdMiddle: { label: 'Middle Face Third', description: 'Middle third proportion (brows to nose base) of face height. Ideal: ~0.33.' },
  faceThirdLower: { label: 'Lower Face Third', description: 'Lower third proportion (nose base to chin) of face height. Ideal: ~0.33.' },
  lowerFaceRatio: { label: 'Lower Face Ratio', description: 'Nose base to lip line ÷ lip line to chin. Norm: 0.25–0.80.' },
  avgBrightness: { label: 'Skin Brightness', description: 'Average skin brightness in the cheek area (0–255). Depends on lighting and phototype. Baseline reference.' },
  textureVariance: { label: 'Skin Texture', description: 'Brightness variance in the cheek area. Norm: below 500. High values indicate roughness, enlarged pores.' },
  brightnessVariance: { label: 'Skin Texture', description: 'Brightness variance in the cheek area. Norm: below 500. High values indicate roughness, enlarged pores.' },
  colorUniformity: { label: 'Color Uniformity', description: 'Skin color evenness (0–1). Norm: above 0.7. Based on color channel standard deviation.' },
  submentalContourProxyAngle: { label: 'Chin-Neck Contour', description: 'Cervicomental angle from profile photo. Norm: 95–145°. Lower angle = sharper neck contour.' },
  noseProjectionRatio: { label: 'Nose Projection (profile)', description: 'Horizontal projection of the nose tip from the nasion–chin line, normalized to face height. Measured from profile photo.' },
  nasofrontalAngle: { label: 'Nasofrontal Angle (NFA)', description: 'Angle between glabella, nasion, and nose tip. Ideal: female 130–145°, male 125–140°. Determines bridge depth.' },
  nasolabialAngle: { label: 'Nasolabial Angle (NLA)', description: 'Angle between columella and upper lip at subnasale. Ideal: female 95–115°, male 88–105°. Reflects nose tip tilt/rotation.' },
  chinProjectionRatio: { label: 'Chin Projection (profile)', description: 'Horizontal distance of pogonion from nasion–subnasale line. Positive values = projecting chin.' },
  gonialAngle: { label: 'Gonial Angle', description: 'Lower jaw angle at gonion. Norm: 120–135°. Smaller = square jaw, larger = narrow face.' },
  lipProjectionRatio: { label: 'Lip Projection (E-line)', description: 'Upper lip distance from subnasale–pogonion line (Ricketts E-line proxy). Positive = lips project forward.' },
  malarProjectionProxy: { label: 'Cheekbone Projection (profile)', description: 'Lateral projection of the malar area from midline, normalized to face height. Reflects cheekbone relief.' },
  softTissue_nPrnRatio: { label: 'Nasal Projection (ST)', description: 'Soft tissue distance nasion→pronasale / nasion→pogonion. Shows nose projection in profile. Indicative metric.' },
  softTissue_noseProtrusion: { label: 'Nose Protrusion (ST)', description: 'Horizontal deviation of the nose tip from n→pg line. Positive = nose projects forward.' },
  softTissue_nasofrontalAngle: { label: 'Nasofrontal Angle (ST)', description: 'Glabella–nasion–pronasale angle from soft tissue landmarks. Indicative — does not replace cephalometric.' },
  softTissue_nasolabialAngle: { label: 'Nasolabial Angle (ST)', description: 'Columella–subnasale–labiale superius angle. Indicative soft tissue metric.' },
  softTissue_cmSnRatio: { label: 'Columella Length (ST)', description: 'Columella→subnasale / n→pg distance. Reflects visible columella length in profile.' },
  softTissue_snLsRatio: { label: 'Upper Lip Height (ST)', description: 'Subnasale→labiale superius / n→pg. Upper lip height from nose base to vermilion border.' },
  softTissue_lipProtrusion: { label: 'Lip Protrusion (ST)', description: 'Upper lip distance from sn→pg line. Indicative soft tissue lip projection metric.' },
  softTissue_lsPgRatio: { label: 'Lower Face ls→pg (ST)', description: 'Labiale superius→pogonion / n→pg distance. Lower profile height.' },
  softTissue_gNRatio: { label: 'Glabella–Nasion (ST)', description: 'Glabella→nasion / n→pg distance. Brow ridge depth. Indicative metric.' },
  softTissue_nPgDistance: { label: 'Distance n→pg (ST)', description: 'Nasion→pogonion distance (normalized coordinates). Used as base unit for soft-tissue metrics.' },
  softTissue_confidence: { label: 'Overall Score (ST)', description: 'Overall soft tissue profile analysis score (0–1). Depends on landmark localization accuracy on the profile photo.' },
};

const MEASUREMENT_INFO: Record<Lang, Record<string, MeasurementMeta>> = {
  ru: MEASUREMENT_INFO_RU,
  en: MEASUREMENT_INFO_EN,
};

export function measurementInfo(key: string): MeasurementMeta {
  const lang = getCurrentLang();
  return MEASUREMENT_INFO[lang][key] ?? MEASUREMENT_INFO.ru[key] ?? { label: key, description: '' };
}
