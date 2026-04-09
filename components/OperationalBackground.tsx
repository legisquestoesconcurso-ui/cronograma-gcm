'use client';

import React, { useState, useEffect } from 'react';

interface OperationalBackgroundProps {
  localSrc: string;
  fallbackSrc: string;
}

export default function OperationalBackground({ localSrc, fallbackSrc }: OperationalBackgroundProps) {
  const [bgUrl, setBgUrl] = useState(localSrc);

  useEffect(() => {
    const img = new Image();
    img.src = localSrc;
    img.onerror = () => {
      setBgUrl(fallbackSrc);
    };
  }, [localSrc, fallbackSrc]);

  return (
    <div 
      className="fixed inset-0 z-0 pointer-events-none"
      style={{
        backgroundImage: `url('${bgUrl}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    />
  );
}
