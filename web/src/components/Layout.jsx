import { useEffect, useRef, useState } from "react";
import { Button, Input, Message } from "@alifd/next";
import { NavLink, useLocation, useNavigate, useOutlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { getActiveRequestCount } from "../services/api";

function AnimatedOutlet() {
  const outlet = useOutlet();
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}`;
  const [displayed, setDisplayed] = useState({ routeKey, outlet });
  const [leaving, setLeaving] = useState(false);
  const nextOutlet = useRef(outlet);
  nextOutlet.current = outlet;

  useEffect(() => {
    if (routeKey === displayed.routeKey) {
      return;
    }
    setLeaving(true);
    const timer = window.setTimeout(() => {
      setDisplayed({ routeKey, outlet: nextOutlet.current });
      setLeaving(false);
    }, 140);
    return () => window.clearTimeout(timer);
  }, [routeKey, displayed.routeKey]);

  return (
    <div className={`route-content ${leaving ? "leaving" : "entering"}`}>
      {displayed.outlet}
    </div>
  );
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [loading, setLoading] = useState(() => getActiveRequestCount() > 0);
  const [notifications, setNotifications] = useState([]);
  const accountRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    const handleLoading = (event) => setLoading(event.detail > 0);
    window.addEventListener("abc:api-loading", handleLoading);
    return () => window.removeEventListener("abc:api-loading", handleLoading);
  }, []);

  useEffect(() => {
    const handleNotification = (event) => {
      const item = event.detail;
      setNotifications((current) => [...current, item].slice(-3));
      window.setTimeout(
        () =>
          setNotifications((current) =>
            current.filter((notification) => notification.id !== item.id),
          ),
        3000,
      );
    };
    window.addEventListener("abc:notification", handleNotification);
    return () =>
      window.removeEventListener("abc:notification", handleNotification);
  }, []);

  useEffect(() => {
    if (!accountOpen) {
      return undefined;
    }
    const closeOnOutsideClick = (event) => {
      if (!accountRef.current?.contains(event.target)) {
        setAccountOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen]);
  const submitSearch = (event) => {
    event.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
    setMenuOpen(false);
  };
  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="header-inner">
          <NavLink to="/vocabulary" className="brand">
            <span className="brand-mark">A</span>
            <span>ABC English</span>
          </NavLink>
          <button
            className="mobile-menu-button"
            aria-label="打开导航"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ☰
          </button>
          <div className={`header-content ${menuOpen ? "open" : ""}`}>
            <nav className="main-nav" onClick={() => setMenuOpen(false)}>
              <NavLink to="/vocabulary">词汇</NavLink>
              <NavLink to="/grammar">语法</NavLink>
              <NavLink to="/reading">阅读</NavLink>
            </nav>
            <form className="header-search" onSubmit={submitSearch}>
              <Input
                value={query}
                onChange={setQuery}
                placeholder="搜索所有词汇…"
                aria-label="全站搜索"
              />
              <Button htmlType="submit" type="primary">
                搜索
              </Button>
            </form>
            <div className="account-actions">
              <Button text onClick={() => navigate("/settings")}>
                ⚙ 设置
              </Button>
              {user ? (
                <div className="account-menu" ref={accountRef}>
                  <Button
                    aria-haspopup="menu"
                    aria-expanded={accountOpen}
                    onClick={() => setAccountOpen((open) => !open)}
                  >
                    {user.nickname || user.username}⌄
                  </Button>
                  {accountOpen && (
                    <div className="account-popup" role="menu">
                      <button
                        role="menuitem"
                        onClick={() => {
                          setAccountOpen(false);
                          navigate("/favorites");
                        }}
                      >
                        我的收藏
                      </button>
                      {user.role === "admin" && (
                        <>
                          <button
                            role="menuitem"
                            onClick={() => {
                              setAccountOpen(false);
                              navigate("/admin/users");
                            }}
                          >
                            用户管理
                          </button>
                          <button
                            role="menuitem"
                            onClick={() => {
                              setAccountOpen(false);
                              navigate("/admin/database");
                            }}
                          >
                            数据库浏览
                          </button>
                        </>
                      )}
                      <button
                        role="menuitem"
                        onClick={async () => {
                          try {
                            await logout();
                            setAccountOpen(false);
                            navigate("/vocabulary");
                          } catch (error) {
                            Message.error(error.message);
                          }
                        }}
                      >
                        退出登录
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Button onClick={() => navigate("/login")}>登录</Button>
              )}
            </div>
          </div>
        </div>
      </header>
      {menuOpen && (
        <button
          className="menu-scrim"
          aria-label="关闭导航"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <main className="main-content">
        <AnimatedOutlet />
      </main>
      {loading && (
        <div className="global-loading" role="status" aria-live="polite">
          <span className="global-loading-spinner" />
          <strong>正在加载…</strong>
        </div>
      )}
      <div className="notification-stack" aria-live="polite">
        {notifications.map((item) => (
          <div
            className={`app-notification ${item.type || "success"}`}
            key={item.id}
            role="status"
          >
            {item.message}
          </div>
        ))}
      </div>
      <footer className="site-footer">
        <strong>ABC English</strong>
        <span>按等级探索英语词汇</span>
      </footer>
    </div>
  );
}
