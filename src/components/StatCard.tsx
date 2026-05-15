import React from 'react';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  description?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, unit, description, className = "" }) => (
  <div className={`bg-card text-card-foreground p-6 border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 hover:border-primary transition-all duration-base ease-precision rounded-lg group ${className}`}>
    <div className="text-muted-foreground text-caption font-medium mb-2 uppercase">{label}</div>
    <div className="flex items-baseline gap-1">
      <span className="text-display font-mono font-bold text-primary group-hover:scale-105 transition-transform origin-left inline-block">
        {value}
      </span>
      {unit && <span className="text-h2 font-sans font-semibold text-foreground/70">{unit}</span>}
    </div>
    {description && <p className="mt-2 text-tiny text-muted-foreground leading-snug">{description}</p>}
  </div>
);
