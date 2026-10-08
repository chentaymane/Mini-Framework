// Keyboard input. Trade: movement is grid-locked classic Bomberman — one key
// press = exactly one tile (a `step` message). No held-key streaming, and
// holding a direction does NOT auto-repeat (press repeatedly to walk). Drop
// is momentary: one press arms the bomb, then the key is released 80 ms later.
(function () {
  'use strict';

  var profileIndex = 0;
  var dropping = false;

  var DIRS = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 },
  };

  function keys() {
    return Game.PROFILES[profileIndex].keys;
  }

  function step(action) {
    var d = DIRS[action];
    if (d && Game.net && Game.net.sendStep) Game.net.sendStep(d.dx, d.dy);
  }

  function press(action) {
    if (!action) return;
    if (action === 'drop') {
      // momentary: plant once
      if (dropping) return;
      dropping = true;
      Game.net.sendInput({ drop: true });
      setTimeout(function () {
        dropping = false;
        Game.net.sendInput({ drop: false });
      }, 80);
      return;
    }
    step(action);
  }

  // ---- lifecycle -----------------------------------------------------

  Game.input = {
    init: function () {
      Hdo.listen(window, 'keydown', function (e) {
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
        if (e.repeat) return;
        var map = keys();
        if (e.key === map.up) press('up');
        else if (e.key === map.down) press('down');
        else if (e.key === map.left) press('left');
        else if (e.key === map.right) press('right');
        else if (e.key === map.drop) press('drop');
        else return;
        if (e.cancelable) e.preventDefault();
      });
      this.setProfile(0);
    },

    setProfile: function (i) {
      profileIndex = i;
    },

    profileIndex: function () { return profileIndex; },
  };
})();