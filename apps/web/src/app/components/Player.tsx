'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useRef } from 'react';
import ReactPlayer from 'react-player';

export default function Player({ onPlayerReady, ...props }: any) {
  const internalRef = useRef<any>(null);

  return (
    <ReactPlayer
      {...props}
      ref={internalRef}
      style={{ position: 'absolute', top: 0, left: 0}}
      width="100%"
      height="100%"
      onReady={() => {
        onPlayerReady?.(internalRef.current);
        props.onReady?.();
      }}
    />
  );
}