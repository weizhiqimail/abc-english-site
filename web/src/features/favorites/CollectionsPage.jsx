import { Button, Checkbox, Dialog, Input } from "@alifd/next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createCollection,
  deleteCollection as requestDeleteCollection,
  queryCollections,
  renameCollection,
} from "../../https/requests/collections";
import { notify } from "../../services/notification";
import WordCard from "../vocabulary/WordCard";
import { favoriteIdentity } from "./favoriteIdentity";

export default function CollectionsPage() {
  const { collectionId } = useParams();
  const navigate = useNavigate();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [nameDialog, setNameDialog] = useState(null);
  const [name, setName] = useState("");
  const [actionId, setActionId] = useState(null);
  const [showWord, setShowWord] = useState(
    () => localStorage.getItem("show-word") !== "false",
  );
  const [showTranslation, setShowTranslation] = useState(
    () => localStorage.getItem("show-translation") !== "false",
  );
  const actionsRef = useRef(null);

  const load = useCallback(async ({ signal, rethrow = false } = {}) => {
    setLoading(true);
    setLoadError("");
    try {
      setCollections(await queryCollections({ signal }));
    } catch (requestError) {
      if (requestError.name === "AbortError") {
        return;
      }
      setLoadError(requestError.message);
      if (rethrow) {
        throw requestError;
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load({ signal: controller.signal });
    return () => controller.abort();
  }, [load]);
  useEffect(() => localStorage.setItem("show-word", showWord), [showWord]);
  useEffect(
    () => localStorage.setItem("show-translation", showTranslation),
    [showTranslation],
  );
  useEffect(() => {
    if (actionId == null) {
      return undefined;
    }
    const close = (event) => {
      if (!actionsRef.current?.contains(event.target)) {
        setActionId(null);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [actionId]);

  const selectedCollection = useMemo(
    () => collections.find((item) => String(item.id) === collectionId),
    [collections, collectionId],
  );

  const saveName = async () => {
    try {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return;
      }
      // 新建对话框没有收藏夹 ID，已有对象则必须执行重命名。
      if (nameDialog === "new") {
        await createCollection(trimmedName);
      } else {
        await renameCollection(nameDialog.id, trimmedName);
      }
      setNameDialog(null);
      setName("");
      await load({ rethrow: true });
      notify(nameDialog === "new" ? "收藏夹已创建" : "收藏夹名称已更新");
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const deleteCollection = (item) => {
    setActionId(null);
    Dialog.confirm({
      title: "删除收藏夹？",
      content: `“${item.name}”中的收藏关系将被永久删除。`,
      onOk: async () => {
        try {
          await requestDeleteCollection(item.id);
          setCollections((current) =>
            current.filter((collection) => collection.id !== item.id),
          );
          notify("收藏夹已删除");
        } catch (error) {
          notify(error.message, "error");
          throw error;
        }
      },
    });
  };

  if (loading && collections.length === 0) {
    return <div className="page-state">正在加载收藏夹…</div>;
  }
  if (loadError) {
    return (
      <div className="page-state error-state">
        <p>收藏夹加载失败：{loadError}</p>
        <Button onClick={() => load()}>重试</Button>
      </div>
    );
  }

  if (collectionId) {
    if (!selectedCollection) {
      return collections.length ? (
        <div className="page-state error-state">收藏夹不存在</div>
      ) : null;
    }
    const favorites = selectedCollection.favorites.filter((item) => item.card);
    const favoriteIdentities = new Set(
      selectedCollection.favorites.map((item) =>
        favoriteIdentity(item.recordId, item.wordKey),
      ),
    );
    return (
      <section className="content-width detail-page collection-detail-page">
        <nav className="breadcrumbs collection-breadcrumbs">
          <Link to="/favorites">我的收藏夹</Link>
          <span>/</span>
          <span>{selectedCollection.name}</span>
        </nav>
        <header className="collection-detail-header">
          <div>
            <p className="eyebrow">MY WORDS</p>
            <h1>{selectedCollection.name}</h1>
            <p>
              {selectedCollection.isDefault ? "默认收藏夹 · " : ""}
              {selectedCollection._count.favorites} 个词汇
            </p>
          </div>
          <Button onClick={() => navigate("/favorites")}>返回收藏夹</Button>
        </header>
        <div className="word-toolbar collection-word-toolbar">
          <div className="visibility-controls">
            <Checkbox checked={showWord} onChange={setShowWord}>
              显示词汇
            </Checkbox>
            <Checkbox checked={showTranslation} onChange={setShowTranslation}>
              显示翻译
            </Checkbox>
          </div>
          <span className="result-count">{favorites.length} 个词汇</span>
        </div>
        {favorites.length ? (
          <div className="word-list">
            {favorites.map((favorite) => (
              <WordCard
                key={favorite.id}
                card={favorite.card}
                recordId={favorite.recordId}
                showWord={showWord}
                showTranslation={showTranslation}
                defaultCollection={selectedCollection}
                favoriteIdentities={favoriteIdentities}
                favoriteCollectionLabel={selectedCollection.name}
                onFavoriteChange={(identity, value) => {
                  if (!value) {
                    setCollections((current) =>
                      current.map((collection) =>
                        collection.id === selectedCollection.id
                          ? {
                              ...collection,
                              favorites: collection.favorites.filter(
                                (item) =>
                                  favoriteIdentity(
                                    item.recordId,
                                    item.wordKey,
                                  ) !== identity,
                              ),
                              _count: {
                                favorites: Math.max(
                                  0,
                                  collection._count.favorites - 1,
                                ),
                              },
                            }
                          : collection,
                      ),
                    );
                  }
                }}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state compact">
            <div>☆</div>
            <h3>这个收藏夹还没有词汇</h3>
            <p>浏览词汇时点击星标即可添加。</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="content-width collections-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">MY WORDS</p>
          <h1>我的收藏夹</h1>
          <p>按收藏夹整理需要反复复习的词汇。</p>
        </div>
        <Button
          type="primary"
          onClick={() => {
            setNameDialog("new");
            setName("");
          }}
        >
          新建收藏夹
        </Button>
      </div>
      <div className="collection-grid">
        {collections.map((item) => (
          <article
            className="collection-card"
            key={item.id}
            role="link"
            tabIndex={0}
            onClick={() => navigate(`/favorites/${item.id}`)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate(`/favorites/${item.id}`);
              }
            }}
          >
            <header>
              <div>
                <span>{item.isDefault ? "★ 默认收藏夹" : "收藏夹"}</span>
                <h2>{item.name}</h2>
              </div>
              <div
                className="collection-card-actions"
                ref={actionId === item.id ? actionsRef : null}
              >
                <button
                  type="button"
                  className="collection-more"
                  aria-label={`管理${item.name}`}
                  aria-expanded={actionId === item.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    setActionId((current) =>
                      current === item.id ? null : item.id,
                    );
                  }}
                >
                  •••
                </button>
                {actionId === item.id && (
                  <div
                    className="collection-action-popup"
                    role="menu"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      role="menuitem"
                      onClick={() => {
                        setNameDialog(item);
                        setName(item.name);
                        setActionId(null);
                      }}
                    >
                      修改名称
                    </button>
                    {!item.isDefault && (
                      <button
                        role="menuitem"
                        className="danger"
                        onClick={() => deleteCollection(item)}
                      >
                        删除收藏夹
                      </button>
                    )}
                  </div>
                )}
              </div>
            </header>
            <div className="collection-count">
              <strong>{item._count.favorites}</strong>
              <span>个词汇</span>
            </div>
            <footer>点击查看词汇 →</footer>
          </article>
        ))}
      </div>
      <Dialog
        visible={Boolean(nameDialog)}
        title={nameDialog === "new" ? "新建收藏夹" : "修改收藏夹名称"}
        onOk={saveName}
        onCancel={() => setNameDialog(null)}
        onClose={() => setNameDialog(null)}
      >
        <Input
          value={name}
          onChange={setName}
          placeholder="收藏夹名称"
          maxLength={100}
        />
      </Dialog>
    </section>
  );
}
