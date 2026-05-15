import React from 'react';

interface CalloutProps {
  type?: 'info' | 'warn';
  title?: string;
  children: React.ReactNode;
}

export const Callout: React.FC<CalloutProps> = ({ type = 'info', title, children }) => {
  const isWarn = type === 'warn';
  return (
    <div className={`my-8 p-6 rounded-lg border-l-4 ${
      isWarn ? 'bg-accent/5 border-accent text-accent-foreground' : 'bg-primary/5 border-primary text-primary-foreground'
    }`}>
      {title && <h4 className={`font-bold mb-2 uppercase ${isWarn ? 'text-accent' : 'text-primary'}`}>{title}</h4>}
      <div className="text-foreground/90 leading-relaxed">
        {children}
      </div>
    </div>
  );
};
