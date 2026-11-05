import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Bookmark, Heart, MessageCircle, Pause, Play, Plus, Share2, Volume2 } from "lucide-react";
import type { Video } from "../types";
import { formatDuration } from "../data/mock";
import { useLang } from "../i18n";
import { api, apiError, mediaUrl } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Cover } from "./Art";
import { DemoBadge } from "./UI";

function RailButton({ label, active, onClick, children, count }: {
  label: string; active?: boolean; onClick?: () => void; children: React.ReactNode; count?: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={count ? `${label}, ${count}` : label} aria-pressed={active}
      className="focus-ring flex flex-col items-center gap-1 text-cream-50">
      <span className={`grid h-12 w-12 place-items-center rounded-full backdrop-blur ${active ? "bg-gold-500 text-navy-950" : "bg-navy-950/55 hover:bg-navy-950/75"}`}>
        {children}
      </span>
      {count && <span className="text-xs font-medium">{count}</span>}
    </button>
  );
}

export function FeedItem({ video, active, onComments }: { video: Video; active: boolean; onComments: () => void }) {
  const { lang, t } = useLang();
  const { user } = useAuth();
  const media = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const counted = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [liked, setLiked] = useState(video.liked);
  const [likes, setLikes] = useState(video.likes);
  const [saved, setSaved] = useState(video.saved);
  const [following, setFollowing] = useState(Boolean(video.teacher.following));
  const [notice, setNotice] = useState("");
  const title = lang === "am" ? video.titleAm : video.title;
  const description = lang === "am" ? video.descriptionAm || video.description : video.description;
  const src = mediaUrl(video.videoUrl);

  useEffect(() => {
    setLiked(video.liked);
    setLikes(video.likes);
    setSaved(video.saved);
    setFollowing(Boolean(video.teacher.following));
  }, [video]);

  useEffect(() => {
    if (!active && media.current && !media.current.paused) {
      media.current.pause();
      setPlaying(false);
    }
  }, [active]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const view = useMutation({ mutationFn: () => api.post(`/videos/${video.id}/view`) });
  const like = useMutation({
    mutationFn: async () => (await api.post<{ liked: boolean; likes: number }>(`/videos/${video.id}/like`)).data,
    onSuccess: (data) => { setLiked(data.liked); setLikes(data.likes); },
    onError: (error) => setNotice(apiError(error)),
  });
  const save = useMutation({
    mutationFn: async () => (await api.post<{ saved: boolean }>(`/videos/${video.id}/save`)).data,
    onSuccess: (data) => setSaved(data.saved),
    onError: (error) => setNotice(apiError(error)),
  });
  const follow = useMutation({
    mutationFn: async () => (await api.post<{ following: boolean }>(`/teachers/${video.teacher.id}/follow`)).data,
    onSuccess: (data) => setFollowing(data.following),
    onError: (error) => setNotice(apiError(error)),
  });

  const toggle = async () => {
    if (!src) {
      setNotice(t("demoPlayback"));
      return;
    }
    const element = media.current;
    if (!element) return;
    if (element.paused) {
      try {
        await element.play();
        setVisible(true);
        setPlaying(true);
        if (!counted.current) { counted.current = true; view.mutate(); }
      } catch {
        setNotice(t("play"));
      }
    } else {
      element.pause();
      setPlaying(false);
    }
  };

  const share = async () => {
    const data = { title, text: title, url: window.location.href };
    if (navigator.share) {
      await navigator.share(data).catch(() => undefined);
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice(t("linkCopied"));
    } catch {
      setNotice(t("copyLink"));
    }
  };

  const requireLogin = (action: () => void) => {
    if (!user) {
      setNotice(t("loginToComment"));
      return;
    }
    action();
  };

  return (
    <section className="relative h-[var(--feed-h)] snap-start snap-always overflow-hidden bg-navy-950" aria-label={title}>
      <Cover variant={video.cover} className="absolute inset-0 h-full w-full" />
      {src && video.mediaType === "video" && (
        <video
          ref={media as React.RefObject<HTMLVideoElement>}
          src={src}
          playsInline
          preload="metadata"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity ${visible ? "opacity-100" : "opacity-0"}`}
          onTimeUpdate={(event) => setProgress(event.currentTarget.duration ? event.currentTarget.currentTime / event.currentTarget.duration : 0)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setProgress(0); }}
        />
      )}
      {src && video.mediaType === "audio" && (
        <audio
          ref={media as React.RefObject<HTMLAudioElement>}
          src={src}
          preload="metadata"
          onTimeUpdate={(event) => setProgress(event.currentTarget.duration ? event.currentTarget.currentTime / event.currentTarget.duration : 0)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setProgress(0); }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-navy-950/95 via-navy-950/5 to-navy-950/35" />

      <button type="button" onClick={toggle} className="focus-ring absolute inset-0"
        aria-label={playing ? t("pause") : t("play")}>
        {!playing && (
          <span className="absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-navy-950/65 text-cream-50 shadow-lg">
            {src ? <Play className="h-9 w-9 translate-x-0.5" fill="currentColor" aria-hidden /> : <Volume2 className="h-8 w-8" aria-hidden />}
          </span>
        )}
      </button>

      {notice && (
        <p role="status" className="pointer-events-none absolute left-1/2 top-5 z-10 w-[90%] max-w-md -translate-x-1/2 rounded-xl bg-navy-950/95 px-4 py-2 text-center text-sm font-medium text-cream-50">
          {notice}
        </p>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 pb-6">
        <div className="pointer-events-auto min-w-0 flex-1 text-cream-50">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            {video.category && <span className="rounded-full bg-gold-500 px-2.5 py-1 font-semibold text-navy-950">{lang === "am" ? video.category.am : video.category.en}</span>}
            <span className="rounded-full bg-navy-950/60 px-2.5 py-1">{video.language === "am" ? "አማርኛ" : "English"}</span>
            <span className="rounded-full bg-navy-950/60 px-2.5 py-1">{formatDuration(video.durationSec)}</span>
            {video.demo && <DemoBadge label={t("demoClip")} />}
          </div>
          <h2 className="font-display text-2xl font-semibold leading-snug">{title}</h2>
          {description && <p className="mt-1 line-clamp-2 text-sm text-cream-100/85">{description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link to={`/app/teachers/${video.teacher.id}`} className="focus-ring flex items-center gap-2 rounded-full">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gold-500 text-sm font-bold text-navy-950">{video.teacher.name.charAt(0)}</span>
              <span className="text-sm font-semibold hover:underline">{video.teacher.name}</span>
            </Link>
            {user && user.id !== video.teacher.id && (
              <button type="button" onClick={() => follow.mutate()} aria-pressed={following}
                className="focus-ring inline-flex min-h-9 items-center gap-1 rounded-full border border-cream-50/50 px-3 py-1 text-xs font-semibold hover:bg-cream-50/10">
                {!following && <Plus className="h-3 w-3" aria-hidden />}{following ? t("following") : t("follow")}
              </button>
            )}
            <Link to={`/app/lessons/${video.id}`} className="focus-ring ml-auto text-xs font-semibold text-gold-300 hover:underline">{t("aboutLesson")}</Link>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col items-center gap-4">
          <RailButton label={t("like")} active={liked} onClick={() => requireLogin(() => like.mutate())} count={String(likes)}>
            <Heart className="h-6 w-6" fill={liked ? "currentColor" : "none"} aria-hidden />
          </RailButton>
          <RailButton label={t("commentsLabel")} onClick={onComments} count={String(video.comments)}>
            <MessageCircle className="h-6 w-6" aria-hidden />
          </RailButton>
          <RailButton label={t("save")} active={saved} onClick={() => requireLogin(() => save.mutate())}>
            <Bookmark className="h-6 w-6" fill={saved ? "currentColor" : "none"} aria-hidden />
          </RailButton>
          <RailButton label={t("share")} onClick={share}>
            <Share2 className="h-6 w-6" aria-hidden />
          </RailButton>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-1 bg-cream-50/20">
        <div className="h-full origin-left bg-gold-400" style={{ transform: `scaleX(${progress})` }} />
      </div>
      {playing && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-navy-950/40 text-cream-50/80 opacity-0">
          <Pause className="h-6 w-6" aria-hidden />
        </span>
      )}
    </section>
  );
}
