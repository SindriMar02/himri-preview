// SNDR booking sheet, prototype edition. Shared by Mountain Villa and Himri (identical file in both repos).
//
// The family's range calendar (Akureyri Lodge 14 Oct 2026, Hotel Laugar): two months from 768px, one on a phone,
// hover preview of the range, arrow and page keys between days, a guests stepper, the one action in a bar that never
// scrolls away. The prototype flow mirrors SNDR Bókun's request model: dates and guests, then the guest's details,
// then a request the host confirms and sends a secure pay link for. Nothing here invents availability, a rate or a
// confirmation: every future night shows as open, the summary counts nights only, and the final state says plainly
// that this is the preview. The production layer swaps `submitRequest` for the real engine and `openNights` for the
// synced calendar.
export function mountBooking(root, { min = 2, max = 10, guests = 2, months = 18, onStep = () => {} } = {}) {
  const $ = (s, c = root) => c.querySelector(s);
  const $$ = (s, c = root) => [...c.querySelectorAll(s)];
  const form = $('form'), monthsBox = $('.bk-months'), from = $('[data-from]'), to = $('[data-to]');
  const minus = $('.bk-minus'), plus = $('.bk-plus'), gshow = $('.bk-n'), gnote = $('.bk-gnote');
  const sum = $('.bk-sum'), note = $('.bk-note'), action = $('.bk-action'), actionLabel = $('.bk-action > span');
  const who = $('.bk-who'), done = $('.bk-done'), dates = $('.bk-dates'), back = $('.bk-back');
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const at = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const addMonth = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate()));
  const monthOf = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const firstDay = iso(addDays(today, 1)), todayK = iso(today);
  const lastDay = iso(addMonth(today, months));
  const firstMonth = monthOf(today), lastMonth = monthOf(at(lastDay));
  const fShort = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const fLong = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fMonth = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
  const wide = matchMedia('(min-width: 768px)'), still = matchMedia('(prefers-reduced-motion: reduce)');
  const st = { start: '', end: '', hover: '', focus: '', view: firstMonth, guests, drawn: false, step: 'dates' };
  const say = (t) => { note.textContent = t; };
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const nights = () => Math.round((at(st.end) - at(st.start)) / 864e5);
  // the production layer replaces this with the synced calendar
  const openNight = (k) => k >= firstDay && k <= lastDay;
  const days$ = () => $$('.bk-d');

  function paint() {
    const days = days$(), b = st.end || (st.hover > st.start ? st.hover : '');
    let tab = days.find((d) => d.dataset.d === st.focus && !d.disabled);
    if (!tab) tab = days.find((d) => d.dataset.d === st.start) || days.find((d) => !d.disabled);
    days.forEach((d) => {
      const k = d.dataset.d, on = k === st.start || k === st.end;
      d.classList.toggle('start', k === st.start); d.classList.toggle('end', !!st.end && k === st.end);
      d.classList.toggle('in', !!st.start && !!st.end && k > st.start && k < st.end);
      d.classList.toggle('pv', !st.end && !!b && k > st.start && k < b);
      d.classList.toggle('pv-end', !st.end && !!b && k === b);
      d.classList.toggle('today', k === todayK);
      // the nights too close to the arrival for the minimum stay
      d.classList.toggle('short', !!st.start && !st.end && k > st.start && k < iso(addDays(at(st.start), min)));
      d.setAttribute('aria-pressed', String(on)); d.tabIndex = d === tab ? 0 : -1;
    });
  }
  function labels() {
    from.textContent = st.start ? fShort.format(at(st.start)) : 'Arrival'; from.classList.toggle('is-set', !!st.start);
    to.textContent = st.end ? fShort.format(at(st.end)) : 'Departure'; to.classList.toggle('is-set', !!st.end);
    if (st.step === 'dates') {
      sum.innerHTML = st.start && st.end
        ? `<span class="d">${fShort.format(at(st.start))} to ${fShort.format(at(st.end))}</span><span class="a">${plural(nights(), 'night')}, ${plural(st.guests, 'guest')}. The host confirms and sends a secure pay link.</span>`
        : `<span class="is-muted">${st.start ? 'Now choose your departure date' : 'Choose your arrival and departure dates'}</span>`;
      actionLabel.textContent = 'Request these dates';
    } else if (st.step === 'who') {
      sum.innerHTML = `<span class="d">${fShort.format(at(st.start))} to ${fShort.format(at(st.end))}</span><span class="a">${plural(nights(), 'night')}, ${plural(st.guests, 'guest')}. Add your details and send the request.</span>`;
      actionLabel.textContent = 'Send request';
    }
  }
  function render() {
    const n = wide.matches ? 2 : 1;
    const prevOk = st.view > firstMonth, nextOk = new Date(st.view.getFullYear(), st.view.getMonth() + n - 1, 1) < lastMonth;
    const arrows = `<span class="bk-nav"><button class="bk-prev" type="button" aria-label="Previous month"${prevOk ? '' : ' disabled'}><svg class="bk-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><button class="bk-next" type="button" aria-label="Next month"${nextOk ? '' : ' disabled'}><svg class="bk-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></span>`;
    let html = '';
    for (let i = 0; i < n; i++) {
      const m = new Date(st.view.getFullYear(), st.view.getMonth() + i, 1), lead = (m.getDay() + 6) % 7, count = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      html += `<div class="bk-m" role="group" aria-label="${fMonth.format(m)}"><div class="bk-m-h"><p class="bk-m-t">${fMonth.format(m)}</p>${i === n - 1 ? arrows : ''}</div><div class="bk-dow" aria-hidden="true">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => `<span>${d}</span>`).join('')}</div><div class="bk-days">${'<span></span>'.repeat(lead)}`;
      for (let d = 1; d <= count; d++) { const dt = new Date(m.getFullYear(), m.getMonth(), d), k = iso(dt); html += `<button type="button" class="bk-d" data-d="${k}" aria-label="${fLong.format(dt)}" aria-pressed="false" tabindex="-1"${openNight(k) ? '' : ' disabled'}>${d}</button>`; }
      html += '</div></div>';
    }
    monthsBox.innerHTML = html; st.drawn = true;
    paint();
  }
  let slide = [];
  function page(step) {
    const v = new Date(st.view.getFullYear(), st.view.getMonth() + step, 1);
    if (v < firstMonth || v > lastMonth) return;
    st.view = v; render();
    const same = $(step > 0 ? '.bk-next' : '.bk-prev', monthsBox);
    (same && !same.disabled ? same : $('.bk-prev:not(:disabled), .bk-next:not(:disabled)', monthsBox))?.focus({ preventScroll: true });
    slide.forEach((a) => a.cancel());
    if (!still.matches) slide = $$('.bk-dow, .bk-days', monthsBox).map((el) => el.animate([{ opacity: 0, transform: `translateX(${step * 14}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.23, 1, .32, 1)' }));
  }
  function sync() { paint(); labels(); }
  function pick(k) {
    if (!st.start || st.end || k <= st.start) { st.start = k; st.end = ''; }
    else if (k < iso(addDays(at(st.start), min))) { say(`Minimum stay is ${plural(min, 'night')}.`); st.focus = k; paint(); return; }
    else st.end = k;
    st.hover = ''; st.focus = k; say(''); sync();
  }
  function goto(k) {
    const d = at(k), shown = wide.matches ? 2 : 1, first = st.view, last = new Date(first.getFullYear(), first.getMonth() + shown, 0);
    if (d < first || d > last) {
      let v = d > last ? new Date(d.getFullYear(), d.getMonth() - (shown - 1), 1) : monthOf(d);
      st.view = v < firstMonth ? firstMonth : v > lastMonth ? lastMonth : v; render();
    }
    st.focus = k; paint(); $(`.bk-d[data-d="${k}"]`)?.focus();
  }
  function fit() {
    st.guests = Math.min(Math.max(st.guests, 1), max);
    gshow.textContent = plural(st.guests, 'guest'); minus.disabled = st.guests <= 1; plus.disabled = st.guests >= max;
    gnote.textContent = st.guests >= max ? `The house sleeps ${max}.` : '';
    labels();
  }
  function setStep(step) {
    st.step = step;
    dates.hidden = step !== 'dates'; who.hidden = step !== 'who'; done.hidden = step !== 'done';
    back.hidden = step !== 'who';
    action.hidden = step === 'done';
    $('.bk-body').scrollTop = 0;
    labels(); onStep(step);
  }
  monthsBox.addEventListener('click', (e) => {
    const b = e.target.closest('.bk-d'); if (b && !b.disabled) { pick(b.dataset.d); return; }
    const a = e.target.closest('.bk-prev, .bk-next'); if (a && !a.disabled) page(a.classList.contains('bk-next') ? 1 : -1);
  });
  monthsBox.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || !st.start || st.end) return;
    const b = e.target.closest('.bk-d'), k = b && !b.disabled ? b.dataset.d : '';
    if (k !== st.hover) { st.hover = k; paint(); }
  });
  monthsBox.addEventListener('pointerleave', () => { if (st.hover) { st.hover = ''; paint(); } });
  monthsBox.addEventListener('keydown', (e) => {
    const b = e.target.closest('.bk-d'); if (!b) return;
    const d = at(b.dataset.d), col = (d.getDay() + 6) % 7;
    const nd = { ArrowLeft: addDays(d, -1), ArrowRight: addDays(d, 1), ArrowUp: addDays(d, -7), ArrowDown: addDays(d, 7), Home: addDays(d, -col), End: addDays(d, 6 - col), PageUp: addMonth(d, -1), PageDown: addMonth(d, 1) }[e.key];
    if (!nd) return;
    e.preventDefault(); let k = iso(nd); if (k < firstDay) k = firstDay; if (k > lastDay) k = lastDay; goto(k);
  });
  minus.addEventListener('click', () => { st.guests -= 1; fit(); });
  plus.addEventListener('click', () => { st.guests += 1; fit(); });
  wide.addEventListener('change', () => { if (st.drawn) render(); });
  back.addEventListener('click', () => setStep('dates'));
  // the production layer replaces this with the SNDR Bókun request call
  const submitRequest = async () => new Promise((r) => setTimeout(r, 650));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (st.step === 'dates') {
      if (!st.start || !st.end) { say(st.start ? 'Now choose your departure date.' : 'Choose your arrival and departure dates.'); $('.bk-d[tabindex="0"]')?.focus(); return; }
      say(''); setStep('who'); $('input[name="name"]')?.focus({ preventScroll: true }); return;
    }
    if (st.step === 'who') {
      const name = $('input[name="name"]'), email = $('input[name="email"]');
      const bad = [name, email].find((i) => !i.value.trim() || (i.type === 'email' && !i.checkValidity()));
      if (bad) { say(bad === name ? 'Add your name so the host knows who is asking.' : 'Add an email address the host can reply to.'); bad.focus(); return; }
      say(''); action.disabled = true; action.classList.add('is-busy'); actionLabel.textContent = 'Sending…';
      await submitRequest();
      action.disabled = false; action.classList.remove('is-busy');
      $('.bk-done-dates').textContent = `${fLong.format(at(st.start))} to ${fLong.format(at(st.end))}, ${plural(nights(), 'night')}, ${plural(st.guests, 'guest')}.`;
      $('.bk-done-name').textContent = name.value.trim();
      setStep('done'); $('.bk-done h3')?.focus({ preventScroll: true });
    }
  });
  return {
    prepare() { if (!st.drawn) { render(); fit(); } },
    firstDay() { return $('.bk-d[tabindex="0"]'); },
    reset() { st.start = st.end = st.hover = st.focus = ''; st.step = 'dates'; form.reset(); st.guests = guests; setStep('dates'); fit(); if (st.drawn) paint(); say(''); },
    get step() { return st.step; }
  };
}
