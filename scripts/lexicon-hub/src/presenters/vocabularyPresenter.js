function normalizeWebUrl(value, defaultProtocol = "http:") {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${defaultProtocol}//${url.replace(/^\/+/, "")}`;
}

function createOwnedImageDisplayUrl(word) {
  const configuredBaseUrl = normalizeWebUrl(process.env.QINIU_PUBLIC_BASE_URL);
  if (configuredBaseUrl && word.ownedImageObjectKey) {
    return `${configuredBaseUrl.replace(/\/$/, "")}/${word.ownedImageObjectKey
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
  }
  return normalizeWebUrl(word.ownedImageUrl);
}

function summarizeWord(word) {
  const pronunciations = word.pronunciations.map((link) => link.pronunciation);
  return {
    ...word,
    ownedImageDisplayUrl: createOwnedImageDisplayUrl(word),
    pronunciations,
    hasPhonetic: pronunciations.length > 0,
    hasAudio: pronunciations.some((item) =>
      item.audio.some((audio) => audio.status === "published"),
    ),
  };
}

function groupProgressByLevel(progress) {
  const levels = new Map();
  for (const item of progress) {
    if (!levels.has(item.level)) {
      levels.set(item.level, {
        level: item.level,
        total: 0,
        withImage: 0,
        withPhonetic: 0,
        withAudio: 0,
        categories: 0,
      });
    }
    const summary = levels.get(item.level);
    summary.total += item.total;
    summary.withImage += item.with_image;
    summary.withPhonetic += item.with_phonetic;
    summary.withAudio += item.with_audio;
    summary.categories += 1;
  }
  return [...levels.values()];
}

function readFilters(query, pageSize, overrides = {}) {
  return {
    level: overrides.level || query.level || "",
    categoryRecordId: overrides.categoryRecordId || query.category || "",
    keyword: query.keyword || "",
    page: Math.max(1, Number(query.page || 1)),
    pageSize,
  };
}

function createPageData(result, filters) {
  return {
    filters,
    categories: result.categories,
    total: result.total,
    pages: Math.max(1, Math.ceil(result.total / filters.pageSize)),
    words: result.items.map(summarizeWord),
  };
}

module.exports = {
  createOwnedImageDisplayUrl,
  createPageData,
  groupProgressByLevel,
  normalizeWebUrl,
  readFilters,
};
