import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "../components/Layout";
import { useAuth } from "../features/auth/AuthContext";

// 路由页面按需下载；Layout、认证和设置上下文保留在入口包，保证首屏骨架立即可用。
const VocabularyHome = lazy(
  () => import("../features/vocabulary/VocabularyHome"),
);
const LevelCategories = lazy(
  () => import("../features/vocabulary/LevelCategories"),
);
const CategoryDetail = lazy(
  () => import("../features/vocabulary/CategoryDetail"),
);
const SearchPage = lazy(() => import("../features/vocabulary/SearchPage"));
const PlaceholderPage = lazy(
  () => import("../features/common/PlaceholderPage"),
);
const LoginPage = lazy(() => import("../features/auth/LoginPage"));
const UsersPage = lazy(() => import("../features/admin/UsersPage"));
const DatabasePage = lazy(() => import("../features/admin/DatabasePage"));
const CollectionsPage = lazy(
  () => import("../features/favorites/CollectionsPage"),
);
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));

function Protected({ admin = false, children }) {
  const { user, loading, authError, refreshAuth } = useAuth();
  if (loading) {
    return <div className="page-state">正在确认登录状态…</div>;
  }
  if (authError) {
    return (
      <div className="page-state error-state">
        <p>{authError}</p>
        <button type="button" onClick={refreshAuth}>
          重新确认
        </button>
      </div>
    );
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
    <Suspense fallback={<div className="page-state">正在加载页面…</div>}>
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
    </Suspense>
  );
}
