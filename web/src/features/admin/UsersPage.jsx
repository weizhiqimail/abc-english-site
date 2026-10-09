import { Button, Dialog, Input, Message } from "@alifd/next";
import { useEffect, useState } from "react";
import { get, patch, post, remove } from "../../services/api";

const emptyForm = { username: "", nickname: "", password: "" };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const load = () =>
    get("/admin/users")
      .then(setUsers)
      .catch((e) => Message.error(e.message));
  useEffect(() => {
    load();
  }, []);
  const openCreate = () => {
    setEditing("new");
    setForm(emptyForm);
  };
  const openEdit = (user) => {
    setEditing(user);
    setForm({ username: user.username, nickname: user.nickname, password: "" });
  };
  const save = async () => {
    try {
      if (editing === "new") {
        await post("/admin/users", form);
      } else {
        await patch(`/admin/users/${editing.id}`, form);
      }
      Message.success("保存成功");
      setEditing(null);
      load();
    } catch (error) {
      Message.error(error.message);
    }
  };
  const deleteUser = (user) =>
    Dialog.confirm({
      title: "永久删除用户？",
      content: `将同时删除 ${user.username} 的收藏和登录状态。`,
      onOk: async () => {
        try {
          await remove(`/admin/users/${user.id}`);
          Message.success("已删除");
          load();
        } catch (e) {
          Message.error(e.message);
        }
      },
    });
  return (
    <section className="content-width admin-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">ADMIN</p>
          <h1>用户管理</h1>
          <p>创建和管理普通用户。管理员账号不可删除。</p>
        </div>
        <Button type="primary" onClick={openCreate}>
          新增用户
        </Button>
      </div>
      <div className="users-desktop">
        <table>
          <thead>
            <tr>
              <th>用户名</th>
              <th>昵称</th>
              <th>角色</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.nickname}</td>
                <td>
                  <span className={`role-chip ${user.role}`}>{user.role}</span>
                </td>
                <td>{new Date(user.createdAt).toLocaleString()}</td>
                <td>
                  <Button text onClick={() => openEdit(user)}>
                    编辑
                  </Button>
                  {user.role !== "admin" && (
                    <Button text warning onClick={() => deleteUser(user)}>
                      删除
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="users-mobile">
        {users.map((user) => (
          <article className="user-card" key={user.id}>
            <div>
              <span className={`role-chip ${user.role}`}>{user.role}</span>
              <h3>{user.nickname}</h3>
              <p>@{user.username}</p>
            </div>
            <footer>
              <Button onClick={() => openEdit(user)}>编辑</Button>
              {user.role !== "admin" && (
                <Button warning onClick={() => deleteUser(user)}>
                  删除
                </Button>
              )}
            </footer>
          </article>
        ))}
      </div>
      <Dialog
        visible={Boolean(editing)}
        title={editing === "new" ? "新增用户" : "编辑用户"}
        onOk={save}
        onCancel={() => setEditing(null)}
        onClose={() => setEditing(null)}
      >
        <div className="dialog-form">
          <label>
            用户名
            <Input
              value={form.username}
              onChange={(value) => setForm({ ...form, username: value })}
              disabled={editing?.role === "admin"}
            />
          </label>
          <label>
            昵称
            <Input
              value={form.nickname}
              onChange={(value) => setForm({ ...form, nickname: value })}
            />
          </label>
          <label>
            {editing === "new" ? "密码" : "新密码（留空则不修改）"}
            <Input.Password
              value={form.password}
              onChange={(value) => setForm({ ...form, password: value })}
            />
          </label>
        </div>
      </Dialog>
    </section>
  );
}
