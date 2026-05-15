import React, { useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';

type GraphPoint = { x: number; y: number };
type XMarker = { label: string; x: number; direction: 'up' | 'down'; y?: number };

interface GraphSvgEditorProps {
  open: boolean;
  onClose: () => void;
  onInsert: (html: string) => void;
}

const DEFAULT_POINTS: GraphPoint[] = [
  { x: -4, y: -2 },
  { x: -2, y: 1 },
  { x: 0, y: 2 },
  { x: 2, y: -1 },
  { x: 4, y: 1 },
];

const DEFAULT_MARKERS: XMarker[] = [
  { label: 'x1', x: -3, y: -1.4, direction: 'up' },
];

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function svgToImageHtml(svg: string, displayWidth: number) {
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return `<img src="${src}" alt="График функции" style="display:block;max-width:${displayWidth}px;width:100%;height:auto;margin:12px auto;" />`;
}

function niceBounds(points: GraphPoint[], markers: XMarker[]) {
  const xs = [...points.map((p) => p.x), ...markers.map((m) => m.x).filter(Number.isFinite)];
  const ys = points.map((p) => p.y);
  const minX = Math.floor(Math.min(-1, ...xs)) - 1;
  const maxX = Math.ceil(Math.max(1, ...xs)) + 1;
  const minY = Math.floor(Math.min(-1, ...ys)) - 1;
  const maxY = Math.ceil(Math.max(1, ...ys)) + 1;
  return { minX, maxX, minY, maxY };
}

function buildPath(points: GraphPoint[], map: (point: GraphPoint) => { x: number; y: number }, smooth: boolean) {
  if (!points.length) return '';
  const mapped = points.map(map);
  if (!smooth || mapped.length < 3) {
    return mapped.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  }

  const parts = [`M ${mapped[0].x.toFixed(1)} ${mapped[0].y.toFixed(1)}`];
  for (let i = 0; i < mapped.length - 1; i += 1) {
    const prev = mapped[Math.max(0, i - 1)];
    const current = mapped[i];
    const next = mapped[i + 1];
    const after = mapped[Math.min(mapped.length - 1, i + 2)];
    const cp1x = current.x + (next.x - prev.x) / 6;
    const cp1y = current.y + (next.y - prev.y) / 6;
    const cp2x = next.x - (after.x - current.x) / 6;
    const cp2y = next.y - (after.y - current.y) / 6;
    parts.push(`C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`);
  }
  return parts.join(' ');
}

function interpolateY(points: GraphPoint[], x: number) {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (!sorted.length) return 0;
  if (x <= sorted[0].x) return sorted[0].y;
  if (x >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (x >= a.x && x <= b.x) {
      const ratio = (x - a.x) / (b.x - a.x || 1);
      return a.y + (b.y - a.y) * ratio;
    }
  }
  return 0;
}

function generateGraphSvg(points: GraphPoint[], smooth: boolean, showLabels: boolean, showPoints: boolean, caption: string, markers: XMarker[], width: number, height: number) {
  const padding = 32;
  const bounds = niceBounds(points, markers);
  const spanX = bounds.maxX - bounds.minX || 1;
  const spanY = bounds.maxY - bounds.minY || 1;
  const plotW = width - padding * 2;
  const plotH = height - padding * 2;
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const map = (point: GraphPoint) => ({
    x: padding + ((point.x - bounds.minX) / spanX) * plotW,
    y: padding + ((bounds.maxY - point.y) / spanY) * plotH,
  });
  const xAxis = bounds.minY <= 0 && bounds.maxY >= 0 ? map({ x: 0, y: 0 }).y : map({ x: 0, y: bounds.minY }).y;
  const yAxis = bounds.minX <= 0 && bounds.maxX >= 0 ? map({ x: 0, y: 0 }).x : map({ x: bounds.minX, y: 0 }).x;
  const path = buildPath(sorted, map, smooth);
  const xTicks = Array.from({ length: bounds.maxX - bounds.minX + 1 }, (_, i) => bounds.minX + i);
  const yTicks = Array.from({ length: bounds.maxY - bounds.minY + 1 }, (_, i) => bounds.minY + i);
  const activeMarkers = markers.filter((marker) => Number.isFinite(marker.x) && marker.label.trim());

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="График функции" style="max-width:100%;height:auto;margin:12px 0;">
  <rect width="${width}" height="${height}" fill="none"/>
  ${xTicks.map((tick) => {
    const x = map({ x: tick, y: 0 }).x;
    return `<line x1="${x.toFixed(1)}" y1="${padding}" x2="${x.toFixed(1)}" y2="${height - padding}" stroke="#475569" stroke-opacity="0.32" stroke-width="1"/>`;
  }).join('\n  ')}
  ${yTicks.map((tick) => {
    const y = map({ x: 0, y: tick }).y;
    return `<line x1="${padding}" y1="${y.toFixed(1)}" x2="${width - padding}" y2="${y.toFixed(1)}" stroke="#475569" stroke-opacity="0.32" stroke-width="1"/>`;
  }).join('\n  ')}
  <line x1="${padding}" y1="${xAxis.toFixed(1)}" x2="${width - padding}" y2="${xAxis.toFixed(1)}" stroke="#e5e7eb" stroke-width="1.5"/>
  <line x1="${yAxis.toFixed(1)}" y1="${height - padding}" x2="${yAxis.toFixed(1)}" y2="${padding}" stroke="#e5e7eb" stroke-width="1.5"/>
  <path d="M ${width - padding - 7} ${(xAxis - 4).toFixed(1)} L ${width - padding} ${xAxis.toFixed(1)} L ${width - padding - 7} ${(xAxis + 4).toFixed(1)}" fill="none" stroke="#e5e7eb" stroke-width="1.5"/>
  <path d="M ${(yAxis - 4).toFixed(1)} ${padding + 7} L ${yAxis.toFixed(1)} ${padding} L ${(yAxis + 4).toFixed(1)} ${padding + 7}" fill="none" stroke="#e5e7eb" stroke-width="1.5"/>
  ${showLabels ? xTicks.filter((tick) => tick !== 0).map((tick) => {
    const p = map({ x: tick, y: 0 });
    return `<text x="${p.x.toFixed(1)}" y="${(xAxis + 17).toFixed(1)}" font-family="Arial, sans-serif" font-size="11" text-anchor="middle" fill="#cbd5e1">${tick}</text>`;
  }).join('\n  ') : ''}
  ${showLabels ? yTicks.filter((tick) => tick !== 0).map((tick) => {
    const p = map({ x: 0, y: tick });
    return `<text x="${(yAxis - 8).toFixed(1)}" y="${(p.y + 4).toFixed(1)}" font-family="Arial, sans-serif" font-size="11" text-anchor="end" fill="#cbd5e1">${tick}</text>`;
  }).join('\n  ') : ''}
  <text x="${width - padding + 10}" y="${(xAxis + 4).toFixed(1)}" font-family="Arial, sans-serif" font-size="13" fill="#e5e7eb">x</text>
  <text x="${(yAxis - 4).toFixed(1)}" y="${padding - 10}" font-family="Arial, sans-serif" font-size="13" fill="#e5e7eb">y</text>
  <path d="${path}" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  ${showPoints ? sorted.map((point) => {
    const p = map(point);
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="#2563eb"/>`;
  }).join('\n  ') : ''}
  ${activeMarkers.map((marker) => {
    const x = map({ x: marker.x, y: 0 }).x;
    const targetY = map({ x: marker.x, y: marker.y ?? interpolateY(sorted, marker.x) }).y;
    const labelY = marker.direction === 'up' ? xAxis - 8 : xAxis + 18;
    return `<line x1="${x.toFixed(1)}" y1="${xAxis.toFixed(1)}" x2="${x.toFixed(1)}" y2="${targetY.toFixed(1)}" stroke="#cbd5e1" stroke-width="1.5"/>
  <text x="${x.toFixed(1)}" y="${labelY.toFixed(1)}" font-family="Georgia, serif" font-size="15" font-style="italic" text-anchor="middle" fill="#e5e7eb">${escapeSvgText(marker.label)}</text>`;
  }).join('\n  ')}
  ${caption.trim() ? `<text x="${(width - 105).toFixed(1)}" y="${(padding + 58).toFixed(1)}" font-family="Georgia, serif" font-size="22" font-style="italic" text-anchor="middle" fill="#e5e7eb">${escapeSvgText(caption.trim())}</text>` : ''}
</svg>`;
}

export default function GraphSvgEditor({ open, onClose, onInsert }: GraphSvgEditorProps) {
  const [points, setPoints] = useState<GraphPoint[]>(DEFAULT_POINTS);
  const [markers, setMarkers] = useState<XMarker[]>(DEFAULT_MARKERS);
  const [caption, setCaption] = useState('График функции y = f(x)');
  const [svgWidth, setSvgWidth] = useState(460);
  const [svgHeight, setSvgHeight] = useState(300);
  const [displayWidth, setDisplayWidth] = useState(560);
  const [smooth, setSmooth] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showPoints, setShowPoints] = useState(true);
  const svg = useMemo(
    () => generateGraphSvg(points, smooth, showLabels, showPoints, caption, markers, svgWidth, svgHeight),
    [points, smooth, showLabels, showPoints, caption, markers, svgWidth, svgHeight],
  );

  if (!open) return null;

  const updatePoint = (index: number, patch: Partial<GraphPoint>) => {
    setPoints((current) => current.map((point, pointIndex) => pointIndex === index ? { ...point, ...patch } : point));
  };

  const updateMarker = (index: number, patch: Partial<XMarker>) => {
    setMarkers((current) => current.map((marker, markerIndex) => markerIndex === index ? { ...marker, ...patch } : marker));
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-base font-black text-gray-900">SVG-график по точкам</h3>
            <p className="text-xs text-gray-500">Добавьте точки, подпись и метки x1/x2 на оси X, затем вставьте SVG в задание.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[380px_1fr]">
          <div className="space-y-4 overflow-y-auto border-r border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wide text-gray-400">Точки графика</span>
              <button
                onClick={() => setPoints((current) => [...current, { x: current.length, y: 0 }])}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
              >
                <Plus size={13} /> Точка
              </button>
            </div>

            <div className="space-y-2">
              {points.map((point, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_32px] gap-2">
                  <input
                    type="number"
                    step="0.5"
                    value={point.x}
                    onChange={(event) => updatePoint(index, { x: Number(event.target.value) })}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    aria-label="x"
                  />
                  <input
                    type="number"
                    step="0.5"
                    value={point.y}
                    onChange={(event) => updatePoint(index, { y: Number(event.target.value) })}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    aria-label="y"
                  />
                  <button
                    onClick={() => setPoints((current) => current.filter((_, pointIndex) => pointIndex !== index))}
                    disabled={points.length <= 2}
                    className="rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 size={15} className="mx-auto" />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wide text-gray-400">Подпись графика</span>
              <input
                type="text"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Например: График функции y = f(x)"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wide text-gray-400">Размер</span>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-[11px] font-bold text-gray-500">
                  SVG ширина
                  <input
                    type="number"
                    min="260"
                    max="900"
                    step="10"
                    value={svgWidth}
                    onChange={(event) => setSvgWidth(Math.max(260, Number(event.target.value) || 460))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-[11px] font-bold text-gray-500">
                  SVG высота
                  <input
                    type="number"
                    min="180"
                    max="700"
                    step="10"
                    value={svgHeight}
                    onChange={(event) => setSvgHeight(Math.max(180, Number(event.target.value) || 300))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-[11px] font-bold text-gray-500">
                  На странице
                  <input
                    type="number"
                    min="240"
                    max="900"
                    step="10"
                    value={displayWidth}
                    onChange={(event) => setDisplayWidth(Math.max(240, Number(event.target.value) || 560))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wide text-gray-400">Метки на оси X</span>
                <button
                  onClick={() => setMarkers((current) => [...current, { label: `x${current.length + 1}`, x: 0, direction: 'up' }])}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
                >
                  <Plus size={13} /> Метка
                </button>
              </div>
              {markers.map((marker, index) => (
                <div key={index} className="grid grid-cols-[1fr_64px_64px_82px_32px] gap-2">
                  <input
                    value={marker.label}
                    onChange={(event) => updateMarker(index, { label: event.target.value })}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    aria-label="Подпись метки"
                  />
                  <input
                    type="number"
                    step="0.5"
                    value={marker.x}
                    onChange={(event) => updateMarker(index, { x: Number(event.target.value) })}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    aria-label="x метки"
                  />
                  <input
                    type="number"
                    step="0.5"
                    value={marker.y ?? ''}
                    onChange={(event) => updateMarker(index, { y: event.target.value === '' ? undefined : Number(event.target.value) })}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    aria-label="y направляющей"
                    placeholder="y"
                  />
                  <select
                    value={marker.direction}
                    onChange={(event) => updateMarker(index, { direction: event.target.value as XMarker['direction'] })}
                    className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
                  >
                    <option value="up">вниз</option>
                    <option value="down">вверх</option>
                  </select>
                  <button
                    onClick={() => setMarkers((current) => current.filter((_, markerIndex) => markerIndex !== index))}
                    className="rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={15} className="mx-auto" />
                  </button>
                </div>
              ))}
            </div>

            <label className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
              Сгладить линию
              <input type="checkbox" checked={smooth} onChange={(event) => setSmooth(event.target.checked)} />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
              Подписи осей
              <input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
              Показывать точки
              <input type="checkbox" checked={showPoints} onChange={(event) => setShowPoints(event.target.checked)} />
            </label>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden p-5">
            <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="mx-auto max-w-2xl rounded-xl bg-white p-4 shadow-sm" dangerouslySetInnerHTML={{ __html: svg }} />
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50">
                Отмена
              </button>
              <button
                onClick={() => {
                  onInsert(svgToImageHtml(svg, displayWidth));
                  onClose();
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
              >
                Вставить SVG
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
