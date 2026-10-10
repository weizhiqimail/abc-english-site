import { Input } from "@alifd/next";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { queryLevelCategories } from "../../https/requests/vocabulary";

export default function LevelCategories() {
  const { level: rawLevel } = useParams();
  // 路由参数可能缺失，先收窄为字符串再标准化，避免直接调用 undefined 的方法。
  const level = typeof rawLevel === "string" ? rawLevel.toUpperCase() : "";
  const [categories, setCategories] = useState(null);
  const [queryStr, setQueryStr] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setCategories(null);
    setErrorMsg("");
    queryLevelCategories(level)
      .then((data) => {
        // 服务端契约异常时使用空数组，保证后续 map/filter 始终安全。
        setCategories(Array.isArray(data?.categories) ? data.categories : []);
      })
      .catch((requestError) => setErrorMsg(requestError.message));
  }, [level]);

  const filtered = useMemo(() => {
    const normalizedQuery = queryStr.trim().toLocaleLowerCase();
    // 数据未加载或搜索词为空时，无需执行过滤。
    if (!Array.isArray(categories) || !normalizedQuery) {
      return Array.isArray(categories) ? categories : [];
    }
    return categories.filter((item) =>
      `${item.title} ${item.localizedTitle}`
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [categories, queryStr]);

  if (errorMsg) {
    return <div className="page-state error-state">{errorMsg}</div>;
  }
  if (!categories) {
    return null;
  }

  return (
    <section className="content-width category-section level-categories-page">
      <nav className="breadcrumbs">
        <Link to="/vocabulary">词汇等级</Link>
        <span>/</span>
        <span>{level}</span>
      </nav>
      <div className="section-heading category-heading">
        <div>
          <p className="eyebrow">{level} VOCABULARY</p>
          <h1>{level} 词汇主题</h1>
        </div>
        {categories.length > 0 && (
          <Input
            value={queryStr}
            onChange={setQueryStr}
            placeholder="搜索中英文主题…"
            className="category-search"
          />
        )}
      </div>
      {categories.length === 0 ? (
        <div className="empty-state">
          <div>◌</div>
          <h3>{level} 内容正在准备</h3>
          <p>这个等级的数据暂未上线，你可以先学习其他等级。</p>
        </div>
      ) : (
        <div className="category-grid">
          {filtered.map((item) => (
            <Link
              className="category-card"
              key={item.recordId}
              to={`/vocabulary/${item.level.toLowerCase()}/${item.recordId}`}
            >
              <span className="category-number">
                {item.level} · {item.index}
              </span>
              <h3>{item.localizedTitle}</h3>
              <p>{item.title}</p>
              <footer>
                <span>{item.wordCount} 个词汇</span>
                <span>开始学习 →</span>
              </footer>
            </Link>
          ))}
        </div>
      )}
      {categories.length > 0 && filtered.length === 0 && (
        <div className="empty-state compact">
          <p>没有匹配的主题</p>
        </div>
      )}
    </section>
  );
}
