/* ==========================================================================
   思笺 · Thought Cards — interactions
   Vanilla ES module, no build step, no dependencies.
   ========================================================================== */
(function () {
  'use strict';

  var dataEl = document.getElementById('notebook-data');
  if (!dataEl) return;

  var DATA;
  try { DATA = JSON.parse(dataEl.textContent); } catch (e) { return; }
  var cards = DATA.cards || [];
  var bySlug = {};
  cards.forEach(function (c, i) { c.index = i; bySlug[c.slug] = c; });

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  /* ---------- toast ---------------------------------------------------- */
  var toastEl = $('#toast');
  var toastTimer;
  function say(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 1900);
  }
  function copyText(text, okMessage) {
    var done = function () { say(okMessage || '已复制'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { say('复制失败，请手动选中复制'); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { say('复制失败，请手动选中复制'); }
      document.body.removeChild(ta);
    }
  }

  /* ---------- theme ---------------------------------------------------- */
  var themeBtn = $('#theme-toggle');
  function paintThemeIcons() {
    if (!themeBtn) return;
    var dark = root.dataset.theme === 'dark';
    var moon = $('.icon-moon', themeBtn), sun = $('.icon-sun', themeBtn);
    if (moon) moon.hidden = dark;
    if (sun) sun.hidden = !dark;
    themeBtn.setAttribute('aria-pressed', String(dark));
  }
  paintThemeIcons();
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('notebook-theme', next); } catch (e) {}
      paintThemeIcons();
    });
  }

  /* ---------- filtering ------------------------------------------------ */
  var grid = $('#grid');
  var cardEls = $$('.card', grid);
  var chipsWrap = $('#chips');
  var searchInput = $('#q');
  var activeFilter = '*';
  var query = '';
  var emptyNote = null;

  function haystack(card) {
    var c = bySlug[card.dataset.slug];
    if (!c) return card.textContent || '';
    var stops = (c.stops || []).map(function (s) { return s.title + ' ' + (s.text || ''); }).join(' ');
    return [c.title, c.mode, (c.tags || []).join(' '), c.seed, c.place, stops].join(' ');
  }

  function applyFilter() {
    var q = query.trim().toLowerCase();
    var shown = 0;
    cardEls.forEach(function (el) {
      var card = bySlug[el.dataset.slug] || {};
      var tagHit = activeFilter === '*' ||
        (card.tags || []).indexOf(activeFilter) !== -1 ||
        card.mode === activeFilter;
      var qHit = !q || (el._hay || (el._hay = haystack(el))).toLowerCase().indexOf(q) !== -1;
      var visible = tagHit && qHit;
      el.classList.toggle('is-hidden', !visible);
      if (visible) {
        shown += 1;
        el.style.setProperty('--i', String(Math.min(shown, 14)));
      }
    });
    if (emptyNote) emptyNote.remove();
    if (!shown) {
      emptyNote = document.createElement('p');
      emptyNote.className = 'empty-note';
      emptyNote.textContent = '这里暂时没有卡片 —— 换个词，或者让 Agent 写一张新的。';
      grid.appendChild(emptyNote);
    }
  }

  if (chipsWrap) {
    chipsWrap.addEventListener('click', function (event) {
      var chip = event.target.closest('.chip');
      if (!chip) return;
      activeFilter = chip.dataset.value;
      $$('.chip', chipsWrap).forEach(function (c) {
        c.setAttribute('aria-pressed', String(c === chip));
      });
      applyFilter();
    });
  }

  if (searchInput) {
    var searchTimer;
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { query = searchInput.value; applyFilter(); }, 120);
    });
  }

  /* ---------- pointer spotlight --------------------------------------- */
  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    cardEls.forEach(function (el) {
      var spot = $('.card-spot', el);
      if (!spot) return;
      el.addEventListener('pointermove', function (event) {
        var rect = el.getBoundingClientRect();
        spot.style.setProperty('--mx', ((event.clientX - rect.left) / rect.width * 100).toFixed(1) + '%');
        spot.style.setProperty('--my', ((event.clientY - rect.top) / rect.height * 100).toFixed(1) + '%');
      });
    });
  }

  /* ---------- overlay -------------------------------------------------- */
  var overlay = $('#overlay');
  if (!overlay) return;

  var panelScroll = $('#panel-scroll');
  var elLine = $('#panel-line');
  var elMeta = $('#panel-meta');
  var elMode = $('#panel-mode');
  var elSeed = $('#panel-seed');
  var elQuote = $('#panel-quote');
  var elJourney = $('#panel-journey');
  var elPermalink = $('#panel-permalink');
  var elIndex = $('#panel-index');
  var current = null;
  var lastFocus = null;
  var stopsObserver = null;

  function metaHtml(card) {
    var bits = ['<span>' + card.date + '</span>'];
    if (card.place) bits.push('<span>' + escapeHtml(card.place) + '</span>');
    bits.push('<span>约 ' + card.minutes + ' 分钟</span>');
    (card.tags || []).forEach(function (t) { bits.push('<span>#' + escapeHtml(t) + '</span>'); });
    return bits.join('');
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function render(card) {
    current = card;
    elMode.textContent = card.modeEmoji + ' ' + card.mode;
    elLine.textContent = card.title;
    elMeta.innerHTML = metaHtml(card);

    if (card.seed) {
      elSeed.hidden = false;
      elSeed.innerHTML = '<b>起点</b>' + escapeHtml(card.seed);
    } else {
      elSeed.hidden = true;
    }

    if (card.quote) {
      elQuote.hidden = false;
      elQuote.textContent = card.quote;
    } else {
      elQuote.hidden = true;
    }

    elJourney.innerHTML = (card.stops || []).map(function (stop) {
      return '<section class="stop" id="stop-' + stop.id + '">' +
        '<h3 class="stop-title">' + escapeHtml(stop.prologue ? '序' : stop.title) + '</h3>' +
        '<div class="stop-body">' + stop.html + '</div></section>';
    }).join('');

    elPermalink.setAttribute('href', DATA.base + 'c/' + card.slug + '/');
    elIndex.textContent = '№ ' + String(card.index + 1).padStart(2, '0') + ' / ' + cards.length;

    panelScroll.scrollTop = 0;
    observeStops();
    moveProgress(0);
  }

  function observeStops() {
    if (stopsObserver) stopsObserver.disconnect();
    var stops = $$('.stop', elJourney);
    if (reduceMotion || !('IntersectionObserver' in window)) {
      stops.forEach(function (s) { s.classList.add('is-in'); });
      return;
    }
    stopsObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          stopsObserver.unobserve(entry.target);
        }
      });
    }, { root: panelScroll, rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    stops.forEach(function (s) { stopsObserver.observe(s); });
  }

  function moveProgress(ratio) {
    var bar = $('#read-progress');
    if (bar) bar.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
  }

  if (panelScroll) {
    panelScroll.addEventListener('scroll', function () {
      var max = panelScroll.scrollHeight - panelScroll.clientHeight;
      moveProgress(max > 0 ? panelScroll.scrollTop / max : 0);
    }, { passive: true });
  }

  function visibleCards() {
    return cards.filter(function (c) {
      var el = grid && grid.querySelector('.card[data-slug="' + c.slug + '"]');
      return !el || !el.classList.contains('is-hidden');
    });
  }

  function open(card, options) {
    if (!card) return;
    var opts = options || {};
    if (!overlay.hidden && current === card) return;
    if (overlay.hidden) lastFocus = document.activeElement;
    render(card);
    overlay.hidden = false;
    document.body.classList.add('is-locked');
    if (!opts.silent) {
      try { history.pushState({ slug: card.slug }, '', '#' + card.slug); } catch (e) { location.hash = card.slug; }
    }
    var closeBtn = $('#panel-close');
    if (closeBtn) closeBtn.focus({ preventScroll: true });
  }

  function close(options) {
    var opts = options || {};
    overlay.hidden = true;
    document.body.classList.remove('is-locked');
    moveProgress(0);
    if (stopsObserver) stopsObserver.disconnect();
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    if (!opts.silent && location.hash) {
      try { history.pushState({}, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
    }
    current = null;
  }

  function step(delta) {
    var pool = visibleCards();
    if (!pool.length) return;
    var at = current ? pool.indexOf(bySlug[current.slug]) : -1;
    var next = pool[(at + delta + pool.length) % pool.length];
    open(next);
  }

  grid.addEventListener('click', function (event) {
    var link = event.target.closest('a.card-link');
    if (!link) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    open(bySlug[link.dataset.slug]);
  });

  $$('[data-close]', overlay).forEach(function (el) { el.addEventListener('click', function () { close(); }); });
  var closeBtn = $('#panel-close');
  if (closeBtn) closeBtn.addEventListener('click', function () { close(); });
  var prevBtn = $('#panel-prev'), nextBtn = $('#panel-next'), rndBtn = $('#panel-random');
  if (prevBtn) prevBtn.addEventListener('click', function () { step(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { step(1); });
  if (rndBtn) rndBtn.addEventListener('click', function () { random(); });
  var copyBtn = $('#panel-copy');
  if (copyBtn) copyBtn.addEventListener('click', function () {
    if (!current) return;
    var url = new URL(DATA.base + 'c/' + current.slug + '/', location.href).href;
    var text = '「' + current.title + '」\n\n' + current.seed + '\n\n' + url;
    copyText(text, '卡片与链接已复制');
  });

  function random() {
    var pool = visibleCards();
    if (!pool.length) { say('没有可打开的卡片'); return; }
    var pick = pool[Math.floor(Math.random() * pool.length)];
    if (current && pool.length > 1 && pick.slug === current.slug) pick = pool[(pool.indexOf(pick) + 1) % pool.length];
    open(pick);
  }

  var randomTop = $('#random');
  if (randomTop) randomTop.addEventListener('click', random);

  document.addEventListener('keydown', function (event) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (event.key === 'Escape' && !overlay.hidden) { close(); return; }
    if (typing) {
      if (event.key === 'Escape' && searchInput) { searchInput.value = ''; query = ''; applyFilter(); searchInput.blur(); }
      return;
    }
    if (event.key === '/' && searchInput) { event.preventDefault(); searchInput.focus(); return; }
    if (overlay.hidden) {
      if (event.key === 'r' || event.key === 'R') random();
      return;
    }
    if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    else if (event.key === 'r' || event.key === 'R') random();
  });

  $$('.copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = document.querySelector(btn.dataset.copy);
      if (target) copyText(target.textContent.trim(), '已复制到剪贴板');
    });
  });

  window.addEventListener('popstate', function () {
    var slug = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (slug && bySlug[slug]) open(bySlug[slug], { silent: true });
    else if (!overlay.hidden) close({ silent: true });
  });

  // Tabs animate in only after the first paint, so the grid feels composed.
  requestAnimationFrame(function () { document.body.classList.add('is-ready'); });

  // Deep link support: /#slug or /c/slug/ redirecting back with a hash.
  var initial = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (initial && bySlug[initial]) {
    open(bySlug[initial], { silent: true });
  } else {
    var redirect = new URLSearchParams(location.search).get('card');
    if (redirect && bySlug[redirect]) open(bySlug[redirect]);
  }
})();
