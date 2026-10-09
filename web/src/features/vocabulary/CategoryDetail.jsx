import { Checkbox, Input } from "@alifd/next";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { get } from "../../services/api";
import { useAuth } from "../auth/AuthContext";
import WordCard from "./WordCard";

export default function CategoryDetail() {
  const { level, recordId } = useParams();
  const { user } = useAuth();
  const [page, setPage] = useState(null);
  const [collections, setCollections] = useState([]);
  const [query, setQuery] = useState("");
  const [showWord, setShowWord] = useState(
    () => localStorage.getItem("show-word") !== "false",
  );
  const [showTranslation, setShowTranslation] = useState(
    () => localStorage.getItem("show-translation") !== "false",
  );
  const [error, setError] = useState("");
  useEffect(() => {
    get(`/vocabulary/categories/${recordId}`)
      .then(setPage)
      .catch((e) => setError(e.message));
  }, [recordId]);
  useEffect(() => {
    if (user) {
      get("/collections")
        .then(setCollections)
        .catch(() => setCollections([]));
    } else {
      setCollections([]);
    }
  }, [user]);
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
  const [favoriteOverrides, setFavoriteOverrides] = useState(new Map());
  const favoriteKeys = useMemo(() => {
    const set = new Set(
      defaultCollection?.favorites?.map((item) => item.wordKey) || [],
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
    return null;
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
      <div className="word-list">
        {filtered.map((card, index) => (
          <WordCard
            key={`${card.wordEntryId ?? card.translationId}-${index}`}
            card={card}
            recordId={recordId}
            showWord={showWord}
            showTranslation={showTranslation}
            defaultCollection={defaultCollection}
            favoriteKeys={favoriteKeys}
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
