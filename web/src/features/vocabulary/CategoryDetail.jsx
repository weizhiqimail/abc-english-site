import { Checkbox, Input } from "@alifd/next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { get } from "../../services/api";
import { useAuth } from "../auth/AuthContext";
import WordCard from "./WordCard";
import { favoriteIdentity } from "../favorites/favoriteIdentity";

export default function CategoryDetail() {
  const { level, recordId } = useParams();
  const { user } = useAuth();
  const [page, setPage] = useState(null);
  const [collections, setCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsError, setCollectionsError] = useState("");
  const [favoriteOverrides, setFavoriteOverrides] = useState(new Map());
  const [query, setQuery] = useState("");
  const [showWord, setShowWord] = useState(
    () => localStorage.getItem("show-word") !== "false",
  );
  const [showTranslation, setShowTranslation] = useState(
    () => localStorage.getItem("show-translation") !== "false",
  );
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    // 路由参数变化时先清空旧页面和错误，避免在新请求期间展示上一分类，或让旧错误永久遮住新结果。
    setPage(null);
    setError("");
    get(`/vocabulary/categories/${recordId}`, { signal: controller.signal })
      .then(setPage)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      });
    return () => controller.abort();
  }, [recordId]);
  const loadCollections = useCallback(
    async (signal) => {
      if (!user) {
        setCollections([]);
        setCollectionsError("");
        setCollectionsLoading(false);
        return;
      }
      setCollectionsLoading(true);
      setCollectionsError("");
      try {
        setCollections(await get("/collections", { signal }));
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setCollectionsError(requestError.message);
        }
      } finally {
        if (!signal?.aborted) setCollectionsLoading(false);
      }
    },
    [user],
  );
  useEffect(() => {
    const controller = new AbortController();
    loadCollections(controller.signal);
    return () => controller.abort();
  }, [loadCollections]);
  // 局部覆盖只属于当前用户和分类；切换上下文后以服务端收藏数据为准。
  useEffect(() => setFavoriteOverrides(new Map()), [recordId, user?.id]);
  useEffect(() => localStorage.setItem("show-word", showWord), [showWord]);
  useEffect(
    () => localStorage.setItem("show-translation", showTranslation),
    [showTranslation],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return !page
      ? []
      : !needle
        ? page.cards
        : page.cards.filter((card) =>
            `${card.word} ${card.localizedDefinition} ${card.definition}`
              .toLocaleLowerCase()
              .includes(needle),
          );
  }, [page, query]);
  const defaultCollection = collections.find((item) => item.isDefault);
  const favoriteIdentities = useMemo(() => {
    const set = new Set(
      defaultCollection?.favorites?.map((item) =>
        favoriteIdentity(item.recordId, item.wordKey),
      ) || [],
    );
    for (const [key, value] of favoriteOverrides) {
      if (value) {
        set.add(key);
      } else {
        set.delete(key);
      }
    }
    return set;
  }, [defaultCollection, favoriteOverrides]);
  if (error) {
    return <div className="page-state error-state">{error}</div>;
  }
  if (!page) {
    return <div className="page-state">正在加载分类…</div>;
  }
  return (
    <section className="content-width detail-page">
      <nav className="breadcrumbs">
        <Link to="/vocabulary">词汇</Link>
        <span>/</span>
        <Link to={`/vocabulary/${level}`}>{page.identity.level}</Link>
        <span>/</span>
        <span>{page.subcategory.localizedTitle}</span>
      </nav>
      <header className="detail-header">
        <div>
          <span className="category-number">
            {page.identity.level} · {page.identity.classificationIndex}
          </span>
          <h1>{page.subcategory.localizedTitle}</h1>
          <h2>{page.subcategory.title}</h2>
          <p>{page.subcategory.localizedDescription}</p>
          <p className="english-description">{page.subcategory.description}</p>
        </div>
        <div className="detail-stats">
          <strong>{page.cards.length}</strong>
          <span>个词汇</span>
          <strong>
            {Math.ceil(
              (page.subcategory.estimatedLearningTimeSeconds || 0) / 60,
            )}
          </strong>
          <span>分钟</span>
        </div>
      </header>
      <div className="word-toolbar">
        <Input
          value={query}
          onChange={setQuery}
          placeholder="在当前分类中搜索…"
        />
        <div className="visibility-controls">
          <Checkbox checked={showWord} onChange={setShowWord}>
            显示词汇
          </Checkbox>
          <Checkbox checked={showTranslation} onChange={setShowTranslation}>
            显示翻译
          </Checkbox>
        </div>
        <span className="result-count">{filtered.length} 个结果</span>
      </div>
      {user && collectionsLoading && (
        <div className="page-state">正在加载收藏状态…</div>
      )}
      {user && collectionsError && (
        <div className="page-state error-state">
          <p>收藏状态加载失败：{collectionsError}</p>
          <button type="button" onClick={() => loadCollections()}>
            重试
          </button>
        </div>
      )}
      <div className="word-list">
        {filtered.map((card, index) => (
          <WordCard
            key={`${card.wordEntryId ?? card.translationId}-${index}`}
            card={card}
            recordId={recordId}
            showWord={showWord}
            showTranslation={showTranslation}
            defaultCollection={defaultCollection}
            favoriteIdentities={favoriteIdentities}
            onFavoriteChange={(key, value) =>
              setFavoriteOverrides((old) => new Map(old).set(key, value))
            }
          />
        ))}
      </div>
      <nav className="adjacent-nav">
        {page.adjacent.previous ? (
          <Link to={`/vocabulary/${level}/${page.adjacent.previous.recordId}`}>
            ← {page.adjacent.previous.localizedTitle}
          </Link>
        ) : (
          <span />
        )}
        {page.adjacent.next && (
          <Link to={`/vocabulary/${level}/${page.adjacent.next.recordId}`}>
            {page.adjacent.next.localizedTitle} →
          </Link>
        )}
      </nav>
    </section>
  );
}
