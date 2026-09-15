// Deploy as a web app: execute as owner, access "Anyone".
// Set script properties: RELAY_SECRET, BOOKING_BOT_TOKEN, BOOKING_CHAT_ID,
// FRANCHISE_BOT_TOKEN, FRANCHISE_CHAT_ID. Never put secrets in the site code.
function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var data;
  try { data = JSON.parse(e.postData.contents); }
  catch (err) { return output({ ok: false, error: 'invalid_json' }); }
  if (!data || data.secret !== props.getProperty('RELAY_SECRET')) return output({ ok: false, error: 'unauthorized' });
  if (data.kind !== 'booking' && data.kind !== 'franchise') return output({ ok: false, error: 'invalid_kind' });
  if (typeof data.text !== 'string' || data.text.length > 4096 || !/^[a-f0-9-]{36}$/.test(data.id || '')) return output({ ok: false, error: 'invalid_message' });

  var prefix = data.kind === 'booking' ? 'BOOKING' : 'FRANCHISE';
  var token = props.getProperty(prefix + '_BOT_TOKEN');
  var chat = props.getProperty(prefix + '_CHAT_ID');
  if (!token || !chat) return output({ ok: false, error: 'not_configured' });
  var cache = CacheService.getScriptCache();
  if (cache.get(data.id)) return output({ ok: true, duplicate: true });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return output({ ok: false, error: 'busy' });
  try {
    if (cache.get(data.id)) return output({ ok: true, duplicate: true });
    var response = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chat, text: data.text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
      muteHttpExceptions: true
    });
    var result = JSON.parse(response.getContentText());
    if (response.getResponseCode() !== 200 || result.ok !== true) return output({ ok: false, error: 'telegram_failed' });
    cache.put(data.id, 'sent', 21600);
    return output({ ok: true });
  } catch (err) {
    console.error('Telegram relay failed: ' + err);
    return output({ ok: false, error: 'send_failed' });
  } finally { lock.releaseLock(); }
}

function output(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
