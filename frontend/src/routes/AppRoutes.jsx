import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import PlaceholderLayout from '../components/layout/PlaceholderLayout.jsx'
import PlaceholderPage from '../components/common/PlaceholderPage.jsx'
import Dashboard from '../pages/resident/Dashboard.jsx'
import StatDetail from '../pages/resident/StatDetail.jsx'
import Surveys from '../pages/resident/Surveys.jsx'
import SurveyForm from '../pages/resident/SurveyForm.jsx'
import History from '../pages/resident/History.jsx'
import ViewResponse from '../pages/resident/ViewResponse.jsx'
import Confirmation from '../pages/resident/Confirmation.jsx'
import Login from '../pages/public/Login.jsx'
import Landing from '../pages/public/Landing.jsx'
import ChangePassword from '../pages/ChangePassword.jsx'
import ProtectedRoute, { AdminRoute } from './ProtectedRoute.jsx'
import StaffLayout from '../components/layout/StaffLayout.jsx'
import ResidentLayout from '../components/layout/ResidentLayout.jsx'
import { compatibilityRoutes, residentRoutes, staffRoutes } from './routeDefinitions.js'
const Profile = lazy(() => import('../pages/resident/Profile.jsx'))
const StaffDashboard = lazy(() => import('../pages/staff/Dashboard.jsx'))
const SurveyManagement = lazy(() => import('../pages/staff/SurveyManagement.jsx'))
const SurveyEditor = lazy(() => import('../pages/staff/SurveyEditor.jsx'))
const QuestionManagement = lazy(() => import('../pages/staff/QuestionManagement.jsx'))
const Results = lazy(() => import('../pages/staff/Results.jsx'))
const Reports = lazy(() => import('../pages/staff/Results.jsx').then(module => ({ default: module.Reports })))
const StaffStatDetail = lazy(() => import('../pages/staff/StatDetail.jsx'))
const ResidentManagement = lazy(() => import('../pages/staff/ResidentManagement.jsx'))
const AddressRequests = lazy(() => import('../pages/staff/AddressRequests.jsx'))
const DeletionRequests = lazy(() => import('../pages/staff/DeletionRequests.jsx'))
const DeletedAccounts = lazy(() => import('../pages/staff/DeletedAccounts.jsx'))
const ResidencyRecords = lazy(() => import('../pages/staff/ResidencyRecords.jsx'))
const UserManagement = lazy(() => import('../pages/staff/UserManagement.jsx'))
const CompleteProfile = lazy(() => import('../pages/staff/CompleteProfile.jsx'))
function LegacyFamilyRequests() {
  return <Navigate to="/staff/address-requests" replace />
}
const staffScreens = {
  '/staff/family-requests': LegacyFamilyRequests,
  '/staff/user-management': UserManagement, '/staff/complete-profile': CompleteProfile,
  '/staff/address-requests': AddressRequests,
  '/staff/deletion-requests': DeletionRequests,
  '/staff/deleted-accounts': DeletedAccounts,
  '/staff/residency-records': ResidencyRecords,

  '/staff/resident-management': ResidentManagement,
  '/staff/results-dashboard': Results, '/staff/reports': Reports, '/staff/stat-detail': StaffStatDetail,
  '/staff/dashboard': StaffDashboard, '/staff/survey-management': SurveyManagement,
  '/staff/add-survey': SurveyEditor, '/staff/edit-survey': SurveyEditor,
  '/staff/question-management': QuestionManagement, '/staff/change-password': ChangePassword,
}
const residentScreens = {
  '/resident/dashboard': Dashboard, '/resident/stat-detail': StatDetail,
  '/resident/surveys': Surveys, '/resident/survey-form': SurveyForm,
  '/resident/history': History, '/resident/view-response': ViewResponse,
  '/resident/confirmation': Confirmation,
  '/resident/change-password': ChangePassword,
  '/resident/profile': Profile,
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/landing" element={<Landing />} />
      {compatibilityRoutes.map(({ path, to }) => (
        <Route key={path} path={path} element={<Navigate to={to} replace />} />
      ))}
      <Route path="/login" element={<Login />} />
      <Route element={<PlaceholderLayout />}>
        <Route path="*" element={<PlaceholderPage title="Page Not Found" />} />
      </Route>
      <Route element={<ProtectedRoute portal="resident" />}>
        <Route element={<ResidentLayout />}>
          {residentRoutes.map((page) => {
            const Screen = residentScreens[page.path]
            return <Route key={page.path} path={page.path} element={<Suspense fallback={<p role="status">Loading…</p>}><Screen /></Suspense>} />
          })}
        </Route>
      </Route>
      <Route element={<ProtectedRoute portal="staff" />}>
        <Route element={<StaffLayout />}>
          {staffRoutes.filter((page) => !page.adminOnly).map((page) => {
            const Screen = staffScreens[page.path]
            return <Route key={page.path} path={page.path} element={<Suspense fallback={<p role="status">Loading…</p>}><Screen /></Suspense>} />
          })}
          <Route element={<AdminRoute />}>
            {staffRoutes.filter((page) => page.adminOnly).map((page) => {
              const Screen = staffScreens[page.path]
              return <Route key={page.path} path={page.path} element={<Suspense fallback={<p role="status">Loading…</p>}><Screen /></Suspense>} />
            })}
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
