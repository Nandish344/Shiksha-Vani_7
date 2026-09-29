import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, NetProvider, useAuth } from './lib/session'
import { ToastProvider, Spinner } from './components/ui'
import { StudentShell, TeacherShell, ParentShell } from './components/Shells'
import Landing from './pages/Landing'
import StudentHome from './pages/student/Home'
import Lessons from './pages/student/Lessons'
import Lesson from './pages/student/Lesson'
import Quiz from './pages/student/Quiz'
import LiveClass from './pages/student/LiveClass'
import Tutor from './pages/student/Tutor'
import Practice from './pages/student/Practice'
import Kosh from './pages/student/Kosh'
import Notes from './pages/student/Notes'
import Me from './pages/student/Me'
import ParentHome from './pages/parent/Home'

// Teacher screens carry the charting library, so they load on demand.
const Overview = lazy(() => import('./pages/teacher/Overview'))
const TeacherLive = lazy(() => import('./pages/teacher/Live'))
const Students = lazy(() => import('./pages/teacher/Students'))
const Content = lazy(() => import('./pages/teacher/Content'))
const Reports = lazy(() => import('./pages/teacher/Reports'))
const PrintReport = lazy(() => import('./pages/teacher/PrintReport'))

const HOME = { student: '/student', teacher: '/teacher', parent: '/parent' }

function Guard({ role, children }) {
  const { user, ready } = useAuth()
  if (!ready) return <div className="grid min-h-dvh place-items-center"><Spinner className="text-sal-700" /></div>
  if (!user) return <Navigate to="/" replace />
  if (user.role !== role) return <Navigate to={HOME[user.role]} replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <NetProvider>
        <ToastProvider>
          <Suspense fallback={<div className="grid min-h-dvh place-items-center"><Spinner className="text-sal-700" /></div>}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/student" element={<Guard role="student"><StudentShell /></Guard>}>
                <Route index element={<StudentHome />} />
                <Route path="lessons" element={<Lessons />} />
                <Route path="lesson/:id" element={<Lesson />} />
                <Route path="quiz/:id" element={<Quiz />} />
                <Route path="live/:code" element={<LiveClass />} />
                <Route path="ask" element={<Tutor />} />
                <Route path="speak" element={<Practice />} />
                <Route path="kosh" element={<Kosh />} />
                <Route path="notes" element={<Notes />} />
                <Route path="me" element={<Me />} />
              </Route>
              <Route path="/teacher" element={<Guard role="teacher"><TeacherShell /></Guard>}>
                <Route index element={<Overview />} />
                <Route path="live" element={<TeacherLive />} />
                <Route path="students" element={<Students />} />
                <Route path="content" element={<Content />} />
                <Route path="reports" element={<Reports />} />
              </Route>
              <Route path="/parent" element={<Guard role="parent"><ParentShell /></Guard>}>
                <Route index element={<ParentHome />} />
              </Route>
              <Route path="/print/report/:id" element={<Guard role="teacher"><PrintReport /></Guard>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </NetProvider>
    </AuthProvider>
  )
}
