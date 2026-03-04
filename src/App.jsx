import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import useAppStore from './store/useAppStore'

import MainLayout from './components/layout/MainLayout'
import Login from './pages/Login'
import ApprovalDashboard from './pages/dashboard/ApprovalDashboard'
import InventoryDashboard from './pages/dashboard/InventoryDashboard'
import ReportsDashboard from './pages/dashboard/ReportsDashboard'
import ProfilesDashboard from './pages/dashboard/ProfilesDashboard'
import SettingsDashboard from './pages/dashboard/SettingsDashboard'
import InputReportDashboard from './pages/dashboard/InputReportDashboard'
import DefectsDashboard from './pages/dashboard/DefectsDashboard'
import SuppliersDashboard from './pages/dashboard/SuppliersDashboard'

function ProtectedRoute({ session, userRole, isLoading }) {
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-t-2 border-r-2 border-brand-green rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Role Protection (SPV Only routes)
  const spvOnlyRoutes = ['/profiles', '/settings'];
  if (spvOnlyRoutes.includes(location.pathname) && userRole !== 'SPV') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <MainLayout userRole={userRole}>
      <Outlet />
    </MainLayout>
  );
}

function App() {
  const [session, setSession] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const fetchBranding = useAppStore((state) => state.fetchBranding);
  const initTheme = useAppStore((state) => state.initTheme);

  const fetchRole = async (userId) => {
    try {
      const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
      if (data) {
        setUserRole(data.role);
      }
    } catch (err) {
      console.error('Failed to fetch role:', err);
    }
  };

  useEffect(() => {
    // Initialize theme and branding on app mount
    initTheme();
    fetchBranding();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        fetchRole(session.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        fetchRole(session.user.id);
      } else {
        setUserRole(null);
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute session={session} userRole={userRole} isLoading={isLoading} />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<ApprovalDashboard userRole={userRole} />} />
          <Route path="/inventory" element={<InventoryDashboard userRole={userRole} />} />
          <Route path="/input-report" element={<InputReportDashboard userRole={userRole} />} />
          <Route path="/defects" element={<DefectsDashboard />} />
          <Route path="/suppliers" element={<SuppliersDashboard userRole={userRole} />} />
          <Route path="/reports" element={<ReportsDashboard />} />
          <Route path="/profiles" element={<ProfilesDashboard />} />
          <Route path="/settings" element={<SettingsDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
