import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../features/auth/store';
import LoginPage from '../pages/login/LoginPage';
import AdminPage from '../pages/admin/AdminPage';
import ManagerPage from '../pages/manager/ManagerPage';
import ClientPage from '../pages/client/ClientPage';

function ProtectedRoute({
    children,
    allowedRoles,
}: {
    children: JSX.Element;
    allowedRoles: string[];
}) {
    const { user, token } = useAuthStore();

    if (!token) return <Navigate to="/login" replace />;
    if (user && !allowedRoles.includes(user.role)) return <Navigate to="/login" replace />;

    return children;
}

export default function Router() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                    path="/admin/*"
                    element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <AdminPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/manager/*"
                    element={
                        <ProtectedRoute allowedRoles={['manager']}>
                            <ManagerPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/client/*"
                    element={
                        <ProtectedRoute allowedRoles={['client']}>
                            <ClientPage />
                        </ProtectedRoute>
                    }
                />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
