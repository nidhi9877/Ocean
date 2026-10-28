import { useState, useRef } from 'react';

// Shared chart primitives for the management console.
// Categorical slots follow a fixed order (never cycled): 1 = blue, 2 = orange.
export const SERIES = ['#2a78d6', '#eb6834'];

const shortDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

const niceMax = (v) => {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find(s => s * pow * 4 >= v) * pow;
  return step * 4;
};

// Multi-series line chart with a crosshair + tooltip. `series` = [{ key, label, color }]
export function LineChart({ data, series, height = 220 }) {
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  const W = 640, H = height, pad = { l: 34, r: 12, t: 12, b: 26 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...data.flatMap(d => series.map(s => d[s.key] || 0))));
  const x = (i) => pad.l + (data.length > 1 ? (i / (data.length - 1)) * iw : iw / 2);
  const y = (v) => pad.t + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(max * f));

  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - pad.l) / iw) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <div className="mg-chart">
      <div className="mg-legend">
        {series.map(s => (
          <span key={s.key} className="mg-legend-item"><i style={{ background: s.color }} />{s.label}</span>
        ))}
      </div>
      <div style={{ position: 'relative' }}>
        <svg
          ref={ref}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={`Line chart of ${series.map(s => s.label).join(' and ')} over ${data.length} days`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {ticks.map(t => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border-color)" strokeWidth="1" />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{t}</text>
            </g>
          ))}
          {data.map((d, i) => (i % 7 === 0 || i === data.length - 1) && (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{shortDate(d.day)}</text>
          ))}
          {series.map(s => (
            <path
              key={s.key}
              d={data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d[s.key] || 0)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--text-muted)" strokeDasharray="3 3" />
              {series.map(s => (
                <circle key={s.key} cx={x(hover)} cy={y(data[hover][s.key] || 0)} r="4.5" fill={s.color} stroke="#fff" strokeWidth="2" />
              ))}
            </g>
          )}
        </svg>
        {hover !== null && (
          <div
            className="mg-tooltip"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > data.length / 2 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }}
          >
            <div className="mg-tooltip-title">{shortDate(data[hover].day)}</div>
            {series.map(s => (
              <div key={s.key} className="mg-tooltip-row">
                <i style={{ background: s.color }} />{s.label}<strong>{data[hover][s.key] || 0}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Vertical bar chart (single series) with per-bar hover tooltip
export function BarChart({ data, valueKey = 'count', label, color = SERIES[0], height = 180 }) {
  const [hover, setHover] = useState(null);
  const W = 640, H = height, pad = { l: 34, r: 8, t: 10, b: 26 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...data.map(d => d[valueKey] || 0)));
  const slot = iw / data.length;
  const bw = Math.max(2, slot - 2);
  const y = (v) => pad.t + ih - (v / max) * ih;
  const ticks = [0, 0.5, 1].map(f => Math.round(max * f));

  return (
    <div className="mg-chart" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Bar chart of ${label}`} style={{ display: 'block' }} onMouseLeave={() => setHover(null)}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border-color)" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const v = d[valueKey] || 0;
          const h = Math.max(v ? 2 : 0, (v / max) * ih);
          const bx = pad.l + i * slot + 1;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={ih} fill="transparent" />
              {h > 0 && <path d={roundedTop(bx, pad.t + ih - h, bw, h, Math.min(4, bw / 2))} fill={color} opacity={hover === null || hover === i ? 1 : 0.45} />}
              {(i % 7 === 0 || i === data.length - 1) && (
                <text x={bx + bw / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{shortDate(d.day)}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="mg-tooltip" style={{ left: `${((pad.l + hover * slot + slot / 2) / W) * 100}%`, top: 0, transform: hover > data.length / 2 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)' }}>
          <div className="mg-tooltip-title">{shortDate(data[hover].day)}</div>
          <div className="mg-tooltip-row"><i style={{ background: color }} />{label}<strong>{data[hover][valueKey] || 0}</strong></div>
        </div>
      )}
    </div>
  );
}

const roundedTop = (x, y, w, h, r) =>
  `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;

// Horizontal ranked bars (label · bar · value). Text stays in ink colours; the bar carries identity.
export function RankBars({ items, labelKey, valueKey = 'count', color = SERIES[0], format = (v) => v }) {
  const max = Math.max(1, ...items.map(i => i[valueKey] || 0));
  if (items.length === 0) return <div className="mg-empty-sm">No data yet</div>;
  return (
    <div className="mg-rank">
      {items.map((item, idx) => (
        <div key={idx} className="mg-rank-row" title={`${item[labelKey]}: ${format(item[valueKey])}`}>
          <span className="mg-rank-label">{item[labelKey]}</span>
          <span className="mg-rank-track">
            <span className="mg-rank-bar" style={{ width: `${((item[valueKey] || 0) / max) * 100}%`, background: item.color || color }} />
          </span>
          <span className="mg-rank-value">{format(item[valueKey])}</span>
        </div>
      ))}
    </div>
  );
}

// Tiny trend line for KPI tiles
export function Sparkline({ values, color = SERIES[0] }) {
  if (!values || values.length < 2) return null;
  const W = 120, H = 32, max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - 2 - (v / max) * (H - 4)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="32" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
