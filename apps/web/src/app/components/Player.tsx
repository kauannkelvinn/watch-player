'use client';

import { useRef, type ComponentProps } from 'react';
import ReactPlayer from 'react-player';

type ReactPlayerProps = ComponentProps<typeof ReactPlayer>;

interface PlayerProps extends ReactPlayerProps {
  onPlayerReady?: (player: ReactPlayer | null) => void;
}

export default function Player({ onPlayerReady, onReady, ...props }: PlayerProps) {
  const internalRef = useRef<ReactPlayer>(null);

  return (
    <ReactPlayer
      {...props}
      ref={internalRef}
      style={{ position: 'absolute', top: 0, left: 0 }}
      width="100%"
      height="100%"
      onReady={() => {
        const player = internalRef.current;
        onPlayerReady?.(player);
        if (player) onReady?.(player);
      }}
    />
  );
}
