import React from 'react';

interface TextProps {
  children: React.ReactNode;
  className?: string;
}

export const H1: React.FC<TextProps> = ({ children, className = "" }) => (
  <h1 className={`text-h1 font-bold mb-6 ${className}`}>
    {children}
  </h1>
);

export const H2: React.FC<TextProps> = ({ children, className = "" }) => (
  <h2 className={`text-h2 font-semibold mb-4 border-l-4 border-primary pl-4 ${className}`}>
    {children}
  </h2>
);

export const SectionHeading: React.FC<TextProps> = ({ children, className = "" }) => (
  <div className={`mb-8 ${className}`}>
    <h3 className="text-display font-bold text-primary mb-2 tabular-nums">
      {children}
    </h3>
    <div className="h-1 w-20 bg-primary/20 rounded" />
  </div>
);

export const Body: React.FC<TextProps> = ({ children, className = "" }) => (
  <p className={`text-body leading-relaxed mb-4 max-w-[70ch] ${className}`}>
    {children}
  </p>
);
