/* games/game.js — "Triangles": a very basic Vampire-Survivors-ish team brawl.
   No graphics: every unit is a triangle, square or circle.
   Your team is the triangles. Squares and circles come for you.
   Swords only hit in the direction you are moving. */

(function () {
  "use strict";

  if (!window.Phaser) {
    var mount = document.getElementById("game-mount");
    if (mount) {
      mount.innerHTML =
        '<p style="color:#ff5566;font-family:monospace;padding:1rem;">' +
        "Phaser could not be loaded (blocked CDN?). The game needs it to run.</p>";
    }
    return;
  }

  // ── Tunables ───────────────────────────────────────────────
  var VIEW = { w: 960, h: 600 };
  var WORLD = { w: 2600, h: 2000 };

  var COLORS = {
    grid: 0x14161c,
    gridBorder: 0x2a3040,
    player: 0x7fe7ff,
    playerStroke: 0xe8fbff,
    ally: 0x35d99a,
    allyStroke: 0xbaffdf,
    square: 0xff5566,
    squareStroke: 0x6b1e25,
    circle: 0xffa03d,
    circleStroke: 0x6b3c0a,
    hp: 0x5fe8c3,
    hpLow: 0xff5566
  };

  var TUNE = {
    player: {
      hp: 100, speed: 265, radius: 13, damage: 28,
      range: 64, arc: 0.62, cooldown: 0.4, invuln: 0.3
    },
    ally: {
      hp: 80, speed: 255, radius: 13, damage: 24,
      range: 60, arc: 0.62, cooldown: 0.55, invuln: 0.35,
      max: 3, respawn: 8, start: 2
    },
    square: { hp: 42, speed: 92, radius: 12, damage: 7, contact: 0.9 },
    circle: { hp: 24, speed: 148, radius: 9, damage: 5, contact: 0.7 },
    waveTime: 22,
    maxEnemies: 130,
    enemySearchRange: 620
  };

  function dist(ax, ay, bx, by) {
    return Math.hypot(bx - ax, by - ay);
  }

  // ── Unit ───────────────────────────────────────────────────
  function Unit(scene, o) {
    this.team = o.team; // "player" | "ally" | "enemy"
    this.kind = o.kind; // "triangle" | "square" | "circle"
    this.maxHp = o.hp;
    this.hp = o.hp;
    this.radius = o.radius;
    this.speed = o.speed;
    this.damage = o.damage;
    this.attackRange = o.range || 0;
    this.attackArc = o.arc || 0;
    this.attackCooldown = o.cooldown || 0.5;
    this.contactCooldown = o.contact || 0.8;
    this.invulnTime = o.invuln || 0;
    this.x = o.x;
    this.y = o.y;
    this.facing = o.facing != null ? o.facing : 0;
    this.alive = true;
    this.attackTimer = 0;
    this.contactTimer = 0;
    this.invuln = 0;
    this.flash = 0;
    this.wobble = Math.random() * Math.PI * 2;
    this.baseColor = o.color;

    var r = this.radius;
    var go;
    if (this.kind === "triangle") {
      // points straight along +x so rotation === facing angle
      go = scene.add.triangle(
        this.x, this.y,
        r, 0,
        -r * 0.6, r * 0.78,
        -r * 0.6, -r * 0.78,
        o.color, 1
      );
      go.setRotation(this.facing);
    } else if (this.kind === "square") {
      go = scene.add.rectangle(this.x, this.y, r * 2, r * 2, o.color, 1);
    } else {
      go = scene.add.circle(this.x, this.y, r, o.color, 1);
    }
    go.setStrokeStyle(2, o.stroke, 0.9);
    go.setDepth(o.depth || 5);
    this.go = go;
  }

  // ── Scene ──────────────────────────────────────────────────
  class ArenaScene extends Phaser.Scene {
    constructor() {
      super({ key: "arena" });
    }

    create() {
      this.player = null;
      this.allies = [];
      this.enemies = [];
      this.pendingAllies = [];

      this.elapsed = 0;
      this.wave = 1;
      this.waveShown = 0;
      this.kills = 0;
      this.over = false;
      this.spawnTimer = 1.6;

      this.drawArena();
      this.bindInput();
      this.spawnPlayer();
      for (var i = 0; i < TUNE.ally.start; i++) this.spawnAlly();

      this.bars = this.add.graphics().setDepth(30);
      this.buildHud();

      this.cameras.main.setBounds(0, 0, WORLD.w, WORLD.h);
      this.cameras.main.startFollow(this.player.go, true, 0.12, 0.12);
      this.cameras.main.setBackgroundColor(0x07070a);

      this.announce("MOVE TO SWING");
    }

    drawArena() {
      var g = this.add.graphics().setDepth(0);
      g.fillStyle(0x07070a, 1).fillRect(0, 0, WORLD.w, WORLD.h);
      g.lineStyle(1, COLORS.grid, 1);
      for (var x = 0; x <= WORLD.w; x += 100) g.lineBetween(x, 0, x, WORLD.h);
      for (var y = 0; y <= WORLD.h; y += 100) g.lineBetween(0, y, WORLD.w, y);
      g.lineStyle(2, COLORS.gridBorder, 1).strokeRect(1, 1, WORLD.w - 2, WORLD.h - 2);
      g.lineStyle(1, 0x1b2230, 1).strokeCircle(WORLD.w / 2, WORLD.h / 2, 220);
      g.lineStyle(1, 0x1b2230, 1).strokeCircle(WORLD.w / 2, WORLD.h / 2, 90);
    }

    bindInput() {
      var kb = this.input.keyboard;
      this.keys = kb.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,R");
      kb.addCapture(["UP", "DOWN", "LEFT", "RIGHT", "SPACE"]);
    }

    // ── Spawning ─────────────────────────────────────────────
    spawnPlayer() {
      var t = TUNE.player;
      this.player = new Unit(this, {
        team: "player", kind: "triangle",
        x: WORLD.w / 2, y: WORLD.h / 2,
        radius: t.radius, speed: t.speed, hp: t.hp, damage: t.damage,
        range: t.range, arc: t.arc, cooldown: t.cooldown, invuln: t.invuln,
        color: COLORS.player, stroke: COLORS.playerStroke, depth: 10
      });
    }

    spawnAlly() {
      var t = TUNE.ally;
      var a = Math.random() * Math.PI * 2;
      var x = Phaser.Math.Clamp(this.player.x + Math.cos(a) * 90, 30, WORLD.w - 30);
      var y = Phaser.Math.Clamp(this.player.y + Math.sin(a) * 90, 30, WORLD.h - 30);
      this.allies.push(new Unit(this, {
        team: "ally", kind: "triangle",
        x: x, y: y,
        radius: t.radius, speed: t.speed, hp: t.hp, damage: t.damage,
        range: t.range, arc: t.arc, cooldown: t.cooldown, invuln: t.invuln,
        color: COLORS.ally, stroke: COLORS.allyStroke, depth: 8
      }));
    }

    pickEnemySpawn() {
      var a = Math.random() * Math.PI * 2;
      var d = Phaser.Math.Between(560, 760);
      return {
        x: Phaser.Math.Clamp(this.player.x + Math.cos(a) * d, 40, WORLD.w - 40),
        y: Phaser.Math.Clamp(this.player.y + Math.sin(a) * d, 40, WORLD.h - 40)
      };
    }

    spawnEnemy() {
      var isCircle = this.wave >= 2 && Math.random() < 0.4;
      var base = isCircle ? TUNE.circle : TUNE.square;
      var hpScale = 1 + 0.12 * (this.wave - 1);
      var p = this.pickEnemySpawn();
      this.enemies.push(new Unit(this, {
        team: "enemy", kind: isCircle ? "circle" : "square",
        x: p.x, y: p.y,
        radius: base.radius,
        speed: base.speed + Math.min(30, this.wave * 2),
        hp: Math.round(base.hp * hpScale),
        damage: base.damage + 0.5 * (this.wave - 1),
        contact: base.contact,
        color: isCircle ? COLORS.circle : COLORS.square,
        stroke: isCircle ? COLORS.circleStroke : COLORS.squareStroke,
        depth: 5
      }));
    }

    // ── Attacks and damage ───────────────────────────────────
    swing(unit) {
      unit.attackTimer = unit.attackCooldown;

      var tint = unit.team === "player" ? 0xffffff : 0x7bffd0;
      var a0 = unit.facing - unit.attackArc;
      var a1 = unit.facing + unit.attackArc;

      var g = this.add.graphics({ x: unit.x, y: unit.y }).setDepth(19);
      g.fillStyle(tint, 0.28);
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, unit.attackRange, a0, a1, false);
      g.closePath();
      g.fillPath();
      g.lineStyle(2, tint, 0.8);
      g.beginPath();
      g.arc(0, 0, unit.attackRange, a0, a1, false);
      g.strokePath();
      this.tweens.add({
        targets: g, alpha: 0, duration: 150,
        onComplete: function () { g.destroy(); }
      });

      var self = this;
      this.enemies.slice().forEach(function (e) {
        if (!e.alive) return;
        var dx = e.x - unit.x;
        var dy = e.y - unit.y;
        var d = Math.hypot(dx, dy);
        if (d > unit.attackRange + e.radius) return;
        var angle = d < 1 ? unit.facing : Math.atan2(dy, dx);
        if (Math.abs(Phaser.Math.Angle.Wrap(angle - unit.facing)) > unit.attackArc) return;

        self.damage(e, unit.damage, unit);
        e.x = Phaser.Math.Clamp(e.x + Math.cos(unit.facing) * 9, 20, WORLD.w - 20);
        e.y = Phaser.Math.Clamp(e.y + Math.sin(unit.facing) * 9, 20, WORLD.h - 20);
      });
    }

    damage(unit, amount) {
      if (!unit || !unit.alive || unit.invuln > 0) return;
      unit.hp -= amount;
      unit.flash = 0.09;
      if (unit.invulnTime) unit.invuln = unit.invulnTime;
      if (unit.go) unit.go.setFillStyle(0xffffff, 1);
      if (unit.hp <= 0) {
        unit.hp = 0;
        this.kill(unit);
      }
    }

    kill(unit) {
      if (!unit.alive) return;
      unit.alive = false;

      if (unit.team === "enemy") {
        this.kills++;
        this.removeUnit(this.enemies, unit);
        var go = unit.go;
        unit.go = null;
        this.tweens.add({
          targets: go, alpha: 0, scaleX: 1.7, scaleY: 1.7, duration: 130,
          onComplete: function () { go.destroy(); }
        });
      } else if (unit.team === "ally") {
        this.removeUnit(this.allies, unit);
        if (unit.go) { unit.go.destroy(); unit.go = null; }
        this.pendingAllies.push(TUNE.ally.respawn);
      } else {
        unit.hp = 0;
        this.gameOver();
      }
    }

    removeUnit(list, unit) {
      var i = list.indexOf(unit);
      if (i >= 0) list.splice(i, 1);
    }

    gameOver() {
      if (this.over) return;
      this.over = true;
      if (this.player.go) this.player.go.setAlpha(0.25);

      this.add.rectangle(VIEW.w / 2, VIEW.h / 2, VIEW.w, VIEW.h, 0x000000, 0.72)
        .setScrollFactor(0).setDepth(300);

      this.add.text(VIEW.w / 2, VIEW.h / 2 - 54, "YOU DIED", {
        fontFamily: '"Courier New", monospace',
        fontSize: "44px",
        color: "#ff5566",
        fontStyle: "bold"
      }).setOrigin(0.5).setScrollFactor(0).setDepth(301);

      this.add.text(VIEW.w / 2, VIEW.h / 2 + 8,
        "wave " + this.wave + "   •   " + this.kills + " kills   •   " + this.formatTime(this.elapsed), {
          fontFamily: '"Courier New", monospace',
          fontSize: "20px",
          color: "#cfe9f2"
        }).setOrigin(0.5).setScrollFactor(0).setDepth(301);

      this.add.text(VIEW.w / 2, VIEW.h / 2 + 56, "press R to go again", {
        fontFamily: '"Courier New", monospace',
        fontSize: "16px",
        color: "#7fe7ff"
      }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
    }

    // ── HUD ──────────────────────────────────────────────────
    buildHud() {
      var font = '"Courier New", monospace';
      this.hpBar = this.add.graphics().setScrollFactor(0).setDepth(150);
      this.hpText = this.add.text(16, 34, "", {
        fontFamily: font, fontSize: "13px", color: "#9fc8d4"
      }).setScrollFactor(0).setDepth(150);
      this.statText = this.add.text(VIEW.w - 16, 14, "", {
        fontFamily: font, fontSize: "16px", color: "#cfe9f2", align: "right", lineSpacing: 4
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(150);
      this.add.text(16, VIEW.h - 30,
        "WASD / arrows move   •   sword swings where you walk   •   SPACE manual swing", {
          fontFamily: font, fontSize: "13px", color: "#5b7a85"
        }).setScrollFactor(0).setDepth(150);
    }

    announce(text) {
      var t = this.add.text(VIEW.w / 2, 132, text, {
        fontFamily: '"Courier New", monospace',
        fontSize: "26px",
        color: "#e8fbff",
        fontStyle: "bold"
      }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
      this.tweens.add({
        targets: t, alpha: 0, y: 104, duration: 1500, ease: "Sine.easeIn",
        onComplete: function () { t.destroy(); }
      });
    }

    formatTime(s) {
      var m = Math.floor(s / 60);
      var sec = Math.floor(s % 60);
      return m + ":" + (sec < 10 ? "0" : "") + sec;
    }

    updateHud() {
      var p = this.player;
      var frac = Phaser.Math.Clamp(p.hp / p.maxHp, 0, 1);

      this.hpBar.clear();
      this.hpBar.fillStyle(0x0d1418, 0.85).fillRect(14, 14, 220, 16);
      this.hpBar.fillStyle(frac > 0.35 ? COLORS.hp : COLORS.hpLow, 1)
        .fillRect(16, 16, 216 * frac, 12);
      this.hpBar.lineStyle(1, 0x2b4a55, 1).strokeRect(14, 14, 220, 16);

      this.hpText.setText("HP " + Math.ceil(p.hp) + " / " + p.maxHp);
      this.statText.setText([
        "WAVE  " + this.wave,
        "KILLS " + this.kills,
        "TIME  " + this.formatTime(this.elapsed),
        "TEAM  " + (this.allies.length + 1) + "/" + (TUNE.ally.max + 1)
      ].join("\n"));
    }

    drawBars(units) {
      var g = this.bars;
      g.clear();
      for (var i = 0; i < units.length; i++) {
        var u = units[i];
        if (!u.alive || u.hp >= u.maxHp) continue;
        var w = u.radius * 2.4;
        var x = u.x - w / 2;
        var y = u.y - u.radius - 9;
        g.fillStyle(0x000000, 0.55).fillRect(x - 1, y - 1, w + 2, 4);
        g.fillStyle(u.team === "enemy" ? COLORS.square : COLORS.hp, 1)
          .fillRect(x, y, w * Phaser.Math.Clamp(u.hp / u.maxHp, 0, 1), 2);
      }
    }

    // ── Main loop ────────────────────────────────────────────
    update(time, delta) {
      if (this.over) {
        if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.scene.restart();
        return;
      }

      var dt = Math.min(delta, 50) / 1000;
      this.elapsed += dt;

      this.tickWave(dt);
      this.tickRespawns(dt);
      this.tickPlayer(dt);
      this.tickAllies(dt);
      this.tickEnemies(dt);
      this.separate();
      this.tickTimers(dt);
      this.syncSprites();
      this.updateHud();
    }

    tickWave(dt) {
      this.wave = 1 + Math.floor(this.elapsed / TUNE.waveTime);
      if (this.wave !== this.waveShown) {
        this.waveShown = this.wave;
        if (this.wave > 1) this.announce("WAVE " + this.wave);
      }

      this.spawnTimer -= dt;
      if (this.spawnTimer > 0) return;

      this.spawnTimer = Math.max(0.3, 1.15 - this.wave * 0.1);
      var batch = 1 + Math.min(2, Math.floor((this.wave - 1) / 3));
      for (var i = 0; i < batch && this.enemies.length < TUNE.maxEnemies; i++) {
        this.spawnEnemy();
      }
    }

    // Fallen teammates come back from the edge of the map after a while.
    tickRespawns(dt) {
      for (var i = this.pendingAllies.length - 1; i >= 0; i--) {
        this.pendingAllies[i] -= dt;
        if (this.pendingAllies[i] <= 0) {
          this.pendingAllies.splice(i, 1);
          if (this.allies.length < TUNE.ally.max) this.spawnAlly();
        }
      }
    }

    tickPlayer(dt) {
      var p = this.player;
      var k = this.keys;
      var ix = 0;
      var iy = 0;
      if (k.A.isDown || k.LEFT.isDown) ix -= 1;
      if (k.D.isDown || k.RIGHT.isDown) ix += 1;
      if (k.W.isDown || k.UP.isDown) iy -= 1;
      if (k.S.isDown || k.DOWN.isDown) iy += 1;

      var moving = ix !== 0 || iy !== 0;
      if (moving) {
        var len = Math.hypot(ix, iy);
        ix /= len;
        iy /= len;
        p.facing = Math.atan2(iy, ix);
        p.x = Phaser.Math.Clamp(p.x + ix * p.speed * dt, 16, WORLD.w - 16);
        p.y = Phaser.Math.Clamp(p.y + iy * p.speed * dt, 16, WORLD.h - 16);
        // the sword only ever hits where you are walking
        if (p.attackTimer <= 0) this.swing(p);
      }

      if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) && p.attackTimer <= 0) {
        this.swing(p);
      }
    }

    tickAllies(dt) {
      var self = this;
      this.allies.forEach(function (a, idx) {
        var target = null;
        var bestD = TUNE.enemySearchRange;
        self.enemies.forEach(function (e) {
          var d = dist(a.x, a.y, e.x, e.y);
          if (d < bestD) { bestD = d; target = e; }
        });

        if (target) {
          var ang = Math.atan2(target.y - a.y, target.x - a.x);
          a.facing = ang;
          if (bestD > a.attackRange * 0.9) {
            a.x = Phaser.Math.Clamp(a.x + Math.cos(ang) * a.speed * dt, 16, WORLD.w - 16);
            a.y = Phaser.Math.Clamp(a.y + Math.sin(ang) * a.speed * dt, 16, WORLD.h - 16);
          } else if (a.attackTimer <= 0) {
            self.swing(a);
          }
          return;
        }

        // nobody to fight: hold a loose ring around the player
        var slot = (idx / Math.max(1, TUNE.ally.max)) * Math.PI * 2;
        var ang2 = self.elapsed * 0.4 + slot;
        var tx = self.player.x + Math.cos(ang2) * 80;
        var ty = self.player.y + Math.sin(ang2) * 80;
        var dd = dist(a.x, a.y, tx, ty);
        if (dd > 10) {
          var a2 = Math.atan2(ty - a.y, tx - a.x);
          a.facing = a2;
          a.x = Phaser.Math.Clamp(a.x + Math.cos(a2) * a.speed * dt, 16, WORLD.w - 16);
          a.y = Phaser.Math.Clamp(a.y + Math.sin(a2) * a.speed * dt, 16, WORLD.h - 16);
        }
      });
    }

    tickEnemies(dt) {
      var self = this;
      var targets = [this.player].concat(this.allies);

      this.enemies.forEach(function (e) {
        var best = null;
        var bestD = Infinity;
        for (var i = 0; i < targets.length; i++) {
          var t = targets[i];
          if (!t.alive) continue;
          var d2 = (t.x - e.x) * (t.x - e.x) + (t.y - e.y) * (t.y - e.y);
          if (d2 < bestD) { bestD = d2; best = t; }
        }
        if (!best) return;

        var d = Math.sqrt(bestD);
        var ang = Math.atan2(best.y - e.y, best.x - e.x);
        var touch = best.radius + e.radius;

        if (d > touch) {
          var step = e.speed * dt;
          e.x += Math.cos(ang) * step;
          e.y += Math.sin(ang) * step;
          // small sideways drift so the crowd does not turn into one blob
          var w = Math.sin(self.elapsed * 2.6 + e.wobble) * 0.3;
          e.x += Math.cos(ang + Math.PI / 2) * step * w;
          e.y += Math.sin(ang + Math.PI / 2) * step * w;
        }
        e.facing = ang;

        if (d <= touch + 3 && e.contactTimer <= 0) {
          self.damage(best, e.damage);
          e.contactTimer = e.contactCooldown;
        }
      });
    }

    separate() {
      var list = this.enemies;
      for (var i = 0; i < list.length; i++) {
        var a = list[i];
        for (var j = i + 1; j < list.length; j++) {
          var b = list[j];
          var dx = b.x - a.x;
          var dy = b.y - a.y;
          var min = a.radius + b.radius;
          var d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 === 0) continue;
          var d = Math.sqrt(d2);
          var push = (min - d) * 0.5;
          var nx = dx / d;
          var ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
      for (var m = 0; m < list.length; m++) {
        list[m].x = Phaser.Math.Clamp(list[m].x, 16, WORLD.w - 16);
        list[m].y = Phaser.Math.Clamp(list[m].y, 16, WORLD.h - 16);
      }
    }

    tickTimers(dt) {
      var all = [this.player].concat(this.allies, this.enemies);
      for (var i = 0; i < all.length; i++) {
        var u = all[i];
        if (u.attackTimer > 0) u.attackTimer -= dt;
        if (u.contactTimer > 0) u.contactTimer -= dt;
        if (u.invuln > 0) u.invuln -= dt;
        if (u.flash > 0) {
          u.flash -= dt;
          if (u.flash <= 0 && u.go && u.alive) u.go.setFillStyle(u.baseColor, 1);
        }
      }
    }

    syncSprites() {
      var all = [this.player].concat(this.allies, this.enemies);
      for (var i = 0; i < all.length; i++) {
        var u = all[i];
        if (!u.go) continue;
        u.go.x = u.x;
        u.go.y = u.y;
        if (u.kind === "triangle") u.go.rotation = u.facing;
      }
      this.drawBars(all);
    }
  }

  function boot() {
    if (!document.getElementById("game-mount")) return;
    new Phaser.Game({
      type: Phaser.AUTO,
      parent: "game-mount",
      width: VIEW.w,
      height: VIEW.h,
      backgroundColor: "#07070a",
      disableContextMenu: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      scene: [ArenaScene]
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
