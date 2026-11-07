#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(scriptDir, "output");
const listFile = path.join(outputDir, "l1-l2-l3-词汇列表.md");
const wordbookTextFile = path.join(outputDir, "单词本里的词汇.txt");
const outputFile = path.join(outputDir, "l1-l2-l3-单词本缺少词汇.xml");

function decodeText(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString("utf16le");
  }
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

function parseVocabularyList(markdown) {
  const entries = [];
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|$/);
    if (!match) continue;
    entries.push({
      number: Number(match[1]),
      word: match[2].trim(),
      meaning: match[3].trim(),
    });
  }
  return entries;
}

function parseWordbookWords(text) {
  const words = new Set();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(
      /^\s*\d+\s*,\s*(.*?)\s+(?:\[[^\]]*\]\s*)?英译中\s*$/,
    );
    if (!match) continue;
    const word = match[1]
      .trim()
      .replace(/\s+\[[^\]]*\]$/, "")
      .trim();
    words.add(word.toLocaleLowerCase("en"));
  }
  return words;
}

function xmlText(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function cdata(value) {
  return `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function render(entries) {
  const items = entries.map(
    ({ word, meaning }) => `  <item>
    <word>${xmlText(word)}</word>
    <trans>${cdata(meaning)}</trans>
    <phonetic><![CDATA[]]></phonetic>
    <lanfrom><![CDATA[en]]></lanfrom>
    <lanto><![CDATA[zh-CHS]]></lanto>
    <tags>2026年10月英语</tags>
    <progress>1</progress>
  </item>`,
  );
  return `<wordbook>\n${items.join("\n")}\n</wordbook>\n`;
}

const list = parseVocabularyList(await readFile(listFile, "utf8"));
const existingWords = parseWordbookWords(
  decodeText(await readFile(wordbookTextFile)),
);
if (existingWords.size === 0) {
  throw new Error("No vocabulary entries were parsed from 单词本里的词汇.txt");
}
const missing = list.filter(
  ({ word }) => !existingWords.has(word.toLocaleLowerCase("en")),
);

await writeFile(outputFile, render(missing), "utf8");
console.log(`Generated ${missing.length} entries: ${outputFile}`);
