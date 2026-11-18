/* 简答题模块 · 零依赖，独立于刷题逻辑：列表 + 题目/答案预览 */
(function () {
  'use strict';

  var DATA = Array.isArray(window.ESSAY_DATA) ? window.ESSAY_DATA : [];
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var VIEWS = ['Home', 'Quiz', 'Result', 'Report', 'Fav', 'Essay', 'EssayDetail'];

  var state = {
    filter: 'all',   // 'all' 或某个 category
    index: 0,        // 在当前筛选列表中的下标
    showAnswer: true // 默认直接展示题目与答案，可一键隐藏自测
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toast(msg) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function showView(name) {
    VIEWS.forEach(function (v) {
      var el = $('#view' + v);
      if (el) el.classList.toggle('hidden', v !== name);
    });
    window.scrollTo(0, 0);
  }

  function openLightbox(src, alt) {
    closeLightbox();
    var box = document.createElement('div');
    box.id = 'essayLightbox';
    box.className = 'essay-lightbox';
    box.innerHTML = '<button class="essay-lightbox-close" aria-label="关闭">×</button>' +
      '<img src="' + src + '" alt="' + (alt || '') + '">' +
      '<div class="essay-lightbox-cap">点击任意处关闭</div>';
    document.body.appendChild(box);
  }
  function closeLightbox() {
    var box = document.getElementById('essayLightbox');
    if (box && box.parentNode) box.parentNode.removeChild(box);
  }

  /* 按出现顺序去重得到主题分类 */
  function categories() {
    var seen = {}, out = [];
    DATA.forEach(function (q) {
      var c = q.category || '简答题';
      if (!seen[c]) { seen[c] = 1; out.push(c); }
    });
    return out;
  }

  function pool() {
    return state.filter === 'all'
      ? DATA
      : DATA.filter(function (q) { return (q.category || '简答题') === state.filter; });
  }

  function preview(text, n) {
    var t = String(text || '').replace(/\[\[IMG:[^\]]+\]\]/g, '[图]').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
  }

  /* 题干/答案里的 [[IMG:文件名]] 标记渲染为可点击放大的图片 */
  function richText(text) {
    return esc(text).replace(/\[\[IMG:([^\]]+)\]\]/g, function (_, name) {
      var src = 'images/essay/' + name;
      return '<figure class="essay-figure">' +
        '<img class="essay-img" src="' + src + '" alt="示意图 ' + esc(name) + '" ' +
        'data-src="' + src + '" loading="lazy">' +
        '<figcaption>示意图 · ' + esc(name) + '（点击放大）</figcaption>' +
        '</figure>';
    });
  }

  /* ---------------- 列表页 ---------------- */
  function renderList() {
    var cats = categories();
    $('#essayCountSub').textContent = '共 ' + DATA.length + ' 题 · ' + cats.length + ' 个主题';

    var chips = ['<button class="chip' + (state.filter === 'all' ? ' active' : '') +
      '" data-cat="all">全部 ' + DATA.length + '</button>'];
    cats.forEach(function (c) {
      var n = DATA.filter(function (q) { return (q.category || '简答题') === c; }).length;
      chips.push('<button class="chip' + (state.filter === c ? ' active' : '') +
        '" data-cat="' + esc(c) + '">' + esc(c) + ' ' + n + '</button>');
    });
    $('#essayChips').innerHTML = chips.join('');

    var list = pool();
    if (!list.length) {
      $('#essayList').innerHTML = '<p class="empty">该主题下暂无题目</p>';
      return;
    }
    $('#essayList').innerHTML = list.map(function (q, i) {
      var globalIndex = DATA.indexOf(q);
      return '<button class="essay-item" data-i="' + globalIndex + '">' +
        '<span class="essay-no">' + (i + 1) + '</span>' +
        '<span class="essay-item-main">' +
          '<span class="essay-item-top">' +
            '<span class="badge soft">' + esc(q.category || '简答题') + '</span>' +
            '<span class="essay-score">' + esc(q.score || '') + '</span>' +
          '</span>' +
          '<span class="essay-item-preview">' + esc(preview(q.stem, 70)) + '</span>' +
        '</span>' +
        '<span class="essay-item-arrow">›</span>' +
      '</button>';
    }).join('');
  }

  /* ---------------- 详情页 ---------------- */
  function currentListIndex() {
    var list = pool();
    var q = DATA[state.index];
    return list.indexOf(q);
  }

  function renderDetail() {
    var list = pool();
    var li = currentListIndex();
    var q = DATA[state.index];
    if (!q || li < 0) { toast('题目数据异常'); return; }

    $('#essayDetailCounter').textContent = (li + 1) + ' / ' + list.length;
    $('#essayPrevBtn').disabled = li <= 0;
    $('#essayNextBtn').disabled = li >= list.length - 1;

    var ansBlock = state.showAnswer
      ? '<div class="essay-block">' +
          '<div class="essay-block-head"><span class="essay-block-tag answer">参考答案</span>' +
            '<button id="essayToggleAns" class="essay-toggle">隐藏参考答案</button></div>' +
          '<div class="essay-content answer-text">' + richText(q.answer) + '</div>' +
        '</div>'
      : '<div class="essay-block">' +
          '<div class="essay-block-head"><span class="essay-block-tag answer">参考答案</span>' +
            '<button id="essayToggleAns" class="essay-toggle">显示参考答案</button></div>' +
          '<div class="essay-answer-mask" id="essayAnswerMask">答案已隐藏，点上方按钮展开查看</div>' +
        '</div>';

    $('#essayDetailBody').innerHTML =
      '<div class="essay-detail-card">' +
        '<div class="q-meta">' +
          '<span class="badge">简答题</span>' +
          '<span class="badge soft">' + esc(q.category || '简答题') + '</span>' +
          '<span class="badge soft">' + esc(q.score || '') + '</span>' +
          '<span class="q-num">#' + esc(q.id) + '</span>' +
        '</div>' +
        '<div class="essay-block">' +
          '<div class="essay-block-head"><span class="essay-block-tag">题目</span></div>' +
          '<div class="essay-content stem-text">' + richText(q.stem) + '</div>' +
        '</div>' +
        ansBlock +
      '</div>';
  }

  function openDetail(i) {
    state.index = i;
    state.showAnswer = true;
    showView('EssayDetail');
    renderDetail();
  }

  function step(delta) {
    var list = pool();
    var li = currentListIndex() + delta;
    if (li < 0 || li >= list.length) return;
    state.index = DATA.indexOf(list[li]);
    state.showAnswer = true;
    renderDetail();
    window.scrollTo(0, 0);
  }

  /* ---------------- 事件 ---------------- */
  function bind() {
    $('#essayEntryBtn').addEventListener('click', function () {
      if (!DATA.length) { toast('简答题数据未加载'); return; }
      state.filter = 'all';
      state.index = 0;
      renderList();
      showView('Essay');
    });

    $('#essayBackBtn').addEventListener('click', function () { showView('Home'); });
    $('#essayDetailBackBtn').addEventListener('click', function () { renderList(); showView('Essay'); });

    $('#essayChips').addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      state.filter = b.dataset.cat;
      state.index = 0;
      renderList();
    });

    $('#essayList').addEventListener('click', function (e) {
      var b = e.target.closest('.essay-item');
      if (!b) return;
      openDetail(Number(b.dataset.i));
    });

    $('#essayDetailBody').addEventListener('click', function (e) {
      var img = e.target.closest('.essay-img');
      if (img) { openLightbox(img.getAttribute('data-src') || img.src, img.alt); return; }
      if (e.target.closest('#essayToggleAns')) {
        state.showAnswer = !state.showAnswer;
        renderDetail();
      }
    });

    /* 图片放大预览：点击遮罩或 × 关闭 */
    document.addEventListener('click', function (e) {
      if (e.target.closest('#essayLightbox')) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLightbox();
    });

    $('#essayPrevBtn').addEventListener('click', function () { step(-1); });
    $('#essayNextBtn').addEventListener('click', function () { step(1); });

    document.addEventListener('keydown', function (e) {
      if ($('#viewEssayDetail').classList.contains('hidden')) return;
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
      else if (e.key === 'a' || e.key === 'A') {
        state.showAnswer = !state.showAnswer; renderDetail(); e.preventDefault();
      }
    });
  }

  function init() {
    var sub = $('#essayEntrySub');
    if (sub) sub.textContent = '共 ' + DATA.length + ' 题 · 点开直接预览';
    bind();
  }

  if (DATA.length) init();
})();
