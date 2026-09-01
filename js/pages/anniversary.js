/**
 * 纪念日页：添加 / 编辑 / 删除纪念日，自动计算下次还有几天
 */
App.pages = App.pages || {};
App.pages.anniversary = (function () {

  var editingId = null; // 正在编辑的记录 id（null 表示新增）

  function init() {
    // 默认日期：今天
    document.getElementById('anni-date').value = App.utils.fmtDate(new Date());

    // 新增 / 保存编辑
    document.getElementById('anni-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var title = document.getElementById('anni-title').value.trim();
      var date = document.getElementById('anni-date').value;
      var note = document.getElementById('anni-note').value.trim();
      if (!title) { App.utils.toast('给纪念日起个名字吧 🎀'); return; }
      if (!date) { App.utils.toast('请选择日期'); return; }

      var data = { title: title, date: date, note: note };
      if (editingId) {
        App.store.update('anniversaries', editingId, data).then(function () {
          resetForm();
          App.utils.toast('已更新 💕');
        }).catch(function (err) { console.error(err); App.utils.toast('更新失败'); });
      } else {
        App.store.write('anniversaries', data).then(function () {
          resetForm();
          App.utils.toast('纪念日已添加 🎉');
        }).catch(function (err) { console.error(err); App.utils.toast('添加失败'); });
      }
    });

    // 取消编辑
    document.getElementById('anni-cancel-edit').addEventListener('click', resetForm);

    // 列表事件委托：编辑 / 删除
    document.getElementById('anni-list').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var id = btn.dataset.id;
      var item = App.store.state.anniversaries.find(function (a) { return a.id === id; });
      if (!item) return;

      if (btn.dataset.action === 'edit') {
        editingId = id;
        document.getElementById('anni-title').value = item.title || '';
        document.getElementById('anni-date').value = item.date || '';
        document.getElementById('anni-note').value = item.note || '';
        document.getElementById('anni-cancel-edit').classList.remove('hidden');
        document.getElementById('anni-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (btn.dataset.action === 'delete') {
        if (confirm('确定删除「' + item.title + '」吗？')) {
          App.store.remove('anniversaries', id).catch(function (err) {
            console.error(err);
            App.utils.toast('删除失败');
          });
        }
      }
    });

    App.store.on('anniversaries', render);
  }

  /** 清空表单，退出编辑模式 */
  function resetForm() {
    editingId = null;
    document.getElementById('anni-title').value = '';
    document.getElementById('anni-note').value = '';
    document.getElementById('anni-date').value = App.utils.fmtDate(new Date());
    document.getElementById('anni-cancel-edit').classList.add('hidden');
  }

  function render() {
    var box = document.getElementById('anni-list');
    var list = App.store.state.anniversaries;
    if (!list.length) {
      box.innerHTML = '<div class="text-center py-10 text-rose-300">还没有纪念日，添加第一个吧 🎀</div>';
      return;
    }
    box.innerHTML = list.map(function (a) {
      var next = a.date ? App.utils.nextOccurrence(a.date) : null;
      var days = next ? Math.round((next.getTime() - new Date().getTime()) / 86400000) : null;
      var badge = days === null ? '' :
        (days === 0 ? '<span class="text-xs bg-rose-100 text-rose-500 px-2 py-1 rounded-full">就是今天 🎉</span>' :
         days === 1 ? '<span class="text-xs bg-rose-100 text-rose-500 px-2 py-1 rounded-full">明天 💗</span>' :
         '<span class="text-xs bg-rose-100 text-rose-500 px-2 py-1 rounded-full">还有 ' + days + ' 天</span>');
      return '<div class="card p-4 flex items-center gap-3">' +
        '<div class="flex-1 min-w-0">' +
          '<div class="flex items-center gap-2 flex-wrap"><p class="font-medium text-rose-700">🎀 ' + App.utils.esc(a.title) + '</p>' + badge + '</div>' +
          '<p class="text-xs text-rose-400 mt-1">📅 ' + App.utils.esc(a.date) + (a.note ? ' · ' + App.utils.esc(a.note) : '') + '</p>' +
          '<p class="text-xs text-rose-300 mt-0.5">由 ' + App.utils.esc(a.authorName || '对方') + ' 添加</p>' +
        '</div>' +
        '<div class="flex flex-col gap-1 shrink-0">' +
          '<button data-action="edit" data-id="' + App.utils.esc(a.id) + '" class="text-xs text-rose-400 hover:text-rose-600">✏️ 编辑</button>' +
          '<button data-action="delete" data-id="' + App.utils.esc(a.id) + '" class="text-xs text-rose-300 hover:text-rose-500">🗑 删除</button>' +
        '</div></div>';
    }).join('');
  }

  return { init: init, onShow: render };
})();