import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import type { Course, Teacher, Video } from "../types";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useLang } from "../i18n";
import { VideoCard } from "../components/VideoCard";
import { CourseCard } from "../components/CourseCard";
import { Avatar, btnSecondary, ErrorBox, PageHeader, Spinner } from "../components/UI";

export function TeacherDetail() {
  const { id = "" } = useParams();
  const { t } = useLang();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["teacher", id],
    queryFn: async () => (await api.get<{ teacher: Teacher; videos: Video[]; courses: Course[] }>(`/teachers/${id}`)).data,
  });

  const follow = useMutation({
    mutationFn: async () => (await api.post<{ following: boolean }>(`/teachers/${id}/follow`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", id] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
  });

  if (query.isLoading) return <div className="mx-auto max-w-5xl px-4"><Spinner /></div>;
  if (query.isError) return <div className="mx-auto max-w-2xl px-4 py-8"><ErrorBox message={apiError(query.error)} retry={() => query.refetch()} /></div>;
  if (!query.data) return null;

  const { teacher, videos, courses } = query.data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link to="/app/teachers" className="focus-ring inline-flex items-center gap-1 text-sm font-semibold text-gold-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t("teachersTitle")}
      </Link>

      <div className="mt-5 flex flex-wrap items-start gap-5 rounded-3xl border border-gold-600/20 bg-cream-50 p-6 shadow-sm">
        <Avatar name={teacher.name} size={84} />
        <div className="min-w-0 flex-1">
          <PageHeader title={teacher.name} subtitle={teacher.bio || undefined} />
          <p className="mt-3 text-sm text-stone2-500">
            {teacher.videoCount} {t("videosCount")} · {teacher.courseCount} {t("teacherCoursesCount")} · {teacher.followers} {t("followersCount")}
          </p>
        </div>
        {user && user.id !== teacher.id && (
          <button type="button" onClick={() => follow.mutate()} disabled={follow.isPending}
            className={teacher.following ? btnSecondary : "focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-semibold text-navy-950 hover:bg-gold-400"}>
            {!teacher.following && <Plus className="h-4 w-4" aria-hidden />}
            {teacher.following ? t("following") : t("follow")}
          </button>
        )}
      </div>
      {follow.isError && <ErrorBox message={apiError(follow.error)} />}

      {courses.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-2xl font-semibold">{t("teacherCourses")}</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {courses.map((course) => <CourseCard key={course.id} course={course} />)}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-2xl font-semibold">{t("teacherVideos")}</h2>
        {videos.length === 0 && <p className="mt-3 text-stone2-700">{t("noVideos")}</p>}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {videos.map((video) => <VideoCard key={video.id} video={video} />)}
        </div>
      </section>
    </div>
  );
}
