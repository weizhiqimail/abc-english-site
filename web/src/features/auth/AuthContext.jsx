import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { get, post } from "../../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    get("/auth/me")
      .then(({ user }) => setUser(user))
      .finally(() => setLoading(false));
  }, []);
  const value = useMemo(
    () => ({
      user,
      loading,
      async login(username, password) {
        const result = await post("/auth/login", { username, password });
        setUser(result.user);
        return result.user;
      },
      async logout() {
        await post("/auth/logout", {});
        setUser(null);
      },
    }),
    [user, loading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
