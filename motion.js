(() => {
  'use strict';
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const ease = 'power3.out';
  let keyboard = false;
  let pageContext;
  let pageMedia;
  let routeAnimation;
  let menuTimeline;
  let lenisLoading;
  let lenisTick;
  addEventListener('keydown', () => { keyboard = true; }, { capture: true });
  addEventListener('pointerdown', () => { keyboard = false; }, { capture: true });
  const plain = () => !gsap || reduced.matches || keyboard;
  if (gsap && ST) gsap.registerPlugin(ST);

  function configureScroll() {
    const eligible = !reduced.matches && fine.matches && navigator.maxTouchPoints === 0 && !!gsap;
    if (!eligible) {
      window.himriScroll?.destroy();
      window.himriScroll = null;
      if (lenisTick) gsap.ticker.remove(lenisTick);
      lenisTick = null;
      return;
    }
    if (window.himriScroll) return;
    if (!window.Lenis) {
      if (!lenisLoading) {
        lenisLoading = new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = '/himri-preview/vendor/lenis.min.js';
          script.onload = resolve;
          script.onerror = resolve;
          document.head.append(script);
        });
        lenisLoading.then(() => { if (window.Lenis) configureScroll(); });
      }
      return;
    }
    const lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.85, smoothWheel: true, syncTouch: false, autoRaf: false });
    window.himriScroll = lenis;
    lenis.on('scroll', () => ST?.update());
    lenisTick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(lenisTick);
    if (document.body.classList.contains('is-locked')) lenis.stop();
  }
  configureScroll();
  fine.addEventListener('change', configureScroll);
  reduced.addEventListener('change', configureScroll);

  function clearPage() {
    pageMedia?.revert();
    pageContext?.revert();
    pageMedia = pageContext = null;
  }
  function setupPage({ entrance = false } = {}) {
    clearPage();
    if (!gsap || !ST) return clearPage;
    const main = document.querySelector('main');
    pageMedia = gsap.matchMedia();
    pageMedia.add('(prefers-reduced-motion: no-preference)', () => {
      pageContext = gsap.context(() => {
        main.querySelectorAll('[data-reveal]').forEach((el) => {
          const position = () => el.getBoundingClientRect().top + scrollY - Number(gsap.getProperty(el, 'y'));
          gsap.fromTo(el, { y: 10, opacity: 0.35 }, {
            y: 0, opacity: 1, ease: 'none',
            scrollTrigger: {
              trigger: el.parentElement,
              start: () => position() - innerHeight * 0.94,
              end: () => position() - innerHeight * 0.76,
              scrub: true, invalidateOnRefresh: true,
            },
          });
        });
        main.querySelectorAll('[data-image-reveal]').forEach((el) => {
          if (el.closest('.home-opening') || el.classList.contains('inner-hero')) return;
          gsap.fromTo(el.querySelector('img'), { scale: 1.025, opacity: 0.72 }, {
            scale: 1, opacity: 1, ease: 'none',
            scrollTrigger: { trigger: el, start: 'top 96%', end: 'top 68%', scrub: true, invalidateOnRefresh: true },
          });
        });
        if (fine.matches && navigator.maxTouchPoints === 0) {
          main.querySelectorAll('[data-parallax]').forEach((el) => {
            gsap.fromTo(el.querySelector('img'), { scale: 1.05, yPercent: -2 }, {
              scale: 1.05, yPercent: 2, ease: 'none',
              scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
            });
          });
        }
        if (entrance && !keyboard && scrollY < 80) {
          const intro = main.querySelector('.opening-copy,.inner-opening,.gallery-heading');
          if (intro) {
            gsap.fromTo([...intro.children], { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.52, stagger: 0.06, ease, clearProps: 'transform,opacity' });
          }
          const hero = main.querySelector('.opening-image>img,.inner-hero>img');
          if (hero) gsap.fromTo(hero, { scale: 1.025 }, { scale: 1, duration: 4, ease: 'sine.inOut', clearProps: 'transform' });
        }
      }, main);
      return () => { pageContext?.revert(); };
    });
    // Decode/lazy-load changes are bounded to actual image events, with one refresh.
    let refreshFrame = 0;
    const refresh = () => {
      cancelAnimationFrame(refreshFrame);
      refreshFrame = requestAnimationFrame(() => { ST.refresh(); window.himriScroll?.resize(); });
    };
    main.addEventListener('load', refresh, true);
    const revealFocus = (event) => {
      const container = event.target.closest('[data-image-reveal]');
      if (container && keyboard) gsap.set(container.querySelector('img'), { scale: 1, opacity: 1 });
    };
    main.addEventListener('focusin', revealFocus);
    refresh();
    return () => {
      cancelAnimationFrame(refreshFrame);
      main.removeEventListener('load', refresh, true);
      main.removeEventListener('focusin', revealFocus);
      clearPage();
    };
  }
  function menu(open, onClosed, immediate = false) {
    const el = document.querySelector('#site-menu');
    if (!gsap) { if (!open) onClosed(); return; }
    if (!menuTimeline) {
      menuTimeline = gsap.timeline({ paused: true });
      menuTimeline.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.25, ease }, 0)
        .fromTo(el.querySelectorAll('nav a span'), { yPercent: 100 }, { yPercent: 0, duration: 0.18, stagger: 0.02, ease }, 0.01)
        .fromTo(el.querySelector('.menu-photo'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.22, ease }, 0.02);
    }
    menuTimeline.eventCallback('onReverseComplete', onClosed);
    if (plain() || immediate) {
      menuTimeline.pause().progress(open ? 1 : 0);
      if (!open) onClosed();
    } else if (open) menuTimeline.timeScale(1).play();
    else menuTimeline.timeScale(1.4).reverse();
  }
  function dialog(el, open, done = () => {}) {
    el.getAnimations().forEach(a => a.cancel());
    if (plain()) { done(); return; }
    const frames = open
      ? [{ opacity: 0, transform: 'translateY(6px) scale(.99)' }, { opacity: 1, transform: 'none' }]
      : [{ opacity: getComputedStyle(el).opacity, transform: 'none' }, { opacity: 0, transform: 'translateY(3px)' }];
    const animation = el.animate(frames, { duration: open ? 220 : 150, easing: 'cubic-bezier(.22,1,.36,1)' });
    animation.finished.then(done).catch(() => {});
  }
  function change(el) {
    const current = el.getAnimations().some(a => a.playState === 'running')
      ? { opacity: getComputedStyle(el).opacity, transform: getComputedStyle(el).transform }
      : { opacity: 0.45, transform: 'translateY(4px)' };
    el.getAnimations().forEach(a => a.cancel());
    if (plain()) return;
    el.animate([current, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' });
  }
  function leave() {
    routeAnimation?.cancel();
    if (plain()) return Promise.resolve();
    const main = document.querySelector('main');
    routeAnimation = main.animate([{ opacity: getComputedStyle(main).opacity }, { opacity: 0.8 }], { duration: 140, fill: 'forwards', easing: 'cubic-bezier(.22,1,.36,1)' });
    return routeAnimation.finished.catch(() => {});
  }
  function cancelRoute() {
    routeAnimation?.cancel();
    routeAnimation = null;
  }
  function arrive() {
    cancelRoute();
    change(document.querySelector('main'));
  }
  reduced.addEventListener('change', () => {
    routeAnimation?.cancel();
    for (const el of document.querySelectorAll('dialog')) el.getAnimations().forEach(a => a.finish());
    if (menuTimeline) {
      const open = document.querySelector('.menu-trigger').getAttribute('aria-expanded') === 'true';
      menuTimeline.pause().progress(open ? 1 : 0);
    }
  });
  window.himriMotion = { setupPage, menu, dialog, change, leave, arrive, cancelRoute, plain };
})();
