/** 顺序调用多个来源，保留来源信息并去除完全相同的候选音标。 */
function createCompositePhoneticProvider(providers) {
  return {
    name: "composite",
    async resolve(input) {
      const settled = await Promise.allSettled(
        providers.map((provider) => provider.resolve(input)),
      );
      const candidates = [];
      const warnings = [];
      settled.forEach((result, index) => {
        if (result.status === "rejected") {
          warnings.push({
            provider: providers[index].name,
            error: result.reason.message,
          });
          return;
        }
        for (const item of result.value) {
          candidates.push({
            ...item,
            sourceProvider: item.sourceProvider || providers[index].name,
          });
        }
      });
      const unique = [
        ...new Map(
          candidates.map((item) => [
            `${item.locale}|${item.ipa}|${item.partOfSpeech || ""}|${item.sourceProvider}`,
            item,
          ]),
        ).values(),
      ];
      return { candidates: unique, warnings };
    },
  };
}

module.exports = { createCompositePhoneticProvider };
