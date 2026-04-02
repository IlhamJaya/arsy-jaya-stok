import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import useAppStore from './store/useAppStore'
import useVersionCheck from './hooks/useVersionCheck'
import UpdateBanner from './components/UpdateBanner'

import MainLayout from './components/layout/MainLayout'
import Login from './pages/Login'
import DashboardPage from './pages/dashboard/DashboardPage'
import InventoryDashboard from './pages/dashboard/InventoryDashboard'
import SettingsHub from './pages/dashboard/SettingsHub'
import InputReportHub from './pages/dashboard/InputReportHub'
import ReportsHub from './pages/dashboard/ReportsHub'

function ProtectedRoute({ session, userRole, isLoading }) {
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-t-2 border-r-2 border-accent-base rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Role Protection (SPV Only routes)
  const spvOnlyRoutes = ['/settings'];
  if (spvOnlyRoutes.includes(location.pathname) && userRole !== 'SPV') {
    return <Navigate to="/dashboard" replace />;
  }

  // Role Protection (SPV and HRD Only routes)
  const spvHrdRoutes = ['/reports'];
  if (spvHrdRoutes.includes(location.pathname) && !['SPV', 'HRD'].includes(userRole)) {
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
  const { updateAvailable, applyUpdate } = useVersionCheck();
  const [updateDismissed, setUpdateDismissed] = useState(false);

  const fetchRole = async (userId) => {
    try {
      const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
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
    <>
      {updateAvailable && !updateDismissed && (
        <UpdateBanner onUpdate={applyUpdate} onDismiss={() => setUpdateDismissed(true)} />
      )}
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute session={session} userRole={userRole} isLoading={isLoading} />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage userRole={userRole} />} />
            <Route path="/inventory" element={<InventoryDashboard userRole={userRole} />} />
            <Route path="/input-report" element={<InputReportHub userRole={userRole} />} />
            <Route path="/defects" element={<Navigate to="/input-report?tab=kendala" replace />} />
            <Route path="/suppliers" element={<Navigate to="/inventory?tab=suppliers" replace />} />
            <Route path="/reports" element={<ReportsHub userRole={userRole} />} />
            <Route path="/weekly-report" element={<Navigate to="/reports?tab=rekap" replace />} />
            <Route path="/profiles" element={<Navigate to="/settings?tab=pengguna" replace />} />
            <Route path="/settings" element={<SettingsHub />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
