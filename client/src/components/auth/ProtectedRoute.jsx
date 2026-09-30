import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AppShell from '../layout/AppShell';

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <AppShell className="min-h-[100dvh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-line border-t-flame"></div>
      </AppShell>
    );
  }

  // Remember the page, so logging in again (e.g. after the session expired)
  // returns there instead of to the dashboard
  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  );
};

export default ProtectedRoute;
