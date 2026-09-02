/**
 * 纪念日：平时只显示一个「添加」按钮，点击后才展开输入表单。
 * 支持添加 / 编辑 / 删除，自动计算下次还有几天。
 */
App.pages = App.pages || {};
App.pages.anniversary = (function () {

  var editingId = null; // 正在编辑的记录 id（null 表示新增）

  function init() {
    document.getElementById('anni-date').value = App.utils.fmtDate(new Date());

    // 点击「添加」展开表单
    document.getElementById('anni-add-btn').addEventListener('click', function () {
      resetForm();
      showForm();
    });

    // 取消 / 收起表单
    document.getElementById('anni-cancel-edit').addEventListener('click', hideForm);

    // 新增 / 保存编辑
    document.getElementById('anni-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var title = document.getElementById('anni-title').value.trim();
      var date = document.getElementById('anni-date').value;
      var note = document.getElementById('anni-note').value.trim();
      if (!title) { App.utils.toast('给纪念日起个名字吧 🎀'); return; }
      if (!date) { App.utils.toast('请选择日期'); return; }

      var data = { title: title, date: date, note: note };
      var done = editingId
        ? App.store.update('anniversaries', editingId, data)
        : App.store.write('anniversaries', data);

      done.then(function () {
        hideForm();
        App.utils.toast(editingId ? '已更新 💕' : '纪念日已添加 🎉');
      }).catch(function (err) {
        console.error(err);
        App.utils.toast(editingId ? '更新失败' : '添加失败');
      });
    });

    // 列表事件委托：编辑 / 删除
    document.getElementById('anni-list').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var id = btn.dataset.id;
      var item = App.store.state.anniversaries.find(function (a) { return a.id === id; });
      if (!item) return;

      if (btn.dataset.action === 'edit') {
        editingId = id;
        resetForm();
        document.getElementById('anni-title').value = item.title || '';
        document.getElementById('anni-date').value = item.date || '';
        document.getElementById('anni-note').value = item.note || '';
        showForm();
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

  function showForm() {
    document.getElementById('anni-form-wrap').classList.remove('hidden');
    document.getElementById('anni-cancel-edit').classList.remove('hidden');
    setTimeout(function () { document.getElementById('anni-title').focus(); }, 0);
  }

  function hideForm() {
    resetForm();
    document.getElementById('anni-form-wrap').classList.add('hidden');
  }

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
      box.innerHTML = '<div class="text-center py-6 text-slate-400 text-sm">还没有纪念日，点右上角「添加」记一个吧 🎀</div>';
      return;
    }
    box.innerHTML = list.map(function (a) {
      var next = a.date ? App.utils.nextOccurrence(a.date) : null;
      var days = next ? Math.round((next.getTime() - new Date().getTime()) / 86400000) : null;
      var badge = days === null ? '' :
        (days === 0 ? '<span class="text-xs bg-teal-100 text-teal-600 px-2 py-1 rounded-full">就是今天 🎉</span>' :
         days === 1 ? '<span class="text-xs bg-teal-100 text-teal-600 px-2 py-1 rounded-full">明天 💗</span>' :
         '<span class="text-xs bg-teal-100 text-teal-600 px-2 py-1 rounded-full">还有 ' + days + ' 天</span>');
      return '<div class="flex items-center gap-3 py-2">' +
        '<div class="flex-1 min-w-0">' +
          '<div class="flex items-center gap-2 flex-wrap"><p class="font-medium text-teal-700">🎀 ' + App.utils.esc(a.title) + '</p>' + badge + '</div>' +
          '<p class="text-xs text-slate-400 mt-0.5">📅 ' + App.utils.esc(a.date) + (a.note ? ' · ' + App.utils.esc(a.note) : '') + '</p>' +
        '</div>' +
        '<div class="flex gap-2 shrink-0">' +
          '<button data-action="edit" data-id="' + App.utils.esc(a.id) + '" class="text-xs text-teal-500 hover:text-teal-700">✏️</button>' +
          '<button data-action="delete" data-id="' + App.utils.esc(a.id) + '" class="text-xs text-slate-400 hover:text-red-500">🗑</button>' +
        '</div></div>';
    }).join('');
  }

  return { init: init, onShow: render };
})();