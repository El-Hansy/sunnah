/* ============================================================
   app.js  —  الراوتر وكل الصفحات
   ------------------------------------------------------------
   الموقع كله صفحة واحدة، والتنقّل بيحصل بالهاش (#/...).
   كل صفحة دالة بترجّع HTML، والأحداث متوصّلة بالتفويض
   (delegation) من الـ document — فمفيش listeners بتتكرّر.
   ============================================================ */
(function () {
  "use strict";

  var S     = window.Sunnah;
  var Store = S.Store;
  var root, topbarSlot;

  /* ========== 1. أدوات مساعدة ========== */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* مدى السن: «٤–٩» بتتقلب بصريًا في النص العربي (مشكلة bidi)
     فبنستخدم كلمة «إلى» — بتثبّت الترتيب صح. */
  function ageText(a, b) { return num(a) + " إلى " + num(b) + " سنة"; }

  /* أرقام عربية-هندية للعيال */
  var AR_D = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];
  function num(n) {
    return String(n).replace(/\d/g, function (d) { return AR_D[+d]; });
  }

  function go(hash) { location.hash = hash; }

  function topic(id)   { return S.topics.filter(function (t) { return t.id === id; })[0]; }
  function section(id) { return S.sections.filter(function (x) { return x.id === id; })[0]; }
  function video(id)   { return S.videos.filter(function (v) { return v.id === id; })[0]; }
  function manner(id)  { return S.manners.filter(function (m) { return m.id === id; })[0]; }
  function surah(id)   { return S.surahs.filter(function (x) { return x.id === id; })[0]; }

  /* فلترة بالسن — مع إمكانية إلغاء الفلتر */
  var showAllAges = false;
  function fitsAge(item, age) {
    if (showAllAges || age == null) return true;
    var lo = item.ageMin == null ? 0  : item.ageMin;
    var hi = item.ageMax == null ? 99 : item.ageMax;
    return age >= lo && age <= hi;
  }

  function videosFor(topicId, age) {
    return S.videos.filter(function (v) {
      return v.topic === topicId && fitsAge(v, age);
    });
  }

  function thumb(id) { return "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg"; }

  function embed(id) {
    /* الدومين بيتحدّد من data/config.js :
         "account" → www.youtube.com  (بيشوف إنك مسجّل دخول،
                     فالـPremium بيشيل الإعلانات)
         "privacy" → youtube-nocookie (مفيش كوكيز، بس إعلانات)
       rel=0 يقلّل المقترحات · modestbranding يصغّر اللوجو
       iv_load_policy=3 يقفل الكروت اللي بتطلع فوق الفيديو */
    var host = S.config.player === "privacy"
      ? "https://www.youtube-nocookie.com"
      : "https://www.youtube.com";
    return host + "/embed/" + id +
           "?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3";
  }

  /* موقف النهاردة — بيلف على المواقف بالتاريخ */
  function mannerOfDay() {
    var d = new Date();
    var doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    return S.manners[doy % S.manners.length];
  }

  /* ---------- قفل أوضة الأب والأم ----------
     سؤال ضرب بسيط على الكبير وصعب على الصغير. مش حماية حقيقية —
     ده بس عشان الولد مايدخلش بالغلط ويدوس «امسح كل البيانات».
     بيتحفظ في sessionStorage: يتحل مرة ويفضل مفتوح لحد قفل المتصفّح. */
  var GATE_KEY = "sunnah.parentUnlocked";
  var gateUnlockedMem = false;   /* احتياطي لو sessionStorage مقفول */
  var gateQ = null;              /* السؤال الحالي */
  var gateErr = "";              /* رسالة الغلط */

  function gateOn() { return S.config.parentGate !== false; }

  function gateUnlocked() {
    if (gateUnlockedMem) return true;
    try { return sessionStorage.getItem(GATE_KEY) === "1"; }
    catch (e) { return false; }
  }

  function gateUnlock() {
    gateUnlockedMem = true;
    try { sessionStorage.setItem(GATE_KEY, "1"); } catch (e) {}
  }

  function newGateQ() {
    /* رقمين × رقم: النتيجة بين ٧٢ و١٧١ — الكبير بيحلّها في ثانية،
       وابن ٩ سنين لسه مابيعملش ضرب عشري في دماغه */
    var a = 12 + Math.floor(Math.random() * 8);  /* 12..19 */
    var b = 6  + Math.floor(Math.random() * 4);  /* 6..9   */
    gateQ = { a: a, b: b, ans: a * b };
    return gateQ;
  }

  /* الأرقام العربية-الهندية (٠١٢) للأرقام العادية (012)،
     عشان الإجابة تتقبل بأي كيبورد */
  function toLatinDigits(str) {
    return String(str || "")
      .replace(/[\u0660-\u0669]/g, function (d) { return d.charCodeAt(0) - 0x0660; })
      .replace(/[\u06F0-\u06F9]/g, function (d) { return d.charCodeAt(0) - 0x06F0; })
      .trim();
  }

  function gatePage() {
    var q = gateQ || newGateQ();
    return '<div class="gate anim">' +
      '<div class="gate__lock">🔒</div>' +
      '<h2>أوضة الأب والأم</h2>' +
      '<p>الصفحة دي للكبار. جاوب على السؤال وادخل.</p>' +
      /* <bdi> بيعزل كل رقم لوحده، فعلامة الضرب بتاخد اتجاه
         الحاوية (ltr) بدل ما تتقلب — الأرقام العربية-الهندية
         كلاسها RTL فالـdir لوحده مش بيكفي */
      '<div class="gate__q" dir="ltr">' +
        '<bdi>' + num(q.a) + '</bdi> × <bdi>' + num(q.b) + '</bdi> = ?' +
      '</div>' +
      '<form class="gate__form" data-act="gatecheck">' +
        '<input id="gateans" type="text" inputmode="numeric" autocomplete="off" ' +
          'aria-label="الإجابة" placeholder="الإجابة">' +
        '<button class="btn" type="submit">ادخل</button>' +
      '</form>' +
      (gateErr ? '<div class="gate__err">' + esc(gateErr) + '</div>' : '') +
      '<a class="gate__back" href="#/">← رجوع للرئيسية</a>' +
    '</div>';
  }

  /* ========== 2. مكوّنات متكرّرة ========== */

  function crumbs(parts) {
    return '<nav class="crumbs">' + parts.map(function (p, i) {
      var last = i === parts.length - 1;
      var bit = last
        ? '<b>' + esc(p.t) + '</b>'
        : '<a href="' + esc(p.h) + '">' + esc(p.t) + '</a>';
      return (i ? '<span>‹</span>' : '') + bit;
    }).join("") + '</nav>';
  }

  function vcardHTML(v, pid) {
    var seen = pid && Store.isWatched(pid, v.id);
    return '' +
      '<a class="vcard" href="#/v/' + esc(v.id) + '">' +
        '<div class="vcard__thumb">' +
          '<img loading="lazy" src="' + esc(thumb(v.id)) + '" alt="">' +
          '<div class="vcard__play"><span>▶</span></div>' +
        '</div>' +
        '<div class="vcard__body">' +
          '<div class="vcard__title">' + esc(v.title) + '</div>' +
          '<div class="vcard__ch">📺 <span>' + esc(v.channel) + '</span></div>' +
          '<div class="vcard__tags">' +
            '<span class="tag tag--' + (v.lang === "en" ? "en" : "ar") + '">' +
              (v.lang === "en" ? "إنجليزي" : "عربي") + '</span>' +
            '<span class="tag">' + ageText(v.ageMin, v.ageMax) + '</span>' +
            (v.questions ? '<span class="tag tag--q">فيه أسئلة</span>' : '') +
            (seen ? '<span class="tag tag--star">✓ اتفرّجت</span>' : '') +
          '</div>' +
        '</div>' +
      '</a>';
  }

  function proofHTML(p) {
    if (!p) return "";
    return '' +
      '<div class="proof">' +
        '<div class="proof__kind">' + (p.kind === "ayah" ? "آية" : "حديث") + '</div>' +
        '<div class="proof__q">' +
          (p.kind === "ayah" ? "﴿" : "«") + esc(p.text) + (p.kind === "ayah" ? "﴾" : "»") +
        '</div>' +
        '<div class="proof__s">' + esc(p.source) + '</div>' +
      '</div>';
  }

  function qaHTML(questions, starKey) {
    if (!questions || !questions.length) return "";
    return '' +
      '<div class="qa" data-star="' + esc(starKey || "") + '">' +
        '<div class="qa__hd">' +
          '<h3>🧠 اسأل نفسك</h3>' +
          '<p>فكّر في الإجابة الأول… وبعدين افتحها وشوف.</p>' +
        '</div>' +
        questions.map(function (q) {
          return '<details><summary>' + esc(q.q) + '</summary>' +
                 '<div class="qa__a">' + esc(q.a) + '</div></details>';
        }).join("") +
      '</div>';
  }

  function emptyHTML(msg, hint) {
    return '<div class="empty"><div class="empty__ic">🔍</div>' +
      '<h3>' + esc(msg) + '</h3>' +
      (hint ? '<p>' + esc(hint) + '</p>' : '') +
      '<div class="btnrow" style="justify-content:center;margin-top:16px">' +
      '<button class="btn btn--ghost btn--sm" data-act="allages">شوف كل الأعمار</button></div></div>';
  }

  /* ========== 3. الهيدر ========== */

  function renderTopbar() {
    var p = Store.current();
    var themeIcon = document.documentElement.getAttribute("data-theme") === "dark" ? "☀️" : "🌙";
    topbarSlot.innerHTML = '' +
      '<div class="topbar__in">' +
        '<a class="brand" href="#/">' +
          '<span class="brand__mark">🕌</span>' +
          '<span class="brand__name">' + esc(S.config.siteName) + '</span>' +
        '</a>' +
        '<div class="topbar__sp"></div>' +
        (p
          ? '<a class="whochip" href="#/who">' +
              '<span class="whochip__av">' + esc(p.emoji) + '</span>' +
              '<span>' + esc(p.name) + '</span>' +
              '<span class="whochip__age">' + num(p.age) + ' سنة</span>' +
            '</a>'
          : '<a class="whochip" href="#/who"><span class="whochip__av">👋</span><span>مين بيتفرج؟</span></a>') +
        '<button class="iconbtn" data-act="theme" title="تغيير الإضاءة" aria-label="تغيير الإضاءة">' + themeIcon + '</button>' +
        '<a class="iconbtn" href="#/parent" title="أوضة الأب والأم" aria-label="أوضة الأب والأم">👨‍👩‍👧</a>' +
      '</div>';
  }

  /* ========== 4. الصفحات ========== */
  var Pages = {};

  /* ---------- الرئيسية ---------- */
  Pages.home = function () {
    var p = Store.current();
    var mod = mannerOfDay();
    var stars = p ? Store.stars(p.id) : 0;
    var streak = p ? Store.streak(p.id) : 0;

    var hi = p
      ? "أهلاً يا " + p.name + " " + p.emoji
      : S.config.siteName;

    var h = '<div class="hero anim">' +
      '<h1>' + esc(hi) + '</h1>' +
      '<p>' + esc(S.config.tagline) + '</p>' +
      (p ? '<div class="btnrow" style="margin-top:18px">' +
            '<span class="tag tag--star" style="font-size:14px;padding:7px 14px">⭐ ' + num(stars) + ' نجمة</span>' +
            (streak ? '<span class="tag tag--q" style="font-size:14px;padding:7px 14px">🔥 ' + num(streak) + ' يوم صلاة كاملة</span>' : '') +
           '</div>' : '') +
      '</div>';

    /* موقف النهاردة */
    h += '<div class="shead"><h2>موقف النهاردة</h2>' +
         '<p>موقف واحد كل يوم — اقروه مع بعض، مش أكتر من ٥ دقايق.</p></div>' +
      '<a class="card bigcard t-' + esc(mod.color) + ' anim" href="#/m/' + esc(mod.id) + '">' +
        '<div class="card__ico">' + esc(mod.emoji) + '</div>' +
        '<h2>' + esc(mod.title) + '</h2>' +
        '<div class="card__sub">' + esc(mod.situation) + '</div>' +
        '<div class="card__meta">📖 قصة · 🧠 ' + num(mod.questions.length) + ' أسئلة · 🎬 ' +
          num(mod.videos.length) + ' فيديو</div>' +
      '</a>';

    /* القسمين */
    h += '<div class="shead"><h2>تحب تدخل فين؟</h2></div><div class="grid grid--2">';
    S.sections.forEach(function (sec) {
      var n = S.videos.filter(function (v) {
        return v.section === sec.id && (!p || fitsAge(v, p.age));
      }).length;
      h += '<a class="card bigcard t-' + esc(sec.color) + '" href="#/s/' + esc(sec.id) + '">' +
        '<div class="card__ico">' + esc(sec.emoji) + '</div>' +
        '<h2>' + esc(sec.name) + '</h2>' +
        '<div class="card__sub">' + esc(sec.tagline) + '</div>' +
        '<div class="card__meta">🎬 ' + num(n) + ' فيديو' +
          (p ? ' مناسبين لسن ' + num(p.age) : '') + '</div>' +
      '</a>';
    });
    h += '</div>';

    /* وصول سريع */
    h += '<div class="shead"><h2>وصول سريع</h2></div><div class="grid grid--3">' +
      quick("🕌", "الصلاة والوضوء", "خطوة بخطوة + جدول متابعة", "#/prayer", "emerald") +
      quick("🤝", "كل المواقف", num(S.manners.length) + " موقف من الحياة", "#/manners", "teal") +
      quick("🤲", "أذكار وأدعية", num(S.adhkar.length) + " دعاء لكل وقت", "#/adhkar", "violet") +
      quick("📖", "سور قصيرة", num(S.surahs.length) + " سورة بالنص والصوت", "#/quran", "amber") +
      '</div>';

    return h;
  };

  function quick(ic, t, sub, href, color) {
    return '<a class="card t-' + color + '" href="' + href + '">' +
      '<div class="card__ico">' + ic + '</div>' +
      '<h3>' + esc(t) + '</h3>' +
      '<div class="card__sub">' + esc(sub) + '</div></a>';
  }

  /* ---------- مين بيتفرج ---------- */
  Pages.who = function () {
    var cur = Store.current();
    var h = crumbs([{ t: "الرئيسية", h: "#/" }, { t: "مين بيتفرج؟" }]) +
      '<div class="shead"><span class="eyebrow">👋 اختار نفسك</span>' +
      '<h2>مين بيتفرج دلوقتي؟</h2>' +
      '<p>الموقع بيعرض المحتوى المناسب للسن، وبيحفظ متابعة كل واحد لوحده.</p></div>' +
      '<div class="who">';
    Store.profiles().forEach(function (p) {
      h += '<button class="whocard t-' + esc(p.color) + '" data-act="pick" data-id="' + esc(p.id) + '"' +
        (cur && cur.id === p.id ? ' aria-pressed="true"' : '') + '>' +
        '<div class="whocard__av">' + esc(p.emoji) + '</div>' +
        '<b>' + esc(p.name) + '</b>' +
        '<small>' + num(p.age) + ' سنة · ⭐ ' + num(Store.stars(p.id)) + '</small>' +
      '</button>';
    });
    h += '</div>' +
      '<div class="note note--parent" style="margin-top:24px">' +
      '<h4>👨‍👩‍👧 عايز تغيّر الأسماء والأعمار؟</h4>' +
      '<p>من <a href="#/parent">أوضة الأب والأم</a> — أو من ملف <code>data/config.js</code>.</p></div>';
    return h;
  };

  /* ---------- قسم (ديني / تعليمي) ---------- */
  Pages.section = function (id) {
    var sec = section(id);
    if (!sec) return notFound();
    var p = Store.current(), age = p ? p.age : null;

    var h = crumbs([{ t: "الرئيسية", h: "#/" }, { t: sec.name }]) +
      '<div class="hero anim" style="padding:28px"><h1>' + esc(sec.emoji) + ' ' + esc(sec.name) + '</h1>' +
      '<p>' + esc(sec.tagline) + '</p></div>';

    if (p) h += ageChips(age);

    h += '<div class="grid grid--2">';
    S.topics.filter(function (t) { return t.section === id; }).forEach(function (t) {
      var n = videosFor(t.id, age).length;
      var href = "#/t/" + t.id;
      /* المواضيع اللي ليها صفحة خاصة */
      if (t.id === "akhlaq") href = "#/manners";
      if (t.id === "salah")  href = "#/prayer";
      if (t.id === "adhkar") href = "#/adhkar";
      if (t.id === "quran")  href = "#/quran";
      h += '<a class="card t-' + esc(t.color) + '" href="' + href + '">' +
        '<div class="card__ico">' + esc(t.emoji) + '</div>' +
        '<h3>' + esc(t.name) + '</h3>' +
        '<div class="card__sub">' + esc(t.blurb) + '</div>' +
        '<div class="card__meta">🎬 ' + num(n) + ' فيديو</div>' +
      '</a>';
    });
    h += '</div>';
    return h;
  };

  function ageChips(age) {
    return '<div class="chips">' +
      '<button class="chip" data-act="allages" aria-pressed="' + (showAllAges ? "true" : "false") + '">' +
        (showAllAges ? "👨‍👩‍👧 كل الأعمار" : "🎯 مناسب لسن " + num(age)) +
      '</button>' +
      '<a class="chip" href="#/who">🔄 غيّر مين بيتفرج</a>' +
    '</div>';
  }

  /* ---------- موضوع = قائمة فيديوهات ---------- */
  Pages.topic = function (id) {
    var t = topic(id);
    if (!t) return notFound();
    var p = Store.current(), age = p ? p.age : null;
    var list = videosFor(id, age);
    var sec = section(t.section);

    var h = crumbs([
        { t: "الرئيسية", h: "#/" },
        { t: sec.name, h: "#/s/" + sec.id },
        { t: t.name }
      ]) +
      '<div class="shead"><span class="eyebrow">' + esc(t.emoji) + ' ' + esc(sec.name) + '</span>' +
      '<h2>' + esc(t.name) + '</h2><p>' + esc(t.blurb) + '</p></div>';

    if (p) h += ageChips(age);

    if (!list.length) {
      h += emptyHTML("مفيش فيديوهات مناسبة لسن " + num(age) + " هنا",
                     "جرّب تشوف كل الأعمار، أو زوّد فيديوهات من tools/add-video.html");
      return h;
    }

    /* المميّز الأول */
    list.sort(function (a, b) {
      return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a.ageMin - b.ageMin;
    });

    h += '<div class="grid grid--v">' +
      list.map(function (v) { return vcardHTML(v, p && p.id); }).join("") +
      '</div>';
    return h;
  };

  /* ---------- مشغّل الفيديو ---------- */
  Pages.watch = function (id) {
    var v = video(id);
    if (!v) return notFound();
    var p = Store.current();
    var t = topic(v.topic), sec = section(v.section);
    if (p) Store.markWatched(p.id, v.id);

    var h = crumbs([
        { t: "الرئيسية", h: "#/" },
        { t: sec.name, h: "#/s/" + sec.id },
        { t: t.name, h: (t.id === "akhlaq" ? "#/manners" : "#/t/" + t.id) },
        { t: v.title }
      ]) +
      '<div class="player anim"><iframe src="' + esc(embed(v.id)) + '" title="' + esc(v.title) + '" ' +
        'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
        'allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>' +
      '<div class="player__note">' +
        '<span>📺 ' + esc(v.channel) + '</span><span>·</span>' +
        '<span>' + ageText(v.ageMin, v.ageMax) + '</span>' +
        '<a class="btn btn--ghost btn--sm" style="margin-inline-start:auto" ' +
          'href="https://www.youtube.com/watch?v=' + esc(v.id) + '" target="_blank" rel="noopener" ' +
          'title="لو الإعلانات بتظهر هنا، افتحه في يوتيوب — هناك اشتراك Premium بيشتغل دايمًا">' +
          'افتح في يوتيوب ↗</a>' +
      '</div>' +
      '<div class="shead"><h2>' + esc(v.title) + '</h2></div>';

    if (v.questions) {
      h += qaHTML(v.questions, "q:" + v.id);
      h += '<div class="btnrow" style="margin-top:16px">' +
           '<button class="btn btn--gold" data-act="star" data-key="q:' + esc(v.id) + '">⭐ خلّصت الأسئلة</button></div>';
    } else {
      h += '<div class="note note--gold"><h4>💡 فكرة للأب والأم</h4>' +
           '<p>بعد الفيديو اسأله سؤالين بكلامك: «إيه أحلى حاجة في الفيديو؟» و«إيه اللي هتعمله بسببه؟» — ' +
           'السؤال بيحوّل التفرّج لتعلّم.</p></div>';
    }

    /* فيديوهات تانية في نفس الموضوع */
    var more = videosFor(v.topic, p ? p.age : null)
      .filter(function (x) { return x.id !== v.id; }).slice(0, 8);
    if (more.length) {
      h += '<div class="shead"><h2>كمان في نفس الموضوع</h2></div>' +
        '<div class="grid grid--v">' +
        more.map(function (x) { return vcardHTML(x, p && p.id); }).join("") + '</div>';
    }
    return h;
  };

  /* ---------- كل المواقف ---------- */
  Pages.manners = function () {
    var p = Store.current(), age = p ? p.age : null;
    var list = S.manners.filter(function (m) { return fitsAge(m, age); });

    var h = crumbs([{ t: "الرئيسية", h: "#/" }, { t: "مواقف وأخلاق" }]) +
      '<div class="shead"><span class="eyebrow">🤝 أخلاق</span><h2>مواقف بتحصل كل يوم</h2>' +
      '<p>كل موقف فيه قصة قصيرة، وآية أو حديث، وأسئلة، وحاجة تعملها بإيدك — ' +
      'وفي الآخر كلام للأب والأم.</p></div>';

    if (p) h += ageChips(age);

    if (!list.length) return h + emptyHTML("مفيش مواقف مناسبة للسن ده");

    h += '<div class="grid grid--wide">';
    list.forEach(function (m) {
      var seen = p && Store.isMannerSeen(p.id, m.id);
      h += '<a class="card t-' + esc(m.color) + '" href="#/m/' + esc(m.id) + '">' +
        '<div class="card__ico">' + esc(m.emoji) + '</div>' +
        '<h3>' + esc(m.title) + '</h3>' +
        '<div class="card__sub">' + esc(m.situation) + '</div>' +
        '<div class="card__meta">' +
          '<span class="tag">' + esc(m.subtitle) + '</span>' +
          '<span class="tag">' + ageText(m.ageMin, m.ageMax) + '</span>' +
          (seen ? '<span class="tag tag--star">✓ قريناه</span>' : '') +
        '</div></a>';
    });
    h += '</div>';
    return h;
  };

  /* ---------- موقف واحد ---------- */
  Pages.manner = function (id) {
    var m = manner(id);
    if (!m) return notFound();
    var p = Store.current();
    if (p) Store.markManner(p.id, m.id);

    var h = crumbs([
        { t: "الرئيسية", h: "#/" },
        { t: "مواقف وأخلاق", h: "#/manners" },
        { t: m.title }
      ]) +
      '<div class="hero anim" style="padding:clamp(24px,4vw,40px)">' +
        '<div style="font-size:48px;line-height:1;margin-bottom:12px">' + esc(m.emoji) + '</div>' +
        '<h1>' + esc(m.title) + '</h1>' +
        '<p>' + esc(m.situation) + '</p>' +
      '</div>';

    /* القاعدة في سطر */
    h += '<div class="rule anim"><div class="rule__ic">💡</div><p>' + esc(m.simple) + '</p></div>';

    /* القصة */
    h += '<div class="shead"><h2>القصة</h2><p>اقروها مع بعض بصوت عالي.</p></div>' +
      '<div class="story"><h3>📖 ' + esc(m.story.title) + '</h3>' +
      m.story.body.map(function (x) { return '<p>' + esc(x) + '</p>'; }).join("") +
      '</div>';

    /* الدليل */
    h += '<div class="shead"><h2>وربنا قال إيه؟</h2></div>' +
      '<div class="grid' + (m.proof2 ? ' grid--2' : '') + '">' +
      proofHTML(m.proof) + proofHTML(m.proof2) + '</div>';

    /* الأسئلة */
    h += '<div class="shead"><h2>اسأل نفسك</h2></div>' + qaHTML(m.questions, "m:" + m.id) +
      '<div class="btnrow" style="margin-top:16px">' +
      '<button class="btn btn--gold" data-act="star" data-key="m:' + esc(m.id) + '">⭐ خلّصت الموقف</button></div>';

    /* جرّب كده */
    h += '<div class="shead"><h2>جرّب كده</h2></div>' +
      '<div class="note note--gold"><h4>🎯 حاجات تعملها بإيدك</h4><ul>' +
      m.tryThis.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") +
      '</ul></div>';

    /* فيديوهات */
    var vids = m.videos.map(video).filter(Boolean);
    if (vids.length) {
      h += '<div class="shead"><h2>فيديوهات عن الموضوع</h2></div>' +
        '<div class="grid grid--v">' +
        vids.map(function (v) { return vcardHTML(v, p && p.id); }).join("") + '</div>';
    }

    /* للأب والأم */
    h += '<div class="shead"><h2>للأب والأم</h2>' +
      '<p>الجزء ده مكتوب لك انت، مش للطفل.</p></div>' +
      '<div class="note note--parent"><h4>👨‍👩‍👧 إزاي تتعامل مع الموقف</h4><ul>' +
      m.parent.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") +
      '</ul></div>';

    /* الموقف اللي بعده */
    var i = S.manners.indexOf(m);
    var nx = S.manners[(i + 1) % S.manners.length];
    h += '<div class="btnrow" style="margin-top:28px">' +
      '<a class="btn" href="#/m/' + esc(nx.id) + '">الموقف اللي بعده: ' + esc(nx.title) + ' ←</a>' +
      '<a class="btn btn--ghost" href="#/manners">كل المواقف</a></div>';
    return h;
  };

  /* ---------- الصلاة: الصفحة الرئيسية ---------- */
  Pages.prayer = function () {
    var P = S.prayer;
    var h = crumbs([{ t: "الرئيسية", h: "#/" }, { t: "الصلاة والوضوء" }]) +
      '<div class="hero anim" style="padding:28px"><h1>🕌 الصلاة والوضوء</h1>' +
      '<p>خطوة بخطوة، ومعاها جدول تعلّم عليه كل يوم.</p></div>';

    /* الجدول */
    h += '<div class="shead"><h2>صلوات النهاردة</h2>' +
      '<p>دوس على المربّع بعد كل صلاة.</p></div>' + trackerHTML();

    /* الصلوات الخمس */
    h += '<div class="shead"><h2>الصلوات الخمس</h2></div><div class="grid grid--3">';
    P.prayers.forEach(function (pr) {
      h += '<div class="card t-emerald"><div class="card__ico">' + esc(pr.emoji) + '</div>' +
        '<h3>' + esc(pr.name) + '</h3>' +
        '<div class="card__sub"><b>' + num(pr.rakaat) + ' ركعات</b><br>' + esc(pr.when) + '</div>' +
        '<div class="card__meta">💡 ' + esc(pr.note) + '</div></div>';
    });
    h += '</div>';

    /* خطوات */
    h += '<div class="shead"><h2>اتعلّم خطوة بخطوة</h2></div><div class="grid grid--2">' +
      '<a class="card bigcard t-cyan" href="#/wudu"><div class="card__ico">💧</div>' +
      '<h2>الوضوء</h2><div class="card__sub">' + num(P.wudu.length) + ' خطوة بالترتيب</div></a>' +
      '<a class="card bigcard t-emerald" href="#/salah"><div class="card__ico">🕌</div>' +
      '<h2>الصلاة</h2><div class="card__sub">' + num(P.salah.length) + ' خطوة مع اللي بنقوله في كل واحدة</div></a>' +
      '</div>';

    /* فيديوهات */
    var p = Store.current();
    var vids = videosFor("salah", p ? p.age : null);
    if (vids.length) {
      h += '<div class="shead"><h2>فيديوهات تعليم الصلاة</h2></div>' +
        '<div class="grid grid--v">' + vids.map(function (v) {
          return vcardHTML(v, p && p.id);
        }).join("") + '</div>';
    }

    h += '<div class="shead"><h2>للأب والأم</h2></div>' +
      '<div class="note note--parent"><h4>👨‍👩‍👧 قبل ما تبدأ معاه</h4><ul>' +
      P.parentNotes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") +
      '</ul></div>';
    return h;
  };

  function trackerHTML() {
    var p = Store.current();
    if (!p) {
      return '<div class="empty"><div class="empty__ic">👋</div>' +
        '<h3>اختار مين بيتفرج الأول</h3>' +
        '<p>عشان نحفظ المتابعة لكل واحد لوحده.</p>' +
        '<div class="btnrow" style="justify-content:center;margin-top:16px">' +
        '<a class="btn" href="#/who">اختار</a></div></div>';
    }
    var day = Store.prayerDay(p.id);
    var h = '<div class="tracker">';
    S.prayer.prayers.forEach(function (pr) {
      var on = !!day[pr.id];
      h += '<div class="tracker__row">' +
        '<div class="tracker__name"><span class="tracker__em">' + esc(pr.emoji) + '</span>' +
          '<span><b>' + esc(pr.name) + '</b><small>' + num(pr.rakaat) + ' ركعات</small></span></div>' +
        '<button class="tick" data-act="pray" data-id="' + esc(pr.id) + '" ' +
          'aria-pressed="' + (on ? "true" : "false") + '" ' +
          'aria-label="' + esc(pr.name) + '">✓</button>' +
      '</div>';
    });
    h += '<div class="streak" id="streakbox">' + streakInner(p) + '</div></div>';
    return h;
  }

  /* جوّه خانة الـstreak بس — بنحدّثها لوحدها بعد كل ضغطة
     عشان مانعيدش بناء الجدول كله (ده كان بيضيّع الفوكس والأنيميشن) */
  function streakInner(p) {
    var streak = Store.streak(p.id);
    var doneCount = Object.keys(Store.prayerDay(p.id)).length;
    var total = S.prayer.prayers.length;
    return '<span class="streak__n">' + num(streak) + '</span>' +
      '<span>' + (streak
        ? "يوم ورا التاني كل الصلوات كاملة 🔥"
        : "لسه مفيش يوم كامل — ابدأ النهاردة 💪") + '</span>' +
      '<span style="margin-inline-start:auto" class="stars">النهاردة: <b>' +
        num(doneCount) + ' من ' + num(total) + '</b></span>';
  }

  /* ---------- خطوات الوضوء / الصلاة ---------- */
  function stepsPage(kind) {
    var P = S.prayer;
    var list = kind === "wudu" ? P.wudu : P.salah;
    var tips = kind === "wudu" ? P.wuduTips : P.salahTips;
    var title = kind === "wudu" ? "الوضوء" : "الصلاة";
    var ico = kind === "wudu" ? "💧" : "🕌";
    var p = Store.current();
    var done = p ? Store.stepsDone(p.id, kind) : {};
    var doneN = Object.keys(done).length;

    var h = crumbs([
        { t: "الرئيسية", h: "#/" },
        { t: "الصلاة والوضوء", h: "#/prayer" },
        { t: title }
      ]) +
      '<div class="shead"><span class="eyebrow">' + ico + ' خطوة بخطوة</span>' +
      '<h2>' + esc(title) + '</h2>' +
      '<p>دوس على الخطوة لما تحفظها. (' + num(doneN) + ' من ' + num(list.length) + ')</p></div>';

    h += '<ul class="steps">';
    list.forEach(function (st) {
      var on = !!done[st.n];
      h += '<li class="step' + (on ? " done" : "") + '" data-act="step" data-kind="' + kind +
        '" data-n="' + st.n + '" role="button" tabindex="0" aria-pressed="' + (on ? "true" : "false") + '">' +
        '<div class="step__n">' + esc(st.emoji) + '<b>' + num(st.n) + '</b></div>' +
        '<div class="step__body"><h4>' + esc(st.title) + '</h4>' +
          '<p>' + esc(st.body) + '</p>' +
          (st.say ? '<div class="step__say">' + esc(st.say) + '</div>' : '') +
          (st.times ? '<span class="step__times">' + esc(st.times) + '</span>' : '') +
          (st.optional ? '<span class="step__times" style="background:var(--bg-2);color:var(--ink-3)">مستحبّة — مش لازم</span>' : '') +
        '</div></li>';
    });
    h += '</ul>';

    h += '<div class="btnrow" style="margin-top:20px">' +
      (doneN === list.length
        ? '<button class="btn btn--gold" data-act="star" data-key="steps:' + kind + '">⭐ حفظت كل الخطوات</button>'
        : '') +
      '<button class="btn btn--ghost" data-act="resetsteps" data-kind="' + kind + '">🔄 ابدأ من الأول</button>' +
      '</div>';

    h += '<div class="note note--gold" style="margin-top:24px"><h4>💡 حاجات مهمة</h4><ul>' +
      tips.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></div>';
    return h;
  }
  Pages.wudu  = function () { return stepsPage("wudu"); };
  Pages.salah = function () { return stepsPage("salah"); };

  /* ---------- الأذكار ---------- */
  Pages.adhkar = function () {
    var h = crumbs([{ t: "الرئيسية", h: "#/" }, { t: "أذكار وأدعية" }]) +
      '<div class="hero anim" style="padding:28px"><h1>🤲 أذكار وأدعية</h1>' +
      '<p>' + num(S.adhkar.length) + ' دعاء، كل واحد بمعناه بالبسيط.</p></div>';

    S.adhkarGroups.forEach(function (g) {
      var list = S.adhkar.filter(function (a) { return a.g === g.id; });
      if (!list.length) return;
      h += '<div class="shead"><h2>' + esc(g.emoji) + ' ' + esc(g.name) + '</h2></div>' +
        '<div class="grid grid--wide">';
      list.forEach(function (a) {
        h += '<div class="dhikr">' +
          '<span class="dhikr__when">' + esc(a.t) + '</span>' +
          '<div class="dhikr__ar">' + esc(a.ar) + '</div>' +
          '<div class="dhikr__m">' + esc(a.m) + '</div>' +
          '<div class="dhikr__s">📚 ' + esc(a.s) + '</div>' +
        '</div>';
      });
      h += '</div>';
    });

    var p = Store.current();
    var vids = videosFor("adhkar", p ? p.age : null);
    if (vids.length) {
      h += '<div class="shead"><h2>فيديوهات أذكار</h2></div><div class="grid grid--v">' +
        vids.map(function (v) { return vcardHTML(v, p && p.id); }).join("") + '</div>';
    }
    return h;
  };

  /* ---------- السور ---------- */
  Pages.quran = function () {
    var p = Store.current();
    var h = crumbs([{ t: "الرئيسية", h: "#/" }, { t: "سور قصيرة" }]) +
      '<div class="hero anim" style="padding:28px"><h1>📖 سور قصيرة</h1>' +
      '<p>' + num(S.surahs.length) + ' سورة بالنص والصوت — من الأسهل للأصعب.</p></div>' +
      '<div class="note note--warn"><h4>⚠️ للأب والأم</h4>' +
      '<p>النص مكتوب بعناية، بس قبل التحفيظ راجعه مرة من مصحف مطبوع أو تطبيق مصحف معتمد. ' +
      'حركة واحدة غلط بتعلّق في دماغ الطفل سنين.</p></div>' +
      '<div class="shead"><h2>السور</h2></div><div class="grid grid--3">';

    S.surahs.forEach(function (s) {
      h += '<a class="card t-amber" href="#/q/' + esc(s.id) + '">' +
        '<div class="card__ico">' + num(s.num) + '</div>' +
        '<h3>سورة ' + esc(s.name) + '</h3>' +
        '<div class="card__sub">' + esc(s.about) + '</div>' +
        '<div class="card__meta"><span class="tag">' + num(s.ayat) + ' آيات</span>' +
        '<span class="tag tag--q">' + esc(s.level) + '</span></div></a>';
    });
    h += '</div>';

    (S.extraVerses || []).forEach(function (x) {
      h += '<div class="shead"><h2>كمان</h2></div>' +
        '<a class="card bigcard t-violet" href="#/q/' + esc(x.id) + '">' +
        '<div class="card__ico">✨</div><h2>' + esc(x.name) + '</h2>' +
        '<div class="card__sub">' + esc(x.about) + '</div></a>';
    });

    var vids = videosFor("quran", p ? p.age : null);
    if (vids.length) {
      h += '<div class="shead"><h2>فيديوهات تحفيظ</h2></div><div class="grid grid--v">' +
        vids.map(function (v) { return vcardHTML(v, p && p.id); }).join("") + '</div>';
    }
    return h;
  };

  Pages.surah = function (id) {
    var s = surah(id) || (S.extraVerses || []).filter(function (x) { return x.id === id; })[0];
    if (!s) return notFound();
    var p = Store.current();
    var isSurah = !!s.ayat;

    var h = crumbs([
        { t: "الرئيسية", h: "#/" },
        { t: "سور قصيرة", h: "#/quran" },
        { t: isSurah ? "سورة " + s.name : s.name }
      ]) +
      '<div class="shead"><span class="eyebrow">📖 ' +
        (isSurah ? "سورة رقم " + num(s.num) : esc(s.source || "")) + '</span>' +
      '<h2>' + (isSurah ? "سورة " + esc(s.name) : esc(s.name)) + '</h2>' +
      '<p>' + esc(s.about) + '</p></div>';

    h += '<div class="ayat anim">' +
      (isSurah && s.id !== "fatiha"
        ? '<div class="basmala">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>' : '') +
      s.verses.map(function (v, i) {
        return '<div class="ayah">' + esc(v) +
          (isSurah ? '<span class="ayah__n">' + num(i + 1) + '</span>' : '') + '</div>';
      }).join("") +
      '</div>';

    h += '<div class="shead"><h2>السورة بتقول إيه؟</h2></div>' +
      '<div class="rule"><div class="rule__ic">💡</div><p>' + esc(s.kid) + '</p></div>';

    if (s.audio) {
      var av = video(s.audio);
      h += '<div class="shead"><h2>اسمعها واحفظها</h2></div>' +
        '<div class="player"><iframe src="' + esc(embed(s.audio)) + '" ' +
        'title="تلاوة" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen ' +
        'referrerpolicy="strict-origin-when-cross-origin"></iframe></div>' +
        (av ? '<div class="player__note">📺 ' + esc(av.channel) + '</div>' : '');
    }

    h += '<div class="btnrow" style="margin-top:24px">' +
      '<button class="btn btn--gold" data-act="star" data-key="s:' + esc(s.id) + '">⭐ حفظتها</button>' +
      '<a class="btn btn--ghost" href="#/quran">باقي السور</a></div>';
    return h;
  };

  /* ---------- أوضة الأب والأم ---------- */
  Pages.parent = function () {
    var profiles = Store.profiles();
    var h = crumbs([{ t: "الرئيسية", h: "#/" }, { t: "أوضة الأب والأم" }]) +
      '<div class="hero anim" style="padding:28px"><h1>👨‍👩‍👧 أوضة الأب والأم</h1>' +
      '<p>من هنا بتظبّط الأسماء والأعمار، وتشوف المتابعة، وتعرف تزوّد محتوى.</p></div>';

    /* العيال */
    h += '<div class="shead"><h2>العيال</h2><p>غيّر الاسم أو السن وادوس «احفظ».</p></div>' +
      '<div class="grid grid--2">';
    profiles.forEach(function (p) {
      h += '<div class="card t-' + esc(p.color) + '">' +
        '<div class="card__ico">' + esc(p.emoji) + '</div>' +
        '<div style="display:grid;gap:10px">' +
          '<label style="font-size:14px;font-weight:700">الاسم' +
            '<input data-pf="name" data-id="' + esc(p.id) + '" value="' + esc(p.name) + '" ' +
            'style="width:100%;margin-top:5px;padding:11px 13px;border-radius:12px;border:1.5px solid var(--line);background:var(--surface-2);color:var(--ink);font:inherit"></label>' +
          '<label style="font-size:14px;font-weight:700">السن' +
            '<input data-pf="age" data-id="' + esc(p.id) + '" type="number" min="1" max="18" value="' + esc(p.age) + '" ' +
            'style="width:100%;margin-top:5px;padding:11px 13px;border-radius:12px;border:1.5px solid var(--line);background:var(--surface-2);color:var(--ink);font:inherit"></label>' +
        '</div>' +
        '<div class="card__meta" style="gap:12px">' +
          '<span>⭐ ' + num(Store.stars(p.id)) + ' نجمة</span>' +
          '<span>🎬 ' + num(Store.watchedCount(p.id)) + ' فيديو</span>' +
          '<span>🔥 ' + num(Store.streak(p.id)) + ' يوم</span>' +
        '</div>' +
        '<div class="btnrow" style="margin-top:12px">' +
          '<button class="btn btn--sm" data-act="savepf" data-id="' + esc(p.id) + '">احفظ</button>' +
          '<button class="btn btn--ghost btn--sm" data-act="resetpf" data-id="' + esc(p.id) + '">صفّر المتابعة</button>' +
        '</div></div>';
    });
    h += '</div>';

    /* تزوّد محتوى — سطرين وخلاص */
    h += '<div class="shead"><h2>تزوّد فيديوهات</h2></div>' +
      '<div class="note">' +
      '<p>افتح <a href="tools/add-video.html" target="_blank">أداة إضافة فيديو</a>، ' +
      'الزق لينك اليوتيوب، وخد السطر الجاهز وحطّه في <code>data/videos.js</code>.</p>' +
      '<p style="margin-top:8px;color:var(--ink-2);font-size:14.5px">' +
      '⚠️ اتفرّج على الفيديو الأول. القنوات هنا معروفة بس محدش راجع كل ثانية فيها.</p>' +
      '</div>';

    /* الإعلانات — تشيك ليست قصيرة، التفاصيل في README */
    var acct = S.config.player !== "privacy";
    h += '<div class="shead"><h2>الإعلانات</h2></div>' +
      '<div class="note note--gold">' +
      '<h4>📺 عشان الإعلانات تختفي بـPremium</h4><ul>' +
      '<li>المشغّل على <code>account</code> ' +
        (acct ? '<b style="color:var(--c-emerald)">✓</b>'
              : '<b style="color:var(--c-orange)">✗ دلوقتي على privacy</b>') + '</li>' +
      '<li>جهاز العيال مسجّل دخول بحساب عليه Premium</li>' +
      '<li>افتح من <b>كروم</b> — سفاري وفايرفوكس بيمنعوا الكوكيز فالإعلانات بتظهر</li>' +
      '</ul>' +
      '<p style="margin-top:9px;font-size:14.5px;color:var(--ink-2)">' +
      'ولو الإعلان لسه بيظهر، زرار «افتح في يوتيوب ↗» تحت كل فيديو بيشتغل دايمًا.</p>' +
      '</div>';

    h += '<div class="btnrow" style="margin-top:22px">' +
      '<button class="btn btn--ghost" data-act="resetall">🗑️ امسح كل البيانات</button></div>';
    return h;
  };

  function notFound() {
    return '<div class="empty" style="margin-top:40px"><div class="empty__ic">🤷</div>' +
      '<h3>الصفحة مش موجودة</h3>' +
      '<div class="btnrow" style="justify-content:center;margin-top:16px">' +
      '<a class="btn" href="#/">رجوع للرئيسية</a></div></div>';
  }

  /* ========== 5. الراوتر ========== */

  var ROUTES = [
    [/^\/?$/,              function () { return Pages.home(); }],
    [/^\/who$/,            function () { return Pages.who(); }],
    [/^\/s\/([\w-]+)$/,    function (m) { return Pages.section(m[1]); }],
    [/^\/t\/([\w-]+)$/,    function (m) { return Pages.topic(m[1]); }],
    [/^\/v\/([\w-]+)$/,    function (m) { return Pages.watch(m[1]); }],
    [/^\/manners$/,        function () { return Pages.manners(); }],
    [/^\/m\/([\w-]+)$/,    function (m) { return Pages.manner(m[1]); }],
    [/^\/prayer$/,         function () { return Pages.prayer(); }],
    [/^\/wudu$/,           function () { return Pages.wudu(); }],
    [/^\/salah$/,          function () { return Pages.salah(); }],
    [/^\/adhkar$/,         function () { return Pages.adhkar(); }],
    [/^\/quran$/,          function () { return Pages.quran(); }],
    [/^\/q\/([\w-]+)$/,    function (m) { return Pages.surah(m[1]); }],
    [/^\/parent$/,         function () {
      if (gateOn() && !gateUnlocked()) return gatePage();
      return Pages.parent();
    }]
  ];

  function render() {
    var path = location.hash.replace(/^#/, "") || "/";
    var html = null;
    for (var i = 0; i < ROUTES.length; i++) {
      var m = path.match(ROUTES[i][0]);
      if (m) { html = ROUTES[i][1](m); break; }
    }
    root.innerHTML = html == null ? notFound() : html;
    renderTopbar();
    document.title = (path === "/" ? "" : "") + S.config.siteName +
      " — " + S.config.tagline;
    window.scrollTo(0, 0);
  }

  /* ========== 6. الأحداث (تفويض من الـ document) ========== */

  function toast(msg) {
    var t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = "position:fixed;inset-block-end:22px;inset-inline:0;margin:auto;width:max-content;" +
      "max-width:calc(100% - 32px);background:var(--ink);color:var(--bg);padding:13px 22px;" +
      "border-radius:99px;font-weight:700;z-index:999;box-shadow:var(--sh-3);animation:pop .25s both";
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  function handle(target) {
    var btn = target.closest("[data-act]");
    if (!btn) return false;
    /* زرار الـsubmit بيتعامل معاه حدث submit مش click */
    if (btn.getAttribute("data-act") === "gatecheck" && target.type === "submit") return false;
    var act = btn.getAttribute("data-act");
    var p = Store.current();

    if (act === "theme") {
      var cur = document.documentElement.getAttribute("data-theme");
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      Store.setTheme(next);
      renderTopbar();
      return true;
    }

    if (act === "gatecheck") {
      var inp = document.getElementById("gateans");
      var given = toLatinDigits(inp && inp.value);
      if (given !== "" && parseInt(given, 10) === gateQ.ans) {
        gateUnlock();
        gateErr = "";
        gateQ = null;
        render();
      } else {
        gateErr = given === "" ? "اكتب الإجابة الأول." : "مش مظبوط. جرّب تاني.";
        newGateQ();          /* سؤال جديد في كل محاولة غلط */
        render();
        var again = document.getElementById("gateans");
        if (again) again.focus();
      }
      return true;
    }

    if (act === "pick") {
      Store.setCurrent(btn.getAttribute("data-id"));
      go("#/");
      return true;
    }

    if (act === "allages") {
      showAllAges = !showAllAges;
      render();
      return true;
    }

    if (act === "pray") {
      if (!p) { go("#/who"); return true; }
      var on = Store.togglePrayer(p.id, btn.getAttribute("data-id"));
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      if (on) {
        btn.classList.remove("jump");
        void btn.offsetWidth;
        btn.classList.add("jump");
        var day = Store.prayerDay(p.id);
        if (Object.keys(day).length === S.prayer.prayers.length) {
          Store.addStar(p.id, "day:" + Store.today());
          toast("ما شاء الله! كل الصلوات النهاردة ⭐");
        }
      }
      /* نحدّث خانة الـstreak بس — الزرار نفسه بيفضل موجود */
      var box = document.getElementById("streakbox");
      if (box) box.innerHTML = streakInner(p);
      return true;
    }

    if (act === "step") {
      if (!p) { go("#/who"); return true; }
      var kind = btn.getAttribute("data-kind");
      var n = btn.getAttribute("data-n");
      var onS = Store.toggleStep(p.id, kind, n);
      btn.classList.toggle("done", onS);
      btn.setAttribute("aria-pressed", onS ? "true" : "false");
      var total = (kind === "wudu" ? S.prayer.wudu : S.prayer.salah).length;
      if (Object.keys(Store.stepsDone(p.id, kind)).length === total) {
        toast("برافو! حفظت كل الخطوات 🎉");
        render();
      }
      return true;
    }

    if (act === "resetsteps") {
      if (p) Store.resetSteps(p.id, btn.getAttribute("data-kind"));
      render();
      return true;
    }

    if (act === "star") {
      if (!p) { go("#/who"); return true; }
      var key = btn.getAttribute("data-key");
      if (Store.addStar(p.id, key)) {
        toast("⭐ نجمة جديدة! المجموع " + num(Store.stars(p.id)));
      } else {
        toast("النجمة دي معاك خلاص ⭐");
      }
      renderTopbar();
      return true;
    }

    if (act === "savepf") {
      var id = btn.getAttribute("data-id");
      var nameI = document.querySelector('[data-pf="name"][data-id="' + id + '"]');
      var ageI  = document.querySelector('[data-pf="age"][data-id="' + id + '"]');
      var list = Store.profiles().map(function (x) {
        if (x.id !== id) return x;
        var c = Object.assign({}, x);
        if (nameI && nameI.value.trim()) c.name = nameI.value.trim().slice(0, 24);
        if (ageI) {
          var a = parseInt(ageI.value, 10);
          if (a >= 1 && a <= 18) c.age = a;
        }
        return c;
      });
      Store.setProfiles(list);
      toast("اتحفظ ✓");
      render();
      return true;
    }

    if (act === "resetpf") {
      var rid = btn.getAttribute("data-id");
      if (confirm("تصفير المتابعة والنجوم للطفل ده؟ مش هينفع ترجّعها.")) {
        Store.resetProgress(rid);
        render();
      }
      return true;
    }

    if (act === "resetall") {
      if (confirm("ده هيمسح كل البروفايلات والمتابعة والنجوم لكل العيال. متأكد؟")) {
        Store.resetAll();
        toast("اتمسح كل حاجة");
        go("#/");
        render();
      }
      return true;
    }

    return false;
  }

  /* ========== 7. التشغيل ========== */

  function boot() {
    root = document.getElementById("app");
    topbarSlot = document.getElementById("topbar");

    /* الثيم المحفوظ */
    var t = Store.theme();
    if (t) document.documentElement.setAttribute("data-theme", t);

    document.addEventListener("click", function (e) {
      if (handle(e.target)) e.preventDefault();
    });

    /* فورم القفل: Enter أو الزرار — الاتنين بيبعتوا submit */
    document.addEventListener("submit", function (e) {
      var f = e.target.closest('[data-act="gatecheck"]');
      if (f) { e.preventDefault(); handle(f); }
    });

    /* الخطوات تتفتح بالكيبورد كمان */
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var st = e.target.closest && e.target.closest('[data-act="step"]');
      if (st) { e.preventDefault(); handle(st); }
    });

    window.addEventListener("hashchange", render);
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
