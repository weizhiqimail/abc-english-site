import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  loginWithPassword,
  logoutCurrentUser,
  queryCurrentUser,
} from "../../https/requests/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const refreshAuth = useCallback(async () => {
    setLoading(true);
    setAuthError("");
    try {
      const result = await queryCurrentUser();
      setUser(result.user);
    } catch (requestError) {
      // “确认失败”不能降级成“确认未登录”，否则受保护页面会错误跳转到登录页。
      setUser(null);
      setAuthError(requestError.message || "无法确认登录状态");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);
  const value = useMemo(
    () => ({
      user,
      loading,
      authError,
      refreshAuth,
      async login(username, password) {
        const result = await loginWithPassword({ username, password });
        setUser(result.user);
        setAuthError("");
        return result.user;
      },
      async logout() {
        await logoutCurrentUser();
        setUser(null);
      },
    }),
    [user, loading, authError, refreshAuth],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
