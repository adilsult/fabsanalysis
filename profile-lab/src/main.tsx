import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { loadSamModels, segmentFaceProfile } from '@analysis/mobileSam';
import { detectProfileContourFromMask } from '@analysis/profileContourDetector';

type Side = 'left' | 'right';
type SexLabel = 'male' | 'female' | 'unknown';
type LogEntry = { type: 'info' | 'ok' | 'warn' | 'err'; text: string };

type LandmarkResult = {
  side: Side;
  source: string;
  overallConfidence: number;
  landmarks: Record<string, { index: number; x: number; y: number; confidence: number }> | null;
  landmarkEntries: [number, number, number, number][];
  reason?: string;
};

const LANDMARK_COLORS: Record<string, string> = {
  g: '#a78bfa', n: '#60a5fa', prn: '#34d399', cm: '#fbbf24', sn: '#f97316', ls: '#f472b6', pg: '#94a3b8',
};
const LM_ORDER = ['g', 'n', 'prn', 'cm', 'sn', 'ls', 'pg'];
const LM_LABELS: Record<string, string> = {
  g: 'Глабелла', n: 'Назион', prn: 'Кончик носа',
  cm: 'Колумелла', sn: 'Субназале', ls: 'Верхняя губа', pg: 'Погонион',
};

function angle3pt(a: {x:number;y:number}, b: {x:number;y:number}, c: {x:number;y:number}) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (mag < 1e-9) return NaN;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

function drawCanvas(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  result: LandmarkResult | null,
  contourPts: {x:number;y:number}[],
  corrected: Record<string, number>,
  annotMode: boolean,
) {
  const ctx = canvas.getContext('2d')!;
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);
  if (!result?.landmarks) return;

  const W = canvas.width, H = canvas.height;

  // Draw contour in annotation mode
  if (annotMode && contourPts.length > 1) {
    ctx.beginPath();
    ctx.moveTo(contourPts[0].x, contourPts[0].y);
    for (let i = 1; i < contourPts.length; i++) ctx.lineTo(contourPts[i].x, contourPts[i].y);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Angle lines
  const lm = result.landmarks;
  if (lm.g && lm.n && lm.prn) {
    const getPt = (k: string) => {
      const idx = corrected[k] ?? -1;
      return idx >= 0 && contourPts[idx] ? contourPts[idx] : { x: lm[k].x, y: lm[k].y };
    };
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const gp = getPt('g'), np = getPt('n'), pp = getPt('prn');
    ctx.moveTo(gp.x, gp.y); ctx.lineTo(np.x, np.y); ctx.lineTo(pp.x, pp.y);
    ctx.stroke();
  }
  if (lm.prn && lm.sn && lm.ls) {
    const getPt = (k: string) => {
      const idx = corrected[k] ?? -1;
      return idx >= 0 && contourPts[idx] ? contourPts[idx] : { x: lm[k].x, y: lm[k].y };
    };
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const pp = getPt('prn'), sp = getPt('sn'), lp = getPt('ls');
    ctx.moveTo(pp.x, pp.y); ctx.lineTo(sp.x, sp.y); ctx.lineTo(lp.x, lp.y);
    ctx.stroke();
  }

  // Draw landmarks
  for (const key of LM_ORDER) {
    const lmEntry = lm[key];
    if (!lmEntry) continue;
    const color = LANDMARK_COLORS[key] ?? '#fff';
    const autoIdx = lmEntry.index;
    const corrIdx = corrected[key] ?? autoIdx;
    const autoPt = contourPts[autoIdx] ?? { x: lmEntry.x, y: lmEntry.y };
    const corrPt = contourPts[corrIdx] ?? autoPt;

    if (annotMode && corrIdx !== autoIdx) {
      // Hollow circle at auto position
      ctx.beginPath();
      ctx.arc(autoPt.x, autoPt.y, 5, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Connecting line
      ctx.beginPath();
      ctx.moveTo(autoPt.x, autoPt.y);
      ctx.lineTo(corrPt.x, corrPt.y);
      ctx.strokeStyle = color + '66';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Solid dot at corrected (or auto) position
    const drawPt = annotMode ? corrPt : { x: lmEntry.x, y: lmEntry.y };
    ctx.beginPath();
    ctx.arc(drawPt.x, drawPt.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const label = `${key} — ${LM_LABELS[key] ?? key}`;
    ctx.font = 'bold 12px sans-serif';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(label, drawPt.x + 9, drawPt.y + 5);
    ctx.fillStyle = color;
    ctx.fillText(label, drawPt.x + 9, drawPt.y + 5);
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);
  const maskRef   = useRef<any>(null);

  const [logs, setLogs]     = useState<LogEntry[]>([{ type: 'info', text: 'Ready. Upload profile photos.' }]);
  const [side, setSide]     = useState<Side>('left');
  const [result, setResult] = useState<LandmarkResult | null>(null);
  const [busy, setBusy]     = useState(false);
  const [samLoaded, setSamLoaded] = useState(false);

  // Annotation state
  const [contourPts, setContourPts]   = useState<{x:number;y:number}[]>([]);
  const [corrected, setCorrected]     = useState<Record<string, number>>({});
  const [annotMode, setAnnotMode]     = useState(false);
  const [dragLm, setDragLm]           = useState<string | null>(null);
  const [imageQueue, setImageQueue]   = useState<File[]>([]);
  const [queueIdx, setQueueIdx]       = useState(0);
  const [currentFilename, setCurrentFilename] = useState('');
  const [sexLabel, setSexLabel]       = useState<SexLabel>('unknown');

  // Refs to avoid stale closures in mouse handlers
  const contourRef   = useRef<{x:number;y:number}[]>([]);
  const correctedRef = useRef<Record<string, number>>({});
  const resultRef    = useRef<LandmarkResult | null>(null);
  const dragLmRef    = useRef<string | null>(null);
  const annotModeRef = useRef(false);
  const logsRef      = useRef<LogEntry[]>([{ type: 'info', text: 'Ready. Upload profile photos.' }]);

  // Keep refs in sync
  useEffect(() => { contourRef.current = contourPts; }, [contourPts]);
  useEffect(() => { correctedRef.current = corrected; }, [corrected]);
  useEffect(() => { resultRef.current = result; }, [result]);
  useEffect(() => { dragLmRef.current = dragLm; }, [dragLm]);
  useEffect(() => { annotModeRef.current = annotMode; }, [annotMode]);

  const addLog = useCallback((type: LogEntry['type'], text: string) => {
    logsRef.current = [...logsRef.current, { type, text: `[${new Date().toLocaleTimeString()}] ${text}` }];
    setLogs([...logsRef.current]);
  }, []);

  const redraw = useCallback(() => {
    if (!canvasRef.current || !imgRef.current) return;
    drawCanvas(canvasRef.current, imgRef.current, resultRef.current, contourRef.current, correctedRef.current, annotModeRef.current);
  }, []);

  // Redraw when annotation state changes
  useEffect(() => { redraw(); }, [corrected, annotMode, redraw]);

  const loadFile = useCallback((file: File) => {
    setCurrentFilename(file.name);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      maskRef.current = null;
      setResult(null);
      setContourPts([]);
      setCorrected({});
      contourRef.current = [];
      correctedRef.current = {};
      resultRef.current = null;
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')!;
        canvasRef.current.width = img.naturalWidth;
        canvasRef.current.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
      }
      addLog('info', `Loaded ${file.name} — ${img.naturalWidth}×${img.naturalHeight}px`);
    };
    img.src = url;
  }, [addLog]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    setImageQueue(arr);
    setQueueIdx(0);
    loadFile(arr[0]);
    if (arr.length > 1) addLog('info', `Queue: ${arr.length} images loaded`);
  }, [loadFile, addLog]);

  const runSam = useCallback(async () => {
    if (!imgRef.current) { addLog('err', 'No image loaded'); return; }
    setBusy(true);
    try {
      if (!samLoaded) {
        addLog('info', 'Loading SAM models (~43MB, one time)…');
        await loadSamModels();
        setSamLoaded(true);
        addLog('ok', 'SAM models loaded');
      }
      addLog('info', `Running MobileSAM (side=${side})…`);
      const img = imgRef.current;
      const offscreen = document.createElement('canvas');
      offscreen.width = img.naturalWidth;
      offscreen.height = img.naturalHeight;
      offscreen.getContext('2d')!.drawImage(img, 0, 0);
      const samResult = await segmentFaceProfile(offscreen, side);
      if (!samResult) { addLog('warn', 'SAM returned null'); return; }

      const imgDataMask = new ImageData(samResult.width, samResult.height);
      for (let i = 0; i < samResult.mask.length; i++) {
        if (samResult.mask[i]) {
          imgDataMask.data[i*4]=0; imgDataMask.data[i*4+1]=200;
          imgDataMask.data[i*4+2]=80; imgDataMask.data[i*4+3]=100;
        }
      }
      maskRef.current = { mask: samResult.mask, width: samResult.width, height: samResult.height };
      addLog('ok', `SAM done — ${samResult.width}×${samResult.height}`);

      if (canvasRef.current && imgRef.current) {
        const ctx = canvasRef.current.getContext('2d')!;
        canvasRef.current.width = imgRef.current.naturalWidth;
        canvasRef.current.height = imgRef.current.naturalHeight;
        ctx.drawImage(imgRef.current, 0, 0);
        ctx.putImageData(imgDataMask, 0, 0);
      }
    } catch (err) {
      addLog('err', `SAM failed: ${err}`);
    } finally {
      setBusy(false);
    }
  }, [side, samLoaded, addLog]);

  const runLandmarks = useCallback(async () => {
    if (!imgRef.current) { addLog('err', 'No image loaded'); return; }
    setBusy(true);
    try {
      const img = imgRef.current;
      const W = img.naturalWidth, H = img.naturalHeight;
      let contourTuples: [number, number, number][] = [];

      if (maskRef.current) {
        addLog('info', 'Extracting contour from SAM mask…');
        const sam = maskRef.current;
        const contourResult = detectProfileContourFromMask(sam.mask, sam.width, sam.height, side);
        if (contourResult && contourResult.contourPoints.length >= 30) {
          contourTuples = contourResult.contourPoints.map((pt, i) => [i, Math.round(pt.x), Math.round(pt.y)]);
          addLog('ok', `Contour: ${contourTuples.length} points`);
        } else {
          addLog('warn', `Contour too short (${contourResult?.contourPoints.length ?? 0})`);
        }
      }

      if (contourTuples.length < 30) {
        addLog('warn', 'Using brightness-threshold fallback');
        const offscreen = document.createElement('canvas');
        offscreen.width = W; offscreen.height = H;
        const ctx = offscreen.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, W, H);
        const pts: [number,number,number][] = [];
        for (let y = 0; y < H; y += 2) {
          if (side === 'left') {
            for (let x = 0; x < W; x++) {
              const i = (y * W + x) * 4;
              if ((imageData.data[i]+imageData.data[i+1]+imageData.data[i+2])/3 > 30) { pts.push([pts.length,x,y]); break; }
            }
          } else {
            for (let x = W-1; x >= 0; x--) {
              const i = (y * W + x) * 4;
              if ((imageData.data[i]+imageData.data[i+1]+imageData.data[i+2])/3 > 30) { pts.push([pts.length,x,y]); break; }
            }
          }
        }
        contourTuples = pts;
        addLog('info', `Fallback: ${pts.length} points`);
      }

      if (contourTuples.length < 30) { addLog('err', 'Not enough contour points'); return; }

      // Store contour pts for annotation drag snapping
      const pts = contourTuples.map(([, x, y]) => ({ x, y }));
      setContourPts(pts);
      contourRef.current = pts;
      setCorrected({});
      correctedRef.current = {};

      addLog('info', `Calling /api/profile-landmarks (side=${side})…`);
      const t0 = Date.now();
      const res = await fetch('/api/profile-landmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profiles: [{ side, imageWidth: W, imageHeight: H, contourPointsTopToBottom: contourTuples }] }),
      });
      const data = await res.json();
      addLog('info', `API: ${Date.now()-t0}ms`);

      const profile = data.profiles?.[0];
      if (!profile) { addLog('err', 'No profile in response'); return; }

      addLog(
        profile.source === 'ai' ? 'ok' : 'warn',
        `source=${profile.source} conf=${profile.overallConfidence?.toFixed(3)}${profile.reason ? ' '+profile.reason : ''}`,
      );

      if (profile.landmarks) {
        for (const [k, v] of Object.entries(profile.landmarks as Record<string,any>)) {
          addLog('info', `  ${k}: idx=${v.index} conf=${v.confidence?.toFixed(2)}`);
        }
        const lm = profile.landmarks as Record<string,{x:number;y:number}>;
        if (lm.g && lm.n && lm.prn) {
          const nfa = angle3pt(lm.g, lm.n, lm.prn);
          addLog(nfa>=95&&nfa<=170?'ok':'warn', `NFA=${nfa.toFixed(1)}° (ideal 115-140°)`);
        }
        if (lm.prn && lm.sn && lm.ls) {
          const nla = angle3pt(lm.prn, lm.sn, lm.ls);
          addLog(nla>=85&&nla<=115?'ok':'warn', `NLA=${nla.toFixed(1)}° (ideal 90-110°)`);
        }
      }

      setResult(profile);
      resultRef.current = profile;
      if (canvasRef.current && imgRef.current) {
        drawCanvas(canvasRef.current, imgRef.current, profile, pts, {}, annotModeRef.current);
      }
    } catch (err) {
      addLog('err', `Error: ${err}`);
    } finally {
      setBusy(false);
    }
  }, [side, addLog]);

  // ── Canvas mouse handlers for annotation drag ────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!annotModeRef.current || !resultRef.current?.landmarks) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * sx;
    const cy = (e.clientY - rect.top) * sy;

    let nearestLm: string | null = null;
    let nearestDist = 20 * sx; // 20px threshold in display coords
    for (const [key, lmEntry] of Object.entries(resultRef.current.landmarks!)) {
      const idx = correctedRef.current[key] ?? lmEntry.index;
      const pt = contourRef.current[idx] ?? { x: lmEntry.x, y: lmEntry.y };
      const dist = Math.hypot(pt.x - cx, pt.y - cy);
      if (dist < nearestDist) { nearestDist = dist; nearestLm = key; }
    }
    if (nearestLm) {
      setDragLm(nearestLm);
      dragLmRef.current = nearestLm;
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragLmRef.current || !annotModeRef.current) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * sx;
    const cy = (e.clientY - rect.top) * sy;

    const pts = contourRef.current;
    let nearestIdx = 0, nearestDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - cx, pts[i].y - cy);
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    }
    const lm = dragLmRef.current;
    const next = { ...correctedRef.current, [lm]: nearestIdx };
    correctedRef.current = next;
    setCorrected(next);
    redraw();
  }, [redraw]);

  const handleMouseUp = useCallback(() => {
    if (dragLmRef.current) { setDragLm(null); dragLmRef.current = null; }
  }, []);

  // ── Save annotation ──────────────────────────────────────────────────────
  const saveAnnotation = useCallback(async (skipAll = false) => {
    if (!result?.landmarks || !imgRef.current) return;
    const auto: Record<string, number> = {};
    const autoConf: Record<string, number> = {};
    for (const [k, v] of Object.entries(result.landmarks)) {
      auto[k] = v.index;
      autoConf[k] = v.confidence;
    }
    const corrFinal: Record<string, number> = skipAll ? { ...auto } : { ...auto, ...corrected };
    const payload = {
      filename: currentFilename,
      side,
      sex: sexLabel,
      gender: sexLabel === 'unknown' ? null : sexLabel,
      imageWidth: imgRef.current.naturalWidth,
      imageHeight: imgRef.current.naturalHeight,
      contourLength: contourPts.length,
      auto,
      corrected: corrFinal,
      autoConfidences: autoConf,
      overallConfidence: result.overallConfidence,
      skipped: skipAll,
      timestamp: Date.now(),
    };
    try {
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        addLog('ok', `Saved annotation for ${currentFilename} (sex=${sexLabel})`);
      } else {
        const errText = await res.text().catch(() => '');
        addLog('err', `Save failed: ${res.status}${errText ? ` ${errText.slice(0, 160)}` : ''}`);
      }
    } catch (err) {
      addLog('err', `Save error: ${err}`);
    }
  }, [result, side, sexLabel, contourPts, corrected, currentFilename, addLog]);

  const loadNext = useCallback(() => {
    const nextIdx = queueIdx + 1;
    if (nextIdx >= imageQueue.length) { addLog('info', 'Queue complete!'); return; }
    setQueueIdx(nextIdx);
    loadFile(imageQueue[nextIdx]);
  }, [queueIdx, imageQueue, loadFile, addLog]);

  const saveAndNext = useCallback(async () => {
    await saveAnnotation(false);
    loadNext();
  }, [saveAnnotation, loadNext]);

  const clearLog = () => { logsRef.current = []; setLogs([]); };

  const queueProgress = imageQueue.length > 1
    ? `${queueIdx + 1} / ${imageQueue.length}`
    : null;

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>

      {/* ── Left column: controls + log ──────────────────────────── */}
      <div style={{ minWidth: 240, maxWidth: 280 }}>
        {/* Image panel */}
        <div style={{ background:'#1a1a1a', border:'1px solid #333', borderRadius:8, padding:12, marginBottom:12 }}>
          <div style={{ fontSize:11, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>
            Image {queueProgress && <span style={{ color:'#7dd3fc' }}>({queueProgress})</span>}
          </div>
          <input type="file" id="file-input" accept="image/*" multiple
            onChange={e => handleFiles(e.target.files)} style={{ display:'none' }} />
          <label htmlFor="file-input"
            style={{ display:'inline-block', background:'#374151', color:'white', padding:'8px 16px', borderRadius:4, cursor:'pointer', fontSize:13, marginBottom:8 }}>
            Upload Photo(s)
          </label>
          <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4 }}>Side:</div>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            {(['left','right'] as Side[]).map(s => (
              <button key={s} onClick={() => setSide(s)}
                style={{ flex:1, padding:'6px', border:`2px solid ${side===s?'#7dd3fc':'#374151'}`, background:'transparent',
                  color:side===s?'#7dd3fc':'#94a3b8', borderRadius:4, cursor:'pointer', fontSize:12 }}>
                {s}
              </button>
            ))}
          </div>
          <button onClick={runSam} disabled={busy} style={{ width:'100%', marginBottom:6 }}>
            {busy ? '…' : '1. Run SAM Mask'}
          </button>
          <button onClick={runLandmarks} disabled={busy} style={{ width:'100%', background:'#065f46' }}>
            {busy ? '…' : '2. Find Landmarks'}
          </button>
        </div>

        {/* Result summary */}
        {result && (
          <div style={{ background:'#1a1a1a', border:'1px solid #333', borderRadius:8, padding:12, marginBottom:12, fontSize:12 }}>
            <div style={{ fontSize:11, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Result</div>
            <div>Source: <span style={{ color:result.source==='ai'?'#34d399':'#fbbf24' }}>{result.source}</span></div>
            <div>Confidence: <span style={{ color:'#34d399' }}>{result.overallConfidence?.toFixed(3)}</span></div>
            {result.reason && <div style={{ color:'#fbbf24', fontSize:11 }}>{result.reason}</div>}
          </div>
        )}

        {/* Annotation panel */}
        {result?.landmarks && (
          <div style={{ background:'#1a1a1a', border:`1px solid ${annotMode?'#7dd3fc':'#333'}`, borderRadius:8, padding:12, marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:11, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1 }}>Annotation</span>
              <button onClick={() => setAnnotMode(m => !m)}
                style={{ padding:'3px 10px', fontSize:11, background: annotMode ? '#1d4ed8' : '#374151' }}>
                {annotMode ? '● ON' : '○ OFF'}
              </button>
            </div>
            {annotMode && (
              <div style={{ fontSize:11, color:'#94a3b8', marginBottom:8 }}>
                Drag dots to correct. Snaps to contour.
              </div>
            )}
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4 }}>Sex label:</div>
              <div style={{ display:'flex', gap:6 }}>
                {([
                  { key: 'male', label: 'Male' },
                  { key: 'female', label: 'Female' },
                  { key: 'unknown', label: 'Unknown' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setSexLabel(opt.key)}
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      fontSize: 11,
                      border: `1px solid ${sexLabel === opt.key ? '#7dd3fc' : '#374151'}`,
                      background: sexLabel === opt.key ? '#1d4ed8' : '#374151',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <button onClick={() => saveAnnotation(false)} style={{ flex:1, background:'#065f46', fontSize:12 }}>
                Save
              </button>
              <button onClick={() => saveAnnotation(true)} style={{ flex:1, background:'#374151', fontSize:12 }}>
                Skip
              </button>
              {imageQueue.length > 1 && queueIdx + 1 < imageQueue.length && (
                <button onClick={saveAndNext} style={{ width:'100%', marginTop:4, background:'#1d4ed8', fontSize:12 }}>
                  Save & Next →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Log */}
        <div style={{ background:'#1a1a1a', border:'1px solid #333', borderRadius:8, padding:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontSize:11, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1 }}>Log</span>
            <button onClick={clearLog} style={{ padding:'2px 8px', fontSize:11, background:'#374151' }}>clear</button>
          </div>
          <div style={{ background:'#0a0a0a', border:'1px solid #222', borderRadius:4, padding:8, height:320, overflowY:'auto', fontSize:11, lineHeight:1.6 }}>
            {logs.map((l, i) => (
              <div key={i} style={{ color: l.type==='ok'?'#34d399':l.type==='err'?'#f87171':l.type==='warn'?'#fbbf24':'#7dd3fc' }}>
                {l.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right column: canvas + delta table ───────────────────── */}
      <div style={{ flex:1, minWidth:300 }}>
        <div style={{ background:'#1a1a1a', border:'1px solid #333', borderRadius:8, padding:12, marginBottom:12 }}>
          <div style={{ fontSize:11, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>
            Visualization {annotMode && <span style={{ color:'#7dd3fc' }}>(annotation mode — drag dots)</span>}
          </div>
          <canvas ref={canvasRef}
            style={{ display:'block', border:'1px solid #333', borderRadius:4, maxWidth:'100%', cursor: annotMode ? 'crosshair' : 'default' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
          <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:8 }}>
            {Object.entries(LANDMARK_COLORS).map(([k, c]) => (
              <span key={k} style={{ fontSize:11, color:c }}>● {k}</span>
            ))}
          </div>
        </div>

        {/* Delta table */}
        {result?.landmarks && (
          <div style={{ background:'#1a1a1a', border:'1px solid #333', borderRadius:8, padding:12 }}>
            <div style={{ fontSize:11, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>
              Landmark Details {annotMode && '(corrected shown in amber)'}
            </div>
            <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #333' }}>
                  {['LM', 'auto_idx', 'corr_idx', 'Δ', 'x', 'y', 'conf'].map(h => (
                    <th key={h} style={{ color:'#94a3b8', textAlign:'left', padding:'3px 6px', fontWeight:'normal' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LM_ORDER.map(key => {
                  const lmEntry = result.landmarks![key];
                  if (!lmEntry) return null;
                  const autoIdx = lmEntry.index;
                  const corrIdx = corrected[key] ?? autoIdx;
                  const delta = corrIdx - autoIdx;
                  const corrPt = contourPts[corrIdx];
                  return (
                    <tr key={key} style={{ borderBottom:'1px solid #1f1f1f' }}>
                      <td style={{ color:LANDMARK_COLORS[key], padding:'3px 6px', fontWeight:'bold' }}>{key}</td>
                      <td style={{ color:'#94a3b8', padding:'3px 6px' }}>{autoIdx}</td>
                      <td style={{ color:delta!==0?'#fbbf24':'#94a3b8', padding:'3px 6px' }}>{corrIdx}</td>
                      <td style={{ color:Math.abs(delta)>5?'#f87171':Math.abs(delta)>0?'#fbbf24':'#4b5563', padding:'3px 6px' }}>
                        {delta > 0 ? '+' : ''}{delta}
                      </td>
                      <td style={{ color:'#64748b', padding:'3px 6px' }}>{(corrPt?.x ?? lmEntry.x).toFixed(0)}</td>
                      <td style={{ color:'#64748b', padding:'3px 6px' }}>{(corrPt?.y ?? lmEntry.y).toFixed(0)}</td>
                      <td style={{ color:lmEntry.confidence>0.7?'#34d399':lmEntry.confidence>0.4?'#fbbf24':'#f87171', padding:'3px 6px' }}>
                        {lmEntry.confidence.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
