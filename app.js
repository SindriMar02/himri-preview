// Himri: behaviour + motion in one module. Identity: "warm light" (see MOTION.md).
// One scroll engine (GSAP ScrollTrigger), Lenis on fine pointers only, reveals tied to position over short
// bands and reversible, the trigger element never moves, reduced motion = plain render.
import { mountBooking } from '/himri-preview/booking.js';
const html = document.documentElement;
const readyFailsafe = setTimeout(() => html.classList.add('ready'), 4000);
const { gsap, ScrollTrigger, SplitText } = window;
gsap.registerPlugin(ScrollTrigger, SplitText);
ScrollTrigger.config({ ignoreMobileResize: true });
gsap.ticker.lagSmoothing(0);

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const touchMQ = matchMedia('(hover: none) and (pointer: coarse)');
const fineMQ = matchMedia('(hover: hover) and (pointer: fine)');
const isTouch = () => touchMQ.matches;
const isFine = () => fineMQ.matches && !touchMQ.matches;
const SCRUB = () => (isTouch() ? 0.35 : true);
const wide = () => innerWidth >= 1024;
const photos = JSON.parse($('#photo-data').textContent);
const menu = $('#site-menu'), trigger = $('.menu-trigger'), header = $('.site-header');
const book = $('#book'), lightbox = $('.lightbox');
const veil = $('.page-transition'), loader = $('.loader');
let context, arrivalTimeline, pageCleanup = () => {}, splits = [];
let lenis, lenisTick;
let menuOpen = false, lockedY = 0, overlayOpener = null, menuTimeline;
let photoIndex = 0, photoSet = photos, photoRequest = 0;
let routeRequest = 0, routeController = null, routePending = false;
let lastPath = location.pathname + location.search;
const scrollPositions = new Map();
const initialState = { ...history.state, himriKey: history.state?.himriKey || crypto.randomUUID() };
history.replaceState(initialState, '');
history.scrollRestoration = 'manual';
let currentKey = initialState.himriKey;
html.classList.toggle('motion-on', !reduced.matches);
const locked = () => document.body.classList.contains('is-locked');

// ---------- scrolling ----------
function setScroll(y) {
  window.scrollTo({ top: y, behavior: 'instant' });
  if (lenis) { lenis.resize(); lenis.scrollTo(y, { immediate: true, force: true }); }
}
function refresh() { if (!locked()) ScrollTrigger.refresh(); }
function configureScroll() {
  if (lenisTick) gsap.ticker.remove(lenisTick);
  lenis?.destroy(); lenis = null; lenisTick = null;
  if (!isFine() || reduced.matches || !window.Lenis) return;
  lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true, syncTouch: false, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  lenisTick = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(lenisTick);
  if (locked()) lenis.stop();
}
function lockScroll() {
  if (locked()) return;
  lockedY = window.scrollY;
  document.body.style.top = `${-lockedY}px`;
  document.body.classList.add('is-locked');
  html.classList.add('overlay-open');
  $('meta[name="theme-color"]').content = '#4e141a';
  lenis?.stop();
}
function unlockScroll() {
  if (!locked()) return;
  document.body.classList.remove('is-locked');
  html.classList.remove('overlay-open');
  $('meta[name="theme-color"]').content = '#f8d0c1';
  document.body.style.top = '';
  lenis?.start();
  setScroll(lockedY);
  refresh();
}
function inertPage(value) { for (const el of [header, $('#main'), $('.site-footer')]) el.inert = value; }
function focusables(root) {
  return $$('a[href],button:not(:disabled),summary,[tabindex="0"]', root).filter((el) => !el.hidden && el.getClientRects().length && !el.closest('[hidden],[inert]'));
}

// ---------- menu: the wine panel wipes in from the left, links rise through masks, the kitchen slides in ----------
function buildMenu() {
  menuTimeline = gsap.timeline({ paused: true })
    .fromTo(menu, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.95, ease: 'expo.inOut' }, 0)
    .fromTo('#site-menu .mask-in', { yPercent: 110 }, { yPercent: 0, duration: 0.85, stagger: 0.07, ease: 'power4.out' }, 0.35)
    .fromTo('#site-menu .menu-photo-in', { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 1, ease: 'power3.out' }, 0.45)
    .fromTo('#site-menu .menu-photo-in img', { scale: 1.12 }, { scale: 1, duration: 1.6, ease: 'power3.out' }, 0.45)
    .fromTo(['#site-menu .menu-top', '#site-menu .menu-content > .location', '#site-menu .menu-bottom', '#site-menu .menu-photo > p'], { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 0.55);
  gsap.set('#site-menu .mask-in', { clearProps: 'transform' });
}
function setMenu(open, event, returnFocus = true, immediate = false) {
  if (open === menuOpen) return;
  menuOpen = open;
  const plain = immediate || reduced.matches || event?.detail === 0;
  trigger.setAttribute('aria-expanded', String(open));
  trigger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  gsap.to($$('.hamburger i', trigger), { rotation: (i) => (open ? (i ? -45 : 45) : 0), y: (i) => (open ? (i ? -3.5 : 3.5) : 0), duration: plain ? 0 : 0.35, ease: 'power3.out', overwrite: true });
  if (open) {
    overlayOpener = trigger;
    menu.hidden = false; menu.inert = false; menu.style.pointerEvents = '';
    inertPage(true); lockScroll();
    (event?.detail === 0 ? $('nav a', menu) : menu).focus({ preventScroll: true });
    if (plain) menuTimeline.pause().progress(1); else menuTimeline.timeScale(1).play();
  } else {
    menu.inert = true; menu.style.pointerEvents = 'none';
    inertPage(false); unlockScroll();
    if (returnFocus) trigger.focus({ preventScroll: true });
    const finish = () => { if (!menuOpen) menu.hidden = true; };
    menuTimeline.eventCallback('onReverseComplete', finish);
    if (plain) { menuTimeline.pause().progress(0); finish(); } else menuTimeline.timeScale(1.5).reverse();
  }
}
trigger.addEventListener('click', (event) => setMenu(!menuOpen, event));
$('.menu-close').addEventListener('click', () => setMenu(false));
menu.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { event.preventDefault(); setMenu(false); }
  if (event.key !== 'Tab') return;
  const items = focusables(menu), first = items[0], last = items.at(-1);
  if (event.shiftKey && (document.activeElement === first || document.activeElement === menu)) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === menu)) { event.preventDefault(); first.focus(); }
});

// ---------- dialogs ----------
const plainMotion = (event) => reduced.matches || event?.detail === 0;
function animateDialog(el, open, done = () => {}, plain = false) {
  el.getAnimations().forEach((a) => a.cancel());
  if (plain) { done(); return; }
  const frames = open
    ? [{ opacity: 0, transform: 'translateY(10px) scale(.985)' }, { opacity: 1, transform: 'none' }]
    : [{ opacity: getComputedStyle(el).opacity, transform: 'none' }, { opacity: 0, transform: 'translateY(4px)' }];
  el.animate(frames, { duration: open ? 280 : 180, easing: 'cubic-bezier(.22,1,.36,1)' }).finished.then(done).catch(() => {});
}
function openDialog(dialog, event) {
  const opener = event?.currentTarget instanceof HTMLElement ? event.currentTarget : document.activeElement;
  if (menuOpen) setMenu(false, null, false, true);
  overlayOpener = opener;
  lockScroll();
  dialog.tabIndex = -1;
  dialog.showModal();
  (event?.detail === 0 ? focusables(dialog)[0] : dialog).focus({ preventScroll: true });
  animateDialog(dialog, true, () => {}, plainMotion(event));
}
function closeDialog(dialog, event) {
  if (!dialog.open) return;
  animateDialog(dialog, false, () => dialog.close(), plainMotion(event));
}
for (const dialog of [lightbox]) {
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeDialog(dialog, { detail: 0 }); });
  dialog.addEventListener('close', () => {
    dialog.getAnimations().forEach((a) => a.cancel());
    unlockScroll();
    if (overlayOpener?.isConnected && !overlayOpener.closest('[hidden],[inert]')) overlayOpener.focus({ preventScroll: true });
    else trigger.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog(dialog, event);
  });
}
$('[data-close-photo]').addEventListener('click', (e) => closeDialog(lightbox, e));


// ---------- the booking sheet: SNDR Bókun's request flow, drawer from the right (phone: sheet from the bottom) ----------
const bookBar = $('.bk-bar', book), bookBg = $('.bk-bg', book);
const bookPhone = () => !matchMedia('(min-width: 768px)').matches;
const booking = mountBooking(book, { min: 2, max: 10 });
const tweenTo = (target, vars) => new Promise((resolve) => gsap.to(target, { ...vars, onComplete: resolve, onInterrupt: resolve }));
function openBooking(trigger, viaKey = false) {
  if (menuOpen) setMenu(false, null, false, true);
  if (lightbox.open) lightbox.close();
  booking.prepare();
  if (booking.step === 'done') booking.reset(); // a sent request never greets the next open
  overlayOpener = trigger;
  lockScroll();
  if (!book.open) book.showModal();
  gsap.killTweensOf([bookBar, bookBg]);
  const from = bookPhone() ? { yPercent: 100, xPercent: 0 } : { xPercent: 100, yPercent: 0 };
  if (!viaKey && !reduced.matches) {
    gsap.fromTo(bookBar, from, { xPercent: 0, yPercent: 0, duration: 0.55, ease: 'expo.out' });
    gsap.fromTo(bookBg, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' });
  } else { gsap.set(bookBar, { xPercent: 0, yPercent: 0 }); gsap.set(bookBg, { opacity: 1 }); }
  (viaKey ? booking.firstDay() || bookBar : bookBar).focus({ preventScroll: true });
}
async function closeBooking(instant = false) {
  if (!book.open) return;
  gsap.killTweensOf([bookBar, bookBg]);
  if (!instant && !reduced.matches) {
    const to = bookPhone() ? { yPercent: 100 } : { xPercent: 100 };
    await Promise.all([tweenTo(bookBar, { ...to, duration: 0.3, ease: 'power2.out' }), tweenTo(bookBg, { opacity: 0, duration: 0.25, ease: 'power2.out' })]);
  }
  book.close();
  unlockScroll(); // the close event is queued; release the page now, the event only returns focus
}
book.addEventListener('cancel', (e) => { e.preventDefault(); closeBooking(true); });
book.addEventListener('close', () => {
  unlockScroll();
  if (overlayOpener?.isConnected && !overlayOpener.closest('[hidden],[inert]')) overlayOpener.focus({ preventScroll: true });
  else trigger.focus({ preventScroll: true });
});
$$('[data-book-close]', book).forEach((el) => el.addEventListener('click', (e) => closeBooking(e.detail === 0)));
book.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  const items = focusables(book), first = items[0], last = items.at(-1);
  if (event.shiftKey && (document.activeElement === first || document.activeElement === bookBar)) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

// ---------- lightbox ----------
function visiblePhotos() {
  const gallery = $('.gallery-grid');
  if (!gallery) return photos;
  return $$('figure:not([hidden]) [data-photo]', gallery).map((el) => photos.find((im) => im.id === el.dataset.photo));
}
function changeImage(el) {
  el.getAnimations().forEach((a) => a.cancel());
  if (reduced.matches) return;
  el.animate([{ opacity: 0.3, transform: 'translateY(8px) scale(1.01)' }, { opacity: 1, transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.22,1,.36,1)' });
}
function showPhoto(index) {
  photoIndex = (index + photoSet.length) % photoSet.length;
  const selected = photoSet[photoIndex], request = ++photoRequest, image = $('[data-full-photo]');
  image.alt = selected.alt; image.width = selected.width; image.height = selected.height;
  image.onerror = () => { if (request !== photoRequest) return; image.hidden = true; $('.photo-error').hidden = false; };
  image.src = `/images/${selected.id}.webp`;
  image.hidden = false;
  $('.photo-error').hidden = true;
  $('#photo-title').textContent = selected.title;
  $('[data-photo-count]').textContent = `${photoIndex + 1} / ${photoSet.length}`;
  changeImage(image);
  const next = new Image();
  next.src = `/images/${photoSet[(photoIndex + 1) % photoSet.length].id}.webp`;
}
$('[data-photo-prev]').addEventListener('click', () => showPhoto(photoIndex - 1));
$('[data-photo-next]').addEventListener('click', () => showPhoto(photoIndex + 1));
lightbox.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); showPhoto(photoIndex + (event.key === 'ArrowRight' ? 1 : -1)); }
});
let touchStart = null;
$('.lightbox-stage').addEventListener('touchstart', (event) => { touchStart = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }, { passive: true });
$('.lightbox-stage').addEventListener('touchmove', (event) => { if (event.touches.length !== 1) touchStart = null; }, { passive: true });
$('.lightbox-stage').addEventListener('touchend', (event) => {
  if (!touchStart || window.visualViewport?.scale > 1.05) { touchStart = null; return; }
  const t = event.changedTouches[0], dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) showPhoto(photoIndex + (dx < 0 ? 1 : -1));
  touchStart = null;
}, { passive: true });
$('.lightbox-stage').addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });

// ---------- reveals: lines come out of a soft blur, photographs wipe up from the bottom ----------
function splitLines(el) {
  const split = new SplitText(el, { type: 'lines', linesClass: 'ln' });
  splits.push(split);
  return split.lines;
}
const blurFrom = () => (isTouch() ? { opacity: 0, y: 14 } : { opacity: 0, y: 18, filter: 'blur(12px)' });
const blurTo = () => (isTouch() ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, filter: 'blur(0px)' });
function initPageMotion({ arrival = 'none' } = {}) {
  context?.revert(); pageCleanup();
  splits.forEach((s) => s.revert()); splits = [];
  arrivalTimeline = null;
  const main = $('#main');
  const cleanups = [];
  context = gsap.context(() => {
    if (reduced.matches) { header.classList.remove('over-photo'); return; }
    // arrival: inner pages settle their photograph and sharpen their heading lines
    const heroImage = $('.inner-hero .opening-arrival', main);
    const heroCopy = $('.inner-opening, .gallery-heading', main);
    const h1 = $('[data-hero-lines]', main);
    if (heroCopy) {
      const lines = h1 ? splitLines(h1) : [];
      const rest = $$('.location, p:not(.location), .button', heroCopy).filter((el) => !el.closest('h1'));
      arrivalTimeline = gsap.timeline({ paused: true });
      if (heroImage) arrivalTimeline.fromTo(heroImage, { scale: 1.08 }, { scale: 1, duration: 3, ease: 'power3.out', immediateRender: true, clearProps: 'transform' }, 0);
      arrivalTimeline
        .fromTo(lines, blurFrom(), { ...blurTo(), duration: 1.3, stagger: 0.14, ease: 'power3.out', immediateRender: true, clearProps: 'all' }, 0.25)
        .fromTo(rest, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out', immediateRender: true, clearProps: 'all' }, 0.55);
    }
    // the opening (home): the sunroom fills the screen with the name set into it; on scroll the photograph frames
    // itself into a tall window on the right while the statement arrives in the blush beside it. CSS holds the framed
    // end state; the scrub runs from full bleed to it, in pixels so the units never fight.
    const opening = $('[data-opening]', main);
    if (opening) {
      const frame = $('.opening-frame', opening), img = $('img', frame), word = $('.opening-word', opening), plate = $('.opening-plate', opening);
      const stage = $('.opening-stage', opening);
      const endInset = () => {
        const h = stage.clientHeight, w = stage.clientWidth, phone = !matchMedia('(min-width: 768px)').matches;
        return phone ? `inset(${header.offsetHeight + 8}px ${w * 0.05}px ${h * 0.42}px ${w * 0.05}px)` : `inset(${h * 0.1}px ${w * 0.06}px ${h * 0.1}px ${w * 0.4}px)`;
      };
      arrivalTimeline = gsap.timeline({ paused: true })
        .fromTo(img, { scale: 1.1 }, { scale: 1, duration: 3, ease: 'power3.out', immediateRender: true, clearProps: 'transform' }, 0)
        .fromTo($('.mask-in', word), { yPercent: 110 }, { yPercent: 0, duration: 1.4, ease: 'power4.out', immediateRender: true }, 0.3)
        .fromTo($('.image-caption', opening), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', immediateRender: true, clearProps: 'all' }, 0.9);
      gsap.timeline({ scrollTrigger: { trigger: opening, start: 'top top', end: 'bottom bottom', scrub: SCRUB(), invalidateOnRefresh: true } })
        .fromTo(frame, { clipPath: 'inset(0px 0px 0px 0px)' }, { clipPath: endInset, ease: 'none', duration: 1 }, 0)
        .fromTo(word, { opacity: 1, y: 0 }, { opacity: 0, y: -60, ease: 'none', duration: 0.45, immediateRender: false }, 0)
        .fromTo(plate, { opacity: 0, x: -28 }, { opacity: 1, x: 0, ease: 'none', duration: 0.45 }, 0.5);
      // the header is transparent over the full-bleed photograph and takes its blush bar as the frame settles
      header.classList.add('over-photo');
      ScrollTrigger.create({ trigger: opening, start: 'top top', end: '30% top', refreshPriority: -1,
        onLeave: () => header.classList.remove('over-photo'), onEnterBack: () => header.classList.add('over-photo'),
        onRefresh: (self) => header.classList.toggle('over-photo', self.progress < 1) });
    } else header.classList.remove('over-photo');
    $$('[data-lines]', main).forEach((el) => {
      const lines = splitLines(el);
      gsap.fromTo(lines, blurFrom(), { ...blurTo(), ease: 'none', stagger: 0.18, scrollTrigger: { trigger: el, start: 'top 94%', end: `clamp(top ${isTouch() ? 78 : 70}%)`, scrub: SCRUB(), invalidateOnRefresh: true } });
    });
    $$('[data-fade]', main).forEach((el) => {
      gsap.fromTo(el, { opacity: 0.15, y: 18 }, { opacity: 1, y: 0, ease: 'none', scrollTrigger: { trigger: el, start: 'top 95%', end: 'clamp(top 74%)', scrub: SCRUB(), invalidateOnRefresh: true } });
    });
    $$('[data-stagger]', main).forEach((el) => {
      gsap.fromTo(el.children, { opacity: 0.15, y: 14 }, { opacity: 1, y: 0, ease: 'none', stagger: 0.14, scrollTrigger: { trigger: el, start: 'top 92%', end: 'clamp(top 62%)', scrub: SCRUB(), invalidateOnRefresh: true } });
    });
    $$('[data-wipe]', main).forEach((el) => {
      const inner = $('.photo-button', el) || $('img', el);
      const big = el.classList.contains('location-photo');
      gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 100%', end: `clamp(top ${big ? (isTouch() ? 55 : 40) : (isTouch() ? 68 : 52)}%)`, scrub: SCRUB(), invalidateOnRefresh: true } })
        .fromTo(el, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', ease: 'none' }, 0)
        .fromTo(inner, { scale: 1.08, y: -20 }, { scale: 1, y: 0, ease: 'power1.out' }, 0);
    });
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1024px)', () => {
      $$('[data-parallax]', main).forEach((el) => {
        gsap.fromTo($('img', el), { yPercent: -10 }, { yPercent: 10, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: SCRUB(), invalidateOnRefresh: true } });
      });
      const footer = $('.site-footer');
      const rise = gsap.fromTo(footer, { yPercent: -26 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: main, start: 'bottom bottom', end: 'max', scrub: SCRUB(), invalidateOnRefresh: true } });
      const onFocus = () => { rise.scrollTrigger?.disable(false); gsap.set(footer, { yPercent: 0 }); };
      const onBlur = (e) => { if (!footer.contains(e.relatedTarget)) rise.scrollTrigger?.enable(); };
      footer.addEventListener('focusin', onFocus); footer.addEventListener('focusout', onBlur);
      return () => { footer.removeEventListener('focusin', onFocus); footer.removeEventListener('focusout', onBlur); };
    });
    // the walk through the house: the copy pins while the photographs pass (desktop, fine pointer)
    const walk = $('[data-walk]', main);
    if (walk && isFine() && wide()) {
      ScrollTrigger.create({ trigger: $('.walk-copy', walk), start: () => `top ${header.offsetHeight + 40}px`, endTrigger: $('.walk-photos', walk), end: 'bottom bottom', pin: true, pinSpacing: false, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 1 });
    }
  }, main);

  // gallery filters
  const filters = $$('[data-filter]', main);
  const filter = (value, updateUrl) => {
    const valid = ['All', 'Living', 'Sleeping', 'Wellness', 'Outside'].includes(value) ? value : 'All';
    filters.forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.filter === valid)));
    let count = 0;
    for (const figure of $$('.gallery-grid figure', main)) { figure.hidden = valid !== 'All' && figure.dataset.category !== valid; if (!figure.hidden) count++; }
    const status = $('[data-gallery-status]', main);
    if (status) status.textContent = `${count} photographs${valid === 'All' ? '' : ` of ${valid.toLowerCase()} spaces`}`;
    if (updateUrl) {
      const url = new URL(location.href);
      valid === 'All' ? url.searchParams.delete('space') : url.searchParams.set('space', valid);
      history.replaceState(history.state, '', url);
      lastPath = url.pathname + url.search;
    }
    refresh();
  };
  filters.forEach((el) => { el.onclick = () => filter(el.dataset.filter, true); });
  if (filters.length) filter(new URLSearchParams(location.search).get('space') || 'All', false);
  // the questions: an animated accordion (CSS grid rows)
  $$('.faq-q', main).forEach((q) => q.addEventListener('click', () => {
    const item = q.closest('.faq-item'), open = !item.classList.contains('open');
    item.classList.toggle('open', open); q.setAttribute('aria-expanded', String(open));
    gsap.delayedCall(0.6, refresh);
  }));
  // tabbing into a hidden photograph must show it
  const onFocusIn = (e) => {
    const w = e.target.closest('[data-wipe]');
    if (w) gsap.set([w, $('.photo-button', w) || $('img', w)], { clipPath: 'inset(0% 0 0 0)', scale: 1, y: 0 });
  };
  main.addEventListener('focusin', onFocusIn);
  cleanups.push(() => main.removeEventListener('focusin', onFocusIn));
  let loadFrame = 0;
  const onLoad = () => { cancelAnimationFrame(loadFrame); loadFrame = requestAnimationFrame(refresh); };
  main.addEventListener('load', onLoad, true);
  cleanups.push(() => { cancelAnimationFrame(loadFrame); main.removeEventListener('load', onLoad, true); });

  pageCleanup = () => cleanups.forEach((fn) => fn());
  updateCurrentLinks();
  html.classList.add('ready'); clearTimeout(readyFailsafe);
  refresh();
  if (arrival === 'play') arrivalTimeline?.play();
}
function updateCurrentLinks() {
  for (const el of $$('#site-menu nav a, .hd-nav a')) {
    if (new URL(el.href).pathname === location.pathname) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  }
}

// ---------- the loader: first visit only; letters rise, the rule draws, the plate wipes away to the right ----------
async function runLoader() {
  const word = $('.loader-word', loader);
  const chars = new SplitText(word, { type: 'chars', charsClass: 'ch' }).chars;
  const heroImage = $('.opening-frame img, .inner-hero img');
  const waits = [document.fonts.ready];
  if (heroImage) waits.push(heroImage.decode().catch(() => {}));
  const floor = new Promise((r) => setTimeout(r, 900));
  const ceiling = new Promise((r) => setTimeout(r, 2600));
  const plate = gsap.timeline()
    .fromTo(chars, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, stagger: 0.07, ease: 'power4.out' }, 0)
    .fromTo('.loader-rule', { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'power2.inOut' }, 0.45)
    .fromTo('.loader-place', { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.8);
  await Promise.race([Promise.all([...waits, floor, plate.then()]), ceiling]);
  try { sessionStorage.setItem('himri-seen', '1'); } catch { /* storage blocked: the plate shows each visit */ }
  gsap.delayedCall(0.35, () => arrivalTimeline?.play());
  gsap.fromTo(header, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 1, delay: 0.5, ease: 'power3.out', clearProps: 'all' });
  await gsap.to(loader, { clipPath: 'inset(0 0 0 100%)', duration: 1.05, ease: 'expo.inOut' }).then();
  html.classList.remove('loading');
  gsap.set(loader, { clearProps: 'all' });
}

// ---------- routes: a wine wipe crosses left to right, the page changes beneath it, the wipe leaves to the right ----------
const veilWord = $('.wordmark', veil);
function hideVeil() { gsap.set(veil, { visibility: 'hidden', clipPath: 'inset(0 100% 0 0)' }); gsap.set(veilWord, { opacity: 0 }); }
function scrollToDestination(url, restoreY) {
  const hash = url.hash ? document.getElementById(decodeURIComponent(url.hash.slice(1))) : null;
  const targetY = restoreY ?? (hash ? hash.getBoundingClientRect().top + window.scrollY - header.offsetHeight - 24 : 0);
  setScroll(targetY);
}
function cancelPendingNavigation() {
  ++routeRequest; routeController?.abort(); routePending = false;
  gsap.killTweensOf([veil, veilWord]); hideVeil();
  arrivalTimeline?.progress(1);
  $('#navigation-status').textContent = '';
}
const tween = (target, vars) => new Promise((resolve) => gsap.to(target, { ...vars, onComplete: resolve, onInterrupt: resolve }));
async function navigate(url, { pop = false, key = null, viaKey = false } = {}) {
  const request = ++routeRequest;
  routePending = true;
  routeController?.abort();
  routeController = new AbortController();
  const instant = reduced.matches || viaKey || pop;
  scrollPositions.set(currentKey, locked() ? lockedY : window.scrollY);
  const destinationY = pop ? scrollPositions.get(key) ?? 0 : null;
  if (menuOpen) setMenu(false, null, false, true);
  for (const dialog of [book, lightbox]) if (dialog.open) dialog.close();
  gsap.killTweensOf([veil, veilWord]);
  $('#navigation-status').textContent = 'Opening page…';
  try {
    const covering = instant ? null : (() => {
      gsap.set(veil, { visibility: 'visible' });
      gsap.fromTo(veilWord, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', delay: 0.25 });
      return tween(veil, { clipPath: 'inset(0 0% 0 0)', duration: 0.6, ease: 'expo.inOut' });
    })();
    const response = await fetch(url.pathname + url.search, { signal: routeController.signal });
    if (!response.ok) throw new Error('Page unavailable');
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    const nextMain = doc.querySelector('main');
    if (!nextMain) throw new Error('Page missing');
    await covering;
    if (request !== routeRequest) return;
    context?.revert(); pageCleanup(); context = null;
    splits.forEach((s) => s.revert()); splits = [];
    $('#main').replaceWith(nextMain);
    document.title = doc.title;
    document.body.dataset.route = url.pathname;
    if (!pop) { currentKey = crypto.randomUUID(); history.pushState({ himriKey: currentKey }, '', url); }
    else currentKey = key || crypto.randomUUID();
    lastPath = url.pathname + url.search;
    scrollToDestination(url, destinationY);
    initPageMotion({ arrival: instant || (destinationY ?? 0) > 0 ? 'none' : 'defer' });
    $('#main').focus({ preventScroll: true });
    if (!instant) {
      gsap.delayedCall(0.3, () => { if (request === routeRequest) arrivalTimeline?.play(); });
      gsap.to(veilWord, { opacity: 0, y: -10, duration: 0.35, ease: 'power2.in' });
      await tween(veil, { clipPath: 'inset(0 0 0 100%)', duration: 0.8, ease: 'expo.inOut', overwrite: true });
    }
    if (request !== routeRequest) return;
    hideVeil();
    routePending = false;
    $('#navigation-status').textContent = doc.title;
  } catch (error) {
    if (error.name !== 'AbortError' && request === routeRequest) location.assign(url.href);
  }
}

document.addEventListener('click', (event) => {
  const bookButton = event.target.closest('[data-book]');
  if (bookButton) { openBooking(bookButton, event.detail === 0); return; }
  const photoButton = event.target.closest('[data-photo]');
  if (photoButton) {
    photoSet = visiblePhotos();
    showPhoto(Math.max(0, photoSet.findIndex((im) => im.id === photoButton.dataset.photo)));
    openDialog(lightbox, { currentTarget: photoButton, detail: event.detail });
    return;
  }
  const anchor = event.target.closest('a[href]');
  if (!anchor || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0 || anchor.target || anchor.hasAttribute('download')) return;
  const url = new URL(anchor.href);
  if (url.origin !== location.origin) return;
  if (!['/himri-preview/', '/himri-preview/the-house/', '/himri-preview/wellness/', '/himri-preview/gallery/'].includes(url.pathname)) return;
  event.preventDefault();
  if (url.pathname + url.search === lastPath) {
    if (routePending) cancelPendingNavigation();
    if (menuOpen) setMenu(false, null, false);
    if (url.hash) {
      scrollPositions.set(currentKey, window.scrollY);
      currentKey = crypto.randomUUID();
      history.pushState({ himriKey: currentKey }, '', url);
      const target = document.getElementById(url.hash.slice(1));
      if (target && lenis && event.detail !== 0) lenis.scrollTo(target.getBoundingClientRect().top + window.scrollY - header.offsetHeight - 24, { duration: 1.1 });
      else scrollToDestination(url);
      target?.focus({ preventScroll: true });
    } else if (lenis && event.detail !== 0 && window.scrollY < innerHeight * 2.5) lenis.scrollTo(0, { duration: 1.1 });
    else scrollToDestination(url);
    return;
  }
  navigate(url, { viaKey: event.detail === 0 });
});
addEventListener('popstate', (event) => {
  const url = new URL(location.href);
  if (url.pathname + url.search === lastPath) {
    cancelPendingNavigation();
    scrollPositions.set(currentKey, locked() ? lockedY : window.scrollY);
    currentKey = event.state?.himriKey || crypto.randomUUID();
    if (menuOpen) setMenu(false, null, false, true);
    for (const dialog of [book, lightbox]) if (dialog.open) dialog.close();
    scrollToDestination(url, scrollPositions.get(currentKey));
    return;
  }
  navigate(url, { pop: true, key: event.state?.himriKey });
});
addEventListener('pagehide', () => scrollPositions.set(currentKey, locked() ? lockedY : window.scrollY));
addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  if (menuOpen) setMenu(false, null, false, true);
  unlockScroll();
  html.classList.remove('loading'); gsap.set(loader, { clearProps: 'all' }); hideVeil();
});
let lastWidth = innerWidth, resizeTimer;
addEventListener('resize', () => {
  if (innerWidth === lastWidth) return;
  lastWidth = innerWidth;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (!locked()) initPageMotion({ arrival: 'none' }); }, 160);
});
reduced.addEventListener('change', () => {
  html.classList.toggle('motion-on', !reduced.matches);
  for (const el of document.querySelectorAll('dialog')) el.getAnimations().forEach((a) => a.finish());
  if (menuTimeline) menuTimeline.pause().progress(menuOpen ? 1 : 0);
  if (html.classList.contains('loading')) { html.classList.remove('loading'); gsap.set(loader, { clearProps: 'all' }); }
  configureScroll(); initPageMotion({ arrival: 'none' });
});
touchMQ.addEventListener('change', configureScroll);

// ---------- boot ----------
buildMenu();
configureScroll();
const firstVisit = html.classList.contains('loading') && !reduced.matches;
initPageMotion({ arrival: firstVisit ? 'defer' : 'play' });
if (firstVisit) runLoader();
document.fonts.ready.then(() => refresh());
if (location.hash === '#book') setTimeout(() => openBooking(trigger, false), 600);
window.himri = { navigate, reduced, get menuOpen() { return menuOpen; } };
