import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import type { Teacher } from "../types";
import { api, apiError } from "../api/client";
import { useLang } from "../i18n";
import { TeacherCard } from "../components/TeacherCard";
import { EmptyState, ErrorBox, PageHeader, Spinner } from "../components/UI";

export function Teachers() {
  const { t } = useLang();
  const query = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => (await api.get<{ teachers: Teacher[] }>("/teachers")).data.teachers,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title={t("teachersTitle")} subtitle={t("teachersSub")} />
      {query.isLoading && <Spinner />}
      {query.isError && <ErrorBox message={apiError(query.error)} retry={() => query.refetch()} />}
      {query.data && query.data.length === 0 && (
        <div className="mt-6"><EmptyState title={t("noTeachers")} icon={<Users className="h-7 w-7" aria-hidden />} /></div>
      )}
      {query.data && query.data.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.map((teacher) => <TeacherCard key={teacher.id} teacher={teacher} />)}
        </div>
      )}
    </div>
  );
}
