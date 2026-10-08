// Networking layer around Hdo.connect(). Turns server messages into store
// state; the board + HUD read the store.
(function () {
  'use strict';

  var state = {
    conn: null,
    unlisteners: [],
  };

  function cleanup() {
    if (state.unlisteners.length) {
      for (var i = 0; i < state.unlisteners.length; i++) state.unlisteners[i]();
      state.unlisteners = [];
    }
  }

  function on(type, fn) {
    if (state.conn) state.unlisteners.push(state.conn.on(type, fn));
  }

  // ---- message handlers ----------------------------------------------

  function handleJoined(p) {
    Hdo.batch(function () {
      Hdo.setState({
        connected: true,
        playerId: p.playerId,
        room: p.room,
        color: p.color,
        phase: 'lobby',
        error: null,
      });
    });
  }

  function handlePlayers(p) {
    Hdo.setState({ roster: (p.roster || []).map(function (q) {
      return { id: q.id, name: q.name, color: q.color };
    }) });
  }

  function handleSnapshot(snap) {
    Hdo.setState({ snapshot: snap });
  }

  function handlePhase(p) {
    // phase broadcasts carry no event id beyond the phase name
    Hdo.setState({ phase: p.phase || p });
  }

  function handleOver(p) {
    Hdo.batch(function () {
      Hdo.setState({
        phase: 'over',
        winner: p.winner,
        scores: p.scores || {},
      });
    });
  }

  function handleError(p) {
    Hdo.setState({ error: p && p.message ? p.message : 'Something went wrong', connected: false, phase: 'menu' });
  }

  function handleClose() {
    Hdo.batch(function () {
      var s = Hdo.getState();
      Hdo.setState({
        connected: false,
        error: s.phase === 'playing' ? 'Connection to the host lost' : 'Disconnected from host',
        phase: 'menu',
      });
      // revert to backing off so a reconnect in the menu works cleanly
    });
  }

  // ---- public --------------------------------------------------------

  Game.net = {
    connect: function () {
      cleanup();
      Hdo.batch(function () {
        Hdo.setState({ connected: false, error: null, phase: 'connecting' });
      });
      state.conn = Hdo.connect(Game.serverUrl());

      var opened = false;
      state.unlisteners.push(state.conn.onOpen(function () {
        opened = true;
        var s = Hdo.getState();
        Game.net.send('join', { name: s.name || 'Player', room: s.room || 'arena' });
      }));
      on('joined', handleJoined);
      on('players', handlePlayers);
      on('snapshot', handleSnapshot);
      on('phase', handlePhase);
      on('over', handleOver);
      on('error', handleError);
      state.unlisteners.push(state.conn.onClose(handleClose));
    },

    send: function (type, payload) {
      if (state.conn && typeof state.conn.ready === 'function' && state.conn.ready()) {
        state.conn.send(type, payload);
      }
    },

    sendInput: function (input) {
      this.send('input', input);
    },

    // One direction key press = exactly one tile. The host validates the move
    // (target cell open + not occupied) and the snapshot reflects it.
    sendStep: function (dx, dy) {
      this.send('step', { dx: dx === 0 ? 0 : (dx > 0 ? 1 : -1), dy: dy === 0 ? 0 : (dy > 0 ? 1 : -1) });
    },

    start: function () {
      this.send('start', {});
    },

    disconnect: function () {
      cleanup();
      if (state.conn) state.conn.close();
      state.conn = null;
    },
  };

  // keep close handler decoupled but registered for the current conn
})();