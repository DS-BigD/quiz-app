/* 刷题小册 · MVP 逻辑：零依赖、零构建、状态全量存 localStorage */
(function () {
  'use strict';

  var BANK = Array.isArray(window.QUIZ_DATA) ? window.QUIZ_DATA : [];
  var KEY = 'quiz_mvp_state_v1';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var BY_ID = Object.create(null);
  BANK.forEach(function (q) { BY_ID[String(q.id)] = q; });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- 状态 ---------------- */
  function defaults() {
    return {
      v: 1, mode: 'sequential', filter: 'all', count: 20,
      seqCursor: 0, startAt: 1, queue: [], index: 0, answers: {},
      wrongIds: [], qstats: {}, theme: null, done: false
    };
  }

  function loadState() {
    var d = defaults();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          Object.keys(d).forEach(function (k) { if (s[k] !== undefined) d[k] = s[k]; });
        }
      }
    } catch (e) { /* 损坏或禁用存储时回退默认值 */ }

    if (['sequential', 'random', 'wrong', 'range'].indexOf(d.mode) < 0) d.mode = 'sequential';
    if (['all', '单选题', '多选题', '判断题'].indexOf(d.filter) < 0) d.filter = 'all';
    if (!(d.count === 'all' || [20, 50, 100].indexOf(Number(d.count)) >= 0)) d.count = 20;
    if (!Array.isArray(d.wrongIds)) d.wrongIds = [];
    d.wrongIds = d.wrongIds.map(String).filter(function (id) { return !!BY_ID[id]; });
    if (!Array.isArray(d.queue)) d.queue = [];
    d.queue = d.queue.map(String).filter(function (id) { return !!BY_ID[id]; });
    if (!d.answers || typeof d.answers !== 'object' || Array.isArray(d.answers)) d.answers = {};

    /* qstats：每道题的累计作答统计，兼容旧版本（缺失时从当前轮答案迁移） */
    if (!d.qstats || typeof d.qstats !== 'object' || Array.isArray(d.qstats)) d.qstats = {};
    Object.keys(d.qstats).forEach(function (id) {
      var st = d.qstats[id];
      if (!BY_ID[id] || !st || typeof st !== 'object') { delete d.qstats[id]; return; }
      st.attempts = Math.max(0, Math.floor(Number(st.attempts) || 0));
      st.correct = Math.max(0, Math.floor(Number(st.correct) || 0));
      st.wrong = Math.max(0, Math.floor(Number(st.wrong) || 0));
      st.lastCorrect = !!st.lastCorrect;
      st.lastAt = Number(st.lastAt) || 0;
      if (!st.attempts) delete d.qstats[id];
    });
    if (!Object.keys(d.qstats).length) {
      Object.keys(d.answers).forEach(function (id) {
        var a = d.answers[id];
        if (a && a.submitted && BY_ID[id]) {
          d.qstats[id] = {
            attempts: 1, correct: a.correct ? 1 : 0, wrong: a.correct ? 0 : 1,
            lastCorrect: !!a.correct, lastAt: Date.now()
          };
        }
      });
    }

    var start = Math.floor(Number(d.startAt));
    d.startAt = start >= 1 ? start : 1;
    if (typeof d.index !== 'number' || d.index < 0) d.index = 0;
    if (d.queue.length === 0) { d.index = 0; d.done = false; }
    else if (d.index >= d.queue.length) d.index = d.queue.length - 1;
    if (![null, 'light', 'dark'].includes(d.theme)) d.theme = null;
    return d;
  }

  var state = loadState();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 隐私模式下忽略 */ }
  }

  /* ---------------- 工具 ---------------- */
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pool() {
    return state.filter === 'all' ? BANK : BANK.filter(function (q) { return q.type === state.filter; });
  }
  function letters(q) {
    return String(q.answer || '').trim().toUpperCase().replace(/[^A-Z]/g, '').split('');
  }
  function normalize(arr) { return arr.slice().sort().join(''); }
  function roundLimit(n) { return state.count === 'all' ? n : Math.min(Number(state.count) || 20, n); }
  function showView(name) {
    ['Home', 'Quiz', 'Result', 'Report'].forEach(function (v) {
      $('#view' + v).classList.toggle('hidden', v !== name);
    });
    window.scrollTo(0, 0);
  }
  function currentQ() { return BY_ID[state.queue[state.index]]; }
  function currentAns() {
    var id = state.queue[state.index];
    if (!state.answers[id]) state.answers[id] = { picked: [], submitted: false, correct: false };
    return state.answers[id];
  }
  function tally() {
    var submitted = 0, correct = 0;
    state.queue.forEach(function (id) {
      var a = state.answers[id];
      if (a && a.submitted) { submitted++; if (a.correct) correct++; }
    });
    return { submitted: submitted, correct: correct, total: state.queue.length };
  }

  /* 去重统计：每道已答过的题只算一次，状态取最后一次作答 */
  function statsSummary() {
    var r = {
      answered: 0, mastered: 0, failed: 0, attempts: 0, totalWrong: 0,
      types: { '单选题': { a: 0, m: 0 }, '多选题': { a: 0, m: 0 }, '判断题': { a: 0, m: 0 } }
    };
    Object.keys(state.qstats).forEach(function (id) {
      var st = state.qstats[id];
      if (!st || !st.attempts) return;
      r.answered++;
      r.attempts += st.attempts;
      r.totalWrong += st.wrong;
      if (st.lastCorrect) r.mastered++; else r.failed++;
      var q = BY_ID[id];
      if (q && r.types[q.type]) {
        r.types[q.type].a++;
        if (st.lastCorrect) r.types[q.type].m++;
      }
    });
    return r;
  }
  function pct(part, total) { return total ? Math.round(part / total * 100) : 0; }

  /* ---------------- 主题 ---------------- */
  function systemTheme() {
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  function themeNow() { return state.theme || systemTheme(); }
  function applyTheme() {
    var t = themeNow();
    document.documentElement.setAttribute('data-theme', t);
    $$('.js-theme').forEach(function (b) { b.textContent = t === 'dark' ? '☀️' : '🌙'; });
    var meta = $('#themeMeta');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#11141c' : '#f4f6fb');
  }
  function toggleTheme() {
    state.theme = themeNow() === 'dark' ? 'light' : 'dark';
    save(); applyTheme();
  }

  /* ---------------- 组卷 ---------------- */
  function buildQueue() {
    var p = pool();
    if (!p.length) { toast('这个题型下没有题目'); return false; }

    var picked;
    if (state.mode === 'wrong') {
      var ids = state.wrongIds.filter(function (id) {
        return !!BY_ID[id] && (state.filter === 'all' || BY_ID[id].type === state.filter);
      });
      if (!ids.length) { toast('错题本还是空的，先去刷两题吧'); return false; }
      picked = shuffle(ids.map(function (id) { return BY_ID[id]; })).slice(0, roundLimit(ids.length));
    } else if (state.mode === 'random') {
      picked = shuffle(p).slice(0, roundLimit(p.length));
    } else if (state.mode === 'range') {
      var startPos = Math.max(0, (Number(state.startAt) || 1) - 1);
      if (startPos >= p.length) { toast('起始题号超出范围（当前题型共 ' + p.length + ' 题）'); return false; }
      var maxTake = p.length - startPos;
      var n = state.count === 'all' ? maxTake : Math.min(Number(state.count) || 20, maxTake);
      picked = [];
      for (var i = 0; i < n; i++) picked.push(p[startPos + i]);
    } else {
      var n2 = roundLimit(p.length);
      var start2 = (Number(state.seqCursor) || 0) % p.length;
      picked = [];
      for (var j = 0; j < n2; j++) picked.push(p[(start2 + j) % p.length]);
      state.seqCursor = (start2 + n2) % p.length;
    }

    state.queue = picked.map(function (q) { return String(q.id); });
    state.index = 0;
    state.answers = {};
    state.done = false;
    save();
    return true;
  }

  /* 直接用指定题目组卷（用于错题排行单题练习） */
  function startQueue(ids) {
    if (!ids || !ids.length) { toast('没有可练习的题目'); return false; }
    state.queue = ids.map(String);
    state.index = 0;
    state.answers = {};
    state.done = false;
    save();
    showView('Quiz');
    renderQuiz(true);
    return true;
  }

  /* ---------------- 首页 ---------------- */
  var MODE_HINT = {
    sequential: '按题库顺序接着往下刷，退出或刷新后都会从上次位置继续。',
    random: '每轮随机抽题；答题时点右上角「换一批」可随时重抽。',
    wrong: '只练做错过的题，答对后自动移出错题本。',
    range: '从第 N 题开始按题库顺序连刷，配合下方「每轮题量」使用；筛选题型后 N 指该题型内的序号。'
  };

  function updateStartHint() {
    var p = pool();
    var el = $('#startHint');
    if (!p.length) { el.textContent = '当前题型下没有题目'; return; }
    var start = Math.max(1, Math.floor(Number($('#startInput').value) || 1));
    if (start > p.length) {
      el.textContent = '起始题号超出范围，当前题型共 ' + p.length + ' 题';
      return;
    }
    var available = p.length - start + 1;
    var n = state.count === 'all' ? available : Math.min(Number(state.count) || 20, available);
    el.textContent = '将从第 ' + start + ' 题开始，连刷 ' + n + ' 题（第 ' + start + ' ~ ' + (start + n - 1) + ' 题）。';
  }

  function renderHome() {
    var types = { '单选题': 0, '多选题': 0, '判断题': 0 };
    BANK.forEach(function (q) { if (q.type in types) types[q.type]++; });
    var r = statsSummary();
    $('#bankSummary').textContent = '共 ' + BANK.length + ' 题 · 单选 ' + types['单选题'] + ' / 多选 ' + types['多选题'] + ' / 判断 ' + types['判断题'];
    $('#wrongCount').textContent = '错题本 ' + state.wrongIds.length + ' 题 · 累计答错 ' + r.totalWrong + ' 次';
    $('#filterCount').textContent = pool().length + ' 题可选';
    $('#modeHint').textContent = MODE_HINT[state.mode];
    $('#reportEntrySub').textContent = r.answered
      ? '已答 ' + r.answered + ' 题 · 答对率 ' + pct(r.mastered, r.answered) + '%'
      : '还没有答题记录，先去刷两题吧';

    $$('#modeSeg .seg-item').forEach(function (b) { b.classList.toggle('active', b.dataset.mode === state.mode); });
    $$('#typeChips .chip').forEach(function (b) { b.classList.toggle('active', b.dataset.filter === state.filter); });
    $$('#countChips .chip').forEach(function (b) { b.classList.toggle('active', String(b.dataset.count) === String(state.count)); });

    var startCard = $('#startCard');
    startCard.classList.toggle('hidden', state.mode !== 'range');
    if (state.mode === 'range') {
      $('#startRange').textContent = '当前题型共 ' + pool().length + ' 题';
      $('#startInput').value = state.startAt;
      updateStartHint();
    }

    var card = $('#resumeCard');
    if (state.queue.length) {
      card.classList.remove('hidden');
      if (state.done) {
        $('#resumeTitle').textContent = '查看上轮成绩';
        $('#resumeDetail').textContent = '共 ' + state.queue.length + ' 题 · 已完成';
      } else {
        var t = tally();
        $('#resumeTitle').textContent = '继续上次进度';
        $('#resumeDetail').textContent = '第 ' + (state.index + 1) + ' / ' + state.queue.length + ' 题 · 已答 ' + t.submitted + ' 题';
      }
    } else {
      card.classList.add('hidden');
    }
  }

  /* ---------------- 答题页 ---------------- */
  function optionHtml(q, ans, correctLetters) {
    return Object.keys(q.options).map(function (k) {
      var cls = 'option';
      var mark = '';
      if (ans.submitted) {
        var right = correctLetters.indexOf(k) >= 0;
        var chose = ans.picked.indexOf(k) >= 0;
        if (right) { cls += ' is-correct'; mark = '✓'; }
        else if (chose) { cls += ' is-wrong'; mark = '✕'; }
        else { cls += ' is-dim'; }
      } else if (ans.picked.indexOf(k) >= 0) {
        cls += ' is-selected';
      }
      return '<button class="' + cls + '" data-key="' + esc(k) + '"' + (ans.submitted ? ' disabled' : '') + '>' +
        '<span class="opt-key">' + esc(k) + '</span>' +
        '<span class="opt-text">' + esc(q.options[k]) + '</span>' +
        '<span class="opt-mark">' + mark + '</span>' +
        '</button>';
    }).join('');
  }

  function feedbackHtml(q, ans) {
    var st = state.qstats[String(q.id)];
    var times = st && st.wrong ? st.wrong : 0;
    var timesHtml = times ? '<div class="fb-times">这道题你累计答错 ' + times + ' 次</div>' : '';
    return '<div class="feedback" id="feedback">' +
      '<div class="fb-title ' + (ans.correct ? 'ok' : 'no') + '">' +
        (ans.correct ? '✓ 答对了' : '✗ 答错了') + '</div>' +
      '<div class="fb-answer">正确答案：' + esc(String(q.answer).trim().toUpperCase()) +
        '　·　你的选择：' + (ans.picked.length ? esc(normalize(ans.picked)) : '未选') + '</div>' +
      timesHtml +
      '<div class="fb-analysis"><span>解析</span><p>' + esc(q.analysis) + '</p></div>' +
      '</div>';
  }

  function renderQuiz(animate) {
    var q = currentQ();
    if (!q) { toast('题目数据异常，请回到首页重新开始'); return; }
    var ans = currentAns();
    var correctLetters = letters(q);
    var hint = q.type === '多选题' ? '多选题 · 可选多个答案'
      : q.type === '判断题' ? '判断题 · 判断正误' : '单选题 · 选一个答案';
    var reshuffle = (state.mode === 'random' || state.mode === 'wrong')
      ? '<button class="reshuffle" id="reshuffleBtn">换一批 ↻</button>' : '';
    var posInfo = '';
    if (state.mode === 'range' || state.mode === 'sequential') {
      var idx = pool().indexOf(q);
      if (idx >= 0) posInfo = '<span class="badge soft">题库第 ' + (idx + 1) + ' 题</span>';
    }

    $('#quizBody').innerHTML =
      '<div class="q-card">' +
        '<div class="q-meta">' +
          '<span class="badge">' + esc(q.type) + '</span>' +
          '<span class="badge soft">' + esc(q.difficulty) + '</span>' +
          posInfo +
          '<span class="q-num">#' + esc(q.id) + '</span>' + reshuffle +
        '</div>' +
        '<div class="q-text">' + esc(q.question) + '</div>' +
        '<p class="q-hint">' + hint + '</p>' +
        '<div class="options">' + optionHtml(q, ans, correctLetters) + '</div>' +
        (ans.submitted ? feedbackHtml(q, ans) : '') +
      '</div>';

    if (animate) {
      var body = $('#quizBody');
      body.classList.remove('anim');
      void body.offsetWidth; /* 强制重排以重启动画 */
      body.classList.add('anim');
    }
    updateControls(ans);
  }

  function updateControls(ans) {
    var t = tally();
    $('#quizCounter').textContent = (state.index + 1) + ' / ' + t.total;
    $('#quizAccuracy').textContent = t.submitted ? '正确率 ' + pct(t.correct, t.submitted) + '%' : '正确率 —';
    $('#progressBar').style.width = (t.total ? t.submitted / t.total * 100 : 0) + '%';
    $('#prevBtn').disabled = state.index === 0;

    var main = $('#mainBtn');
    if (!ans.submitted) {
      main.textContent = '确认答案';
      main.disabled = ans.picked.length === 0;
    } else {
      main.textContent = state.index === t.total - 1 ? '完成本轮 ✓' : '下一题 →';
      main.disabled = false;
    }
  }

  function updateOptionDom(ans) {
    $$('#quizBody .option').forEach(function (el) {
      el.classList.toggle('is-selected', ans.picked.indexOf(el.dataset.key) >= 0);
    });
  }

  function toggleOption(key) {
    var q = currentQ(), ans = currentAns();
    if (!q || ans.submitted || !(key in q.options)) return;
    if (q.type === '多选题') {
      var i = ans.picked.indexOf(key);
      if (i >= 0) ans.picked.splice(i, 1); else ans.picked.push(key);
    } else {
      ans.picked = [key];
    }
    save();
    updateOptionDom(ans);
    updateControls(ans);
  }

  function submitAnswer() {
    var q = currentQ(), ans = currentAns();
    if (!q || ans.submitted || !ans.picked.length) return;
    ans.correct = normalize(ans.picked) === normalize(letters(q));
    ans.submitted = true;

    var id = String(q.id);

    /* 累计统计：每次提交都记一笔，供学习报告去重计算 */
    var st = state.qstats[id] || (state.qstats[id] = { attempts: 0, correct: 0, wrong: 0, lastCorrect: false, lastAt: 0 });
    st.attempts++;
    if (ans.correct) st.correct++; else st.wrong++;
    st.lastCorrect = !!ans.correct;
    st.lastAt = Date.now();

    var wi = state.wrongIds.indexOf(id);
    if (ans.correct && wi >= 0) state.wrongIds.splice(wi, 1);
    if (!ans.correct && wi < 0) state.wrongIds.push(id);

    save();
    renderQuiz(false);
    var fb = $('#feedback');
    if (fb) setTimeout(function () { fb.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
  }

  function nextStep() {
    if (state.index < state.queue.length - 1) {
      state.index++;
      save();
      renderQuiz(true);
      window.scrollTo(0, 0);
    } else {
      state.done = true;
      save();
      showView('Result');
      renderResult();
    }
  }

  /* ---------------- 结果页 ---------------- */
  function renderResult() {
    var t = tally();
    var rate = pct(t.correct, t.total);
    var wrong = t.total - t.correct;
    $('#resultEmoji').textContent = rate >= 90 ? '🎉' : rate >= 60 ? '👍' : '💪';
    $('#resultRate').textContent = rate + '%';
    $('#resultCorrect').textContent = t.correct;
    $('#resultTotal').textContent = t.total;
    $('#resultWrong').textContent = wrong;
    var extra = t.submitted < t.total ? '　·　未答 ' + (t.total - t.submitted) + ' 题' : '';
    $('#resultTip').textContent = (rate >= 90 ? '稳得很，错题也别忘回头看看。'
      : rate >= 60 ? '基础不错，把错题再过一轮就更牢了。'
      : '别急，错题已经收好，专门练一轮最划算。') + extra;
    var wb = $('#wrongRoundBtn');
    wb.disabled = state.wrongIds.length === 0;
    wb.textContent = state.wrongIds.length ? '只练错题（' + state.wrongIds.length + '）' : '错题本空空的 🎊';
  }

  /* ---------------- 学习报告 ---------------- */
  function renderReport() {
    var r = statsSummary();
    $('#repAnswered').textContent = r.answered;
    $('#repRateOk').textContent = pct(r.mastered, r.answered) + '%';
    $('#repRateNo').textContent = pct(r.failed, r.answered) + '%';
    $('#repAttempts').textContent = r.attempts;
    $('#repWrongTimes').textContent = r.totalWrong;
    $('#repWrongBook').textContent = state.wrongIds.length;

    $('#typeBreakdown').innerHTML = ['单选题', '多选题', '判断题'].map(function (t) {
      var x = r.types[t];
      var p = pct(x.m, x.a);
      return '<div class="tb-row">' +
        '<span class="tb-name">' + t + '</span>' +
        '<span class="tb-track"><span class="tb-fill" style="width:' + p + '%"></span></span>' +
        '<span class="tb-val">' + x.m + '/' + x.a + ' · ' + p + '%</span>' +
        '</div>';
    }).join('');

    var items = Object.keys(state.qstats).map(function (id) {
      var st = state.qstats[id];
      return { id: id, wrong: st.wrong, attempts: st.attempts };
    }).filter(function (x) { return x.wrong > 0; })
      .sort(function (a, b) { return b.wrong - a.wrong || b.attempts - a.attempts; })
      .slice(0, 20);

    var list = $('#wrongRankList');
    if (!items.length) {
      list.innerHTML = '<p class="empty">还没有答错记录，继续保持 🎊</p>';
    } else {
      list.innerHTML = items.map(function (x, i) {
        var q = BY_ID[x.id];
        var txt = q ? q.question : x.id;
        var short = txt.length > 42 ? txt.slice(0, 42) + '…' : txt;
        return '<button class="rank-item" data-id="' + esc(x.id) + '">' +
          '<span class="rank-no">' + (i + 1) + '</span>' +
          '<span class="rank-q">' + esc(short) + '</span>' +
          '<span class="rank-badge">错 ' + x.wrong + ' 次</span>' +
          '</button>';
      }).join('');
    }
  }

  /* ---------------- 事件 ---------------- */
  function bind() {
    $$('.js-theme').forEach(function (b) { b.addEventListener('click', toggleTheme); });

    $('#modeSeg').addEventListener('click', function (e) {
      var b = e.target.closest('.seg-item'); if (!b) return;
      state.mode = b.dataset.mode; save(); renderHome();
    });
    $('#typeChips').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      state.filter = b.dataset.filter; save(); renderHome();
    });
    $('#countChips').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      state.count = b.dataset.count === 'all' ? 'all' : Number(b.dataset.count);
      save(); renderHome();
    });

    $('#startInput').addEventListener('input', function () {
      var v = Math.floor(Number(this.value));
      state.startAt = v >= 1 ? v : 1;
      save(); updateStartHint();
    });
    $('#startMinus').addEventListener('click', function () {
      var v = Math.max(1, (Number($('#startInput').value) || 1) - 1);
      $('#startInput').value = v; $('#startInput').dispatchEvent(new Event('input'));
    });
    $('#startPlus').addEventListener('click', function () {
      var v = Math.max(1, (Number($('#startInput').value) || 1) + 1);
      $('#startInput').value = v; $('#startInput').dispatchEvent(new Event('input'));
    });

    $('#startBtn').addEventListener('click', function () {
      if (!buildQueue()) return;
      showView('Quiz'); renderQuiz(true);
      toast(state.mode === 'random' ? '随机抽了 ' + state.queue.length + ' 题'
        : state.mode === 'range' ? '从第 ' + state.startAt + ' 题开始 · 共 ' + state.queue.length + ' 题'
        : '开刷，共 ' + state.queue.length + ' 题');
    });
    $('#resumeCard').addEventListener('click', function () {
      if (state.done) { showView('Result'); renderResult(); }
      else { showView('Quiz'); renderQuiz(true); }
    });
    $('#reportBtn').addEventListener('click', function () { showView('Report'); renderReport(); });
    $('#resultReportBtn').addEventListener('click', function () { showView('Report'); renderReport(); });
    $('#reportBackBtn').addEventListener('click', function () { showView('Home'); renderHome(); });

    $('#wrongRankList').addEventListener('click', function (e) {
      var b = e.target.closest('.rank-item'); if (!b) return;
      if (startQueue([b.dataset.id])) toast('单独练这道题');
    });
    $('#reportWrongBtn').addEventListener('click', function () {
      state.mode = 'wrong'; state.filter = 'all'; save();
      if (!buildQueue()) return;
      showView('Quiz'); renderQuiz(true);
      toast('错题重练 · ' + state.queue.length + ' 题');
    });
    $('#clearStatsBtn').addEventListener('click', function () {
      if (!Object.keys(state.qstats).length) { toast('还没有学习统计'); return; }
      if (!window.confirm('确定清空全部学习统计吗？错题本不受影响，清空后不可恢复。')) return;
      state.qstats = {}; save(); renderReport(); renderHome(); toast('学习统计已清空');
    });

    $('#clearWrongBtn').addEventListener('click', function () {
      if (!state.wrongIds.length) { toast('错题本本来就是空的'); return; }
      if (!window.confirm('确定清空错题本吗？共 ' + state.wrongIds.length + ' 题，清空后不可恢复。')) return;
      state.wrongIds = []; save(); renderHome(); toast('错题本已清空');
    });
    $('#resetBtn').addEventListener('click', function () {
      if (!window.confirm('重置本轮进度与顺序游标？（错题本与学习统计会保留）')) return;
      state.queue = []; state.index = 0; state.answers = {};
      state.seqCursor = 0; state.done = false;
      save(); renderHome(); toast('进度已重置');
    });

    $('#backBtn').addEventListener('click', function () { showView('Home'); renderHome(); });
    $('#resultHomeBtn').addEventListener('click', function () { showView('Home'); renderHome(); });
    $('#resultHomeBtn2').addEventListener('click', function () { showView('Home'); renderHome(); });

    $('#quizBody').addEventListener('click', function (e) {
      var opt = e.target.closest('.option');
      if (opt) { toggleOption(opt.dataset.key); return; }
      if (e.target.closest('#reshuffleBtn')) {
        if (!buildQueue()) return;
        renderQuiz(true);
        window.scrollTo(0, 0);
        toast('已换一批 · ' + state.queue.length + ' 题');
      }
    });

    $('#prevBtn').addEventListener('click', function () {
      if (state.index === 0) return;
      state.index--; save(); renderQuiz(true); window.scrollTo(0, 0);
    });
    $('#mainBtn').addEventListener('click', function () {
      var ans = currentAns();
      if (!ans.submitted) submitAnswer(); else nextStep();
    });

    $('#againBtn').addEventListener('click', function () {
      if (!buildQueue()) return;
      showView('Quiz'); renderQuiz(true);
    });
    $('#wrongRoundBtn').addEventListener('click', function () {
      state.mode = 'wrong'; state.filter = 'all';
      if (!buildQueue()) return;
      showView('Quiz'); renderQuiz(true);
      toast('错题重练 · ' + state.queue.length + ' 题');
    });

    /* 桌面键盘：A-D / 1-4 选项，Enter 提交或下一题，左右箭头切题 */
    document.addEventListener('keydown', function (e) {
      if ($('#viewQuiz').classList.contains('hidden')) return;
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      var k = e.key;
      var map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
      if (/^[a-dA-D1-4]$/.test(k)) {
        var letter = map[k] || k.toUpperCase();
        toggleOption(letter);
        e.preventDefault();
      } else if (k === 'Enter') {
        $('#mainBtn').click(); e.preventDefault();
      } else if (k === 'ArrowLeft') {
        $('#prevBtn').click(); e.preventDefault();
      } else if (k === 'ArrowRight') {
        if (currentAns().submitted) $('#mainBtn').click();
        e.preventDefault();
      }
    });
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    if (!BANK.length) {
      document.body.innerHTML = '<p style="padding:24px;line-height:1.8">题库未加载：请确认 data.js 与 index.html 放在同一目录，且文件完整。</p>';
      return;
    }
    applyTheme();
    bind();
    renderHome();
    /* 刷新友好：有未完成的一轮就自动回到当前题 */
    if (state.queue.length) {
      if (state.done) { showView('Result'); renderResult(); }
      else {
        showView('Quiz'); renderQuiz(true);
        toast('已恢复上次进度 · 第 ' + (state.index + 1) + '/' + state.queue.length + ' 题');
      }
    }
  }
  init();
})();
