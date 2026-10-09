const DEFAULT_VOICES = {
  "en-US": "en-US-Standard-C",
  "en-GB": "en-GB-Standard-A",
};

/** 合并调用参数与环境变量；具体 voice 始终固定，避免批次间随机变化。 */
function loadTtsConfig(overrides = {}) {
  return {
    provider: overrides.provider || process.env.TTS_PROVIDER || "google",
    voices: {
      "en-US": process.env.GOOGLE_TTS_VOICE_EN_US || DEFAULT_VOICES["en-US"],
      "en-GB": process.env.GOOGLE_TTS_VOICE_EN_GB || DEFAULT_VOICES["en-GB"],
      ...overrides.voices,
    },
    audioEncoding: overrides.audioEncoding || "MP3",
    speakingRate: overrides.speakingRate ?? 1,
    pitch: overrides.pitch ?? 0,
    concurrency: Math.max(1, Number(overrides.concurrency || 5)),
  };
}

module.exports = { loadTtsConfig };
