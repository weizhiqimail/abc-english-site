import { Button, Input, Message } from "@alifd/next";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function LoginPage() {
  const { user, login, authError, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (user) {
    return <Navigate to="/vocabulary" replace />;
  }
  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(username, password);
      Message.success("登录成功");
      navigate(location.state?.from || "/vocabulary");
    } catch (error) {
      Message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="brand-mark large">A</div>
        <p className="eyebrow">WELCOME BACK</p>
        <h1>登录 ABC English</h1>
        <p>登录后管理收藏夹和学习内容。</p>
        {authError && (
          <div className="page-state error-state">
            <p>{authError}</p>
            <Button onClick={refreshAuth}>重新确认登录状态</Button>
          </div>
        )}
        <form onSubmit={submit}>
          <label className="auth-field">
            <span>用户名</span>
            <Input
              value={username}
              onChange={setUsername}
              size="large"
              autoComplete="username"
            />
          </label>
          <label className="auth-field">
            <span>密码</span>
            <Input.Password
              value={password}
              onChange={setPassword}
              size="large"
              autoComplete="current-password"
            />
          </label>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={submitting}
          >
            登录
          </Button>
        </form>
      </div>
    </section>
  );
}
