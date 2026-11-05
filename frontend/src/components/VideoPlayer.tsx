import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Headphones } from "lucide-react";
import type { Video } from "../types";
import { api, mediaUrl } from "../api/client";
import { useLang } from "../i18n";
import { Cover } from "./Art";
import { DemoBadge } from "./UI";

interface VideoPlayerProps {
  video: Video;
  className?: string;
  /** Seconds to resume from when the learner returns to a lesson. */
  resumeAt?: number;
  /** Called at most every five seconds while playing (and on pause/end). */
  onProgress?: (positionSec: number, durationSec: number) => void;
  onEnded?: () => void;
}

export function VideoPlayer({ video, className = "", resumeAt = 0, onProgress, onEnded }: VideoPlayerProps) {
  const { t } = useLang();
  const counted = useRef(false);
  const seeked = useRef(false);
  const lastSent = useRef(0);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const view = useMutation({ mutationFn: () => api.post(`/videos/${video.id}/view`) });
  const src = mediaUrl(video.videoUrl);

  const send = (element: HTMLMediaElement, force = false) => {
    if (!onProgress) return;
    const now = Date.now();
    if (!force && now - lastSent.current < 5000) return;
    lastSent.current = now;
    onProgress(
      Math.max(0, Math.floor(element.currentTime || 0)),
      Math.max(0, Math.floor(element.duration || video.durationSec || 0)),
    );
  };

  const seekToResume = (element: HTMLMediaElement) => {
    if (seeked.current || resumeAt <= 1) return;
    seeked.current = true;
    const apply = () => {
      const total = Number.isFinite(element.duration) ? element.duration : 0;
      if (!total || resumeAt < total - 3) {
        try {
          element.currentTime = resumeAt;
        } catch {
          /* seeking can fail before metadata is ready; the next load retries */
        }
      }
    };
    if (element.readyState >= 1) apply();
    else element.addEventListener("loadedmetadata", apply, { once: true });
  };

  useEffect(() => {
    const element = mediaRef.current;
    if (element) seekToResume(element);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeAt]);

  if (!src) {
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-navy-900 ${className}`}>
        <Cover variant={video.cover} className="aspect-[9/12] w-full" />
        <div className="absolute inset-0 grid place-items-center bg-navy-950/60 p-6 text-center">
          <p className="max-w-sm rounded-xl bg-navy-950/85 px-4 py-3 text-sm text-cream-100">{t("demoPlayback")}</p>
        </div>
      </div>
    );
  }

  const handlePlay = (element: HTMLMediaElement) => {
    if (!counted.current) {
      counted.current = true;
      view.mutate();
    }
    seekToResume(element);
  };

  const handleEnded = (element: HTMLMediaElement) => {
    send(element, true);
    onEnded?.();
  };

  if (video.mediaType === "audio") {
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-navy-900 ${className}`}>
        <div className="flex min-h-56 flex-col items-center justify-center gap-4 p-8">
          <Headphones className="h-12 w-12 text-gold-400" aria-hidden />
          <p className="max-w-md text-center font-display text-xl font-semibold text-cream-50">{video.title}</p>
          <audio
            ref={(node) => { mediaRef.current = node; }}
            controls
            preload="metadata"
            src={src}
            onLoadedMetadata={(event) => seekToResume(event.currentTarget)}
            onPlay={(event) => handlePlay(event.currentTarget)}
            onTimeUpdate={(event) => send(event.currentTarget)}
            onPause={(event) => send(event.currentTarget, true)}
            onEnded={(event) => handleEnded(event.currentTarget)}
            className="w-full max-w-lg"
          >
            <track kind="captions" />
          </audio>
        </div>
        {video.demo && <div className="absolute left-3 top-3"><DemoBadge label={t("demoClip")} /></div>}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-black ${className}`}>
      <video
        ref={(node) => { mediaRef.current = node; }}
        controls
        playsInline
        preload="metadata"
        src={src}
        onLoadedMetadata={(event) => seekToResume(event.currentTarget)}
        onPlay={(event) => handlePlay(event.currentTarget)}
        onTimeUpdate={(event) => send(event.currentTarget)}
        onPause={(event) => send(event.currentTarget, true)}
        onEnded={(event) => handleEnded(event.currentTarget)}
        className="aspect-video w-full bg-black"
      >
        <track kind="captions" />
      </video>
      {video.demo && <div className="absolute left-3 top-3"><DemoBadge label={t("demoClip")} /></div>}
    </div>
  );
}
