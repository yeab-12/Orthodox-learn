import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import type { Course, Teacher, Video } from "../../types";
import { api, apiError } from "../../api/client";
import { useLang } from "../../i18n";
import { Modal } from "../../components/Modal";
import { Cover } from "../../components/Art";
import { Input, Select, Textarea } from "../../components/Field";
import { btnPrimary, btnSecondary, ErrorBox, PageHeader, Spinner } from "../../components/UI";

const schema = z.object({
  title: z.string().trim().min(3, "Enter a course title").max(160),
  titleAm: z.string().trim().max(160).optional(),
  description: z.string().trim().max(1000).optional(),
  descriptionAm: z.string().trim().max(1000).optional(),
  teacherId: z.string().min(1, "Choose a teacher"),
  language: z.enum(["en", "am"]),
  cover: z.coerce.number().int().min(0).max(3),
  videoIds: z.array(z.string()),
});
type FormValues = z.infer<typeof schema>;

const empty: FormValues = { title: "", titleAm: "", description: "", descriptionAm: "", teacherId: "", language: "en", cover: 0, videoIds: [] };

export function AdminCourses() {
  const { t, lang } = useLang();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Course | "new" | null>(null);
  const [notice, setNotice] = useState("");

  const courses = useQuery({
    queryKey: ["admin", "courses"],
    queryFn: async () => (await api.get<{ courses: Course[] }>("/admin/courses")).data.courses,
  });
  const teachers = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => (await api.get<{ teachers: Teacher[] }>("/teachers")).data.teachers,
  });
  const videos = useQuery({
    queryKey: ["videos", "explore"],
    queryFn: async () => (await api.get<{ videos: Video[] }>("/videos")).data.videos,
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: empty,
  });
  const selectedVideos = watch("videoIds");

  useEffect(() => {
    if (!editing) return;
    reset(editing === "new" ? empty : {
      title: editing.title,
      titleAm: editing.titleAm,
      description: editing.description,
      descriptionAm: editing.descriptionAm,
      teacherId: editing.teacherId,
      language: editing.language,
      cover: editing.cover,
      videoIds: editing.videoIds ?? editing.lessons?.map((lesson) => lesson.id) ?? [],
    });
  }, [editing, reset]);

  const save = useMutation({
    mutationFn: (values: FormValues) => editing === "new" ? api.post("/admin/courses", values) : api.patch(`/admin/courses/${(editing as Course).id}`, values),
    onSuccess: () => {
      setNotice(editing === "new" ? t("courseCreated") : t("courseUpdated"));
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/courses/${id}`),
    onSuccess: () => {
      setNotice(t("courseDeleted"));
      queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });

  const toggleVideo = (id: string) => {
    const current = selectedVideos ?? [];
    setValue("videoIds", current.includes(id) ? current.filter((value) => value !== id) : [...current, id], { shouldDirty: true });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title={t("coursesAdminTitle")} subtitle={t("coursesAdminSub")}
        actions={
          <>
            <Link to="/app/admin" className={btnSecondary}>{t("overviewTitle")}</Link>
            <button type="button" onClick={() => setEditing("new")} className={btnPrimary}><Plus className="h-4 w-4" aria-hidden /> {t("createCourse")}</button>
          </>
        } />

      {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-600/25 bg-emerald-600/10 p-3 text-sm font-medium text-emerald-800">{notice}</p>}
      {courses.isLoading && <Spinner />}
      {courses.isError && <ErrorBox message={apiError(courses.error)} retry={() => courses.refetch()} />}
      {save.isError && <ErrorBox message={apiError(save.error)} />}
      {remove.isError && <ErrorBox message={apiError(remove.error)} />}
      {courses.data && courses.data.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-navy-900/20 bg-cream-50 p-8 text-center text-stone2-700">{t("noCoursesAdmin")}</p>
      )}

      {courses.data && courses.data.length > 0 && (
        <ul className="mt-5 grid gap-3 lg:grid-cols-2">
          {courses.data.map((course) => (
            <li key={course.id} className="flex overflow-hidden rounded-2xl border border-gold-600/20 bg-cream-50 shadow-sm">
              <div className="w-24 shrink-0 sm:w-28"><Cover variant={course.cover} className="h-full w-full" /></div>
              <div className="min-w-0 flex-1 p-4">
                <p className="text-xs font-semibold text-gold-700">{course.lessonCount} {t("courseLessons")}</p>
                <h2 className="mt-1 font-display text-lg font-semibold leading-snug">{lang === "am" ? course.titleAm : course.title}</h2>
                <p className="text-xs text-stone2-500">{course.teacher?.name} · {course.language === "am" ? "አማርኛ" : "English"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setEditing(course)} className="focus-ring inline-flex min-h-9 items-center gap-1 rounded-full border border-navy-900/25 px-3 py-1.5 text-xs font-semibold hover:bg-cream-200">
                    <Pencil className="h-3.5 w-3.5" aria-hidden /> {t("editCourse")}
                  </button>
                  <button type="button" onClick={() => { if (window.confirm(t("confirmDeleteCourse"))) remove.mutate(course.id); }} disabled={remove.isPending}
                    className="focus-ring inline-flex min-h-9 items-center gap-1 rounded-full border border-rubric-500/40 px-3 py-1.5 text-xs font-semibold text-rubric-600 hover:bg-rubric-500/10">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> {t("deleteCourse")}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing === "new" ? t("createCourse") : t("editCourse")} wide>
        {editing && (
          <form className="space-y-4" noValidate onSubmit={handleSubmit((values) => save.mutate(values))}>
            <Input label={t("courseTitleLabel")} error={errors.title?.message} {...register("title")} />
            <Input label={`${t("courseTitleLabel")} (${t("amharic")})`} lang="am" error={errors.titleAm?.message} {...register("titleAm")} />
            <Textarea label={`${t("courseDescriptionLabel")} (${t("optional")})`} error={errors.description?.message} {...register("description")} />
            <Textarea label={`${t("courseDescriptionLabel")} (${t("amharic")})`} lang="am" error={errors.descriptionAm?.message} {...register("descriptionAm")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label={t("courseTeacherLabel")} error={errors.teacherId?.message} {...register("teacherId")}>
                <option value="">{t("courseTeacherLabel")}</option>
                {teachers.data?.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
              </Select>
              <Select label={t("languageLabel")} error={errors.language?.message} {...register("language")}>
                <option value="en">{t("english")}</option>
                <option value="am">{t("amharic")}</option>
              </Select>
            </div>
            <Select label={t("courseCoverLabel")} {...register("cover")}>
              {[0, 1, 2, 3].map((value) => <option key={value} value={value}>{t("courseCoverLabel")} {value + 1}</option>)}
            </Select>

            <fieldset>
              <legend className="text-sm font-semibold">{t("teacherVideos")}</legend>
              <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-navy-900/15 bg-cream-100 p-3">
                {videos.data && videos.data.length === 0 && <p className="text-sm text-stone2-700">{t("noVideos")}</p>}
                {videos.data?.map((video) => (
                  <label key={video.id} className="flex items-start gap-2 rounded-lg p-1 text-sm hover:bg-cream-200">
                    <input type="checkbox" checked={(selectedVideos ?? []).includes(video.id)} onChange={() => toggleVideo(video.id)} className="mt-0.5 h-4 w-4 accent-gold-600" />
                    <span className="min-w-0"><span className="block truncate font-medium">{video.title}</span><span className="text-xs text-stone2-500">{video.teacher.name}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>

            {save.isError && <ErrorBox message={apiError(save.error)} />}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className={btnSecondary}>{t("cancel")}</button>
              <button type="submit" disabled={save.isPending} className={btnPrimary}><BookOpen className="h-4 w-4" aria-hidden /> {save.isPending ? t("saving") : t("saveCourse")}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
