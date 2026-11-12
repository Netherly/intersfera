import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ProtectedRoute, RequireDepartment, RequireSuperAdmin } from '@/components/ProtectedRoute';
import { Access } from '@/pages/Access';
import { AppealCard } from '@/pages/AppealCard';
import { Appeals } from '@/pages/Appeals';
import { Categories } from '@/pages/Categories';
import { Dashboard } from '@/pages/Dashboard';
import { DepartmentPlace } from '@/pages/DepartmentPlace';
import { History } from '@/pages/History';
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
        <Route
          path="appeals"
          element={
            <RequireDepartment id="appeals">
              <Appeals />
            </RequireDepartment>
          }
        />
        <Route path="outgoing" element={<Navigate to="/appeals?direction=outgoing" replace />} />
        <Route path="outgoing/new" element={<Navigate to="/mail?tab=new" replace />} />
        <Route
          path="mail"
          element={
            <RequireDepartment id="appeals">
              <Mail />
            </RequireDepartment>
          }
        />
        <Route
          path="appeals/:id"
          element={
            <RequireDepartment id="appeals">
              <AppealCard />
            </RequireDepartment>
          }
        />
        <Route
          path="materials"
          element={
            <RequireDepartment id="appeals">
              <Materials />
            </RequireDepartment>
          }
        />
        <Route path="department/:id" element={<DepartmentPlace />} />
        <Route
          path="history"
          element={
            <RequireDepartment id="appeals">
              <History />
            </RequireDepartment>
          }
        />
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
