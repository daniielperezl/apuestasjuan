import React, { useState, useEffect } from 'react';

const Clock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const bogotaTime = time.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const bogotaDate = time.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="text-right">
      <div className="text-2xl font-mono font-bold text-indigo-400">{bogotaTime}</div>
      <div className="text-xs text-slate-400 capitalize">{bogotaDate} · Bogotá</div>
    </div>
  );
};

export default Clock;
