#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const inputFile = path.join(scriptDir, "input", "未分组单词.xml");
const outputDir = path.join(scriptDir, "output");
const outputFile = path.join(outputDir, "未分组单词-清理.xml");
const reportFile = path.join(outputDir, "未分组单词-删除清单.txt");

// 明确不需要进入生词本的入门级词汇。这里只列确定性较高的词，避免误删短但生僻的词。
const basicWords = new Set(
  `
  a an the this that these those
  i me my mine you your yours he him his she her hers it its we us our ours they them their theirs
  who what when where why how which
  am is are was were be been being do does did done have has had
  can could may might must shall should will would
  and or but if so because as than then
  in on at to for from of by with about into over under up down out off
  not no yes all any some many much more most few less
  one two three first last next
  good bad big small long short old new young high low
  go come get give take make put keep let say tell ask know think see look hear feel want need like love
  eat drink sleep read write speak work play run walk sit stand live die
  man woman boy girl child children people person friend family home house school book day night time year
`
    .trim()
    .split(/\s+/),
);

function decodeXml(value) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function getWord(item) {
  const match = item.match(/<word(?:\s[^>]*)?>([\s\S]*?)<\/word>/i);
  if (!match) return "";
  return decodeXml(
    match[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim(),
  );
}

function removalReason(word) {
  const normalized = word.trim().toLocaleLowerCase("en");
  if (!normalized) return "空词条";
  if (/[\u3400-\u9fff]/u.test(normalized)) return "含汉字";
  if (/^[a-z]{1,2}$/i.test(normalized)) return "一至两个字母";
  if (basicWords.has(normalized)) return "基础词";
  return "";
}

const xml = await readFile(inputFile, "utf8");
const rootMatch = xml.match(
  /^([\s\S]*?<wordbook(?:\s[^>]*)?>)([\s\S]*)(<\/wordbook>[\s\S]*)$/i,
);
if (!rootMatch)
  throw new Error(`无法识别 XML 的 <wordbook> 根节点：${inputFile}`);

const kept = [];
const removed = [];
for (const match of rootMatch[2].matchAll(/\s*<item>([\s\S]*?)<\/item>\s*/gi)) {
  const itemXml = `<item>${match[1]}</item>`;
  const word = getWord(itemXml);
  const reason = removalReason(word);
  if (reason) removed.push({ word, reason });
  else kept.push(itemXml);
}

const result = `${rootMatch[1]}\n${kept.map((item) => `  ${item}`).join("\n")}\n${rootMatch[3]}`;
const report = [
  `原始词条：${kept.length + removed.length}`,
  `保留词条：${kept.length}`,
  `删除词条：${removed.length}`,
  "",
  ...removed.map(({ word, reason }) => `[${reason}] ${word}`),
].join("\n");

await mkdir(outputDir, { recursive: true });
await writeFile(outputFile, result, "utf8");
await writeFile(reportFile, `${report}\n`, "utf8");
console.log(`Kept ${kept.length}; removed ${removed.length}: ${outputFile}`);
