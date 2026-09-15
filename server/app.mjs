import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicOrigin = process.env.PUBLIC_ORIGIN || 'https://club.forcezon.ru';
const port = Number(process.env.PORT || 3000);
const franchiseToken = process.env.FRANCHISE_TELEGRAM_BOT_TOKEN;
const bookingToken = process.env.BOOKING_TELEGRAM_BOT_TOKEN;
const franchiseChat = process.env.FRANCHISE_TELEGRAM_CHAT_ID;
const bookingChat = process.env.BOOKING_TELEGRAM_CHAT_ID;
const limits = new Map();
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}

function field(data, key, max = 120) {
  return typeof data[key] === 'string' ? data[key].trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max) : '';
}

const escapeHtml = value => value.replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]);

function allow(ip) {
  const now = Date.now();
  for (const [key, entry] of limits) if (entry.until <= now) limits.delete(key);
  const key = ip || 'unknown';
  const entry = limits.get(key) || { count: 0, until: now + 600_000 };
  const global = limits.get('global') || { count: 0, until: now + 600_000 };
  entry.count++;
  global.count++;
  limits.set(key, entry);
  limits.set('global', global);
  return entry.count <= 3 && global.count <= 30;
}

async function body(request) {
  const declared = Number(request.headers['content-length'] || 0);
  if (declared > 12_000) throw new RangeError('Body too large');
  const chunks = [];
  let size = 0;
  request.setTimeout(5000, () => request.destroy());
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 12_000) throw new RangeError('Body too large');
    chunks.push(chunk);
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new SyntaxError('Invalid body');
  return parsed;
}

async function sendTelegram(botToken, chatId, text) {
  const result = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(12_000),
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
  });
  const data = await result.json();
  return result.ok && data.ok === true;
}

async function handleLead(request, response, kind) {
  if (request.method !== 'POST') return json(response, 405, { ok: false, error: 'Неподдерживаемый метод.' });
  const allowedOrigin = process.env.NODE_ENV === 'production' ? publicOrigin : `http://localhost:${port}`;
  if (request.headers.origin !== allowedOrigin && request.headers.origin !== publicOrigin) return json(response, 403, { ok: false, error: 'Недопустимый источник заявки.' });
  if (!request.headers['content-type']?.includes('application/json')) return json(response, 415, { ok: false, error: 'Неподдерживаемый формат.' });
  const chatId = kind === 'franchise' ? franchiseChat : bookingChat;
  const botToken = kind === 'franchise' ? franchiseToken : bookingToken;
  if (!botToken || !chatId) return json(response, 503, { ok: false, error: 'Приём заявок временно недоступен.' });
  const socketIp = request.socket.remoteAddress;
  const trustedProxy = socketIp === '127.0.0.1' || socketIp === '::1' || socketIp === '::ffff:127.0.0.1';
  const ip = trustedProxy ? String(request.headers['x-real-ip'] || socketIp) : socketIp;
  if (!allow(ip)) return json(response, 429, { ok: false, error: 'Слишком много заявок. Повторите через 10 минут.' });
  let data;
  try { data = await body(request); }
  catch (error) { return json(response, error instanceof RangeError ? 413 : 400, { ok: false, error: 'Проверьте поля заявки.' }); }
  const name = field(data, 'name');
  const phone = field(data, 'phone', 40);
  const digits = phone.replace(/\D/g, '');
  if (!name || !/^[+\d\s()\-]+$/.test(phone) || digits.length < 10 || digits.length > 15) return json(response, 400, { ok: false, error: 'Укажите имя и корректный телефон.' });

  let text;
  if (kind === 'franchise') {
    const city = field(data, 'city');
    if (!city || field(data, 'consent', 20) !== 'accepted') return json(response, 400, { ok: false, error: 'Укажите город и подтвердите согласие.' });
    const telegram = field(data, 'telegram');
    const username = telegram.replace(/^@/, '');
    const telegramDisplay = /^[A-Za-z0-9_]{5,32}$/.test(username)
      ? `<a href="https://t.me/${username}">@${username}</a>` : escapeHtml(telegram);
    const comment = field(data, 'comment', 800);
    text = [
      '🔥 <b>НОВАЯ ЗАЯВКА НА ФРАНШИЗУ</b>', '',
      `👤 <b>Имя:</b> ${escapeHtml(name)}`,
      `📞 <b>Телефон:</b> ${escapeHtml(phone)}`,
      `📍 <b>Город:</b> ${escapeHtml(city)}`,
      ...(telegram && telegram !== '@' ? [`💬 <b>Telegram:</b> ${telegramDisplay}`] : []),
      ...(comment ? ['', `📝 <b>Комментарий:</b>\n${escapeHtml(comment)}`] : []),
    ].join('\n');
  } else {
    text = [
      '📨 <b>Новая бронь — ФОРС Дроп Зона</b>', '',
      `👤 <b>Имя:</b> ${escapeHtml(name)}`,
      `📞 <b>Телефон:</b> ${escapeHtml(phone)}`,
    ].join('\n');
  }

  try {
    if (!await sendTelegram(botToken, chatId, text)) return json(response, 502, { ok: false, error: 'Не удалось доставить заявку. Попробуйте позже.' });
    return json(response, 200, { ok: true });
  } catch {
    return json(response, 502, { ok: false, error: 'Не удалось подтвердить доставку. При повторной отправке возможно дублирование заявки.' });
  }
}

async function handleStatic(request, response, pathname) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, { ok: false });
  let target;
  try {
    const decoded = decodeURIComponent(pathname);
    if (decoded.includes('\0') || decoded.split('/').some(segment => segment === '..' || segment.startsWith('.')) || /^\/(server|scripts)(\/|$)/.test(decoded)) throw new Error('Invalid path');
    target = resolve(webRoot, `.${decoded}`, decoded.endsWith('/') ? 'index.html' : '');
    if (target !== webRoot && !target.startsWith(webRoot + sep)) throw new Error('Invalid path');
    let info = await stat(target);
    if (info.isDirectory()) { target = resolve(target, 'index.html'); info = await stat(target); }
    if (!info.isFile()) throw new Error('Not a file');
    const actual = await realpath(target);
    if (!actual.startsWith(webRoot + sep)) throw new Error('Invalid path');
    const type = mime[extname(target).toLowerCase()];
    if (!type) throw new Error('Unsupported file');
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': type.startsWith('text/html') ? 'no-cache' : 'public, max-age=600', 'X-Content-Type-Options': 'nosniff' });
    if (request.method === 'HEAD') return response.end();
    response.end(await readFile(target));
  } catch { json(response, 404, { ok: false, error: 'Страница не найдена.' }); }
}

createServer(async (request, response) => {
  const pathname = new URL(request.url, publicOrigin).pathname;
  if (pathname === '/healthz') return json(response, 200, { ok: true });
  if (pathname === '/api/franchise') return handleLead(request, response, 'franchise');
  if (pathname === '/api/booking') return handleLead(request, response, 'booking');
  return handleStatic(request, response, pathname);
}).listen(port, '127.0.0.1', () => console.log(`FORCE server listening on 127.0.0.1:${port}`));
