/* GrayDates quiz engine */
(function () {
  "use strict";

  var KEY = "graydates.quiz.v1";
  var ROUND = 20;            // questions per round
  var LETTERS = ["A", "B", "C", "D", "E"];

  /* Choice order is shuffled deterministically from the question's own text, so
     the correct answer is not always in the same slot — but the shuffle is
     identical on every page load, which is what keeps saved answers valid.
     (Edit a question's text and only that question re-shuffles.) */
  function seedFrom(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function balance(q) {
    var seed = seedFrom(q.q), n = q.choices.length;
    var idx = [];
    for (var i = 0; i < n; i++) idx.push(i);
    for (var j = n - 1; j > 0; j--) {                 // seeded Fisher-Yates
      seed = (seed * 1664525 + 1013904223) >>> 0;
      var k = seed % (j + 1);
      var tmp = idx[j]; idx[j] = idx[k]; idx[k] = tmp;
    }
    var choices = [], wrong = {}, answer = 0;
    for (var p = 0; p < n; p++) {
      var from = idx[p];
      choices[p] = q.choices[from];
      if (from === q.answer) answer = p;
      else if (q.wrong && q.wrong[from] !== undefined) wrong[p] = q.wrong[from];
    }
    q.choices = choices; q.answer = answer; q.wrong = wrong;
    return q;
  }

  var GD = {
    topics: [],
    addTopic: function (t) { t.questions.forEach(balance); GD.topics.push(t); },
    get: function (id) {
      for (var i = 0; i < GD.topics.length; i++) if (GD.topics[i].id === id) return GD.topics[i];
      return null;
    }
  };
  window.GD = GD;

  /* ---------------- storage ---------------- */
  var store = (function () {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && p.topics) return p;
      }
    } catch (e) {}
    return { v: 1, topics: {} };
  })();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function newAttempt(topic, keepBest) {
    var idx = [];
    for (var i = 0; i < topic.questions.length; i++) idx.push(i);
    var n = Math.min(ROUND, idx.length);
    return {
      order: shuffle(idx).slice(0, n),
      answers: {},        // position-in-order -> chosen choice index
      cursor: 0,
      elapsed: 0,         // ms spent with the page open on this attempt
      done: false,
      best: keepBest || null
    };
  }

  function state(id, create) {
    var s = store.topics[id];
    if (!s && create) {
      var topic = GD.get(id);
      if (!topic) return null;
      s = newAttempt(topic, null);
      store.topics[id] = s;
      save();
    }
    // guard against data files changing under an old saved attempt
    if (s) {
      var t = GD.get(id);
      if (t) {
        var valid = s.order.every(function (q) { return q < t.questions.length; });
        if (!valid) { s = newAttempt(t, s.best); store.topics[id] = s; save(); }
      }
    }
    return s;
  }

  function answeredCount(s) { return Object.keys(s.answers).length; }

  function tally(topic, s) {
    var ok = 0, bad = 0;
    for (var pos in s.answers) {
      if (!s.answers.hasOwnProperty(pos)) continue;
      var q = topic.questions[s.order[pos]];
      if (s.answers[pos] === q.answer) ok++; else bad++;
    }
    return { ok: ok, bad: bad, total: s.order.length, answered: ok + bad };
  }

  /* ---------------- timer ---------------- */
  var tick = null, tickTopic = null, lastTs = 0, paused = false;

  function startTimer(id) {
    stopTimer();
    tickTopic = id; lastTs = Date.now(); paused = false;
    tick = setInterval(function () {
      var s = state(tickTopic, false);
      if (!s || s.done) { stopTimer(); return; }
      var now = Date.now();
      if (!paused) s.elapsed += now - lastTs;
      lastTs = now;
      var el = document.getElementById("timer");
      if (el) {
        el.textContent = fmt(s.elapsed);
        el.className = paused ? "timer paused" : "timer";
        el.title = paused ? "Paused — tab is in the background" : "Time on this round";
      }
      if (s.elapsed % 5000 < 1100) save();
    }, 1000);
  }
  function stopTimer() {
    if (tick) { clearInterval(tick); tick = null; }
    tickTopic = null; save();
  }
  document.addEventListener("visibilitychange", function () {
    paused = document.hidden;
    lastTs = Date.now();
    if (document.hidden) save();
  });
  window.addEventListener("beforeunload", save);

  function fmt(ms) {
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    return (h ? h + ":" + pad(m) : pad(m)) + ":" + pad(ss);
  }

  /* ---------------- markup helpers ---------------- */
  var WOLF =
    '<svg class="logo" viewBox="0 0 64 64" fill="none" aria-hidden="true">' +
      /* head: two swept-back ears, angular jaw */
      '<path d="M32 60c-11 0-19-9-19-20l-1-8-6-18 15 9c3-2 7-3 11-3s8 1 11 3l15-9-6 18-1 8c0 11-8 20-19 20Z" ' +
        'fill="#161d27" stroke="#5aa2ff" stroke-width="2.2" stroke-linejoin="round"/>' +
      /* muzzle */
      '<path d="M32 60c-4 0-7-3-8-7l8-4 8 4c-1 4-4 7-8 7Z" fill="#0d131b" stroke="#5aa2ff" stroke-width="1.6" stroke-linejoin="round"/>' +
      /* eyes: angled slashes, not circles */
      '<path d="M15 32l11 4-11 3zm34 0L38 36l11 3z" fill="#cfd8e3"/>' +
      /* nose */
      '<path d="M32 49l-4-3h8z" fill="#cfd8e3"/>' +
    '</svg>';

  var PAW = '<span class="paw" aria-hidden="true">🐾</span>';

  function head(sub) {
    return '<header class="site-head">' + WOLF +
      '<div><h1 class="wordmark"><span class="gray">Gray</span><span class="dates">Dates</span></h1>' +
      '<p class="tagline"><span class="c">//</span> ' + sub + '</p></div></header>';
  }

  function foot() {
    return '<footer class="foot"><span>' + PAW + ' graydates.com — built by Yosef Wolf</span>' +
      '<span>progress is saved in this browser · ' +
      '<button class="linkbtn" id="wipe">reset all progress</button></span></footer>';
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---------------- views ---------------- */
  var app;

  function renderHome() {
    stopTimer();
    var doneCount = 0, cards = "";
    GD.topics.forEach(function (t) {
      var s = store.topics[t.id];
      var pill = '<span class="pill">not started</span>';
      var barOk = 0, barBad = 0, n = Math.min(ROUND, t.questions.length);
      var footL = n + " questions", footR = "";
      if (s) {
        var r = tally(t, s);
        barOk = r.ok / r.total * 100; barBad = r.bad / r.total * 100;
        if (s.done) {
          doneCount++;
          pill = '<span class="pill done">completed ' + r.ok + "/" + r.total + "</span>";
          footR = '<span class="best">score ' + Math.round(r.ok / r.total * 100) + "% · " + fmt(s.elapsed) + "</span>";
        } else if (r.answered > 0) {
          pill = '<span class="pill progress">in progress ' + r.answered + "/" + r.total + "</span>";
          footR = '<span class="best">resume at Q' + (s.cursor + 1) + "</span>";
        }
      }
      if (s && s.best && (!s.done || true)) {
        footR = '<span class="best">best ' + s.best.ok + "/" + s.best.total + " · " + fmt(s.best.ms) + "</span>";
      }
      cards +=
        '<button class="card" data-go="' + t.id + '">' +
          '<div class="card-top"><span class="sigil">' + esc(t.sigil) + "</span>" +
            '<div><h3>' + esc(t.name) + "</h3><p class=\"blurb\">" + esc(t.blurb) + "</p></div></div>" +
          '<div class="bar">' +
            '<span class="s-ok" style="width:' + barOk + '%"></span>' +
            '<span class="s-bad" style="width:' + barBad + '%"></span></div>' +
          '<div class="card-foot">' + pill + (footR || "<span>" + footL + "</span>") + "</div>" +
        "</button>";
    });

    app.innerHTML =
      head(GD.topics.length + " topics · " + ROUND + " questions per round · instant feedback") +
      '<div class="section-head"><h2>Pick a topic</h2><span class="overall">' +
        doneCount + " / " + GD.topics.length + " completed</span></div>" +
      '<div class="grid">' + cards + "</div>" + foot();

    app.querySelectorAll("[data-go]").forEach(function (b) {
      b.onclick = function () { location.hash = "#/t/" + b.getAttribute("data-go"); };
    });
    wireWipe();
  }

  function renderQuiz(id) {
    var topic = GD.get(id);
    if (!topic) { location.hash = "#/"; return; }
    var s = state(id, true);
    if (s.done) { location.hash = "#/t/" + id + "/results"; return; }

    var r = tally(topic, s);
    var pos = Math.max(0, Math.min(s.cursor, s.order.length - 1));
    var q = topic.questions[s.order[pos]];
    var picked = s.answers.hasOwnProperty(pos) ? s.answers[pos] : null;
    var locked = picked !== null;

    var chips = "";
    for (var i = 0; i < s.order.length; i++) {
      var cls = "chip";
      if (s.answers.hasOwnProperty(i)) {
        cls += s.answers[i] === topic.questions[s.order[i]].answer ? " ok" : " bad";
      }
      if (i === pos) cls += " current";
      chips += '<button class="' + cls + '" data-jump="' + i + '">' + (i + 1) + "</button>";
    }

    var choices = "";
    q.choices.forEach(function (c, ci) {
      var cls = "choice", mark = "";
      if (locked) {
        if (ci === q.answer) { cls += " correct"; mark = "✓"; }
        else if (ci === picked) { cls += " chosen-bad"; mark = "✗"; }
        else cls += " muted";
      }
      var plain = String(c).replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/"/g, "&quot;");
      choices += '<button class="' + cls + '" data-pick="' + ci + '"' +
        ' aria-label="Option ' + LETTERS[ci] + ": " + plain + '"' + (locked ? " disabled" : "") + ">" +
        '<span class="key">' + LETTERS[ci] + "</span>" +
        '<span class="body">' + c + "</span>" +
        '<span class="mark">' + mark + "</span></button>";
    });

    var explain = "";
    if (locked) {
      var right = picked === q.answer;
      explain = '<div class="explain ' + (right ? "ok" : "bad") + '" role="status">' +
        "<h4>" + (right ? "✓ Correct" : "✗ Not quite") + "</h4>" +
        (right
          ? "<p>" + q.why + "</p>"
          : '<p><span class="label">Why ' + LETTERS[picked] + " is wrong</span>" + (q.wrong[picked] || "That option does not do what the question asks.") + "</p>" +
            '<p><span class="label">Why ' + LETTERS[q.answer] + " is right</span>" + q.why + "</p>") +
        "</div>";
    }

    var last = pos === s.order.length - 1;
    var allAnswered = r.answered === s.order.length;
    var nextLabel = last ? (allAnswered ? "Finish ✓" : "Finish ✓") : "Next →";

    app.innerHTML =
      '<div class="quiz-bar">' +
        '<button class="btn ghost sm" id="back-home">← Topics</button>' +
        '<span class="stats">' + r.answered + "/" + r.total + " answered &nbsp; " +
          '<b class="ok">' + r.ok + "</b> right · <b class=\"bad\">" + r.bad + "</b> wrong</span>" +
        '<span class="spacer"></span>' +
        '<span class="timer" id="timer">' + fmt(s.elapsed) + "</span>" +
      "</div>" +
      '<div class="scorebar">' +
        '<span class="s-ok" style="width:' + (r.ok / r.total * 100) + '%"></span>' +
        '<span class="s-bad" style="width:' + (r.bad / r.total * 100) + '%"></span></div>' +
      '<div class="chips">' + chips + "</div>" +
      '<div class="qcard">' +
        '<div class="qhead"><span class="qnum">Q' + (pos + 1) + " of " + s.order.length + " · " + esc(topic.name) + "</span>" +
          '<span class="qtag">' + esc(q.tag) + "</span></div>" +
        '<p class="qtext">' + q.q + "</p>" +
        '<div class="choices">' + choices + "</div>" +
        explain +
      "</div>" +
      '<div class="nav">' +
        '<button class="btn" id="prev"' + (pos === 0 ? " disabled" : "") + ">← Back</button>" +
        '<button class="btn primary" id="next"' + (locked ? "" : " disabled") + ">" + nextLabel + "</button>" +
        '<button class="btn ghost" id="all">All topics</button>' +
      "</div>" +
      '<p class="hint"><kbd>A</kbd>–<kbd>D</kbd> or <kbd>1</kbd>–<kbd>4</kbd> to answer · <kbd>←</kbd> <kbd>→</kbd> to move</p>' +
      foot();

    app.querySelectorAll("[data-pick]").forEach(function (b) {
      b.onclick = function () { pick(id, pos, +b.getAttribute("data-pick")); };
    });
    app.querySelectorAll("[data-jump]").forEach(function (b) {
      b.onclick = function () { s.cursor = +b.getAttribute("data-jump"); save(); renderQuiz(id); };
    });
    document.getElementById("prev").onclick = function () { if (pos > 0) { s.cursor = pos - 1; save(); renderQuiz(id); } };
    document.getElementById("next").onclick = function () { goNext(id); };
    document.getElementById("all").onclick = document.getElementById("back-home").onclick =
      function () { location.hash = "#/"; };
    wireWipe();

    if (tickTopic !== id) startTimer(id);

    // jump to the top on a new question; stay put when an answer just locked in
    // so the explanation does not scroll out from under the reader
    if (lastView !== id + "#" + pos) window.scrollTo(0, 0);
    lastView = id + "#" + pos;
  }
  var lastView = null;

  function pick(id, pos, choice) {
    var s = state(id, true);
    if (s.answers.hasOwnProperty(pos)) return;   // locked in, no changing it
    s.answers[pos] = choice;
    save();
    renderQuiz(id);
  }

  function goNext(id) {
    var topic = GD.get(id), s = state(id, true);
    if (s.cursor < s.order.length - 1) { s.cursor++; save(); renderQuiz(id); return; }
    var r = tally(topic, s);
    if (r.answered < r.total) {
      var miss = r.total - r.answered;
      if (!confirm("You still have " + miss + " unanswered question" + (miss > 1 ? "s" : "") +
                   ". Finish anyway? They will be counted wrong.")) {
        for (var i = 0; i < s.order.length; i++) {
          if (!s.answers.hasOwnProperty(i)) { s.cursor = i; save(); renderQuiz(id); return; }
        }
        return;
      }
    }
    finish(id);
  }

  function finish(id) {
    var topic = GD.get(id), s = state(id, true);
    s.done = true;
    var r = tally(topic, s);
    if (!s.best || r.ok > s.best.ok || (r.ok === s.best.ok && s.elapsed < s.best.ms)) {
      s.best = { ok: r.ok, total: r.total, ms: s.elapsed, at: Date.now() };
    }
    stopTimer(); save();
    location.hash = "#/t/" + id + "/results";
  }

  function renderResults(id) {
    stopTimer();
    var topic = GD.get(id);
    var s = store.topics[id];
    if (!topic || !s) { location.hash = "#/"; return; }
    var r = tally(topic, s);
    var pct = Math.round(r.ok / r.total * 100);
    var verdict =
      pct === 100 ? "Flawless. The whole pack is watching." :
      pct >= 85 ? "Sharp. That is interview-ready." :
      pct >= 70 ? "Solid run — a few gaps to close." :
      pct >= 50 ? "Halfway there. Read the misses below." :
      "Rough round. The explanations below are the point.";

    var C = 2 * Math.PI * 62;
    var ring =
      '<svg class="ring" viewBox="0 0 150 150">' +
      '<circle cx="75" cy="75" r="62" fill="none" stroke="#1d2833" stroke-width="11"/>' +
      '<circle cx="75" cy="75" r="62" fill="none" stroke="' + (pct >= 70 ? "#3fb950" : pct >= 50 ? "#e3b341" : "#f4574c") +
        '" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + C + '" ' +
        'stroke-dashoffset="' + (C - C * pct / 100) + '" transform="rotate(-90 75 75)"/>' +
      '<text x="75" y="70" text-anchor="middle" font-size="30" font-weight="700">' + r.ok + "/" + r.total + "</text>" +
      '<text x="75" y="93" text-anchor="middle" font-size="14" fill="#93a1b1">' + pct + "%</text></svg>";

    var rows = "";
    for (var i = 0; i < s.order.length; i++) {
      var q = topic.questions[s.order[i]];
      var picked = s.answers.hasOwnProperty(i) ? s.answers[i] : null;
      var right = picked === q.answer;
      rows +=
        '<div class="rev ' + (right ? "ok" : "bad") + '">' +
          '<button class="rev-btn" data-open="' + i + '">' +
            '<span class="rev-n">' + (i + 1) + "</span>" +
            '<span class="rev-mark">' + (right ? "✓" : "✗") + "</span>" +
            '<span class="rev-q">' + q.q + "</span>" +
            '<span class="rev-caret">▾</span>' +
          "</button>" +
          '<div class="rev-body hidden" id="rb' + i + '">' +
            '<p class="row"><span class="label">Your answer</span>' +
              '<span class="' + (right ? "right" : "yours-bad") + '">' +
              (picked === null ? "— not answered —" : LETTERS[picked] + ". " + q.choices[picked]) + "</span></p>" +
            (right ? "" :
              '<p class="row"><span class="label">Why that is wrong</span>' +
              (picked === null ? "You ran out of round before answering this one." : (q.wrong[picked] || "That option does not do what the question asks.")) + "</p>") +
            '<p class="row"><span class="label">Correct answer</span><span class="right">' +
              LETTERS[q.answer] + ". " + q.choices[q.answer] + "</span></p>" +
            '<p class="row"><span class="label">Why</span>' + q.why + "</p>" +
          "</div>" +
        "</div>";
    }

    app.innerHTML =
      head(esc(topic.name) + " · round complete") +
      '<div class="result-head">' + ring +
        '<p class="verdict">' + verdict + "</p>" +
        '<p class="verdict-sub">' + esc(topic.name) + " · " + r.total + " questions · " + fmt(s.elapsed) + "</p>" +
        '<div class="metrics">' +
          '<div class="metric"><span class="v" style="color:#3fb950">' + r.ok + '</span><span class="k">right</span></div>' +
          '<div class="metric"><span class="v" style="color:#f4574c">' + (r.total - r.ok) + '</span><span class="k">wrong</span></div>' +
          '<div class="metric"><span class="v">' + fmt(s.elapsed) + '</span><span class="k">time</span></div>' +
          '<div class="metric"><span class="v">' + fmt(Math.round(s.elapsed / r.total)) + '</span><span class="k">per q</span></div>' +
          (s.best ? '<div class="metric"><span class="v">' + s.best.ok + "/" + s.best.total + '</span><span class="k">best</span></div>' : "") +
        "</div>" +
        '<div class="nav"><button class="btn primary" id="retake">Retake ' + esc(topic.name) + "</button>" +
          '<button class="btn" id="home2">← All topics</button></div>' +
      "</div>" +
      '<div class="section-head" style="max-width:820px;margin:34px auto 0"><h2>Review all ' + r.total + "</h2>" +
        '<span class="overall">tap a question to see why</span></div>' +
      '<div class="review">' + rows + "</div>" + foot();

    app.querySelectorAll("[data-open]").forEach(function (b) {
      b.onclick = function () {
        var body = document.getElementById("rb" + b.getAttribute("data-open"));
        body.classList.toggle("hidden");
        b.querySelector(".rev-caret").textContent = body.classList.contains("hidden") ? "▾" : "▴";
      };
    });
    document.getElementById("retake").onclick = function () {
      store.topics[id] = newAttempt(topic, s.best);
      save();
      location.hash = "#/t/" + id;
      renderQuiz(id);
    };
    document.getElementById("home2").onclick = function () { location.hash = "#/"; };
    wireWipe();
  }

  function wireWipe() {
    var w = document.getElementById("wipe");
    if (!w) return;
    w.onclick = function () {
      if (confirm("Erase every topic's progress, scores and times on this browser?")) {
        store = { v: 1, topics: {} };
        save();
        location.hash = "#/";
        renderHome();
      }
    };
  }

  /* ---------------- keyboard ---------------- */
  document.addEventListener("keydown", function (e) {
    var m = /^#\/t\/([^/]+)$/.exec(location.hash);
    if (!m) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var id = m[1], topic = GD.get(id), s = state(id, false);
    if (!topic || !s || s.done) return;
    var pos = Math.max(0, Math.min(s.cursor, s.order.length - 1));
    var k = e.key.toLowerCase();
    var n = "abcde".indexOf(k);
    if (n === -1 && k >= "1" && k <= "5") n = +k - 1;
    if (n > -1 && n < topic.questions[s.order[pos]].choices.length) {
      e.preventDefault(); pick(id, pos, n); return;
    }
    if (k === "arrowright" || k === "enter") {
      if (s.answers.hasOwnProperty(pos)) { e.preventDefault(); goNext(id); }
    } else if (k === "arrowleft") {
      if (pos > 0) { e.preventDefault(); s.cursor = pos - 1; save(); renderQuiz(id); }
    }
  });

  /* ---------------- router ---------------- */
  function route() {
    var h = location.hash || "#/";
    var m;
    if ((m = /^#\/t\/([^/]+)\/results$/.exec(h))) return renderResults(m[1]);
    if ((m = /^#\/t\/([^/]+)$/.exec(h))) return renderQuiz(m[1]);
    renderHome();
  }

  GD.boot = function () {
    app = document.getElementById("app");
    window.addEventListener("hashchange", route);
    route();
  };
})();
