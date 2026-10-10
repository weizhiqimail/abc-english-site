import { Checkbox, Input } from "@alifd/next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { queryCollections } from "../../https/requests/collections";
import { queryCategoryDetail } from "../../https/requests/vocabulary";
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
  // queryStr 明确表示搜索框中的字符串，而不是“查询”动作。
  const [queryStr, setQueryStr] = useState("");
  const [showWord, setShowWord] = useState(
    () => localStorage.getItem("show-word") !== "false",
  );
  const [showTranslation, setShowTranslation] = useState(
    () => localStorage.getItem("show-translation") !== "false",
  );
  // errorMsg 只保存可展示的错误文本，不伪装成 Error 对象。
  const [errorMsg, setErrorMsg] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    // 路由参数变化时先清空旧页面和错误，避免在新请求期间展示上一分类，或让旧错误永久遮住新结果。
    setPage(null);
    setErrorMsg("");
    queryCategoryDetail(recordId, { signal: controller.signal })
      .then(setPage)
      .catch((requestError) => {
        // 取消请求是页面切换的正常结果，只有真实失败才需要展示。
        if (requestError.name !== "AbortError") {
          setErrorMsg(requestError.message);
        }
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
        setCollections(await queryCollections({ signal }));
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setCollectionsError(requestError.message);
        }
      } finally {
        // 已取消的请求不能再修改卸载页面的状态。
        if (!signal?.aborted) {
          setCollectionsLoading(false);
        }
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
  const filteredCards = useMemo(() => {
    // 接口尚未返回有效词卡数组时，列表必须安全地退化为空数组。
    const cards = Array.isArray(page?.cards) ? page.cards : [];
    const normalizedQuery = queryStr.trim().toLocaleLowerCase();
    // 空搜索词代表展示全部词卡，不执行无意义的过滤。
    if (!normalizedQuery) {
      return cards;
    }
    return cards.filter((card) =>
      `${card.word} ${card.localizedDefinition} ${card.definition}`
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [page, queryStr]);
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
  // 请求失败时错误优先于空页面状态，避免把失败误显示成持续加载。
  if (errorMsg) {
    return <div className="page-state error-state">{errorMsg}</div>;
  }
  if (!page) {
    return <div className="page-state">正在加载分类…</div>;
  }
  // 详情页的关键对象必须存在；接口结构不完整时给出可理解的失败界面。
  const identity = page.identity;
  const subcategory = page.subcategory;
  const adjacent = page.adjacent;
  if (!identity || !subcategory || !adjacent) {
    return <div className="page-state error-state">分类数据结构不完整</div>;
  }
  const cards = Array.isArray(page.cards) ? page.cards : [];
  const learningSeconds = Number.isFinite(
    subcategory.estimatedLearningTimeSeconds,
  )
    ? subcategory.estimatedLearningTimeSeconds
    : 0;
  const learningMinutes = Math.ceil(learningSeconds / 60);
  return (
    <section className="content-width detail-page">
      <nav className="breadcrumbs">
        <Link to="/vocabulary">词汇</Link>
        <span>/</span>
        <Link to={`/vocabulary/${level}`}>{identity.level}</Link>
        <span>/</span>
        <span>{subcategory.localizedTitle}</span>
      </nav>
      <header className="detail-header">
        <div>
          <span className="category-number">
            {identity.level} · {identity.classificationIndex}
          </span>
          <h1>{subcategory.localizedTitle}</h1>
          <h2>{subcategory.title}</h2>
          <p>{subcategory.localizedDescription}</p>
          <p className="english-description">{subcategory.description}</p>
        </div>
        <div className="detail-stats">
          <strong>{cards.length}</strong>
          <span>个词汇</span>
          <strong>{learningMinutes}</strong>
          <span>分钟</span>
        </div>
      </header>
      <div className="word-toolbar">
        <Input
          value={queryStr}
          onChange={setQueryStr}
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
        <span className="result-count">{filteredCards.length} 个结果</span>
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
        {filteredCards.map((card, index) => (
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
        {adjacent.previous ? (
          <Link to={`/vocabulary/${level}/${adjacent.previous.recordId}`}>
            ← {adjacent.previous.localizedTitle}
          </Link>
        ) : (
          <span />
        )}
        {adjacent.next && (
          <Link to={`/vocabulary/${level}/${adjacent.next.recordId}`}>
            {adjacent.next.localizedTitle} →
          </Link>
        )}
      </nav>
    </section>
  );
}
