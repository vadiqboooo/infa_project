import React, { useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';

type DraftPoint = { x: string; y: string };
type GraphPoint = { x: number; y: number };
type GraphSeriesMode = 'polyline' | 'infinite-line';
type GraphSeries = { id: number; name: string; color: string; mode: GraphSeriesMode; points: DraftPoint[] };
type ParsedSeries = Omit<GraphSeries, 'points'> & { points: GraphPoint[] };
type XMarker = { label: string; x: string; direction: 'up' | 'down'; y?: string };
type ParsedMarker = { label: string; x: number; direction: 'up' | 'down'; y?: number };
type GraphBounds = { minX: number; maxX: number; minY: number; maxY: number };
type DraftBounds = { minX: string; maxX: string; minY: string; maxY: string };

interface GraphSvgEditorProps {
  open: boolean;
  onClose: () => void;
  onInsert: (html: string) => void;
}

const SERIES_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2'];

const DEFAULT_SERIES: GraphSeries[] = [
  {
    id: 1,
    name: 'График 1',
    color: SERIES_COLORS[0],
    mode: 'polyline',
    points: [
      { x: '-4', y: '-2' },
      { x: '-2', y: '1' },
      { x: '0', y: '2' },
      { x: '2', y: '-1' },
      { x: '4', y: '1' },
    ],
  },
];

const DEFAULT_MARKERS: XMarker[] = [
  { label: 'x1', x: '-3', y: '-1.4', direction: 'up' },
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

function parseNumber(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '' || normalized === '-' || normalized === '+' || normalized === '.' || normalized === '-.' || normalized === '+.') {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSeries(series: GraphSeries[]): ParsedSeries[] {
  return series.map((item) => ({
    ...item,
    points: item.points
      .map((point) => {
        const x = parseNumber(point.x);
        const y = parseNumber(point.y);
        return x === null || y === null ? null : { x, y };
      })
      .filter((point): point is GraphPoint => point !== null),
  }));
}

function parseMarkers(markers: XMarker[]): ParsedMarker[] {
  return markers
    .map((marker) => {
      const x = parseNumber(marker.x);
      const y = marker.y == null ? null : parseNumber(marker.y);
      if (x === null || !marker.label.trim()) return null;
      return {
        label: marker.label,
        x,
        direction: marker.direction,
        ...(y === null ? {} : { y }),
      };
    })
    .filter((marker): marker is ParsedMarker => marker !== null);
}

function niceBounds(series: ParsedSeries[], markers: ParsedMarker[]): GraphBounds {
  const points = series.flatMap((item) => item.points);
  const xs = [...points.map((p) => p.x), ...markers.map((m) => m.x)];
  const ys = points.map((p) => p.y);
  const minX = Math.floor(Math.min(-1, ...xs)) - 1;
  const maxX = Math.ceil(Math.max(1, ...xs)) + 1;
  const minY = Math.floor(Math.min(-1, ...ys)) - 1;
  const maxY = Math.ceil(Math.max(1, ...ys)) + 1;
  return { minX, maxX, minY, maxY };
}

function parseManualBounds(bounds: DraftBounds) {
  const minX = parseNumber(bounds.minX);
  const maxX = parseNumber(bounds.maxX);
  const minY = parseNumber(bounds.minY);
  const maxY = parseNumber(bounds.maxY);
  if (minX === null || maxX === null || minY === null || maxY === null) return null;
  if (minX >= maxX || minY >= maxY) return null;
  return { minX, maxX, minY, maxY };
}

function buildInfiniteLinePoints(points: GraphPoint[], bounds: GraphBounds) {
  if (points.length < 2) return points;
  const [a, b] = points;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return [a];

  const candidates: GraphPoint[] = [];
  const pushCandidate = (point: GraphPoint) => {
    const insideX = point.x >= bounds.minX - 1e-9 && point.x <= bounds.maxX + 1e-9;
    const insideY = point.y >= bounds.minY - 1e-9 && point.y <= bounds.maxY + 1e-9;
    const duplicate = candidates.some((candidate) => Math.abs(candidate.x - point.x) < 1e-7 && Math.abs(candidate.y - point.y) < 1e-7);
    if (insideX && insideY && !duplicate) candidates.push(point);
  };

  if (dx !== 0) {
    [bounds.minX, bounds.maxX].forEach((x) => {
      const t = (x - a.x) / dx;
      pushCandidate({ x, y: a.y + dy * t });
    });
  }

  if (dy !== 0) {
    [bounds.minY, bounds.maxY].forEach((y) => {
      const t = (y - a.y) / dy;
      pushCandidate({ x: a.x + dx * t, y });
    });
  }

  if (candidates.length < 2) return points;
  return candidates
    .sort((first, second) => {
      const firstT = Math.abs(dx) >= Math.abs(dy) ? (first.x - a.x) / dx : (first.y - a.y) / dy;
      const secondT = Math.abs(dx) >= Math.abs(dy) ? (second.x - a.x) / dx : (second.y - a.y) / dy;
      return firstT - secondT;
    })
    .filter((_, index, all) => index === 0 || index === all.length - 1);
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

function buildTicks(min: number, max: number) {
  const span = max - min;
  const roughStep = span / 12;
  const power = 10 ** Math.floor(Math.log10(Math.max(roughStep, 1)));
  const normalized = roughStep / power;
  const multiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = multiplier * power;
  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let tick = first; tick <= max + step * 0.001 && ticks.length < 80; tick += step) {
    ticks.push(Number(tick.toFixed(6)));
  }
  return ticks;
}

function formatTick(tick: number) {
  return Number.isInteger(tick) ? String(tick) : tick.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function interpolateY(series: ParsedSeries[], x: number) {
  const firstSeries = series.find((item) => item.points.length > 0);
  const sorted = [...(firstSeries?.points ?? [])].sort((a, b) => a.x - b.x);
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

function generateGraphSvg(series: ParsedSeries[], smooth: boolean, showLabels: boolean, showPoints: boolean, caption: string, markers: ParsedMarker[], width: number, height: number, manualBounds: GraphBounds | null) {
  const padding = 32;
  const bounds = manualBounds ?? niceBounds(series, markers);
  const spanX = bounds.maxX - bounds.minX || 1;
  const spanY = bounds.maxY - bounds.minY || 1;
  const plotW = width - padding * 2;
  const plotH = height - padding * 2;
  const map = (point: GraphPoint) => ({
    x: padding + ((point.x - bounds.minX) / spanX) * plotW,
    y: padding + ((bounds.maxY - point.y) / spanY) * plotH,
  });
  const xAxis = bounds.minY <= 0 && bounds.maxY >= 0 ? map({ x: 0, y: 0 }).y : map({ x: 0, y: bounds.minY }).y;
  const yAxis = bounds.minX <= 0 && bounds.maxX >= 0 ? map({ x: 0, y: 0 }).x : map({ x: bounds.minX, y: 0 }).x;
  const xTicks = buildTicks(bounds.minX, bounds.maxX);
  const yTicks = buildTicks(bounds.minY, bounds.maxY);
  const drawableSeries = series
    .map((item) => {
      const sortedPoints = [...item.points].sort((a, b) => a.x - b.x);
      return {
        ...item,
        sourcePoints: sortedPoints,
        points: item.mode === 'infinite-line' ? buildInfiniteLinePoints(sortedPoints, bounds) : sortedPoints,
      };
    })
    .filter((item) => item.points.length > 0);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="График функции" style="max-width:100%;height:auto;margin:12px 0;">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <rect x="${padding}" y="${padding}" width="${plotW}" height="${plotH}" fill="#ffffff" stroke="#94a3b8" stroke-width="1"/>
  ${xTicks.map((tick) => {
    const x = map({ x: tick, y: 0 }).x;
    return `<line x1="${x.toFixed(1)}" y1="${padding}" x2="${x.toFixed(1)}" y2="${height - padding}" stroke="#94a3b8" stroke-opacity="0.58" stroke-width="1"/>`;
  }).join('\n  ')}
  ${yTicks.map((tick) => {
    const y = map({ x: 0, y: tick }).y;
    return `<line x1="${padding}" y1="${y.toFixed(1)}" x2="${width - padding}" y2="${y.toFixed(1)}" stroke="#94a3b8" stroke-opacity="0.58" stroke-width="1"/>`;
  }).join('\n  ')}
  <line x1="${padding}" y1="${xAxis.toFixed(1)}" x2="${width - padding}" y2="${xAxis.toFixed(1)}" stroke="#334155" stroke-width="1.8"/>
  <line x1="${yAxis.toFixed(1)}" y1="${height - padding}" x2="${yAxis.toFixed(1)}" y2="${padding}" stroke="#334155" stroke-width="1.8"/>
  <path d="M ${width - padding - 7} ${(xAxis - 4).toFixed(1)} L ${width - padding} ${xAxis.toFixed(1)} L ${width - padding - 7} ${(xAxis + 4).toFixed(1)}" fill="none" stroke="#334155" stroke-width="1.8"/>
  <path d="M ${(yAxis - 4).toFixed(1)} ${padding + 7} L ${yAxis.toFixed(1)} ${padding} L ${(yAxis + 4).toFixed(1)} ${padding + 7}" fill="none" stroke="#334155" stroke-width="1.8"/>
  ${showLabels ? xTicks.filter((tick) => tick !== 0).map((tick) => {
    const p = map({ x: tick, y: 0 });
    return `<text x="${p.x.toFixed(1)}" y="${(xAxis + 17).toFixed(1)}" font-family="Arial, sans-serif" font-size="11" text-anchor="middle" fill="#64748b">${formatTick(tick)}</text>`;
  }).join('\n  ') : ''}
  ${showLabels ? yTicks.filter((tick) => tick !== 0).map((tick) => {
    const p = map({ x: 0, y: tick });
    return `<text x="${(yAxis - 8).toFixed(1)}" y="${(p.y + 4).toFixed(1)}" font-family="Arial, sans-serif" font-size="11" text-anchor="end" fill="#64748b">${formatTick(tick)}</text>`;
  }).join('\n  ') : ''}
  <text x="${width - padding + 10}" y="${(xAxis + 4).toFixed(1)}" font-family="Arial, sans-serif" font-size="13" fill="#334155">x</text>
  <text x="${(yAxis - 4).toFixed(1)}" y="${padding - 10}" font-family="Arial, sans-serif" font-size="13" fill="#334155">y</text>
  ${drawableSeries.map((item) => {
    const path = buildPath(item.points, map, item.mode === 'infinite-line' ? false : smooth);
    return `<path d="${path}" fill="none" stroke="${item.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  ${showPoints ? (item.mode === 'infinite-line' ? item.sourcePoints : item.points).map((point) => {
      const p = map(point);
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${item.color}"/>`;
    }).join('\n  ') : ''}`;
  }).join('\n  ')}
  ${markers.map((marker) => {
    const x = map({ x: marker.x, y: 0 }).x;
    const targetY = map({ x: marker.x, y: marker.y ?? interpolateY(drawableSeries, marker.x) }).y;
    const labelY = marker.direction === 'up' ? xAxis - 8 : xAxis + 18;
    return `<line x1="${x.toFixed(1)}" y1="${xAxis.toFixed(1)}" x2="${x.toFixed(1)}" y2="${targetY.toFixed(1)}" stroke="#475569" stroke-width="1.5"/>
  <text x="${x.toFixed(1)}" y="${labelY.toFixed(1)}" font-family="Georgia, serif" font-size="15" font-style="italic" text-anchor="middle" fill="#334155">${escapeSvgText(marker.label)}</text>`;
  }).join('\n  ')}
  ${caption.trim() ? `<text x="${(width - 105).toFixed(1)}" y="${(padding + 58).toFixed(1)}" font-family="Georgia, serif" font-size="22" font-style="italic" text-anchor="middle" fill="#334155">${escapeSvgText(caption.trim())}</text>` : ''}
</svg>`;
}

export default function GraphSvgEditor({ open, onClose, onInsert }: GraphSvgEditorProps) {
  const [series, setSeries] = useState<GraphSeries[]>(DEFAULT_SERIES);
  const [markers, setMarkers] = useState<XMarker[]>(DEFAULT_MARKERS);
  const [caption, setCaption] = useState('График функции y = f(x)');
  const [svgWidth, setSvgWidth] = useState(460);
  const [svgHeight, setSvgHeight] = useState(300);
  const [displayWidth, setDisplayWidth] = useState(560);
  const [autoBounds, setAutoBounds] = useState(true);
  const [manualBounds, setManualBounds] = useState<DraftBounds>({ minX: '-5', maxX: '5', minY: '-3', maxY: '3' });
  const [smooth, setSmooth] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showPoints, setShowPoints] = useState(true);
  const parsedSeries = useMemo(() => parseSeries(series), [series]);
  const parsedMarkers = useMemo(() => parseMarkers(markers), [markers]);
  const parsedManualBounds = useMemo(() => autoBounds ? null : parseManualBounds(manualBounds), [autoBounds, manualBounds]);
  const svg = useMemo(
    () => generateGraphSvg(parsedSeries, smooth, showLabels, showPoints, caption, parsedMarkers, svgWidth, svgHeight, parsedManualBounds),
    [parsedSeries, smooth, showLabels, showPoints, caption, parsedMarkers, svgWidth, svgHeight, parsedManualBounds],
  );

  if (!open) return null;

  const updateSeries = (seriesId: number, patch: Partial<GraphSeries>) => {
    setSeries((current) => current.map((item) => item.id === seriesId ? { ...item, ...patch } : item));
  };

  const updatePoint = (seriesId: number, index: number, patch: Partial<DraftPoint>) => {
    setSeries((current) => current.map((item) => {
      if (item.id !== seriesId) return item;
      return {
        ...item,
        points: item.points.map((point, pointIndex) => pointIndex === index ? { ...point, ...patch } : point),
      };
    }));
  };

  const addPoint = (seriesId: number) => {
    setSeries((current) => current.map((item) => {
      if (item.id !== seriesId) return item;
      const lastPoint = item.points[item.points.length - 1];
      const lastX = lastPoint ? parseNumber(lastPoint.x) : null;
      return { ...item, points: [...item.points, { x: String((lastX ?? item.points.length - 1) + 1), y: '' }] };
    }));
  };

  const deletePoint = (seriesId: number, index: number) => {
    setSeries((current) => current.map((item) => (
      item.id === seriesId ? { ...item, points: item.points.filter((_, pointIndex) => pointIndex !== index) } : item
    )));
  };

  const addSeries = () => {
    setSeries((current) => {
      const id = Math.max(0, ...current.map((item) => item.id)) + 1;
      return [
        ...current,
        {
          id,
          name: `График ${id}`,
          color: SERIES_COLORS[(id - 1) % SERIES_COLORS.length],
          mode: 'polyline',
          points: [
            { x: '-2', y: '' },
            { x: '0', y: '' },
            { x: '2', y: '' },
          ],
        },
      ];
    });
  };

  const updateMarker = (index: number, patch: Partial<XMarker>) => {
    setMarkers((current) => current.map((marker, markerIndex) => markerIndex === index ? { ...marker, ...patch } : marker));
  };

  const updateNumericSetting = (value: string, fallback: number, min: number, setter: React.Dispatch<React.SetStateAction<number>>) => {
    const parsed = parseNumber(value);
    setter(Math.max(min, parsed ?? fallback));
  };

  const updateManualBound = (key: keyof DraftBounds, value: string) => {
    setManualBounds((current) => ({ ...current, [key]: value }));
  };

  const expandManualBounds = () => {
    setAutoBounds(false);
    setManualBounds((current) => {
      const parsed = parseManualBounds(current) ?? niceBounds(parsedSeries, parsedMarkers);
      const width = parsed.maxX - parsed.minX;
      const height = parsed.maxY - parsed.minY;
      const padX = Math.max(1, Math.ceil(width * 0.25));
      const padY = Math.max(1, Math.ceil(height * 0.25));
      return {
        minX: String(parsed.minX - padX),
        maxX: String(parsed.maxX + padX),
        minY: String(parsed.minY - padY),
        maxY: String(parsed.maxY + padY),
      };
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-base font-black text-gray-900">SVG-график по точкам</h3>
            <p className="text-xs text-gray-500">Добавьте один или несколько графиков, задайте пары координат и вставьте SVG в задание.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[410px_1fr]">
          <div className="space-y-4 overflow-y-auto border-r border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wide text-gray-400">Графики</span>
              <button
                onClick={addSeries}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
              >
                <Plus size={13} /> График
              </button>
            </div>

            <div className="space-y-3">
              {series.map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="mb-3 grid grid-cols-[1fr_46px_32px] gap-2">
                    <input
                      value={item.name}
                      onChange={(event) => updateSeries(item.id, { name: event.target.value })}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      aria-label="Название графика"
                    />
                    <input
                      type="color"
                      value={item.color}
                      onChange={(event) => updateSeries(item.id, { color: event.target.value })}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-white px-1 py-1"
                      aria-label="Цвет графика"
                    />
                    <button
                      onClick={() => setSeries((current) => current.filter((seriesItem) => seriesItem.id !== item.id))}
                      disabled={series.length <= 1}
                      className="rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Удалить график"
                    >
                      <Trash2 size={15} className="mx-auto" />
                    </button>
                  </div>

                  <label className="mb-3 block text-[11px] font-bold text-gray-500">
                    Тип линии
                    <select
                      value={item.mode}
                      onChange={(event) => updateSeries(item.id, { mode: event.target.value as GraphSeriesMode })}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <option value="polyline">График по точкам</option>
                      <option value="infinite-line">Бесконечная прямая по 2 точкам</option>
                    </select>
                  </label>

                  <div className="mb-2 grid grid-cols-[1fr_1fr_32px] gap-2 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                    <span>x</span>
                    <span>y</span>
                    <span />
                  </div>
                  <div className="space-y-2">
                    {item.points.map((point, index) => (
                      <div key={index} className="grid grid-cols-[1fr_1fr_32px] gap-2">
                        <input
                          inputMode="decimal"
                          value={point.x}
                          onChange={(event) => updatePoint(item.id, index, { x: event.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          aria-label="x"
                          placeholder="x"
                        />
                        <input
                          inputMode="decimal"
                          value={point.y}
                          onChange={(event) => updatePoint(item.id, index, { y: event.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          aria-label="y"
                          placeholder="y"
                        />
                        <button
                          onClick={() => deletePoint(item.id, index)}
                          className="rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
                          aria-label="Удалить точку"
                        >
                          <Trash2 size={15} className="mx-auto" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => addPoint(item.id)}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
                  >
                    <Plus size={13} /> Точка
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
                    onChange={(event) => updateNumericSetting(event.target.value, 460, 260, setSvgWidth)}
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
                    onChange={(event) => updateNumericSetting(event.target.value, 300, 180, setSvgHeight)}
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
                    onChange={(event) => updateNumericSetting(event.target.value, 560, 240, setDisplayWidth)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-wide text-gray-400">Система координат</span>
                <button
                  type="button"
                  onClick={expandManualBounds}
                  className="rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
                >
                  Увеличить
                </button>
              </div>
              <label className="flex items-center justify-between text-sm font-semibold text-gray-700">
                Автоматические границы
                <input type="checkbox" checked={autoBounds} onChange={(event) => setAutoBounds(event.target.checked)} />
              </label>
              <div className="grid grid-cols-4 gap-2">
                {([
                  ['minX', 'x min'],
                  ['maxX', 'x max'],
                  ['minY', 'y min'],
                  ['maxY', 'y max'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="text-[11px] font-bold text-gray-500">
                    {label}
                    <input
                      inputMode="decimal"
                      value={manualBounds[key]}
                      onChange={(event) => updateManualBound(key, event.target.value)}
                      disabled={autoBounds}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </label>
                ))}
              </div>
              {!autoBounds && !parsedManualBounds && (
                <p className="text-xs font-semibold text-red-500">Проверьте границы: min должен быть меньше max.</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wide text-gray-400">Метки на оси X</span>
                <button
                  onClick={() => setMarkers((current) => [...current, { label: `x${current.length + 1}`, x: '', direction: 'up' }])}
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
                    inputMode="decimal"
                    value={marker.x}
                    onChange={(event) => updateMarker(index, { x: event.target.value })}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    aria-label="x метки"
                    placeholder="x"
                  />
                  <input
                    inputMode="decimal"
                    value={marker.y ?? ''}
                    onChange={(event) => updateMarker(index, { y: event.target.value })}
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
                    aria-label="Удалить метку"
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
