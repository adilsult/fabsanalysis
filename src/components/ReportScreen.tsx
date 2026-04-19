import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import type { AnalysisReport, NormalizedLandmark, UserProfile } from '../types';
import type { LLMAnalysisResult, LLMStatus } from '../analysis/llm';
import FeatureCard from './FeatureCard';
import RadarInfographic from './RadarInfographic';
import SurveyPanel from './SurveyPanel';
import { downloadPDF } from '../analysis/exportPdf';
import { featureLabel, deviceLabel, lightingLabel } from '../i18n';
import { useLanguage, useT } from '../lib/language';
import { localizeNarrativeText } from '../lib/narrativeLocalization';

interface Props {
  report: AnalysisReport;
  frontImageDataUrl: string | null;
  profileImageDataUrls: { left?: string; right?: string };
  profileMaskDataUrls?: { left?: string; right?: string };
  profileLandmarks?: { left?: NormalizedLandmark[] | null; right?: NormalizedLandmark[] | null };
  profileLandmarkSource?: { left?: 'ai' | 'contour' | 'mediapipe'; right?: 'ai' | 'contour' | 'mediapipe' };
  profileLandmarkConfidence?: { left?: number; right?: number };
  landmarks: NormalizedLandmark[] | null;
  precomputedTransforms: Partial<Record<string, string>>;
  aiStatus: LLMStatus;
  aiResult: LLMAnalysisResult | null;
  aiError: string | null;
  userProfile: UserProfile | null;
  onSurveyComplete: (profile: UserProfile) => void;
}

export default function ReportScreen({
  report,
  frontImageDataUrl,
  profileImageDataUrls,
  profileMaskDataUrls,
  profileLandmarks,
  profileLandmarkSource,
  profileLandmarkConfidence,
  landmarks,
  precomputedTransforms,
  aiResult,
  userProfile,
  onSurveyComplete,
}: Props) {
  const t = useT();
  const { lang } = useLanguage();
  const [surveyCompletedInReport, setSurveyCompletedInReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | number>('general');
  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const featureTopRef = useRef<HTMLDivElement>(null);
  const shouldScrollAfterTabChangeRef = useRef(false);

  const avgConfidence =
    report.features.reduce((sum, f) => sum + f.confidence, 0) / report.features.length;


  const enhancedReport = useMemo(() => (aiResult
    ? {
        ...report,
        features: report.features.map((f) => {
          const ai = aiResult.features.find((a) => a.name === f.name);
          return ai ? { ...f, recommendations: ai.aiRecommendations } : f;
        }),
      }
    : report), [aiResult, report]);

  // Scroll active tab into view
  useEffect(() => {
    const idx = activeTab === 'general' ? 0 : (activeTab as number) + 1;
    const btn = tabRefs.current[idx];
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  // Scroll selected content section to top when switching tabs.
  useEffect(() => {
    if (!shouldScrollAfterTabChangeRef.current) return;
    shouldScrollAfterTabChangeRef.current = false;
    const target = activeTab === 'general'
      ? contentRef.current
      : featureTopRef.current;
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activeTab]);

  const handleTabClick = useCallback((tab: 'general' | number) => {
    shouldScrollAfterTabChangeRef.current = true;
    setActiveTab(tab);
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      {/* Header — only for General tab */}
      {activeTab === 'general' && (
        <div className="text-center mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">{t('report.title')}</h1>
          <p className="text-sm sm:text-base text-gray-500">
            {t('report.createdAt')} {new Date(report.meta.date).toLocaleString(t('locale.code'))}
          </p>
        </div>
      )}

      {/* Horizontal scrollable tab bar */}
      <div className="sticky top-12 z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 pb-2 mb-4 sm:mb-6 bg-gray-50/95 backdrop-blur-sm border-b border-gray-100">
        <div
          ref={tabBarRef}
          className="flex gap-1 overflow-x-auto pb-1 pt-2 hide-scrollbar"
        >
          {/* General tab */}
          <button
            ref={(el) => { tabRefs.current[0] = el; }}
            onClick={() => handleTabClick('general')}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'general'
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t('report.generalTab')}
          </button>

          {/* Feature tabs */}
          {report.features.map((f, i) => (
            <button
              key={f.name}
              ref={(el) => { tabRefs.current[i + 1] = el; }}
              onClick={() => handleTabClick(i)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === i
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {featureLabel(f.name)}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div ref={contentRef} className="scroll-mt-28">
        {activeTab === 'general' ? (
          <>
            {/* Status summary removed — radar chart provides visual overview */}

            <RadarInfographic features={report.features} />

            {/* Navigate to first feature */}
            {report.features.length > 0 && (
              <div className="flex items-center justify-end mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    handleTabClick(0);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 text-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-brand-700 transition-colors"
                >
                  {featureLabel(report.features[0].name)}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div ref={featureTopRef} className="scroll-mt-28">
              <FeatureCard
                key={report.features[activeTab as number].name}
                feature={report.features[activeTab as number]}
                index={activeTab as number}
                aiResult={aiResult?.features.find((a) => a.name === report.features[activeTab as number].name)}
                frontImageDataUrl={frontImageDataUrl}
                landmarks={landmarks}
                profileImageDataUrls={profileImageDataUrls}
                profileMaskDataUrls={profileMaskDataUrls}
                profileLandmarks={profileLandmarks}
                profileLandmarkSource={profileLandmarkSource}
                profileLandmarkConfidence={profileLandmarkConfidence}
                precomputedTransformDataUrl={precomputedTransforms[report.features[activeTab as number].name] ?? null}
                gender={userProfile?.gender}
                population={userProfile?.population ?? 'default'}
                defaultExpanded
              />
            </div>

            {/* Prev / Next navigation */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  const idx = activeTab as number;
                  if (idx > 0) {
                    handleTabClick(idx - 1);
                  } else {
                    handleTabClick('general');
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                {(activeTab as number) > 0
                  ? featureLabel(report.features[(activeTab as number) - 1].name)
                  : t('report.prevGeneral')}
              </button>

              {(activeTab as number) < report.features.length - 1 && (
                <button
                  onClick={() => {
                    handleTabClick((activeTab as number) + 1);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 text-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-brand-700 transition-colors"
                >
                  {featureLabel(report.features[(activeTab as number) + 1].name)}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Profile completion card — shown if survey was not completed during scan */}
      {!userProfile && !surveyCompletedInReport && (
        <div className="mb-6 mt-6 border-2 border-dashed border-amber-300 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 bg-amber-50 px-5 py-3.5 border-b border-amber-200">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800 font-sans">{t('report.profileTitle')}</p>
              <p className="text-xs text-amber-600 font-sans mt-0.5">{t('report.profileHint')}</p>
            </div>
          </div>
          <div className="p-5 bg-white">
            <SurveyPanel
              context="report"
              onComplete={(profile) => {
                onSurveyComplete(profile);
                setSurveyCompletedInReport(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl mb-8 mt-6">
        <h3 className="font-semibold text-amber-800 mb-2">{t('report.disclaimer')}</h3>
        <p className="text-sm text-amber-700 leading-relaxed">{localizeNarrativeText(report.disclaimer, lang)}</p>
      </div>

      {/* Technical metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6 sm:mb-8">
        <SummaryCard
          label={t('report.quality')}
          value={`${Math.round(report.inputs.qualityScore * 100)}%`}
          sub={`${lightingLabel(report.inputs.lightingHeuristic)} ${t('report.lighting')}`}
        />
        <SummaryCard
          label={t('report.faceAccuracy')}
          value={`${Math.round(report.faceDetection.confidence * 100)}%`}
          sub={`${report.landmarks.count} ${t('report.points')}`}
        />
        <SummaryCard
          label={t('report.avgAccuracy')}
          value={`${Math.round(avgConfidence * 100)}%`}
          sub={t('report.byFeatures')}
        />
        <SummaryCard
          label={t('report.processing')}
          value={`${report.meta.processingTime}ms`}
          sub={deviceLabel(report.meta.device)}
        />
      </div>

      {/* Export actions */}
      <div className="flex gap-2.5 sm:gap-3">
        <button
          onClick={() => downloadPDF({
            report: enhancedReport,
            frontImageDataUrl,
            profileImageDataUrls,
            aiResult,
          })}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {t('report.downloadPdf')}
        </button>
      </div>
    </div>
  );
}


function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
      <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide mb-0.5 sm:mb-1">{label}</div>
      <div className="text-lg sm:text-xl font-bold text-gray-900">{value}</div>
      <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5">{sub}</div>
    </div>
  );
}
