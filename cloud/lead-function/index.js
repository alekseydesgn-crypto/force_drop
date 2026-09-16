const { randomUUID } = require('node:crypto');

const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://club.forcezon.ru';
// Best-effort per-instance limits; a shared gateway limit is needed at scale.
const attempts = new Map();
const deliveries = new Map();
function allow(ip) {
  const now = Date.now();
  for (const [key, entry] of attempts) if (now - entry.start > 60000) attempts.delete(key);
  if (attempts.size >= 2000 && !attempts.has(ip)) return false;
  const entry = attempts.get(ip) || { start: now, count: 0 };
  attempts.set(ip, entry);
  return ++entry.count <= 5;
}

function reply(statusCode, payload, origin) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': origin === SITE_ORIGIN ? SITE_ORIGIN : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    },
    body: JSON.stringify(payload),
  };
}

function clean(value, max = 120) {
  return typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max) : '';
}

function html(value) {
  return value.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}

function message(kind, data) {
  const name = clean(data.name);
  const phone = clean(data.phone, 40);
  const digits = phone.replace(/\D/g, '');
  if (!name || !/^[+\d\s()\-]+$/.test(phone) || digits.length < 10 || digits.length > 15) throw new Error('Укажите имя и корректный телефон.');
  if (clean(data.website)) throw new Error('Проверьте поля заявки.'); // Honeypot, if added to the form.

  if (kind === 'booking') return [
    '📨 <b>Новая бронь — ФОРС Дроп Зона</b>', '',
    `👤 <b>Имя:</b> ${html(name)}`,
    `📞 <b>Телефон:</b> ${html(phone)}`,
  ].join('\n');

  const city = clean(data.city);
  if (!city || clean(data.consent, 20) !== 'accepted') throw new Error('Укажите город и подтвердите согласие.');
  const telegram = clean(data.telegram);
  const username = telegram.replace(/^@/, '');
  const telegramDisplay = /^[A-Za-z0-9_]{5,32}$/.test(username)
    ? `<a href="https://t.me/${username}">@${username}</a>` : html(telegram);
  const comment = clean(data.comment, 800);
  return [
    '🔥 <b>НОВАЯ ЗАЯВКА НА ФРАНШИЗУ</b>', '',
    `👤 <b>Имя:</b> ${html(name)}`,
    `📞 <b>Телефон:</b> ${html(phone)}`,
    `📍 <b>Город:</b> ${html(city)}`,
    ...(telegram && telegram !== '@' ? [`💬 <b>Telegram:</b> ${telegramDisplay}`] : []),
    ...(comment ? ['', `📝 <b>Комментарий:</b>\n${html(comment)}`] : []),
  ].join('\n');
}

async function telegram(token, chatId, text) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
    signal: AbortSignal.timeout(8000),
  });
  const result = await response.json();
  if (response.ok && result.ok) return true;
  throw new Error('Telegram delivery failed');
}

async function googleRelay(kind, id, text) {
  const url = process.env.GOOGLE_RELAY_URL;
  const secret = process.env.GOOGLE_RELAY_SECRET;
  if (!url || !secret) return false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const signal = AbortSignal.timeout(12000);
      let response = await fetch(url, {
        method: 'POST', redirect: 'manual',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, kind, id, text }), signal,
      });
      if ([301, 302, 303].includes(response.status)) {
        const target = new URL(response.headers.get('location'), url);
        if (target.protocol !== 'https:' || target.hostname !== 'script.googleusercontent.com') throw new Error('UnexpectedRelayRedirect');
        // Google ContentService uses a one-time GET URL. Never forward credentials.
        response = await fetch(target, { redirect: 'error', signal });
      }
      const raw = await response.text();
      let result;
      try { result = JSON.parse(raw); }
      catch {
        console.warn(`Relay non-JSON response: status=${response.status} type=${response.headers.get('content-type') || 'none'} bytes=${Buffer.byteLength(raw)}`);
        throw new Error('InvalidRelayResponse');
      }
      if (response.ok && result.ok === true) return true;
      console.warn(`Relay rejected ${kind} ${id}: ${['not_configured', 'busy', 'telegram_failed', 'send_failed'].includes(result.error) ? result.error : 'rejected'}`);
      return false;
    } catch (error) {
      console.warn(`Relay attempt ${attempt + 1} failed for ${kind} ${id}: ${error.name}`);
    }
  }
  return false;
}

module.exports.handler = async event => {
  const origin = event.headers?.Origin || event.headers?.origin || '';
  if (event.httpMethod === 'OPTIONS') return reply(200, { ok: true }, origin);
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'Неподдерживаемый метод.' }, origin);
  if (origin !== SITE_ORIGIN) return reply(403, { ok: false, error: 'Недопустимый источник заявки.' }, origin);
  if (!/application\/json/i.test(event.headers?.['Content-Type'] || event.headers?.['content-type'] || '')) return reply(415, { ok: false, error: 'Неподдерживаемый формат.' }, origin);
  if (!event.body || event.body.length > 12000) return reply(413, { ok: false, error: 'Проверьте поля заявки.' }, origin);

  let data;
  try { data = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body); }
  catch { return reply(400, { ok: false, error: 'Проверьте поля заявки.' }, origin); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return reply(400, { ok: false, error: 'Проверьте поля заявки.' }, origin);
  const ip = event.requestContext?.identity?.sourceIp || 'unknown';
  if (!allow(ip)) return reply(429, { ok: false, error: 'Слишком много попыток. Подождите минуту.' }, origin);
  const kind = event.path === '/booking' || event.queryStringParameters?.kind === 'booking' ? 'booking' : 'franchise';
  let text;
  try { text = message(kind, data); }
  catch (error) { return reply(400, { ok: false, error: error.message }, origin); }

  const id = /^[a-f0-9-]{36}$/.test(data.requestId || '') ? data.requestId : randomUUID();
  for (const [key, entry] of deliveries) if (Date.now() - entry.created > 600000) deliveries.delete(key);
  const previous = deliveries.get(id);
  if (previous) return previous.text === text && previous.kind === kind ? previous.promise : reply(409, { ok: false, error: 'Повторите отправку.' }, origin);
  if (deliveries.size >= 2000) return reply(429, { ok: false, error: 'Повторите позже.' }, origin);
  const promise = deliver(kind, id, text, origin);
  deliveries.set(id, { created: Date.now(), text, kind, promise });
  const result = await promise;
  if (result.statusCode !== 200) deliveries.delete(id);
  return result;
};

async function deliver(kind, id, text, origin) {
  const token = process.env[kind === 'booking' ? 'BOOKING_TELEGRAM_BOT_TOKEN' : 'FRANCHISE_TELEGRAM_BOT_TOKEN'];
  const chat = process.env[kind === 'booking' ? 'BOOKING_TELEGRAM_CHAT_ID' : 'FRANCHISE_TELEGRAM_CHAT_ID'];
  if (!token && !process.env.GOOGLE_RELAY_URL) return reply(503, { ok: false, error: 'Приём заявок временно недоступен.' }, origin);
  if (!process.env.GOOGLE_RELAY_URL && token && chat) {
    try { if (await telegram(token, chat, text)) return reply(200, { ok: true, id, route: 'direct' }, origin); }
    catch (error) { console.warn(`Direct Telegram delivery failed for ${kind} ${id}: ${error.name}`); }
  }
  try {
    if (await googleRelay(kind, id, text)) return reply(200, { ok: true, id, route: 'relay' }, origin);
  } catch (error) { console.warn(`Google relay failed for ${kind} ${id}: ${error.name}`); }
  return reply(502, { ok: false, id, error: 'Не удалось подтвердить доставку заявки. Повторите позже.' }, origin);
}
