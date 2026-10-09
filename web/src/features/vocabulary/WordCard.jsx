import { Button, Dialog, Message } from "@alifd/next";
import { useState } from "react";
import Markdown from "react-markdown";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { post, remove } from "../../services/api";

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
  favoriteKeys,
  onFavoriteChange,
}) {
  // 每个字段分别记录临时显示状态，点击某一项不会影响同卡片的其他内容。
  const [revealedWord, setRevealedWord] = useState(false);
  const [revealedTranslation, setRevealedTranslation] = useState(false);
  const [revealedOtherTranslation, setRevealedOtherTranslation] =
    useState(false);
  const [revealedExamples, setRevealedExamples] = useState(() => new Set());
  const [imageOpen, setImageOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [showAllExamples, setShowAllExamples] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const wordKey =
    card.wordEntryId != null
      ? String(card.wordEntryId)
      : `translation:${card.translationId}`;
  const favorite = favoriteKeys?.has(wordKey);
  const examples = card.examples || [];
  const visibleExamples = showAllExamples ? examples : examples.slice(0, 2);
  const revealExample = (exampleKey) => {
    setRevealedExamples((current) => new Set(current).add(exampleKey));
  };

  const toggleFavorite = async () => {
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
      if (favorite) {
        await remove(
          `/collections/${defaultCollection.id}/favorites/${encodeURIComponent(wordKey)}`,
        );
      } else {
        await post(`/collections/${defaultCollection.id}/favorites`, {
          recordId,
          wordKey,
        });
      }
      onFavoriteChange?.(wordKey, !favorite);
    } catch (error) {
      Message.error(error.message);
    }
  };
  const pos = card.partOfSpeech;
  const grammar = pos?.grammaticalInformation || {};
  const grammarItems = [
    ["词性", pos?.partOfSpeechType],
    ["复数", grammar.pluralForm],
    ["构词", grammar.composition],
    [
      "可数",
      grammar.isCountable == null ? null : grammar.isCountable ? "是" : "否",
    ],
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
                {showWord || revealedWord ? (
                  card.word
                ) : (
                  <Placeholder onClick={() => setRevealedWord(true)} />
                )}
              </h3>
              <span className="translation">
                {showTranslation || revealedTranslation ? (
                  card.localizedDefinition
                ) : (
                  <Placeholder onClick={() => setRevealedTranslation(true)} />
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
            {showTranslation || revealedOtherTranslation ? (
              card.localizedOtherTranslations
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
                {showTranslation || revealedExamples.has(exampleKey) ? (
                  <Markdown>
                    {example.localizedProperties?.example || ""}
                  </Markdown>
                ) : (
                  <Placeholder onClick={() => revealExample(exampleKey)} />
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
