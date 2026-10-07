import { useState } from 'react';
import { dancingVideosConfig, type DancingVideoDef } from '../config';

/** A look at the colourful videos. Each one plays while hovered or tapped. */
export function DancingVideosStrip() {
  const [playing, setPlaying] = useState<string | null>(null);
  return (
    <div className="post-design">
      <h3>A taste of the visuals</h3>
      <p className="muted small">
        Stomp mixes visuals like these through the dancing, changing from one video to the next. The preview below does the same.
      </p>
      <div className="video-grid">
        {dancingVideosConfig.videos.map((v) => (
          <VideoCard
            key={v.id}
            video={v}
            playing={playing === v.id}
            onPlay={(on) => setPlaying((p) => (on ? v.id : p === v.id ? null : p))}
          />
        ))}
      </div>
    </div>
  );
}

function VideoCard({
  video,
  playing,
  onPlay,
}: {
  video: DancingVideoDef;
  playing: boolean;
  onPlay: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="video-card"
      aria-pressed={playing}
      onMouseEnter={() => onPlay(true)}
      onMouseLeave={() => onPlay(false)}
      onClick={() => onPlay(!playing)}
    >
      <span className="style-thumb">
        {playing ? (
          <video src={video.src} poster={video.poster} autoPlay muted loop playsInline aria-hidden />
        ) : (
          <img src={video.poster} alt="" loading="lazy" />
        )}
      </span>
      <span className="style-name">{video.name}</span>
    </button>
  );
}
