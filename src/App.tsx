// =============================================================================
// DiBeliin Admin - App Entry Point
// =============================================================================
// Router setup with Authentication

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { queryClient } from '@/lib/queryClient';
import AdminLayout from '@/components/layout/AdminLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import LoginPage from '@/pages/Login';
import InventoryPage from '@/pages/Inventory';
import FinancePage from '@/pages/Finance';
import CalculatorPage from '@/pages/Calculator';
import OperationalPage from '@/pages/Operational';
import OutletManagementPage from '@/pages/OutletManagement';
import MenuManagementPage from '@/pages/MenuManagement';

import GoogleAnalytics from '@/components/GoogleAnalytics';
import './App.css';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <GoogleAnalytics />
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/calculator" element={<CalculatorPage />} />
              <Route path="/operational" element={<OperationalPage />} />
              <Route path="/outlets" element={<OutletManagementPage />} />
              <Route path="/menus" element={<MenuManagementPage />} />
            </Route>
          </Route>

          {/* Redirect root to inventory (will redirect to login if not authenticated) */}
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
