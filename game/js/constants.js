// Shared game constants + config. Loaded before the other game scripts.
(function () {
  'use strict';
  window.Bomberman = {
    DEFAULT_PORT: 8080,
    TILE: 40,
    TICK_RATE: 30,
    PLAYER_COLORS: ['#ff5b6e', '#4fc3f7', '#81c784', '#ffd54f'],
    THEME_TEXT: '#0b1220',

    // Four preset key profiles so a full 4-player LAN party works on shared
    // keyboards. Switch profile from the lobby dropdown (each window uses its
    // own profile).
    PROFILES: [
      { name: 'P1 · WASD', drop: 'WASD', keys: { up: 'w', down: 's', left: 'a', right: 'd', drop: ' ' } },
      { name: 'P2 · Arrows', drop: 'Enter', keys: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', drop: 'Enter' } },
      { name: 'P3 · IJKL', drop: 'Shift', keys: { up: 'i', down: 'k', left: 'j', right: 'l', drop: 'Shift' } },
      { name: 'P4 · Numpad', drop: 'Numpad0', keys: { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', drop: 'Numpad0' } },
    ],

    // ws://host:port for the host server. Overridable via ?server=ws://… or
    // a global BOMBERMAN_SERVER override (the integration tests set this).
    serverUrl: function () {
      if (window.BOMBERMAN_SERVER) return window.BOMBERMAN_SERVER;
      var params = new URLSearchParams(window.location.search);
      var from = params.get('server');
      if (from) return from;
      var host = window.location.hostname || 'localhost';
      return 'ws://' + host + ':' + Bomberman.DEFAULT_PORT;
    },
  };

  window.Game = window.Bomberman;
  Game.now = function () {
    return (window.performance && window.performance.now)
      ? window.performance.now() : Date.now();
  };
})();