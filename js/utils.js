/**
 * 工具函数：ID 生成、日期处理、HTML 转义、剪贴板、轻提示等
 */
window.App = window.App || {};

App.utils = (function () {

  // 房间密钥字符表：纯数字（6 位密钥，去掉容易输错的字母）
  var KEY_DIGITS = '0123456789';

  /** 生成随机字符串 */
  function randStr(len, alphabet) {
    var chars = alphabet || KEY_DIGITS;
    var s = '';
    for (var i = 0; i < len; i++) {
      s += chars[Math.floor(Math.random() * chars.length)];
    }
    return s;
  }

  /** 生成本地唯一 ID（一般用于临时 id） */
  function genId(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + randStr(6, 'abcdefghijklmnopqrstuvwxyz');
  }

  /**
   * 获取「设备匿名身份 userId」：
   * 第一次访问时随机生成并写进 localStorage，之后始终复用。
   * 这样无需账号密码登录，也能稳定区分「我」和「TA」。
   */
  function getUserId() {
    var key = App.config.LS_USER_ID;
    var id = localStorage.getItem(key);
    if (!id) {
      id = 'u_' + Date.now().toString(36) + randStr(10, 'abcdefghijklmnopqrstuvwxyz0123456789');
      localStorage.setItem(key, id);
    }
    return id;
  }

  /** 生成房间密钥：6 位纯数字（第一位不为 0，便于阅读和输入） */
  function genRoomKey() {
    var first = '123456789'[Math.floor(Math.random() * 9)];
    return first + randStr(5, KEY_DIGITS);
  }

  /** 清洗用户输入的密钥：只保留数字，最多取 6 位 */
  function normalizeKey(key) {
    return String(key || '').replace(/\D/g, '').slice(0, 6);
  }

  /** HTML 转义，防止 XSS */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** 转义并保留换行（用于列表摘要） */
  function nl2br(s) {
    return esc(s).replace(/\n/g, '<br>');
  }

  /** 各种时间格式 → Date 对象（兼容字符串 / Date / Firestore Timestamp） */
  function toDate(t) {
    if (!t) return null;
    if (t instanceof Date) return t;
    if (typeof t.toDate === 'function') return t.toDate();
    if (typeof t === 'string' || typeof t === 'number') return new Date(t);
    return null;
  }

  /** Date → 'YYYY-MM-DD' */
  function fmtDate(d) {
    if (!d) return '';
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  /** 解析 'YYYY-MM-DD' 为本地时间 0 点 */
  function parseDate(str) {
    if (!str) return null;
    var parts = String(str).split('-');
    return new Date(+parts[0], +parts[1] - 1, +parts[2]);
  }

  /** Date → 'MM月DD日 HH:mm' */
  function fmtDateTime(d) {
    if (!d) return '';
    var m = d.getMonth() + 1;
    var day = d.getDate();
    var h = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    return m + '月' + day + '日 ' + h + ':' + min;
  }

  /** 相对时间：刚刚 / N分钟前 / N小时前 / N天前 / 日期 */
  function timeAgo(t) {
    var d = toDate(t);
    if (!d) return '';
    var diff = Date.now() - d.getTime();
    var min = 60 * 1000, hour = 60 * min, day = 24 * hour;
    if (diff < min) return '刚刚';
    if (diff < hour) return Math.floor(diff / min) + ' 分钟前';
    if (diff < day) return Math.floor(diff / hour) + ' 小时前';
    if (diff < 30 * day) return Math.floor(diff / day) + ' 天前';
    return fmtDateTime(d);
  }

  /** 两个日期相差的整天数（a - b，取整） */
  function daysDiff(a, b) {
    var da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    var db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((da - db) / (24 * 60 * 60 * 1000));
  }

  /** 下一次纪念日：今年没过就取明年 */
  function nextOccurrence(dateStr, now) {
    var base = parseDate(dateStr);
    var n = now || new Date();
    var today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    var next = new Date(n.getFullYear(), base.getMonth(), base.getDate());
    if (next < today) next = new Date(n.getFullYear() + 1, base.getMonth(), base.getDate());
    return next;
  }

  /** 复制文本到剪贴板（含降级方案，兼容 http 直接打开） */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; });
    }
    return new Promise(function (resolve) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      resolve(ok);
    });
  }

  /** 轻提示（右下/底部小气泡） */
  function toast(msg) {
    var box = document.getElementById('toast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toast';
      document.body.appendChild(box);
    }
    box.textContent = msg;
    box.classList.add('show');
    clearTimeout(box._timer);
    box._timer = setTimeout(function () { box.classList.remove('show'); }, 2200);
  }

  /** 生成漂浮爱心背景 */
  function spawnHearts(count) {
    var wrap = document.getElementById('hearts');
    if (!wrap) return;
    var emojis = ['🧭', '🌿', '✈️', '⛰️', '🏝️'];
    for (var i = 0; i < count; i++) {
      var s = document.createElement('span');
      s.textContent = emojis[i % emojis.length];
      var size = 14 + Math.random() * 22;
      s.style.fontSize = size + 'px';
      s.style.left = Math.random() * 100 + 'vw';
      s.style.animationDuration = (8 + Math.random() * 10) + 's';
      s.style.animationDelay = (Math.random() * 8) + 's';
      wrap.appendChild(s);
    }
  }

  /** 简单防抖 */
  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, wait);
    };
  }

  return {
    randStr: randStr, genId: genId, getUserId: getUserId,
    genRoomKey: genRoomKey, normalizeKey: normalizeKey,
    esc: esc, nl2br: nl2br, toDate: toDate, fmtDate: fmtDate, parseDate: parseDate,
    fmtDateTime: fmtDateTime, timeAgo: timeAgo, daysDiff: daysDiff, nextOccurrence: nextOccurrence,
    copyText: copyText, toast: toast, spawnHearts: spawnHearts, debounce: debounce
  };
})();