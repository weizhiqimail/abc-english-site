import { Input } from "@alifd/next";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { get } from "../../services/api";

export default function SearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get("q") || "";
  const [value, setValue] = useState(q);
  const [results, setResults] = useState({ categories: [], words: [] });
  useEffect(() => {
    setValue(q);
    if (!q) {
      return;
    }
    get(`/search?q=${encodeURIComponent(q)}`).then(setResults);
  }, [q]);
  const submit = (event) => {
    event.preventDefault();
    if (value.trim()) {
      navigate(`/search?q=${encodeURIComponent(value.trim())}`);
    }
  };
  return (
    <section className="content-width search-page">
      <p className="eyebrow">GLOBAL SEARCH</p>
      <h1>搜索所有词汇</h1>
      <form className="big-search" onSubmit={submit}>
        <Input
          value={value}
          onChange={setValue}
          placeholder="输入英文单词、中文释义或分类名称"
          size="large"
        />
        <button>搜索</button>
      </form>
      {q && (
        <>
          <div className="search-summary">
            “{q}” 找到 {results.words.length} 个词汇、
            {results.categories.length} 个分类
          </div>
          {results.categories.length > 0 && (
            <div className="search-group">
              <h2>相关分类</h2>
              <div className="category-grid">
                {results.categories.map((item) => (
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
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="search-group">
            <h2>词汇结果</h2>
            <div className="search-word-grid">
              {results.words.map((item) => (
                <Link
                  className="search-word-card"
                  key={`${item.recordId}-${item.wordKey}`}
                  to={`/vocabulary/${item.level.toLowerCase()}/${item.recordId}`}
                >
                  <div>
                    {item.photo?.thumbnailUrl ? (
                      <img src={item.photo.thumbnailUrl} alt="" />
                    ) : (
                      <span className="mini-placeholder">ABC</span>
                    )}
                  </div>
                  <section>
                    <span>
                      {item.level} · {item.categoryTitle}
                    </span>
                    <h3>{item.word}</h3>
                    <p>{item.localizedDefinition}</p>
                  </section>
                </Link>
              ))}
            </div>
            {results.words.length === 0 && (
              <div className="empty-state compact">没有找到词汇</div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
