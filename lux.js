/* ==========================================================================
   RICHMOND ELEVATOR — motion layer ("The Cab")
   Adds transitions and tactile feedback on top of the existing app without
   touching its logic. It works by watching how screens are swapped:

     • #app.innerHTML = …      (home, wizard steps, history, drafts, saved)
     • #main / #footer content (timesheet steps)

   The outgoing screen is parked in a "ghost" layer so it can animate away
   while the new one animates in. Everything is skipped for people who have
   "Reduce Motion" turned on.

   Switches (edit here):
     INTRO       door-opening intro once per app launch. false = off.
   Add ?intro to the URL to force the intro to play again while testing.
   ========================================================================== */
(function () {
  'use strict';

  var INTRO = true;

  var doc = document, root = doc.documentElement, app = doc.getElementById('app');
  if (!app || !app.animate) return;                       // very old browser: leave the app exactly as it was

  var RM = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var EASE = 'cubic-bezier(.32,.72,0,1)';                // weighted glide
  var OUT  = 'cubic-bezier(.16,1,.3,1)';                 // fast start, long settle
  var IN   = 'cubic-bezier(.5,0,.75,0)';                 // accelerating exit

  var reduce = function () { return RM.matches; };
  var each = function (l, f) { Array.prototype.forEach.call(l, f); };
  var vib = function (p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

  function el(tag, cls) { var e = doc.createElement(tag); if (cls) e.className = cls; return e; }
  function anim(node, frames, opts, done) {
    var a = node.animate(frames, opts);
    if (done) a.onfinish = done;
    return a;
  }
  /* a parked, detached screen must never answer to the app's queries or taps */
  function strip(n) {
    each(n.querySelectorAll('[id]'), function (e) { e.removeAttribute('id'); });
    each(n.querySelectorAll('[data-p]'), function (e) { e.removeAttribute('data-p'); });
    n.setAttribute('aria-hidden', 'true');
    n.setAttribute('inert', '');
  }

  /* ---- which way are we travelling? ------------------------------------ */
  var nav = { back: false, t: 0 };
  doc.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('a,button');
    if (!t) return;
    var sig = (t.getAttribute('onclick') || '') + ' ' + t.id + ' ' + t.className;
    nav.back = /goBack\(|(^|[^\w.])home\(|fx-back|fx-home|\bbk\b|tsBack/.test(sig);
    nav.t = Date.now();
  }, true);
  var dirNow = function () { return nav.back && Date.now() - nav.t < 1200 ? -1 : 1; };

  /* ---- reading a screen --------------------------------------------------- */
  function snap() {
    var top = app.querySelector(':scope > .top');
    var main = app.querySelector(':scope > main');
    var fill = app.querySelector(':scope > .top .prog i');
    var h = top && top.querySelector('h1.pt');
    return {
      top: !!top,
      main: main,
      home: !!(main && main.classList.contains('home')),
      title: h ? h.textContent : '',
      pct: fill ? (parseFloat(fill.style.width) || 0) : null,
      scroll: main ? main.scrollTop : 0
    };
  }
  function classify(a, b) {
    if (a.home && b.home) return 'refresh';                                  // same screen redrawn
    if (a.top && b.top && a.title === b.title && a.pct === b.pct) return 'refresh';   // e.g. shuffle a topic
    if (a.pct != null && b.pct != null) return 'step';                       // wizard step → step
    return 'push';                                                           // everything else
  }

  /* ---- transitions -------------------------------------------------------- */
  function clearGhosts() {
    each(app.querySelectorAll(':scope > .lux-ghost'), function (g) {
      g.getAnimations().forEach(function (a) { a.cancel(); });
      g.remove();
    });
  }

  /* content glides in from the direction of travel, one item after another */
  function cascade(main, dir) {
    if (!main) return;
    var stack = main.querySelector(':scope > .fx-stack');
    var items = [].filter.call((stack || main).children, function (n) { return n.nodeType === 1; });
    items.slice(0, 9).forEach(function (n, i) {
      n.animate(
        [{ opacity: 0, transform: 'translateX(' + dir * 26 + 'px)' }, { opacity: 1, transform: 'none' }],
        { duration: 620, delay: 50 + i * 42, easing: OUT, fill: 'backwards' }
      );
    });
  }

  /* wizard step → step: the header stays put, the body changes */
  function stepSwap(oldKids, before, after, dir) {
    var oldMain = before.main, nm = after.main;
    if (oldMain && nm) {
      var g = el('div', 'lux-ghost');
      g.style.top = nm.offsetTop + 'px';
      g.style.height = nm.offsetHeight + 'px';
      g.appendChild(oldMain);
      strip(g);
      app.appendChild(g);
      oldMain.scrollTop = before.scroll;
      anim(g, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + (-dir * 28) + 'px)' }],
        { duration: 230, easing: IN, fill: 'forwards' }, function () { g.remove(); });
    }
    /* the progress rail glides from where it was to where it is now */
    var f = app.querySelector(':scope > .top .prog i');
    if (f && before.pct != null) {
      var to = parseFloat(f.style.width) || 0;
      if (to !== before.pct) f.animate([{ width: before.pct + '%' }, { width: to + '%' }], { duration: 900, easing: EASE });
    }
    var h = app.querySelector(':scope > .top h1.pt');
    if (h) h.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: OUT });
    cascade(nm, dir);
  }

  /* any other screen change: shared-axis slide, old fades out as new arrives */
  function pushSwap(oldKids, before, dir) {
    var g = el('div', 'lux-ghost lux-ghost-page');
    oldKids.forEach(function (k) { g.appendChild(k); });
    strip(g);
    app.appendChild(g);
    if (before.main) before.main.scrollTop = before.scroll;
    anim(g, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + (-dir * 44) + 'px)' }],
      { duration: 240, easing: IN, fill: 'forwards' }, function () { g.remove(); });
    each(app.children, function (k) {
      if (k.classList.contains('lux-ghost')) return;
      k.animate([{ opacity: 0, transform: 'translateX(' + dir * 56 + 'px)' }, { opacity: 1, transform: 'none' }],
        { duration: 560, delay: 110, easing: OUT, fill: 'backwards' });
    });
  }

  /* ---- hook: every full-screen swap goes through here ------------------ */
  var desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(app, 'innerHTML', {
    configurable: true,
    get: function () { return desc.get.call(this); },
    set: function (html) {
      var before = snap();
      var oldKids = [].filter.call(app.children, function (n) { return !n.classList.contains('lux-ghost'); });
      clearGhosts();
      desc.set.call(app, html);
      var after = snap();
      var mode = 'none';
      if (oldKids.length && !reduce()) {
        mode = classify(before, after);
        var dir = dirNow();
        if (mode === 'refresh') { if (after.main && before.scroll) after.main.scrollTop = before.scroll; }
        else if (mode === 'step') stepSwap(oldKids, before, after, dir);
        else pushSwap(oldKids, before, dir);
      }
      post(after, mode);
    }
  });

  /* ---- timesheet: only #main / #footer change between steps ------------ */
  var tsMain = null, tsObs = null, tsScroll = 0, tsSig = '';
  var sigOf = function (m) { var h = m && m.querySelector('h1'); return h ? h.textContent : ''; };

  function watchTs() {
    var m = app.querySelector('#main');
    if (m === tsMain) return;
    if (tsObs) tsObs.disconnect();
    tsMain = m; tsScroll = 0; tsSig = '';
    if (!m) { tsObs = null; return; }
    m.addEventListener('scroll', function () { tsScroll = m.scrollTop; }, { passive: true });
    tsObs = new MutationObserver(function (recs) { onTsMain(m, recs); });
    tsObs.observe(m, { childList: true });
  }
  function onTsMain(m, recs) {
    var removed = [];
    recs.forEach(function (r) { each(r.removedNodes, function (n) { if (n.nodeType === 1) removed.push(n); }); });
    var sig = sigOf(m), dir = dirNow(), scroll = tsScroll;
    markFilled(m);
    var first = !tsSig;
    if (!removed.length || reduce()) { tsSig = sig; if (first) countUp(m); return; }
    if (sig === tsSig) { m.scrollTop = scroll; return; }            // same step redrawn: keep place
    tsSig = sig;

    var g = el('div', 'lux-ghost');
    g.style.top = m.offsetTop + 'px';
    g.style.height = m.offsetHeight + 'px';
    var gm = m.cloneNode(false);
    removed.forEach(function (n) { gm.appendChild(n); });
    g.appendChild(gm);
    strip(g);
    app.appendChild(g);
    gm.scrollTop = scroll;
    anim(g, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + (-dir * 28) + 'px)' }],
      { duration: 230, easing: IN, fill: 'forwards' }, function () { g.remove(); });

    m.scrollTop = 0; tsScroll = 0;
    cascade(m, dir);
    countUp(m);
    ['floorText', 'floorPct'].forEach(function (id) {
      var n = doc.getElementById(id);
      if (n) n.animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: OUT });
    });
    var f = doc.getElementById('footer');
    if (f) each(f.children, function (c, i) {
      c.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
        { duration: 420, delay: 120 + i * 50, easing: OUT, fill: 'backwards' });
    });
    if (m.querySelector('.checkmark')) vib([12, 60, 22]);
  }

  /* ---- after any swap -------------------------------------------------- */
  function post(info, mode) {
    watchTs();
    markFilled(app);
    if (mode !== 'refresh') countUp(app);
    if (!info.home) root.classList.add('lux-booted');                 // home entrance only plays once
    if (mode !== 'refresh' && app.querySelector('.checkmark')) vib([12, 60, 22]);
  }

  /* ---- call-button lighting: cards glow once they have content --------- */
  function isFilled(c) {
    var ins = c.querySelectorAll('input,textarea');
    for (var i = 0; i < ins.length; i++) {
      var t = ins[i].type;
      if (t === 'checkbox' || t === 'file' || t === 'hidden') continue;
      var v = (ins[i].value || '').trim();
      if (v && !/^(H|T|MT|MH)-?$/i.test(v)) return true;               // a bare job prefix doesn't count
    }
    return false;
  }
  function markFilled(scope) {
    each(scope.querySelectorAll('.fcard,.topic-card'), function (c) { c.classList.toggle('is-filled', isFilled(c)); });
  }
  doc.addEventListener('input', function (e) {
    var c = e.target.closest && e.target.closest('.fcard,.topic-card');
    if (c) c.classList.toggle('is-filled', isFilled(c));
  }, true);

  /* ---- totals count up ---------------------------------------------------- */
  function countUp(scope) {
    if (reduce()) return;
    each(scope.querySelectorAll('.totals-card .t-row span:last-child'), function (s, i) {
      var txt = s.textContent, m = txt.match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/);
      if (!m) return;
      var num = parseFloat(m[2].replace(/,/g, ''));
      if (!isFinite(num) || num === 0) return;
      var dec = (m[2].split('.')[1] || '').length;
      var start = performance.now() + 160 + i * 90, dur = 950;
      s.textContent = m[1] + (0).toFixed(dec) + m[3];
      (function tick(t) {
        var p = Math.max(0, Math.min(1, (t - start) / dur));
        s.textContent = m[1] + (num * (1 - Math.pow(1 - p, 4))).toFixed(dec) + m[3];
        if (p < 1) requestAnimationFrame(tick); else s.textContent = txt;
      })(performance.now());
    });
  }

  /* ---- press light + haptic -------------------------------------------- */
  var PRESS = 'button,.card,.mc,.li,.seg-btn,.add-receipts-btn,.edit-btn,.toggle-row';
  doc.addEventListener('pointerdown', function (e) {
    if (reduce()) return;
    var t = e.target.closest && e.target.closest(PRESS);
    if (!t || t.disabled || t.closest('[inert]')) return;
    var r = t.getBoundingClientRect(), d = Math.max(r.width, r.height) * 1.7;
    var s = el('i', 'lux-rip');
    s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
    t.appendChild(s);
    setTimeout(function () { s.remove(); }, 900);
    if (t.matches('.primary,.bar button:not(.g),.card,.mc')) vib(7);
  }, { passive: true });

  /* ---- toasts and sheets get proper exits ------------------------------- */
  new MutationObserver(function (recs) {
    recs.forEach(function (r) {
      each(r.addedNodes, function (n) {
        if (n.nodeType !== 1 || n.__gone) return;
        if (n.classList.contains('toast')) setTimeout(function () { n.classList.add('out'); }, 1850);
      });
      each(r.removedNodes, function (n) {
        if (n.nodeType !== 1 || n.__gone || reduce()) return;
        if (n.classList.contains('ov')) {
          n.__gone = true;
          strip(n);
          n.classList.add('leaving');
          doc.body.appendChild(n);
          setTimeout(function () { n.remove(); }, 420);
        }
      });
    });
  }).observe(doc.body, { childList: true });

  /* ---- the doors ------------------------------------------------------------
     The Richmond mark is a peak split down the middle, so it splits across
     the door seam and parts with the doors.                                     */
  var HALF_L = '<svg viewBox="0 0 176 160"><path d="M176 2 2 158h174z"/><path d="M176 70 16 150M176 100 54 154M176 128 98 157" fill="none"/></svg>';
  var HALF_R = '<svg viewBox="0 0 176 160"><path d="M0 2l174 156H0z"/><path d="M0 70l160 80M0 100l122 54M0 128l78 29" fill="none"/></svg>';

  function intro() {
    var seen = false;
    try { seen = sessionStorage.getItem('luxIntro'); } catch (e) {}
    var force = /[?&]intro\b/.test(location.search);
    if (!INTRO || reduce() || (seen && !force)) return;
    try { sessionStorage.setItem('luxIntro', '1'); } catch (e) {}

    root.classList.add('lux-boot');
    var d = el('div'); d.id = 'lux-doors'; d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<div class="bloom"></div><div class="door l">' + HALF_L + '</div><div class="door r">' + HALF_R + '</div><div class="seam"></div>';
    doc.body.appendChild(d);

    var opened = false;
    function open(fast) {
      if (opened) return; opened = true;
      if (fast) d.classList.add('fast');
      d.classList.add('open');
      d.style.pointerEvents = 'none';
      setTimeout(function () { root.classList.remove('lux-boot'); }, fast ? 100 : 420);
      setTimeout(function () { d.remove(); }, fast ? 700 : 1600);
    }
    requestAnimationFrame(function () { requestAnimationFrame(function () { d.classList.add('lit'); }); });
    setTimeout(function () { open(false); }, 950);
    d.addEventListener('pointerdown', function () { open(true); });
  }
  intro();

  /* the home entrance is a one-time arrival; after that, pages simply travel */
  setTimeout(function () { root.classList.add('lux-booted'); }, 3600);
})();
