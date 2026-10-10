import { Input } from "@alifd/next";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { searchVocabulary } from "../../https/requests/vocabulary";

export default function SearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get("q") || "";
  const [value, setValue] = useState(q);
  const [results, setResults] = useState({ categories: [], words: [] });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  useEffect(() => {
    setValue(q);
    setResults({ categories: [], words: [] });
    setErrorMsg("");
    if (!q) {
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    // URL 查询变化时取消旧请求；否则较慢的旧响应可能覆盖较新的搜索结果。
    searchVocabulary(q, { signal: controller.signal })
      .then(setResults)
      .catch((requestError) => {
        // 页面切换触发的取消不是错误，只有真实请求失败才展示。
        if (requestError.name !== "AbortError") {
          setErrorMsg(requestError.message);
        }
      })
      .finally(() => {
        // 已取消的请求不能再修改页面状态。
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
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
      {loading && <div className="page-state">正在搜索…</div>}
      {errorMsg && <div className="page-state error-state">{errorMsg}</div>}
      {q && !loading && !errorMsg && (
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
