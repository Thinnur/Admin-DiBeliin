// =============================================================================
// DiBeliin Admin - App Entry Point
// =============================================================================
// Router setup dengan Authentication & Role-Based Access Control

import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layout/AdminLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import LoginPage from '@/pages/Login';
import InventoryPage from '@/pages/Inventory';
import FinancePage from '@/pages/Finance';
import CalculatorPage from '@/pages/Calculator';
import OperationalPage from '@/pages/Operational';
import OutletManagementPage from '@/pages/OutletManagement';
import MenuManagementPage from '@/pages/MenuManagement';
import DigitalProductsPage from '@/pages/DigitalProducts';
import DigitalTrackingPage from '@/pages/DigitalTracking';
import DigitalProvidersPage from '@/pages/DigitalProviders';

import './App.css';

// -----------------------------------------------------------------------------
// Staff Route Guard
// Redirect Staff ke /inventory jika mencoba akses halaman terlarang
// -----------------------------------------------------------------------------

function StaffRoute() {
    const { isStaff, isLoading } = useAuth();

    // Tunggu sampai role selesai diload
    if (isLoading) return null;

    // Jika Staff, redirect ke /inventory
    if (isStaff) return <Navigate to="/inventory" replace />;

    // Super Admin — lanjutkan ke halaman yang diminta
    return <Outlet />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes (harus login) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>

              {/* Rute yang bisa diakses SEMUA role */}
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/calculator" element={<CalculatorPage />} />

              {/* Rute khusus Super Admin — Staff akan di-redirect ke /inventory */}
              <Route element={<StaffRoute />}>
                <Route path="/finance" element={<FinancePage />} />
                <Route path="/operational" element={<OperationalPage />} />
                <Route path="/outlets" element={<OutletManagementPage />} />
                <Route path="/menus" element={<MenuManagementPage />} />
                <Route path="/digital-products" element={<DigitalProductsPage />} />
                <Route path="/digital-tracking" element={<DigitalTrackingPage />} />
                <Route path="/digital-providers" element={<DigitalProvidersPage />} />
              </Route>

            </Route>
          </Route>

          {/* Redirect root ke inventory (akan redirect ke login jika belum auth) */}
          <Route path="/" element={<Navigate to="/inventory" replace />} />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/inventory" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        richColors
        position="top-right"
        offset="env(safe-area-inset-top, 16px)"
        toastOptions={{
          style: {
            marginTop: 'env(safe-area-inset-top, 0px)',
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;

