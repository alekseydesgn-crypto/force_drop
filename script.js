// ФОРС Дроп Зона — interactions
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // year
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();

  // sticky nav
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // mobile menu
  const burger = $('#navBurger');
  const links = $('#navLinks');
  if (burger && links) {
    const close = () => { burger.setAttribute('aria-expanded', 'false'); links.classList.remove('is-open'); };
    burger.addEventListener('click', () => {
      const open = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!open));
      links.classList.toggle('is-open', !open);
    });
    links.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  // reveal on scroll
  const targets = $$('.section, .feature, .zone, .price, .bar__card, .review, .gallery__item, .drop, .info__card');
  targets.forEach(el => el.classList.add('reveal'));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });
    targets.forEach(el => io.observe(el));
  } else {
    targets.forEach(el => el.classList.add('is-visible'));
  }

  // phone mask: +7 (XXX) XXX-XX-XX
  const phone = $('#f-phone');
  if (phone) {
    const fmt = (raw) => {
      let d = raw.replace(/\D/g, '');
      if (d.startsWith('8')) d = '7' + d.slice(1);
      if (!d.startsWith('7')) d = '7' + d;
      d = d.slice(0, 11);
      const p = d.slice(1);
      let out = '+7';
      if (p.length > 0) out += ' (' + p.slice(0, 3);
      if (p.length >= 3) out += ') ' + p.slice(3, 6);
      if (p.length >= 6) out += '-' + p.slice(6, 8);
      if (p.length >= 8) out += '-' + p.slice(8, 10);
      return out;
    };
    phone.addEventListener('focus', () => { if (!phone.value) phone.value = '+7 '; });
    phone.addEventListener('input', () => { phone.value = fmt(phone.value); });
    phone.addEventListener('blur', () => { if (phone.value === '+7' || phone.value === '+7 ') phone.value = ''; });
  }

  // lazy-load Яндекс.Карты — iframe вставляется только когда пользователь
  // приближается к блоку (или сразу, если IO нет в браузере)
  const mapEl = $('#info-map');
  if (mapEl) {
    const loadMap = () => {
      if (mapEl.classList.contains('is-loaded')) return;
      const src = mapEl.dataset.src;
      if (!src) return;
      const iframe = document.createElement('iframe');
      iframe.src = src;
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.allowFullscreen = true;
      iframe.title = 'ФОРС Дроп Зона на карте';
      mapEl.appendChild(iframe);
      mapEl.classList.add('is-loaded');
    };
    if ('IntersectionObserver' in window) {
      const mapIO = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            loadMap();
            mapIO.disconnect();
          }
        });
      }, { rootMargin: '400px 0px' });
      mapIO.observe(mapEl);
    } else {
      loadMap();
    }
  }

  // min date = today
  const dateInput = $('#f-date');
  if (dateInput) {
    const t = new Date();
    const iso = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
    dateInput.min = iso;
  }

  // booking form -> отправка прямо в Telegram-бота заявок
  const TG_BOT_TOKEN = '8640350068:AAE3e_tHfdyUfoznzupY4G7Qd6xtkOACzto';
  const TG_CHAT_ID = '-5132056283';
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const form = $('#bookingForm');
  const status = $('#formStatus');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameVal = ($('#f-name')?.value || '').trim();
      const phoneVal = (phone?.value || '').trim();
      const digits = phoneVal.replace(/\D/g, '');
      if (!nameVal) {
        status.hidden = false;
        status.classList.add('is-error');
        status.textContent = 'Укажи имя';
        $('#f-name')?.focus();
        return;
      }
      if (digits.length < 11) {
        status.hidden = false;
        status.classList.add('is-error');
        status.textContent = 'Укажи корректный номер телефона';
        phone?.focus();
        return;
      }

      const dateVal = ($('#f-date')?.value || '').trim();
      const timeVal = ($('#f-time')?.value || '').trim();
      const zoneVal = ($('#f-zone')?.value || '').trim();
      const dateHuman = dateVal
        ? new Date(dateVal + 'T00:00').toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

      const text = [
        '📨 <b>Новая заявка — ФОРС Дроп Зона</b>',
        '',
        `<b>Имя:</b> ${escapeHtml(nameVal)}`,
        `<b>Телефон:</b> ${escapeHtml(phoneVal)}`,
        `<b>Дата:</b> ${escapeHtml(dateHuman)}`,
        `<b>Время:</b> ${escapeHtml(timeVal || '—')}`,
        `<b>Зона:</b> ${escapeHtml(zoneVal || '—')}`
      ].join('\n');

      const submitBtn = form.querySelector('.form__submit');
      const originalText = submitBtn?.textContent || 'Отправить заявку';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправляем…';
      }
      status.hidden = false;
      status.classList.remove('is-error');
      status.textContent = 'Отправляем заявку…';

      try {
        const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TG_CHAT_ID,
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.description || 'telegram api error');

        status.textContent = '✅ Заявка отправлена! Администратор скоро перезвонит';
        form.reset();
      } catch (err) {
        status.classList.add('is-error');
        status.textContent = 'Не удалось отправить. Напиши в @forcedropzone — администратор ответит';
        console.error('booking submit error:', err);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  }

  /* ============== LIGHTBOX ============== */
  const photos = [
    { src: 'images/interior/ob.webp',       alt: 'Общий план зала ФОРС' },
    { src: 'images/interior/duo_comp.webp', alt: 'DUO — два игровых ПК' },
    { src: 'images/interior/admin.webp',    alt: 'Стойка администратора' },
    { src: 'images/interior/pc.webp',       alt: 'Игровой ПК с RTX' },
    { src: 'images/interior/also.webp',     alt: 'Экран дропа в зале' },
    { src: 'images/interior/low.webp',      alt: 'Атмосфера игрового зала' },
    { src: 'images/interior/drop.png',      alt: 'Экран программы дропов' }
  ];

  const lb = $('#lightbox');
  const lbImage = $('#lb-image');
  const lbCounter = $('#lb-counter');
  const lbThumbs = $('#lb-thumbs');
  const lbClose = $('#lb-close');
  const lbPrev = $('#lb-prev');
  const lbNext = $('#lb-next');
  const galleryMore = $('#gallery-more');
  const galleryCount = $('#gallery-count');
  if (galleryCount) galleryCount.textContent = String(photos.length);

  let idx = 0;

  const buildThumbs = () => {
    if (!lbThumbs || lbThumbs.children.length) return;
    photos.forEach((p, i) => {
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'lightbox__thumb';
      t.dataset.i = String(i);
      t.setAttribute('aria-label', p.alt);
      const im = document.createElement('img');
      im.src = p.src; im.alt = '';
      t.appendChild(im);
      t.addEventListener('click', () => goTo(i));
      lbThumbs.appendChild(t);
    });
  };

  const updateActiveThumb = () => {
    if (!lbThumbs) return;
    $$('.lightbox__thumb', lbThumbs).forEach((t, i) => {
      t.classList.toggle('is-active', i === idx);
      if (i === idx) t.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    });
  };

  const render = () => {
    const p = photos[idx];
    if (!p) return;
    lbImage.src = p.src;
    lbImage.alt = p.alt || '';
    lbCounter.textContent = `${idx + 1} / ${photos.length}`;
    updateActiveThumb();
  };

  const open = (i = 0) => {
    idx = ((i % photos.length) + photos.length) % photos.length;
    buildThumbs();
    render();
    lb.hidden = false;
    document.body.classList.add('lb-open');
  };
  const closeLb = () => {
    lb.hidden = true;
    document.body.classList.remove('lb-open');
  };
  const goTo = (i) => {
    idx = ((i % photos.length) + photos.length) % photos.length;
    render();
  };
  const next = () => goTo(idx + 1);
  const prev = () => goTo(idx - 1);

  // grid clicks
  $$('#gallery-grid .gallery__item').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.i || 0);
      open(i);
    });
  });
  if (galleryMore) galleryMore.addEventListener('click', () => open(0));

  if (lbClose) lbClose.addEventListener('click', closeLb);
  if (lbPrev)  lbPrev.addEventListener('click', prev);
  if (lbNext)  lbNext.addEventListener('click', next);

  // backdrop click closes
  if (lb) lb.addEventListener('click', (e) => {
    if (e.target === lb) closeLb();
  });

  // keyboard
  document.addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft')  prev();
  });

  // touch swipe
  let touchX = null;
  if (lb) {
    lb.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend',   (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
      touchX = null;
    });
  }
})();
