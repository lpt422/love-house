/**
 * 日记页：写下心情 + 内容，实时同步给 TA
 */
App.pages = App.pages || {};
App.pages.diary = (function () {

  var MOODS = ['🥰', '😊', '😢', '😤', '😴', '🤔', '😭', '😍'];
  var mood = '🥰'; // 当前选中的心情

  function init() {
    // 渲染心情选择按钮
    var wrap = document.getElementById('diary-moods');
    MOODS.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mood-btn' + (m === mood ? ' selected' : '');
      b.textContent = m;
      b.dataset.mood = m;
      b.addEventListener('click', function () {
        mood = m;
        wrap.querySelectorAll('.mood-btn').forEach(function (x) {
          x.classList.toggle('selected', x === b);
        });
      });
      wrap.appendChild(b);
    });

    // 发布日记
    document.getElementById('diary-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('diary-text');
      var text = input.value.trim();
      if (!text) { App.utils.toast('写点什么再发布吧～'); return; }
      // 写入 Supabase 数据库：对方通过 Realtime 实时监听自动看到
      App.store.write('diary', { text: text, mood: mood }).then(function () {
        input.value = '';
        App.utils.toast('日记发布成功 💕');
      }).catch(function (err) {
        console.error(err);
        App.utils.toast('发布失败，请重试');
      });
    });

    // 数据变化时重新渲染列表
    App.store.on('diary', render);
  }

  function onShow() {}

  function render() {
    var list = App.store.state.diary;
    var box = document.getElementById('diary-list');
    if (!list.length) {
      box.innerHTML = '<div class="text-center py-10 text-rose-300">还没有日记，写下属于你们的第一篇吧 ✍️</div>';
      return;
    }
    box.innerHTML = list.map(function (item) {
      return '<div class="card p-4">' +
        '<div class="flex items-center gap-2 mb-2">' +
          '<span class="avatar shrink-0" style="background:' + App.utils.esc(item.authorColor || '#f9a8d4') + '">' + App.utils.esc((item.authorName || '?').charAt(0)) + '</span>' +
          '<div class="flex-1 min-w-0">' +
            '<p class="text-sm font-medium text-rose-600">' + App.utils.esc(item.authorName || '') + '</p>' +
            '<p class="text-xs text-rose-300">' + App.utils.timeAgo(item.createdAt) + '</p>' +
          '</div>' +
          '<span class="text-2xl">' + (item.mood || '🥰') + '</span>' +
        '</div>' +
        '<p class="text-rose-900 whitespace-pre-wrap leading-relaxed break-words">' + App.utils.esc(item.text) + '</p>' +
      '</div>';
    }).join('');
  }

  return { init: init, onShow: onShow };
})();