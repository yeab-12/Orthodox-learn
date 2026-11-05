import { Route, Routes } from "react-router-dom";
import { PublicLayout } from "./layouts/PublicLayout";
import { AppLayout } from "./layouts/AppLayout";
import { Protected } from "./auth/AuthContext";
import { Landing } from "./pages/Landing";
import { Login, Register } from "./pages/AuthPages";
import { Feed } from "./pages/Feed";
import { Explore } from "./pages/Explore";
import { Courses } from "./pages/Courses";
import { CourseDetail } from "./pages/CourseDetail";
import { Lesson } from "./pages/Lesson";
import { Teachers } from "./pages/Teachers";
import { TeacherDetail } from "./pages/TeacherDetail";
import { UploadPage } from "./pages/UploadPage";
import { MyUploads } from "./pages/MyUploads";
import { Saved } from "./pages/Saved";
import { Community } from "./pages/Community";
import { Notifications } from "./pages/Notifications";
import { Profile } from "./pages/Profile";
import { Settings } from "./pages/Settings";
import { About } from "./pages/About";
import { Contact } from "./pages/Contact";
import { Privacy } from "./pages/Privacy";
import { Terms } from "./pages/Terms";
import { NotFound } from "./pages/NotFound";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminVideos } from "./pages/admin/AdminVideos";
import { AdminUsers } from "./pages/admin/AdminUsers";
import { AdminCourses } from "./pages/admin/AdminCourses";

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Landing />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="app" element={<Protected><AppLayout /></Protected>}>
        <Route index element={<Feed />} />
        <Route path="explore" element={<Explore />} />
        <Route path="courses" element={<Courses />} />
        <Route path="courses/:id" element={<CourseDetail />} />
        <Route path="lessons/:id" element={<Lesson />} />
        <Route path="teachers" element={<Teachers />} />
        <Route path="teachers/:id" element={<TeacherDetail />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="my-uploads" element={<MyUploads />} />
        <Route path="saved" element={<Saved />} />
        <Route path="community" element={<Community />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin" element={<Protected admin><AdminDashboard /></Protected>} />
        <Route path="admin/videos" element={<Protected admin><AdminVideos /></Protected>} />
        <Route path="admin/users" element={<Protected admin><AdminUsers /></Protected>} />
        <Route path="admin/courses" element={<Protected admin><AdminCourses /></Protected>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
