import React from 'react';

interface MatrixRow {
  label: string;
  values: (string | React.ReactNode)[];
}

interface TradeoffMatrixProps {
  headers: string[];
  rows: MatrixRow[];
  highlightIndex?: number;
}

export const TradeoffMatrix: React.FC<TradeoffMatrixProps> = ({ headers, rows, highlightIndex }) => (
  <div className="overflow-x-auto my-8 border border-border rounded-lg">
    <table className="w-full min-w-[820px] text-left border-collapse bg-card text-card-foreground">
      <thead>
        <tr className="bg-muted">
          {headers.map((header, i) => (
            <th key={i} className={`p-4 font-bold border-b border-border ${i === 0 ? 'sticky left-0 bg-muted text-foreground z-10' : ''}`}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="hover:bg-muted/50 transition-colors group">
            <td className="p-4 font-medium border-b border-border sticky left-0 bg-card group-hover:bg-muted/50 z-10 min-w-[140px]">
              {row.label}
            </td>
            {row.values.map((val, j) => (
              <td key={j} className={`p-4 border-b border-border font-mono text-sm ${j + 1 === highlightIndex ? 'bg-accent/5 font-bold' : ''}`}>
                {val}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
