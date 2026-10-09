const crypto = require("node:crypto");

/** 生成稳定请求指纹，重复任务可在调用 Google 前直接命中已有资产。 */
function createRequestFingerprint(request) {
  const stable = JSON.stringify({
    version: 1,
    text: request.text || null,
    ssml: request.ssml || null,
    locale: request.locale,
    voiceName: request.voiceName,
    audioEncoding: request.audioEncoding,
    speakingRate: request.speakingRate,
    pitch: request.pitch,
  });
  return crypto.createHash("sha256").update(stable).digest("hex");
}

module.exports = { createRequestFingerprint };
