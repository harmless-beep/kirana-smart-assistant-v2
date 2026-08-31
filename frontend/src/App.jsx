import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoadingSpinner from './components/LoadingSpinner'

import Home from './pages/Home'
import Login from './pages/Login'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import ProductForm from './pages/ProductForm'
import Khata from './pages/Khata'
import CustomerDetail from './pages/CustomerDetail'
import CustomerForm from './pages/CustomerForm'
import CreditForm from './pages/CreditForm'
import Assistant from './pages/Assistant'
import Settings from './pages/Settings'
import Dashboard from './pages/Dashboard'
import Reports from './pages/Reports'
import Sales from './pages/Sales'
import SalesHistory from './pages/SalesHistory'
import Notifications from './pages/Notifications'

// Loaded on demand so jcode-tools (and its global style injection) only
// ships to users who actually open the demo.
const JcodeDemo = lazy(() => import('./pages/JcodeDemo'))

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <LoadingSpinner size="lg" text="Loading..." />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <LoadingSpinner size="lg" text="Loading..." />
  if (isAuthenticated) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

        {/* Protected Routes */}
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

        {/* Products */}
        <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
        <Route path="/products/new" element={<ProtectedRoute><ProductForm /></ProtectedRoute>} />
        <Route path="/products/:id" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
        <Route path="/products/:id/edit" element={<ProtectedRoute><ProductForm /></ProtectedRoute>} />

        {/* Sales */}
        <Route path="/sales/new" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
        <Route path="/sales/history" element={<ProtectedRoute><SalesHistory /></ProtectedRoute>} />

        {/* Khata */}
        <Route path="/khata" element={<ProtectedRoute><Khata /></ProtectedRoute>} />
        <Route path="/khata/new" element={<ProtectedRoute><CustomerForm /></ProtectedRoute>} />
        <Route path="/khata/:id" element={<ProtectedRoute><CustomerDetail /></ProtectedRoute>} />
        <Route path="/khata/:id/edit" element={<ProtectedRoute><CustomerForm /></ProtectedRoute>} />
        <Route path="/khata/:id/credit" element={<ProtectedRoute><CreditForm /></ProtectedRoute>} />
        <Route path="/khata/:id/payment" element={<ProtectedRoute><CreditForm /></ProtectedRoute>} />

        {/* Assistant */}
        <Route path="/assistant" element={<ProtectedRoute><Assistant /></ProtectedRoute>} />

        {/* Settings */}
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

        {/* JCode demo (lazy-loaded) */}
        <Route
          path="/jcode-demo"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner size="lg" text="Loading demo..." />}>
                <JcodeDemo />
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
