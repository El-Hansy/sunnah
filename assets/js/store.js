/* ============================================================
   store.js  —  كل حاجة بتتحفظ في المتصفّح نفسه (localStorage)
   ------------------------------------------------------------
   مفيش سيرفر ومفيش حساب ومفيش بيانات بتطلع برّه الجهاز خالص.
   لو مسحت بيانات المتصفّح، المتابعة والنجوم بيضيعوا — وبس.
   ============================================================ */
(function () {
  "use strict";

  var KEY = "sunnah.v1";
  var mem = null; /* نسخة في الذاكرة لو localStorage مقفول */

  function blank() {
    return {
      profiles: null,      /* null = استخدم الافتراضي من config.js */
      current: null,
      theme: null,         /* null = اتبع النظام */
      prayers: {},         /* {profileId: {"2026-10-02": {fajr:1,...}}} */
      stars: {},           /* {profileId: {key:1}} */
      watched: {},         /* {profileId: {videoId: count}} */
      steps: {},           /* {profileId: {wudu:{1:1}, salah:{...}}} */
      seenManners: {}      /* {profileId: {mannerId:1}} */
    };
  }

  function read() {
    if (mem) return mem;
    try {
      var raw = localStorage.getItem(KEY);
      mem = raw ? Object.assign(blank(), JSON.parse(raw)) : blank();
    } catch (e) {
      mem = blank();
    }
    return mem;
  }

  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(mem)); }
    catch (e) { /* وضع التصفّح الخاص — نكمّل في الذاكرة بس */ }
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function dayBefore(iso, n) {
    var p = iso.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() - n);
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function nest(obj, k) { if (!obj[k]) obj[k] = {}; return obj[k]; }

  var Store = {

    today: today,

    /* ---------- البروفايلات ---------- */
    profiles: function () {
      var s = read();
      if (s.profiles && s.profiles.length) return s.profiles;
      return (window.Sunnah.defaultProfiles || []).map(function (p) {
        return Object.assign({}, p);
      });
    },
    setProfiles: function (list) {
      var s = read();
      s.profiles = list;
      if (s.current && !list.some(function (p) { return p.id === s.current; })) {
        s.current = list.length ? list[0].id : null;
      }
      write();
    },
    current: function () {
      var s = read(), list = Store.profiles();
      if (s.current) {
        var found = list.filter(function (p) { return p.id === s.current; })[0];
        if (found) return found;
      }
      return null;
    },
    setCurrent: function (id) { var s = read(); s.current = id; write(); },

    /* ---------- الثيم ---------- */
    theme: function () { return read().theme; },
    setTheme: function (t) { var s = read(); s.theme = t; write(); },

    /* ---------- متابعة الصلاة ---------- */
    prayerDay: function (pid, iso) {
      var s = read();
      return (s.prayers[pid] || {})[iso || today()] || {};
    },
    togglePrayer: function (pid, prayerId) {
      var s = read();
      var day = nest(nest(s.prayers, pid), today());
      if (day[prayerId]) { delete day[prayerId]; } else { day[prayerId] = 1; }
      write();
      return !!day[prayerId];
    },
    /* عدد الأيام المتصلة اللي صلّى فيها كل الصلوات الخمس */
    streak: function (pid) {
      var s = read(), log = s.prayers[pid] || {}, n = 0, iso = today();
      var total = (window.Sunnah.prayer.prayers || []).length;
      /* لو النهاردة لسه مكمّلش، نبدأ العد من إمبارح */
      if (Object.keys(log[iso] || {}).length < total) iso = dayBefore(iso, 1);
      while (Object.keys(log[iso] || {}).length >= total) {
        n++;
        iso = dayBefore(iso, 1);
        if (n > 999) break;
      }
      return n;
    },

    /* ---------- النجوم ---------- */
    stars: function (pid) { return Object.keys(read().stars[pid] || {}).length; },
    hasStar: function (pid, key) { return !!(read().stars[pid] || {})[key]; },
    addStar: function (pid, key) {
      var s = read(), bag = nest(s.stars, pid);
      if (bag[key]) return false;
      bag[key] = 1; write(); return true;
    },

    /* ---------- الفيديوهات اللي اتفرّج عليها ---------- */
    markWatched: function (pid, vid) {
      var s = read(), bag = nest(s.watched, pid);
      bag[vid] = (bag[vid] || 0) + 1; write();
    },
    isWatched: function (pid, vid) { return !!(read().watched[pid] || {})[vid]; },
    watchedCount: function (pid) { return Object.keys(read().watched[pid] || {}).length; },

    /* ---------- خطوات الوضوء/الصلاة ---------- */
    stepsDone: function (pid, kind) { return (read().steps[pid] || {})[kind] || {}; },
    toggleStep: function (pid, kind, n) {
      var s = read(), bag = nest(nest(s.steps, pid), kind);
      if (bag[n]) { delete bag[n]; } else { bag[n] = 1; }
      write(); return !!bag[n];
    },
    resetSteps: function (pid, kind) {
      var s = read(); nest(s.steps, pid)[kind] = {}; write();
    },

    /* ---------- المواقف اللي قراها ---------- */
    markManner: function (pid, id) {
      var s = read(); nest(s.seenManners, pid)[id] = 1; write();
    },
    isMannerSeen: function (pid, id) { return !!(read().seenManners[pid] || {})[id]; },

    /* ---------- تصفير ---------- */
    resetProgress: function (pid) {
      var s = read();
      delete s.prayers[pid]; delete s.stars[pid];
      delete s.watched[pid]; delete s.steps[pid];
      delete s.seenManners[pid];
      write();
    },
    resetAll: function () { mem = blank(); write(); }
  };

  window.Sunnah = window.Sunnah || {};
  window.Sunnah.Store = Store;
})();
