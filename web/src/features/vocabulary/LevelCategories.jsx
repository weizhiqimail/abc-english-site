import { Input } from "@alifd/next";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { get } from "../../services/api";

export default function LevelCategories() {
  const { level: rawLevel } = useParams();
  const level = rawLevel.toUpperCase();
  const [categories, setCategories] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setCategories(null);
    setError("");
    get(`/vocabulary/levels/${level}`)
      .then((data) => setCategories(data.categories))
      .catch((requestError) => setError(requestError.message));
  }, [level]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!categories || !needle) {
      return categories || [];
    }
    return categories.filter((item) =>
      `${item.title} ${item.localizedTitle}`
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [categories, query]);

  if (error) {
    return <div className="page-state error-state">{error}</div>;
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
            value={query}
            onChange={setQuery}
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
