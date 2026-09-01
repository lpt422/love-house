/**
 * 留言板：像聊天一样给对方留言，支持匿名小纸条
 */
App.pages = App.pages || {};
App.pages.message = (function () {

  function init() {
    document.getElementById('msg-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('msg-text');
      var text = input.value.trim();
      if (!text) { App.utils.toast('写点内容再留言吧～'); return; }
      var anon = document.getElementById('msg-anon').checked;
      // 写入 Supabase 数据库：对方实时看到
      App.store.write('messages', { text: text, anon: anon }).then(function () {
        input.value = '';
        document.getElementById('msg-anon').checked = false;
        App.utils.toast('留言成功 💌');
      }).catch(function (err) {
        console.error(err);
        App.utils.toast('留言失败');
      });
    });

    App.store.on('messages', render);
  }

  function render() {
    var list = App.store.state.messages;
    var box = document.getElementById('msg-list');
    if (!list.length) {
      box.innerHTML = '<div class="text-center py-10 text-rose-300">留言板空空的，给 TA 留个言吧 💌</div>';
      return;
    }
    box.innerHTML = list.map(function (m) {
      var isMine = m.authorId === App.store.state.profile.id;
      var name = m.anon ? '某人 💌' : (m.authorName || '某人');
      var color = m.anon ? '#f9a8d4' : (m.authorColor || '#f9a8d4');
      var align = isMine ? 'justify-end' : 'justify-start';
      var bubbleStyle = isMine
        ? 'background:linear-gradient(135deg,#fb7185,#f472b6);color:#fff;'
        : 'background:#fff;border:1px solid #fbcfe8;';
      return '<div class="flex ' + align + '">' +
        '<div class="max-w-[80%]">' +
          '<div class="flex items-center gap-2 mb-1 ' + (isMine ? 'justify-end' : '') + '">' +
            '<span class="text-xs text-rose-400">' + App.utils.esc(name) + '</span>' +
            '<span class="text-[10px] text-rose-300">' + App.utils.timeAgo(m.createdAt) + '</span>' +
          '</div>' +
          '<div class="msg-bubble" style="' + bubbleStyle + '">' + App.utils.esc(m.text) + '</div>' +
        '</div></div>';
    }).join('');
  }

  return { init: init, onShow: render };
})();