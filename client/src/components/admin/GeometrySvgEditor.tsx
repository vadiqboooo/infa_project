import React, { useMemo, useRef, useState } from 'react';
import { Box, Circle, Plus, Square, Trash2, Triangle, X } from 'lucide-react';

type GeometryMode = 'builder' | '2d' | '3d';
type GeometryShape2D = 'rectangle' | 'triangle' | 'circle' | 'polygon';
type GeometryShape3D = 'cube' | 'prism' | 'pyramid' | 'cylinder';
type SceneShape = GeometryShape2D | GeometryShape3D | 'line' | 'text';
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';
type DragState =
  | { kind: 'move'; id: number; startX: number; startY: number; item: SceneItem }
  | { kind: 'resize'; id: number; handle: ResizeHandle; startX: number; startY: number; item: SceneItem }
  | { kind: 'point'; id: number; pointIndex: number };

interface SceneItem {
  id: number;
  shape: SceneShape;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  fill: string;
  stroke: string;
  baseSides?: number;
  dashed?: boolean;
  rotation?: number;
  rotationX?: number;
  rotationY?: number;
  points?: Array<{ x: number; y: number }>;
}

interface GeometrySvgEditorProps {
  open: boolean;
  onClose: () => void;
  onInsert: (html: string) => void;
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function svgToImageHtml(svg: string, displayWidth: number) {
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return `<img src="${src}" alt="Геометрический рисунок" width="${displayWidth}" style="display:block;max-width:100%;width:${displayWidth}px;height:auto;margin:12px auto;" />`;
}

function label(x: number, y: number, text: string, anchor: 'start' | 'middle' | 'end' = 'middle') {
  if (!text.trim()) return '';
  return `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="16" font-weight="700" text-anchor="${anchor}" fill="#e5e7eb">${escapeSvgText(text)}</text>`;
}

function dimensionText(x: number, y: number, text: string, anchor: 'start' | 'middle' | 'end' = 'middle') {
  if (!text.trim()) return '';
  return `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="13" text-anchor="${anchor}" fill="#cbd5e1">${escapeSvgText(text)}</text>`;
}

function getPointBounds(points: Array<{ x: number; y: number }>) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: Math.max(10, maxX - minX),
    height: Math.max(10, maxY - minY),
  };
}

function clampSides(value?: number) {
  return Math.max(3, Math.min(12, Math.round(value || 5)));
}

function regularPolygonPoints(cx: number, cy: number, rx: number, ry: number, sides: number, rotation = -Math.PI / 2) {
  const count = clampSides(sides);
  return Array.from({ length: count }, (_, index) => {
    const angle = rotation + (index * Math.PI * 2) / count;
    return {
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
    };
  });
}

function pointsToString(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
}

function is3DShape(shape: SceneShape | GeometryShape3D) {
  return ['cube', 'prism', 'pyramid', 'cylinder'].includes(shape);
}

type Point3D = { x: number; y: number; z: number };
type ProjectedPoint = { x: number; y: number; z: number };

function degToRad(value?: number) {
  return ((value || 0) * Math.PI) / 180;
}

function project3DPoint(item: SceneItem, point: Point3D): ProjectedPoint {
  const xAngle = degToRad(item.rotationX);
  const yAngle = degToRad(item.rotationY);
  const zAngle = degToRad(item.rotation);
  let { x, y, z } = point;

  const cosX = Math.cos(xAngle);
  const sinX = Math.sin(xAngle);
  [y, z] = [y * cosX - z * sinX, y * sinX + z * cosX];

  const cosY = Math.cos(yAngle);
  const sinY = Math.sin(yAngle);
  [x, z] = [x * cosY + z * sinY, -x * sinY + z * cosY];

  const cosZ = Math.cos(zAngle);
  const sinZ = Math.sin(zAngle);
  [x, y] = [x * cosZ - y * sinZ, x * sinZ + y * cosZ];

  const cx = item.x + Math.max(10, item.width) / 2;
  const cy = item.y + Math.max(10, item.height) / 2;
  const w = Math.max(10, item.width);
  const h = Math.max(10, item.height);

  return {
    x: cx + x * w + z * w * 0.34,
    y: cy + y * h - z * h * 0.22,
    z,
  };
}

function projectedPolygonString(points: ProjectedPoint[]) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
}

function projectedNgon3D(sides: number, y: number, radius = 0.36) {
  return Array.from({ length: clampSides(sides) }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / clampSides(sides);
    return {
      x: Math.cos(angle) * radius,
      y,
      z: Math.sin(angle) * radius,
    };
  });
}

function averageDepth(points: ProjectedPoint[]) {
  return points.reduce((sum, point) => sum + point.z, 0) / Math.max(1, points.length);
}

function rotationTransform(x: number, y: number, width: number, height: number, rotation?: number, rotationX?: number, rotationY?: number) {
  const z = Math.round(rotation || 0);
  const xAngle = Math.round(rotationX || 0);
  const yAngle = Math.round(rotationY || 0);
  if (!z && !xAngle && !yAngle) return '';
  const cx = (x + width / 2).toFixed(1);
  const cy = (y + height / 2).toFixed(1);
  const scaleX = (0.68 + 0.32 * Math.cos((Math.abs(yAngle) * Math.PI) / 180)).toFixed(3);
  const scaleY = (0.68 + 0.32 * Math.cos((Math.abs(xAngle) * Math.PI) / 180)).toFixed(3);
  const skewX = (yAngle * 0.28).toFixed(1);
  const skewY = (-xAngle * 0.22).toFixed(1);
  return ` transform="translate(${cx} ${cy}) rotate(${z}) skewX(${skewX}) skewY(${skewY}) scale(${scaleX} ${scaleY}) translate(${-Number(cx)} ${-Number(cy)})"`;
}

function wrapRotatedSvg(content: string, item: SceneItem) {
  if (['cube', 'prism', 'pyramid'].includes(item.shape)) return content;
  if (!is3DShape(item.shape) || (!item.rotation && !item.rotationX && !item.rotationY)) return content;
  const x = item.x;
  const y = item.y;
  const w = Math.max(10, item.width);
  const h = Math.max(10, item.height);
  return `<g${rotationTransform(x, y, w, h, item.rotation, item.rotationX, item.rotationY)}>
  ${content}
  </g>`;
}

function renderNgonPyramidSvg(item: SceneItem, selectedId?: number) {
  const x = item.x;
  const y = item.y;
  const w = Math.max(10, item.width);
  const h = Math.max(10, item.height);
  const fill = item.fill;
  const stroke = item.stroke;
  const sides = clampSides(item.baseSides);
  const base3D = projectedNgon3D(sides, 0.32, 0.38);
  const base = base3D.map((point) => project3DPoint(item, point));
  const apex = project3DPoint(item, { x: 0, y: -0.42, z: 0 });
  const selection = item.id === selectedId
    ? `<rect x="${x - 6}" y="${y - 6}" width="${w + 12}" height="${h + 12}" fill="none" stroke="#3F8C62" stroke-width="2" stroke-dasharray="5 4"/>`
    : '';
  const faces = base.map((point, index) => {
    const next = base[(index + 1) % base.length];
    const opacity = 0.42 + (index % 3) * 0.14;
    return {
      index,
      depth: averageDepth([apex, point, next]),
      svg: `<polygon points="${projectedPolygonString([apex, point, next])}" fill="${fill}" fill-opacity="${opacity.toFixed(2)}" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round"/>`,
    };
  }).sort((a, b) => a.depth - b.depth);
  const visibleFaceIndexes = new Set(faces.slice(Math.max(0, faces.length - Math.ceil(faces.length / 2))).map((face) => face.index));
  const faceSvg = faces.map((face) => face.svg).join('\n  ');
  const hiddenEdges = base.map((point, index) => {
    const previousFaceIndex = (index - 1 + base.length) % base.length;
    const isVisibleEdge = visibleFaceIndexes.has(index) || visibleFaceIndexes.has(previousFaceIndex);
    if (isVisibleEdge) return '';
    return `<line x1="${apex.x.toFixed(1)}" y1="${apex.y.toFixed(1)}" x2="${point.x.toFixed(1)}" y2="${point.y.toFixed(1)}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 5"/>`;
  }).filter(Boolean).join('\n  ');
  const centerLabel = item.label.trim()
    ? `<text x="${x + w / 2}" y="${y + h / 2 + 5}" font-family="Arial, sans-serif" font-size="15" font-weight="700" text-anchor="middle" fill="#e5e7eb">${escapeSvgText(item.label)}</text>`
    : '';

  return `${selection}
  <polygon points="${projectedPolygonString(base)}" fill="${fill}" fill-opacity="0.5" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
  ${faceSvg}
  ${hiddenEdges}
  ${centerLabel}`;
}

function renderNgonPrismSvg(item: SceneItem, selectedId?: number) {
  const x = item.x;
  const y = item.y;
  const w = Math.max(10, item.width);
  const h = Math.max(10, item.height);
  const fill = item.fill;
  const stroke = item.stroke;
  const sides = clampSides(item.baseSides);
  const bottom = projectedNgon3D(sides, 0.34, 0.38).map((point) => project3DPoint(item, point));
  const top = projectedNgon3D(sides, -0.34, 0.38).map((point) => project3DPoint(item, point));
  const selection = item.id === selectedId
    ? `<rect x="${x - 6}" y="${y - 6}" width="${w + 12}" height="${h + 12}" fill="none" stroke="#3F8C62" stroke-width="2" stroke-dasharray="5 4"/>`
    : '';
  const sideFaces = bottom.map((point, index) => {
    const nextIndex = (index + 1) % bottom.length;
    const opacity = 0.35 + (index % 2) * 0.18;
    const points = [top[index], top[nextIndex], bottom[nextIndex], point];
    return { depth: averageDepth(points), svg: `<polygon points="${projectedPolygonString(points)}" fill="${fill}" fill-opacity="${opacity.toFixed(2)}" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round"/>` };
  }).sort((a, b) => a.depth - b.depth).map((face) => face.svg).join('\n  ');
  const verticalEdges = bottom.map((point, index) => {
    const dashed = averageDepth([point, top[index]]) < 0 ? ' stroke-dasharray="6 5" stroke="#cbd5e1" stroke-width="2"' : ` stroke="${stroke}" stroke-width="3"`;
    return `<line x1="${top[index].x.toFixed(1)}" y1="${top[index].y.toFixed(1)}" x2="${point.x.toFixed(1)}" y2="${point.y.toFixed(1)}"${dashed}/>`;
  }).join('\n  ');
  const centerLabel = item.label.trim()
    ? `<text x="${x + w / 2}" y="${y + h / 2 + 5}" font-family="Arial, sans-serif" font-size="15" font-weight="700" text-anchor="middle" fill="#e5e7eb">${escapeSvgText(item.label)}</text>`
    : '';

  return `${selection}
  ${sideFaces}
  <polygon points="${projectedPolygonString(bottom)}" fill="${fill}" fill-opacity="0.65" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
  <polygon points="${projectedPolygonString(top)}" fill="${fill}" fill-opacity="0.8" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
  ${verticalEdges}
  ${centerLabel}`;
}

function renderProjectedCubeSvg(item: SceneItem, selectedId?: number) {
  const x = item.x;
  const y = item.y;
  const w = Math.max(10, item.width);
  const h = Math.max(10, item.height);
  const fill = item.fill;
  const stroke = item.stroke;
  const selection = item.id === selectedId
    ? `<rect x="${x - 6}" y="${y - 6}" width="${w + 12}" height="${h + 12}" fill="none" stroke="#3F8C62" stroke-width="2" stroke-dasharray="5 4"/>`
    : '';
  const vertices = [
    { x: -0.36, y: -0.36, z: -0.36 },
    { x: 0.36, y: -0.36, z: -0.36 },
    { x: 0.36, y: 0.36, z: -0.36 },
    { x: -0.36, y: 0.36, z: -0.36 },
    { x: -0.36, y: -0.36, z: 0.36 },
    { x: 0.36, y: -0.36, z: 0.36 },
    { x: 0.36, y: 0.36, z: 0.36 },
    { x: -0.36, y: 0.36, z: 0.36 },
  ].map((point) => project3DPoint(item, point));
  const faces = [
    [0, 1, 2, 3, 0.35],
    [4, 5, 6, 7, 0.78],
    [0, 4, 7, 3, 0.55],
    [1, 5, 6, 2, 0.6],
    [0, 1, 5, 4, 0.42],
    [3, 2, 6, 7, 0.5],
  ].map((face) => {
    const indexes = face.slice(0, 4) as number[];
    const points = indexes.map((index) => vertices[index]);
    return {
      depth: averageDepth(points),
      svg: `<polygon points="${projectedPolygonString(points)}" fill="${fill}" fill-opacity="${face[4].toFixed(2)}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>`,
    };
  }).sort((a, b) => a.depth - b.depth).map((face) => face.svg).join('\n  ');
  const centerLabel = item.label.trim()
    ? `<text x="${x + w / 2}" y="${y + h / 2 + 5}" font-family="Arial, sans-serif" font-size="15" font-weight="700" text-anchor="middle" fill="#e5e7eb">${escapeSvgText(item.label)}</text>`
    : '';

  return `${selection}
  ${faces}
  ${centerLabel}`;
}

function buildSceneGrid() {
  return Array.from({ length: 12 }, (_, index) => {
    const x = 40 + index * 40;
    const y = 30 + index * 30;
    return `<line x1="${x}" y1="20" x2="${x}" y2="340" stroke="#475569" stroke-opacity="0.28" stroke-width="1"/>
  <line x1="20" y1="${y}" x2="500" y2="${y}" stroke="#475569" stroke-opacity="0.28" stroke-width="1"/>`;
  }).join('\n  ');
}

function renderSceneItem(item: SceneItem, selectedId?: number) {
  const x = item.x;
  const y = item.y;
  const w = Math.max(10, item.width);
  const h = Math.max(10, item.height);
  const fill = item.fill;
  const stroke = item.stroke;
  const isSelected = item.id === selectedId;
  const selection = isSelected
    ? `<rect x="${x - 6}" y="${y - 6}" width="${w + 12}" height="${h + 12}" fill="none" stroke="#3F8C62" stroke-width="2" stroke-dasharray="5 4"/>`
    : '';

  const centerLabel = item.label.trim()
    ? `<text x="${x + w / 2}" y="${y + h / 2 + 5}" font-family="Arial, sans-serif" font-size="15" font-weight="700" text-anchor="middle" fill="#e5e7eb">${escapeSvgText(item.label)}</text>`
    : '';

  if (item.shape === 'text') {
    return `${selection}
  <text x="${x}" y="${y + 18}" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="${stroke}">${escapeSvgText(item.label || 'Текст')}</text>`;
  }

  if (item.shape === 'line') {
    const dash = item.dashed ? ' stroke-dasharray="8 6"' : '';
    const start = item.points?.[0] ?? { x, y: y + h };
    const end = item.points?.[1] ?? { x: x + w, y };
    return `${selection}
  <line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${stroke}" stroke-width="3" stroke-linecap="round"${dash}/>
  ${item.label.trim() ? dimensionText((start.x + end.x) / 2, (start.y + end.y) / 2 - 8, item.label) : ''}`;
  }

  if (item.shape === 'rectangle') {
    return `${selection}
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
  ${centerLabel}`;
  }

  if (item.shape === 'triangle') {
    const points = item.points?.length === 3
      ? item.points
      : [{ x: x + w / 2, y }, { x, y: y + h }, { x: x + w, y: y + h }];
    const bounds = getPointBounds(points);
    const pointString = points.map((point) => `${point.x},${point.y}`).join(' ');
    return `${selection}
  <polygon points="${pointString}" fill="${fill}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
  ${item.label.trim() ? `<text x="${bounds.x + bounds.width / 2}" y="${bounds.y + bounds.height / 2 + 5}" font-family="Arial, sans-serif" font-size="15" font-weight="700" text-anchor="middle" fill="#e5e7eb">${escapeSvgText(item.label)}</text>` : ''}`;
  }

  if (item.shape === 'circle') {
    return `${selection}
  <ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
  ${centerLabel}`;
  }

  if (item.shape === 'polygon') {
    return `${selection}
  <polygon points="${x + w * 0.18},${y + h * 0.85} ${x + w * 0.34},${y + h * 0.12} ${x + w * 0.76},${y + h * 0.08} ${x + w * 0.94},${y + h * 0.62} ${x + w * 0.56},${y + h * 0.94}" fill="${fill}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
  ${centerLabel}`;
  }

  if (item.shape === 'cylinder') {
    return wrapRotatedSvg(`${selection}
  <path d="M ${x} ${y + h * 0.2} C ${x} ${y}, ${x + w} ${y}, ${x + w} ${y + h * 0.2}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
  <path d="M ${x} ${y + h * 0.2} L ${x} ${y + h * 0.8} C ${x} ${y + h}, ${x + w} ${y + h}, ${x + w} ${y + h * 0.8} L ${x + w} ${y + h * 0.2}" fill="${fill}" fill-opacity="0.55" stroke="${stroke}" stroke-width="3"/>
  <ellipse cx="${x + w / 2}" cy="${y + h * 0.8}" rx="${w / 2}" ry="${h * 0.2}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
  ${centerLabel}`, item);
  }

  if (item.shape === 'pyramid') {
    return renderNgonPyramidSvg(item, selectedId);
  }

  if (item.shape === 'prism') {
    return renderNgonPrismSvg(item, selectedId);
  }

  if (item.shape === 'cube') {
    return renderProjectedCubeSvg(item, selectedId);
  }

  return wrapRotatedSvg(`${selection}
  <polygon points="${x},${y + h} ${x + w * 0.64},${y + h} ${x + w},${y + h * 0.62} ${x + w * 0.36},${y + h * 0.62}" fill="${fill}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
  <polygon points="${x + w * 0.64},${y + h * 0.14} ${x + w},${y - h * 0.24} ${x + w},${y + h * 0.62} ${x + w * 0.64},${y + h}" fill="${fill}" fill-opacity="0.6" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
  <polygon points="${x},${y + h * 0.14} ${x + w * 0.64},${y + h * 0.14} ${x + w},${y - h * 0.24} ${x + w * 0.36},${y - h * 0.24}" fill="${fill}" fill-opacity="0.35" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
  <rect x="${x}" y="${y + h * 0.14}" width="${w * 0.64}" height="${h * 0.86}" fill="${fill}" fill-opacity="0.8" stroke="${stroke}" stroke-width="3"/>
  ${centerLabel}`, item);
}

function buildSceneSvg(items: SceneItem[], title: string, showGrid: boolean, selectedId?: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 360" role="img" aria-label="Геометрический рисунок">
  <rect width="520" height="360" fill="none"/>
  ${showGrid ? buildSceneGrid() : ''}
  ${items.map((item) => renderSceneItem(item, selectedId)).join('\n  ')}
  ${title.trim() ? label(260, 28, title) : ''}
</svg>`;
}

function build2DSvg(shape: GeometryShape2D, title: string, primaryLabel: string, secondaryLabel: string, showGrid: boolean) {
  const grid = showGrid
    ? Array.from({ length: 9 }, (_, index) => {
        const x = 40 + index * 45;
        const y = 30 + index * 30;
        return `<line x1="${x}" y1="24" x2="${x}" y2="276" stroke="#475569" stroke-opacity="0.28" stroke-width="1"/>
  <line x1="28" y1="${y}" x2="392" y2="${y}" stroke="#475569" stroke-opacity="0.28" stroke-width="1"/>`;
      }).join('\n  ')
    : '';

  if (shape === 'triangle') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 300" role="img" aria-label="Геометрический рисунок">
  <rect width="420" height="300" fill="none"/>
  ${grid}
  <polygon points="80,236 344,236 214,54" fill="#dbeafe" stroke="#1d4ed8" stroke-width="3" stroke-linejoin="round"/>
  <line x1="214" y1="54" x2="214" y2="236" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 5"/>
  <path d="M 214 218 L 232 218 L 232 236" fill="none" stroke="#cbd5e1" stroke-width="2"/>
  ${label(70, 258, 'A')}
  ${label(356, 258, 'B')}
  ${label(214, 42, 'C')}
  ${label(214, 258, 'H')}
  ${dimensionText(212, 281, primaryLabel || 'основание')}
  ${dimensionText(235, 142, secondaryLabel || 'высота', 'start')}
  ${title.trim() ? label(210, 24, title) : ''}
</svg>`;
  }

  if (shape === 'circle') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 300" role="img" aria-label="Геометрический рисунок">
  <rect width="420" height="300" fill="none"/>
  ${grid}
  <circle cx="210" cy="150" r="88" fill="#dcfce7" stroke="#15803d" stroke-width="3"/>
  <line x1="210" y1="150" x2="298" y2="150" stroke="#166534" stroke-width="3"/>
  <line x1="122" y1="150" x2="298" y2="150" stroke="#86efac" stroke-width="2"/>
  <circle cx="210" cy="150" r="4" fill="#166534"/>
  ${label(210, 144, 'O')}
  ${label(304, 145, 'A')}
  ${dimensionText(254, 139, primaryLabel || 'r')}
  ${dimensionText(210, 252, secondaryLabel || 'd = 2r')}
  ${title.trim() ? label(210, 30, title) : ''}
</svg>`;
  }

  if (shape === 'polygon') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 300" role="img" aria-label="Геометрический рисунок">
  <rect width="420" height="300" fill="none"/>
  ${grid}
  <polygon points="96,220 160,72 292,64 350,190 238,244" fill="#fef3c7" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/>
  <line x1="96" y1="220" x2="292" y2="64" stroke="#d97706" stroke-width="2" stroke-dasharray="6 5"/>
  <line x1="160" y1="72" x2="238" y2="244" stroke="#d97706" stroke-width="2" stroke-dasharray="6 5"/>
  ${label(84, 242, 'A')}
  ${label(154, 58, 'B')}
  ${label(302, 52, 'C')}
  ${label(366, 194, 'D')}
  ${label(238, 268, 'E')}
  ${dimensionText(210, 282, primaryLabel || 'многоугольник')}
  ${dimensionText(312, 130, secondaryLabel || 'диагонали', 'start')}
  ${title.trim() ? label(210, 28, title) : ''}
</svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 300" role="img" aria-label="Геометрический рисунок">
  <rect width="420" height="300" fill="none"/>
  ${grid}
  <rect x="82" y="70" width="256" height="154" rx="4" fill="#e0f2fe" stroke="#0369a1" stroke-width="3"/>
  <line x1="82" y1="70" x2="338" y2="224" stroke="#0284c7" stroke-width="2.5"/>
  <line x1="338" y1="70" x2="82" y2="224" stroke="#0284c7" stroke-width="2.5"/>
  ${label(72, 64, 'A')}
  ${label(348, 64, 'B')}
  ${label(350, 248, 'C')}
  ${label(70, 248, 'D')}
  ${dimensionText(210, 246, primaryLabel || 'a')}
  ${dimensionText(354, 151, secondaryLabel || 'b', 'start')}
  ${title.trim() ? label(210, 30, title) : ''}
</svg>`;
}

function build3DSvg(shape: GeometryShape3D, title: string, primaryLabel: string, secondaryLabel: string, showHidden: boolean, baseSides: number, rotation: number, rotationX: number, rotationY: number) {
  const hidden = showHidden ? 'stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 5"' : 'stroke="transparent"';

  if (shape === 'pyramid') {
    const item: SceneItem = {
      id: 1,
      shape: 'pyramid',
      x: 92,
      y: 42,
      width: 276,
      height: 230,
      label: '',
      fill: '#fef3c7',
      stroke: '#b45309',
      baseSides,
      rotation,
      rotationX,
      rotationY,
    };
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 330" role="img" aria-label="Геометрический рисунок">
  <rect width="460" height="330" fill="none"/>
  ${renderNgonPyramidSvg(item)}
  ${showHidden ? '<line x1="230" y1="60" x2="230" y2="222" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 5"/>' : ''}
  ${label(224, 45, 'S')}
  ${dimensionText(198, 292, primaryLabel || `${clampSides(baseSides)}-угольное основание`)}
  ${dimensionText(242, 135, secondaryLabel || 'высота', 'start')}
  ${title.trim() ? label(230, 28, title) : ''}
</svg>`;
  }

  if (shape === 'cylinder') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 330" role="img" aria-label="Геометрический рисунок">
  <rect width="460" height="330" fill="none"/>
  <g${rotationTransform(140, 62, 180, 202, rotation, rotationX, rotationY)}>
  <path d="M 140 96 C 140 62, 320 62, 320 96" fill="#dbeafe" stroke="#1d4ed8" stroke-width="3"/>
  <path d="M 140 96 C 140 130, 320 130, 320 96" fill="none" ${hidden}/>
  <path d="M 140 96 L 140 230 C 140 264, 320 264, 320 230 L 320 96" fill="#eff6ff" stroke="#1d4ed8" stroke-width="3"/>
  <ellipse cx="230" cy="230" rx="90" ry="34" fill="#bfdbfe" stroke="#1d4ed8" stroke-width="3"/>
  <line x1="230" y1="96" x2="230" y2="230" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 5"/>
  <line x1="230" y1="96" x2="320" y2="96" stroke="#2563eb" stroke-width="2"/>
  ${label(230, 91, 'O')}
  ${dimensionText(275, 86, primaryLabel || 'r')}
  ${dimensionText(244, 168, secondaryLabel || 'h', 'start')}
  </g>
  ${title.trim() ? label(230, 30, title) : ''}
</svg>`;
  }

  if (shape === 'prism') {
    const item: SceneItem = {
      id: 1,
      shape: 'prism',
      x: 92,
      y: 42,
      width: 276,
      height: 230,
      label: '',
      fill: '#dcfce7',
      stroke: '#15803d',
      baseSides,
      rotation,
      rotationX,
      rotationY,
    };
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 330" role="img" aria-label="Геометрический рисунок">
  <rect width="460" height="330" fill="none"/>
  ${renderNgonPrismSvg(item)}
  ${dimensionText(222, 312, primaryLabel || `${clampSides(baseSides)}-угольное основание`)}
  ${dimensionText(352, 158, secondaryLabel || 'h', 'start')}
  ${title.trim() ? label(230, 26, title) : ''}
</svg>`;
  }

  const cubeItem: SceneItem = {
    id: 1,
    shape: 'cube',
    x: 116,
    y: 42,
    width: 222,
    height: 210,
    label: '',
    fill: '#dbeafe',
    stroke: '#1d4ed8',
    rotation,
    rotationX,
    rotationY,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 330" role="img" aria-label="Геометрический рисунок">
  <rect width="460" height="330" fill="none"/>
  ${renderProjectedCubeSvg(cubeItem)}
  ${dimensionText(193, 250, primaryLabel || 'a')}
  ${dimensionText(286, 157, secondaryLabel || 'a', 'start')}
  ${title.trim() ? label(230, 306, title) : ''}
</svg>`;
}

export default function GeometrySvgEditor({ open, onClose, onInsert }: GeometrySvgEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [mode, setMode] = useState<GeometryMode>('builder');
  const [shape2D, setShape2D] = useState<GeometryShape2D>('rectangle');
  const [shape3D, setShape3D] = useState<GeometryShape3D>('cube');
  const [title, setTitle] = useState('');
  const [primaryLabel, setPrimaryLabel] = useState('a');
  const [secondaryLabel, setSecondaryLabel] = useState('h');
  const [baseSides, setBaseSides] = useState(5);
  const [shape3DRotation, setShape3DRotation] = useState(0);
  const [shape3DRotationX, setShape3DRotationX] = useState(0);
  const [shape3DRotationY, setShape3DRotationY] = useState(0);
  const [displayWidth, setDisplayWidth] = useState(520);
  const [showHelpers, setShowHelpers] = useState(true);
  const [items, setItems] = useState<SceneItem[]>([
    { id: 1, shape: 'cube', x: 98, y: 106, width: 130, height: 105, label: 'A', fill: '#dbeafe', stroke: '#1d4ed8' },
    { id: 2, shape: 'pyramid', x: 292, y: 82, width: 138, height: 150, label: 'S', fill: '#fed7aa', stroke: '#c2410c' },
  ]);
  const [selectedId, setSelectedId] = useState(1);
  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  const svg = useMemo(
    () => {
      if (mode === 'builder') return buildSceneSvg(items, title, showHelpers, selectedId);
      return mode === '2d'
        ? build2DSvg(shape2D, title, primaryLabel, secondaryLabel, showHelpers)
        : build3DSvg(shape3D, title, primaryLabel, secondaryLabel, showHelpers, baseSides, shape3DRotation, shape3DRotationX, shape3DRotationY);
    },
    [mode, items, selectedId, shape2D, shape3D, title, primaryLabel, secondaryLabel, showHelpers, baseSides, shape3DRotation, shape3DRotationX, shape3DRotationY],
  );

  const addSceneItem = (shape: SceneShape) => {
    const nextId = Math.max(0, ...items.map((item) => item.id)) + 1;
    const is3d = ['cube', 'prism', 'pyramid', 'cylinder'].includes(shape);
    const x = 80 + (items.length % 4) * 42;
    const y = 70 + (items.length % 3) * 36;
    const width = shape === 'text' ? 120 : is3d ? 130 : 110;
    const height = shape === 'line' ? 80 : shape === 'text' ? 36 : is3d ? 110 : 90;
    const nextItem: SceneItem = {
      id: nextId,
      shape,
      x,
      y,
      width,
      height,
      label: shape === 'text' ? 'Текст' : '',
      fill: is3d ? '#dbeafe' : '#dcfce7',
      stroke: is3d ? '#1d4ed8' : '#15803d',
      baseSides: ['prism', 'pyramid'].includes(shape) ? 5 : undefined,
      dashed: shape === 'line' ? false : undefined,
      rotation: is3d ? 0 : undefined,
      rotationX: is3d ? 0 : undefined,
      rotationY: is3d ? 0 : undefined,
      points: shape === 'triangle'
        ? [{ x: x + width / 2, y }, { x, y: y + height }, { x: x + width, y: y + height }]
        : shape === 'line'
          ? [{ x, y: y + height }, { x: x + width, y }]
          : undefined,
    };
    setItems((current) => [...current, nextItem]);
    setSelectedId(nextId);
  };

  const updateSelectedItem = (patch: Partial<SceneItem>) => {
    if (!selectedItem) return;
    setItems((current) => current.map((item) => item.id === selectedItem.id ? { ...item, ...patch } : item));
  };

  const removeSelectedItem = () => {
    if (!selectedItem) return;
    setItems((current) => {
      const next = current.filter((item) => item.id !== selectedItem.id);
      setSelectedId(next[0]?.id ?? 0);
      return next;
    });
  };

  const getSvgPoint = (event: React.PointerEvent<SVGElement>) => {
    const svgNode = svgRef.current;
    if (!svgNode) return { x: 0, y: 0 };
    const point = svgNode.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const transformed = point.matrixTransform(svgNode.getScreenCTM()?.inverse());
    return { x: transformed.x, y: transformed.y };
  };

  const sceneItemBounds = (item: SceneItem) => {
    if ((item.shape === 'triangle' || item.shape === 'line') && item.points?.length) {
      return getPointBounds(item.points);
    }
    return {
      x: item.x,
      y: item.y,
      width: Math.max(10, item.width),
      height: Math.max(10, item.height),
    };
  };

  const setSceneItem = (id: number, patch: Partial<SceneItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const startMove = (event: React.PointerEvent<SVGGElement>, item: SceneItem) => {
    event.preventDefault();
    event.stopPropagation();
    const point = getSvgPoint(event);
    setSelectedId(item.id);
    dragRef.current = { kind: 'move', id: item.id, startX: point.x, startY: point.y, item };
  };

  const startResize = (event: React.PointerEvent<SVGCircleElement>, item: SceneItem, handle: ResizeHandle) => {
    event.preventDefault();
    event.stopPropagation();
    const point = getSvgPoint(event);
    setSelectedId(item.id);
    dragRef.current = { kind: 'resize', id: item.id, handle, startX: point.x, startY: point.y, item };
  };

  const startPointMove = (event: React.PointerEvent<SVGCircleElement>, item: SceneItem, pointIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(item.id);
    dragRef.current = { kind: 'point', id: item.id, pointIndex };
  };

  const handleScenePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    const point = getSvgPoint(event);
    if (drag.kind === 'point') {
      setItems((current) => current.map((item) => {
        if (item.id !== drag.id || !item.points) return item;
        const points = item.points.map((storedPoint, index) => index === drag.pointIndex ? point : storedPoint);
        const bounds = getPointBounds(points);
        return { ...item, ...bounds, points };
      }));
      return;
    }

    if (drag.kind === 'move') {
      const dx = point.x - drag.startX;
      const dy = point.y - drag.startY;
      const nextPoints = drag.item.points?.map((storedPoint) => ({ x: storedPoint.x + dx, y: storedPoint.y + dy }));
      const nextBounds = nextPoints?.length ? getPointBounds(nextPoints) : null;
      setSceneItem(drag.id, {
        x: Math.round(nextBounds?.x ?? drag.item.x + dx),
        y: Math.round(nextBounds?.y ?? drag.item.y + dy),
        width: Math.round(nextBounds?.width ?? drag.item.width),
        height: Math.round(nextBounds?.height ?? drag.item.height),
        points: nextPoints,
      });
      return;
    }

    const bounds = sceneItemBounds(drag.item);
    const left = drag.handle.includes('w') ? point.x : bounds.x;
    const right = drag.handle.includes('e') ? point.x : bounds.x + bounds.width;
    const top = drag.handle.includes('n') ? point.y : bounds.y;
    const bottom = drag.handle.includes('s') ? point.y : bounds.y + bounds.height;
    const x = Math.round(Math.min(left, right));
    const y = Math.round(Math.min(top, bottom));
    const width = Math.round(Math.max(16, Math.abs(right - left)));
    const height = Math.round(Math.max(16, Math.abs(bottom - top)));

    if (drag.item.shape === 'triangle') {
      setSceneItem(drag.id, {
        x,
        y,
        width,
        height,
        points: [{ x: x + width / 2, y }, { x, y: y + height }, { x: x + width, y: y + height }],
      });
      return;
    }

    if (drag.item.shape === 'line') {
      const start = drag.item.points?.[0] ?? { x: bounds.x, y: bounds.y + bounds.height };
      const end = drag.item.points?.[1] ?? { x: bounds.x + bounds.width, y: bounds.y };
      const xScale = bounds.width === 0 ? 1 : width / bounds.width;
      const yScale = bounds.height === 0 ? 1 : height / bounds.height;
      const points = [start, end].map((storedPoint) => ({
        x: x + (storedPoint.x - bounds.x) * xScale,
        y: y + (storedPoint.y - bounds.y) * yScale,
      }));
      setSceneItem(drag.id, { x, y, width, height, points });
      return;
    }

    setSceneItem(drag.id, { x, y, width, height });
  };

  const stopSceneDrag = () => {
    dragRef.current = null;
  };

  const adjustSelectedRotation = (
    event: React.PointerEvent<SVGGElement>,
    axis: 'x' | 'y' | 'z',
    delta: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedItem || !is3DShape(selectedItem.shape)) return;

    const key = axis === 'x' ? 'rotationX' : axis === 'y' ? 'rotationY' : 'rotation';
    const currentValue = selectedItem[key] ?? 0;
    updateSelectedItem({ [key]: Math.max(-180, Math.min(180, currentValue + delta)) } as Partial<SceneItem>);
  };

  const renderInteractiveItem = (item: SceneItem) => {
    const bounds = sceneItemBounds(item);
    const x = item.x;
    const y = item.y;
    const w = Math.max(10, item.width);
    const h = Math.max(10, item.height);
    const centerLabel = item.label.trim()
      ? <text x={bounds.x + bounds.width / 2} y={bounds.y + bounds.height / 2 + 5} fontFamily="Arial, sans-serif" fontSize="15" fontWeight="700" textAnchor="middle" fill="#e5e7eb">{item.label}</text>
      : null;
    const transform = is3DShape(item.shape) && (item.rotation || item.rotationX || item.rotationY)
      ? `translate(${x + w / 2} ${y + h / 2}) rotate(${Math.round(item.rotation || 0)}) skewX(${Math.round(item.rotationY || 0) * 0.28}) skewY(${-Math.round(item.rotationX || 0) * 0.22}) scale(${0.68 + 0.32 * Math.cos((Math.abs(item.rotationY || 0) * Math.PI) / 180)} ${0.68 + 0.32 * Math.cos((Math.abs(item.rotationX || 0) * Math.PI) / 180)}) translate(${-x - w / 2} ${-y - h / 2})`
      : undefined;

    if (item.shape === 'text') {
      return (
        <g onPointerDown={(event) => startMove(event, item)} className="cursor-move">
          <text x={x} y={y + 18} fontFamily="Arial, sans-serif" fontSize="18" fontWeight="700" fill={item.stroke}>{item.label || 'Текст'}</text>
        </g>
      );
    }

    if (item.shape === 'line') {
      const start = item.points?.[0] ?? { x, y: y + h };
      const end = item.points?.[1] ?? { x: x + w, y };
      return (
        <g onPointerDown={(event) => startMove(event, item)} className="cursor-move">
          <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={item.stroke} strokeWidth="3" strokeLinecap="round" strokeDasharray={item.dashed ? '8 6' : undefined} />
          {item.label.trim() && <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 8} fontFamily="Arial, sans-serif" fontSize="13" textAnchor="middle" fill="#cbd5e1">{item.label}</text>}
        </g>
      );
    }

    if (item.shape === 'rectangle') {
      return (
        <g onPointerDown={(event) => startMove(event, item)} className="cursor-move">
          <rect x={x} y={y} width={w} height={h} rx="4" fill={item.fill} stroke={item.stroke} strokeWidth="3" />
          {centerLabel}
        </g>
      );
    }

    if (item.shape === 'triangle') {
      const points = item.points?.length === 3
        ? item.points
        : [{ x: x + w / 2, y }, { x, y: y + h }, { x: x + w, y: y + h }];
      return (
        <g>
          <polygon
            points={points.map((point) => `${point.x},${point.y}`).join(' ')}
            fill={item.fill}
            stroke={item.stroke}
            strokeWidth="3"
            strokeLinejoin="round"
            onPointerDown={(event) => startMove(event, item)}
            className="cursor-move"
          />
          {centerLabel}
        </g>
      );
    }

    if (item.shape === 'circle') {
      return (
        <g onPointerDown={(event) => startMove(event, item)} className="cursor-move">
          <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} fill={item.fill} stroke={item.stroke} strokeWidth="3" />
          {centerLabel}
        </g>
      );
    }

    if (item.shape === 'polygon') {
      return (
        <g onPointerDown={(event) => startMove(event, item)} className="cursor-move">
          <polygon points={`${x + w * 0.18},${y + h * 0.85} ${x + w * 0.34},${y + h * 0.12} ${x + w * 0.76},${y + h * 0.08} ${x + w * 0.94},${y + h * 0.62} ${x + w * 0.56},${y + h * 0.94}`} fill={item.fill} stroke={item.stroke} strokeWidth="3" strokeLinejoin="round" />
          {centerLabel}
        </g>
      );
    }

    if (item.shape === 'cylinder') {
      return (
        <g transform={transform} onPointerDown={(event) => startMove(event, item)} className="cursor-move">
          <path d={`M ${x} ${y + h * 0.2} C ${x} ${y}, ${x + w} ${y}, ${x + w} ${y + h * 0.2}`} fill={item.fill} stroke={item.stroke} strokeWidth="3" />
          <path d={`M ${x} ${y + h * 0.2} L ${x} ${y + h * 0.8} C ${x} ${y + h}, ${x + w} ${y + h}, ${x + w} ${y + h * 0.8} L ${x + w} ${y + h * 0.2}`} fill={item.fill} fillOpacity="0.55" stroke={item.stroke} strokeWidth="3" />
          <ellipse cx={x + w / 2} cy={y + h * 0.8} rx={w / 2} ry={h * 0.2} fill={item.fill} stroke={item.stroke} strokeWidth="3" />
          {centerLabel}
        </g>
      );
    }

    if (item.shape === 'pyramid') {
      return (
        <g onPointerDown={(event) => startMove(event, item)} className="cursor-move" dangerouslySetInnerHTML={{ __html: renderNgonPyramidSvg(item) }} />
      );
    }

    if (item.shape === 'prism') {
      return (
        <g onPointerDown={(event) => startMove(event, item)} className="cursor-move" dangerouslySetInnerHTML={{ __html: renderNgonPrismSvg(item) }} />
      );
    }

    if (item.shape === 'cube') {
      return (
        <g onPointerDown={(event) => startMove(event, item)} className="cursor-move" dangerouslySetInnerHTML={{ __html: renderProjectedCubeSvg(item) }} />
      );
    }

    return (
      <g transform={transform} onPointerDown={(event) => startMove(event, item)} className="cursor-move">
        <polygon points={`${x},${y + h} ${x + w * 0.64},${y + h} ${x + w},${y + h * 0.62} ${x + w * 0.36},${y + h * 0.62}`} fill={item.fill} stroke={item.stroke} strokeWidth="3" strokeLinejoin="round" />
        <polygon points={`${x + w * 0.64},${y + h * 0.14} ${x + w},${y - h * 0.24} ${x + w},${y + h * 0.62} ${x + w * 0.64},${y + h}`} fill={item.fill} fillOpacity="0.6" stroke={item.stroke} strokeWidth="3" strokeLinejoin="round" />
        <polygon points={`${x},${y + h * 0.14} ${x + w * 0.64},${y + h * 0.14} ${x + w},${y - h * 0.24} ${x + w * 0.36},${y - h * 0.24}`} fill={item.fill} fillOpacity="0.35" stroke={item.stroke} strokeWidth="3" strokeLinejoin="round" />
        <rect x={x} y={y + h * 0.14} width={w * 0.64} height={h * 0.86} fill={item.fill} fillOpacity="0.8" stroke={item.stroke} strokeWidth="3" />
        {centerLabel}
      </g>
    );
  };

  const renderSelectionControls = () => {
    if (!selectedItem) return null;
    const bounds = sceneItemBounds(selectedItem);
    const handles: Array<{ handle: ResizeHandle; x: number; y: number; cursor: string }> = [
      { handle: 'nw', x: bounds.x, y: bounds.y, cursor: 'nwse-resize' },
      { handle: 'ne', x: bounds.x + bounds.width, y: bounds.y, cursor: 'nesw-resize' },
      { handle: 'sw', x: bounds.x, y: bounds.y + bounds.height, cursor: 'nesw-resize' },
      { handle: 'se', x: bounds.x + bounds.width, y: bounds.y + bounds.height, cursor: 'nwse-resize' },
    ];

    return (
      <g>
        <rect
          x={bounds.x - 6}
          y={bounds.y - 6}
          width={bounds.width + 12}
          height={bounds.height + 12}
          fill="none"
          stroke="#3F8C62"
          strokeWidth="2"
          strokeDasharray="5 4"
          pointerEvents="none"
        />
        {(selectedItem.shape === 'triangle' || selectedItem.shape === 'line') && selectedItem.points?.map((point, index) => (
          <circle
            key={`point-${index}`}
            cx={point.x}
            cy={point.y}
            r="6"
            fill="#3F8C62"
            stroke="#ffffff"
            strokeWidth="2"
            className="cursor-move"
            onPointerDown={(event) => startPointMove(event, selectedItem, index)}
          />
        ))}
        {selectedItem.shape !== 'triangle' && selectedItem.shape !== 'line' && handles.map((handle) => (
          <circle
            key={handle.handle}
            cx={handle.x}
            cy={handle.y}
            r="5.5"
            fill="#2563eb"
            stroke="#ffffff"
            strokeWidth="2"
            style={{ cursor: handle.cursor }}
            onPointerDown={(event) => startResize(event, selectedItem, handle.handle)}
          />
        ))}
        {is3DShape(selectedItem.shape) && (
          <g>
            {([
              ['X-', 'x', -10, bounds.x + bounds.width + 16, bounds.y],
              ['X+', 'x', 10, bounds.x + bounds.width + 52, bounds.y],
              ['Y-', 'y', -10, bounds.x + bounds.width + 16, bounds.y + 28],
              ['Y+', 'y', 10, bounds.x + bounds.width + 52, bounds.y + 28],
              ['Z-', 'z', -10, bounds.x + bounds.width + 16, bounds.y + 56],
              ['Z+', 'z', 10, bounds.x + bounds.width + 52, bounds.y + 56],
            ] as Array<[string, 'x' | 'y' | 'z', number, number, number]>).map(([text, axis, delta, buttonX, buttonY]) => (
              <g
                key={text}
                className="cursor-pointer"
                onPointerDown={(event) => adjustSelectedRotation(event, axis, delta)}
              >
                <rect
                  x={buttonX}
                  y={buttonY}
                  width="30"
                  height="22"
                  rx="7"
                  fill="#111827"
                  stroke="#86efac"
                  strokeOpacity="0.65"
                />
                <text
                  x={buttonX + 15}
                  y={buttonY + 15}
                  fontFamily="Arial, sans-serif"
                  fontSize="10"
                  fontWeight="800"
                  textAnchor="middle"
                  fill="#e5e7eb"
                  pointerEvents="none"
                >
                  {text}
                </text>
              </g>
            ))}
          </g>
        )}
      </g>
    );
  };

  const exportSvg = mode === 'builder'
    ? buildSceneSvg(items, title, showHelpers)
    : svg;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-base font-black text-gray-900">SVG-фигура для задачи</h3>
            <p className="text-xs text-gray-500">Быстрые 2D и 3D схемы: прямоугольник, треугольник, окружность, куб, призма, пирамида и цилиндр.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[330px_1fr]">
          <div className="space-y-4 overflow-y-auto border-r border-gray-100 p-5">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMode('builder')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${mode === 'builder' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                <Plus size={15} /> Сборка
              </button>
              <button
                type="button"
                onClick={() => setMode('2d')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${mode === '2d' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                <Square size={15} /> 2D
              </button>
              <button
                type="button"
                onClick={() => setMode('3d')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${mode === '3d' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                <Box size={15} /> 3D
              </button>
            </div>

            {mode === 'builder' ? (
              <div className="space-y-4">
                <div>
                  <span className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-400">Добавить в рисунок</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['rectangle', 'Прямоуг.'],
                      ['triangle', 'Треуг.'],
                      ['circle', 'Окружн.'],
                      ['line', 'Линия'],
                      ['cube', 'Куб'],
                      ['prism', 'Призма'],
                      ['pyramid', 'Пирамида'],
                      ['cylinder', 'Цилиндр'],
                      ['text', 'Текст'],
                    ].map(([shape, labelText]) => (
                      <button
                        key={shape}
                        type="button"
                        onClick={() => addSceneItem(shape as SceneShape)}
                        className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        {labelText}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-400">Слои</span>
                  <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-gray-100 p-1">
                    {items.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-bold ${selectedId === item.id ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:bg-gray-50'}`}
                      >
                        <span>{index + 1}. {item.shape}{item.label ? ` · ${item.label}` : ''}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedItem && (
                  <div className="space-y-3 rounded-2xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wide text-gray-400">Выбранная фигура</span>
                      <button
                        type="button"
                        onClick={removeSelectedItem}
                        className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <select
                      value={selectedItem.shape}
                      onChange={(event) => {
                        const shape = event.target.value as SceneShape;
                        updateSelectedItem({
                          shape,
                          baseSides: ['prism', 'pyramid'].includes(shape) ? clampSides(selectedItem.baseSides) : undefined,
                          dashed: shape === 'line' ? Boolean(selectedItem.dashed) : undefined,
                          rotation: is3DShape(shape) ? (selectedItem.rotation ?? 0) : undefined,
                          rotationX: is3DShape(shape) ? (selectedItem.rotationX ?? 0) : undefined,
                          rotationY: is3DShape(shape) ? (selectedItem.rotationY ?? 0) : undefined,
                          points: shape === 'triangle'
                            ? [
                                { x: selectedItem.x + selectedItem.width / 2, y: selectedItem.y },
                                { x: selectedItem.x, y: selectedItem.y + selectedItem.height },
                                { x: selectedItem.x + selectedItem.width, y: selectedItem.y + selectedItem.height },
                              ]
                            : shape === 'line'
                              ? [
                                  { x: selectedItem.x, y: selectedItem.y + selectedItem.height },
                                  { x: selectedItem.x + selectedItem.width, y: selectedItem.y },
                                ]
                            : undefined,
                        });
                      }}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <option value="rectangle">Прямоугольник</option>
                      <option value="triangle">Треугольник</option>
                      <option value="circle">Окружность</option>
                      <option value="polygon">Многоугольник</option>
                      <option value="line">Линия</option>
                      <option value="cube">Куб</option>
                      <option value="prism">Призма</option>
                      <option value="pyramid">Пирамида</option>
                      <option value="cylinder">Цилиндр</option>
                      <option value="text">Текст</option>
                    </select>
                    <div className="grid grid-cols-4 gap-2">
                      {selectedItem.shape === 'line'
                        ? ([
                            ['x1', selectedItem.points?.[0]?.x ?? selectedItem.x, 0, 'x'],
                            ['y1', selectedItem.points?.[0]?.y ?? selectedItem.y + selectedItem.height, 0, 'y'],
                            ['x2', selectedItem.points?.[1]?.x ?? selectedItem.x + selectedItem.width, 1, 'x'],
                            ['y2', selectedItem.points?.[1]?.y ?? selectedItem.y, 1, 'y'],
                          ] as Array<[string, number, number, 'x' | 'y']>).map(([key, value, pointIndex, axis]) => (
                            <label key={key} className="text-[10px] font-bold uppercase text-gray-400">
                              {key}
                              <input
                                type="number"
                                value={Math.round(value)}
                                onChange={(event) => {
                                  const nextPoints = [
                                    selectedItem.points?.[0] ?? { x: selectedItem.x, y: selectedItem.y + selectedItem.height },
                                    selectedItem.points?.[1] ?? { x: selectedItem.x + selectedItem.width, y: selectedItem.y },
                                  ].map((point, index) => index === pointIndex ? { ...point, [axis]: Number(event.target.value) || 0 } : point);
                                  updateSelectedItem({ ...getPointBounds(nextPoints), points: nextPoints });
                                }}
                                className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
                              />
                            </label>
                          ))
                        : ([
                            ['x', selectedItem.x],
                            ['y', selectedItem.y],
                            ['width', selectedItem.width],
                            ['height', selectedItem.height],
                          ] as Array<[string, number]>).map(([key, value]) => (
                            <label key={key} className="text-[10px] font-bold uppercase text-gray-400">
                              {key}
                              <input
                                type="number"
                                value={value}
                                onChange={(event) => updateSelectedItem({ [key]: Number(event.target.value) || 0 } as Partial<SceneItem>)}
                                className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
                              />
                            </label>
                          ))}
                    </div>
                    <input
                      type="text"
                      value={selectedItem.label}
                      onChange={(event) => updateSelectedItem({ label: event.target.value })}
                      placeholder="Подпись"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    {['prism', 'pyramid'].includes(selectedItem.shape) && (
                      <label className="block text-[10px] font-bold uppercase text-gray-400">
                        Сторон в основании
                        <input
                          type="number"
                          min="3"
                          max="12"
                          value={clampSides(selectedItem.baseSides)}
                          onChange={(event) => updateSelectedItem({ baseSides: clampSides(Number(event.target.value)) })}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
                        />
                      </label>
                    )}
                    {is3DShape(selectedItem.shape) && (
                      <div className="space-y-2 rounded-xl border border-gray-100 p-2">
                        {([
                          ['X', 'rotationX', selectedItem.rotationX || 0],
                          ['Y', 'rotationY', selectedItem.rotationY || 0],
                          ['Z', 'rotation', selectedItem.rotation || 0],
                        ] as Array<[string, keyof SceneItem, number]>).map(([axis, key, value]) => (
                          <label key={axis} className="block text-[10px] font-bold uppercase text-gray-400">
                            Поворот {axis}: {Math.round(value)}°
                            <input
                              type="range"
                              min="-180"
                              max="180"
                              step="5"
                              value={value}
                              onChange={(event) => updateSelectedItem({ [key]: Number(event.target.value) || 0 } as Partial<SceneItem>)}
                              className="mt-1 w-full"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                    {selectedItem.shape === 'line' && (
                      <label className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
                        Штриховая линия
                        <input
                          type="checkbox"
                          checked={Boolean(selectedItem.dashed)}
                          onChange={(event) => updateSelectedItem({ dashed: event.target.checked })}
                        />
                      </label>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] font-bold uppercase text-gray-400">
                        Заливка
                        <input
                          type="color"
                          value={selectedItem.fill}
                          onChange={(event) => updateSelectedItem({ fill: event.target.value })}
                          className="mt-1 h-9 w-full rounded-lg border border-gray-200 p-1"
                        />
                      </label>
                      <label className="text-[10px] font-bold uppercase text-gray-400">
                        Контур
                        <input
                          type="color"
                          value={selectedItem.stroke}
                          onChange={(event) => updateSelectedItem({ stroke: event.target.value })}
                          className="mt-1 h-9 w-full rounded-lg border border-gray-200 p-1"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            ) : (
            <div>
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-400">Фигура</span>
              {mode === '2d' ? (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['rectangle', 'Прямоугольник', Square],
                    ['triangle', 'Треугольник', Triangle],
                    ['circle', 'Окружность', Circle],
                    ['polygon', 'Многоугольник', Square],
                  ].map(([value, labelText, Icon]) => (
                    <button
                      key={value as string}
                      type="button"
                      onClick={() => setShape2D(value as GeometryShape2D)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${shape2D === value ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                    >
                      <Icon size={14} /> {labelText as string}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['cube', 'Куб'],
                    ['prism', 'Призма'],
                    ['pyramid', 'Пирамида'],
                    ['cylinder', 'Цилиндр'],
                  ].map(([value, labelText]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setShape3D(value as GeometryShape3D)}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold ${shape3D === value ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                    >
                      {labelText}
                    </button>
                  ))}
                </div>
              )}
              {mode === '3d' && ['prism', 'pyramid'].includes(shape3D) && (
                <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  Сторон в основании
                  <input
                    type="number"
                    min="3"
                    max="12"
                    value={baseSides}
                    onChange={(event) => setBaseSides(clampSides(Number(event.target.value)))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm normal-case"
                  />
                </label>
              )}
              {mode === '3d' && (
                <div className="mt-3 space-y-2 rounded-xl border border-gray-100 p-2">
                  {([
                    ['X', shape3DRotationX, setShape3DRotationX],
                    ['Y', shape3DRotationY, setShape3DRotationY],
                    ['Z', shape3DRotation, setShape3DRotation],
                  ] as Array<[string, number, React.Dispatch<React.SetStateAction<number>>]>).map(([axis, value, setter]) => (
                    <label key={axis} className="block text-[11px] font-bold uppercase tracking-wide text-gray-500">
                      Поворот {axis}: {Math.round(value)}°
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="5"
                        value={value}
                        onChange={(event) => setter(Number(event.target.value) || 0)}
                        className="mt-1 w-full"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
            )}

            <div className="space-y-3">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500">
                Заголовок / условное обозначение
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Напр. Рис. 1"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm normal-case"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  Подпись 1
                  <input
                    type="text"
                    value={primaryLabel}
                    onChange={(event) => setPrimaryLabel(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm normal-case"
                  />
                </label>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  Подпись 2
                  <input
                    type="text"
                    value={secondaryLabel}
                    onChange={(event) => setSecondaryLabel(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm normal-case"
                  />
                </label>
              </div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500">
                Ширина на странице
                <input
                  type="number"
                  min="240"
                  max="900"
                  step="10"
                  value={displayWidth}
                  onChange={(event) => setDisplayWidth(Math.max(240, Number(event.target.value) || 520))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm normal-case"
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
                {mode === '3d' ? 'Скрытые ребра' : 'Сетка / направляющие'}
                <input type="checkbox" checked={showHelpers} onChange={(event) => setShowHelpers(event.target.checked)} />
              </label>
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden p-5">
            <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-gray-200 bg-gray-50 p-4">
              {mode === 'builder' ? (
                <div className="mx-auto max-w-2xl rounded-xl bg-white p-4 shadow-sm">
                  <svg
                    ref={svgRef}
                    viewBox="0 0 520 360"
                    role="img"
                    aria-label="Геометрический рисунок"
                    className="h-auto w-full select-none rounded-lg"
                    onPointerMove={handleScenePointerMove}
                    onPointerUp={stopSceneDrag}
                    onPointerLeave={stopSceneDrag}
                    onPointerDown={() => setSelectedId(0)}
                  >
                    <rect width="520" height="360" fill="#ffffff" />
                    {showHelpers && (
                      <g pointerEvents="none">
                        {Array.from({ length: 12 }, (_, index) => {
                          const x = 40 + index * 40;
                          const y = 30 + index * 30;
                          return (
                            <React.Fragment key={index}>
                              <line x1={x} y1="20" x2={x} y2="340" stroke="#475569" strokeOpacity="0.28" strokeWidth="1" />
                              <line x1="20" y1={y} x2="500" y2={y} stroke="#475569" strokeOpacity="0.28" strokeWidth="1" />
                            </React.Fragment>
                          );
                        })}
                      </g>
                    )}
                    {items.map((item) => (
                      <g key={item.id} onPointerDown={(event) => event.stopPropagation()}>
                        {renderInteractiveItem(item)}
                      </g>
                    ))}
                    {title.trim() && <text x="260" y="28" fontFamily="Arial, sans-serif" fontSize="16" fontWeight="700" textAnchor="middle" fill="#e5e7eb">{title}</text>}
                    {renderSelectionControls()}
                  </svg>
                </div>
              ) : (
                <div className="mx-auto max-w-2xl rounded-xl bg-white p-4 shadow-sm" dangerouslySetInnerHTML={{ __html: svg }} />
              )}
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50">
                Отмена
              </button>
              <button
                onClick={() => {
                  onInsert(svgToImageHtml(exportSvg, displayWidth));
                  onClose();
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
              >
                Вставить фигуру
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
