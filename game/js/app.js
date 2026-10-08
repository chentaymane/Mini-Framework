// App shell: the screen overlays (menu / lobby / result), the HUD bar and
// the render loop that drives the all-DOM board at display frequency.
(function () {
  'use strict';

  var screensEl = document.getElementById('screens');
  var hudEl = document.getElementById('hud');
  var boardEl = document.getElementById('board');

  // The reactive slice the HUD + overlays subscribe to. State that changes
  // every frame (the snapshot) is deliberately left out, so a 30Hz snapshot
  // never re-renders these views — only real UI facts do.
  function stateSlice(state) {
    return {
      phase: state.phase,
      room: state.room,
      name: state.name,
      error: state.error,
      connected: state.connected,
      playerId: state.playerId,
      color: state.color,
      winner: state.winner,
      roster: state.roster,
      scores: state.scores,
      countdown: state.snapshot ? Math.ceil(state.snapshot.countdown * 10) / 10 : 0,
    };
  }

  // ---- small view helpers --------------------------------------------

  function panel(kind, children) {
    return Hdo.h('div', { class: 'panel ' + kind }, children);
  }
  function btn(label, handler, extra) {
    return Hdo.h('button', Object.assign({ class: 'btn' + (extra ? ' ' + extra : '') }, handler ? { on: { click: handler } } : {}, extra && extra.disabled ? { disabled: true } : {}), label);
  }
  function forName(s, id) {
    for (var i = 0; i < s.roster.length; i++) {
      if (s.roster[i].id === id) return s.roster[i].name || id;
    }
    return id;
  }

  // ---- actions -------------------------------------------------------

  function doConnect() {
    var s = Hdo.getState();
    var name = (s.name || '').trim() || 'Player';
    Hdo.batch(function () {
      Hdo.setState({ name: name, room: (s.room || 'arena').trim() || 'arena', error: null });
    });
    try { window.localStorage.setItem('hdo-bm-name', name); } catch (e) { /* private mode */ }
    Game.net.connect();
  }

  function doStart() {
    if (Hdo.getState().roster.length < 2) return;
    Game.net.start();
  }

  function setField(field) {
    return function (e) {
      var next = {};
      next[field] = e.target.value;
      Hdo.setState(next);
    };
  }

  function setProfile(e) {
    Game.input.setProfile(parseInt(e.target.value, 10));
  }

  // ---- views ---------------------------------------------------------

  function menuView(s) {
    return panel('screen', [
      Hdo.h('h1', { class: 'logo' }, 'Hdo BOMBERMAN'),
      Hdo.h('p', { class: 'sub' }, 'Up to 4 players per room — one WebSocket host, all-DOM board.'),
      Hdo.h('label', null, [
        Hdo.h('span', null, 'Nickname'),
        Hdo.h('input', {
          id: 'name', value: s.name, placeholder: 'Player',
          on: { input: setField('name') },
        }),
      ]),
      Hdo.h('label', null, [
        Hdo.h('span', null, 'Room'),
        Hdo.h('input', {
          id: 'room', value: s.room, placeholder: 'arena',
          on: { input: setField('room') },
        }),
      ]),
      Hdo.h('label', null, [
        Hdo.h('span', null, 'Controls profile'),
        Hdo.h('select', { id: 'profile', on: { change: setProfile } },
          Game.PROFILES.map(function (p, i) {
            return Hdo.h('option', { value: String(i), selected: i === Game.input.profileIndex() }, p.name + ' · drop = ' + p.drop);
          })),
      ]),
      btn('Connect', doConnect, { block: true }),
      s.error ? Hdo.h('p', { class: 'error' }, s.error) : null,
    ]);
  }

  function rosterView(s) {
    var slots = [];
    var count = Math.max(s.roster.length, 1);
    for (var i = 0; i < count; i++) {
      var p = s.roster[i];
      slots.push(Hdo.h('div', {
        key: i,
        class: 'slot' + (p && p.id === s.playerId ? ' you' : ''),
      }, [
        Hdo.h('span', { class: 'dot', style: { background: p ? p.color : '#333c4f' } }),
        p
          ? Hdo.h('span', { class: 'slot-name' }, p.name + (p.id === s.playerId ? ' (you)' : ''))
          : Hdo.h('span', { class: 'slot-name dim' }, 'open slot'),
      ]));
    }
    return slots;
  }

  function lobbyView(s) {
    return panel('screen', [
      Hdo.h('h2', { class: 'panel-title' }, 'LOBBY · ' + s.room.toUpperCase()),
      Hdo.h('div', { class: 'roster' }, rosterView(s)),
      Hdo.h('p', { class: 'hint' }, 'Start when at least 2 players are in. Keys: ' + Game.PROFILES[Game.input.profileIndex()].name),
      btn('Start match', doStart, { block: true, disabled: s.roster.length < 2 }),
      s.error ? Hdo.h('p', { class: 'error' }, s.error) : null,
      btn('Disconnect', function () { Game.net.disconnect(); Hdo.setState({ phase: 'menu' }); }),
    ]);
  }

  function overView(s) {
    var rows = [];
    for (var i = 0; i < s.roster.length; i++) {
      var p = s.roster[i];
      rows.push(Hdo.h('div', { key: p.id, class: 'score-row' }, [
        Hdo.h('span', { class: 'dot', style: { background: p.color } }),
        Hdo.h('span', { class: 'sname' }, p.name),
        Hdo.h('span', { class: 'sval' }, String((s.scores && s.scores[p.id]) || 0)),
      ]));
    }
    return panel('screen', [
      Hdo.h('div', { class: 'trophy' }, s.winner ? forName(s, s.winner) + ' WINS!' : 'DRAW'),
      Hdo.h('div', { class: 'scoreboard' }, rows),
      Hdo.h('p', { class: 'hint' }, 'Next round starts automatically in a moment…'),
    ]);
  }

  function screensView() {
    var state = Hdo.getState();
    var s = stateSlice(state);
    if (s.phase === 'connecting' || (s.phase === 'menu' && s.connected)) {
      return Hdo.h('div', { class: 'overlay-root' },
        panel('screen', Hdo.h('p', { class: 'pad' }, 'Connecting to host…')));
    }
    if (s.phase === 'menu' || !s.phase) return menuView(s);
    if (s.phase === 'lobby') return lobbyView(s);
    if (s.phase === 'over') return overView(s);
    // countdown / playing: the board takes the stage
    return Hdo.h('div', { class: 'empty' });
  }

  function hudView() {
    var state = Hdo.getState();
    var s = stateSlice(state);
    var chips = [];
    if (s.phase === 'countdown') chips.push(Hdo.h('span', { class: 'chip countdown' }, 'starting in ' + s.countdown + 's'));
    if (s.phase === 'playing') chips.push(Hdo.h('span', { class: 'chip playing chip-live' }, '● LIVE'));
    if (s.phase === 'over') chips.push(Hdo.h('span', { class: 'chip' }, 'round over'));
    if (s.phase === 'lobby') chips.push(Hdo.h('span', { class: 'chip' }, 'waiting…'));
    if (s.phase === 'over' && s.winner !== null) {
      chips.push(Hdo.h('span', { class: 'chip winner-chip' }, forName(s, s.winner) + ' won!'));
    }

    var dots = [];
    for (var i = 0; i < s.roster.length; i++) {
      var p = s.roster[i];
      dots.push(Hdo.h('span', {
        key: p.id,
        class: 'hud-player' + (p.id === s.playerId ? ' you' : ''),
        title: p.name,
      }, [
        Hdo.h('span', { class: 'hdot', style: { background: p.color } }),
        p.name.split(' ')[0],
      ]));
    }

    return Hdo.h('div', { class: 'hud-wrap' }, [
      Hdo.h('span', { class: 'chip room' }, 'ROOM ' + (s.room || '').toUpperCase()),
      Hdo.h('span', { class: 'hud-dots' }, dots),
    ].concat(chips));
  }

  // ---- boot ----------------------------------------------------------

  Hdo.setState({
    phase: 'menu',
    room: 'arena',
    name: (function () { try { return window.localStorage.getItem('hdo-bm-name') || ''; } catch (e) { return ''; } })(),
    playerId: null,
    color: '#fff',
    connected: false,
    roster: [],
    snapshot: null,
    winner: null,
    scores: {},
    error: null,
  });

  Hdo.mount(screensView, screensEl, { select: stateSlice });
  Hdo.mount(hudView, hudEl, { select: stateSlice });

  Game.input.init();

  // Display loop: renders the board every animation frame at display rate.
  // Positions are snapshots verbatim (players move one tile per press), so
  // the render is always exact.
  var running = true;
  Game.loopHandle = Hdo.loop(function () {
    if (running) Game.board.render(boardEl, Hdo.getState());
  });

  window.addEventListener('beforeunload', function () { Game.net.disconnect(); });

  window.GameApp = {
    connect: doConnect,
    start: doStart,
    getState: Hdo.getState,
  };
})();