import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppRoutes from './routes/AppRoutes.jsx'
import AuthProvider from './context/AuthProvider.jsx'
import ConfirmProvider from './components/common/ConfirmProvider.jsx'
import DirtyWarningProvider from './components/common/DirtyWarningProvider.jsx'

// A data router supplies navigation blocking for useDirtyWarning.
const router = createBrowserRouter([{ path: '*', element:
  <AuthProvider><DirtyWarningProvider><ConfirmProvider><AppRoutes /></ConfirmProvider></DirtyWarningProvider></AuthProvider>,
}], { basename: import.meta.env.BASE_URL })

export default function App() {
  return <RouterProvider router={router} />
}
