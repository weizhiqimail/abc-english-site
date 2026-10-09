import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get } from "../../services/api";

const levelInfo = {
  A1: ["入门", "从日常生活中最基础的表达开始"],
  A2: ["基础", "扩展常见场景和实用表达"],
  B1: ["中级", "独立表达观点和处理熟悉话题"],
  B2: ["中高级", "理解更复杂的主题与表达"],
  C1: ["高级", "掌握精确、灵活的高级表达"],
  C2: ["精通", "接近母语者的词汇深度"],
};

export default function VocabularyHome() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    get("/overview")
      .then(setOverview)
      .catch((e) => setError(e.message));
  }, []);
  if (error) {
    return <div className="page-state error-state">{error}</div>;
  }
  if (!overview) {
    return null;
  }
  return (
    <section className="content-width level-section vocabulary-level-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">CHOOSE YOUR LEVEL</p>
          <h2>选择你的词汇等级</h2>
        </div>
        <p>每个等级都由精心整理的主题组成</p>
      </div>
      <div className="level-grid">
        {overview.levels.map((item) => (
          <button
            key={item.level}
            onClick={() => navigate(`/vocabulary/${item.level.toLowerCase()}`)}
            className={`level-card level-${item.level.toLowerCase()}`}
          >
            <span className="level-badge">{item.level}</span>
            <div>
              <strong>{levelInfo[item.level][0]}</strong>
              <p>{levelInfo[item.level][1]}</p>
            </div>
            <footer>
              {item.available ? (
                <>
                  <span>{item.categoryCount} 个主题</span>
                  <span>{item.wordCount} 词 →</span>
                </>
              ) : (
                <span>数据准备中 →</span>
              )}
            </footer>
          </button>
        ))}
      </div>
    </section>
  );
}
