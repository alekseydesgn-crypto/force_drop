(() => {
  const menu = document.querySelector('.menu');
  const links = document.querySelector('.nav-links');
  if (menu && links) {
    const close = () => {
      menu.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-label', 'Открыть меню');
      links.classList.remove('open');
    };
    menu.addEventListener('click', () => {
      const open = menu.getAttribute('aria-expanded') !== 'true';
      menu.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      links.classList.toggle('open', open);
    });
    links.addEventListener('click', event => { if (event.target.closest('a')) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    document.addEventListener('click', event => { if (!menu.contains(event.target) && !links.contains(event.target)) close(); });
  }

  const form = document.querySelector('#request form');
  if (!form) return;
  const phone = form.querySelector('[name="phone"]');
  const telegram = form.querySelector('[name="telegram"]');
  const sourceInput = form.querySelector('[name="source"]');
  const submit = form.querySelector('[type="submit"]');
  const initialButton = submit.innerHTML;
  const utmKeys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
  const currentUtm = Object.fromEntries(utmKeys.map(key => [key, new URLSearchParams(location.search).get(key)]).filter(([, value]) => value));
  if (Object.keys(currentUtm).length) {
    try { sessionStorage.setItem('force_franchise_utm', JSON.stringify(currentUtm)); } catch {}
  }

  const formatPhone = value => {
    let digits = value.replace(/\D/g, '');
    if (digits.startsWith('8')) digits = `7${digits.slice(1)}`;
    if (!digits.startsWith('7')) digits = `7${digits}`;
    const local = digits.slice(1, 11);
    let formatted = '+7';
    if (local.length) formatted += ` (${local.slice(0, 3)}`;
    if (local.length >= 3) formatted += ')';
    if (local.length > 3) formatted += ` ${local.slice(3, 6)}`;
    if (local.length > 6) formatted += `-${local.slice(6, 8)}`;
    if (local.length > 8) formatted += `-${local.slice(8, 10)}`;
    return formatted;
  };
  phone.addEventListener('focus', () => { if (!phone.value.trim()) phone.value = '+7 '; });
  phone.addEventListener('input', () => { phone.value = formatPhone(phone.value); });
  telegram.addEventListener('focus', () => { if (!telegram.value.trim()) telegram.value = '@'; });

  const track = (event, data = {}) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...data });
    if (typeof window.ym === 'function') window.ym('reachGoal', event, data);
  };
  document.querySelectorAll('a[href="#request"]').forEach(link => link.addEventListener('click', () => {
    const section = link.closest('section');
    sourceInput.value = section?.id || 'footer';
  }));
  let formStarted = false;
  form.addEventListener('focusin', () => {
    if (!formStarted) { formStarted = true; track('form_start', { source: sourceInput.value }); }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    form.querySelector('.form-error')?.remove();
    submit.disabled = true;
    submit.textContent = 'Отправляем…';
    const payload = Object.fromEntries(new FormData(form).entries());
    let utm = {};
    try { utm = JSON.parse(sessionStorage.getItem('force_franchise_utm') || '{}'); } catch {}
    try {
      const leadApi = window.FORCE_LEADS_API_URL;
      const response = await fetch(leadApi ? `${leadApi}?kind=franchise` : '/api/franchise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, ...utm, source: sourceInput.value, page_url: location.href, referrer: document.referrer }),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(result.error || 'Не удалось отправить заявку. Попробуйте ещё раз.');
      track('form_submit_success', { source: sourceInput.value });
      try { sessionStorage.removeItem('force_franchise_utm'); } catch {}
      form.innerHTML = '<div class="success"><span>✓</span><h3>ЗАЯВКА ПРИНЯТА</h3><p>Спасибо! Мы получили данные и свяжемся с вами.</p><button type="button" class="text-link">Отправить ещё одну</button></div>';
      form.querySelector('.success button').addEventListener('click', () => location.reload());
    } catch (error) {
      const message = document.createElement('div');
      message.className = 'form-error';
      message.setAttribute('role', 'alert');
      message.textContent = error instanceof Error ? error.message : 'Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.';
      submit.before(message);
      submit.disabled = false;
      submit.innerHTML = initialButton;
    }
  });
})();
