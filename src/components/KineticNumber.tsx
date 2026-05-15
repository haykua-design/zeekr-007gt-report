import React, { useState, useEffect } from 'react';

interface KineticNumberProps {
  value: number;
  suffix?: string;
  duration?: number;
  decimals?: number;
  className?: string;
}

export const KineticNumber: React.FC<KineticNumberProps> = ({ 
  value, 
  suffix = '', 
  duration = 1000, 
  decimals = 0,
  className = "" 
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const start = 0;
    const end = value;
    const range = end - start;
    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Simple easeOutQuad
      const easedProgress = progress * (2 - progress);
      setDisplayValue(start + range * easedProgress);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value, duration]);

  return (
    <span className={`tabular-nums ${className}`}>
      {displayValue.toFixed(decimals)}{suffix}
    </span>
  );
};
