import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Users } from "lucide-react";
import type { Comment, Teacher } from "../types";
import { api, apiError } from "../api/client";
import { useLang } from "../i18n";
import { TeacherCard } from "../components/TeacherCard";
import { Avatar, EmptyState, ErrorBox, PageHeader, Spinner } from "../components/UI";

export function Community() {
  const { t, lang } = useLang();
  const query = useQuery({
    queryKey: ["community"],
    queryFn: async () => (await api.get<{ comments: Comment[]; teachers: Teacher[]; members: number }>("/community")).data,
  });

  const formatDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat(lang === "am" ? "am-ET" : "en-GB", { dateStyle: "medium" }).format(new Date(value));
    } catch {
      return new Date(value).toLocaleDateString();
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <PageHeader title={t("communityTitle")} subtitle={t("communitySub")} />

      {query.data && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-gold-600/25 bg-cream-50 px-4 py-1.5 text-sm font-medium">
          <Users className="h-4 w-4 text-gold-700" aria-hidden /> {query.data.members} {t("members")}
        </p>
      )}

      {query.isLoading && <Spinner />}
      {query.isError && <ErrorBox message={apiError(query.error)} retry={() => query.refetch()} />}

      <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="font-display text-2xl font-semibold">{t("recentComments")}</h2>
          {query.data && query.data.comments.length === 0 && (
            <div className="mt-4">
              <EmptyState title={t("noCommunity")} icon={<MessageCircle className="h-7 w-7" aria-hidden />} />
            </div>
          )}
          {query.data && query.data.comments.length > 0 && (
            <ul className="mt-4 space-y-3">
              {query.data.comments.map((comment) => (
                <li key={comment.id} className="rounded-2xl border border-gold-600/20 bg-cream-50 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={comment.user.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{comment.user.name}</p>
                      <p className="text-xs text-stone2-500">{formatDate(comment.createdAt)}</p>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm text-stone2-700">{comment.text}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-stone2-500">{t("commentedOn")}</span>
                    <Link to={`/app/lessons/${comment.videoId}`} className="font-semibold text-gold-700 hover:underline">{comment.videoTitle}</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside>
          <h2 className="font-display text-2xl font-semibold">{t("suggestedTeachers")}</h2>
          {query.data && query.data.teachers.length === 0 && <p className="mt-4 text-sm text-stone2-700">{t("noTeachers")}</p>}
          <div className="mt-4 space-y-3">
            {query.data?.teachers.map((teacher) => <TeacherCard key={teacher.id} teacher={teacher} />)}
          </div>
        </aside>
      </div>
    </div>
  );
}
