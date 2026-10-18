// Простой линейный график на SVG (без библиотек). Работает как серверный компонент.
export function LineChart({
  points,
  height = 200,
  formatValue = (n: number) => String(Math.round(n)),
}: {
  points: { label: string; value: number }[];
  height?: number;
  formatValue?: (n: number) => string;
}) {
  const W = 640;
  const H = height;
  const pad = { l: 8, r: 8, t: 16, b: 24 };
  const max = Math.max(1, ...points.map((p) => p.value));
  const n = points.length;
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i * (W - pad.l - pad.r)) / (n - 1));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const step = Math.max(1, Math.ceil(n / 8));

  if (n === 0) return <p className="text-sm text-slate-500">Нет данных</p>;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="График">
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#e2e8f0" />
      <line x1={pad.l} x2={W - pad.r} y1={pad.t} y2={pad.t} stroke="#f1f5f9" />
      <text x={pad.l} y={pad.t - 4} fontSize="11" fill="#94a3b8">
        {formatValue(max)}
      </text>
      <path d={path} fill="none" stroke="#059669" strokeWidth="2" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r="3.5" fill="#059669">
            <title>{`${p.label}: ${formatValue(p.value)}`}</title>
          </circle>
          {i % step === 0 && (
            <text x={x(i)} y={H - 6} fontSize="11" fill="#64748b" textAnchor="middle">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
