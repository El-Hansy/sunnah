/* ============================================================
   sw.js  —  Service Worker
   ------------------------------------------------------------
   بيخلّي الموقع يشتغل من غير نت: القصص والصلاة والأذكار والسور
   كلها بتفضل شغّالة. الفيديوهات لأ طبعًا — دي من يوتيوب.

   الاستراتيجية: الشبكة الأول، والكاش لو مفيش نت.
   كده أي تعديل في data/*.js بيظهر على طول وانت أونلاين،
   وبرضه الموقع بيفتح وانت في العربية أو الطيارة.

   مهم: لما تعدّل أي ملف، غيّر VERSION تحت — ده بيخلّي
   المتصفّح يرمي الكاش القديم ويجيب الجديد.
   ============================================================ */

const VERSION = "sunnah-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/css/styles.css",
  "./assets/js/store.js",
  "./assets/js/app.js",
  "./data/config.js",
  "./data/videos.js",
  "./data/manners.js",
  "./data/prayer.js",
  "./data/adhkar.js",
  "./data/surahs.js",
  "./assets/icons/icon-180.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/favicon-32.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      /* addAll بيفشل كله لو ملف واحد فشل — فبنضيف كل واحد لوحده */
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;

  /* بنتعامل بس مع طلبات GET من نفس الموقع.
     يوتيوب وجوجل فونتس بيعدّوا زي ما هما. */
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        /* نحدّث الكاش بالنسخة الجديدة */
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        /* مفيش نت: هات من الكاش، ولو صفحة مش موجودة رجّع الرئيسية */
        caches.match(req).then((hit) =>
          hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined)
        )
      )
  );
});
