import React from 'react';

interface QRCodeViewProps {
  value: string;
  size?: number;
  label?: string;
}

export const QRCodeView: React.FC<QRCodeViewProps> = ({ value, size = 110, label }) => {
  // Simple deterministic 21x21 QR SVG generator simulation
  const hash = Array.from(value).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 1000000007, 0);

  const modules: boolean[][] = [];
  for (let r = 0; r < 21; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < 21; c++) {
      // Corner finder patterns (7x7)
      if ((r < 7 && c < 7) || (r < 7 && c >= 14) || (r >= 14 && c < 7)) {
        const inOuter = r === 0 || r === 6 || c === 0 || c === 6 || r === 14 || r === 20 || c === 14 || c === 20;
        const inInner = (r >= 2 && r <= 4 && c >= 2 && c <= 4) ||
                        (r >= 2 && r <= 4 && c >= 16 && c <= 18) ||
                        (r >= 16 && r <= 18 && c >= 2 && c <= 4);
        row.push(inOuter || inInner);
      } else {
        const val = (hash * (r + 1) * (c + 1)) % 7;
        row.push(val > 3);
      }
    }
    modules.push(row);
  }

  const cellSize = size / 21;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ background: '#ffffff', padding: '6px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        {modules.map((row, r) =>
          row.map((cell, c) => (
            cell ? (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize}
                height={cellSize}
                fill="#0f172a"
              />
            ) : null
          ))
        )}
      </svg>
      {label && <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>{label}</span>}
    </div>
  );
};
