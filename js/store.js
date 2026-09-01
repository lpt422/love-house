/**
 * ============================================================
 * 数据中枢 + 实时同步引擎（本应用最核心的部分）
 * ============================================================
 * 使用 Supabase PostgreSQL + Realtime。
 *
 * 数据模型：
 *   love_rooms         房间（room_code 为 6 位密钥，id 为内部外键）
 *   love_members       成员（room_id、user_id、nickname、color）
 *   love_diary         日记
 *   love_anniversaries 纪念日
 *   love_photos        照片（photo_url 指向 Storage 图片）
 *   love_messages      留言板
 *
 * 同步原理：
 *   进入房间后：
 *     1) 先用 select 拉取一次历史数据；
 *     2) 再通过 Realtime 订阅每张表的 INSERT/UPDATE/DELETE；
 *   一方新增 / 修改 / 删除，另一方浏览器会实时收到 postgres_changes 事件，
 *   页面随即自动重新渲染 —— 这就是"双人实时同步"。
 * ============================================================
 */
window.App = window.App || {};

App.store = (function () {

  var state = {
    roomId: null,    // 房间数据库内部 id（uuid，外键关联用）
    roomKey: null,   // 房间 6 位密钥（展示 / 分享用）
    profile: null,   // 我的设备档案 { id, name, color }
    room: null,      // 房间数据 { startDate, ... }
    ready: false,    // 首次数据是否已同步完成
    members: [],
    diary: [],
    photos: [],
    anniversaries: [],
    messages: []
  };

  // Supabase 表名统一维护
  var TABLE = {
    rooms: 'love_rooms',
    members: 'love_members',
    diary: 'love_diary',
    photos: 'love_photos',
    anniversaries: 'love_anniversaries',
    messages: 'love_messages'
  };

  // 列表集合的字段映射与排序方向
  var LIST_CONFIG = {
    members: { table: TABLE.members, mapper: mapMember, asc: true },
    diary: { table: TABLE.diary, mapper: mapDiary, asc: false },
    photos: { table: TABLE.photos, mapper: mapPhoto, asc: false },
    anniversaries: { table: TABLE.anniversaries, mapper: mapAnniversary, asc: false },
    messages: { table: TABLE.messages, mapper: mapMessage, asc: false }
  };

  var listeners = {};  // 事件名 -> [回调函数]
  var channels = [];   // 已订阅的 Realtime channel
  var initSeq = 0;     // 用于生成唯一 channel 名

  function client() { return App.supabase.client(); }

  /** 订阅事件，例如 store.on('diary', render) */
  function on(evt, cb) {
    if (!listeners[evt]) listeners[evt] = [];
    listeners[evt].push(cb);
  }

  /** 广播事件，通知所有订阅者 */
  function emit(evt) {
    (listeners[evt] || []).slice().forEach(function (cb) {
      try { cb(); } catch (e) { console.error('页面回调出错:', e); }
    });
  }

  /* ============================================================
   * 数据库行 → 页面需要的 state 形状（保持原页面代码不变）
   * ============================================================ */
  function mapRoom(row) {
    return {
      id: row.id,
      roomCode: row.room_code,
      roomName: row.room_name,
      startDate: row.start_date,
      createdAt: row.created_at
    };
  }
  function mapMember(row) {
    return {
      id: row.user_id,          // 成员身份 = 设备 userId
      name: row.nickname,
      color: row.color,
      joinedAt: row.created_at,
      lastSeen: row.created_at  // 保留字段，页面暂未使用
    };
  }
  function mapDiary(row) {
    return {
      id: row.id,
      text: row.content,        // 表里叫 content，页面叫 text
      mood: row.mood,
      authorId: row.user_id,
      authorName: row.author_name,
      authorColor: row.author_color,
      createdAt: row.created_at
    };
  }
  function mapPhoto(row) {
    return {
      id: row.id,
      dataUrl: row.photo_url,   // 表里存图片 URL，页面叫 dataUrl
      caption: row.note,
      authorId: row.user_id,
      authorName: row.author_name,
      authorColor: row.author_color,
      createdAt: row.created_at
    };
  }
  function mapAnniversary(row) {
    return {
      id: row.id,
      title: row.title,
      date: row.happen_date,    // 表里叫 happen_date，页面叫 date
      note: row.note,
      authorId: row.user_id,
      authorName: row.author_name,
      authorColor: row.author_color,
      createdAt: row.created_at
    };
  }
  function mapMessage(row) {
    return {
      id: row.id,
      text: row.text,
      anon: !!row.anon,
      authorId: row.user_id,
      authorName: row.author_name,
      authorColor: row.author_color,
      createdAt: row.created_at
    };
  }

  /* ============================================================
   * 房间创建 / 加入
   * ============================================================ */

  /** 创建房间：写入 love_rooms，并把当前设备写入 love_members */
  function createRoom(roomCode, profile, startDate) {
    return client().from(TABLE.rooms).insert({
      room_code: roomCode,
      room_name: '我们的恋爱小屋',
      start_date: startDate || null
    }).select().single()
    .then(function (res) {
      if (res.error) throw res.error;
      var room = res.data;
      return ensureMember(room.id, profile).then(function () { return room; });
    });
  }

  /** 加入房间：按 6 位密钥查房间，找不到抛错；找到后写入成员 */
  function joinRoom(roomCode, profile) {
    return client().from(TABLE.rooms)
      .select('*')
      .eq('room_code', roomCode)
      .maybeSingle()
      .then(function (res) {
        if (res.error) throw res.error;
        if (!res.data) {
          var err = new Error('没有找到这个房间，检查一下密钥？');
          err.code = 'ROOM_NOT_FOUND';
          throw err;
        }
        var room = res.data;
        return ensureMember(room.id, profile).then(function () { return room; });
      });
  }

  /** 写入 / 更新我的成员档案（按 room_id + user_id 去重） */
  function ensureMember(roomId, profile) {
    return client().from(TABLE.members).upsert({
      room_id: roomId,
      user_id: profile.id,
      nickname: profile.name,
      color: profile.color
    }, { onConflict: 'room_id,user_id' });
  }

  /* ============================================================
   * 进入房间：初始化 + 首次加载 + Realtime 订阅
   * ============================================================ */
  function init(roomId, roomCode, profile) {
    cleanup();
    state.roomId = roomId;
    state.roomKey = roomCode;
    state.profile = profile;
    state.ready = false;
    state.room = null;
    state.members = [];
    state.diary = [];
    state.photos = [];
    state.anniversaries = [];
    state.messages = [];

    // 先确保成员档案存在，再拉列表，避免自己不出现在成员列表
    ensureMember(roomId, profile).then(function () {
      var loads = [loadRoom()];
      Object.keys(LIST_CONFIG).forEach(function (key) { loads.push(loadList(key)); });
      return Promise.all(loads);
    }).then(function () {
      state.ready = true;
      emit('all');
    }).catch(onError);

    subscribeRealtime();
  }

  /** 首次加载房间文档 */
  function loadRoom() {
    return client().from(TABLE.rooms)
      .select('*')
      .eq('id', state.roomId)
      .maybeSingle()
      .then(function (res) {
        if (res.error) throw res.error;
        state.room = res.data ? mapRoom(res.data) : null;
        emit('room');
        emit('all');
      });
  }

  /** 首次加载某个列表集合 */
  function loadList(key) {
    var cfg = LIST_CONFIG[key];
    return client().from(cfg.table)
      .select('*')
      .eq('room_id', state.roomId)
      .order('created_at', { ascending: cfg.asc })
      .then(function (res) {
        if (res.error) throw res.error;
        state[key] = (res.data || []).map(cfg.mapper);
        emit(key);
        emit('all');
      });
  }

  /** 挂载 Realtime 监听 */
  function subscribeRealtime() {
    var channelName = 'db-' + state.roomId + '-' + (++initSeq) + '-' + Date.now();
    var channel = client().channel(channelName);

    // 房间文档变化（例如修改在一起的日子）
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: TABLE.rooms },
      function (payload) {
        var row = payload.eventType === 'DELETE' ? payload.old : payload.new;
        if (!row || row.id !== state.roomId) return;
        state.room = payload.eventType === 'DELETE' ? null : mapRoom(row);
        emit('room');
        emit('all');
      });

    // 每个列表集合各挂一个监听
    Object.keys(LIST_CONFIG).forEach(function (key) {
      var cfg = LIST_CONFIG[key];
      channel.on('postgres_changes',
        { event: '*', schema: 'public', table: cfg.table },
        makeListHandler(key, cfg));
    });

    channel.subscribe(function (status) {
      if (status === 'SUBSCRIBED') {
        console.log('[Supabase] Realtime 已连接');
      }
    });
    channels.push(channel);
  }

  /** 生成某个列表集合的 Realtime 事件处理器 */
  function makeListHandler(key, cfg) {
    return function (payload) {
      // 只处理当前房间的数据，忽略其它房间的广播
      var roomId = (payload.new && payload.new.room_id) || (payload.old && payload.old.room_id);
      if (roomId && roomId !== state.roomId) return;

      var list = state[key].slice();

      if (payload.eventType === 'INSERT' && payload.new) {
        list.push(cfg.mapper(payload.new));
      } else if (payload.eventType === 'UPDATE' && payload.new) {
        var i = indexOfId(list, payload.new.id);
        if (i >= 0) list[i] = cfg.mapper(payload.new);
        else list.push(cfg.mapper(payload.new));
      } else if (payload.eventType === 'DELETE' && payload.old) {
        var j = indexOfId(list, payload.old.id);
        if (j >= 0) list.splice(j, 1);
      }

      sortList(list, cfg.asc);
      state[key] = list;
      emit(key);
      emit('all');
    };
  }

  function indexOfId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return -1;
  }

  function sortList(list, asc) {
    list.sort(function (a, b) {
      var ta = App.utils.toDate(a.createdAt) || new Date(0);
      var tb = App.utils.toDate(b.createdAt) || new Date(0);
      return asc ? (ta - tb) : (tb - ta);
    });
  }

  /* ============================================================
   * 写操作
   * ============================================================ */

  /** 通用新增：自动带上房间 id 和作者信息 */
  function write(collection, data) {
    var payload = baseFields();
    if (collection === 'diary') {
      payload.content = data.text || '';
      payload.mood = data.mood || '🥰';
    } else if (collection === 'anniversaries') {
      payload.title = data.title || '';
      payload.happen_date = data.date || '';
      payload.note = data.note || '';
    } else if (collection === 'messages') {
      payload.text = data.text || '';
      payload.anon = !!data.anon;
    } else {
      return Promise.reject(new Error('未知集合: ' + collection));
    }
    return client().from(TABLE[collection]).insert(payload);
  }

  /** 通用更新 */
  function update(collection, id, data) {
    var payload = {};
    if (collection === 'diary') {
      if (data.text !== undefined) payload.content = data.text;
      if (data.mood !== undefined) payload.mood = data.mood;
    } else if (collection === 'anniversaries') {
      if (data.title !== undefined) payload.title = data.title;
      if (data.date !== undefined) payload.happen_date = data.date;
      if (data.note !== undefined) payload.note = data.note;
    } else if (collection === 'messages') {
      if (data.text !== undefined) payload.text = data.text;
      if (data.anon !== undefined) payload.anon = !!data.anon;
    } else {
      return Promise.reject(new Error('未知集合: ' + collection));
    }
    return client().from(TABLE[collection]).update(payload).eq('id', id);
  }

  /** 通用删除 */
  function remove(collection, id) {
    return client().from(TABLE[collection]).delete().eq('id', id);
  }

  /** 更新房间文档（例如修改"在一起的日子"） */
  function updateRoom(data) {
    return client().from(TABLE.rooms)
      .update({ start_date: data.startDate })
      .eq('id', state.roomId);
  }

  /** 更新我的昵称 / 颜色并同步到云端 */
  function updateProfile(patch) {
    state.profile = Object.assign({}, state.profile || {}, patch);
    try { localStorage.setItem(App.config.LS_PROFILE, JSON.stringify(state.profile)); } catch (e) {}
    ensureMember(state.roomId, state.profile).catch(function (e) { console.error(e); });
    emit('profile');
    emit('all');
  }

  /** 作者基础字段 */
  function baseFields() {
    return {
      room_id: state.roomId,
      user_id: state.profile.id,
      author_name: state.profile.name,
      author_color: state.profile.color
    };
  }

  /* ============================================================
   * 照片上传：文件进 Supabase Storage，数据库只存图片 URL
   * ============================================================ */
  function uploadPhoto(blob, note) {
    // 路径按 房间/设备/时间 组织，避免重名覆盖
    var path = state.roomId + '/' + state.profile.id + '/' +
      Date.now() + '-' + App.utils.randStr(4, 'abcdefghijklmnopqrstuvwxyz0123456789') + '.jpg';

    return client().storage
      .from(App.config.STORAGE_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg' })
      .then(function (up) {
        if (up.error) throw up.error;
        var url = client().storage
          .from(App.config.STORAGE_BUCKET)
          .getPublicUrl(up.data.path).data.publicUrl;

        // 数据库只保存图片访问 URL，不塞 base64
        return client().from(TABLE.photos).insert({
          room_id: state.roomId,
          user_id: state.profile.id,
          author_name: state.profile.name,
          author_color: state.profile.color,
          photo_url: url,
          note: note || ''
        });
      });
  }

  /* ============================================================
   * 离开房间：取消所有 Realtime 订阅（不会删除云端数据）
   * ============================================================ */
  function cleanup() {
    var c = client();
    if (c) {
      channels.forEach(function (ch) { try { c.removeChannel(ch); } catch (e) {} });
    }
    channels = [];
  }

  /** 同步错误统一处理 */
  function onError(err) {
    console.error('Supabase 同步错误:', err);
    var msg = (err && err.message) || '';
    if (msg.indexOf('permission denied') >= 0 || msg.indexOf('row-level security') >= 0) {
      App.utils.toast('权限不足：请先执行 setup.sql 的 RLS 策略');
    } else if (msg.indexOf('Failed to fetch') >= 0 || msg.indexOf('Network') >= 0) {
      App.utils.toast('网络异常，正在重试…');
    } else {
      App.utils.toast('同步出错，请检查 Supabase 配置');
    }
  }

  return {
    state: state, on: on, emit: emit,
    init: init, cleanup: cleanup,
    createRoom: createRoom, joinRoom: joinRoom,
    write: write, remove: remove, update: update, updateRoom: updateRoom,
    updateProfile: updateProfile, uploadPhoto: uploadPhoto
  };
})();