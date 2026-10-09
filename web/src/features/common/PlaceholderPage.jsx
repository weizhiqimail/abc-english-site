export default function PlaceholderPage({ title }) {
  return (
    <section className="content-width placeholder-page">
      <div className="placeholder-icon">✦</div>
      <p className="eyebrow">ABC English</p>
      <h1>{title}</h1>
      <p>这个模块正在精心准备中。</p>
      <a href="/vocabulary" className="text-link">
        先去学习词汇 →
      </a>
    </section>
  );
}
