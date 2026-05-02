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
import ProviderInquiries from './pages/ProviderInquiries';
import BuyerInquiries from './pages/BuyerInquiries';
import WelcomePage from './pages/WelcomePage';
import AdminDashboard from './pages/AdminDashboard';

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

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === 'provider' ? '/provider/dashboard' : '/dashboard'} replace />;
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
             <Navigate to={user.role === 'provider' ? '/provider/dashboard' : '/dashboard'} replace />
          ) : (
            <LoginPage />
          )
        }
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
        path="/admin"
        element={<AdminDashboard />}
      />
      <Route
        path="/provider/register"
        element={
          <ProtectedRoute>
            <ProviderForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/provider/dashboard"
        element={
          <ProtectedRoute allowedRole="provider">
            <ProviderDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/provider/add-options"
        element={
          <ProtectedRoute allowedRole="provider">
            <AddDataOptions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/provider/add-csv"
        element={
          <ProtectedRoute allowedRole="provider">
            <AddCsvData />
          </ProtectedRoute>
        }
      />
      <Route
        path="/provider/add-data"
        element={
          <ProtectedRoute allowedRole="provider">
            <AddBulkData />
          </ProtectedRoute>
        }
      />
      <Route
        path="/provider/inquiries"
        element={
          <ProtectedRoute allowedRole="provider">
            <ProviderInquiries />
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
