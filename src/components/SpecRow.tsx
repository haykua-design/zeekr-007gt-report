import React from 'react';

interface SpecRowProps {
  label: string;
  value: string;
  highlight?: boolean;
}

export const SpecRow: React.FC<SpecRowProps> = ({ label, value, highlight }) => (
  <div className={`flex justify-between items-center py-3 border-b border-muted last:border-0 ${highlight ? 'bg-primary/5 -mx-2 px-2 rounded' : ''}`}>
    <span className="text-muted-foreground font-medium">{label}</span>
    <span className={`font-mono font-semibold ${highlight ? 'text-primary' : 'text-foreground'}`}>
      {value}
    </span>
  </div>
);
