import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import ProviderForm from './pages/ProviderForm';
import VendorRegister from './pages/VendorRegister';
import BuyerRegister from './pages/BuyerRegister';
import AddBulkData from './pages/AddBulkData';
import AddDataOptions from './pages/AddDataOptions';
import AddCsvData from './pages/AddCsvData';
import BuyerDashboard from './pages/BuyerDashboard';
import ProviderDashboard from './pages/ProviderDashboard';
import ManagementDashboard from './pages/ManagementDashboard';
import ProviderInquiries from './pages/ProviderInquiries';
import BuyerInquiries from './pages/BuyerInquiries';
import WelcomePage from './pages/WelcomePage';
import AdminDashboard from './pages/AdminDashboard';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import TermsPage from './pages/TermsPage';

import { Toaster } from 'react-hot-toast';
import './index.css';

function ProtectedRoute({ children, allowedRole }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-container">
        <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const isUserSeller = user.role === 'seller' || user.role === 'provider';

  if (allowedRole) {
    const isAllowedSeller = (allowedRole === 'seller' || allowedRole === 'provider') && isUserSeller;
    // Resellers use the buyer area (search, ships, enquiries) with a prepaid wallet
    const isAllowedExact = user.role === allowedRole || (allowedRole === 'buyer' && user.role === 'reseller');
    if (!isAllowedSeller && !isAllowedExact) {
      if (isUserSeller) return <Navigate to="/seller/dashboard" replace />;
      if (user.role === 'management') return <Navigate to="/management/dashboard" replace />;
      if (user.role === 'admin') return <Navigate to="/admin" replace />;
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-container">
        <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
      </div>
    );
  }

  const isUserSeller = user?.role === 'seller' || user?.role === 'provider';

  return (
    <Routes>
      <Route
        path="/"
        element={<WelcomePage />}
      />
      <Route
        path="/login"
        element={
          user ? (
             <Navigate to={isUserSeller ? '/seller/dashboard' : user.role === 'management' ? '/management/dashboard' : user.role === 'admin' ? '/admin' : '/dashboard'} replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route
        path="/terms"
        element={<TermsPage />}
      />
      <Route
        path="/forgot-password"
        element={<ForgotPasswordPage />}
      />
      <Route
        path="/reset-password"
        element={<ResetPasswordPage />}
      />
      <Route
        path="/seller/register"
        element={<VendorRegister />}
      />
      <Route
        path="/vendor/register"
        element={<VendorRegister />}
      />
      <Route
        path="/buyer/register"
        element={<BuyerRegister />}
      />
      <Route
        path="/reseller/register"
        element={<BuyerRegister key="reseller" role="reseller" />}
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/seller/register-details"
        element={
          <ProtectedRoute>
            <ProviderForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/provider/register"
        element={
          <ProtectedRoute>
            <ProviderForm />
          </ProtectedRoute>
        }
      />

      {/* ── Seller Dashboard & Features ── */}
      <Route
        path="/seller/dashboard"
        element={
          <ProtectedRoute allowedRole="seller">
            <ProviderDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/seller/inquiries"
        element={
          <ProtectedRoute allowedRole="seller">
            <ProviderInquiries />
          </ProtectedRoute>
        }
      />
      <Route
        path="/seller/add-options"
        element={
          <ProtectedRoute allowedRole="seller">
            <AddDataOptions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/seller/add-csv"
        element={
          <ProtectedRoute allowedRole="seller">
            <AddCsvData />
          </ProtectedRoute>
        }
      />
      <Route
        path="/seller/add-data"
        element={
          <ProtectedRoute allowedRole="seller">
            <AddBulkData />
          </ProtectedRoute>
        }
      />

      {/* ── Backward-compatible Provider Routes (Redirects) ── */}
      <Route path="/provider/dashboard" element={<Navigate to="/seller/dashboard" replace />} />
      <Route path="/provider/inquiries" element={<Navigate to="/seller/inquiries" replace />} />
      <Route path="/provider/add-options" element={<Navigate to="/seller/add-options" replace />} />
      <Route path="/provider/add-csv" element={<Navigate to="/seller/add-csv" replace />} />
      <Route path="/provider/add-data" element={<Navigate to="/seller/add-data" replace />} />

      {/* ── Management & Buyer Routes ── */}
      <Route
        path="/management/dashboard"
        element={
          <ProtectedRoute allowedRole="management">
            <ManagementDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRole="buyer">
            <BuyerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/buyer/inquiries"
        element={
          <ProtectedRoute allowedRole="buyer">
            <BuyerInquiries />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        {/* Global animated background */}
        <div className="app-bg" />
        <Toaster
          position="top-center"
          reverseOrder={false}
          toastOptions={{
            duration: 4000,
            style: {
              background: '#ffffff',
              color: '#1e293b',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
