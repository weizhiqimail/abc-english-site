const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const ejs = require("ejs");
const {
  createOwnedImageDisplayUrl,
  normalizeWebUrl,
} = require("../src/presenters/vocabularyPresenter");

const viewsRoot = path.join(__dirname, "../src/views");
const base = {
  activeSection: "vocabulary",
  activeVocabularyPage: "levels",
};
const progress = [
  {
    level: "A1",
    record_id: "category-1",
    title: "基础",
    total: 1,
    with_image: 0,
    with_phonetic: 0,
    with_audio: 0,
  },
];
const list = {
  filters: {
    level: "",
    categoryRecordId: "",
    keyword: "",
    page: 1,
  },
  categories: [{ level: "A1", recordId: "category-1", title: "基础" }],
  total: 1,
  pages: 1,
  words: [
    {
      id: 1,
      word: "apple",
      partOfSpeechType: "noun",
      category: { level: "A1", title: "基础" },
      photoUrl: null,
      photoThumbnailUrl: null,
      ownedImageUrl: null,
      ownedImageObjectKey: null,
      ownedImageStatus: "pending",
      ownedImageError: null,
      hasPhonetic: false,
      hasAudio: false,
      pronunciations: [],
    },
  ],
};

async function render(view, data) {
  return ejs.renderFile(path.join(viewsRoot, view), data);
}

test("all management pages render", async () => {
  const pages = await Promise.all([
    render("vocabulary/levels.ejs", {
      ...base,
      levels: [
        {
          level: "A1",
          categories: 1,
          total: 1,
          withImage: 0,
          withPhonetic: 0,
          withAudio: 0,
        },
      ],
    }),
    render("vocabulary/categories.ejs", {
      ...base,
      activeVocabularyPage: "categories",
      selectedLevel: "A1",
      progress,
    }),
    render("vocabulary/words.ejs", {
      ...base,
      activeVocabularyPage: "words",
      ...list,
    }),
    render("operations/index.ejs", {
      ...base,
      activeSection: "operations",
      activeVocabularyPage: "",
      ...list,
    }),
    render("tasks/index.ejs", {
      ...base,
      activeSection: "tasks",
      activeVocabularyPage: "",
      levels: [
        {
          level: "A1",
          total: 2000,
          withImage: 0,
          withPhonetic: 0,
          withAudio: 0,
          categories: 10,
        },
      ],
      taskTypes: [{ value: "qiniu-image-sync", label: "词汇图片同步到七牛云" }],
    }),
  ]);

  pages.forEach((html) => assert.match(html, /Lexicon Hub/));
  assert.match(pages[3], /上传所选图片到七牛/);
  assert.match(pages[3], /选择本分类全部词汇/);
  assert.doesNotMatch(pages[3], /全部等级|全部分类/);
  assert.match(pages[4], /每批处理数量/);
  assert.match(pages[4], /忽略已同步词汇/);
  assert.match(pages[4], /2000 个词汇/);
  assert.doesNotMatch(pages[4], /word-select|选择本分类全部词汇/);
});

test("owned images render with HTTP or HTTPS and repair historical forced HTTPS URLs", () => {
  const previousBaseUrl = process.env.QINIU_PUBLIC_BASE_URL;
  try {
    assert.equal(
      normalizeWebUrl("http://cdn.example.com/a.jpg"),
      "http://cdn.example.com/a.jpg",
    );
    assert.equal(
      normalizeWebUrl("https://cdn.example.com/a.jpg"),
      "https://cdn.example.com/a.jpg",
    );
    process.env.QINIU_PUBLIC_BASE_URL = "cdn.example.com";
    assert.equal(
      createOwnedImageDisplayUrl({
        ownedImageUrl: "https://cdn.example.com/old.jpg",
        ownedImageObjectKey: "images/current image.jpg",
      }),
      "http://cdn.example.com/images/current%20image.jpg",
    );
  } finally {
    if (previousBaseUrl === undefined) {
      delete process.env.QINIU_PUBLIC_BASE_URL;
    } else {
      process.env.QINIU_PUBLIC_BASE_URL = previousBaseUrl;
    }
  }
});
