// The hybrid board: the static grid is plain HTML (one keyed <div
// class="tile wall|floor"> per cell, rendered through Hdo / the h framework)
// so the 15x13 tile layer stays exactly what the framework integration tests
// expect (195 tiles, ~100+ walls, grid-locked by default). The individual
// world entities - soft blocks (boxes), players, bombs, fires and power-ups -
// are real SVG nodes (document.createElementNS), one persistent <svg
// class="entities"> layered above the HTML grid, so each entity is a live SVG
// element that can be recolored, animated or keyed independently.
(function () {
  'use strict';

  var TILE = Game.TILE;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function isWall(c, r, cols, rows) {
    return c === 0 || r === 0 || c === cols - 1 || r === rows - 1
      || (c % 2 === 0 && r % 2 === 0);
  }

  // ---- HTML tile layer (rendered by Hdo / h framework) ------------------

  function tileClass(c, r, cols, rows) {
    return isWall(c, r, cols, rows) ? 'tile wall' : 'tile floor';
  }

  function tileVnode(snap) {
    var children = [];
    var cols = snap.cols;
    var rows = snap.rows;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        children.push(Hdo.h('div', {
          key: c + ',' + r,
          class: tileClass(c, r, cols, rows),
        }));
      }
    }
    return Hdo.h('div', { key: 'tiles', class: 'board' }, children);
  }

  // ---- SVG entity layer (world objects stay SVG) ------------------------

  function svgNode(doc, tag, attrs) {
    var el = doc.createElementNS(SVG_NS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) {
        el.setAttribute(k, attrs[k]);
      }
    }
    return el;
  }

  function entityRect(doc, cls, x, y, w, h, fill, dataId) {
    var attrs = {
      'class': cls,
      'x': x * TILE,
      'y': y * TILE,
      'width': w,
      'height': h,
    };
    if (fill) attrs['fill'] = fill;
    if (dataId !== undefined) attrs['data-id'] = dataId;
    return svgNode(doc, 'rect', attrs);
  }

  function entityCircle(doc, cls, x, y, r, fill, dataId) {
    var attrs = {
      'class': cls,
      'cx': x * TILE + TILE / 2,
      'cy': y * TILE + TILE / 2,
      'r': r,
    };
    if (fill) attrs['fill'] = fill;
    if (dataId !== undefined) attrs['data-id'] = dataId;
    return svgNode(doc, 'circle', attrs);
  }

  function buildEntities(doc, snap) {
    var g = svgNode(doc, 'g', { 'class': 'entities' });

    // boxes - destructible soft blocks still standing in this snapshot
    var boxes = snap.blocks || [];
    for (var q = 0; q < boxes.length; q++) {
      var box = boxes[q];
      g.appendChild(entityRect(doc, 'entity box',
        box.x, box.y, TILE, TILE, null, box.id));
    }

    // players - grouped shapes so the whole player moves as one entity
    var players = snap.players || [];
    for (var p = 0; p < players.length; p++) {
      var pl = players[p];
      var grp = svgNode(doc, 'g', {
        'class': 'entity player' + (pl.alive === false ? ' dead' : ''),
        'data-id': pl.id,
      });
      var body = entityRect(doc, 'player-body', pl.x, pl.y,
        Math.round(TILE * 0.72), Math.round(TILE * 0.72), pl.color, pl.id);
      grp.appendChild(body);
      g.appendChild(grp);
    }

    // bombs
    var bombs = snap.bombs || [];
    for (var b = 0; b < bombs.length; b++) {
      var bomb = bombs[b];
      g.appendChild(entityCircle(doc, 'entity bomb',
        bomb.x, bomb.y, Math.round(TILE * 0.28), null, bomb.id));
    }

    // fires / explosions
    var fires = snap.fires || [];
    for (var f = 0; f < fires.length; f++) {
      var fire = fires[f];
      g.appendChild(entityRect(doc, 'entity fire',
        fire.x, fire.y, TILE, TILE, null, f));
    }

    // power-ups
    var pus = snap.powerups || [];
    for (var u = 0; u < pus.length; u++) {
      var pu = pus[u];
      g.appendChild(entityCircle(doc, 'entity powerup ' + pu.type,
        pu.x, pu.y, Math.round(TILE * 0.3), null, pu.id));
    }

    // enemies (any entity the server lists as moving)
    var enemies = snap.enemies || [];
    for (var e = 0; e < enemies.length; e++) {
      var en = enemies[e];
      g.appendChild(entityRect(doc, 'entity enemy',
        en.x, en.y, Math.round(TILE * 0.78), Math.round(TILE * 0.78),
        '#e55', en.id));
    }

    return g;
  }

  // ---- public ------------------------------------------------------------

  Game.board = {
    TILE: TILE,
    render: function (el, state) {
      var snap = state && state.snapshot;
      if (!snap || !snap.cols || !snap.rows) return;

      // 1) HTML grid through Hdo - mounts into a stable host so the svg
      //    sibling below is never replaced.
      var host = el.querySelector('.tilegrid');
      if (!host) {
        host = el.ownerDocument.createElement('div');
        host.setAttribute('class', 'tilegrid');
        el.appendChild(host);
      }
      Hdo.render(tileVnode(snap), host);

      // 2) SVG entity layer - one persistent root, entities rebuilt per
      //    snapshot into it.
      var svgRoot = el.querySelector('svg.entities');
      if (!svgRoot) {
        svgRoot = svgNode(el.ownerDocument, 'svg', {
          'class': 'entities',
          'viewBox': '0 0 ' + (snap.cols * TILE) + ' ' + (snap.rows * TILE),
        });
        el.appendChild(svgRoot);
      }
      while (svgRoot.firstChild) {
        svgRoot.removeChild(svgRoot.firstChild);
      }
      svgRoot.appendChild(buildEntities(el.ownerDocument, snap));
    },
  };
})();
