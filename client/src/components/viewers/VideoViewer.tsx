interface VideoViewerProps {
  url: string;
}

function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function getVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

export function VideoViewer({ url }: VideoViewerProps) {
  const youtubeId = getYouTubeId(url);
  const vimeoId = getVimeoId(url);

  if (youtubeId) {
    return (
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
          title="Video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full border-0"
        />
      </div>
    );
  }

  if (vimeoId) {
    return (
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
        <iframe
          src={`https://player.vimeo.com/video/${vimeoId}?dnt=1`}
          title="Video"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="w-full h-full border-0"
        />
      </div>
    );
  }

  // Native video (MP4, etc.)
  return (
    <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
      <video
        src={url}
        controls
        preload="metadata"
        className="w-full h-full"
      />
    </div>
  );
}
