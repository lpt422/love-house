/**
 * 旅行日记 + 留言板（合并为一个入口）
 * 上半部分是旅行日记，下半部分是留言板。
 */
App.pages = App.pages || {};
App.pages.notes = (function () {

  var MOODS = ['🥰', '😊', '😢', '😤', '😴', '🤔', '😭', '😍', '🤩', '🌊'];
  var mood = '🥰';

  function init() {
    // 心情选择
    var wrap = document.getElementById('notes-diary-moods');
    MOODS.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mood-btn' + (m === mood ? ' selected' : '');
      b.textContent = m;
      b.dataset.mood = m;
      b.addEventListener('click', function () {
        mood = m;
        wrap.querySelectorAll('.mood-btn').forEach(function (x) { x.classList.toggle('selected', x === b); });
      });
      wrap.appendChild(b);
    });

    // 发布日记
    document.getElementById('notes-diary-publish').addEventListener('click', function () {
      var input = document.getElementById('notes-diary-text');
      var text = input.value.trim();
      if (!text) { App.utils.toast('写点什么再发布吧～'); return; }
      App.store.write('diary', { text: text, mood: mood }).then(function () {
        input.value = '';
        App.utils.toast('日记发布成功 💚');
      }).catch(function (err) { console.error(err); App.utils.toast('发布失败'); });
    });

    // 发送留言
    document.getElementById('notes-msg-send').addEventListener('click', function () {
      var input = document.getElementById('notes-msg-text');
      var text = input.value.trim();
      if (!text) { App.utils.toast('写点内容再留言吧～'); return; }
      var anon = document.getElementById('notes-msg-anon').checked;
      App.store.write('messages', { text: text, anon: anon }).then(function () {
        input.value = '';
        document.getElementById('notes-msg-anon').checked = false;
        App.utils.toast('留言成功 💌');
      }).catch(function (err) { console.error(err); App.utils.toast('留言失败'); });
    });

    App.store.on('diary', renderDiary);
    App.store.on('messages', renderMessages);
  }

  function onShow() {
  renderDiary();
  renderMessages();
  if (App.pages.anniversary && App.pages.anniversary.onShow) {
    try { App.pages.anniversary.onShow(); } catch (e) { console.error(e); }
  }
}

  function renderDiary() {
    var box = document.getElementById('notes-diary-list');
    var list = App.store.state.diary;
    if (!list.length) {
      box.innerHTML = '<div class="text-center py-6 text-slate-400 text-sm">还没有日记，写下第一篇吧 ✍️</div>';
      return;
    }
    box.innerHTML = list.map(function (item) {
      return '<div class="card p-3">' +
        '<div class="flex items-center gap-2 mb-1">' +
          '<span class="avatar shrink-0" style="background:' + App.utils.esc(item.authorColor || '#14b8a6') + '">' + App.utils.esc((item.authorName || '?').charAt(0)) + '</span>' +
          '<span class="text-sm font-medium text-teal-700">' + App.utils.esc(item.authorName || '') + '</span>' +
          '<span class="text-xs text-slate-400 ml-auto">' + App.utils.timeAgo(item.createdAt) + '</span>' +
          '<span class="text-xl">' + (item.mood || '🥰') + '</span>' +
        '</div>' +
        '<p class="text-slate-600 whitespace-pre-wrap leading-relaxed break-words">' + App.utils.esc(item.text) + '</p>' +
      '</div>';
    }).join('');
  }

  function renderMessages() {
    var box = document.getElementById('notes-msg-list');
    var list = App.store.state.messages;
    if (!list.length) {
      box.innerHTML = '<div class="text-center py-6 text-slate-400 text-sm">留言板空空的，给 TA 留个言吧 💌</div>';
      return;
    }
    box.innerHTML = list.map(function (m) {
      var isMine = m.authorId === App.store.state.profile.id;
      var name = m.anon ? '某人 💌' : (m.authorName || '某人');
      var color = m.anon ? '#14b8a6' : (m.authorColor || '#14b8a6');
      var align = isMine ? 'justify-end' : 'justify-start';
      var bubble = isMine ? 'background:linear-gradient(135deg,#14b8a6,#0ea5e9);color:#fff;' : 'background:#fff;border:1px solid #99f6e4;';
      return '<div class="flex ' + align + '">' +
        '<div class="max-w-[80%]">' +
          '<div class="flex items-center gap-2 mb-1 ' + (isMine ? 'justify-end' : '') + '">' +
            '<span class="text-xs text-slate-400">' + App.utils.esc(name) + '</span>' +
            '<span class="text-[10px] text-slate-300">' + App.utils.timeAgo(m.createdAt) + '</span>' +
          '</div>' +
          '<div class="msg-bubble" style="' + bubble + '">' + App.utils.esc(m.text) + '</div>' +
        '</div></div>';
    }).join('');
  }

  return { init: init, onShow: onShow };
})();