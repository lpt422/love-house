/**
 * ============================================================
 * 数据中枢 + 实时同步引擎（核心）
 * 使用 Supabase PostgreSQL + Realtime。
 *
 * 数据模型：
 *   love_rooms          房间（room_code 为 6 位密钥）
 *   love_members        成员
 *   travel_checkin      旅行打卡（城市点亮记录）
 *   love_photos         照片（photo_url + checkin_id 绑定打卡）
 *   love_diary / love_anniversaries / love_messages  次要模块
 *
 * 同步原理：首次 select 拉取历史数据，再用 Realtime 订阅
 * INSERT/UPDATE/DELETE，一方改动，另一方自动重新渲染。
 * ============================================================
 */
window.App = window.App || {};

App.store = (function () {

  var state = {
    roomId: null, roomKey: null, profile: null, room: null, ready: false,
    members: [],
    checkins: [],       // 旅行打卡列表
    photos: [],         // 全部旅行照片
    diary: [], anniversaries: [], messages: []
  };

  var TABLE = {
    rooms: 'love_rooms', members: 'love_members',
    checkins: 'travel_checkin', photos: 'love_photos',
    diary: 'love_diary', anniversaries: 'love_anniversaries', messages: 'love_messages'
  };

  // 列表集合：字段映射 + 排序方向
  var LIST_CONFIG = {
    members: { table: TABLE.members, mapper: mapMember, asc: true },
    checkins: { table: TABLE.checkins, mapper: mapCheckin, asc: false },
    photos: { table: TABLE.photos, mapper: mapPhoto, asc: false },
    diary: { table: TABLE.diary, mapper: mapDiary, asc: false },
    anniversaries: { table: TABLE.anniversaries, mapper: mapAnniversary, asc: false },
    messages: { table: TABLE.messages, mapper: mapMessage, asc: false }
  };

  var listeners = {}, channels = [], initSeq = 0;
  function client() { return App.supabase.client(); }

  function on(evt, cb) { (listeners[evt] = listeners[evt] || []).push(cb); }
  function emit(evt) {
    (listeners[evt] || []).slice().forEach(function (cb) {
      try { cb(); } catch (e) { console.error(e); }
    });
  }

  /* —— 数据库行 → 页面 state 形状 —— */
  function mapRoom(r) { return { id: r.id, roomCode: r.room_code, roomName: r.room_name, startDate: r.start_date, createdAt: r.created_at }; }
  function mapMember(r) { return { id: r.user_id, name: r.nickname, color: r.color, joinedAt: r.created_at, lastSeen: r.created_at }; }
  function mapCheckin(r) {
    return {
      id: r.id, cityName: r.city_name, province: r.province, country: r.country,
      visitDate: r.visit_date, companion: r.companion, note: r.note,
      lon: r.lon, lat: r.lat, createdBy: r.created_by, createdAt: r.created_at
    };
  }
  function mapPhoto(r) {
    return {
      id: r.id, dataUrl: r.photo_url, caption: r.note, checkinId: r.checkin_id,
      authorId: r.user_id, authorName: r.author_name, authorColor: r.author_color, createdAt: r.created_at
    };
  }
  function mapDiary(r) { return { id: r.id, text: r.content, mood: r.mood, authorId: r.user_id, authorName: r.author_name, authorColor: r.author_color, createdAt: r.created_at }; }
  function mapAnniversary(r) { return { id: r.id, title: r.title, date: r.happen_date, note: r.note, authorId: r.user_id, authorName: r.author_name, authorColor: r.author_color, createdAt: r.created_at }; }
  function mapMessage(r) { return { id: r.id, text: r.text, anon: !!r.anon, authorId: r.user_id, authorName: r.author_name, authorColor: r.author_color, createdAt: r.created_at }; }

  /* —— 创建 / 加入房间 —— */
  function createRoom(roomCode, profile, startDate) {
    return client().from(TABLE.rooms).insert({
      room_code: roomCode, room_name: '我们的旅行地图', start_date: startDate || null
    }).select().single().then(function (res) {
      if (res.error) throw res.error;
      var room = res.data;
      return ensureMember(room.id, profile).then(function () { return room; });
    });
  }
  function joinRoom(roomCode, profile) {
    return client().from(TABLE.rooms).select('*').eq('room_code', roomCode).maybeSingle()
      .then(function (res) {
        if (res.error) throw res.error;
        if (!res.data) { var e = new Error('没有找到这个房间'); e.code = 'ROOM_NOT_FOUND'; throw e; }
        var room = res.data;
        return ensureMember(room.id, profile).then(function () { return room; });
      });
  }
  function ensureMember(roomId, profile) {
    return client().from(TABLE.members).upsert({
      room_id: roomId, user_id: profile.id, nickname: profile.name, color: profile.color
    }, { onConflict: 'room_id,user_id' });
  }

  /* —— 进入房间：首次加载 + Realtime 订阅 —— */
  function init(roomId, roomCode, profile) {
    cleanup();
    state.roomId = roomId; state.roomKey = roomCode; state.profile = profile;
    state.ready = false; state.room = null;
    state.members = []; state.checkins = []; state.photos = [];
    state.diary = []; state.anniversaries = []; state.messages = [];

    ensureMember(roomId, profile).then(function () {
      var loads = [loadRoom()];
      Object.keys(LIST_CONFIG).forEach(function (k) { loads.push(loadList(k)); });
      return Promise.all(loads);
    }).then(function () { state.ready = true; emit('all'); }).catch(onError);

    subscribeRealtime();
  }

  function loadRoom() {
    return client().from(TABLE.rooms).select('*').eq('id', state.roomId).maybeSingle()
      .then(function (res) {
        if (res.error) throw res.error;
        state.room = res.data ? mapRoom(res.data) : null;
        emit('room'); emit('all');
      });
  }
  function loadList(key) {
    var cfg = LIST_CONFIG[key];
    return client().from(cfg.table).select('*').eq('room_id', state.roomId)
      .order('created_at', { ascending: cfg.asc })
      .then(function (res) {
        if (res.error) throw res.error;
        state[key] = (res.data || []).map(cfg.mapper);
        emit(key); emit('all');
      });
  }

  /* —— Realtime 订阅 —— */
  function subscribeRealtime() {
    var ch = client().channel('db-' + state.roomId + '-' + (++initSeq) + '-' + Date.now());

    ch.on('postgres_changes', { event: '*', schema: 'public', table: TABLE.rooms },
      function (payload) {
        var row = payload.eventType === 'DELETE' ? payload.old : payload.new;
        if (!row || row.id !== state.roomId) return;
        state.room = payload.eventType === 'DELETE' ? null : mapRoom(row);
        emit('room'); emit('all');
      });

    Object.keys(LIST_CONFIG).forEach(function (key) {
      var cfg = LIST_CONFIG[key];
      ch.on('postgres_changes', { event: '*', schema: 'public', table: cfg.table },
        makeListHandler(key, cfg));
    });

    ch.subscribe(function (status) {
      if (status === 'SUBSCRIBED') console.log('[Supabase] Realtime 已连接');
    });
    channels.push(ch);
  }

  function makeListHandler(key, cfg) {
    return function (payload) {
      var roomId = (payload.new && payload.new.room_id) || (payload.old && payload.old.room_id);
      if (roomId && roomId !== state.roomId) return;

      var list = state[key].slice();
      if (payload.eventType === 'INSERT' && payload.new) {
        list.push(cfg.mapper(payload.new));
      } else if (payload.eventType === 'UPDATE' && payload.new) {
        var i = indexOfId(list, payload.new.id);
        if (i >= 0) list[i] = cfg.mapper(payload.new); else list.push(cfg.mapper(payload.new));
      } else if (payload.eventType === 'DELETE' && payload.old) {
        var j = indexOfId(list, payload.old.id);
        if (j >= 0) list.splice(j, 1);
      }
      sortList(list, cfg.asc);
      state[key] = list; emit(key); emit('all');
    };
  }

  function indexOfId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return i; return -1; }
  function sortList(list, asc) {
    list.sort(function (a, b) {
      var ta = App.utils.toDate(a.createdAt) || new Date(0);
      var tb = App.utils.toDate(b.createdAt) || new Date(0);
      return asc ? (ta - tb) : (tb - ta);
    });
  }

  /* —— 写操作 —— */
  function baseFields() {
    return { room_id: state.roomId, user_id: state.profile.id, author_name: state.profile.name, author_color: state.profile.color };
  }

  function write(collection, data) {
    if (collection === 'checkins') return writeCheckin(data);
    var p = baseFields();
    if (collection === 'diary') { p.content = data.text || ''; p.mood = data.mood || '🥰'; }
    else if (collection === 'anniversaries') { p.title = data.title || ''; p.happen_date = data.date || ''; p.note = data.note || ''; }
    else if (collection === 'messages') { p.text = data.text || ''; p.anon = !!data.anon; }
    else return Promise.reject(new Error('未知集合'));
    return client().from(TABLE[collection]).insert(p);
  }

  /** 新增一条旅行打卡 */
  function writeCheckin(data) {
    return client().from(TABLE.checkins).insert({
      room_id: state.roomId,
      city_name: data.cityName || '',
      province: data.province || '',
      country: data.country || '中国',
      visit_date: data.visitDate || '',
      companion: data.companion || '',
      note: data.note || '',
      lon: data.lon || null,
      lat: data.lat || null,
      created_by: state.profile.id
    }).select().single();
  }

  function update(collection, id, data) {
    if (collection === 'checkins') return updateCheckin(id, data);
    var p = {};
    if (collection === 'anniversaries') { if (data.title !== undefined) p.title = data.title; if (data.date !== undefined) p.happen_date = data.date; if (data.note !== undefined) p.note = data.note; }
    else if (collection === 'diary') { if (data.text !== undefined) p.content = data.text; if (data.mood !== undefined) p.mood = data.mood; }
    else if (collection === 'messages') { if (data.text !== undefined) p.text = data.text; if (data.anon !== undefined) p.anon = !!data.anon; }
    else return Promise.reject(new Error('未知集合'));
    return client().from(TABLE[collection]).update(p).eq('id', id);
  }

  /** 更新一条旅行打卡 */
  function updateCheckin(id, data) {
    var p = {};
    if (data.cityName !== undefined) p.city_name = data.cityName;
    if (data.province !== undefined) p.province = data.province;
    if (data.country !== undefined) p.country = data.country;
    if (data.visitDate !== undefined) p.visit_date = data.visitDate;
    if (data.companion !== undefined) p.companion = data.companion;
    if (data.note !== undefined) p.note = data.note;
    if (data.lon !== undefined) p.lon = data.lon;
    if (data.lat !== undefined) p.lat = data.lat;
    return client().from(TABLE.checkins).update(p).eq('id', id);
  }

  function remove(collection, id) {
    return client().from(TABLE[collection]).delete().eq('id', id);
  }

  function updateRoom(data) {
    return client().from(TABLE.rooms).update({ start_date: data.startDate }).eq('id', state.roomId);
  }
  function updateProfile(patch) {
    state.profile = Object.assign({}, state.profile || {}, patch);
    try { localStorage.setItem(App.config.LS_PROFILE, JSON.stringify(state.profile)); } catch (e) {}
    ensureMember(state.roomId, state.profile).catch(function (e) { console.error(e); });
    emit('profile'); emit('all');
  }

  /* —— 照片上传：文件进 Storage，数据库只存 URL；可绑定打卡记录 —— */
  function uploadPhoto(blob, note, checkinId) {
    var path = state.roomId + '/' + state.profile.id + '/' + Date.now() + '-'
      + App.utils.randStr(4, 'abcdefghijklmnopqrstuvwxyz0123456789') + '.jpg';
    return client().storage.from(App.config.STORAGE_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg' })
      .then(function (up) {
        if (up.error) throw up.error;
        var url = client().storage.from(App.config.STORAGE_BUCKET).getPublicUrl(up.data.path).data.publicUrl;
        var row = {
          room_id: state.roomId, user_id: state.profile.id,
          author_name: state.profile.name, author_color: state.profile.color,
          photo_url: url, note: note || ''
        };
        if (checkinId) row.checkin_id = checkinId;
        return client().from(TABLE.photos).insert(row);
      });
  }

  /* —— 离开房间：取消订阅，不删云端数据 —— */
  function cleanup() {
    var c = client();
    if (c) channels.forEach(function (ch) { try { c.removeChannel(ch); } catch (e) {} });
    channels = [];
  }

  function onError(err) {
    console.error('Supabase 同步错误:', err);
    var msg = (err && err.message) || '';
    if (msg.indexOf('permission denied') >= 0) App.utils.toast('权限不足：请执行对应 SQL 的 RLS 策略');
    else if (msg.indexOf('Failed to fetch') >= 0) App.utils.toast('网络异常，正在重试…');
    else App.utils.toast('同步出错，请检查 Supabase 配置');
  }

  return {
    state: state, on: on, emit: emit, init: init, cleanup: cleanup,
    createRoom: createRoom, joinRoom: joinRoom,
    write: write, remove: remove, update: update, updateRoom: updateRoom,
    updateProfile: updateProfile, uploadPhoto: uploadPhoto
  };
})();