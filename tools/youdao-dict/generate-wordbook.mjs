#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const inputDir = path.resolve(scriptDir, "input");
const outputDir = path.resolve(scriptDir, "output");
const sourceFiles = process.argv.slice(2).length
  ? process.argv.slice(2).map((file) => path.resolve(file))
  : ["l1.md", "l2.md", "l3.md"].map((file) => path.join(inputDir, file));
const exampleFile = path.join(inputDir, "example.xml");
const outputFile = path.join(outputDir, "l1l2l3.xml");

function decodeXml(value) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function elementText(item, tag) {
  const match = item.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"),
  );
  if (!match) return "";
  return decodeXml(
    match[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim(),
  );
}

function parseExample(xml) {
  const entries = new Map();
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const item = match[1];
    const word = elementText(item, "word");
    if (!word) continue;
    entries.set(word.toLocaleLowerCase("en"), {
      word,
      trans: elementText(item, "trans"),
      phonetic: elementText(item, "phonetic"),
      lanfrom: elementText(item, "lanfrom") || "en",
      lanto: elementText(item, "lanto") || "zh-CHS",
      tags: elementText(item, "tags") || "英语",
      progress: elementText(item, "progress") || "1",
    });
  }
  return entries;
}

function cleanMarkdown(value) {
  return value
    .replace(/\\([\\`*_[\]{}()#+.!-])/g, "$1")
    .replace(/\*\*|__|`/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .trim();
}

function extractEntries(markdown) {
  const entries = [];
  for (const line of markdown.split(/\r?\n/)) {
    const bullet = line.match(/^\s*[-*+]\s+(.+?)\s*[：:]\s*(.+?)\s*$/);
    if (!bullet) continue;

    const word = cleanMarkdown(bullet[1]);
    const trans = cleanMarkdown(bullet[2]);
    if (
      !word ||
      !trans ||
      /[\u3400-\u9fff]/u.test(word) ||
      !/[a-z]/i.test(word) ||
      /[=→←+\/]/.test(word) ||
      /^-|-$/.test(word) ||
      word.length > 80
    ) {
      continue;
    }

    entries.push({ word: word.replace(/\s+/g, " "), trans });
  }
  return entries;
}

function cdata(value) {
  return `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function xmlText(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function render(entries) {
  const items = entries.map(
    (entry) => `  <item>
    <word>${xmlText(entry.word)}</word>
    <trans>${cdata(entry.trans)}</trans>
    <phonetic>${cdata(entry.phonetic)}</phonetic>
    <lanfrom>${cdata(entry.lanfrom)}</lanfrom>
    <lanto>${cdata(entry.lanto)}</lanto>
    <tags>${xmlText(entry.tags)}</tags>
    <progress>${xmlText(entry.progress)}</progress>
  </item>`,
  );
  return `<wordbook>\n${items.join("\n")}\n</wordbook>\n`;
}

const exampleEntries = parseExample(await readFile(exampleFile, "utf8"));
const defaults = exampleEntries.values().next().value ?? {
  phonetic: "",
  lanfrom: "en",
  lanto: "zh-CHS",
  tags: "英语",
  progress: "1",
};
const result = [];
const seen = new Set();

for (const sourceFile of sourceFiles) {
  const markdown = await readFile(sourceFile, "utf8");
  for (const extracted of extractEntries(markdown)) {
    const key = extracted.word.toLocaleLowerCase("en");
    if (seen.has(key) || exampleEntries.has(key)) continue;
    seen.add(key);

    result.push({
      ...defaults,
      word: extracted.word,
      trans: extracted.trans,
      progress: "1",
    });
  }
}

await mkdir(outputDir, { recursive: true });
await writeFile(outputFile, render(result), "utf8");
console.log(`Generated ${result.length} entries: ${outputFile}`);
