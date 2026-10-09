const crypto = require("node:crypto");
const { Readable } = require("node:stream");

function createLexiconEnrichmentService({
  repository,
  phonetic,
  getTts,
  getStorage,
  bucket,
  logger,
}) {
  const log = logger.child({ component: "lexicon-enrichment" });
  async function enrichWord(wordId) {
    const startedAt = Date.now();
    log.info("enrichment.started", { wordId });
    const word = await repository.getWord(wordId);
    if (!word) throw new Error("词汇不存在");
    log.info("phonetic.resolve.started", {
      wordId,
      word: word.word,
      partOfSpeech: word.partOfSpeechType,
    });
    const resolved = await phonetic.resolveOne({
      word: word.word,
      partOfSpeech: word.partOfSpeechType,
    });
    log.info("phonetic.resolve.completed", {
      wordId,
      normalizedWord: resolved.normalizedWord,
      candidates: resolved.candidates,
    });
    if (!resolved.candidates.length) {
      log.warn("enrichment.waiting-source", {
        wordId,
        durationMs: Date.now() - startedAt,
      });
      return {
        wordId: word.id,
        status: "waiting_source",
        message: "没有匹配到有授权的音标来源",
      };
    }
    const assets = [];
    // 外部付费服务延迟到用户点击补全时初始化，缺少凭据不影响状态页面启动。
    const tts = getTts();
    const storage = getStorage();
    for (const candidate of resolved.candidates) {
      if (!candidate.locale || !candidate.ipa) continue;
      const pronunciation = await repository.savePronunciation(word.id, {
        ...candidate,
        normalizedWord: resolved.normalizedWord,
      });
      const synthesisRequest = {
        entityType: "pronunciation",
        entityId: pronunciation.id,
        text: word.word,
        locale: candidate.locale,
      };
      log.info("google-tts.synthesis.started", {
        wordId,
        pronunciationId: pronunciation.id,
        request: synthesisRequest,
      });
      const synthesis = await tts.synthesize({
        ...synthesisRequest,
      });
      log.info("google-tts.synthesis.completed", {
        wordId,
        pronunciationId: pronunciation.id,
        provider: synthesis.provider,
        request: synthesis.request,
        fingerprint: synthesis.fingerprint,
        byteSize: synthesis.byteSize,
        mimeType: synthesis.mimeType,
      });
      const existing = await repository.findPublishedAudio(
        pronunciation.id,
        synthesis.fingerprint,
      );
      if (existing?.status === "published") {
        log.info("qiniu.audio-upload.skipped", {
          wordId,
          pronunciationId: pronunciation.id,
          reason: "matching-fingerprint-already-published",
          existing,
        });
        assets.push(existing);
        continue;
      }
      const shard = crypto
        .createHash("sha256")
        .update(resolved.normalizedWord)
        .digest("hex")
        .slice(0, 2);
      const key = `abc-english/tts/pronunciations/v1/${candidate.locale}/${shard}/${pronunciation.id}/${synthesis.fingerprint}.mp3`;
      log.info("qiniu.audio-upload.started", {
        wordId,
        pronunciationId: pronunciation.id,
        objectKey: key,
        byteSize: synthesis.byteSize,
        mimeType: synthesis.mimeType,
        overwrite: true,
      });
      const upload = await storage.uploadStream({
        objectKey: key,
        stream: Readable.from(synthesis.audio),
        size: synthesis.byteSize,
        mimeType: synthesis.mimeType,
        overwrite: true,
      });
      log.info("qiniu.audio-upload.completed", {
        wordId,
        pronunciationId: pronunciation.id,
        upload,
      });
      assets.push(
        await repository.publishAudio(pronunciation, synthesis, upload, bucket),
      );
    }
    const result = {
      wordId: word.id,
      status: "completed",
      candidates: resolved.candidates.length,
      assets,
    };
    log.info("enrichment.completed", {
      ...result,
      durationMs: Date.now() - startedAt,
    });
    return result;
  }
  return { enrichWord };
}

module.exports = { createLexiconEnrichmentService };
