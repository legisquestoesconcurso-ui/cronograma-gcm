'use client';

import React, { useState } from 'react';

interface LogoWithFallbackProps {
  src: string;
  fallbackSrc: string;
  alt: string;
  className?: string;
}

export default function LogoWithFallback({ src, fallbackSrc, alt, className }: LogoWithFallbackProps) {
  const [imgSrc, setImgSrc] = useState(src);

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (imgSrc !== fallbackSrc) {
          setImgSrc(fallbackSrc);
        }
      }}
    />
  );
}
