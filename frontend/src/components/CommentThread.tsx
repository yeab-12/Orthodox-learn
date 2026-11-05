import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Trash2 } from "lucide-react";
import type { Comment } from "../types";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useLang } from "../i18n";
import { Avatar, btnPrimary, ErrorBox, Spinner } from "./UI";

export function CommentThread({ videoId }: { videoId: string }) {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");

  const comments = useQuery({
    queryKey: ["comments", videoId],
    queryFn: async () => (await api.get<{ comments: Comment[] }>(`/videos/${videoId}/comments`)).data.comments,
  });

  const post = useMutation({
    mutationFn: async () => (await api.post(`/videos/${videoId}/comments`, { text })).data,
    onSuccess: () => {
      setText("");
      setNotice(t("commentPosted"));
      queryClient.invalidateQueries({ queryKey: ["comments", videoId] });
      queryClient.invalidateQueries({ queryKey: ["video", videoId] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/comments/${id}`),
    onSuccess: () => {
      setNotice(t("commentDeleted"));
      queryClient.invalidateQueries({ queryKey: ["comments", videoId] });
      queryClient.invalidateQueries({ queryKey: ["video", videoId] });
    },
  });

  const formatDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat(lang === "am" ? "am-ET" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
    } catch {
      return new Date(value).toLocaleString();
    }
  };

  return (
    <div>
      {user ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!text.trim()) return;
            post.mutate();
          }}
        >
          <label htmlFor={`comment-${videoId}`} className="sr-only">{t("commentPlaceholder")}</label>
          <textarea
            id={`comment-${videoId}`}
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, 500))}
            placeholder={t("commentPlaceholder")}
            rows={3}
            className="focus-ring w-full rounded-xl border border-navy-900/25 bg-white px-4 py-3"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-stone2-500">{text.length}/500</span>
            <button type="submit" disabled={!text.trim() || post.isPending} className={btnPrimary}>
              {post.isPending ? t("saving") : t("postComment")}
            </button>
          </div>
          {post.isError && <p role="alert" className="text-sm text-rubric-600">{apiError(post.error)}</p>}
        </form>
      ) : (
        <p className="rounded-xl bg-cream-200 p-4 text-sm text-stone2-700">
          <Link to="/login" state={{ from: location.pathname }} className="font-semibold text-gold-700 underline">{t("login")}</Link>{" "}
          {t("loginToComment")}
        </p>
      )}

      {notice && <p role="status" className="mt-3 text-sm font-medium text-gold-700">{notice}</p>}

      <div className="mt-6">
        {comments.isLoading && <Spinner />}
        {comments.isError && <ErrorBox message={apiError(comments.error)} retry={() => comments.refetch()} />}
        {comments.data && comments.data.length === 0 && (
          <p className="flex items-center gap-2 rounded-xl border border-dashed border-navy-900/20 p-4 text-sm text-stone2-700">
            <MessageCircle className="h-4 w-4" aria-hidden /> {t("noComments")}
          </p>
        )}
        <ul className="space-y-4">
          {comments.data?.map((comment) => {
            const mine = user?.id === comment.user.id;
            const canDelete = mine || user?.role === "admin" || user?.role === "teacher";
            return (
              <li key={comment.id} className="flex gap-3">
                <Avatar name={comment.user.name} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold">{comment.user.name}</span>
                    <span className="text-xs text-stone2-500">{formatDate(comment.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-stone2-700">{comment.text}</p>
                </div>
                {canDelete && (
                  <button type="button" onClick={() => remove.mutate(comment.id)} aria-label={t("deleteComment")}
                    className="focus-ring h-8 w-8 shrink-0 rounded-full text-stone2-500 hover:bg-rubric-500/10 hover:text-rubric-600">
                    <Trash2 className="mx-auto h-4 w-4" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
