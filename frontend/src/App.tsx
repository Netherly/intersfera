import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ProtectedRoute, RequireSuperAdmin } from '@/components/ProtectedRoute';
import { Access } from '@/pages/Access';
import { AppealCard } from '@/pages/AppealCard';
import { Appeals } from '@/pages/Appeals';
import { Categories } from '@/pages/Categories';
import { Dashboard } from '@/pages/Dashboard';
import { Login } from '@/pages/Login';
import { Mail } from '@/pages/Mail';
import { Materials } from '@/pages/Materials';
import { Users } from '@/pages/Users';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/stats" replace />} />
        <Route path="stats" element={<Dashboard />} />
        <Route path="appeals" element={<Appeals />} />
        <Route path="mail" element={<Mail />} />
        <Route path="appeals/:id" element={<AppealCard />} />
        <Route path="materials" element={<Materials />} />
        <Route
          path="categories"
          element={
            <RequireSuperAdmin>
              <Categories />
            </RequireSuperAdmin>
          }
        />
        <Route
          path="users"
          element={
            <RequireSuperAdmin>
              <Users />
            </RequireSuperAdmin>
          }
        />
        <Route
          path="access"
          element={
            <RequireSuperAdmin>
              <Access />
            </RequireSuperAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/stats" replace />} />
    </Routes>
  );
}
