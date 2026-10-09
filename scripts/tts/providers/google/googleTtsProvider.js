/** Google provider 延迟加载官方 SDK，因此测试或使用其他 provider 时不要求 Google 凭据。 */
function createGoogleTtsProvider(options = {}) {
  const TextToSpeechClient =
    options.TextToSpeechClient ||
    require("@google-cloud/text-to-speech").TextToSpeechClient;
  const client =
    options.client || new TextToSpeechClient(options.clientOptions);

  return {
    name: "google-cloud-tts",
    async synthesize(request) {
      const [response] = await client.synthesizeSpeech({
        input: request.ssml ? { ssml: request.ssml } : { text: request.text },
        voice: { languageCode: request.locale, name: request.voiceName },
        audioConfig: {
          audioEncoding: request.audioEncoding,
          speakingRate: request.speakingRate,
          pitch: request.pitch,
        },
      });
      const audio = Buffer.isBuffer(response.audioContent)
        ? response.audioContent
        : Buffer.from(response.audioContent || "", "base64");
      if (!audio.length) throw new Error("Google TTS 返回了空音频");
      return { audio, provider: "google-cloud-tts", mimeType: "audio/mpeg" };
    },
  };
}

module.exports = { createGoogleTtsProvider };
