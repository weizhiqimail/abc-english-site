import { Button, Dialog, Message } from "@alifd/next";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { addFavorite, deleteFavorite } from "../../https/requests/collections";
import { notify } from "../../services/notification";
import { favoriteIdentity } from "../favorites/favoriteIdentity";

const Placeholder = ({ onClick }) => (
  <button type="button" className="masked-text" onClick={onClick}>
    **
  </button>
);

export default function WordCard({
  card,
  recordId,
  showWord,
  showTranslation,
  defaultCollection,
  favoriteCollectionLabel = "默认收藏夹",
  favoriteIdentities,
  onFavoriteChange,
}) {
  // 每个字段分别记录临时显示状态，点击某一项不会影响同卡片的其他内容。
  const [wordVisible, setWordVisible] = useState(showWord);
  const [translationVisible, setTranslationVisible] = useState(showTranslation);
  const [revealedOtherTranslation, setRevealedOtherTranslation] =
    useState(showTranslation);
  const [exampleVisibility, setExampleVisibility] = useState(() => new Map());
  const [imageOpen, setImageOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [showAllExamples, setShowAllExamples] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const wordKey =
    card.wordEntryId != null
      ? String(card.wordEntryId)
      : `translation:${card.translationId}`;
  const identity = favoriteIdentity(recordId, wordKey);
  const favorite = favoriteIdentities?.has(identity);
  const examples = card.examples || [];
  const visibleExamples = showAllExamples ? examples : examples.slice(0, 2);
  useEffect(() => setWordVisible(showWord), [showWord]);
  useEffect(() => {
    setTranslationVisible(showTranslation);
    setRevealedOtherTranslation(showTranslation);
    setExampleVisibility(new Map());
  }, [showTranslation]);

  const exampleIsVisible = (exampleKey) =>
    exampleVisibility.has(exampleKey)
      ? exampleVisibility.get(exampleKey)
      : showTranslation;
  const toggleExample = (exampleKey) =>
    setExampleVisibility((current) => {
      const next = new Map(current);
      next.set(exampleKey, !exampleIsVisible(exampleKey));
      return next;
    });

  const toggleFavorite = async () => {
    // 请求进行中禁止重复提交，避免同一收藏被连续增删。
    if (favoritePending) {
      return;
    }
    if (!user) {
      Message.notice("请先登录后收藏词汇");
      navigate("/login", {
        state: { from: `${location.pathname}${location.search}` },
      });
      return;
    }
    if (!defaultCollection) {
      Message.error("默认收藏夹尚未建立");
      return;
    }
    try {
      setFavoritePending(true);
      if (favorite) {
        await deleteFavorite(defaultCollection.id, wordKey, recordId, {
          globalLoading: false,
        });
      } else {
        await addFavorite(
          defaultCollection.id,
          { recordId, wordKey },
          { globalLoading: false },
        );
      }
      onFavoriteChange?.(identity, !favorite);
      notify(favorite ? "已取消收藏" : `已收藏到“${favoriteCollectionLabel}”`);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setFavoritePending(false);
    }
  };
  const pos = card.partOfSpeech;
  const grammar = pos?.grammaticalInformation || {};
  let countableLabel = null;
  // 只有后端明确给出布尔值时才显示可数性，null 表示数据未知。
  if (typeof grammar.isCountable === "boolean") {
    countableLabel = grammar.isCountable ? "是" : "否";
  }
  const grammarItems = [
    ["词性", pos?.partOfSpeechType],
    ["复数", grammar.pluralForm],
    ["构词", grammar.composition],
    ["可数", countableLabel],
    ["类别", grammar.hypernyms?.join("、")],
  ].filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );
  return (
    <article className="word-card">
      <div className="word-main">
        <div className="word-heading">
          <div>
            <div className="word-and-translation">
              <h3>
                {wordVisible ? (
                  <button
                    type="button"
                    className="visible-text-toggle word-text-toggle"
                    onClick={() => setWordVisible(false)}
                    aria-label="隐藏词汇"
                  >
                    {card.word}
                  </button>
                ) : (
                  <Placeholder onClick={() => setWordVisible(true)} />
                )}
              </h3>
              <span className="translation">
                {translationVisible ? (
                  <button
                    type="button"
                    className="visible-text-toggle translation-text-toggle"
                    onClick={() => setTranslationVisible(false)}
                    aria-label="隐藏翻译"
                  >
                    {card.localizedDefinition}
                  </button>
                ) : (
                  <Placeholder onClick={() => setTranslationVisible(true)} />
                )}
              </span>
            </div>
            {pos?.partOfSpeechType && (
              <span className="pos-chip">{pos.partOfSpeechType}</span>
            )}
          </div>
          <button
            className={`favorite-star ${favorite ? "active" : ""}`}
            aria-label={favorite ? "取消收藏" : "收藏"}
            onClick={toggleFavorite}
            disabled={favoritePending}
          >
            {favorite ? "★" : "☆"}
          </button>
        </div>
        <p className="definition">{card.definition}</p>
      </div>
      <div className="word-image-wrap">
        {card.photo && !imageFailed ? (
          <button
            className="word-image-button"
            onClick={() => setImageOpen(true)}
          >
            <img
              src={card.photo.thumbnailUrl || card.photo.url}
              alt={card.photo.originalTitle || card.word}
              loading="lazy"
              onError={() => setImageFailed(true)}
            />
            <span>点击放大</span>
          </button>
        ) : (
          <div className="image-placeholder">ABC</div>
        )}
      </div>
      <div className="word-details">
        {card.localizedOtherTranslations && (
          <p className="other-translation">
            其他含义：
            {revealedOtherTranslation ? (
              <button
                type="button"
                className="visible-text-toggle"
                onClick={() => setRevealedOtherTranslation(false)}
              >
                {card.localizedOtherTranslations}
              </button>
            ) : (
              <Placeholder onClick={() => setRevealedOtherTranslation(true)} />
            )}
          </p>
        )}
        {grammarItems.length > 0 && (
          <div className="grammar-list">
            {grammarItems.map(([label, value]) => (
              <span key={label}>
                <b>{label}</b>
                {String(value)}
              </span>
            ))}
          </div>
        )}
      </div>
      {/* 原始例句使用 Markdown 强调目标词，因此这里保留 Markdown 渲染。 */}
      <div className="examples">
        {visibleExamples.map((example, index) => {
          const exampleKey = String(example.id ?? index);
          return (
            <div className="example" key={exampleKey}>
              <Markdown>{example.example}</Markdown>
              <div className="example-cn">
                {exampleIsVisible(exampleKey) ? (
                  <button
                    type="button"
                    className="visible-text-toggle example-translation-toggle"
                    onClick={() => toggleExample(exampleKey)}
                  >
                    <Markdown>
                      {example.localizedProperties?.example || ""}
                    </Markdown>
                  </button>
                ) : (
                  <Placeholder onClick={() => toggleExample(exampleKey)} />
                )}
              </div>
            </div>
          );
        })}
        {examples.length > 2 && (
          <button
            type="button"
            className="examples-toggle"
            onClick={() => setShowAllExamples((visible) => !visible)}
          >
            {showAllExamples
              ? "收起例句"
              : `显示更多（还有 ${examples.length - 2} 条）`}
          </button>
        )}
      </div>
      {card.photo && (
        <Dialog
          visible={imageOpen}
          onClose={() => setImageOpen(false)}
          footer={false}
          closeable
          title={card.word}
          className="image-dialog"
        >
          <img
            src={card.photo.url}
            alt={card.photo.originalTitle || card.word}
          />
        </Dialog>
      )}
    </article>
  );
}
