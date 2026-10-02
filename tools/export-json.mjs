/* ============================================================
   tools/export-json.mjs
   ------------------------------------------------------------
   بيحوّل ملفات data/*.js لـ JSON نضيف في data/export/
   عشان تستهلكه من تطبيق موبايل (Swift / Kotlin / React Native)
   من غير ما تعيد كتابة المحتوى تاني.

   الاستخدام:   node tools/export-json.mjs
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, "..", "data");
const outDir  = join(dataDir, "export");

/* نشغّل ملفات البيانات في sandbox فيه window بس */
const sandbox = { window: {} };
vm.createContext(sandbox);

const files = readdirSync(dataDir).filter(f => f.endsWith(".js")).sort();
for (const f of files) {
  vm.runInContext(readFileSync(join(dataDir, f), "utf8"), sandbox, { filename: f });
}

const S = sandbox.window.Sunnah;
if (!S) { console.error("مفيش window.Sunnah — شوف ملفات data/"); process.exit(1); }

mkdirSync(outDir, { recursive: true });

const bundles = {
  "videos.json":  S.videos,
  "manners.json": S.manners,
  "prayer.json":  S.prayer,
  "adhkar.json":  { groups: S.adhkarGroups, items: S.adhkar },
  "surahs.json":  { surahs: S.surahs, extra: S.extraVerses },
  "config.json":  { config: S.config, sections: S.sections, topics: S.topics,
                    defaultProfiles: S.defaultProfiles }
};

let total = 0;
for (const [name, payload] of Object.entries(bundles)) {
  const json = JSON.stringify(payload, null, 2);
  writeFileSync(join(outDir, name), json + "\n", "utf8");
  const n = Array.isArray(payload) ? payload.length : Object.keys(payload).length;
  total += json.length;
  console.log(`  ✓ ${name.padEnd(14)} ${String(n).padStart(3)} عنصر   ${(json.length/1024).toFixed(1)} ك.ب`);
}

/* ملف واحد يجمع كل حاجة — أسهل للتطبيق */
const all = JSON.stringify({
  config: S.config, sections: S.sections, topics: S.topics,
  defaultProfiles: S.defaultProfiles, videos: S.videos, manners: S.manners,
  prayer: S.prayer, adhkarGroups: S.adhkarGroups, adhkar: S.adhkar,
  surahs: S.surahs, extraVerses: S.extraVerses,
  generatedAt: new Date().toISOString()
}, null, 2);
writeFileSync(join(outDir, "all.json"), all + "\n", "utf8");
console.log(`  ✓ all.json       الكل معاً      ${(all.length/1024).toFixed(1)} ك.ب`);
console.log(`\nاتكتبوا في: ${outDir}`);
