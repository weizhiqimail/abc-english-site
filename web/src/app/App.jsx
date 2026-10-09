import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "../components/Layout";
import VocabularyHome from "../features/vocabulary/VocabularyHome";
import LevelCategories from "../features/vocabulary/LevelCategories";
import CategoryDetail from "../features/vocabulary/CategoryDetail";
import SearchPage from "../features/vocabulary/SearchPage";
import PlaceholderPage from "../features/common/PlaceholderPage";
import LoginPage from "../features/auth/LoginPage";
import UsersPage from "../features/admin/UsersPage";
import DatabasePage from "../features/admin/DatabasePage";
import CollectionsPage from "../features/favorites/CollectionsPage";
import SettingsPage from "../features/settings/SettingsPage";
import { useAuth } from "../features/auth/AuthContext";

function Protected({ admin = false, children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return null;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (admin && user.role !== "admin") {
    return <Navigate to="/vocabulary" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/vocabulary" replace />} />
        <Route path="vocabulary" element={<VocabularyHome />} />
        <Route path="vocabulary/:level" element={<LevelCategories />} />
        <Route
          path="vocabulary/:level/:recordId"
          element={<CategoryDetail />}
        />
        <Route path="search" element={<SearchPage />} />
        <Route path="grammar" element={<PlaceholderPage title="语法" />} />
        <Route path="reading" element={<PlaceholderPage title="阅读" />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route
          path="favorites"
          element={
            <Protected>
              <CollectionsPage />
            </Protected>
          }
        />
        <Route
          path="favorites/:collectionId"
          element={
            <Protected>
              <CollectionsPage />
            </Protected>
          }
        />
        <Route
          path="admin/users"
          element={
            <Protected admin>
              <UsersPage />
            </Protected>
          }
        />
        <Route
          path="admin/database"
          element={
            <Protected admin>
              <DatabasePage />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/vocabulary" replace />} />
      </Route>
    </Routes>
  );
}
