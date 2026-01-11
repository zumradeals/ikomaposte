import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RealTimeClockProps {
  className?: string;
}

export function RealTimeClock({ className = '' }: RealTimeClockProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const dateStr = format(now, 'EEE dd/MM/yyyy', { locale: fr });
  const timeStr = format(now, 'HH:mm:ss');

  return (
    <div className={`text-center select-none ${className}`}>
      {/* Date */}
      <div className="text-lg md:text-xl font-medium text-muted-foreground uppercase tracking-wide">
        {dateStr}
      </div>
      {/* Time - Very large industrial style */}
      <div className="text-5xl md:text-7xl lg:text-8xl font-black text-foreground tracking-tight font-mono tabular-nums">
        {timeStr}
      </div>
    </div>
  );
}
