/* ==========================================================================
   FOR3NSIQ project portfolio · behaviour (no libraries, no build step)
   - Routing: #project-4a shows that page, #timeline scrolls on the home page.
     Old names from the previous version (#solution-vision, #overview…) still work.
   - Mobile menu, sticky-header state, scroll-spy for the nav and sub-nav.
   - Scroll reveal with stagger, number count-up, "Today" marker on the timeline.
   - Architecture dialog, image lightbox, agent filter (Project 6A).
   All motion is skipped when the user prefers reduced motion.
   ========================================================================== */
(function () {
  'use strict';
  window.__jdaReady = true; // tells the inline <head> script that JS loaded

  var root = document.documentElement;
  var body = document.body;
  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var hasIO = 'IntersectionObserver' in window;
  function motionOK() { return !reduceQuery.matches; }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function setCurrent(link, on) { if (on) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current'); }

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------------------------------------------------------------- Routing */
  var home = document.getElementById('home');
  var pages = $all('[data-page]');
  var current = pages.filter(function (p) { return p.classList.contains('is-active'); })[0] || home;
  var baseTitle = document.title;
  var aliases = {
    '': 'home', top: 'home', overview: 'home',
    'solution-sap': 'project-2a', 'solution-vision': 'project-2b-3a', 'solution-integrity': 'project-2b-3a',
    'solution-maintenance': 'project-4a', 'solution-production': 'project-6a', 'solution-workprocess': 'project-7',
    // 2B and 3A now share one page: their old page and section links land on it
    'project-2b': 'project-2b-3a', 'project-3a': 'project-2b-3a',
    'p2b-targets': 'p2b3a-targets', 'p3a-targets': 'p2b3a-targets', 'p2b-workflow': 'p2b3a-how', 'p3a-how': 'p2b3a-how',
    'p2b-agents': 'p2b3a-agents', 'p3a-models': 'p2b3a-models', 'p2b-delivers': 'p2b3a-delivers', 'p3a-delivers': 'p2b3a-delivers',
    'p2b-timeline': 'p2b3a-timeline', 'p3a-timeline': 'p2b3a-timeline', 'p4a-shift': 'p4a-upd', 'p4a-value': 'p4a-prevent',
    // Infrastructure and HSE & PSM were "supporting solutions"; they are now Projects 1 and 5
    'solution-gai': 'project-1', 'solution-hse': 'project-5',
    // The 6A "opportunity pool" section and its 2 pop-ups were removed (19 Nov 2026); links land on KPI 1 instead
    'p6a-pathway': 'p6a-uplift', 'opp-sand': 'p6a-uplift', 'opp-gaslift': 'p6a-uplift'
  };
  // The project pages, in tab order (used for the tabs, left/right slides and swipes).
  var PROJECT_ORDER = ['project-1', 'project-2a', 'project-2b-3a', 'project-4a', 'project-5', 'project-6a', 'project-7', 'project-cdf'];

  function resolve(hash) {
    var id = decodeURIComponent((hash || '').replace(/^#/, ''));
    if (Object.prototype.hasOwnProperty.call(aliases, id)) id = aliases[id];
    var el = id ? document.getElementById(id) : null;
    if (!el) return { page: home, target: null };
    var page = el.hasAttribute('data-page') ? el : el.closest('[data-page]');
    return { page: page, target: page === el ? null : el, el: el };
  }

  function focusEl(el) {
    var target = el;
    if (!/^(H1|H2|H3|A|BUTTON)$/.test(el.tagName)) target = el.querySelector('h1, h2') || el;
    if (!target.hasAttribute('tabindex') && !/^(A|BUTTON)$/.test(target.tagName)) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  function showPage(page) {
    if (page === current) return false;
    var from = PROJECT_ORDER.indexOf(current.id);
    var to = PROJECT_ORDER.indexOf(page.id);
    var betweenProjects = from > -1 && to > -1;
    current.classList.remove('is-active', 'page-enter', 'page-slide-next', 'page-slide-prev');
    page.classList.add('is-active');
    current = page;
    if (motionOK()) {
      void page.offsetWidth; // restart the animation
      // Project to project: slide in from the side you're heading to, like tabs.
      page.classList.add(betweenProjects ? (to > from ? 'page-slide-next' : 'page-slide-prev') : 'page-enter');
    }
    document.title = page.dataset.title ? page.dataset.title + ' · FOR3NSIQ' : baseTitle;
    updateNav();
    updateCarousel(betweenProjects);
    return true;
  }

  /* --------------------------------------------------------- Project carousel */
  // Coverflow switcher above the six project pages. The cards are links (#project-xx), so the card
  // order defines the project order. Each card gets --o (signed distance from the centre card,
  // fractional while dragging) and --a (distance without sign); the CSS turns those into
  // position, size, tilt and opacity. Only transform and opacity animate.
  var pc = document.querySelector('[data-project-carousel]');
  var pcStage = pc ? pc.querySelector('.pc__stage') : null;
  var pcCards = pc ? $all('.pc-card', pc) : [];
  var pcLinks = pcCards.map(function (c) { return c.querySelector('.pc-card__link'); });
  var pcDots = pc ? $all('.pc__dot', pc) : [];
  var pcArrows = pc ? $all('[data-pc-step]', pc) : [];
  var pcLive = pc ? pc.querySelector('[data-pc-live]') : null;
  var pcCount = pc ? pc.querySelector('[data-pc-count]') : null;
  var pcActive = 0;
  if (pcLinks.length) PROJECT_ORDER = pcLinks.map(function (a) { return a.getAttribute('href').slice(1); });
  if (pc) pc.classList.add('is-ready');

  function cardTitle(i) {
    var c = pcCards[i];
    if (!c) return '';
    var code = c.querySelector('.code-badge'), title = c.querySelector('.pc-card__title');
    return ((code ? code.textContent + ' ' : '') + (title ? title.textContent : '')).trim();
  }

  // Position every card relative to the active one. `shift` = how far a drag has moved, in cards.
  function pcLayout(shift) {
    pcCards.forEach(function (card, i) {
      var o = i - pcActive - (shift || 0);
      var a = Math.abs(o);
      card.style.setProperty('--o', o.toFixed(4));
      card.style.setProperty('--a', a.toFixed(4));
      card.style.zIndex = String(100 - Math.round(a * 10)); // nearest cards on top
      card.classList.toggle('is-far', a > 2.5);
    });
  }

  function measureCarousel() {
    if (!pcStage || !pc.classList.contains('is-shown')) return;
    var h = 0;
    pcCards.forEach(function (c) { h = Math.max(h, c.offsetHeight); });
    if (h) pcStage.style.setProperty('--pc-stage-h', h + 'px');
    // Desktop side-by-side layout: the project header must be at least as tall as the carousel.
    root.style.setProperty('--pc-h', pc.offsetHeight + 'px');
  }
  function carouselBesideText() { return pc && getComputedStyle(pc).position === 'absolute'; }

  function updateCarousel(animate) {
    if (!pc) return;
    var idx = PROJECT_ORDER.indexOf(current.id);
    pc.classList.toggle('is-shown', idx > -1);
    if (idx < 0) return;
    pcActive = idx;
    if (!animate) pc.classList.add('no-anim');
    measureCarousel();
    pcLayout(0);
    if (!animate) { void pc.offsetWidth; pc.classList.remove('no-anim'); }
    pcCards.forEach(function (card, i) {
      var on = i === idx;
      card.classList.toggle('is-active', on);
      pcLinks[i].tabIndex = on ? 0 : -1; // one tab stop; arrow keys move between cards
      if (on) pcLinks[i].setAttribute('aria-current', 'page'); else pcLinks[i].removeAttribute('aria-current');
    });
    pcDots.forEach(function (d, i) { setCurrent(d, i === idx); });
    pcArrows.forEach(function (b) {
      var step = Number(b.dataset.pcStep);
      var target = idx + step;
      b.disabled = target < 0 || target >= PROJECT_ORDER.length;
      b.setAttribute('aria-label', b.disabled ? (step > 0 ? 'Next project' : 'Previous project')
        : (step > 0 ? 'Next project: ' : 'Previous project: ') + cardTitle(target));
    });
    if (pcCount) pcCount.textContent = (idx + 1) + ' / ' + PROJECT_ORDER.length;
    if (pcLive) pcLive.textContent = 'Project ' + (idx + 1) + ' of ' + PROJECT_ORDER.length + ': ' + cardTitle(idx);
  }

  function goToProject(i, opts) {
    if (i < 0 || i >= PROJECT_ORDER.length) return;
    var hash = '#' + PROJECT_ORDER[i];
    if (location.hash !== hash) history.pushState(null, '', hash);
    route(hash, { smooth: false });
    if (opts && opts.focusCard && pcLinks[i]) pcLinks[i].focus({ preventScroll: true });
  }
  function stepProject(dir, opts) {
    var idx = PROJECT_ORDER.indexOf(current.id);
    if (idx > -1) goToProject(idx + dir, opts);
  }
  // Tapping the centre card: its "open" action = scroll down to the project's details.
  // Phones (carousel above the text): go to the description. Desktop (side by side, so the
  // description is already in view): go to the first details section, e.g. Targets.
  function openProjectDetails() {
    var target = carouselBesideText()
      ? (current.querySelector('.project-hero ~ .section') || current.querySelector('.project-hero'))
      : current.querySelector('.project-hero');
    if (!target) return;
    target.scrollIntoView({ behavior: motionOK() ? 'smooth' : 'auto', block: 'start' });
    focusEl(target.querySelector('h1, h2') || target);
  }

  if (pc && pcStage) {
    var drag = null;
    var suppressClick = false;
    var stepPx = function () {
      var card = pcCards[pcActive];
      var ratio = parseFloat(getComputedStyle(pc).getPropertyValue('--pc-side-offset')) || 0.34;
      return Math.max(90, (card ? card.offsetWidth : 320) * ratio); // drag distance that equals one card
    };

    pcStage.addEventListener('dragstart', function (e) { e.preventDefault(); }); // no ghost images/links
    pcStage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, moved: false, samples: [{ x: e.clientX, t: e.timeStamp }] };
    });
    pcStage.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; } // vertical: let the page scroll
        if (Math.abs(dx) < 6) return;
        drag.moved = true;
        pc.classList.add('is-dragging');
        try { pcStage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      var last = PROJECT_ORDER.length - 1;
      if ((pcActive === 0 && dx > 0) || (pcActive === last && dx < 0)) dx *= 0.35; // rubber-band at the ends
      drag.dx = dx;
      drag.samples.push({ x: e.clientX, t: e.timeStamp });
      if (drag.samples.length > 5) drag.samples.shift();
      pcLayout(-dx / stepPx()); // cards follow the finger / mouse
    });
    var endDrag = function (e, cancelled) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      var d = drag;
      drag = null;
      if (!d.moved) return;
      pc.classList.remove('is-dragging');
      suppressClick = true; // a drag is not a tap
      setTimeout(function () { suppressClick = false; }, 0);
      if (cancelled) { pcLayout(0); return; }
      // Snap to the nearest card, with a short momentum from the speed at release
      // (only the last 100 ms count, so pausing before letting go means no flick).
      var upT = e ? e.timeStamp : d.samples[d.samples.length - 1].t;
      var recent = d.samples.filter(function (sm) { return upT - sm.t <= 100; });
      var velocity = 0;
      if (recent.length > 1) velocity = (recent[recent.length - 1].x - recent[0].x) / Math.max(1, recent[recent.length - 1].t - recent[0].t); // px per ms
      var projected = d.dx + velocity * 160;  // a quick flick counts as a longer drag
      var steps = Math.max(-1, Math.min(1, Math.round(-projected / stepPx()))); // one project per swipe
      var target = Math.max(0, Math.min(PROJECT_ORDER.length - 1, pcActive + steps));
      if (target === pcActive) pcLayout(0); else goToProject(target);
    };
    pcStage.addEventListener('pointerup', function (e) { endDrag(e, false); });
    pcStage.addEventListener('pointercancel', function (e) { endDrag(e, true); });

    // Tap a side card = bring it to the centre (switch project). Tap the centre card = open details.
    pcStage.addEventListener('click', function (e) {
      var link = e.target.closest('.pc-card__link');
      if (!link) return;
      e.preventDefault();
      if (suppressClick || e.metaKey || e.ctrlKey || e.shiftKey) return;
      var i = pcLinks.indexOf(link);
      if (i === pcActive) openProjectDetails(); else goToProject(i);
    });

    pc.addEventListener('click', function (e) {
      var arrow = e.target.closest('[data-pc-step]');
      if (arrow && !arrow.disabled) { stepProject(Number(arrow.dataset.pcStep)); return; }
      var dot = e.target.closest('.pc__dot');
      if (dot) goToProject(pcDots.indexOf(dot));
    });

    // Keyboard: arrows / Home / End anywhere in the carousel; focus follows the centre card.
    pc.addEventListener('keydown', function (e) {
      if (!e.target.closest('.pc__stage, .pc__controls')) return;
      var map = { ArrowRight: pcActive + 1, ArrowLeft: pcActive - 1, Home: 0, End: PROJECT_ORDER.length - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      var target = Math.max(0, Math.min(PROJECT_ORDER.length - 1, map[e.key]));
      if (target !== pcActive) goToProject(target, { focusCard: e.target.closest('.pc__stage') !== null });
    });

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureCarousel);
    var resizeFrame = null;
    window.addEventListener('resize', function () {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(measureCarousel);
    });
    // Card images load lazily; re-measure once they arrive.
    pcCards.forEach(function (c) { var img = c.querySelector('img'); if (img) img.addEventListener('load', measureCarousel); });
  }

  // Swipe left / right on touch screens to move between projects.
  var swipe = null;
  document.addEventListener('touchstart', function (e) {
    swipe = null;
    if (PROJECT_ORDER.indexOf(current.id) < 0 || e.touches.length !== 1) return;
    var p = e.touches[0];
    if (p.clientX < 24 || p.clientX > window.innerWidth - 24) return; // leave the browser's edge-swipe "back" alone
    if (e.target.closest('.pc, .subnav__list, .table-wrap, .arch2-scroll, .filter-bar, dialog, input, textarea, select')) return;
    swipe = { x: p.clientX, y: p.clientY, t: Date.now() };
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (!swipe) return;
    var p = e.changedTouches[0];
    var dx = p.clientX - swipe.x, dy = p.clientY - swipe.y, dt = Date.now() - swipe.t;
    swipe = null;
    if (dt < 800 && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) stepProject(dx < 0 ? 1 : -1);
  }, { passive: true });

  function route(hash, opts) {
    opts = opts || {};
    var r = resolve(hash);
    if (!r.page) { // an element outside the pages, e.g. the skip link's #main
      if (r.el) { r.el.scrollIntoView(); focusEl(r.el); }
      return;
    }
    var changed = showPage(r.page);
    var smooth = opts.smooth && !changed && motionOK();
    if (r.target) {
      // Layout is synchronous, so the newly shown page can be scrolled straight away.
      r.target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
      if (opts.focus) focusEl(r.target);
    } else {
      window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
      if (opts.focus) focusEl(changed ? (r.page.querySelector('h1') || r.page) : r.page);
    }
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var hash = a.getAttribute('href');
    if (hash.length < 2) return;
    e.preventDefault();
    closeMenu();
    if (location.hash !== hash) history.pushState(null, '', hash);
    route(hash, { smooth: true, focus: true });
  });
  window.addEventListener('popstate', function () { route(location.hash, { smooth: false }); });

  /* ------------------------------------------------- Header, menu, nav state */
  var header = document.querySelector('.site-header');
  var sentinel = document.querySelector('.scroll-sentinel');
  if (header && sentinel && hasIO) {
    new IntersectionObserver(function (entries) {
      header.classList.toggle('is-scrolled', !entries[0].isIntersecting);
    }).observe(sentinel);
  }

  var toggle = document.querySelector('.nav-toggle');
  function openMenu() { if (!toggle) return; toggle.setAttribute('aria-expanded', 'true'); body.classList.add('menu-open'); }
  function closeMenu() { if (!toggle) return; toggle.setAttribute('aria-expanded', 'false'); body.classList.remove('menu-open'); }
  if (toggle) {
    toggle.addEventListener('click', function () {
      if (toggle.getAttribute('aria-expanded') === 'true') closeMenu(); else openMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && body.classList.contains('menu-open')) { closeMenu(); toggle.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (body.classList.contains('menu-open') && !e.target.closest('.site-header')) closeMenu();
    });
    var wide = window.matchMedia('(min-width: 961px)');
    var onWide = function (e) { if (e.matches) closeMenu(); };
    if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);
  }

  // Primary nav: scroll-spy on the home page; a page's own link (data-nav, e.g. "about") on its page;
  // "Projects" on the project pages.
  var navLinks = $all('.site-nav__list a');
  var spyId = null;
  function updateNav() {
    var id = current === home ? spyId : (current.dataset.nav || 'projects');
    navLinks.forEach(function (l) { setCurrent(l, l.dataset.nav === id); });
  }
  if (hasIO && home) {
    var spyTargets = [home.querySelector('.hero')].concat($all('.section', home));
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = en.target.id;
        spyId = navLinks.some(function (l) { return l.dataset.nav === id; }) ? id : null;
        if (current === home) updateNav();
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    spyTargets.forEach(function (s) { if (s) spy.observe(s); });
  }

  // Sub-nav on project pages: highlight the section in view and keep its chip visible.
  if (hasIO) {
    $all('.subnav').forEach(function (nav) {
      var list = nav.querySelector('.subnav__list');
      var links = $all('a[href^="#"]', nav);
      var bySection = [];
      links.forEach(function (l) {
        var s = document.getElementById(l.getAttribute('href').slice(1));
        if (s) bySection.push({ section: s, link: l });
      });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var hit = bySection.filter(function (x) { return x.section === en.target; })[0];
          if (!hit) return;
          links.forEach(function (l) { setCurrent(l, l === hit.link); });
          list.scrollTo({ left: Math.max(0, hit.link.offsetLeft - 24), behavior: motionOK() ? 'smooth' : 'auto' });
        });
      }, { rootMargin: '-35% 0px -60% 0px' });
      bySection.forEach(function (x) { io.observe(x.section); });
    });
  }

  /* ------------------------------------------------------------ Scroll reveal */
  if (root.classList.contains('motion') && hasIO) {
    $all('[data-reveal-stagger]').forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        if (child.hasAttribute('data-reveal')) return;
        child.setAttribute('data-reveal', '');
        child.style.setProperty('--i', Math.min(i, 8));
      });
    });
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        revealIO.unobserve(el);
        el.classList.add('is-in');
        // Once revealed, hand the element back to its normal hover transitions.
        el.addEventListener('transitionend', function done(ev) {
          if (ev.target !== el) return;
          el.removeEventListener('transitionend', done);
          el.removeAttribute('data-reveal');
          el.style.removeProperty('--i');
        });
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
    $all('[data-reveal]').forEach(function (el) { revealIO.observe(el); });
  }

  /* ---------------------------------------------------------------- Count-up */
  function fmt(v, el) {
    var d = parseInt(el.dataset.decimals || '0', 10);
    return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function countUp(el) {
    var end = parseFloat(el.dataset.count);
    var start = null;
    var dur = 800;
    function tick(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = p < 1 ? fmt(end * eased, el) : el.dataset.final;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    // If frames are throttled (background tab, some webviews), still land on the real value.
    setTimeout(function () { el.textContent = el.dataset.final; }, dur + 400);
  }
  if (root.classList.contains('motion') && hasIO) {
    var countIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        countIO.unobserve(en.target);
        en.target.textContent = fmt(0, en.target); // start from 0 only when the count begins
        countUp(en.target);
      });
    }, { threshold: 0.3 });
    $all('[data-count]').forEach(function (el) {
      el.dataset.final = el.textContent; // the HTML always holds the real value, so it shows even if counting never runs
      countIO.observe(el);
    });
  }

  /* --------------------------------------------------- Timeline "Today" marker */
  (function () {
    var g = document.querySelector('.gantt');
    if (!g) return;
    var y = +g.dataset.startYear, m = +g.dataset.startMonth, n = +g.dataset.months;
    var now = new Date();
    var idx = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
    if (idx < 0 || idx >= n) return;
    var days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    var t = (idx + (now.getDate() - 0.5) / days) / n;
    g.style.setProperty('--t', t.toFixed(4));
    g.classList.add('has-today');
    var label = g.querySelector('.gantt__today-label');
    if (label) label.textContent = 'Today · ' + now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  })();

  /* ------------------------------------------ Timeline milestones (deliverables) */
  // Hover or keyboard focus shows a milestone's deliverables (CSS); a tap pins it open; Esc hides it.
  // Each pop-up is nudged sideways (--tx) so it stays inside the timeline card.
  (function () {
    var gantt = document.querySelector('.gantt');
    var all = gantt ? $all('.gantt__ms', gantt) : [];
    if (!all.length) return;
    function place(ms) {
      var tip = ms.querySelector('.gantt__tip');
      if (!tip) return;
      var box = gantt.getBoundingClientRect();
      var x = ms.getBoundingClientRect().left; // the milestone's centre (the wrapper is 0 wide)
      var w = tip.offsetWidth, pad = 12;
      var off = Math.min(Math.max(-w / 2, box.left + pad - x), box.right - pad - x - w);
      tip.style.setProperty('--tx', Math.round(off) + 'px');
    }
    function close(except) { all.forEach(function (m) { if (m !== except) m.classList.remove('is-open'); }); }
    all.forEach(function (ms) {
      var btn = ms.querySelector('button');
      ms.addEventListener('pointerenter', function () { ms.classList.remove('is-dismissed'); place(ms); });
      ms.addEventListener('pointerleave', function () { ms.classList.remove('is-dismissed'); });
      ms.addEventListener('focusin', function () { place(ms); });
      ms.addEventListener('focusout', function () { ms.classList.remove('is-dismissed'); });
      if (btn) btn.addEventListener('click', function () {
        place(ms);
        var open = !ms.classList.contains('is-open');
        close(ms);
        ms.classList.remove('is-dismissed');
        ms.classList.toggle('is-open', open);
      });
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.gantt__ms')) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      all.forEach(function (m) {
        if (m.classList.contains('is-open') || m.matches(':hover') || m.contains(document.activeElement)) m.classList.add('is-dismissed');
        m.classList.remove('is-open');
      });
    });
  })();

  /* ------------------------------------- MVP cards: "Completed" once the month is over */
  // Each MVP card on the project pages carries its month (data-mvp="2026-10"). From the first day of the
  // following month it shows a "Completed" tag, so the pages stay current without editing.
  // window.__for3nsiqToday (a Date) can stand in for today's date when testing.
  (function () {
    var now = window.__for3nsiqToday instanceof Date ? window.__for3nsiqToday : new Date();
    $all('.mvp-card[data-mvp]').forEach(function (card) {
      var m = /^(\d{4})-(\d{2})$/.exec(card.dataset.mvp || '');
      if (!m) return;
      if (now < new Date(+m[1], +m[2], 1)) return; // month index +m[2] = the month after the MVP month
      var date = card.querySelector('.mvp-card__date');
      if (!date || date.querySelector('.mvp-card__status')) return;
      card.classList.add('is-complete');
      var tag = document.createElement('span');
      tag.className = 'mvp-card__status';
      tag.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>Completed';
      date.appendChild(document.createTextNode(' '));
      date.appendChild(tag);
    });
  })();

  /* ------------------------------------------------ Programme progress (live) */
  // Every "Save to database" in the FOR3NSIQ progress report also saves a small "summary" (overall and
  // per-project actual / planned %). This reads only that field (public read, no key, about 1 KB) and
  // refreshes the progress block. If it can't be read, the figures written in the page stay.
  var PROGRESS_URL = 'https://firestore.googleapis.com/v1/projects/jda3-9c0c5/databases/(default)/documents/progressReport/current?mask.fieldPaths=summary';
  var PROGRESS_PROJECTS = { // the site's names and pages for each project code in the report
    '1': ['Infrastructure with Generative AI', '#project-1'],
    '2A': ['SAP PM Data Revitalisation', '#project-2a'], '2B': ['Vision Analytics', '#project-2b-3a'],
    '3A': ['Asset Integrity', '#project-2b-3a'], '4A': ['Maintenance & Reliability', '#project-4a'],
    '6A': ['Production Optimisation', '#project-6a'], '7': ['Work Process Efficiency', '#project-7'],
    'CDF': ['Contextual Data Fusion', '#project-cdf']
  };
  var progressBox = document.getElementById('progress');

  function fsValue(v) { // Firestore REST value -> plain JS value
    if (!v) return null;
    if ('mapValue' in v) {
      var o = {}, f = v.mapValue.fields || {};
      Object.keys(f).forEach(function (k) { o[k] = fsValue(f[k]); });
      return o;
    }
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsValue);
    if ('doubleValue' in v) return Number(v.doubleValue);
    if ('integerValue' in v) return Number(v.integerValue);
    if ('stringValue' in v) return v.stringValue;
    if ('booleanValue' in v) return v.booleanValue;
    return null;
  }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function pctText(v) { return isNum(v) ? v.toFixed(1) + '%' : '—'; }
  function ppText(a, p) { // variance to plan in percentage points, rounded as in the progress summary
    var d = Math.round((a - p) * 10) / 10;
    return (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d).toFixed(1);
  }
  function frac(v) { return Math.max(0, Math.min(1, (isNum(v) ? v : 0) / 100)).toFixed(3); }
  function dayText(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    var mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return m ? (+m[3]) + ' ' + mon[+m[2] - 1] + ' ' + m[1] : '';
  }
  function joinAnd(list) { return list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : (list[0] || ''); }

  function applyProgress(s) {
    if (!progressBox || !s || s.schema !== 1 || !s.overall || !isNum(s.overall.plan) || !s.projects || !s.projects.length) return false;
    var q = function (sel) { return progressBox.querySelector(sel); };
    var a = s.overall.actual, p = s.overall.plan;
    var date = dayText(s.asOf);
    if (date && q('[data-prog-date]')) q('[data-prog-date]').textContent = date;
    if (q('[data-prog-src]')) q('[data-prog-src]').textContent = 'updated automatically from the progress report';
    var big = q('[data-prog-actual]');
    if (big) { // keep the count-up in step: it always finishes on data-final
      var shown = isNum(a) ? a.toFixed(1) : '—';
      big.textContent = shown; big.dataset.final = shown; big.dataset.count = isNum(a) ? a.toFixed(1) : '0';
    }
    if (q('[data-prog-plan]')) q('[data-prog-plan]').textContent = pctText(p);
    if (q('[data-prog-var]')) q('[data-prog-var]').innerHTML = (isNum(a) ? ppText(a, p) : '—') + ' <small>pp</small>';
    if (q('[data-prog-bar]')) q('[data-prog-bar]').style.setProperty('--w', (isNum(a) && p > 0 ? Math.min(1, a / p) : 0).toFixed(3));

    var list = q('.pj__rows');
    if (list) {
      list.textContent = '';
      s.projects.forEach(function (r) {
        if (!r || !isNum(r.plan)) return;
        var info = PROGRESS_PROJECTS[r.code] || [r.name || r.code, null];
        var li = document.createElement('li');
        li.className = 'pj-row' + (r.code === 'CDF' ? ' pj-row--cdf' : '');
        var name = document.createElement(info[1] ? 'a' : 'span');
        name.className = 'pj-row__name';
        if (info[1]) name.setAttribute('href', info[1]);
        var badge = document.createElement('span');
        badge.className = 'code-badge'; badge.textContent = r.code;
        name.appendChild(badge); name.appendChild(document.createTextNode(info[0]));
        if (r.shared) {
          var tag = document.createElement('i');
          tag.className = 'pj-row__tag'; tag.textContent = 'T.AI + IBM';
          name.appendChild(document.createTextNode(' ')); name.appendChild(tag);
        }
        var track = document.createElement('span');
        track.className = 'pj-row__track'; track.setAttribute('aria-hidden', 'true');
        track.innerHTML = '<span class="pj-row__fill" style="--a:' + frac(r.actual) + '"></span><span class="pj-row__plan" style="--p:' + frac(r.plan) + '"></span>';
        var nums = document.createElement('span');
        nums.className = 'pj-row__nums';
        var ahead = isNum(r.actual) && Math.round((r.actual - r.plan) * 10) / 10 >= 0;
        nums.innerHTML = '<b>' + pctText(r.actual) + '</b><span class="sr-only"> actual,</span> / ' + pctText(r.plan) +
          '<span class="sr-only"> planned,</span> <span class="pj-row__d' + (ahead ? ' pj-row__d--ahead' : '') + '">' +
          (isNum(r.actual) ? ppText(r.actual, r.plan) : '—') + ' pp</span>';
        li.appendChild(name); li.appendChild(track); li.appendChild(nums);
        list.appendChild(li);
      });
    }
    var note = q('[data-prog-note]');
    if (note) {
      var codes = s.projects.filter(function (r) { return r && r.code !== 'CDF'; }).map(function (r) { return r.code; });
      var shared = s.projects.filter(function (r) { return r && r.shared; }).map(function (r) { return r.code; });
      note.textContent = 'Projects ' + joinAnd(codes) + (s.projects.some(function (r) { return r && r.code === 'CDF'; }) ? ' (excluding CDF)' : '') +
        ', weighted by task weight.' + (shared.length ? ' ' + joinAnd(shared) + (shared.length > 1 ? ' combine' : ' combines') + ' T.AI and IBM.' : '');
    }
    progressBox.classList.add('is-live');
    return true;
  }
  function applyProgressDoc(doc) { // a Firestore REST document -> the block
    return !!(doc && doc.fields && doc.fields.summary) && applyProgress(fsValue(doc.fields.summary));
  }
  window.__for3nsiqProgress = applyProgressDoc; // lets the site's tests feed in a sample database response

  if (progressBox && window.fetch) {
    fetch(PROGRESS_URL, { cache: 'no-store', credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(applyProgressDoc)
      .catch(function () { /* offline or blocked: keep the figures in the page */ });
  }

  /* ---------------------------------------------------------------- Dialogs */
  function openDialog(d) {
    if (!d || d.open) return;
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    body.classList.add('dialog-open');
  }
  function finishClose(d) {
    d.classList.remove('is-closing');
    if (d.open) d.close();
    if (!document.querySelector('dialog[open]')) body.classList.remove('dialog-open');
  }
  function closeDialog(d) {
    if (!d || !d.open) return;
    if (!root.classList.contains('motion') || !motionOK()) { finishClose(d); return; }
    d.classList.add('is-closing');
    setTimeout(function () { finishClose(d); }, 190);
  }
  $all('dialog.modal').forEach(function (d) {
    d.addEventListener('cancel', function (e) { e.preventDefault(); closeDialog(d); }); // Esc key
    d.addEventListener('close', function () { body.classList.remove('dialog-open'); });
    d.addEventListener('click', function (e) { if (e.target === d) closeDialog(d); });  // backdrop
  });

  var lightbox = document.getElementById('lightbox');
  function openLightbox(a) {
    if (!lightbox) return;
    var img = lightbox.querySelector('.lightbox__img');
    var cap = lightbox.querySelector('.lightbox__caption');
    var thumb = a.querySelector('img');
    var full = a.getAttribute('href');
    img.alt = thumb ? thumb.alt : '';
    img.src = thumb ? (thumb.currentSrc || thumb.src) : full; // show something instantly…
    var hi = new Image();
    hi.onload = function () { img.src = full; };              // …then swap in the full image
    hi.src = full;
    cap.textContent = a.dataset.caption || '';
    openDialog(lightbox);
  }

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-dialog-open]');
    if (opener) { openDialog(document.getElementById(opener.dataset.dialogOpen)); return; }
    var closer = e.target.closest('[data-dialog-close]');
    if (closer) { closeDialog(closer.closest('dialog')); return; }
    var lb = e.target.closest('a[data-lightbox]');
    if (lb && !(e.metaKey || e.ctrlKey || e.shiftKey)) { e.preventDefault(); openLightbox(lb); }
  });

  /* ----------------------------------------------------- Agent filter (6A) */
  $all('.filter-bar').forEach(function (bar) {
    var list = document.getElementById(bar.dataset.filterTarget);
    if (!list) return;
    var items = Array.prototype.slice.call(list.children);
    var status = bar.querySelector('[data-filter-status]');
    bar.hidden = false;
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-filter]');
      if (!btn) return;
      var f = btn.dataset.filter;
      $all('[data-filter]', bar).forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      var shown = 0;
      items.forEach(function (it) {
        var show = f === 'all' || it.dataset.cat === f;
        it.hidden = !show;
        if (!show) return;
        shown++;
        if (motionOK()) { it.classList.remove('pop-in'); void it.offsetWidth; it.classList.add('pop-in'); }
      });
      if (status) status.textContent = 'Showing ' + shown + ' of ' + items.length + ' agents';
    });
  });

  /* --------------------------------------------- Highlights timeline (home) */
  // The film strip is a native scroll-snap row (so touch swiping has real momentum). This adds:
  // the "active" card (centred one), the date rail + progress, mouse drag, arrows, keys and rail clicks.
  var hlRoot = document.querySelector('[data-highlights]');
  if (hlRoot) (function () {
    var track = hlRoot.querySelector('.hl-track');
    var cards = $all('.hl-card', hlRoot);
    var nodes = $all('.hl-node', hlRoot);
    var progress = hlRoot.querySelector('.hl-rail__progress');
    var count = hlRoot.querySelector('[data-hl-count]');
    var live = hlRoot.querySelector('[data-hl-live]');
    var steps = $all('[data-hl-step]', hlRoot);
    var active = -1;
    var drag = null;
    var suppressClick = false;
    if (!track || !cards.length) return;
    hlRoot.classList.add('is-ready');

    function centreOf(card) { return card.offsetLeft + card.offsetWidth / 2; }
    function nearest(centre) {
      var best = 0, bestD = Infinity;
      cards.forEach(function (c, i) { var dist = Math.abs(centreOf(c) - centre); if (dist < bestD) { bestD = dist; best = i; } });
      return best;
    }
    function viewCentre() { return track.scrollLeft + track.clientWidth / 2; }
    function label(i) {
      var c = cards[i];
      return c.getAttribute('aria-label') + ': ' + c.querySelector('.hl-card__title').textContent + ', ' + c.querySelector('time').textContent;
    }
    function setActive(i, announce) {
      if (i !== active) {
        active = i;
        cards.forEach(function (c, k) { c.classList.toggle('is-active', k === i); });
        nodes.forEach(function (n, k) { setCurrent(n, k === i); n.classList.toggle('is-past', k < i); });
        var li = nodes[i] ? nodes[i].parentElement : null;
        if (progress && li) {
          progress.style.setProperty('--p', getComputedStyle(li).getPropertyValue('--pos').trim() || '0');
          progress.style.setProperty('--pm-p', getComputedStyle(li).getPropertyValue('--pm').trim() || '0');
        }
        if (count) count.textContent = (i + 1) + ' / ' + cards.length;
        steps.forEach(function (b) {
          var t = i + Number(b.dataset.hlStep);
          b.disabled = t < 0 || t >= cards.length;
        });
      }
      if (announce && live) live.textContent = label(i);
    }
    // While a button/key/rail scroll is animating, keep its target card active (so quick repeated
    // clicks keep advancing instead of reading the half-way scroll position).
    var target = null, settleTimer = null;
    function release() {
      target = null;
      clearTimeout(settleTimer);
      hlRoot.classList.remove('is-gliding'); // a drag's glide has landed: snapping back on
      setActive(nearest(viewCentre()), false);
    }
    function goTo(i, announce) {
      i = Math.max(0, Math.min(cards.length - 1, i));
      var max = track.scrollWidth - track.clientWidth;
      var left = Math.max(0, Math.min(max, centreOf(cards[i]) - track.clientWidth / 2));
      var smooth = motionOK() && Math.abs(left - track.scrollLeft) > 1;
      if (smooth) { target = i; clearTimeout(settleTimer); settleTimer = setTimeout(release, 900); }
      track.scrollTo({ left: left, behavior: smooth ? 'smooth' : 'auto' });
      setActive(i, announce);
    }

    // Follow the scroll (touch swipes, trackpads, snapping).
    var scrollFrame = null;
    track.addEventListener('scroll', function () {
      if (drag) return;
      if (target !== null) { clearTimeout(settleTimer); settleTimer = setTimeout(release, 150); return; }
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(function () { scrollFrame = null; setActive(nearest(viewCentre()), false); });
    }, { passive: true });
    track.addEventListener('scrollend', function () { if (target !== null) release(); });
    // Keep the active card centred when the window (and so the card width) changes.
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (track.offsetParent && active >= 0) track.scrollLeft = centreOf(cards[active]) - track.clientWidth / 2;
      }, 150);
    });

    // Mouse drag with a little momentum, then snap to the nearest card.
    track.addEventListener('dragstart', function (e) { e.preventDefault(); });
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      target = null; clearTimeout(settleTimer); // grabbing the strip mid-animation takes over
      hlRoot.classList.remove('is-gliding');
      drag = { x: e.clientX, left: track.scrollLeft, moved: false, samples: [{ x: e.clientX, t: e.timeStamp }] };
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (!drag.moved) {
        if (Math.abs(dx) < 6) return;
        drag.moved = true;
        hlRoot.classList.add('is-dragging');
      }
      track.scrollLeft = drag.left - dx;
      drag.samples.push({ x: e.clientX, t: e.timeStamp });
      if (drag.samples.length > 6) drag.samples.shift();
      setActive(nearest(viewCentre()), false);
    });
    window.addEventListener('pointerup', function (e) {
      if (!drag) return;
      var d = drag;
      drag = null;
      if (!d.moved) return;
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 0);
      var recent = d.samples.filter(function (sm) { return e.timeStamp - sm.t <= 100; });
      var v = recent.length > 1 ? (recent[recent.length - 1].x - recent[0].x) / Math.max(1, recent[recent.length - 1].t - recent[0].t) : 0;
      // Pick the landing card from where the drag left off (a flick carries on a little), and keep
      // snapping off until we get there: switching it back on now would jump to the nearest card first.
      var dest = nearest(viewCentre() - v * 180);
      hlRoot.classList.add('is-gliding');
      hlRoot.classList.remove('is-dragging');
      goTo(dest, false);
      if (target === null) hlRoot.classList.remove('is-gliding'); // no glide (reduced motion): already there
    });
    // A drag must not open the photo underneath it.
    track.addEventListener('click', function (e) {
      if (suppressClick) { e.preventDefault(); e.stopPropagation(); return; }
      // Clicking a dimmed side card brings it to the centre first.
      var card = e.target.closest('.hl-card');
      var i = cards.indexOf(card);
      if (card && i !== active) { e.preventDefault(); e.stopPropagation(); goTo(i, true); }
    }, true);

    track.addEventListener('keydown', function (e) {
      var map = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: cards.length - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      goTo(map[e.key], true);
    });
    steps.forEach(function (b) { b.addEventListener('click', function () { goTo(active + Number(b.dataset.hlStep), true); }); });
    nodes.forEach(function (n) { n.addEventListener('click', function () { goTo(Number(n.dataset.hlGo), true); }); });

    setActive(0, false);
  })();

  /* ------------------------------------------------------ Hero hotspots + tilt */
  // Hover or keyboard focus shows a label (CSS); a tap or click pins it open. Tap elsewhere or Esc closes.
  var hotspots = $all('.hotspot');
  function closeHotspots(except) {
    hotspots.forEach(function (h) {
      if (h === except) return;
      h.classList.remove('is-open');
      var b = h.querySelector('.hotspot__dot');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  hotspots.forEach(function (h) {
    var dot = h.querySelector('.hotspot__dot');
    if (!dot) return;
    dot.addEventListener('click', function () {
      var open = !h.classList.contains('is-open');
      closeHotspots(h);
      h.classList.toggle('is-open', open);
      dot.setAttribute('aria-expanded', String(open));
    });
    h.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') closeHotspots(h); });
  });
  if (hotspots.length) {
    document.addEventListener('click', function (e) { if (!e.target.closest('.hotspot')) closeHotspots(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeHotspots(); });
  }

  // The illustration tilts slightly toward the mouse (desktop only, never with reduced motion).
  var heroFrame = document.querySelector('.hero__frame');
  if (heroFrame && root.classList.contains('motion')) {
    var heroVisual = heroFrame.parentElement;
    var tiltFrame = null;
    heroVisual.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || !motionOK()) return;
      var r = heroFrame.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      if (tiltFrame) cancelAnimationFrame(tiltFrame);
      tiltFrame = requestAnimationFrame(function () {
        heroFrame.style.setProperty('--ry', (px * 6).toFixed(2) + 'deg');
        heroFrame.style.setProperty('--rx', (py * -5).toFixed(2) + 'deg');
      });
    });
    heroVisual.addEventListener('pointerleave', function () {
      heroFrame.style.setProperty('--ry', '0deg');
      heroFrame.style.setProperty('--rx', '0deg');
    });
  }

  /* ------------------------------------------------------- Signed-in user */
  // middleware.js sets a readable "f3_user" cookie (the real session cookie is HttpOnly).
  // No cookie means sign-in is off (or nobody is signed in), so the sign-out button stays hidden.
  var userMatch = document.cookie.match(/(?:^|;\s*)f3_user=([^;]+)/);
  if (userMatch) {
    var userName = decodeURIComponent(userMatch[1]);
    $all('[data-user]').forEach(function (el) { el.textContent = userName; });
    $all('[data-user-wrap]').forEach(function (el) { el.hidden = false; });
    $all('[data-signout]').forEach(function (el) { el.title = 'Sign out (' + userName + ')'; el.hidden = false; });
  }

  /* ------------------------------------------------------------ First route */
  route(location.hash, { smooth: false });
})();
